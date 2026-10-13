import { useStore } from '../../store'
import { useCallback, useRef, useState } from 'react'

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-6 pb-2 border-t border-gray-200 mt-6 first:mt-0 first:border-0 first:pt-0">
      <span className="text-lg">{icon}</span>
      <h3 className="text-lg font-bold text-navy">{title}</h3>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{children}</label>
}

function Input({ value, onChange, placeholder, className = '', type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-cyan focus:outline-none text-sm ${className}`}
    />
  )
}

export function Step0Business() {
  const s = useStore()
  const dragRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [logoError, setLogoError] = useState(false)
  const [localLogo, setLocalLogo] = useState<string | null>(null)

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setLocalLogo(dataUrl)
      setLogoError(false)
    }
    reader.readAsDataURL(file)
  }, [])

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
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h2 className="text-2xl font-bold text-navy">Your Business</h2>
      <p className="text-gray-500 text-sm">Tell us about your courier company so we can tailor Deliver Different for you.</p>

      {/* -- Company Profile -- */}
      <SectionHeader icon="🏢" title="Company Profile" />
      <div className="grid grid-cols-2 gap-6">
        <div>
          <Label>Company Name</Label>
          <Input value={s.companyName} onChange={s.setCompanyName} placeholder="e.g. Swift Logistics" />
        </div>
        <div>
          <Label>Logo</Label>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
          {(localLogo || (s.tenantLogoUrl && !logoError)) ? (
            <div
              className="rounded-xl border border-gray-200 p-4 flex items-center justify-center bg-white h-[88px] cursor-pointer select-none hover:border-cyan transition relative group"
              onClick={() => fileRef.current?.click()}
            >
              <img src={localLogo || s.tenantLogoUrl!} alt="Logo" className="max-h-14 max-w-full object-contain" onError={() => { setLogoError(true); setLocalLogo(null) }} />
              <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <span className="text-white text-xs font-semibold">Change Logo</span>
              </div>
            </div>
          ) : (
            <div ref={dragRef} className="drag-zone rounded-xl p-4 text-center cursor-pointer hover:border-cyan" onClick={() => fileRef.current?.click()} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
              <div className="text-2xl mb-1">📁</div>
              <div className="text-xs text-gray-400">Drop logo here or click to upload</div>
            </div>
          )}
        </div>
      </div>

      {/* -- Primary Contact -- */}
      <SectionHeader icon="👤" title="Primary Contact" />
      <p className="text-xs text-gray-400 -mt-2">This person will be the main point of contact during onboarding.</p>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <Label>Full Name</Label>
          <Input value={s.primaryContact.name} onChange={(v) => s.setPrimaryContact('name', v)} placeholder="Jane Smith" />
        </div>
        <div>
          <Label>Role / Title</Label>
          <Input value={s.primaryContact.title} onChange={(v) => s.setPrimaryContact('title', v)} placeholder="Operations Manager" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <Label>Email</Label>
          <Input value={s.primaryContact.email} onChange={(v) => s.setPrimaryContact('email', v)} placeholder="jane@company.com" type="email" />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={s.primaryContact.phone} onChange={(v) => s.setPrimaryContact('phone', v)} placeholder="(555) 123-4567" type="tel" />
        </div>
      </div>

      {/* TODO: Uncomment these sections when ready to implement

      -- Smart Import --
      <button className="w-full px-5 py-3 rounded-2xl text-white text-sm font-semibold transition hover:opacity-90" style={{ background: 'linear-gradient(135deg, #0d0c2c 0%, #3bc7f4 100%)' }}>
        Smart Import Business Profile from Competitor TMS
      </button>

      -- Geography & Verticals --
      <SectionHeader icon="🌍" title="Geography & Verticals" />
      Geography Covered, Cities, Verticals Served, Current System, Deliveries/Month

      -- Registration & Legal --
      <SectionHeader icon="📋" title="Registration & Legal" />
      Company Legal Name, Registration Number / EIN, Country, State, Business Type

      -- Company Documents --
      <SectionHeader icon="📄" title="Company Documents" />
      Upload business license, insurance certificate, W-9, or other tax forms

      -- Billing --
      <SectionHeader icon="💳" title="Billing" />
      Card Number, Expiry, CVC, Cardholder Name, Billing Address

      */}
    </div>
  )
}
