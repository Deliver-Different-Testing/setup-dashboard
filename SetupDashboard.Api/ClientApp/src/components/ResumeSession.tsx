import { useState } from 'react'
import { Anchor, Button, Group } from '@mantine/core'
import { History } from 'lucide-react'
import { useStore } from '../store'
import { DialogShell } from './dialog/DialogShell'
import { DialogHeader } from './dialog/DialogHeader'
import { DIALOG_SIZES } from './dialog/dialogStyles'

/** Shown when this tenant has setups in progress and the browser doesn't remember one. */
export function ResumeSession() {
  const { showResumePrompt, sessions, resume, startNew, me, removeSession } = useStore()
  const [busy, setBusy] = useState<string | null>(null)
  if (!showResumePrompt) return null

  // A choice has to be made (carry on, or start a separate setup), so there is no close.
  return (
    <DialogShell opened onClose={() => {}} closeOnClickOutside={false} closeOnEscape={false} size={DIALOG_SIZES.md} label="Carry on with a setup?">
      <DialogHeader icon={<History size={20} strokeWidth={1.25} />} title="Carry on with a setup?" subtitle="This tenant already has setup in progress." />
      <div className="p-6">
        <ul className="space-y-2">
          {sessions.map(s => (
            <li key={s.id} className="flex items-center justify-between gap-3 bg-surface border border-line rounded-xl px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-ink">{s.companyName || 'Unnamed setup'}</div>
                <div className="text-[11px] text-dimmed">
                  {s.stepsDone} of 11 steps done{s.waitingOnTenant ? ` · waiting on tenant for ${s.waitingOnTenant}` : ''} · updated {new Date(s.updatedAt).toLocaleDateString()}
                  {s.createdByName ? ` · started by ${s.createdByName}` : ''}
                </div>
              </div>
              <Group gap="xs" wrap="nowrap">
                {me?.isDfAdmin && (
                  <Button variant="subtle" color="red" size="xs" disabled={!!busy}
                    title="Forget this setup. Nothing already created in Settings is removed."
                    onClick={async () => { if (confirm('Forget this setup? Nothing already created in Settings or Routed Ops is removed.')) { setBusy(s.id); try { await removeSession(s.id) } finally { setBusy(null) } } }}>
                    Forget
                  </Button>
                )}
                <Button size="xs" miw={100} disabled={!!busy && busy !== s.id} loading={busy === s.id}
                  onClick={async () => { setBusy(s.id); try { await resume(s.id) } finally { setBusy(null) } }}>
                  Continue
                </Button>
              </Group>
            </li>
          ))}
        </ul>
        <Anchor component="button" type="button" size="xs" c="dimmed" mt="md" underline="always" disabled={!!busy}
          onClick={async () => { setBusy('new'); try { await startNew() } finally { setBusy(null) } }}>
          Start a separate setup instead
        </Anchor>
      </div>
    </DialogShell>
  )
}
