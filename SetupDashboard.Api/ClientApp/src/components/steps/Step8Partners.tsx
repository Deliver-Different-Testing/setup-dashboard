const HUB_URL = 'https://hub.deliverdifferent.com'

const PARTNER_CARDS = [
  { icon: '🤝', title: 'Agents & Partners Network', desc: 'Join the 821+ carrier network for overflow capacity', path: '/Partners' },
  { icon: '🔄', title: 'Overflow Settings', desc: 'Configure automatic overflow rules', path: '/Partners/Overflow' },
  { icon: '💰', title: 'Rate Sharing', desc: 'Set up inter-carrier rate agreements', path: '/Partners/Rates' },
  { icon: '📂', title: 'Network Directory', desc: 'Browse available partners in your region', path: '/Partners/Directory' },
]

import { useState } from 'react'
import { SmartImport } from '../SmartImport'

export function Step8Partners() {
  const [showSmartImport, setShowSmartImport] = useState(false)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-navy">🤝 Agents & Partners</h2>

      <button onClick={() => setShowSmartImport(true)} className="w-full px-5 py-3 rounded-2xl text-white text-sm font-semibold transition hover:opacity-90" style={{ background: 'linear-gradient(135deg, #0d0c2c 0%, #3bc7f4 100%)' }}>
        📄 Smart Import Partners from Competitor TMS
      </button>
      {showSmartImport && (
        <SmartImport entityType="agents" onComplete={() => setShowSmartImport(false)} onClose={() => setShowSmartImport(false)} />
      )}

      <div className="flex items-start gap-3 rounded-2xl p-4" style={{ backgroundColor: 'rgba(59,199,244,0.08)' }}>
        <div className="text-xl shrink-0">ℹ️</div>
        <div className="text-sm text-navy">
          These settings are managed in your Deliver Different Hub. Click to configure.
        </div>
      </div>

      <div className="space-y-3">
        {PARTNER_CARDS.map(item => (
          <div key={item.title} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: '#f4f2f1' }}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-navy">{item.title}</div>
              <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>
            </div>
            <a
              href={`${HUB_URL}${item.path}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 px-4 py-2 rounded-full text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: '#3bc7f4' }}
            >
              Open in Hub →
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
