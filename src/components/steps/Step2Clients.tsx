import { useRef, useState } from 'react'
import { useStore } from '../../store'
import { uploadClientsCsv } from '../../lib/api'
import { SmartImport } from '../SmartImport'

interface ClientContact {
  clientName: string
  firstName: string
  lastName: string
  email: string
  phone: string
  role: string
  isPrimary: boolean
}

export function Step2Clients() {
  const { clients, setClients, addClient } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const contactFileRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<HTMLDivElement>(null)
  const [showSmartImport, setShowSmartImport] = useState(false)
  const [showContactImport, setShowContactImport] = useState(false)
  const [contacts, setContacts] = useState<ClientContact[]>([])
  const [activeTab, setActiveTab] = useState<'clients' | 'contacts'>('clients')

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const nameIdx = headers.findIndex(h => h.includes('company') || h.includes('name'))
    const contactIdx = headers.findIndex(h => h.includes('contact'))
    const phoneIdx = headers.findIndex(h => h.includes('phone'))
    const emailIdx = headers.findIndex(h => h.includes('email'))
    const billingIdx = headers.findIndex(h => h.includes('billing'))

    const newClients = lines.slice(1).filter(l => l.trim()).map(line => {
      const cols = line.split(',').map(c => c.trim())
      return {
        name: cols[nameIdx >= 0 ? nameIdx : 0] || '',
        contact: cols[contactIdx >= 0 ? contactIdx : 1] || '',
        phone: cols[phoneIdx >= 0 ? phoneIdx : 2] || '',
        email: cols[emailIdx >= 0 ? emailIdx : 3] || '',
        billing: cols[billingIdx >= 0 ? billingIdx : 4] || 'Monthly',
      }
    })
    setClients([...clients, ...newClients])
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => parseCSV(e.target?.result as string)
    reader.readAsText(file)
    // Also upload to backend if session exists
    const sessionId = useStore.getState().sessionId
    if (sessionId) {
      uploadClientsCsv(sessionId, file).catch((err) => console.warn('CSV upload failed:', err))
    }
  }

  const parseContactCSV = (text: string) => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const clientIdx = headers.findIndex(h => h.includes('client') || h.includes('company') || h.includes('account'))
    const firstIdx = headers.findIndex(h => h.includes('first'))
    const lastIdx = headers.findIndex(h => h.includes('last') || h.includes('surname'))
    const emailIdx = headers.findIndex(h => h.includes('email'))
    const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile'))
    const roleIdx = headers.findIndex(h => h.includes('role') || h.includes('title') || h.includes('position'))
    const primaryIdx = headers.findIndex(h => h.includes('primary') || h.includes('main'))

    const newContacts = lines.slice(1).filter(l => l.trim()).map(line => {
      const cols = line.split(',').map(c => c.trim())
      return {
        clientName: cols[clientIdx >= 0 ? clientIdx : 0] || '',
        firstName: cols[firstIdx >= 0 ? firstIdx : 1] || '',
        lastName: cols[lastIdx >= 0 ? lastIdx : 2] || '',
        email: cols[emailIdx >= 0 ? emailIdx : 3] || '',
        phone: cols[phoneIdx >= 0 ? phoneIdx : 4] || '',
        role: cols[roleIdx >= 0 ? roleIdx : 5] || '',
        isPrimary: primaryIdx >= 0 ? ['true', 'yes', '1', 'y'].includes(cols[primaryIdx]?.toLowerCase()) : false,
      }
    })
    setContacts(prev => [...prev, ...newContacts])
  }

  const handleContactFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => parseContactCSV(e.target?.result as string)
    reader.readAsText(file)
  }

  const handleAddManual = () => {
    addClient({ name: '', contact: '', phone: '', email: '', billing: 'Monthly' })
  }

  const handleAddManualContact = () => {
    setContacts(prev => [...prev, { clientName: '', firstName: '', lastName: '', email: '', phone: '', role: '', isPrimary: false }])
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-navy">📋 Your Clients</h2>
      <p className="text-gray-500 text-sm">Import your client list and their contacts.</p>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('clients')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition ${activeTab === 'clients' ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          🏢 Companies {clients.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-cyan/10 text-cyan text-xs">{clients.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab('contacts')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition ${activeTab === 'contacts' ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          👤 Contacts {contacts.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-cyan/10 text-cyan text-xs">{contacts.length}</span>}
        </button>
      </div>

      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <input ref={contactFileRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleContactFile(e.target.files[0])} />
      {/* === CLIENTS TAB === */}
      {activeTab === 'clients' && (
        <>
          {/* Smart Import Button */}
          <button
            onClick={() => setShowSmartImport(true)}
            className="w-full px-5 py-3 rounded-2xl text-white text-sm font-semibold transition hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #0d0c2c 0%, #3bc7f4 100%)' }}
          >
            🔄 Smart Import from Competitor TMS
          </button>

          {showSmartImport && (
            <SmartImport
              entityType="clients"
              onComplete={(data) => {
                const mapped = data.map(d => ({
                  name: d.name || '',
                  contact: d.contactFirstName ? `${d.contactFirstName} ${d.contactLastName || ''}`.trim() : '',
                  phone: d.phone || '',
                  email: d.email || '',
                  billing: d.billingType || 'Monthly',
                }))
                setClients([...clients, ...mapped])
                setShowSmartImport(false)
              }}
              onClose={() => setShowSmartImport(false)}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <div
              ref={dragRef}
              className="drag-zone rounded-2xl p-8 text-center cursor-pointer hover:border-cyan bg-white"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); dragRef.current?.classList.add('dragover') }}
              onDragLeave={() => dragRef.current?.classList.remove('dragover')}
              onDrop={(e) => { e.preventDefault(); dragRef.current?.classList.remove('dragover'); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]) }}
            >
              <div className="text-4xl mb-3">📄</div>
              <div className="text-sm font-semibold text-navy mb-1">Upload CSV</div>
              <div className="text-xs text-gray-400">Drag & drop or click to browse</div>
              <div className="text-[10px] text-gray-300 mt-2">Supports Key Software, Elite EXTRA, Datatrac exports</div>
            </div>
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
              <div className="text-4xl mb-3">✏️</div>
              <div className="text-sm font-semibold text-navy mb-1">Add Manually</div>
              <div className="text-xs text-gray-400">Enter client details one at a time</div>
              <button onClick={handleAddManual} className="mt-3 px-4 py-2 rounded-full bg-cyan text-white text-xs font-semibold hover:bg-cyan-dark transition">+ Add Client</button>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-lgrey text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Billing</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">No clients yet — upload a CSV or add manually</td></tr>
                )}
                {clients.map((c, i) => (
                  <tr key={i} className="border-t border-gray-50 hover:bg-cyan/5 transition cursor-pointer">
                    <td className="px-5 py-3 font-medium text-navy">{c.name}</td>
                    <td className="px-5 py-3 text-gray-600">{c.contact}</td>
                    <td className="px-5 py-3 text-gray-500">{c.phone}</td>
                    <td className="px-5 py-3 text-gray-500">{c.email}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.billing === 'Monthly' ? 'bg-cyan/10 text-cyan' : 'bg-purple-50 text-purple-600'}`}>{c.billing}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* === CONTACTS TAB === */}
      {activeTab === 'contacts' && (
        <>
          {/* Smart Import for contacts */}
          <button
            onClick={() => setShowContactImport(true)}
            className="w-full px-5 py-3 rounded-2xl text-white text-sm font-semibold transition hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #0d0c2c 0%, #3bc7f4 100%)' }}
          >
            🔄 Smart Import Contacts from Competitor TMS
          </button>

          {showContactImport && (
            <SmartImport
              entityType="contacts"
              onComplete={(data) => {
                const mapped: ClientContact[] = data.map(d => ({
                  clientName: d.clientName || d.companyName || d.accountName || '',
                  firstName: d.firstName || d.contactFirstName || '',
                  lastName: d.lastName || d.contactLastName || d.surName || '',
                  email: d.email || d.contactEmail || '',
                  phone: d.phone || d.contactPhone || d.mobile || '',
                  role: d.role || d.title || d.position || '',
                  isPrimary: d.isPrimary === true || d.isPrimary === 'true' || d.primary === 'Yes',
                }))
                setContacts(prev => [...prev, ...mapped])
                setShowContactImport(false)
              }}
              onClose={() => setShowContactImport(false)}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <div
              className="drag-zone rounded-2xl p-8 text-center cursor-pointer hover:border-cyan bg-white"
              onClick={() => contactFileRef.current?.click()}
            >
              <div className="text-4xl mb-3">📇</div>
              <div className="text-sm font-semibold text-navy mb-1">Upload Contacts CSV</div>
              <div className="text-xs text-gray-400">Client name, first, last, email, phone, role</div>
              <div className="text-[10px] text-gray-300 mt-2">Links contacts to companies by client name</div>
            </div>
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
              <div className="text-4xl mb-3">✏️</div>
              <div className="text-sm font-semibold text-navy mb-1">Add Manually</div>
              <div className="text-xs text-gray-400">Enter contact details one at a time</div>
              <button onClick={handleAddManualContact} className="mt-3 px-4 py-2 rounded-full bg-cyan text-white text-xs font-semibold hover:bg-cyan-dark transition">+ Add Contact</button>
            </div>
          </div>

          {/* Contacts linked to clients hint */}
          {clients.length > 0 && contacts.length === 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
              💡 <strong>Tip:</strong> You've got {clients.length} companies loaded. Upload their contacts here — match them by company name and we'll link them automatically.
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-lgrey text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-3 py-3 text-center">Primary</th>
                </tr>
              </thead>
              <tbody>
                {contacts.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-sm">No contacts yet — upload a CSV or add manually</td></tr>
                )}
                {contacts.map((ct, i) => {
                  const linked = clients.some(c => c.name.toLowerCase() === ct.clientName.toLowerCase())
                  return (
                    <tr key={i} className="border-t border-gray-50 hover:bg-cyan/5 transition cursor-pointer">
                      <td className="px-4 py-3">
                        <span className={`font-medium ${linked ? 'text-navy' : 'text-amber-600'}`}>{ct.clientName}</span>
                        {!linked && ct.clientName && <span className="ml-1 text-[10px] text-amber-500" title="No matching company found">⚠️</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{ct.firstName} {ct.lastName}</td>
                      <td className="px-4 py-3 text-gray-500">{ct.email}</td>
                      <td className="px-4 py-3 text-gray-500">{ct.phone}</td>
                      <td className="px-4 py-3 text-gray-500">{ct.role}</td>
                      <td className="px-3 py-3 text-center">
                        {ct.isPrimary && <span className="text-cyan text-xs font-bold">★</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          {contacts.length > 0 && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>👤 {contacts.length} contacts</span>
              <span>🏢 {new Set(contacts.map(c => c.clientName.toLowerCase())).size} companies</span>
              <span>★ {contacts.filter(c => c.isPrimary).length} primary</span>
              {(() => {
                const unlinked = contacts.filter(ct => ct.clientName && !clients.some(c => c.name.toLowerCase() === ct.clientName.toLowerCase()))
                return unlinked.length > 0 ? <span className="text-amber-500">⚠️ {unlinked.length} unlinked</span> : <span className="text-green-600">✅ All linked</span>
              })()}
            </div>
          )}
        </>
      )}
    </div>
  )
}
