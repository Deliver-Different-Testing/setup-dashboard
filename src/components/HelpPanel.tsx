import { useStore } from '../store'
import { HELP_CONTENT, FULL_GUIDE_URL } from '../data/helpContent'

export function HelpPanel() {
  const currentStep = useStore((s) => s.currentStep)
  const helpPanelOpen = useStore((s) => s.helpPanelOpen)
  const toggleHelpPanel = useStore((s) => s.toggleHelpPanel)

  const help = HELP_CONTENT.find((h) => h.step === currentStep) || HELP_CONTENT[0]

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 z-[300] transition-opacity duration-300 ${
          helpPanelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={toggleHelpPanel}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[400px] max-w-[90vw] bg-white z-[301] shadow-2xl transition-transform duration-300 ease-in-out flex flex-col ${
          helpPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-[#0d0c2c]">
          <div className="flex items-center gap-2">
            <span className="text-xl">{help.emoji}</span>
            <h2 className="text-lg font-bold text-white">
              Step {help.step}: {help.title}
            </h2>
          </div>
          <button
            onClick={toggleHelpPanel}
            className="w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="help-content text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {help.content.split('\n').map((line, i) => {
              const trimmed = line.trim()

              if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                return (
                  <h3 key={i} className="font-bold text-[#0d0c2c] text-base mt-4 mb-1">
                    {trimmed.replace(/\*\*/g, '')}
                  </h3>
                )
              }

              if (trimmed.startsWith('• **')) {
                const match = trimmed.match(/^• \*\*(.+?)\*\*(.*)$/)
                if (match) {
                  return (
                    <div key={i} className="flex gap-2 ml-2 mb-0.5">
                      <span className="text-[#3bc7f4] mt-0.5">•</span>
                      <span>
                        <strong className="text-[#0d0c2c]">{match[1]}</strong>
                        {match[2]}
                      </span>
                    </div>
                  )
                }
              }

              if (trimmed.startsWith('• ')) {
                return (
                  <div key={i} className="flex gap-2 ml-2 mb-0.5">
                    <span className="text-[#3bc7f4] mt-0.5">•</span>
                    <span>{trimmed.slice(2)}</span>
                  </div>
                )
              }

              if (/^\d+\.\s/.test(trimmed)) {
                const num = trimmed.match(/^(\d+)\.\s(.*)$/)
                if (num) {
                  return (
                    <div key={i} className="flex gap-2 ml-2 mb-0.5">
                      <span className="text-[#3bc7f4] font-semibold min-w-[18px]">{num[1]}.</span>
                      <span>{num[2]}</span>
                    </div>
                  )
                }
              }

              if (trimmed === '') return <div key={i} className="h-2" />

              return <p key={i} className="mb-1">{trimmed}</p>
            })}
          </div>

          {/* Tips */}
          {help.tips.length > 0 && (
            <div className="mt-6 rounded-lg bg-[#3bc7f4]/10 border-l-4 border-[#3bc7f4] p-4">
              <h4 className="font-bold text-[#0d0c2c] text-sm mb-2">💡 Tips</h4>
              <ul className="space-y-1.5">
                {help.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-2">
                    <span className="text-[#3bc7f4] mt-0.5 shrink-0">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100">
          <a
            href={FULL_GUIDE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-sm font-semibold text-[#3bc7f4] hover:text-[#2ab0dd] transition"
          >
            📖 View Full Guide
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5">
              <path d="M5 2h7v7M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>
    </>
  )
}
