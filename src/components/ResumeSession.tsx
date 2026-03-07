import { useStore } from '../store'
import * as api from '../lib/api'
import { useState } from 'react'

export function ResumeSession() {
  const { availableSessions, showResumePrompt, dismissResumePrompt, resumeSession, initSession } = useStore()
  const [loading, setLoading] = useState<string | null>(null)

  if (!showResumePrompt || availableSessions.length === 0) return null

  const session = availableSessions[0]
  const companyName = (session.businessData as any)?.companyName || 'Unknown Company'
  const stepsCompleted = (session.completedSteps || []).length
  const updated = new Date(session.updatedAt).toLocaleString()

  const handleResume = async () => {
    setLoading(session.id)
    try {
      const full = await api.getFullSession(session.id)
      resumeSession(full)
    } catch (e) {
      console.error('Failed to resume session:', e)
      setLoading(null)
    }
  }

  const handleFresh = () => {
    dismissResumePrompt()
    initSession()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">📋</div>
          <h2 className="text-xl font-bold text-navy">Welcome Back!</h2>
          <p className="text-gray-500 text-sm mt-1">You have a previous setup session. Resume where you left off?</p>
        </div>

        <div className="bg-lgrey rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-navy">{companyName}</span>
            <span className="text-xs bg-cyan/10 text-cyan px-2 py-0.5 rounded-full font-medium">{session.environment}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{stepsCompleted}/10 steps completed</span>
            <span>{updated}</span>
          </div>
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-cyan rounded-full transition-all" style={{ width: `${(stepsCompleted / 10) * 100}%` }} />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleFresh}
            className="flex-1 px-4 py-2.5 rounded-full border border-gray-300 text-sm font-semibold text-gray-500 hover:border-navy hover:text-navy transition"
          >
            Start Fresh
          </button>
          <button
            onClick={handleResume}
            disabled={loading !== null}
            className="flex-1 px-4 py-2.5 rounded-full bg-cyan text-white text-sm font-semibold hover:bg-cyan-dark transition shadow-lg shadow-cyan/20 disabled:opacity-60"
          >
            {loading ? '⟳ Loading...' : 'Resume →'}
          </button>
        </div>
      </div>
    </div>
  )
}
