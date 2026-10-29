import { useState, useEffect } from 'react'
import { Avatar, Badge, Box, Button, CloseButton, Container, Group, Paper, Progress, SegmentedControl, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { FileUp } from 'lucide-react'
import { useStore } from '../../store'
import * as api from '../../lib/api'
import { SmartImport } from '../SmartImport'
import classes from './TrainingStep.module.css'

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

export function TrainingStep() {
  const { trainingProgress, initTraining, completeChallenge, teamMembers } = useTraining()
  const [leaderboardTab, setLeaderboardTab] = useState<'week' | 'all'>('all')
  const [activeRole, setActiveRole] = useState('dispatcher')
  const [selectedChallenge, setSelectedChallenge] = useState<string | null>(null)

  // initTraining only adds people who aren't on the board yet, so it's safe to call whenever the team changes.
  const memberKey = teamMembers.map(m => m.email).join('|')
  useEffect(() => {
    if (memberKey) initTraining()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the set of people changes
  }, [memberKey])

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

  const [showSmartImport, setShowSmartImport] = useState(false)

  return (
    <Container size="lg" p={0}>
      <Stack gap={32}>
        <div>
          <Title order={2}>🏋️ Training Arena</Title>
          <Text c="dimmed" mt={4}>Level up your team with gamified challenges and track progress</Text>
        </div>

        <Button fullWidth size="md" leftSection={<FileUp size={18} strokeWidth={1.5} />} onClick={() => setShowSmartImport(true)}>
          Smart Import training roster from your old TMS
        </Button>
        {showSmartImport && (
          <SmartImport entityType="team" onComplete={() => { setShowSmartImport(false); useStore.getState().reload() }} onClose={() => setShowSmartImport(false)} />
        )}

        {/* Stats Bar */}
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
          {[
            { label: 'Team Progress', value: `${teamCompletionPct}%`, sub: 'challenges completed' },
            { label: 'Total XP', value: totalXp.toLocaleString(), sub: 'earned by team' },
            { label: 'Team Members', value: leaderboard.length.toString(), sub: 'in training' },
            { label: 'Next Milestone', value: '🎯', sub: getNextMilestone() },
          ].map((stat, i) => (
            <Paper key={i} p="md" withBorder>
              <Text size="xs" c="dimmed" fw={500} tt="uppercase" lts={0.5}>{stat.label}</Text>
              <Text fz={24} fw={700} mt={4}>{stat.value}</Text>
              <Text size="xs" c="dimmed" mt={2}>{stat.sub}</Text>
            </Paper>
          ))}
        </SimpleGrid>

        {/* Leaderboard */}
        <Paper p="lg" withBorder>
          <Group justify="space-between" mb="md">
            <Title order={3} fz="lg">🏆 Leaderboard</Title>
            <SegmentedControl
              size="xs"
              value={leaderboardTab}
              onChange={v => setLeaderboardTab(v as 'week' | 'all')}
              data={[{ value: 'week', label: 'This Week' }, { value: 'all', label: 'All Time' }]}
            />
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {leaderboard.map((member, i) => {
              const level = getLevel(member.xp)
              const nextLevel = LEVELS[LEVELS.indexOf(level) + 1]
              const progress = nextLevel ? ((member.xp - level.min) / (nextLevel.min - level.min)) * 100 : 100
              return (
                <Paper key={member.email} p="md" pos="relative"
                  style={{ border: `2px solid ${i === 0 ? 'var(--mantine-color-orange-filled)' : 'var(--dd-outline-variant)'}` }}>
                  {i === 0 && <div className={classes.crown}>👑</div>}
                  <Group gap="sm" mb="sm" wrap="nowrap">
                    <Avatar size={40} bg="var(--mantine-color-black)" c="white" fw={700}>{getInitials(member.name)}</Avatar>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={600} truncate>{member.name}</Text>
                      <Text size="xs" c="dimmed">{member.role}</Text>
                    </Box>
                    <Box ta="right">
                      <Text fz="lg" lh={1.4}>{level.emoji}</Text>
                      <Text fz={10} c="dimmed">{level.name}</Text>
                    </Box>
                  </Group>
                  <Group gap="xs" mb={4} wrap="nowrap">
                    <Progress value={progress} size="sm" style={{ flex: 1 }} aria-label={`${member.name} level progress`} />
                    <Text size="xs" fw={700}>{member.xp} XP</Text>
                  </Group>
                  <Group justify="space-between" fz={10} c="dimmed">
                    <span>{member.completedChallenges.length} challenges</span>
                    {member.streak > 0 && <span className={classes.pulse}>🔥 {member.streak} day streak</span>}
                  </Group>
                </Paper>
              )
            })}
          </SimpleGrid>
        </Paper>

        {/* Skill Paths */}
        <Paper p="lg" withBorder>
          <Title order={3} fz="lg" mb="md">🎮 Skill Paths</Title>
          <SegmentedControl
            mb="lg"
            value={activeRole}
            onChange={v => { setActiveRole(v); setSelectedChallenge(null) }}
            data={ROLE_TABS.map(t => ({ value: t.key, label: t.label }))}
          />
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            {CHALLENGES[activeRole]?.map((challenge, i) => {
              const status = getChallengeStatus(challenge.id, activeRole)
              return (
                <Box key={challenge.id} pos="relative">
                  {/* Connector line */}
                  {i > 0 && i < (CHALLENGES[activeRole]?.length || 0) && <div className={classes.connector} />}
                  <div onClick={() => status !== 'locked' && setSelectedChallenge(challenge.id)}
                    className={`${classes.challenge} ${classes[status]} ${selectedChallenge === challenge.id ? classes.selected : ''}`}>
                    <Group justify="space-between" align="flex-start" mb={8} wrap="nowrap">
                      <Text fz={24}>{challenge.title.split(' ')[0]}</Text>
                      {status === 'completed' && <Text c="var(--mantine-color-green-text)">✅</Text>}
                      {status === 'locked' && <span>🔒</span>}
                    </Group>
                    <Text size="sm" fw={600} mb={4}>{challenge.title.split(' ').slice(1).join(' ')}</Text>
                    <Text size="xs" c="dimmed" mb="sm">{challenge.desc}</Text>
                    <Badge variant="light" tt="none" color={status === 'completed' ? 'gray' : undefined}>
                      ⭐ {challenge.xp} XP
                    </Badge>
                  </div>
                </Box>
              )
            })}
          </SimpleGrid>
        </Paper>

        {/* Active Challenge Detail */}
        {selectedChallengeData && (
          <Paper p="lg" style={{ border: '2px solid color-mix(in srgb, var(--mantine-primary-color-filled) 30%, transparent)' }}>
            <Group justify="space-between" align="flex-start" mb="md" wrap="nowrap">
              <div>
                <Title order={3} fz="lg">{selectedChallengeData.title}</Title>
                <Text size="sm" c="dimmed">{selectedChallengeData.desc}</Text>
              </div>
              <CloseButton aria-label="Close challenge" onClick={() => setSelectedChallenge(null)} />
            </Group>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
              <div>
                <Title order={4} fz="sm" mb="sm">📋 Steps</Title>
                <Stack gap={8}>
                  {(CHALLENGE_INSTRUCTIONS[selectedChallengeData.id] || ['Complete the challenge to earn XP!']).map((step, i) => (
                    <Group key={i} gap={8} align="flex-start" wrap="nowrap">
                      <ThemeIcon radius="xl" size={20} variant="light" color="gray" fz={10} fw={700} mt={2}>{i + 1}</ThemeIcon>
                      <Text size="sm" c="dimmed">{step.replace(/^\d+\.\s*/, '')}</Text>
                    </Group>
                  ))}
                </Stack>
              </div>
              <Stack gap="md">
                <Box bg="var(--dd-surface)" p="md" bdrs="md">
                  <Text size="xs" c="dimmed" mb={4}>Reward</Text>
                  <Text fz={24} fw={700}>⭐ {selectedChallengeData.xp} XP</Text>
                </Box>
                {getChallengeStatus(selectedChallengeData.id, activeRole) === 'completed' ? (
                  <Box bg="var(--mantine-color-green-light)" p="md" bdrs="md" ta="center">
                    <Text fz={24} mb={4}>✅</Text>
                    <Text size="sm" fw={600} c="var(--mantine-color-green-text)">Challenge Complete!</Text>
                  </Box>
                ) : (
                  <Button onClick={() => {
                    const email = leaderboard[0]?.email
                    if (email) {
                      completeChallenge(email, selectedChallengeData.id)
                      setSelectedChallenge(null)
                    }
                  }} fullWidth size="md">
                    Start challenge
                  </Button>
                )}
              </Stack>
            </SimpleGrid>
          </Paper>
        )}
      </Stack>
    </Container>
  )
}


/**
 * Adapts the session (team.people + training) to the shape this screen was built on.
 * Progress is kept on the server per tenant session.
 */
function useTraining() {
  const session = useStore(s => s.session)
  const reload = useStore(s => s.reload)
  const people = session?.team.people ?? []
  const teamMembers = people
    .filter(p => p.email)
    .map(p => ({ name: [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email!, email: p.email!, role: p.roleName || 'Staff' }))
  const trainingProgress: Record<string, { xp: number; completedChallenges: string[]; currentStreak: number; lastActive?: string; role?: string }> = {}
  for (const m of session?.training ?? []) {
    trainingProgress[m.userEmail] = { xp: m.xp, completedChallenges: m.completedChallenges, currentStreak: m.currentStreak, lastActive: m.lastActive, role: m.role }
  }

  const initTraining = () => {
    if (!session) return
    const known = new Set((session.training ?? []).map(m => m.userEmail))
    const added = teamMembers.filter(m => !known.has(m.email))
      .map(m => ({ userEmail: m.email, userName: m.name, role: m.role, xp: 0, completedChallenges: [], currentStreak: 0 }))
    if (added.length === 0) return
    api.saveTraining(session.id, [...(session.training ?? []), ...added]).then(reload).catch(() => { /* retried next visit */ })
  }

  const completeChallenge = (email: string, challengeId: string) => {
    if (!session) return
    const xp = Object.values(CHALLENGES).flat().find(c => c.id === challengeId)?.xp ?? 0
    api.completeChallenge(session.id, email, challengeId, xp).then(reload).catch(() => { /* shown on next load */ })
  }

  return { trainingProgress, initTraining, completeChallenge, teamMembers }
}
