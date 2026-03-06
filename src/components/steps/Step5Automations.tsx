import { useStore } from '../../store'
import { Toggle } from '../Toggle'

const AUTOMATION_META: { key: string; icon: string; desc: string }[] = [
  { key: 'SMS on Pickup', icon: '📱', desc: 'Notify clients when their package is picked up' },
  { key: 'SMS on Delivery', icon: '✅', desc: 'Send delivery confirmation via text message' },
  { key: 'Email Proof of Delivery', icon: '📧', desc: 'Auto-send POD with photo and signature to client' },
  { key: 'Late Delivery Alert', icon: '⏰', desc: 'Alert dispatchers when deliveries are running behind' },
  { key: 'Daily Summary Email', icon: '📊', desc: 'Send end-of-day delivery report to each client' },
  { key: 'Auto-Reassign', icon: '🔄', desc: "Automatically reassign if driver doesn't accept in 5 min" },
  { key: 'Live Tracking Link', icon: '📍', desc: 'Share real-time tracking link with recipients' },
  { key: 'Delivery Rating', icon: '⭐', desc: 'Ask recipients to rate their delivery experience' },
]

export function Step5Automations() {
  const { automations, toggleAutomation } = useStore()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-navy">⚡ Your Automations</h2>
      <p className="text-gray-500 text-sm">Save hours every day. Toggle the automations you want — you can change these anytime.</p>
      <div className="grid grid-cols-2 gap-4">
        {AUTOMATION_META.map(a => (
          <div key={a.key} className="bg-white rounded-2xl p-5 shadow-sm card-hover border border-gray-100 flex items-start gap-4">
            <div className="text-2xl mt-0.5">{a.icon}</div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-navy">{a.key}</div>
              <div className="text-xs text-gray-400 mt-1">{a.desc}</div>
            </div>
            <Toggle on={automations[a.key]} onToggle={() => toggleAutomation(a.key)} />
          </div>
        ))}
      </div>
    </div>
  )
}
