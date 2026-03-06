import { useCallback } from 'react'
import { useStore } from '../../store'
import { Toggle } from '../Toggle'

const MAP_POSITIONS = [
  [20,30],[35,25],[50,35],[65,28],[45,50],[30,45],[60,42],[75,35],
  [25,55],[55,55],[40,38],[70,48],[50,20],[80,30],[15,40],[68,22],
  [38,58],[58,32],[22,35],[72,55],
]

export function Step8Partners() {
  const { useOverflow, setUseOverflow, joinNetwork, setJoinNetwork, addChatMessage } = useStore()

  const launchConfetti = useCallback(() => {
    const colors = ['#3bc7f4', '#0d0c2c', '#f4f2f1', '#ff6b6b', '#ffd93d', '#6bcb77']
    for (let i = 0; i < 60; i++) {
      const el = document.createElement('div')
      el.className = 'confetti-piece'
      el.style.left = Math.random() * 100 + 'vw'
      el.style.background = colors[Math.floor(Math.random() * colors.length)]
      el.style.animationDelay = Math.random() * 1.5 + 's'
      el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px'
      el.style.width = (6 + Math.random() * 8) + 'px'
      el.style.height = (6 + Math.random() * 8) + 'px'
      document.body.appendChild(el)
      setTimeout(() => el.remove(), 4000)
    }
    setTimeout(() => addChatMessage({
      from: 'bot',
      text: "🎉 Congratulations! You're live on Deliver Different! Your team can start dispatching deliveries right now. Welcome to the future of courier management!",
    }), 500)
  }, [addChatMessage])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-navy">🤝 Agents & Partners</h2>
      <p className="text-gray-500 text-sm">Expand your reach. Connect with overflow carriers and the Deliver Different network.</p>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold text-navy">Do you use overflow carriers?</div>
            <div className="text-xs text-gray-400 mt-1">Route excess deliveries to trusted partner carriers</div>
          </div>
          <Toggle on={useOverflow} onToggle={() => setUseOverflow(!useOverflow)} />
        </div>
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold text-navy">Join the Deliver Different Carrier Network</div>
            <div className="text-xs text-gray-400 mt-1">Get overflow work from other carriers in your area</div>
          </div>
          <Toggle on={joinNetwork} onToggle={() => setJoinNetwork(!joinNetwork)} />
        </div>
        <div className="bg-navy rounded-xl p-6 mt-4 relative overflow-hidden" style={{ height: 220 }}>
          <svg width="100%" height="100%" className="absolute inset-0">
            <rect x="10%" y="10%" width="80%" height="80%" rx="8" fill="none" stroke="rgba(59,199,244,0.15)" strokeWidth="1" />
            <rect x="15%" y="15%" width="70%" height="70%" rx="4" fill="none" stroke="rgba(59,199,244,0.08)" strokeWidth="1" />
            {MAP_POSITIONS.map((p, i) => (
              <circle key={i} className="map-dot" cx={`${p[0]}%`} cy={`${p[1]}%`} r={i < 5 ? 4 : 2.5} fill="#3bc7f4" opacity={0.3 + Math.random() * 0.7} style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </svg>
          <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
            <div>
              <div className="text-3xl font-extrabold text-cyan">821+</div>
              <div className="text-xs text-white/60">Carriers in the Network</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-white">North America</div>
              <div className="text-xs text-white/60">Coverage across US & Canada</div>
            </div>
          </div>
        </div>
        <div className="mt-4 p-4 bg-lgrey rounded-xl">
          <div className="text-xs text-gray-500 leading-relaxed">
            <strong className="text-navy">How it works:</strong> When you're at capacity, overflow deliveries are automatically offered to vetted carriers in your area. You set the rules — pricing, zones, and quality standards. Every partner is rated and reviewed. It's like having an elastic workforce on demand.
          </div>
        </div>
      </div>
      <div className="text-center pt-4">
        <button onClick={launchConfetti} className="px-10 py-4 rounded-full bg-gradient-to-r from-cyan to-cyan-dark text-white text-lg font-bold shadow-xl shadow-cyan/30 hover:shadow-cyan/50 hover:scale-105 transition-all">
          🚀 Go Live!
        </button>
        <div className="text-xs text-gray-400 mt-3">You can always come back and adjust settings</div>
      </div>
    </div>
  )
}
