import { useEffect, useState } from 'react'
import { ActionIcon, Badge, Menu, Progress, Tooltip } from '@mantine/core'
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
        <Tooltip label="Light or dark">
          <ActionIcon variant="subtle" color="gray" c="white" size="lg" aria-label="Light or dark">
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
    <header className="bg-shell text-white px-6 py-3 flex items-center justify-between relative z-50">
      <div className="flex items-center gap-4">
        <img src={`${import.meta.env.BASE_URL}dfrnt-logo.png`} alt="DFRNT - Deliver Different" className="h-7" />
        <div className="h-6 w-px bg-white/20" />
        {logo && <img src={logo} alt="" className="h-7 rounded bg-white/90 px-1" />}
        <div>
          <div className="text-sm font-semibold">{session?.business.companyName || session?.tenantCode || 'New tenant setup'}</div>
          <div className="text-[11px] text-white/60">{me?.name}{me?.isDfAdmin ? ' · DFRNT' : ''}</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {waiting > 0 && (
          <Tooltip label="Things DFRNT has asked the tenant for">
            <Badge color="yellow" variant="light" size="lg" tt="none">
              Waiting on {session?.business.companyName || 'tenant'}: {waiting}
            </Badge>
          </Tooltip>
        )}
        <div className="flex items-center gap-2">
          <Progress value={pct} w={112} size="sm" bg="rgba(255,255,255,0.15)" aria-label="Setup progress" />
          <span className="text-xs text-white/70">{pct}% done</span>
        </div>
        <PdfSummary />
        <ColorModeMenu />
      </div>
    </header>
  )
}
