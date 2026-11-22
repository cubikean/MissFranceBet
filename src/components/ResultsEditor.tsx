// Saisie des résultats pendant l'émission (admin de la party) : top 15, puis top 5, puis podium.
// Chaque étape est un brouillon local, enregistré d'un coup quand il est complet : les joueurs ne
// voient jamais un top 15 à moitié saisi (qui éliminerait à tort les candidates pas encore cochées).
import { useEffect, useState } from 'react'
import { errorMessage, listCandidates, missLabel, setResults, type Candidate, type Results } from '../lib'
import { ConfirmDialog } from './ConfirmDialog'
import {
  clearDraft,
  draftKey,
  podiumDraft,
  readDraft,
  sessionDraftStorage,
  subsetDraft,
  writeDraft,
} from './resultsDraft'
import './ResultsEditor.css'

type Step = 'top15' | 'top5' | 'podium'
type Patch = Parameters<typeof setResults>[1]

const PODIUM_SLOTS = [
  { key: 'winner', label: 'Miss France' },
  { key: 'firstRunnerUp', label: '1re dauphine' },
  { key: 'secondRunnerUp', label: '2e dauphine' },
] as const

const STEP_LABEL: Record<Step, string> = { top15: 'Top 15', top5: 'Top 5', podium: 'Podium' }

function firstStep(r: Results): Step {
  if (!r.top15) return 'top15'
  if (!r.top5) return 'top5'
  return 'podium'
}

function podiumOf(r: Results): (string | null)[] {
  return [r.winner, r.firstRunnerUp, r.secondRunnerUp]
}

const NO_PODIUM: Patch = { winner: null, firstRunnerUp: null, secondRunnerUp: null }

export interface ResultsEditorProps {
  partyId: string
  editionId: string
  results: Results
  /**
   * Résultats affichés sans saisie possible : soirée terminée. Les règles n'acceptent les
   * résultats qu'en phase 'closed' ; pour corriger, l'admin revient à la soirée en cours.
   */
  readOnly?: boolean
  /** Appelé après l'enregistrement du podium (pour proposer de terminer la soirée). */
  onPodiumSaved?: () => void
}

export function ResultsEditor({ readOnly, ...props }: ResultsEditorProps) {
  return readOnly ? <ResultsSummary editionId={props.editionId} results={props.results} /> : <Editor {...props} />
}

/** Résultats enregistrés, en lecture seule : podium, top 5, top 15. */
function ResultsSummary({ editionId, results }: { editionId: string; results: Results }) {
  const byId = new Map(listCandidates(editionId).map((c) => [c.id, c]))
  const region = (id: string) => byId.get(id)?.region ?? id
  const podium = podiumOf(results)
  if (!results.top15 && !results.top5 && !results.winner) {
    return <p className="muted">Aucun résultat n'a été saisi pour cette soirée.</p>
  }
  return (
    <div className="results">
      {results.winner && (
        <ul className="podium-slots results__readonly-podium" aria-label="Podium">
          {PODIUM_SLOTS.map((s, i) => (
            <li key={s.key} className={`podium-slot podium-slot--static podium-slot--${s.key}`}>
              <span className="podium-slot__label">{s.label}</span>
              <span className="podium-slot__value">{podium[i] ? region(podium[i]!) : 'non saisie'}</span>
            </li>
          ))}
        </ul>
      )}
      {(['top5', 'top15'] as const).map((key) => {
        const ids = results[key]
        if (!ids) return null
        return (
          <section key={key} className="results__readonly-list" aria-labelledby={`results-${key}`}>
            <h3 id={`results-${key}`} className="results__readonly-title">
              {STEP_LABEL[key]}
            </h3>
            <p>{ids.map(region).join(', ')}</p>
          </section>
        )
      })}
    </div>
  )
}

