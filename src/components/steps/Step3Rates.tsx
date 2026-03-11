import { useState } from 'react'
import { useStore } from '../../store'
import { SmartImport } from '../SmartImport'

const RATE_META: [string, string][] = [
  ['Base Rate', 'per delivery'],
  ['Per KM Rate', '/km after 5km'],
  ['Minimum Charge', 'floor price'],
  ['Fuel Surcharge', 'auto-updated'],
  ['Wait Time', '/minute after 5min'],
  ['After Hours', 'surcharge'],
]

const ZONE_HEADERS = ['Zone', '0–5 km', '5–15 km', '15–30 km', '30+ km']
const WEIGHT_LABELS = ['0–5 kg', '5–15 kg', '15–30 kg', '30–50 kg', '50+ kg']

export function Step3Rates() {
  const { rates, setRate, zonePricing, setZonePrice, weightBreaks, setWeightBreak } = useStore()
  const [showSmartImport, setShowSmartImport] = useState(false)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-navy">💰 Your Rates</h2>
      <p className="text-gray-500 text-sm">Build your rate card. Auto-Mate has pre-populated based on your verticals — adjust as needed.</p>
      <button onClick={() => setShowSmartImport(true)} className="px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: '#3bc7f4' }}>
        📄 Import Rates from CSV/Excel
      </button>
      {showSmartImport && (
        <SmartImport entityType="rates" onComplete={() => setShowSmartImport(false)} onClose={() => setShowSmartImport(false)} />
      )}
      <div className="grid grid-cols-3 gap-4">
        {RATE_META.map(([name, desc]) => (
          <div key={name} className="bg-white rounded-2xl p-5 shadow-sm card-hover border border-gray-100">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{name}</div>
            <input value={rates[name]} onChange={(e) => setRate(name, e.target.value)} className="text-2xl font-bold text-navy w-full focus:outline-none focus:text-cyan transition" />
            <div className="text-xs text-gray-400 mt-1">{desc}</div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-sm font-bold text-navy mb-4">Zone-Based Pricing Grid</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 font-semibold uppercase">
                {ZONE_HEADERS.map(h => <th key={h} className="py-2 text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {zonePricing.map((row, ri) => (
                <tr key={ri} className="border-t border-gray-50">
                  <td className="py-3 font-medium text-navy">{row[0]}</td>
                  {row.slice(1).map((v, ci) => (
                    <td key={ci} className="py-3 text-center">
                      <input value={v} onChange={(e) => setZonePrice(ri, ci + 1, e.target.value)} className="w-20 text-center font-semibold text-navy bg-lgrey rounded-lg px-2 py-1.5 focus:outline-none focus:bg-cyan/10" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-sm font-bold text-navy mb-4">Weight Breaks</h3>
        <div className="flex gap-3 flex-wrap">
          {WEIGHT_LABELS.map((label, i) => (
            <div key={i} className="bg-lgrey rounded-xl px-4 py-3 text-center">
              <div className="text-xs text-gray-400 mb-1">{label}</div>
              <input value={weightBreaks[i]} onChange={(e) => setWeightBreak(i, e.target.value)} className="text-sm font-bold text-navy w-16 text-center bg-transparent focus:outline-none" />
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-bold text-navy mb-3">Connect Accounting</h3>
        <div className="flex gap-3">
          {[
            { name: 'Xero', color: '#13B5EA', label: 'X' },
            { name: 'QuickBooks', color: '#2CA01C', label: 'QB' },
            { name: 'MYOB', color: '#6B42D4', label: '$' },
          ].map(a => (
            <button key={a.name} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-gray-200 hover:border-cyan transition card-hover shadow-sm">
              <svg width="24" height="24" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="12" fill={a.color} />
                <text x="12" y="16" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">{a.label}</text>
              </svg>
              <span className="text-sm font-semibold text-navy">{a.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
