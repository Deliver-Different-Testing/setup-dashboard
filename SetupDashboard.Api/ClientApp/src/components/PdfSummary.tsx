import { useState } from 'react'
import { useStore } from '../store'
import { jsPDF } from 'jspdf'

const STEP_NAMES = [
  '🏢 Business Profile',
  '👥 Team',
  '📋 Clients',
  '💰 Rates',
  '🚗 Couriers',
  '⚡ Automations',
  '🔗 Integrations',
  '📱 App Config',
  '🤝 Partners',
  '🏋️ Training',
]

export function PdfSummary() {
  const [generating, setGenerating] = useState(false)
  const store = useStore()

  const generate = async () => {
    setGenerating(true)
    try {
      const doc = new jsPDF()
      const navy = [13, 12, 44] as [number, number, number]
      const cyan = [59, 199, 244] as [number, number, number]
      const gray = [128, 128, 128] as [number, number, number]
      let y = 20

      const addLine = (text: string, opts?: { size?: number; color?: [number, number, number]; bold?: boolean }) => {
        const size = opts?.size || 10
        const color = opts?.color || [0, 0, 0] as [number, number, number]
        doc.setFontSize(size)
        doc.setTextColor(...color)
        doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
        doc.text(text, 20, y)
        y += size * 0.5 + 2
        if (y > 270) { doc.addPage(); y = 20 }
      }

      const addSection = (title: string) => {
        y += 4
        doc.setDrawColor(...cyan)
        doc.setLineWidth(0.5)
        doc.line(20, y, 190, y)
        y += 6
        addLine(title, { size: 14, color: navy, bold: true })
        y += 2
      }

      // Header
      doc.setFillColor(...navy)
      doc.rect(0, 0, 210, 35, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('DFRNT Setup Summary', 20, 22)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), 20, 30)
      y = 45

      // Completion Status
      addLine('Setup Progress', { size: 16, color: navy, bold: true })
      y += 2
      for (let i = 0; i < 10; i++) {
        const completed = store.completedSteps.has(i)
        const status = completed ? '✓' : '○'
        addLine(`${status}  Step ${i}: ${STEP_NAMES[i]}`, { size: 10, color: completed ? [0, 128, 0] : gray })
      }
      const pct = store.getCompletionPercentage()
      y += 2
      addLine(`Overall completion: ${pct}%`, { size: 11, color: cyan, bold: true })

      // Step 0: Business
      addSection('Business Profile')
      addLine(`Company: ${store.companyName || '(not set)'}`)
      addLine(`Geography: ${store.selectedCities.join(', ') || '(not set)'}`)
      addLine(`Verticals: ${store.selectedVerticals.join(', ') || '(not set)'}`)
      addLine(`Current System: ${store.currentSystem}`)
      addLine(`Delivery Volume: ${store.deliveryVolume}`)

      // Step 1: Team
      addSection('Team Members')
      addLine(`Total members: ${store.teamMembers.length}`)
      for (const m of store.teamMembers) {
        addLine(`  • ${m.name} — ${m.email} (${m.role})`)
      }

      // Step 2: Clients
      addSection('Clients')
      addLine(`Total clients: ${store.clients.length}`)
      for (const c of store.clients.slice(0, 20)) {
        addLine(`  • ${c.name} — ${c.contact} (${c.billing})`)
      }
      if (store.clients.length > 20) addLine(`  ... and ${store.clients.length - 20} more`, { color: gray })

      // Step 3: Rates
      addSection('Rate Configuration')
      for (const [key, val] of Object.entries(store.rates)) {
        addLine(`  ${key}: ${val}`)
      }
      addLine(`Zones: ${store.zonePricing.length}`)
      for (const zone of store.zonePricing) {
        addLine(`  • ${zone[0]}: ${zone.slice(1).join(' | ')}`)
      }

      // Step 4: Couriers
      addSection('Couriers')
      addLine(`Total couriers: ${store.couriers.length}`)
      for (const c of store.couriers) {
        addLine(`  • ${c.name} — ${c.vehicle} (${c.zone})`)
      }

      // Step 5: Automations
      addSection('Automation Rules')
      const enabledRules = Object.entries(store.automations).filter(([, v]) => v)
      const disabledRules = Object.entries(store.automations).filter(([, v]) => !v)
      addLine(`Enabled (${enabledRules.length}):`)
      for (const [key] of enabledRules) addLine(`  ✓ ${key}`)
      if (disabledRules.length > 0) {
        addLine(`Disabled (${disabledRules.length}):`)
        for (const [key] of disabledRules) addLine(`  ○ ${key}`)
      }

      // Training
      if (Object.keys(store.trainingProgress).length > 0) {
        addSection('Training Progress')
        const sorted = Object.entries(store.trainingProgress).sort(([, a], [, b]) => b.xp - a.xp)
        for (const [email, data] of sorted) {
          const member = store.teamMembers.find(m => m.email === email)
          addLine(`  • ${member?.name || email}: ${data.xp} XP, ${data.completedChallenges.length} challenges`)
        }
      }

      // Footer
      y = 280
      doc.setDrawColor(...cyan)
      doc.line(20, y, 190, y)
      y += 5
      doc.setFontSize(8)
      doc.setTextColor(...gray)
      doc.text('Generated by DFRNT Setup Dashboard — deliverdifferent.com', 20, y)
      if (store.sessionId) {
        doc.text(`Session: ${store.sessionId}`, 20, y + 4)
      }

      doc.save(`DFRNT-Setup-Summary-${new Date().toISOString().slice(0, 10)}.pdf`)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <button
      onClick={generate}
      disabled={generating}
      className="px-5 py-2.5 rounded-full text-sm font-semibold transition disabled:opacity-60"
      style={{ background: 'linear-gradient(135deg, #0d0c2c 0%, #3bc7f4 100%)', color: 'white' }}
    >
      {generating ? '⟳ Generating...' : '📄 Download PDF Summary'}
    </button>
  )
}
