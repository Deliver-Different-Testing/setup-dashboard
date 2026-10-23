import { useState } from 'react'
import { useStore } from '../store'

/** Shown when this tenant has setups in progress and the browser doesn't remember one. */
export function ResumeSession() {
  const { showResumePrompt, sessions, resume, startNew, me, removeSession } = useStore()
  const [busy, setBusy] = useState<string | null>(null)
  if (!showResumePrompt) return null

  return (
    <div className="fixed inset-0 z-[200] bg-navy/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
        <h2 className="text-lg font-bold text-navy">Carry on with a setup?</h2>
        <p className="text-sm text-gray-500 mt-1">This tenant already has setup in progress.</p>
        <ul className="mt-4 space-y-2">
          {sessions.map(s => (
            <li key={s.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-navy">{s.companyName || 'Unnamed setup'}</div>
                <div className="text-[11px] text-gray-400">
                  {s.stepsDone} of 11 steps done{s.waitingOnTenant ? ` · waiting on tenant for ${s.waitingOnTenant}` : ''} · updated {new Date(s.updatedAt).toLocaleDateString()}
                  {s.createdByName ? ` · started by ${s.createdByName}` : ''}
                </div>
              </div>
              <div className="flex gap-2">
                {me?.isDfAdmin && (
                  <button className="text-xs text-gray-400 hover:text-red-500" disabled={!!busy}
                    title="Forget this setup. Nothing already created in Settings is removed."
                    onClick={async () => { if (confirm('Forget this setup? Nothing already created in Settings or Routed Ops is removed.')) { setBusy(s.id); try { await removeSession(s.id) } finally { setBusy(null) } } }}>
                    Forget
                  </button>
                )}
                <button className="px-4 py-1.5 rounded-full bg-cyan text-white text-xs font-semibold disabled:opacity-50" disabled={!!busy}
                  onClick={async () => { setBusy(s.id); try { await resume(s.id) } finally { setBusy(null) } }}>
                  {busy === s.id ? 'Opening…' : 'Continue'}
                </button>
              </div>
            </li>
          ))}
        </ul>
        <button className="mt-4 text-xs text-gray-500 hover:text-navy underline" disabled={!!busy}
          onClick={async () => { setBusy('new'); try { await startNew() } finally { setBusy(null) } }}>
          Start a separate setup instead
        </button>
      </div>
    </div>
  )
}
