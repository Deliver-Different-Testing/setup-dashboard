import { useStore } from '../../store'
import { Pill } from '../Pill'
import { useCallback, useRef } from 'react'

const VERTICALS = ['Medical', 'Legal', 'Food', 'Documents', 'General', 'Pharmacy', 'E-Commerce', 'Fragile']
const SYSTEMS = ['None', 'Key Software', 'Elite EXTRA', 'Datatrac', 'OnTime', 'GetSwift', 'Track-POD', 'Other']
const RANGES = ['< 500', '500–2,000', '2,000–10,000', '10,000–50,000', '50,000+']
const CITIES = ['Dallas–Fort Worth', 'Houston', 'Austin', 'San Antonio']

export function Step0Business() {
  const s = useStore()
  const dragRef = useRef<HTMLDivElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragRef.current?.classList.add('dragover')
  }, [])
  const handleDragLeave = useCallback(() => {
    dragRef.current?.classList.remove('dragover')
  }, [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragRef.current?.classList.remove('dragover')
  }, [])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-navy">🏢 Your Business</h2>
      <p className="text-gray-500 text-sm">Tell us about your courier company so we can tailor Deliver Different for you.</p>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Company Name</label>
          <input type="text" value={s.companyName} onChange={(e) => s.setCompanyName(e.target.value)} placeholder="e.g. Swift Logistics" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-cyan focus:outline-none text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Logo</label>
          <div ref={dragRef} className="drag-zone rounded-xl p-4 text-center cursor-pointer hover:border-cyan" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            <div className="text-2xl mb-1">📁</div>
            <div className="text-xs text-gray-400">Drop logo here or click to upload</div>
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Geography Covered</label>
        <input type="text" value={s.geography} onChange={(e) => s.setGeography(e.target.value)} placeholder="Type cities, states, or zones..." className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-cyan focus:outline-none text-sm" />
        <div className="flex flex-wrap gap-2 mt-2">
          {CITIES.map(c => <Pill key={c} label={c} selected={s.selectedCities.includes(c)} onToggle={() => s.toggleCity(c)} />)}
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Verticals Served</label>
        <div className="flex flex-wrap gap-2">
          {VERTICALS.map(v => <Pill key={v} label={v} selected={s.selectedVerticals.includes(v)} onToggle={() => s.toggleVertical(v)} />)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Current System</label>
          <select value={s.currentSystem} onChange={(e) => s.setCurrentSystem(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-cyan focus:outline-none text-sm bg-white">
            {SYSTEMS.map(sys => <option key={sys}>{sys}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Deliveries / Month</label>
          <select value={s.deliveryVolume} onChange={(e) => s.setDeliveryVolume(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-cyan focus:outline-none text-sm bg-white">
            {RANGES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
