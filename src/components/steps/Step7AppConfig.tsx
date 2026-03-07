const HUB_URL = 'https://hub.deliverdifferent.com'

const CONFIG_CARDS = [
  { icon: '📱', title: 'Driver App Settings', desc: 'Configure photo, signature, barcode, and POD requirements', path: '/Settings/DriverApp' },
  { icon: '🏥', title: 'Delivery Profiles', desc: 'Set up vertical-specific workflows (Medical, Legal, Food)', path: '/Settings/DeliveryProfiles' },
  { icon: '💬', title: 'Notifications', desc: 'SMS and email notification templates', path: '/Settings/Notifications' },
  { icon: '🎨', title: 'Branding', desc: 'Upload logo, set colors for client portal and tracking pages', path: '/Settings/Branding' },
  { icon: '⚙️', title: 'Feature Flags', desc: 'Enable/disable platform features for your instance', path: '/Settings/Features' },
]

export function Step7AppConfig() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-navy">📱 App Configuration</h2>

      <div className="flex items-start gap-3 rounded-2xl p-4" style={{ backgroundColor: 'rgba(59,199,244,0.08)' }}>
        <div className="text-xl shrink-0">ℹ️</div>
        <div className="text-sm text-navy">
          These settings are managed in your Deliver Different Hub. Click to configure.
        </div>
      </div>

      <div className="space-y-3">
        {CONFIG_CARDS.map(item => (
          <div key={item.title} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: '#f4f2f1' }}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-navy">{item.title}</div>
              <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>
            </div>
            <a
              href={`${HUB_URL}${item.path}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 px-4 py-2 rounded-full text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: '#3bc7f4' }}
            >
              Open in Hub →
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
