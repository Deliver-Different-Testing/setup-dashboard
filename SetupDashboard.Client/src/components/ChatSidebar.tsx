import { useEffect, useRef, useState } from 'react'
import { ActionIcon, Avatar, Box, Flex, Group, Indicator, Stack, Text as MText, TextInput, Tooltip } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { PanelLeftClose, SendHorizontal } from 'lucide-react'
import { useStore } from '../store'
import * as api from '../lib/api'
import { CHAT_MESSAGES } from '../data/chatMessages'
import classes from './ChatSidebar.module.css'

const OPEN_KEY = 'setup-dashboard.chat-open'
const readOpen = () => { try { const v = localStorage.getItem(OPEN_KEY); return v === null ? null : v === '1' } catch { return null } }

export function ChatSidebar() {
  const {
    currentStep, chatHistory, addChatMessage, patchChatMessage, shownChatSteps, markChatStepShown,
    autoMateSessionId, setAutoMateSessionId,
  } = useStore()
  const [input, setInput] = useState('')
  const [asking, setAsking] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)

  // Wide screens remember the reader's choice and start open. Narrow screens always start closed and
  // open over the page, so a choice made on a desktop doesn't cover a phone.
  const narrow = useMediaQuery('(max-width: 62em)', false, { getInitialValueInEffect: false })
  const [widePref, setWidePref] = useState<boolean | null>(readOpen)
  const [narrowOpen, setNarrowOpen] = useState(false)
  const open = narrow ? narrowOpen : widePref ?? true
  // Messages that arrive while closed light a dot on the rail.
  const [seen, setSeen] = useState(chatHistory.length)
  const unread = !open && chatHistory.length > seen
  const setOpen = (v: boolean) => {
    if (!v) setSeen(chatHistory.length)
    if (narrow) { setNarrowOpen(v); return }
    setWidePref(v)
    try { localStorage.setItem(OPEN_KEY, v ? '1' : '0') } catch { /* storage blocked - the choice lasts this visit */ }
  }

  useEffect(() => {
    if (shownChatSteps.has(currentStep)) return
    markChatStepShown(currentStep)
    const msgs = CHAT_MESSAGES[currentStep] || []
    msgs.forEach((text, i) => {
      setTimeout(() => addChatMessage({ from: 'bot', text }), (i + 1) * 600)
    })
  }, [currentStep, shownChatSteps, markChatStepShown, addChatMessage])

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [chatHistory, open])

  // Questions are answered from the Knowledge Base by the Customer Success Platform, streamed in as they're written.
  const sendChat = async () => {
    const text = input.trim()
    if (!text || asking) return
    addChatMessage({ from: 'user', text })
    setInput('')
    setAsking(true)
    addChatMessage({ from: 'bot', text: '', status: 'Thinking…' })
    const index = useStore.getState().chatHistory.length - 1
    await api.askAutoMate(text, autoMateSessionId, e => {
      if (e.sessionId) setAutoMateSessionId(e.sessionId)
      if (e.status) patchChatMessage(index, m => ({ ...m, status: e.status }))
      if (e.delta) patchChatMessage(index, m => ({ ...m, text: m.text + e.delta, status: undefined }))
      if (e.error) patchChatMessage(index, m => ({ ...m, text: m.text ? `${m.text}\n\n${e.error}` : e.error!, status: undefined, error: true }))
    })
    patchChatMessage(index, m => ({ ...m, status: undefined }))
    setAsking(false)
  }

  if (!open) {
    return (
      <Flex component="aside" aria-label="Auto-Mate" direction="column" align="center" w={56} miw={56} py="sm"
        bg="var(--dd-surface-container)" style={{ borderRight: '1px solid var(--dd-outline-variant)' }}>
        <Tooltip label={unread ? 'Open Auto-Mate - new message' : 'Open Auto-Mate'} position="right">
          <Indicator disabled={!unread} color="grape" size={10} offset={4} withBorder>
            <ActionIcon variant="subtle" size={44} radius="xl" onClick={() => setOpen(true)}
              aria-label={unread ? 'Open Auto-Mate, new message' : 'Open Auto-Mate'} aria-expanded={false}>
              <Avatar src={`${import.meta.env.BASE_URL}auto-mate-icon-light.png`} alt="" size={36} />
            </ActionIcon>
          </Indicator>
        </Tooltip>
      </Flex>
    )
  }

  return (
    <>
    {narrow && <Box pos="absolute" inset={0} bg="rgba(0, 0, 0, 0.4)" style={{ zIndex: 199 }} onClick={() => setOpen(false)} aria-hidden />}
    <Flex component="aside" aria-label="Auto-Mate" direction="column" w={narrow ? 'min(340px, calc(100vw - 48px))' : 340} miw={narrow ? undefined : 340}
      bg="var(--dd-surface-container)"
      onKeyDown={narrow ? e => e.key === 'Escape' && setOpen(false) : undefined}
      style={{ borderRight: '1px solid var(--dd-outline-variant)', ...(narrow ? { position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 200, boxShadow: 'var(--mantine-shadow-lg)' } : null) }}>
      <Group gap="sm" px="md" py="sm" wrap="nowrap" style={{ borderBottom: '1px solid var(--dd-outline-variant)' }}>
        <Avatar src={`${import.meta.env.BASE_URL}auto-mate-icon-light.png`} alt="Auto-Mate" size={40} />
        <div>
          <MText size="sm" fw={600}>Auto-Mate</MText>
          <MText fz={11} c="dimmed">Your setup guide</MText>
        </div>
        <Box ml="auto" w={8} h={8} bdrs="50%" bg="var(--mantine-color-green-filled)" />
        <Tooltip label="Hide Auto-Mate">
          <ActionIcon variant="subtle" color="gray" onClick={() => setOpen(false)} aria-label="Hide Auto-Mate" aria-expanded>
            <PanelLeftClose size={18} strokeWidth={1.5} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <Stack ref={messagesRef} flex={1} p="md" gap="sm" style={{ overflowY: 'auto' }}>
        {chatHistory.map((m, i) => m.from === 'bot' ? (
          <Group key={i} gap={8} align="flex-end" wrap="nowrap">
            <Avatar src={`${import.meta.env.BASE_URL}auto-mate-icon-light.png`} alt="Auto-Mate" size={28} style={{ flexShrink: 0 }} />
            <div className={`${classes.bubble} ${classes.bot}`} aria-live={m.status ? 'polite' : undefined}>
              {m.text || <MText span size="sm" c="dimmed" fs="italic">{m.status}</MText>}
            </div>
          </Group>
        ) : (
          <Group key={i} justify="flex-end">
            <div className={`${classes.bubble} ${classes.user}`}>{m.text}</div>
          </Group>
        ))}
      </Stack>
      <Box p="sm" style={{ borderTop: '1px solid var(--dd-outline-variant)' }}>
        <Group gap={8} wrap="nowrap">
          <TextInput
            style={{ flex: 1 }}
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
            placeholder="Ask a setup question"
            aria-label="Message Auto-Mate"
          />
          {/* Auto-Mate is an AI surface: the grape accent, not the brand cyan. */}
          <ActionIcon onClick={sendChat} loading={asking} color="grape" size="input-sm" aria-label="Send message">
            <SendHorizontal size={16} strokeWidth={1.5} />
          </ActionIcon>
        </Group>
      </Box>
    </Flex>
    </>
  )
}
