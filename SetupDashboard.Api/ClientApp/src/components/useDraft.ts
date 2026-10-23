import { useState } from 'react'
import { useStore } from '../store'
import type { Session } from '../lib/api'

/**
 * A step's editable copy of its saved data. Re-syncs from the server after a save,
 * a send (which can clear courier passwords) or an import - but never while you
 * have unsaved edits. Syncing happens during render (React's "adjust state when a
 * prop changes" pattern) rather than in an effect.
 */
export function useDraft<T>(select: (s: Session) => T) {
  const session = useStore(s => s.session)
  const savedJson = JSON.stringify((session ? select(session) : null) ?? null)
  const [base, setBase] = useState(savedJson)
  const [draft, setDraftState] = useState<T>(() => JSON.parse(savedJson) as T)
  const [dirty, setDirty] = useState(false)

  if (savedJson !== base && !dirty) {
    setBase(savedJson)
    setDraftState(JSON.parse(savedJson) as T)
  }

  const setDraft = (next: T | ((d: T) => T)) => {
    setDraftState(prev => (typeof next === 'function' ? (next as (d: T) => T)(prev) : next))
    setDirty(true)
  }
  const markSaved = () => setDirty(false)

  return { draft, setDraft, dirty, markSaved }
}
