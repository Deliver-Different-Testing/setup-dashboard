import type { ReactNode } from 'react'
import type { StepKey } from '../../lib/api'
import { StepFrame } from '../StepFrame'

/**
 * Steps whose work happens on another app's own screens (Settings Automations,
 * Integration Manager, Admin Setup). The dashboard tracks them; it doesn't write them.
 */
export function ChecklistStep({ step, title, intro }: { step: StepKey; title: string; intro: ReactNode }) {
  return <StepFrame step={step} title={title} intro={intro} />
}

export const AutomationsStep = () => (
  <ChecklistStep step="automations" title="Automations"
    intro={<>Notifications and auto-assign rules are built in Settings &gt; Automations, where the tenant's own job statuses and templates are
      available. Rules go live as soon as you save them there, so set them up after rates and schedules.</>} />
)

export const IntegrationsStep = () => (
  <ChecklistStep step="integrations" title="Integrations"
    intro={<>Make carrier, Shopify, partner and other connections in Integration Manager. Tick each one here once it's connected.</>} />
)

export const AppConfigStep = () => (
  <ChecklistStep step="appconfig" title="App configuration"
    intro={<>Set up catalogues (note and document types, quizzes), dispatch settings, the sign-up page and consumer booking in Settings &gt; Admin Setup.</>} />
)
