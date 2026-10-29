import { useEffect, useState } from 'react'
import { completionPercent, openRequestCount, useStore } from '../store'
import * as api from '../lib/api'
import { PdfSummary } from './PdfSummary'

export function Header() {
  const session = useStore(s => s.session)
  const me = useStore(s => s.me)
  const [logo, setLogo] = useState<string | null>(null)
  const waiting = openRequestCount(session)
  const pct = completionPercent(session)

  useEffect(() => { api.getTenantLogo().then(r => setLogo(r.logoUrl)).catch(() => setLogo(null)) }, [])

  return (
    <header className="bg-navy text-white px-6 py-3 flex items-center justify-between relative z-50">
      <div className="flex items-center gap-4">
        <img src={`${import.meta.env.BASE_URL}dfrnt-logo.png`} alt="DFRNT - Deliver Different" className="h-7" />
        <div className="h-6 w-px bg-white/20" />
        {logo && <img src={logo} alt="" className="h-7 rounded bg-white/90 px-1" />}
        <div>
          <div className="text-sm font-semibold">{session?.business.companyName || session?.tenantCode || 'New tenant setup'}</div>
          <div className="text-[11px] text-white/50">{me?.name}{me?.isDfAdmin ? ' · DFRNT' : ''}</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {waiting > 0 && (
          <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-200 text-xs font-semibold" title="Things DFRNT has asked the tenant for">
            Waiting on {session?.business.companyName || 'tenant'}: {waiting}
          </span>
        )}
        <div className="flex items-center gap-2">
          <div className="w-28 h-1.5 rounded-full bg-white/15 overflow-hidden"><div className="h-full bg-cyan" style={{ width: `${pct}%` }} /></div>
          <span className="text-xs text-white/70">{pct}% done</span>
        </div>
        <PdfSummary />
      </div>
    </header>
  )
}
