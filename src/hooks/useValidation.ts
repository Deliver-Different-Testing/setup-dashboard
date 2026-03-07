import { useState, useRef, useCallback } from 'react'
import * as api from '../lib/api'

export type ValidationStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error'

export function useValidation(
  validateFn: (value: string) => Promise<{ available: boolean; unchecked?: boolean }>,
  debounceMs = 300
) {
  const [status, setStatus] = useState<ValidationStatus>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastValueRef = useRef('')

  const validate = useCallback((value: string) => {
    lastValueRef.current = value
    if (timerRef.current) clearTimeout(timerRef.current)
    
    if (!value || value.length < 2) {
      setStatus('idle')
      return
    }

    setStatus('checking')
    timerRef.current = setTimeout(async () => {
      try {
        const result = await validateFn(value)
        // Only update if this is still the latest value
        if (lastValueRef.current === value) {
          if (result.unchecked) {
            setStatus('idle') // API unavailable, don't block
          } else {
            setStatus(result.available ? 'available' : 'taken')
          }
        }
      } catch {
        if (lastValueRef.current === value) setStatus('error')
      }
    }, debounceMs)
  }, [validateFn, debounceMs])

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setStatus('idle')
  }, [])

  return { status, validate, reset }
}

export function useUsernameValidation() {
  return useValidation(async (val) => {
    const res = await api.validateUsername(val)
    return res
  })
}

export function useClientCodeValidation() {
  return useValidation(async (val) => {
    const res = await api.validateClientCode(val)
    return res
  })
}

export function useCourierCodeValidation() {
  return useValidation(async (val) => {
    const res = await api.validateCourierCode(val)
    return res
  })
}
