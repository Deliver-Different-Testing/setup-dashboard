import { useEffect, useState } from 'react'
import * as api from './api'
import type { LookupItem } from './api'

/** A lookup from Settings / Routed Ops, fetched once per name for the page's life. */
const cache = new Map<string, Promise<unknown>>()
function load<T>(name: string): Promise<T> {
  if (!cache.has(name)) cache.set(name, api.lookup<T>(name).catch(e => { cache.delete(name); throw e }))
  return cache.get(name) as Promise<T>
}

export function useLookup<T = LookupItem[]>(name: string | null) {
  const [state, setState] = useState<{ name: string | null; data: T | null; error: string | null }>({ name: null, data: null, error: null })
  useEffect(() => {
    if (!name) return
    let live = true
    load<T>(name)
      .then(d => { if (live) setState({ name, data: d, error: null }) })
      .catch((e: unknown) => { if (live) setState({ name, data: null, error: errorMessage(e, 'Could not load') }) })
    return () => { live = false }
  }, [name])
  const current = state.name === name
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !!name && !current }
}

export const asOptions = (items: LookupItem[] | null | undefined) => (items ?? []).map(i => ({ value: i.id, label: i.name }))

/** Immutable list helpers for row editors. */
export function patchAt<T>(list: T[], i: number, patch: Partial<T>): T[] {
  return list.map((x, j) => (j === i ? { ...x, ...patch } : x))
}
export function removeAt<T>(list: T[], i: number): T[] {
  return list.filter((_, j) => j !== i)
}
export const csv = (v: string | undefined) => (v ?? '').split(',').map(x => x.trim()).filter(Boolean)

export function errorMessage(e: unknown, fallback = 'Something went wrong') {
  return e instanceof Error && e.message ? e.message : fallback
}
