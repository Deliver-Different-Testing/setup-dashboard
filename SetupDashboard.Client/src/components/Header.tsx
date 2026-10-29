import { useEffect, useState } from 'react'
import { ActionIcon, Badge, Box, Group, Menu, Progress, Text, Tooltip, useMantineTheme } from '@mantine/core'
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

/** Light / dark / system. The app bar keeps its shell colour (tenant primary, else Ink) in both modes. */
function ColorModeMenu() {
  const { mode, preference, setPreference } = useColorMode()
  const { scrim } = useMantineTheme().other
  const Current = preference === 'system' ? Monitor : mode === 'dark' ? Moon : Sun
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Tooltip label="Appearance">
          <ActionIcon variant="subtle" color="gray" c={scrim.text} size="lg" aria-label="Appearance">
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
  // The bar is the tenant's Branding primary (else Ink); scrim is Ink or white to read on it.
  const { shell, scrim } = useMantineTheme().other

  useEffect(() => { api.getTenantLogo().then(r => setLogo(r.logoUrl)).catch(() => setLogo(null)) }, [])

  return (
    <Group component="header" bg={shell.appBar} c={scrim.text} px="lg" py="sm" justify="space-between" wrap="nowrap" pos="relative" style={{ zIndex: 50 }}>
      <Group gap="md" wrap="nowrap">
        <img src={`${import.meta.env.BASE_URL}${shell.logoSrc}`} alt="DFRNT - Deliver Different" style={{ height: 28 }} />
        <Box w={1} h={24} bg={scrim.fillStrong} />
        {logo && <img src={logo} alt="" style={{ height: 28, borderRadius: 4, background: 'rgba(255,255,255,0.9)', padding: '0 4px' }} />}
        <div>
          <Text size="sm" fw={600} c={scrim.text}>{session?.business.companyName || session?.tenantCode || 'New tenant setup'}</Text>
          <Text fz={11} c={scrim.mutedText}>{me?.name}{me?.isDfAdmin ? ' · DFRNT' : ''}</Text>
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
          <Progress value={pct} w={112} size="sm" bg={scrim.fill} aria-label="Setup progress" />
          <Text size="xs" c={scrim.mutedText}>{pct}% done</Text>
        </Group>
        <PdfSummary />
        <ColorModeMenu />
      </Group>
    </Group>
  )
}
