import { useState, useEffect } from 'react'
import { useStore } from '../../store'

const CHALLENGES: Record<string, { id: string; title: string; desc: string; xp: number; prereqs: string[] }[]> = {
  dispatcher: [
    { id: 'first-job', title: '🎯 First Dispatch', desc: 'Create and dispatch your first job', xp: 50, prereqs: [] },
    { id: 'speed-10', title: '⚡ Speed Demon', desc: 'Dispatch 10 jobs in under 5 minutes', xp: 100, prereqs: ['first-job'] },
    { id: 'auto-shadow', title: '🧠 Shadow Mode', desc: 'Enable Auto-Dispatch Shadow and review 10 AI suggestions', xp: 150, prereqs: ['first-job'] },
    { id: 'auto-suggest', title: '🤖 Trust the AI', desc: 'Switch to Suggest mode and accept 20 dispatches', xp: 200, prereqs: ['auto-shadow'] },
    { id: 'multi-stop', title: '🗺️ Route Master', desc: 'Create a multi-stop route with 5+ deliveries', xp: 125, prereqs: ['speed-10'] },
    { id: 'reassign', title: '🔄 Quick Pivot', desc: 'Reassign 3 jobs to different drivers mid-route', xp: 75, prereqs: ['first-job'] },
    { id: 'zero-touch', title: '📧 Zero Touch', desc: 'Process 5 email orders without manual intervention', xp: 200, prereqs: ['auto-suggest'] },
    { id: 'dispatch-master', title: '🏆 Dispatch Master', desc: 'Complete all dispatcher challenges', xp: 500, prereqs: ['speed-10', 'auto-suggest', 'multi-stop', 'reassign', 'zero-touch'] },
  ],
  admin: [
    { id: 'add-client', title: '📋 First Client', desc: 'Add your first client to the system', xp: 50, prereqs: [] },
    { id: 'rate-card', title: '💰 Rate Builder', desc: 'Create a custom rate card', xp: 100, prereqs: ['add-client'] },
    { id: 'zone-setup', title: '🗺️ Zone Creator', desc: 'Set up delivery zones with zip codes', xp: 100, prereqs: [] },
    { id: 'automation-rule', title: '⚡ Automation Guru', desc: 'Create 3 automation rules', xp: 125, prereqs: [] },
    { id: 'kb-article', title: '📖 Knowledge Keeper', desc: 'Create your first KB article', xp: 75, prereqs: [] },
    { id: 'import-clients', title: '📄 Data Migrator', desc: 'Import 50+ clients from CSV', xp: 150, prereqs: ['add-client'] },
    { id: 'reporting', title: '📊 Insights Pro', desc: 'Generate and share 3 reports', xp: 125, prereqs: ['add-client'] },
    { id: 'admin-master', title: '🏆 Admin Master', desc: 'Complete all admin challenges', xp: 500, prereqs: ['rate-card', 'zone-setup', 'automation-rule', 'import-clients', 'reporting'] },
  ],
  accounts: [
    { id: 'first-invoice', title: '🧾 First Invoice', desc: 'Generate your first invoice', xp: 50, prereqs: [] },
    { id: 'batch-invoice', title: '📑 Batch Pro', desc: 'Generate invoices for 10+ clients at once', xp: 125, prereqs: ['first-invoice'] },
    { id: 'xero-sync', title: '🔗 Connected Books', desc: 'Sync an invoice to Xero or QuickBooks', xp: 100, prereqs: ['first-invoice'] },
    { id: 'statement', title: '📬 Statement Sender', desc: 'Send a client statement', xp: 75, prereqs: ['first-invoice'] },
    { id: 'rate-review', title: '💰 Rate Auditor', desc: 'Review and adjust 5 client rate cards', xp: 150, prereqs: ['first-invoice'] },
    { id: 'accounts-master', title: '🏆 Accounts Master', desc: 'Complete all accounts challenges', xp: 500, prereqs: ['batch-invoice', 'xero-sync', 'statement', 'rate-review'] },
  ],
  driver: [
    { id: 'app-install', title: '📱 App Ready', desc: 'Download and log into the driver app', xp: 25, prereqs: [] },
    { id: 'first-delivery', title: '🚗 First Delivery', desc: 'Complete your first delivery with POD', xp: 50, prereqs: ['app-install'] },
    { id: 'pod-pro', title: '📸 POD Pro', desc: 'Complete 5 deliveries with photo + signature', xp: 75, prereqs: ['first-delivery'] },
    { id: 'barcode', title: '📦 Scan Master', desc: 'Scan 10 barcodes on pickups', xp: 75, prereqs: ['first-delivery'] },
    { id: 'nav-ace', title: '🧭 Navigation Ace', desc: 'Use in-app navigation for 10 deliveries', xp: 50, prereqs: ['first-delivery'] },
    { id: 'streak-3', title: '🔥 Hot Streak', desc: 'Complete deliveries 3 days in a row', xp: 100, prereqs: ['first-delivery'] },
    { id: 'driver-master', title: '🏆 Driver Master', desc: 'Complete all driver challenges', xp: 500, prereqs: ['pod-pro', 'barcode', 'nav-ace', 'streak-3'] },
  ],
}

