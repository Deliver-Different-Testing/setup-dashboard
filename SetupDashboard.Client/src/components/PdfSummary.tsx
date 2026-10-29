import { useState } from 'react'
import { jsPDF } from 'jspdf'
import { Button, useMantineTheme } from '@mantine/core'
import { Download } from 'lucide-react'
import { STEPS, useStore } from '../store'

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started', waiting_on_tenant: 'Waiting on tenant', in_progress: 'In progress', done: 'Done',
}

/** A one-page progress report: where each step is, what's created, and what we're waiting for. */
export function PdfSummary() {
  const session = useStore(s => s.session)
  const [busy, setBusy] = useState(false)
  const { scrim } = useMantineTheme().other // sits on the app bar
  if (!session) return null

  const generate = () => {
    setBusy(true)
    try {
      const doc = new jsPDF()
      let y = 20
      const line = (text: string, size = 10, bold = false, color: [number, number, number] = [0, 0, 0]) => {
        if (y > 280) { doc.addPage(); y = 20 }
        doc.setFontSize(size)
        doc.setFont('helvetica', bold ? 'bold' : 'normal')
        doc.setTextColor(...color)
        for (const l of doc.splitTextToSize(text, 175)) { doc.text(l, 18, y); y += size * 0.5 + 1.5 }
      }

      line(`${session.business.companyName || 'New tenant'} - DFRNT setup progress`, 16, true, [13, 12, 44])
      line(`Created ${new Date().toLocaleString()}${session.createdByName ? ` · started by ${session.createdByName}` : ''}`, 9, false, [128, 128, 128])
      y += 4

      for (const s of STEPS) {
        const st = session.steps[s.key]
        const created = st.rows.filter(r => r.status === 'created').length
        const needs = st.rows.filter(r => r.status === 'needs_data').length
        const failed = st.rows.filter(r => r.status === 'failed').length
        line(`${s.title} - ${STATUS_LABEL[st.status] ?? st.status}`, 11, true, [13, 12, 44])
        if (st.rows.length) line(`${created} created${needs ? `, ${needs} missing details` : ''}${failed ? `, ${failed} failed to send` : ''}`, 9)
        for (const r of st.requests.filter(r => !r.fulfilledAt))
          line(`Waiting on tenant: ${r.item} (requested ${new Date(r.requestedAt).toLocaleDateString()})`, 9, false, [180, 110, 0])
        for (const c of st.checklist.filter(c => c.required && !c.doneAt))
          line(`To do (${c.owner}): ${c.item}`, 9, false, [100, 100, 100])
        y += 2
      }
      doc.save(`${(session.business.companyName || 'tenant').replace(/[^a-z0-9]+/gi, '-')}-setup-progress.pdf`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button onClick={generate} loading={busy} variant="outline" color="gray" c={scrim.text} size="xs"
      leftSection={<Download size={14} strokeWidth={1.5} />} styles={{ root: { borderColor: scrim.border } }}>
      Download progress PDF
    </Button>
  )
}
