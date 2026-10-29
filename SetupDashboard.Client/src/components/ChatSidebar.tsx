import { useEffect, useRef, useState } from 'react'
import { ActionIcon, Avatar, Box, Flex, Group, Stack, Text as MText, TextInput } from '@mantine/core'
import { SendHorizontal } from 'lucide-react'
import { useStore } from '../store'
import { CHAT_MESSAGES } from '../data/chatMessages'
import classes from './ChatSidebar.module.css'

export function ChatSidebar() {
  const { currentStep, chatHistory, addChatMessage, shownChatSteps, markChatStepShown } = useStore()
  const [input, setInput] = useState('')
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

  const sendChat = () => {
    if (!input.trim()) return
    addChatMessage({ from: 'user', text: input.trim() })
    setInput('')
    setTimeout(() => addChatMessage({ from: 'bot', text: "Thanks. I'm a scripted guide, so I can't act on messages yet. Use the form on this step to continue." }), 800)
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
            <div className={`${classes.bubble} ${classes.bot}`}>{m.text}</div>
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
            placeholder="Type a message"
            aria-label="Message Auto-Mate"
          />
          {/* Auto-Mate is an AI surface: the grape accent, not the brand cyan. */}
          <ActionIcon onClick={sendChat} color="grape" size="input-sm" aria-label="Send message">
            <SendHorizontal size={16} strokeWidth={1.5} />
          </ActionIcon>
        </Group>
      </Box>
    </Flex>
  )
}
