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
      available. Rules go live as soon as they're saved there, so set them up once rates and schedules are in.</>} />
)

export const IntegrationsStep = () => (
  <ChecklistStep step="integrations" title="Integrations"
    intro={<>Carriers, Shopify, partner links and other connections are made in Integration Manager. Tick each off here as it's connected.</>} />
)

export const AppConfigStep = () => (
  <ChecklistStep step="appconfig" title="App configuration"
    intro={<>Catalogues (note and document types, quizzes), dispatch settings, the sign-up page and consumer booking are set in Settings &gt; Admin Setup.</>} />
)
