import { useStore } from '../store'

export function Header() {
  const getCompletionPercentage = useStore((s) => s.getCompletionPercentage)
  const pct = getCompletionPercentage()

  return (
    <header className="bg-navy text-white px-6 py-4 flex items-center justify-between relative z-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <svg width="36" height="36" viewBox="0 0 36 36">
            <rect width="36" height="36" rx="8" fill="#3bc7f4" />
            <text x="18" y="24" textAnchor="middle" fontSize="18" fontWeight="800" fill="#0d0c2c">D</text>
          </svg>
          <span className="text-lg font-bold tracking-tight">Deliver Different</span>
        </div>
        <div className="h-6 w-px bg-white/20 mx-2" />
        <span className="text-sm text-white/80">Let's get you onboarded</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-sm font-semibold">
          <span className="text-cyan">{pct}%</span> complete
        </div>
      </div>
    </header>
  )
}
