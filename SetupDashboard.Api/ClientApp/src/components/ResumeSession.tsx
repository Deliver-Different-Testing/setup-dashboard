import { useState } from 'react'
import { Anchor, Box, Button, Group, Paper, Stack, Text } from '@mantine/core'
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
      <Box p="lg">
        <Stack gap={8} component="ul" m={0} p={0} style={{ listStyle: 'none' }}>
          {sessions.map(s => (
            <Paper key={s.id} component="li" withBorder px="md" py="sm" radius="md">
              <Group justify="space-between" gap="sm" wrap="nowrap">
                <div>
                  <Text size="sm" fw={600}>{s.companyName || 'Unnamed setup'}</Text>
                  <Text fz={11} c="dimmed">
                    {s.stepsDone} of 11 steps done{s.waitingOnTenant ? ` · waiting on tenant for ${s.waitingOnTenant}` : ''} · updated {new Date(s.updatedAt).toLocaleDateString()}
                    {s.createdByName ? ` · started by ${s.createdByName}` : ''}
                  </Text>
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
              </Group>
            </Paper>
          ))}
        </Stack>
        <Anchor component="button" type="button" size="xs" c="dimmed" mt="md" underline="always" disabled={!!busy}
          onClick={async () => { setBusy('new'); try { await startNew() } finally { setBusy(null) } }}>
          Start a separate setup instead
        </Anchor>
      </Box>
    </DialogShell>
  )
}
