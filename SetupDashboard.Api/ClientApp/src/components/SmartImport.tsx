import { useState, useRef, useCallback } from 'react'
import { Alert, Badge, Box, Button, Code, Group, List, Loader, NativeSelect, Paper, Stack, Stepper, Table, Text, UnstyledButton } from '@mantine/core'
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
  const color = value >= 80 ? 'green' : value >= 50 ? 'yellow' : 'red'
  return <Badge variant="light" color={color} tt="none" fw={600}>{value}%</Badge>
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
        <Box px="xl" py="sm" style={{ borderBottom: '1px solid var(--dd-outline-variant)' }}>
          <Stepper active={step} size="xs" allowNextStepsSelect={false}>
            {STEPS.map(s => <Stepper.Step key={s} label={s} />)}
          </Stepper>
        </Box>

        {/* Content */}
        <Stack p="xl" gap="md">
          {error && (
            <Alert variant="light" color="red">
              {error.includes('; ') ? (
                <List size="sm" spacing={4}>
                  {error.split('; ').map((e, i) => <List.Item key={i}>{e}</List.Item>)}
                </List>
              ) : error}
            </Alert>
          )}

          {/* Step 0: Upload */}
          {step === 0 && (
            <UnstyledButton
              type="button"
              w="100%"
              p={48}
              ta="center"
              style={{
                border: `2px dashed ${dragOver ? 'var(--mantine-primary-color-filled)' : 'var(--dd-outline-variant)'}`,
                borderRadius: 'var(--mantine-radius-lg)',
                background: dragOver ? 'var(--mantine-primary-color-light)' : undefined,
                userSelect: 'none',
              }}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) }}
              onClick={() => fileRef.current?.click()}
            >
              <Text fz={36} mb="sm">📁</Text>
              <Text c="dimmed" fw={500}>Drop CSV or Excel file here</Text>
              <Text c="dimmed" size="sm" mt={4}>or click to browse</Text>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </UnstyledButton>
          )}

          {/* Step 1: Detection result */}
          {step === 1 && detection && (
            <Stack gap="lg">
              <Paper p="lg" bg="var(--dd-surface)">
                <Group gap="sm" align="center" wrap="nowrap">
                  <Text fz={24}>🔍</Text>
                  <Box>
                    <Text fw={700} fz="lg">Detected: {detection.system}</Text>
                    <Text size="sm" c="dimmed">{detection.rowCount} rows • Entity type: <Text span inherit fw={700}>{detection.entityType}</Text></Text>
                  </Box>
                  <Box ml="auto"><ConfidenceBadge value={detection.confidence} /></Box>
                </Group>
              </Paper>
              <Group gap="sm">
                <Button onClick={() => setStep(2)}>Continue to mapping</Button>
                <Button variant="default" onClick={() => setStep(0)}>Re-upload</Button>
              </Group>
            </Stack>
          )}

          {/* Step 2: Column mapping */}
          {step === 2 && detection && (
            <Stack gap="md">
              <Text size="sm" c="dimmed">Map CSV columns to system fields. Auto-suggested matches are highlighted.</Text>
              <Paper withBorder style={{ overflow: 'hidden' }}>
                <Table fz="sm" withRowBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>CSV Column</Table.Th>
                      <Table.Th>→ System Field</Table.Th>
                      <Table.Th ta="center">Confidence</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {mappings.map((m, i) => (
                      <Table.Tr key={i}>
                        <Table.Td><Code>{m.csvColumn}</Code></Table.Td>
                        <Table.Td>
                          <NativeSelect size="xs" value={m.dfField} onChange={e => updateMapping(i, e.currentTarget.value)}
                            aria-label={`System field for ${m.csvColumn}`}
                            data={[{ value: '', label: '— Skip —' }, ...detection.dfFields]} />
                        </Table.Td>
                        <Table.Td ta="center"><ConfidenceBadge value={m.confidence} /></Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
              <Group gap="sm">
                <Button onClick={handlePreview} loading={loading}>Preview</Button>
                <Button variant="default" onClick={() => setStep(1)}>Back</Button>
              </Group>
            </Stack>
          )}

          {/* Step 3: Preview & Import */}
          {step === 3 && preview && (
            <Stack gap="md">
              {validation && validation.warnings.length > 0 && (
                <Alert variant="light" color="yellow" title={`⚠️ Warnings (${validation.warnings.length})`}>
                  <List size="xs" spacing={2} mah={96} style={{ overflowY: 'auto' }}>
                    {validation.warnings.slice(0, 10).map((w, i) => <List.Item key={i}>{w}</List.Item>)}
                    {validation.warnings.length > 10 && <List.Item>...and {validation.warnings.length - 10} more</List.Item>}
                  </List>
                </Alert>
              )}

              <Paper withBorder style={{ overflowX: 'auto' }}>
                <Table fz="xs" withRowBorders>
                  <Table.Thead>
                    <Table.Tr>
                      {preview[0] && Object.keys(preview[0]).map(k => (
                        <Table.Th key={k} style={{ whiteSpace: 'nowrap' }}>{k}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {preview.map((row, i) => (
                      <Table.Tr key={i}>
                        {Object.values(row).map((v, j) => (
                          <Table.Td key={j} style={{ whiteSpace: 'nowrap' }}>{String(v)}</Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>

              <Text size="sm" c="dimmed">Showing {preview.length} of {detection?.rowCount || '?'} rows</Text>

              {importResult ? (
                <Alert variant="light" color={importResult.success ? 'green' : 'red'}>
                  {importResult.success
                    ? `✅ Successfully imported ${importResult.imported} records`
                    : `❌ Import failed: ${importResult.errors?.join(', ')}`}
                </Alert>
              ) : (
                <Group gap="sm">
                  <Button onClick={handleImport} loading={loading}>{`Import ${detection?.rowCount || ''} records`}</Button>
                  <Button variant="default" onClick={() => setStep(2)}>Adjust mappings</Button>
                </Group>
              )}
            </Stack>
          )}

          {loading && step === 0 && (
            <Stack align="center" gap="sm" py="xl">
              <Loader size="md" />
              <Text size="sm" c="dimmed">Analyzing file...</Text>
            </Stack>
          )}
        </Stack>
    </DialogShell>
  )
}