function Editor({ partyId, editionId, results, onPodiumSaved }: Omit<ResultsEditorProps, 'readOnly'>) {
  const candidates = listCandidates(editionId)
  const [chosen, setStep] = useState<Step>(() => firstStep(results))
  const done: Record<Step, boolean> = {
    top15: !!results.top15,
    top5: !!results.top5,
    podium: !!results.winner,
  }
  const available: Record<Step, boolean> = { top15: true, top5: done.top15, podium: done.top5 }
  // Si une étape précédente vient d'être effacée, on revient à la première étape incomplète.
  const step = available[chosen] ? chosen : firstStep(results)
  const byId = new Map(candidates.map((c) => [c.id, c]))
  const pool = (ids: string[] | null) => (ids ?? []).map((id) => byId.get(id)).filter((c): c is Candidate => !!c)

  async function save(patch: Patch, next?: Step) {
    await setResults(partyId, patch)
    if (next) setStep(next)
  }

  // La clé remet le brouillon à zéro quand les résultats enregistrés changent.
  const savedAt = results.updatedAt?.getTime() ?? 0
  const version = `${step}-${savedAt}`
  // Brouillon gardé dans sessionStorage (changement d'onglet, app tuée par iOS pendant l'annonce).
  const draft = (s: Step) => ({ storageKey: draftKey(partyId, s), savedAt })

  return (
    <div className="results">
      <div className="results__steps" role="group" aria-label="Étape de saisie">
        {(['top15', 'top5', 'podium'] as Step[]).map((s, i) => (
          <button
            key={s}
            type="button"
            className="results__step"
            aria-pressed={step === s}
            disabled={!available[s]}
            onClick={() => setStep(s)}
          >
            <span className="results__step-num" aria-hidden="true">
              {done[s] ? '✓' : i + 1}
            </span>
            {STEP_LABEL[s]}
            {done[s] && <span className="visually-hidden"> (saisi)</span>}
          </button>
        ))}
      </div>

      {step === 'top15' && (
        <SubsetStep
          key={version}
          {...draft('top15')}
          label="top 15"
          size={15}
          pool={candidates}
          saved={results.top15}
          onSave={(ids) => {
            const patch: Patch = { top15: ids }
            // Ce qui suit doit rester inclus dans le nouveau top 15.
            if (results.top5 && !results.top5.every((id) => ids.includes(id))) Object.assign(patch, { top5: null }, NO_PODIUM)
            else if (podiumOf(results).some((id) => id && !ids.includes(id))) Object.assign(patch, NO_PODIUM)
            return save(patch, 'top5')
          }}
          onClear={() => save({ top15: null, top5: null, ...NO_PODIUM })}
        />
      )}
      {step === 'top5' && (
        <SubsetStep
          key={version}
          {...draft('top5')}
          label="top 5"
          size={5}
          pool={pool(results.top15)}
          saved={results.top5}
          onSave={(ids) => {
            const patch: Patch = { top5: ids }
            if (podiumOf(results).some((id) => id && !ids.includes(id))) Object.assign(patch, NO_PODIUM)
            return save(patch, 'podium')
          }}
          onClear={() => save({ top5: null, ...NO_PODIUM })}
        />
      )}
      {step === 'podium' && (
        <PodiumStep
          key={version}
          {...draft('podium')}
          pool={pool(results.top5)}
          saved={podiumOf(results)}
          onSave={async ([winner, firstRunnerUp, secondRunnerUp]) => {
            await save({ winner, firstRunnerUp, secondRunnerUp })
            onPodiumSaved?.()
          }}
          onClear={() => save(NO_PODIUM)}
        />
      )}
    </div>
  )
}

// ---------- Étapes ----------

function CandidateTile({
  candidate,
  selected,
  disabled,
  badge,
  onToggle,
}: {
  candidate: Candidate
  selected: boolean
  disabled?: boolean
  badge?: string
  onToggle: () => void
}) {
  return (
    <li>
      <button
        type="button"
        className="result-tile"
        aria-pressed={selected}
        disabled={disabled}
        onClick={onToggle}
      >
        <img className="result-tile__photo" src={candidate.photo} alt="" loading="lazy" decoding="async" />
        <span className="result-tile__region">{candidate.region}</span>
        {selected && (
          <span className="result-tile__badge" aria-hidden="true">
            {badge ?? '✓'}
          </span>
        )}
      </button>
    </li>
  )
}

function useSaving() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}

