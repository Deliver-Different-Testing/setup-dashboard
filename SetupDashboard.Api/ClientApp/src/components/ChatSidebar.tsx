import { useEffect, useRef, useState } from 'react'
import { ActionIcon, TextInput } from '@mantine/core'
import { SendHorizontal } from 'lucide-react'
import { useStore } from '../store'
import { CHAT_MESSAGES } from '../data/chatMessages'

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
    setTimeout(() => addChatMessage({ from: 'bot', text: "Thanks! I'm a scripted guide for now, so I can't act on messages yet - please use the form on this step. 👍" }), 800)
  }

  return (
    <aside className="w-[340px] min-w-[340px] bg-surface border-r border-line flex flex-col">
      <div className="px-4 py-3 border-b border-line flex items-center gap-3">
        <img src={`${import.meta.env.BASE_URL}auto-mate-icon-light.png`} alt="Auto-Mate" className="w-10 h-10 rounded-full object-cover" />
        <div>
          <div className="font-semibold text-ink text-sm">Auto-Mate</div>
          <div className="text-[11px] text-dimmed">Your AI setup assistant</div>
        </div>
        <div className="ml-auto w-2 h-2 rounded-full bg-ok" />
      </div>
      <div ref={messagesRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatHistory.map((m, i) => m.from === 'bot' ? (
          <div key={i} className="flex gap-2 items-end">
            <img src={`${import.meta.env.BASE_URL}auto-mate-icon-light.png`} alt="Auto-Mate" className="w-7 h-7 rounded-full object-cover shrink-0" />
            <div className="chat-bot px-4 py-2.5 max-w-[240px] text-sm text-ink">{m.text}</div>
          </div>
        ) : (
          <div key={i} className="flex justify-end">
            <div className="chat-user px-4 py-2.5 max-w-[240px] text-sm">{m.text}</div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-line">
        <div className="flex gap-2">
          <TextInput
            className="flex-1"
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
            placeholder="Type a message..."
            aria-label="Message Auto-Mate"
          />
          {/* Auto-Mate is an AI surface: the grape accent, not the brand cyan. */}
          <ActionIcon onClick={sendChat} color="grape" size="input-sm" aria-label="Send">
            <SendHorizontal size={16} strokeWidth={1.5} />
          </ActionIcon>
        </div>
      </div>
    </aside>
  )
}
