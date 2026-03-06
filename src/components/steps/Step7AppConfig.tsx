import { useStore } from '../../store'
import { Toggle } from '../Toggle'
import { Pill } from '../Pill'

const FEATURES: { key: string; icon: string; desc: string }[] = [
  { key: 'Photo on Pickup', icon: '📸', desc: 'Require photo capture when collecting a package' },
  { key: 'Signature on Delivery', icon: '✍️', desc: 'Capture recipient signature as proof of delivery' },
  { key: 'Barcode Scan', icon: '📋', desc: 'Scan package barcode at each checkpoint' },
  { key: 'Temperature Check', icon: '🧊', desc: 'Log temperature for cold-chain deliveries' },
  { key: 'Custom Form', icon: '📝', desc: 'Add a custom data capture form at any step' },
  { key: 'Wait Timer', icon: '⏱️', desc: 'Auto-track waiting time at pickup/delivery' },
  { key: 'Navigation', icon: '🗺️', desc: 'Auto-launch turn-by-turn directions' },
  { key: 'One-Tap Call', icon: '📞', desc: 'Call customer direct from delivery screen' },
]

const WORKFLOW_STEPS = ['Accept Job', 'Navigate', 'Arrive', 'Pickup', 'In Transit', 'Arrive', 'Deliver', 'Complete']
const PROFILES = [
  '🏥 Medical — Full chain of custody',
  '⚖️ Legal — Signature required',
  '🍕 Food — Temperature + photo',
  '📦 General — Standard POD',
  '💊 Pharmacy — ID verification',
]

export function Step7AppConfig() {
  const { appFeatures, toggleAppFeature, selectedProfiles, toggleProfile } = useStore()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-navy">📱 AI App Workflow Configurator</h2>
      <p className="text-gray-500 text-sm">Configure exactly what your drivers see and do at each step. Every workflow is different — yours should be too.</p>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="text-sm font-semibold text-navy mb-4">Driver Workflow Steps</div>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {WORKFLOW_STEPS.map((st, i) => (
            <div key={i} className="flex items-center shrink-0">
              <div className={`px-3 py-2 rounded-xl text-xs font-semibold ${i === 3 || i === 6 ? 'bg-cyan text-white' : 'bg-lgrey text-navy'} cursor-pointer hover:bg-cyan/20 transition`}>{st}</div>
              {i < WORKFLOW_STEPS.length - 1 && <div className="text-gray-300 mx-1">→</div>}
            </div>
          ))}
        </div>
        <div className="mt-4 p-4 bg-lgrey rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-cyan/15 flex items-center justify-center text-sm">🤖</div>
            <div className="text-xs text-gray-500"><strong className="text-navy">Auto-Mate:</strong> Tell me how your drivers work and I'll configure the app flow. e.g. "Our medical drivers need to scan a barcode, take a photo, and get a signature at every delivery — plus log temperature for cold-chain packages."</div>
          </div>
        </div>
      </div>
      <div className="text-sm font-semibold text-navy">Driver App Features</div>
      <div className="grid grid-cols-2 gap-4">
        {FEATURES.map(w => (
          <div key={w.key} className="bg-white rounded-2xl p-5 shadow-sm card-hover border border-gray-100 flex items-start gap-4">
            <div className="text-2xl mt-0.5">{w.icon}</div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-navy">{w.key}</div>
              <div className="text-xs text-gray-400 mt-1">{w.desc}</div>
            </div>
            <Toggle on={appFeatures[w.key]} onToggle={() => toggleAppFeature(w.key)} />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="text-sm font-semibold text-navy mb-2">Per-Vertical Profiles</div>
        <div className="text-xs text-gray-400 mb-3">Different verticals need different workflows. Set up profiles and Auto-Mate assigns the right one automatically.</div>
        <div className="flex flex-wrap gap-2">
          {PROFILES.map(v => (
            <Pill key={v} label={v} selected={selectedProfiles.includes(v)} onToggle={() => toggleProfile(v)} />
          ))}
        </div>
      </div>
    </div>
  )
}
