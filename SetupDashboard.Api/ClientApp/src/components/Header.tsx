import { useEffect, useState } from 'react'
import { ActionIcon, Badge, Box, Group, Menu, Progress, Text, Tooltip } from '@mantine/core'
import { Monitor, Moon, Sun } from 'lucide-react'
import { completionPercent, openRequestCount, useStore } from '../store'
import * as api from '../lib/api'
import { PdfSummary } from './PdfSummary'
import { useColorMode } from '../hooks/colorModeContext'
import type { ColorModePreference } from '../hooks/colorModeContext'

const MODES: { value: ColorModePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'Match my device', Icon: Monitor },
]

/** Light / dark / system. The Ink app bar stays Ink in both modes. */
function ColorModeMenu() {
  const { mode, preference, setPreference } = useColorMode()
  const Current = preference === 'system' ? Monitor : mode === 'dark' ? Moon : Sun
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Tooltip label="Appearance">
          <ActionIcon variant="subtle" color="gray" c="white" size="lg" aria-label="Appearance">
            <Current size={18} strokeWidth={1.5} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        {MODES.map(({ value, label, Icon }) => (
          <Menu.Item key={value} leftSection={<Icon size={16} strokeWidth={1.5} />} onClick={() => setPreference(value)}
            fw={preference === value ? 600 : undefined}>
            {label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}

export function Header() {
  const session = useStore(s => s.session)
  const me = useStore(s => s.me)
  const [logo, setLogo] = useState<string | null>(null)
  const waiting = openRequestCount(session)
  const pct = completionPercent(session)

  useEffect(() => { api.getTenantLogo().then(r => setLogo(r.logoUrl)).catch(() => setLogo(null)) }, [])

  return (
    <Group component="header" bg="var(--mantine-color-black)" c="white" px="lg" py="sm" justify="space-between" wrap="nowrap" pos="relative" style={{ zIndex: 50 }}>
      <Group gap="md" wrap="nowrap">
        <img src={`${import.meta.env.BASE_URL}dfrnt-logo.png`} alt="DFRNT - Deliver Different" style={{ height: 28 }} />
        <Box w={1} h={24} bg="rgba(255,255,255,0.2)" />
        {logo && <img src={logo} alt="" style={{ height: 28, borderRadius: 4, background: 'rgba(255,255,255,0.9)', padding: '0 4px' }} />}
        <div>
          <Text size="sm" fw={600} c="white">{session?.business.companyName || session?.tenantCode || 'New tenant setup'}</Text>
          <Text fz={11} c="rgba(255,255,255,0.6)">{me?.name}{me?.isDfAdmin ? ' · DFRNT' : ''}</Text>
        </div>
      </Group>
      <Group gap="md" wrap="nowrap">
        {waiting > 0 && (
          <Tooltip label="Requests DFRNT has sent to the tenant">
            <Badge color="yellow" variant="light" size="lg" tt="none">
              Waiting on {session?.business.companyName || 'tenant'}: {waiting}
            </Badge>
          </Tooltip>
        )}
        <Group gap="xs" wrap="nowrap">
          <Progress value={pct} w={112} size="sm" bg="rgba(255,255,255,0.15)" aria-label="Setup progress" />
          <Text size="xs" c="rgba(255,255,255,0.7)">{pct}% done</Text>
        </Group>
        <PdfSummary />
        <ColorModeMenu />
      </Group>
    </Group>
  )
}
