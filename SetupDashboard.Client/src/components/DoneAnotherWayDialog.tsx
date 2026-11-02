import { useState, type FormEvent } from 'react'
import { Alert, Modal, Select, Stack, Text, Textarea } from '@mantine/core'
import { CircleCheck } from 'lucide-react'
import { DialogShell } from './dialog/DialogShell'
import { DialogHeader } from './dialog/DialogHeader'
import { DialogFooter } from './dialog/DialogFooter'
import { DIALOG_SIZES } from './dialog/dialogStyles'
import type { Elsewhere } from '../lib/api'
import { METHODS, NOTE_MAX, noteProblem } from '../lib/doneAnotherWay'
import { errorMessage } from '../lib/helpers'

interface Props {
  stepTitle: string
  /** Unsaved edits on the step are thrown away; the dialog says so. */
  dirty?: boolean
  initial?: Partial<Elsewhere>
  onSubmit: (e: Elsewhere) => Promise<void>
  onClose: () => void
}

export function DoneAnotherWayDialog({ stepTitle, dirty, initial, onSubmit, onClose }: Props) {
  const [method, setMethod] = useState<string>(initial?.method ?? METHODS[0])
  const [note, setNote] = useState(initial?.note ?? '')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const problem = noteProblem(note)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (problem) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ method, note: note.trim() })
      onClose()
    } catch (err: unknown) {
      setError(errorMessage(err, 'Could not mark this step done. Try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogShell opened onClose={onClose} size={DIALOG_SIZES.md} onSubmit={submit} label="Mark as done another way">
      <DialogHeader icon={<CircleCheck size={20} strokeWidth={1.25} />}
        title={<Modal.Title>Mark <em>{stepTitle}</em> as done another way</Modal.Title>} onClose={onClose} closeDisabled={saving} />
      <Stack gap="sm" p="lg">
        <Text size="sm" c="dimmed">
          For work done outside this dashboard. Records not sent yet are marked Skipped and never sent; open requests to the tenant are closed with your note.
        </Text>
        {dirty && <Alert variant="light" color="yellow" py="xs" fz="xs">Your unsaved changes on this step will be discarded.</Alert>}
        <Select label="How was it done?" data={[...METHODS]} value={method} onChange={v => v && setMethod(v)} allowDeselect={false} required />
        <Textarea label="Note" required autosize minRows={3} maxLength={NOTE_MAX} value={note} data-autofocus
          onChange={e => setNote(e.currentTarget.value)} onBlur={() => setTouched(true)}
          placeholder="e.g. 15 rate rows loaded on prod 31 Oct (RK1)"
          error={touched ? problem : null} />
        {error && <Alert variant="light" color="red" py="xs" fz="xs">{error}</Alert>}
      </Stack>
      <DialogFooter onCancel={onClose} cancelDisabled={saving} submitLabel="Mark as done" submitType="submit" isSubmitting={saving} />
    </DialogShell>
  )
}
