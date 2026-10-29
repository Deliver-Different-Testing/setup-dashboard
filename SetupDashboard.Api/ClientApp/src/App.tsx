import { useEffect, type ComponentType } from 'react'
import { Box, Button, Center, Container, Flex, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { STEPS, useStore } from './store'
import type { StepKey } from './lib/api'
import { Header } from './components/Header'
import { ResumeSession } from './components/ResumeSession'
import { ProgressBar } from './components/ProgressBar'
import { ChatSidebar } from './components/ChatSidebar'
import { BusinessStep } from './components/steps/BusinessStep'
import { TeamStep } from './components/steps/TeamStep'
import { ClientsStep } from './components/steps/ClientsStep'
import { RatesStep } from './components/steps/RatesStep'
import { SchedulesStep } from './components/steps/SchedulesStep'
import { CouriersStep } from './components/steps/CouriersStep'
import { PartnersStep } from './components/steps/PartnersStep'
import { AppConfigStep, AutomationsStep, IntegrationsStep } from './components/steps/ChecklistStep'
import { TrainingStep } from './components/steps/TrainingStep'

const SCREENS: Record<StepKey, ComponentType> = {
  business: BusinessStep,
  team: TeamStep,
  clients: ClientsStep,
  rates: RatesStep,
  schedules: SchedulesStep,
  couriers: CouriersStep,
  partners: PartnersStep,
  automations: AutomationsStep,
  integrations: IntegrationsStep,
  appconfig: AppConfigStep,
  training: TrainingStep,
}

function App() {
  const { init, isInitializing, fatal, session, currentStep, setCurrentStep } = useStore()

  useEffect(() => { init() }, [init])

  if (isInitializing) {
    return (
      <Center pos="fixed" inset={0} bg="var(--mantine-color-body)">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Title order={3}>Opening your setup…</Title>
        </Stack>
      </Center>
    )
  }
  if (fatal) {
    return (
      <Center pos="fixed" inset={0} p="lg" bg="var(--mantine-color-body)">
        <Paper p="lg" maw={448} ta="center">
          <Text fw={600}>Setup - Deliver DFRNT couldn't start</Text>
          <Text size="sm" c="dimmed" mt={8}>{fatal}</Text>
        </Paper>
      </Center>
    )
  }

  const step = STEPS[currentStep] ?? STEPS[0]
  const Screen = SCREENS[step.key]

  return (
    <Box mih="100vh" bg="var(--mantine-color-body)">
      <ResumeSession />
      <Header />
      <Flex h="calc(100vh - 60px)">
        <ChatSidebar />
        <Box component="main" style={{ flex: 1, overflowY: 'auto' }}>
          <ProgressBar />
          {session && (
            <Box px={32} pb={40} pt="md">
              <Screen key={step.key} />
              <Container size="lg" p={0} mt={32}>
                <Group justify="space-between">
                  {currentStep > 0
                    ? <Button variant="default" leftSection={<ArrowLeft size={16} strokeWidth={1.5} />} onClick={() => setCurrentStep(currentStep - 1)}>Back to {STEPS[currentStep - 1].short}</Button>
                    : <div />}
                  {currentStep < STEPS.length - 1 &&
                    <Button rightSection={<ArrowRight size={16} strokeWidth={1.5} />} onClick={() => setCurrentStep(currentStep + 1)}>Next: {STEPS[currentStep + 1].short}</Button>}
                </Group>
              </Container>
            </Box>
          )}
        </Box>
      </Flex>
    </Box>
  )
}

export default App
