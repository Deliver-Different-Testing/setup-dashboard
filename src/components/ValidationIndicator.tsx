import type { ValidationStatus } from '../hooks/useValidation'

export function ValidationIndicator({ status }: { status: ValidationStatus }) {
  if (status === 'idle') return null
  
  return (
    <span className="inline-flex items-center gap-1 text-xs ml-2">
      {status === 'checking' && (
        <span className="text-gray-400 animate-pulse">⟳ Checking...</span>
      )}
      {status === 'available' && (
        <span className="text-green-600">✅ Available</span>
      )}
      {status === 'taken' && (
        <span className="text-red-500">❌ Already exists</span>
      )}
      {status === 'error' && (
        <span className="text-amber-500">⚠️ Could not verify</span>
      )}
    </span>
  )
}
