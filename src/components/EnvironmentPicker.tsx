import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import * as api from '../lib/api'

interface EnvOption {
  key: string
  name: string
  description: string
  isProduction: boolean
}

const FALLBACK_ENVS: EnvOption[] = [
  { key: 'urgent-staging', name: 'Urgent Staging', description: 'Urgent Couriers staging', isProduction: false },
  { key: 'medical-staging', name: 'Medical Staging', description: 'Medical courier staging', isProduction: false },
  { key: 'medical-prod', name: 'Medical Production', description: 'Medical courier production', isProduction: true },
  { key: 'otg-staging', name: 'OTG Staging', description: 'OTG Cargo staging', isProduction: false },
  { key: 'otg-prod', name: 'OTG Production', description: 'OTG Cargo production', isProduction: true },
  { key: 'mpf-staging', name: 'MPF Staging', description: 'MPF staging', isProduction: false },
  { key: 'mpf-prod', name: 'MPF Production', description: 'MPF production', isProduction: true },
  { key: 'am-staging', name: 'AM Staging', description: 'AM test staging', isProduction: false },
  { key: 'crossroads-staging', name: 'Crossroads Staging', description: 'Crossroads Courier staging', isProduction: false },
  { key: 'dfrnt-staging', name: 'DFRNT Staging', description: 'DFRNT staging', isProduction: false },
]

export function EnvironmentPicker() {
  const selectedEnvironment = useStore(s => s.selectedEnvironment)
  const setSelectedEnvironment = useStore(s => s.setSelectedEnvironment)
  const [envs, setEnvs] = useState<EnvOption[]>(FALLBACK_ENVS)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.getEnvironments().then(res => {
      if (res.environments?.length) setEnvs(res.environments)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current = envs.find(e => e.key === selectedEnvironment) || envs[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 text-xs font-medium text-white/80 hover:bg-white/10 transition"
      >
        <span className={`w-2 h-2 rounded-full ${current?.isProduction ? 'bg-red-400' : 'bg-green-400'}`} />
        <span>{current?.name || selectedEnvironment}</span>
        <span className="text-white/40">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-[100]">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
            <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Environment</div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {envs.map(env => (
              <button
                key={env.key}
                onClick={() => { setSelectedEnvironment(env.key); setOpen(false) }}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-cyan/5 transition ${selectedEnvironment === env.key ? 'bg-cyan/10' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${env.isProduction ? 'bg-red-400' : 'bg-green-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-navy">{env.name}</div>
                  <div className="text-[10px] text-gray-400 truncate">{env.description}</div>
                </div>
                {selectedEnvironment === env.key && <span className="text-cyan text-sm">✓</span>}
                {env.isProduction && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-500">PROD</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