function StepFooter({
  count,
  size,
  ready,
  dirty,
  saved,
  busy,
  saveLabel,
  onSave,
}: {
  count: number
  size: number
  ready: boolean
  dirty: boolean
  /** true si cette étape a déjà été enregistrée */
  saved: boolean
  busy: boolean
  saveLabel: string
  onSave: () => void
}) {
  // Rien de coché et rien d'enregistré : pas de « enregistré » trompeur.
  const note = count === 0 && !saved ? null : dirty ? 'pas encore enregistré' : 'enregistré'
  return (
    <div className="results__bar">
      <p className="results__count" aria-live="polite">
        <strong>
          {count}/{size}
        </strong>
        {note && <span className="muted"> {note}</span>}
      </p>
      <button type="button" className="button button--action" disabled={!ready || !dirty || busy} onClick={onSave}>
        {busy ? 'Un instant…' : saveLabel}
      </button>
    </div>
  )
}

function ClearButton({ label, saved, onClear }: { label: string; saved: boolean; onClear: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  if (!saved) return null
  return (
    <>
      <button type="button" className="button button--ghost results__clear" onClick={() => setOpen(true)}>
        Effacer le {label}
      </button>
      <ConfirmDialog
        open={open}
        title={`Effacer le ${label} ?`}
        confirmLabel={`Effacer le ${label}`}
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          await onClear()
          setOpen(false)
        }}
      >
        <p>Tous les joueurs de la party le verront disparaître aussitôt, ainsi que les étapes qui suivent.</p>
      </ConfirmDialog>
    </>
  )
}

interface DraftProps {
  /** Clé sessionStorage du brouillon (party + étape). */
  storageKey: string
  /** Version des résultats serveur (updatedAt) : un brouillon commencé sur une autre est oublié. */
  savedAt: number
}

function SubsetStep({
  storageKey,
  savedAt,
  label,
  size,
  pool,
  saved,
  onSave,
  onClear,
}: DraftProps & {
  label: string
  size: number
  pool: Candidate[]
  saved: string[] | null
  onSave: (ids: string[]) => Promise<void>
  onClear: () => Promise<void>
}) {
  const [storage] = useState(sessionDraftStorage)
  const [draft, setDraft] = useState<string[]>(
    () => subsetDraft(readDraft(storage, storageKey, savedAt), new Set(pool.map((c) => c.id)), size) ?? saved ?? [],
  )
  const { busy, error, run } = useSaving()
  const full = draft.length >= size
  const dirty = !saved || saved.length !== draft.length || saved.some((id) => !draft.includes(id))

  // Rien à garder tant que rien n'est coché ni enregistré.
  const keep = dirty && (draft.length > 0 || !!saved)
  useEffect(() => {
    if (keep) writeDraft(storage, storageKey, savedAt, draft)
    else clearDraft(storage, storageKey)
  }, [storage, storageKey, savedAt, draft, keep])

  function toggle(id: string) {
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : d.length < size ? [...d, id] : d))
  }

  return (
    <div className="results__panel">
      <p className="muted">
        Touche les {size} candidates du {label} au fur et à mesure de l'annonce, puis enregistre. Les joueurs ne
        voient rien tant que tu n'as pas enregistré.
      </p>
      <ul className="result-tiles" aria-label={`Candidates, ${draft.length} sur ${size} cochées`}>
        {pool.map((c) => {
          const selected = draft.includes(c.id)
          return (
            <CandidateTile
              key={c.id}
              candidate={c}
              selected={selected}
              disabled={busy || (full && !selected)}
              onToggle={() => toggle(c.id)}
            />
          )
        })}
      </ul>
      {error && (
        <p className="results__error" role="alert">
          {error}
        </p>
      )}
      <ClearButton label={label} saved={!!saved} onClear={onClear} />
      <StepFooter
        count={draft.length}
        size={size}
        ready={draft.length === size}
        dirty={dirty}
        saved={!!saved}
        busy={busy}
        saveLabel={`Enregistrer le ${label}`}
        onSave={() =>
          void run(async () => {
            await onSave(draft)
            clearDraft(storage, storageKey)
          })
        }
      />
    </div>
  )
}

