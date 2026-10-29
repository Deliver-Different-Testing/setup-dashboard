import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store'
import { getApiBaseUrl } from '../lib/api'

interface FieldMapping {
  csvColumn: string
  dfField: string
  confidence: number
  transform?: string
}

interface DetectionResult {
  system: string
  confidence: number
  entityType: string
  headers: string[]
  rowCount: number
  suggestedMappings: FieldMapping[]
  dfFields: string[]
}

interface ImportOutcome { success: boolean; total?: number; imported?: number; failed?: number; errors?: string[]; mappedData?: Record<string, unknown>[] }

interface Props {
  entityType: 'team' | 'clients' | 'contacts' | 'drivers' | 'zones' | 'rates'
  /** Rows were loaded into the step on the server; reload the session to see them. */
  onComplete: (data: Record<string, unknown>[]) => void
  onClose: () => void
}

const STEPS = ['Upload', 'Detect', 'Map', 'Preview & Import']

function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-green-100 text-green-700' : value >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{value}%</span>
}

export function SmartImport({ entityType, onComplete, onClose }: Props) {
  const sessionId = useStore(s => s.session?.id)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [detection, setDetection] = useState<DetectionResult | null>(null)
  const [mappings, setMappings] = useState<FieldMapping[]>([])
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null)
  const [validation, setValidation] = useState<{ errors: string[]; warnings: string[] } | null>(null)
  const [importResult, setImportResult] = useState<ImportOutcome | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!sessionId) { setError('No session. Please start setup first.'); return }
    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('sessionId', sessionId)
      if (entityType) form.append('entityType', entityType)
      const res = await fetch(`${getApiBaseUrl()}/setup/import/detect`, { method: 'POST', body: form, credentials: 'include' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Detection failed')
      setDetection(data)
      setMappings(data.suggestedMappings)
      setStep(1)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [sessionId, entityType])

  const handlePreview = async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const res = await fetch(`${getApiBaseUrl()}/setup/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId, mappings, entityType: detection?.entityType || entityType }),
      })
      const data = await res.json()
      if (!data.success) {
        const errors = data.validation?.errors || []
        const warnings = data.validation?.warnings || []
        const details = [...errors, ...warnings].join('; ')
        throw new Error(details || data.message || 'Preview failed')
      }
      setPreview(data.preview)
      setValidation(data.validation)
      setStep(3)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const res = await fetch(`${getApiBaseUrl()}/setup/import/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId, mappings, entityType: detection?.entityType || entityType }),
      })
      const data = await res.json()
      setImportResult(data)
      if (data.success) {
        // Use mappedData from execute response (all rows) instead of preview (capped at 20)
        const allRows = data.mappedData && data.mappedData.length > 0 ? data.mappedData : preview
        if (allRows) {
          onComplete(allRows)
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const updateMapping = (idx: number, dfField: string) => {
    setMappings(prev => prev.map((m, i) => i === idx ? { ...m, dfField, confidence: dfField ? 100 : 0 } : m))
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between" style={{ backgroundColor: '#0d0c2c' }}>
          <h2 className="text-lg font-bold text-white">🔄 Smart Import</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl">✕</button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 flex gap-2 border-b border-gray-100">
          {STEPS.map((s, i) => (
            <div key={s} className={`flex items-center gap-1.5 text-xs font-semibold ${i <= step ? 'text-cyan-500' : 'text-gray-300'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i <= step ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{i + 1}</span>
              {s}
              {i < STEPS.length - 1 && <span className="mx-1 text-gray-200">→</span>}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error.includes('; ') ? (
                <ul className="list-disc list-inside space-y-1">
                  {error.split('; ').map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              ) : error}
            </div>
          )}

          {/* Step 0: Upload */}
          {step === 0 && (
            <div className="space-y-6">
              <div
                className={`border-2 border-dashed rounded-2xl p-12 text-center transition cursor-pointer select-none ${dragOver ? 'border-cyan-400 bg-cyan-50' : 'border-gray-200 hover:border-cyan-300'}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) }}
                onClick={() => fileRef.current?.click()}
              >
                <div className="text-4xl mb-3">📁</div>
                <p className="text-gray-600 font-medium">Drop CSV or Excel file here</p>
                <p className="text-gray-400 text-sm mt-1">or click to browse</p>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>

            </div>
          )}

          {/* Step 1: Detection result */}
          {step === 1 && detection && (
            <div className="space-y-5">
              <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔍</span>
                  <div>
                    <div className="font-bold text-navy text-lg">Detected: {detection.system}</div>
                    <div className="text-sm text-gray-500">{detection.rowCount} rows • Entity type: <strong>{detection.entityType}</strong></div>
                  </div>
                  <div className="ml-auto"><ConfidenceBadge value={detection.confidence} /></div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: '#3bc7f4' }}>
                  Continue to Mapping →
                </button>
                <button onClick={() => setStep(0)} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">
                  ← Re-upload
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Column mapping */}
          {step === 2 && detection && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Map CSV columns to system fields. Auto-suggested matches are highlighted.</p>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-gray-600 font-semibold">CSV Column</th>
                      <th className="px-4 py-2.5 text-left text-gray-600 font-semibold">→ System Field</th>
                      <th className="px-4 py-2.5 text-center text-gray-600 font-semibold">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((m, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-4 py-2.5 font-mono text-xs">{m.csvColumn}</td>
                        <td className="px-4 py-2.5">
                          <select
                            value={m.dfField}
                            onChange={e => updateMapping(i, e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-cyan-400"
                          >
                            <option value="">— Skip —</option>
                            {detection.dfFields.map(f => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2.5 text-center"><ConfidenceBadge value={m.confidence} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <button onClick={handlePreview} disabled={loading} className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: '#3bc7f4' }}>
                  {loading ? 'Loading...' : 'Preview →'}
                </button>
                <button onClick={() => setStep(1)} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">← Back</button>
              </div>
            </div>
          )}

          {/* Step 3: Preview & Import */}
          {step === 3 && preview && (
            <div className="space-y-4">
              {validation && validation.warnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                  <div className="text-sm font-semibold text-yellow-700 mb-1">⚠️ Warnings ({validation.warnings.length})</div>
                  <ul className="text-xs text-yellow-600 space-y-0.5 max-h-24 overflow-y-auto">
                    {validation.warnings.slice(0, 10).map((w, i) => <li key={i}>{w}</li>)}
                    {validation.warnings.length > 10 && <li>...and {validation.warnings.length - 10} more</li>}
                  </ul>
                </div>
              )}

              <div className="border rounded-xl overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {preview[0] && Object.keys(preview[0]).map(k => (
                        <th key={k} className="px-3 py-2 text-left text-gray-600 font-semibold whitespace-nowrap">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-2 whitespace-nowrap">{String(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-sm text-gray-500">Showing {preview.length} of {detection?.rowCount || '?'} rows</div>

              {importResult ? (
                <div className={`p-4 rounded-xl ${importResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {importResult.success
                    ? `✅ Successfully imported ${importResult.imported} records`
                    : `❌ Import failed: ${importResult.errors?.join(', ')}`}
                </div>
              ) : (
                <div className="flex gap-3">
                  <button onClick={handleImport} disabled={loading} className="px-6 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-40" style={{ backgroundColor: '#0d0c2c' }}>
                    {loading ? '⏳ Importing...' : `🚀 Import ${detection?.rowCount || ''} Records`}
                  </button>
                  <button onClick={() => setStep(2)} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">← Adjust Mappings</button>
                </div>
              )}
            </div>
          )}

          {loading && step === 0 && (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-3 border-cyan-400 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-gray-500">Analyzing file...</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
