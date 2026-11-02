import { useState } from 'react'
import { Alert, Button, Checkbox, Group, Stack, Text, Textarea, Title } from '@mantine/core'
import { STEPS, useStore } from '../store'
import type { StepKey } from '../lib/api'
import { stripText } from '../lib/alreadyInDfrnt'
import { canMarkElsewhere, NOTE_MAX, noteProblem } from '../lib/doneAnotherWay'
import { Card, StepPill } from './ui'

/**
 * Opens instead of the Business step when a new setup starts on a tenant that already has data:
 * one note, many steps, so a part-done tenant is brought up to date in a minute.
 */
export function TenantUpToPanel() {
  const session = useStore(s => s.session)
  const summary = useStore(s => s.tenantSummary)
  const me = useStore(s => s.me)
  const { closeUpTo, markAlreadyInDfrnt } = useStore()
  const [ticked, setTicked] = useState<StepKey[]>([])
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState<{ step: StepKey; message: string }[]>([])
  if (!session || !summary) return null

  const canMark = canMarkElsewhere(me)
  const lines = STEPS.map(s => ({ ...s, text: stripText(s.key, summary), status: session.steps[s.key].status }))
    .filter(s => s.text)
  const open = lines.filter(s => s.status !== 'done')
  const problem = noteProblem(note)
  const toggle = (k: StepKey, on: boolean) => setTicked(t => on ? [...t, k] : t.filter(x => x !== k))

  const mark = async () => {
    setTouched(true)
    if (problem || ticked.length === 0) return
    setSaving(true)
    try {
      const bad = await markAlreadyInDfrnt(ticked, note.trim())
      setFailed(bad)
      setTicked(bad.map(b => b.step))
      if (bad.length === 0) closeUpTo()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack maw={1024} mx="auto" gap="md">
      <div>
        <Title order={2} fz={24} fw={700}>Where this tenant is up to</Title>
        <Text size="sm" c="dimmed" mt={4} maw={768}>
          {summary.counts.tenantClientFile || lines.length > 0
            ? 'This tenant already has data in DFRNT, so some steps may have been done outside this dashboard.'
            : 'This tenant already has some set-up in DFRNT.'}
          {canMark ? ' Tick the steps that are finished, add one note, and mark them done another way.' : ' DFRNT or a tenant admin can mark finished steps as done another way.'}
        </Text>
      </div>

      <Card title="Already in DFRNT">
        <Stack gap="xs">
          {lines.length === 0 && <Text size="xs" c="dimmed">Nothing step by step yet.</Text>}
          {lines.map(s => (
            <Group key={s.key} gap="sm" wrap="nowrap" align="flex-start">
              {canMark && (
                <Checkbox size="xs" mt={3} aria-label={`Mark ${s.title} done another way`} disabled={s.status === 'done' || saving}
                  checked={ticked.includes(s.key)} onChange={e => toggle(s.key, e.currentTarget.checked)} />
              )}
              <div style={{ flex: 1 }}>
                <Group gap="xs">
                  <Text size="sm" fw={600}>{s.title}</Text>
                  <StepPill status={s.status} />
                </Group>
                <Text size="xs" c="dimmed">{s.text}</Text>
                {failed.find(f => f.step === s.key) && (
                  <Text size="xs" c="var(--mantine-color-red-text)">{failed.find(f => f.step === s.key)!.message}</Text>
                )}
              </div>
            </Group>
          ))}
        </Stack>
      </Card>

      {canMark && open.length > 0 && (
        <Card title="How was it done?">
          <Textarea autosize minRows={2} maxLength={NOTE_MAX} value={note} onChange={e => setNote(e.currentTarget.value)}
            onBlur={() => setTouched(true)} aria-label="Note for every ticked step"
            placeholder="e.g. Set up directly in Settings and Admin Manager, 29 to 31 Oct"
            error={touched ? problem : null} />
          <Text size="xs" c="dimmed" mt={6}>The note is saved on every ticked step, with the method "Already in DFRNT".</Text>
        </Card>
      )}

      {failed.length > 0 && (
        <Alert variant="light" color="red" py="xs" fz="xs">
          {failed.length === 1 ? 'One step was' : `${failed.length} steps were`} not marked. They are still ticked; try again, or continue.
        </Alert>
      )}

      <Group gap="xs">
        {canMark && open.length > 0 && (
          <Button onClick={mark} loading={saving} disabled={ticked.length === 0}>
            Mark the ticked steps done another way
          </Button>
        )}
        <Button variant="default" onClick={closeUpTo} disabled={saving}>Continue to the steps</Button>
      </Group>
    </Stack>
  )
}