function PodiumStep({
  storageKey,
  savedAt,
  pool,
  saved,
  onSave,
  onClear,
}: DraftProps & {
  pool: Candidate[]
  saved: (string | null)[]
  onSave: (podium: [string, string, string]) => Promise<void>
  onClear: () => Promise<void>
}) {
  const [storage] = useState(sessionDraftStorage)
  const [draft, setDraft] = useState<(string | null)[]>(
    () => podiumDraft(readDraft(storage, storageKey, savedAt), new Set(pool.map((c) => c.id))) ?? saved,
  )
  // On suit l'ordre de l'annonce : 2e dauphine, puis 1re dauphine, puis Miss France.
  const [slot, setSlot] = useState(() => Math.max(0, draft.lastIndexOf(null)))
  const { busy, error, run } = useSaving()
  const byId = new Map(pool.map((c) => [c.id, c]))
  const count = draft.filter(Boolean).length
  const dirty = draft.some((id, i) => id !== saved[i])
  // Garde-fou : une place peut désigner une candidate absente du top 5 (données incohérentes).
  const labelOf = (id: string | null | undefined) => {
    const c = id ? byId.get(id) : undefined
    return c ? missLabel(c) : 'à choisir'
  }

  useEffect(() => {
    if (dirty) writeDraft(storage, storageKey, savedAt, draft)
    else clearDraft(storage, storageKey)
  }, [storage, storageKey, savedAt, draft, dirty])

  function nextEmpty(d: (string | null)[], from: number) {
    for (let k = 1; k <= 3; k++) {
      const i = (from - k + 3) % 3
      if (!d[i]) return i
    }
    return from
  }

  function pick(id: string) {
    const at = draft.indexOf(id)
    if (at >= 0) {
      // Déjà placée : on la retire et on se remet sur sa place, pour corriger.
      setDraft(draft.map((x, i) => (i === at ? null : x)))
      setSlot(at)
      return
    }
    const next = draft.map((x, i) => (i === slot ? id : x))
    setDraft(next)
    setSlot(nextEmpty(next, slot))
  }

  return (
    <div className="results__panel">
      <p className="muted">
        Touche les candidates dans l'ordre de l'annonce : 2e dauphine, 1re dauphine, puis Miss France. Pour
        corriger, touche une place puis la candidate.
      </p>
      <div className="podium-slots" role="group" aria-label="Place à remplir">
        {PODIUM_SLOTS.map((s, i) => {
          const c = draft[i] ? byId.get(draft[i]!) : null
          return (
            <button
              key={s.key}
              type="button"
              className={`podium-slot podium-slot--${s.key}`}
              aria-pressed={slot === i}
              onClick={() => setSlot(i)}
              disabled={busy}
            >
              <span className="podium-slot__label">{s.label}</span>
              <span className="podium-slot__value">{c ? c.region : 'à choisir'}</span>
            </button>
          )
        })}
      </div>
      <ul className="result-tiles" aria-label={`Candidates du top 5, place à remplir : ${PODIUM_SLOTS[slot]?.label ?? ''}`}>
        {pool.map((c) => {
          const at = draft.indexOf(c.id)
          return (
            <CandidateTile
              key={c.id}
              candidate={c}
              selected={at >= 0}
              badge={at >= 0 ? String(at + 1) : undefined}
              disabled={busy}
              onToggle={() => pick(c.id)}
            />
          )
        })}
      </ul>
      <p className="visually-hidden" aria-live="polite">
        {PODIUM_SLOTS.map((s, i) => `${s.label}\u00a0: ${labelOf(draft[i])}`).join(', ')}
      </p>
      {error && (
        <p className="results__error" role="alert">
          {error}
        </p>
      )}
      <ClearButton label="podium" saved={!!saved[0]} onClear={onClear} />
      <StepFooter
        count={count}
        size={3}
        ready={count === 3}
        dirty={dirty}
        saved={!!saved[0]}
        busy={busy}
        saveLabel="Enregistrer le podium"
        onSave={() =>
          void run(async () => {
            await onSave(draft as [string, string, string])
            clearDraft(storage, storageKey)
          })
        }
      />
    </div>
  )
}
