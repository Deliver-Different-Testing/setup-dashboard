import { useState, useRef, useCallback } from 'react'
import { Button, Loader, NativeSelect } from '@mantine/core'
import { FileUp } from 'lucide-react'
import { DialogShell } from './dialog/DialogShell'
import { DialogHeader } from './dialog/DialogHeader'
import { DIALOG_SIZES } from './dialog/dialogStyles'
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
  const color = value >= 80 ? 'bg-ok-light text-ok' : value >= 50 ? 'bg-warn-light text-warn' : 'bg-danger-light text-danger'
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

  return (
    <DialogShell opened onClose={onClose} size={DIALOG_SIZES.xl} label="Smart Import">
        <DialogHeader icon={<FileUp size={20} strokeWidth={1.25} />} title="Smart Import" subtitle="From a file exported by your old system" onClose={onClose} />

        {/* Step indicator */}
        <div className="px-6 py-3 flex gap-2 border-b border-line">
          {STEPS.map((s, i) => (
            <div key={s} className={`flex items-center gap-1.5 text-xs font-semibold ${i <= step ? 'text-brand-text' : 'text-dimmed'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i <= step ? 'bg-brand text-shell' : 'bg-surface-sunken text-dimmed'}`}>{i + 1}</span>
              {s}
              {i < STEPS.length - 1 && <span className="mx-1 text-dimmed">→</span>}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-danger-light text-danger rounded-lg text-sm">
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
                className={`border-2 border-dashed rounded-2xl p-12 text-center transition cursor-pointer select-none ${dragOver ? 'border-brand bg-brand/10' : 'border-line hover:border-brand/60'}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) }}
                onClick={() => fileRef.current?.click()}
              >
                <div className="text-4xl mb-3">📁</div>
                <p className="text-dimmed font-medium">Drop CSV or Excel file here</p>
                <p className="text-dimmed text-sm mt-1">or click to browse</p>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>

            </div>
          )}

          {/* Step 1: Detection result */}
          {step === 1 && detection && (
            <div className="space-y-5">
              <div className="bg-surface-sunken rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔍</span>
                  <div>
                    <div className="font-bold text-ink text-lg">Detected: {detection.system}</div>
                    <div className="text-sm text-dimmed">{detection.rowCount} rows • Entity type: <strong>{detection.entityType}</strong></div>
                  </div>
                  <div className="ml-auto"><ConfidenceBadge value={detection.confidence} /></div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setStep(2)}>Continue to mapping</Button>
                <Button variant="default" onClick={() => setStep(0)}>Re-upload</Button>
              </div>
            </div>
          )}

          {/* Step 2: Column mapping */}
          {step === 2 && detection && (
            <div className="space-y-4">
              <p className="text-sm text-dimmed">Map CSV columns to system fields. Auto-suggested matches are highlighted.</p>
              <div className="border border-line rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface-sunken">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-dimmed font-semibold">CSV Column</th>
                      <th className="px-4 py-2.5 text-left text-dimmed font-semibold">→ System Field</th>
                      <th className="px-4 py-2.5 text-center text-dimmed font-semibold">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((m, i) => (
                      <tr key={i} className="border-t border-line">
                        <td className="px-4 py-2.5 font-mono text-xs">{m.csvColumn}</td>
                        <td className="px-4 py-2.5">
                          <NativeSelect size="xs" value={m.dfField} onChange={e => updateMapping(i, e.currentTarget.value)}
                            aria-label={`System field for ${m.csvColumn}`}
                            data={[{ value: '', label: '— Skip —' }, ...detection.dfFields]} />
                        </td>
                        <td className="px-4 py-2.5 text-center"><ConfidenceBadge value={m.confidence} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <Button onClick={handlePreview} loading={loading}>Preview</Button>
                <Button variant="default" onClick={() => setStep(1)}>Back</Button>
              </div>
            </div>
          )}

          {/* Step 3: Preview & Import */}
          {step === 3 && preview && (
            <div className="space-y-4">
              {validation && validation.warnings.length > 0 && (
                <div className="bg-warn-light border border-warn rounded-xl p-3">
                  <div className="text-sm font-semibold text-warn mb-1">⚠️ Warnings ({validation.warnings.length})</div>
                  <ul className="text-xs text-warn space-y-0.5 max-h-24 overflow-y-auto">
                    {validation.warnings.slice(0, 10).map((w, i) => <li key={i}>{w}</li>)}
                    {validation.warnings.length > 10 && <li>...and {validation.warnings.length - 10} more</li>}
                  </ul>
                </div>
              )}

              <div className="border border-line rounded-xl overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface-sunken">
                    <tr>
                      {preview[0] && Object.keys(preview[0]).map(k => (
                        <th key={k} className="px-3 py-2 text-left text-dimmed font-semibold whitespace-nowrap">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-line">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-2 whitespace-nowrap">{String(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-sm text-dimmed">Showing {preview.length} of {detection?.rowCount || '?'} rows</div>

              {importResult ? (
                <div className={`p-4 rounded-xl ${importResult.success ? 'bg-ok-light text-ok' : 'bg-danger-light text-danger'}`}>
                  {importResult.success
                    ? `✅ Successfully imported ${importResult.imported} records`
                    : `❌ Import failed: ${importResult.errors?.join(', ')}`}
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button onClick={handleImport} loading={loading}>{`Import ${detection?.rowCount || ''} records`}</Button>
                  <Button variant="default" onClick={() => setStep(2)}>Adjust mappings</Button>
                </div>
              )}
            </div>
          )}

          {loading && step === 0 && (
            <div className="text-center py-8">
              <Loader size="md" mx="auto" mb="sm" />
              <p className="text-sm text-dimmed">Analyzing file...</p>
            </div>
          )}
        </div>
    </DialogShell>
  )
}
