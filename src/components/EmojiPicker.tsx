import { useId } from 'react'
import './EmojiPicker.css'

/** Avatars proposés : un contenu choisi par le joueur, pas des icônes d'interface. */
export const AVATAR_EMOJIS = [
  '😎', '🦄', '👑', '💃', '🕺', '🌸', '🦋', '🐱', '🐶', '🦊',
  '🐼', '🐸', '🐙', '🦁', '🐯', '🐨', '🍓', '🍒', '🍑', '🌈',
  '⭐', '🔥', '💎', '🎤', '🎬', '📺', '🍿', '🥂', '🍾', '🎉',
  '💄', '👠', '🌹', '🌻', '🧁', '🍕', '🤠', '👽', '🤖', '🥸',
]

/** Grille d'emojis à choix unique (boutons radio natifs : flèches du clavier, lecteurs d'écran). */
export function EmojiPicker({
  value,
  onChange,
  legend = 'Ton emoji',
  disabled = false,
}: {
  value: string
  onChange: (emoji: string) => void
  legend?: string
  disabled?: boolean
}) {
  const name = useId()
  return (
    <fieldset className="emoji-picker" disabled={disabled}>
      <legend className="field__label">{legend}</legend>
      <div className="emoji-picker__grid">
        {AVATAR_EMOJIS.map((emoji) => (
          <label key={emoji} className="emoji-picker__option">
            <input
              type="radio"
              name={name}
              value={emoji}
              checked={value === emoji}
              onChange={() => onChange(emoji)}
              className="emoji-picker__input"
            />
            <span className="emoji-picker__emoji" aria-hidden="true">
              {emoji}
            </span>
            <span className="visually-hidden">{emoji}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