const LEVELS = [
  { name: 'Rookie', emoji: '🥉', min: 0, max: 100 },
  { name: 'Operator', emoji: '🥈', min: 100, max: 300 },
  { name: 'Pro', emoji: '🥇', min: 300, max: 600 },
  { name: 'Expert', emoji: '💎', min: 600, max: 1000 },
  { name: 'Master', emoji: '🏆', min: 1000, max: Infinity },
]

function getLevel(xp: number) {
  return LEVELS.find(l => xp >= l.min && xp < l.max) || LEVELS[LEVELS.length - 1]
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const ROLE_TABS = [
  { key: 'dispatcher', label: '📡 Dispatcher' },
  { key: 'admin', label: '⚙️ Admin' },
  { key: 'accounts', label: '💳 Accounts' },
  { key: 'driver', label: '🚗 Driver' },
]

const CHALLENGE_INSTRUCTIONS: Record<string, string[]> = {
  'first-job': ['1. Go to the Dispatch board', '2. Click "New Job"', '3. Fill in pickup and delivery addresses', '4. Assign a driver and click "Dispatch"'],
  'speed-10': ['1. Open the Quick Dispatch panel', '2. Use keyboard shortcuts for faster entry', '3. Dispatch 10 jobs within 5 minutes', '4. Timer starts on your first dispatch'],
  'auto-shadow': ['1. Navigate to Settings → Auto-Dispatch', '2. Enable "Shadow Mode"', '3. Review 10 AI-suggested dispatches', '4. Accept or reject each with a reason'],
  'auto-suggest': ['1. Go to Settings → Auto-Dispatch', '2. Switch from Shadow to "Suggest" mode', '3. Accept 20 AI-suggested dispatches', '4. Track your acceptance rate'],
  'multi-stop': ['1. Create a new job', '2. Click "Add Stop" to add multiple deliveries', '3. Add at least 5 delivery stops', '4. Optimize the route and dispatch'],
  'reassign': ['1. Find 3 active jobs on the dispatch board', '2. Click on each job', '3. Select "Reassign Driver"', '4. Choose a different available driver'],
  'zero-touch': ['1. Set up email parsing in Settings', '2. Configure auto-dispatch rules', '3. Send 5 test orders via email', '4. Verify they were processed automatically'],
  'dispatch-master': ['Complete all other dispatcher challenges to unlock this achievement!'],
  'add-client': ['1. Go to Clients → Add New', '2. Fill in company details', '3. Set billing preferences', '4. Save the client'],
  'rate-card': ['1. Go to Rates → Create New', '2. Set base rates and surcharges', '3. Configure zone pricing', '4. Assign to a client'],
  'zone-setup': ['1. Go to Settings → Zones', '2. Click "Create Zone"', '3. Add zip codes to the zone', '4. Set zone-specific pricing'],
  'automation-rule': ['1. Go to Settings → Automations', '2. Click "Create Rule"', '3. Set trigger conditions', '4. Create 3 different rules'],
  'kb-article': ['1. Go to Knowledge Base', '2. Click "New Article"', '3. Write helpful content for your team', '4. Publish the article'],
  'import-clients': ['1. Prepare a CSV with client data', '2. Go to Clients → Import', '3. Upload your CSV file', '4. Map columns and import 50+ clients'],
  'reporting': ['1. Go to Reports → Create', '2. Select a report type', '3. Generate and review the report', '4. Share 3 different reports'],
  'admin-master': ['Complete all other admin challenges to unlock this achievement!'],
  'first-invoice': ['1. Go to Billing → Invoices', '2. Click "Generate Invoice"', '3. Select a client and date range', '4. Review and send the invoice'],
  'batch-invoice': ['1. Go to Billing → Batch Invoice', '2. Select 10+ clients', '3. Set the billing period', '4. Generate all invoices at once'],
  'xero-sync': ['1. Connect Xero/QuickBooks in Settings', '2. Go to an invoice', '3. Click "Sync to Accounting"', '4. Verify it appears in your accounting software'],
  'statement': ['1. Go to Clients → select a client', '2. Click "Generate Statement"', '3. Review the statement', '4. Send it to the client'],
  'rate-review': ['1. Go to Clients → Rate Cards', '2. Review 5 different client rate cards', '3. Make adjustments as needed', '4. Save all changes'],
  'accounts-master': ['Complete all other accounts challenges to unlock this achievement!'],
  'app-install': ['1. Download the driver app from App/Play Store', '2. Open the app', '3. Log in with your credentials', '4. Enable location permissions'],
  'first-delivery': ['1. Accept a delivery assignment', '2. Navigate to the pickup location', '3. Pick up the package', '4. Deliver and capture proof of delivery'],
  'pod-pro': ['1. Complete 5 deliveries', '2. Take a photo at each delivery', '3. Collect a signature at each delivery', '4. Ensure all PODs are uploaded'],
  'barcode': ['1. Go to a pickup location', '2. Open the barcode scanner in the app', '3. Scan the package barcode', '4. Repeat for 10 pickups'],
  'nav-ace': ['1. Accept a delivery', '2. Tap "Navigate" in the app', '3. Use the in-app navigation', '4. Complete 10 deliveries using navigation'],
  'streak-3': ['1. Complete at least 1 delivery today', '2. Come back tomorrow and complete another', '3. Complete a delivery on the 3rd consecutive day', '4. Streak achieved!'],
  'driver-master': ['Complete all other driver challenges to unlock this achievement!'],
}

export function Step9Training() {
  const { trainingProgress, initTraining, completeChallenge, teamMembers } = useStore()
  const [leaderboardTab, setLeaderboardTab] = useState<'week' | 'all'>('all')
  const [activeRole, setActiveRole] = useState('dispatcher')
  const [selectedChallenge, setSelectedChallenge] = useState<string | null>(null)

  useEffect(() => {
    if (Object.keys(trainingProgress).length === 0) initTraining()
  }, [trainingProgress, initTraining])

  // Build leaderboard
  const leaderboard = Object.entries(trainingProgress)
    .map(([email, data]) => {
      const member = teamMembers.find(m => m.email === email)
      return { email, name: member?.name || email, role: data.role, xp: data.xp, streak: data.currentStreak, completedChallenges: data.completedChallenges }
    })
    .sort((a, b) => b.xp - a.xp)

  // Total challenges across all roles
  const allChallengeIds = Object.values(CHALLENGES).flat().map(c => c.id)
  const allCompleted = new Set(Object.values(trainingProgress).flatMap(p => p.completedChallenges))
  const teamCompletionPct = allChallengeIds.length > 0 ? Math.round((allCompleted.size / allChallengeIds.length) * 100) : 0
  const totalXp = Object.values(trainingProgress).reduce((s, p) => s + p.xp, 0)

  // Challenge status helpers
  function getChallengeStatus(challengeId: string, role: string): 'completed' | 'available' | 'locked' {
    const allCompletedSet = new Set(Object.values(trainingProgress).flatMap(p => p.completedChallenges))
    if (allCompletedSet.has(challengeId)) return 'completed'
    const challenge = CHALLENGES[role]?.find(c => c.id === challengeId)
    if (!challenge) return 'locked'
    if (challenge.prereqs.length === 0) return 'available'
    if (challenge.prereqs.every(p => allCompletedSet.has(p))) return 'available'
    return 'locked'
  }

  // Find next milestone
  function getNextMilestone(): string {
    for (const role of Object.keys(CHALLENGES)) {
      const master = CHALLENGES[role].find(c => c.id.endsWith('-master'))
      if (master && !allCompleted.has(master.id)) {
        const remaining = master.prereqs.filter(p => !allCompleted.has(p)).length
        if (remaining > 0) return `${remaining} more challenge${remaining > 1 ? 's' : ''} to unlock ${master.title}`
      }
    }
    return 'All milestones reached! 🎉'
  }

  const selectedChallengeData = selectedChallenge
    ? Object.values(CHALLENGES).flat().find(c => c.id === selectedChallenge)
    : null

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-navy">🏋️ Training Arena</h2>
        <p className="text-gray-500 mt-1">Level up your team with gamified challenges and track progress</p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Team Progress', value: `${teamCompletionPct}%`, sub: 'challenges completed' },
          { label: 'Total XP', value: totalXp.toLocaleString(), sub: 'earned by team' },
          { label: 'Team Members', value: leaderboard.length.toString(), sub: 'in training' },
          { label: 'Next Milestone', value: '🎯', sub: getNextMilestone() },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">{stat.label}</div>
            <div className="text-2xl font-bold text-navy mt-1">{stat.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-navy">🏆 Leaderboard</h3>
          <div className="flex bg-gray-100 rounded-full p-0.5">
            {(['week', 'all'] as const).map(tab => (
              <button key={tab} onClick={() => setLeaderboardTab(tab)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${leaderboardTab === tab ? 'bg-white text-navy shadow-sm' : 'text-gray-400'}`}>
                {tab === 'week' ? 'This Week' : 'All Time'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {leaderboard.map((member, i) => {
            const level = getLevel(member.xp)
            const nextLevel = LEVELS[LEVELS.indexOf(level) + 1]
            const progress = nextLevel ? ((member.xp - level.min) / (nextLevel.min - level.min)) * 100 : 100
            return (
              <div key={member.email} className={`relative rounded-2xl p-4 border-2 transition-all ${i === 0 ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.15)]' : 'border-gray-100'}`}>
                {i === 0 && <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl">👑</div>}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-navy text-white flex items-center justify-center text-sm font-bold">{getInitials(member.name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-navy text-sm truncate">{member.name}</div>
                    <div className="text-xs text-gray-400">{member.role}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg">{level.emoji}</div>
                    <div className="text-[10px] text-gray-400">{level.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #3bc7f4, #1a6fb5)' }} />
                  </div>
                  <span className="text-xs font-bold text-navy">{member.xp} XP</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>{member.completedChallenges.length} challenges</span>
                  {member.streak > 0 && <span className="animate-pulse">🔥 {member.streak} day streak</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Skill Paths */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-navy mb-4">🎮 Skill Paths</h3>
        <div className="flex gap-2 mb-6">
          {ROLE_TABS.map(tab => (
            <button key={tab.key} onClick={() => { setActiveRole(tab.key); setSelectedChallenge(null) }}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition ${activeRole === tab.key ? 'bg-navy text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CHALLENGES[activeRole]?.map((challenge, i) => {
            const status = getChallengeStatus(challenge.id, activeRole)
            return (
              <div key={challenge.id} className="relative">
                {/* Connector line */}
                {i > 0 && i < (CHALLENGES[activeRole]?.length || 0) && (
                  <div className="hidden lg:block absolute -left-4 top-1/2 w-4 border-t-2 border-dashed border-gray-200" />
                )}
                <div onClick={() => status !== 'locked' && setSelectedChallenge(challenge.id)}
                  className={`rounded-2xl p-4 border-2 cursor-pointer transition-all h-full ${
                    status === 'completed' ? 'border-navy bg-navy/5' :
                    status === 'available' ? 'border-cyan/50 bg-white hover:border-cyan hover:shadow-md' :
                    'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                  } ${selectedChallenge === challenge.id ? 'ring-2 ring-cyan ring-offset-2' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-2xl">{challenge.title.split(' ')[0]}</span>
                    {status === 'completed' && <span className="text-green-500">✅</span>}
                    {status === 'locked' && <span>🔒</span>}
                  </div>
                  <div className="font-semibold text-sm text-navy mb-1">{challenge.title.split(' ').slice(1).join(' ')}</div>
                  <p className="text-xs text-gray-400 mb-3">{challenge.desc}</p>
                  <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                    status === 'completed' ? 'bg-navy/10 text-navy' : 'bg-cyan/10 text-cyan'
                  }`}>
                    ⭐ {challenge.xp} XP
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Active Challenge Detail */}
      {selectedChallengeData && (
        <div className="bg-white rounded-2xl shadow-sm border-2 border-cyan/30 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-navy">{selectedChallengeData.title}</h3>
              <p className="text-sm text-gray-500">{selectedChallengeData.desc}</p>
            </div>
            <button onClick={() => setSelectedChallenge(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-sm text-navy mb-3">📋 Steps</h4>
              <div className="space-y-2">
                {(CHALLENGE_INSTRUCTIONS[selectedChallengeData.id] || ['Complete the challenge to earn XP!']).map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400 flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span>{step.replace(/^\d+\.\s*/, '')}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">Reward</div>
                <div className="text-2xl font-bold text-navy">⭐ {selectedChallengeData.xp} XP</div>
              </div>
              {getChallengeStatus(selectedChallengeData.id, activeRole) === 'completed' ? (
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-1">✅</div>
                  <div className="text-sm font-semibold text-green-700">Challenge Complete!</div>
                </div>
              ) : (
                <button onClick={() => {
                  const email = leaderboard[0]?.email
                  if (email) {
                    completeChallenge(email, selectedChallengeData.id)
                    setSelectedChallenge(null)
                  }
                }} className="w-full py-3 rounded-xl bg-cyan text-white font-semibold text-sm hover:bg-cyan/90 transition shadow-lg shadow-cyan/20">
                  🚀 Start Challenge
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
