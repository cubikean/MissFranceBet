import { useEffect, useState } from 'react'

/** Heure courante, rafraîchie toutes les `intervalMs` ms (pour les comptes à rebours). */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs])
  return now
}
