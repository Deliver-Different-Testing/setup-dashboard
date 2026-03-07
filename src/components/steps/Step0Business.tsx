import { useStore } from '../../store'
import { Pill } from '../Pill'
import { useCallback, useRef } from 'react'

const VERTICALS = ['Medical', 'Legal', 'Food', 'Documents', 'General', 'Pharmacy', 'E-Commerce', 'Fragile']
const SYSTEMS = ['None', 'Key Software', 'Elite EXTRA', 'Datatrac', 'OnTime', 'GetSwift', 'Track-POD', 'Other']
const RANGES = ['< 500', '500–2,000', '2,000–10,000', '10,000–50,000', '50,000+']
const CITIES = ['Dallas–Fort Worth', 'Houston', 'Austin', 'San Antonio']
const COUNTRIES = ['US', 'NZ', 'AU', 'CA', 'UK', 'Other']
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']
const BUSINESS_TYPES = ['LLC', 'Corporation', 'Partnership', 'Sole Proprietor', 'Trust']

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

function Input({ value, onChange, placeholder, className = '', type = 'text', mono = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; type?: string; mono?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-cyan focus:outline-none text-sm ${mono ? 'font-mono' : ''} ${className}`}
    />
  )
}

function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-cyan focus:outline-none text-sm bg-white"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function detectCardType(num: string): string {
  const n = num.replace(/\s/g, '')
  if (/^4/.test(n)) return 'Visa'
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'MC'
  if (/^3[47]/.test(n)) return 'Amex'
  return ''
}

function formatCardNumber(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 4)
  if (digits.length > 2) return digits.slice(0, 2) + '/' + digits.slice(2)
  return digits
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function CardBadge({ type, active }: { type: string; active: boolean }) {
  const colors: Record<string, string> = { Visa: '#1a1f71', MC: '#eb001b', Amex: '#006fcf' }
  return (
    <div className={`w-10 h-7 rounded flex items-center justify-center text-[10px] font-bold text-white transition ${active ? 'ring-2 ring-cyan' : 'opacity-40'}`}
      style={{ backgroundColor: colors[type] || '#999' }}>
      {type}
    </div>
  )
}

export function Step0Business() {
  const s = useStore()
  const dragRef = useRef<HTMLDivElement>(null)
  const docDragRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleDocDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    docDragRef.current?.classList.add('dragover')
  }, [])
  const handleDocDragLeave = useCallback(() => {
    docDragRef.current?.classList.remove('dragover')
  }, [])
  const handleDocDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    docDragRef.current?.classList.remove('dragover')
    const files = Array.from(e.dataTransfer.files)
    addFiles(files)
  }, [])

  const addFiles = (files: File[]) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png']
    const maxSize = 10 * 1024 * 1024
    for (const f of files) {
      if (!allowed.includes(f.type)) continue
      if (f.size > maxSize) continue
      if (s.uploadedDocuments.some(d => d.name === f.name)) continue
      s.addUploadedDocument({ name: f.name, size: f.size, type: f.type })
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const cardType = detectCardType(s.cardNumber)

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h2 className="text-2xl font-bold text-navy">🏢 Your Business</h2>
      <p className="text-gray-500 text-sm">Tell us about your courier company so we can tailor Deliver Different for you.</p>

      {/* ── Company Profile ── */}
      <SectionHeader icon="🏢" title="Company Profile" />
      <div className="grid grid-cols-2 gap-6">
        <div>
          <Label>Company Name</Label>
          <Input value={s.companyName} onChange={s.setCompanyName} placeholder="e.g. Swift Logistics" />
        </div>
        <div>
          <Label>Logo</Label>
          <div ref={dragRef} className="drag-zone rounded-xl p-4 text-center cursor-pointer hover:border-cyan" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            <div className="text-2xl mb-1">📁</div>
            <div className="text-xs text-gray-400">Drop logo here or click to upload</div>
          </div>
        </div>
      </div>
      <div>
        <Label>Geography Covered</Label>
        <Input value={s.geography} onChange={s.setGeography} placeholder="Type cities, states, or zones..." />
        <div className="flex flex-wrap gap-2 mt-2">
          {CITIES.map(c => <Pill key={c} label={c} selected={s.selectedCities.includes(c)} onToggle={() => s.toggleCity(c)} />)}
        </div>
      </div>
      <div>
        <Label>Verticals Served</Label>
        <div className="flex flex-wrap gap-2">
          {VERTICALS.map(v => <Pill key={v} label={v} selected={s.selectedVerticals.includes(v)} onToggle={() => s.toggleVertical(v)} />)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <Label>Current System</Label>
          <Select value={s.currentSystem} onChange={s.setCurrentSystem} options={SYSTEMS} />
        </div>
        <div>
          <Label>Deliveries / Month</Label>
          <Select value={s.deliveryVolume} onChange={s.setDeliveryVolume} options={RANGES} />
        </div>
      </div>

      {/* ── Registration & Legal ── */}
      <SectionHeader icon="📋" title="Registration & Legal" />
      <div className="grid grid-cols-2 gap-6">
        <div>
          <Label>Company Legal Name</Label>
          <Input value={s.legalName} onChange={s.setLegalName} placeholder="Legal entity name" />
        </div>
        <div>
          <Label>Registration Number / EIN</Label>
          <Input value={s.registrationNumber} onChange={s.setRegistrationNumber} placeholder="e.g. 12-3456789" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <Label>Country of Registration</Label>
          <Select value={s.countryOfRegistration} onChange={s.setCountryOfRegistration} options={COUNTRIES} placeholder="Select country" />
        </div>
        {s.countryOfRegistration === 'US' && (
          <div>
            <Label>State of Incorporation</Label>
            <Select value={s.stateOfIncorporation} onChange={s.setStateOfIncorporation} options={US_STATES} placeholder="Select state" />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <Label>Business Type</Label>
          <Select value={s.businessType} onChange={s.setBusinessType} options={BUSINESS_TYPES} placeholder="Select type" />
        </div>
      </div>

      {/* ── Company Documents ── */}
      <SectionHeader icon="📄" title="Company Documents" />
      <p className="text-xs text-gray-400 -mt-2">Upload business license, insurance certificate, W-9, or other tax forms.</p>
      <div
        ref={docDragRef}
        className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-cyan transition"
        onDragOver={handleDocDragOver}
        onDragLeave={handleDocDragLeave}
        onDrop={handleDocDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="text-3xl mb-2">📎</div>
        <div className="text-sm text-gray-500">Drag & drop files here, or click to browse</div>
        <div className="text-xs text-gray-400 mt-1">PDF, JPG, PNG — max 10MB each</div>
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileSelect} />
      </div>
      {s.uploadedDocuments.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {s.uploadedDocuments.map(doc => (
            <div key={doc.name} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-200">
              <span className="text-lg">{doc.type === 'application/pdf' ? '📄' : '🖼️'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-navy truncate">{doc.name}</div>
                <div className="text-xs text-gray-400">{formatFileSize(doc.size)}</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); s.removeUploadedDocument(doc.name) }} className="text-gray-400 hover:text-red-500 text-lg">×</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Billing ── */}
      <SectionHeader icon="💳" title="Billing" />
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <CardBadge type="Visa" active={cardType === 'Visa'} />
            <CardBadge type="MC" active={cardType === 'MC'} />
            <CardBadge type="Amex" active={cardType === 'Amex'} />
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Secure payment
          </div>
        </div>
        <div>
          <Label>Card Number</Label>
          <Input value={s.cardNumber} onChange={(v) => s.setCardNumber(formatCardNumber(v))} placeholder="4242 4242 4242 4242" mono />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Expiry</Label>
            <Input value={s.cardExpiry} onChange={(v) => s.setCardExpiry(formatExpiry(v))} placeholder="MM/YY" mono />
          </div>
          <div>
            <Label>CVC</Label>
            <Input value={s.cardCvc} onChange={(v) => s.setCardCvc(v.replace(/\D/g, '').slice(0, 4))} placeholder="123" mono />
          </div>
          <div>
            <Label>Cardholder Name</Label>
            <Input value={s.cardholderName} onChange={s.setCardholderName} placeholder="Name on card" />
          </div>
        </div>
        <div>
          <Label>Billing Address</Label>
          <div className="space-y-3">
            <Input value={s.billingAddress.street} onChange={(v) => s.setBillingAddress('street', v)} placeholder="Street address" />
            <div className="grid grid-cols-3 gap-3">
              <Input value={s.billingAddress.city} onChange={(v) => s.setBillingAddress('city', v)} placeholder="City" />
              <Input value={s.billingAddress.state} onChange={(v) => s.setBillingAddress('state', v)} placeholder="State" />
              <Input value={s.billingAddress.zip} onChange={(v) => s.setBillingAddress('zip', v)} placeholder="ZIP" />
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 italic">Your card will not be charged until your first invoice is generated.</p>
      </div>

      {/* ── Primary Contact ── */}
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
    </div>
  )
}
