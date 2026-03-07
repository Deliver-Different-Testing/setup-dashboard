import { useEffect, useRef, useState } from 'react'
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
    setTimeout(() => addChatMessage({ from: 'bot', text: "Got it! I'll update your settings. 👍" }), 800)
  }

  return (
    <aside className="w-[340px] min-w-[340px] bg-white border-r border-gray-200 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
        <img src={`${import.meta.env.BASE_URL}auto-mate-icon-light.png`} alt="Auto-Mate" className="w-10 h-10 rounded-full object-cover" />
        <div>
          <div className="font-semibold text-navy text-sm">Auto-Mate</div>
          <div className="text-[11px] text-gray-400">Your AI setup assistant</div>
        </div>
        <div className="ml-auto w-2 h-2 rounded-full bg-green-400" />
      </div>
      <div ref={messagesRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatHistory.map((m, i) => m.from === 'bot' ? (
          <div key={i} className="flex gap-2 items-end">
            <img src={`${import.meta.env.BASE_URL}auto-mate-icon-light.png`} alt="Auto-Mate" className="w-7 h-7 rounded-full object-cover shrink-0" />
            <div className="chat-bot px-4 py-2.5 max-w-[240px] text-sm text-navy">{m.text}</div>
          </div>
        ) : (
          <div key={i} className="flex justify-end">
            <div className="chat-user px-4 py-2.5 max-w-[240px] text-sm">{m.text}</div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-gray-100">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
            type="text"
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-full focus:outline-none focus:border-cyan"
          />
          <button onClick={sendChat} className="w-9 h-9 rounded-full bg-navy text-white flex items-center justify-center hover:bg-navy/90 transition text-sm">↑</button>
        </div>
      </div>
    </aside>
  )
}
