import { useRef } from 'react'
import { useStore } from '../../store'

export function Step2Clients() {
  const { clients, setClients, addClient } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<HTMLDivElement>(null)

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
  }

  const handleAddManual = () => {
    addClient({ name: '', contact: '', phone: '', email: '', billing: 'Monthly' })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-navy">📋 Your Clients</h2>
      <p className="text-gray-500 text-sm">Import your client list or add them one by one.</p>
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
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
    </div>
  )
}
