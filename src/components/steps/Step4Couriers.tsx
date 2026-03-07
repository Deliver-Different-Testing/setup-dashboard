import { useStore } from '../../store'
import { useMemo, useState } from 'react'
import { SmartImport } from '../SmartImport'

export function Step4Couriers() {
  const { couriers } = useStore()
  const [showSmartImport, setShowSmartImport] = useState(false)

  const qrCells = useMemo(() => {
    const cells: boolean[] = []
    for (let r = 0; r < 21; r++) {
      for (let c = 0; c < 21; c++) {
        const isFinder = (r < 7 && c < 7) || (r < 7 && c > 13) || (r > 13 && c < 7)
        const dark = isFinder
          ? (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))
          : (r * 7 + c * 13) % 3 === 0
        cells.push(dark)
      }
    }
    return cells
  }, [])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-navy">🚗 Your Couriers</h2>
      <p className="text-gray-500 text-sm">Add your drivers or share the QR code for instant self-registration.</p>

      {/* Smart Import Button */}
      <button
        onClick={() => setShowSmartImport(true)}
        className="w-full px-5 py-3 rounded-2xl text-white text-sm font-semibold transition hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #0d0c2c 0%, #3bc7f4 100%)' }}
      >
        🔄 Smart Import Drivers from Competitor TMS
      </button>

      {showSmartImport && (
        <SmartImport
          entityType="drivers"
          onComplete={(data) => {
            const store = useStore.getState()
            const mapped = data.map(d => ({
              name: d.name || d.firstName ? `${d.firstName || ''} ${d.surName || ''}`.trim() : '',
              phone: d.personalMobile || '',
              vehicle: d.courierType || 'Car',
              zone: '',
            }))
            store.setCouriers([...couriers, ...mapped])
            setShowSmartImport(false)
          }}
          onClose={() => setShowSmartImport(false)}
        />
      )}
      <div className="grid grid-cols-5 gap-4">
        {couriers.map((d, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm card-hover border border-gray-100 text-center">
            <div className="w-12 h-12 rounded-full bg-cyan/15 flex items-center justify-center text-xl mx-auto mb-2">{d.vehicle.split(' ')[0]}</div>
            <div className="text-sm font-semibold text-navy">{d.name}</div>
            <div className="text-xs text-gray-400 mt-1">{d.phone}</div>
            <div className="text-xs text-gray-400">{d.vehicle}</div>
            <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan/10 text-cyan">{d.zone}</span>
          </div>
        ))}
        <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:border-cyan transition card-hover">
          <div className="text-center">
            <div className="text-2xl text-gray-300 mb-1">+</div>
            <div className="text-xs text-gray-400">Add Driver</div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 flex items-center gap-8">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-navy mb-2">📱 Instant Driver Setup</h3>
          <p className="text-sm text-gray-500 mb-4">Share this QR code with your drivers. They scan it, download the Deliver Different app, and they're ready to go — under 60 seconds.</p>
          <button className="px-5 py-2.5 rounded-full bg-navy text-white text-sm font-semibold hover:bg-navy/90 transition">📋 Copy Link</button>
          <button className="px-5 py-2.5 rounded-full bg-cyan text-white text-sm font-semibold hover:bg-cyan-dark transition ml-2">📤 Share via SMS</button>
        </div>
        <div className="bg-white p-3 rounded-2xl shadow-lg border border-gray-100">
          <div className="qr-mock w-44 h-44 bg-white p-1">
            {qrCells.map((dark, i) => (
              <div key={i} className="qr-cell" style={{ background: dark ? '#0d0c2c' : 'white' }} />
            ))}
          </div>
          <div className="text-center text-[10px] text-gray-400 mt-2 font-medium">dfrnt.app/join/swift</div>
        </div>
      </div>
    </div>
  )
}
