import { Box, Container } from '@mantine/core'
import { Check, Hourglass } from 'lucide-react'
import { STEPS, useStore } from '../store'
import classes from './ProgressBar.module.css'

const STATUS_TEXT = { done: 'done', waiting_on_tenant: 'waiting on the tenant', in_progress: 'in progress', not_started: 'not started' } as const

export function ProgressBar() {
  const session = useStore(s => s.session)
  const currentStep = useStore(s => s.currentStep)
  const setCurrentStep = useStore(s => s.setCurrentStep)
  if (!session) return null

  return (
    <Box px={32} pt={24} pb={8}>
      <Container size="lg" p={0} className={classes.track} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className={classes.line} />
        {STEPS.map((s, i) => {
          const st = session.steps[s.key]
          const status = st?.status ?? 'not_started'
          const waiting = st?.requests.some(r => !r.fulfilledAt)
          const isCurrent = i === currentStep
          const ring = status === 'done' ? classes.done
            : status === 'waiting_on_tenant' ? classes.waiting
            : status === 'in_progress' ? classes.active
            : classes.idle
          const Icon = s.icon
          return (
            <button key={s.key} type="button" className={classes.step} onClick={() => setCurrentStep(i)}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`${s.title}, ${waiting ? 'waiting on the tenant' : STATUS_TEXT[status]}`}
              title={waiting ? 'Waiting on tenant' : undefined}>
              {/* Every step keeps its own icon in the one colour; state is the ring plus a corner badge. */}
              <div className={`${classes.circle} ${ring} ${isCurrent ? classes.current : ''}`}>
                <Icon size={20} strokeWidth={1.5} aria-hidden />
                {status === 'done' && <span className={`${classes.badge} ${classes.badgeDone}`}><Check size={10} strokeWidth={3} aria-hidden /></span>}
                {status !== 'done' && waiting && <span className={`${classes.badge} ${classes.badgeWaiting}`}><Hourglass size={10} strokeWidth={2.5} aria-hidden /></span>}
              </div>
              <span className={`${classes.label} ${isCurrent ? classes.labelCurrent : ''}`}>{s.short}</span>
            </button>
          )
        })}
      </Container>
    </Box>
  )
}
