import { useState } from 'react'
import { useStore } from '../store'
import * as api from '../lib/api'
import { EnvironmentPicker } from './EnvironmentPicker'
import { PdfSummary } from './PdfSummary'

export function Header() {
  const getCompletionPercentage = useStore((s) => s.getCompletionPercentage)
  const sessionId = useStore((s) => s.sessionId)
  const initSession = useStore((s) => s.initSession)
  // Help panel removed
  const pct = getCompletionPercentage()
  const [showRollback, setShowRollback] = useState(false)
  const [rolling, setRolling] = useState(false)

  const handleRollback = async () => {
    if (!sessionId) return
    setRolling(true)
    try {
      await api.rollbackSession(sessionId)
      setShowRollback(false)
      useStore.setState({
        sessionId: null,
        currentStep: 0,
        completedSteps: new Set(),
        companyName: '',
        geography: '',
        selectedCities: [],
        selectedVerticals: [],
        legalName: '',
        registrationNumber: '',
        countryOfRegistration: '',
        stateOfIncorporation: '',
        businessType: '',
        uploadedDocuments: [],
        cardNumber: '',
        cardExpiry: '',
        cardCvc: '',
        cardholderName: '',
        billingAddress: { street: '', city: '', state: '', zip: '' },
        primaryContact: { name: '', email: '', phone: '', title: '' },
        apiStatus: {},
        apiErrors: {},
      })
      await initSession()
    } catch (e) {
      console.error('Rollback failed:', e)
    } finally {
      setRolling(false)
    }
  }

  return (
    <header className="bg-navy text-white px-6 py-4 flex items-center justify-between relative z-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}dfrnt-logo.jpg`} alt="DFRNT — Deliver Different" className="h-7 rounded" />
        </div>
        <div className="h-6 w-px bg-white/20 mx-2" />
        <span className="text-sm text-white/80">Let's get you onboarded</span>
      </div>
      <div className="flex items-center gap-4">
        <EnvironmentPicker />
        <div className="text-sm font-semibold">
          <span className="text-cyan">{pct}%</span> complete
        </div>
        <PdfSummary />
        {sessionId && (
          <button
            onClick={() => setShowRollback(true)}
            className="text-xs px-3 py-1.5 rounded-full border border-red-400/50 text-red-300 hover:bg-red-500/20 hover:text-red-200 transition"
          >
            ⚠️ Reset
          </button>
        )}
        {showRollback && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => !rolling && setShowRollback(false)}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-navy mb-2">⚠️ Reset Setup</h3>
              <p className="text-sm text-gray-500 mb-4">This will delete all entities created during this session from DFRNT and start fresh. This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowRollback(false)} disabled={rolling} className="flex-1 px-4 py-2 rounded-full border border-gray-300 text-sm font-semibold text-gray-500">Cancel</button>
                <button onClick={handleRollback} disabled={rolling} className="flex-1 px-4 py-2 rounded-full bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition disabled:opacity-60">
                  {rolling ? '⟳ Deleting...' : 'Yes, Reset Everything'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
