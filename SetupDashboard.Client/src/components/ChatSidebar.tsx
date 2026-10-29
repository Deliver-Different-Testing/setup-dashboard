import { useEffect, useRef, useState } from 'react'
import { ActionIcon, Avatar, Box, Flex, Group, Stack, Text as MText, TextInput } from '@mantine/core'
import { SendHorizontal } from 'lucide-react'
import { useStore } from '../store'
import * as api from '../lib/api'
import { CHAT_MESSAGES } from '../data/chatMessages'
import classes from './ChatSidebar.module.css'

export function ChatSidebar() {
  const {
    currentStep, chatHistory, addChatMessage, patchChatMessage, shownChatSteps, markChatStepShown,
    autoMateSessionId, setAutoMateSessionId,
  } = useStore()
  const [input, setInput] = useState('')
  const [asking, setAsking] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)

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
  }, [chatHistory])

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

  return (
    <Flex component="aside" direction="column" w={340} miw={340} bg="var(--dd-surface-container)"
      style={{ borderRight: '1px solid var(--dd-outline-variant)' }}>
      <Group gap="sm" px="md" py="sm" wrap="nowrap" style={{ borderBottom: '1px solid var(--dd-outline-variant)' }}>
        <Avatar src={`${import.meta.env.BASE_URL}auto-mate-icon-light.png`} alt="Auto-Mate" size={40} />
        <div>
          <MText size="sm" fw={600}>Auto-Mate</MText>
          <MText fz={11} c="dimmed">Your setup guide</MText>
        </div>
        <Box ml="auto" w={8} h={8} bdrs="50%" bg="var(--mantine-color-green-filled)" />
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
  )
}
