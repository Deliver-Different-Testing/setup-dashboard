import { useStore } from '../../store'

const INTEGRATIONS = [
  { icon: '🛒', title: 'E-Commerce', examples: 'Shopify, WooCommerce, Magento', desc: 'Auto-import orders from online stores' },
  { icon: '🏭', title: 'Warehouse / WMS', examples: 'ShipStation, ShipBob, 3PL Central', desc: 'Sync inventory and fulfillment' },
  { icon: '💼', title: 'ERP / Business', examples: 'SAP, NetSuite, Microsoft Dynamics', desc: 'Connect your business backbone' },
  { icon: '📡', title: 'Custom API', examples: 'Any REST API endpoint', desc: 'Build any integration with natural language' },
  { icon: '📊', title: 'Reporting', examples: 'Power BI, Tableau, Google Sheets', desc: 'Push delivery data to your dashboards' },
  { icon: '💬', title: 'Communications', examples: 'Slack, Teams, Twilio', desc: 'Route alerts to your team channels' },
]

export function Step6Integrations() {
  const { integrationPrompt, setIntegrationPrompt } = useStore()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-navy">🔌 AI Integration Builder</h2>
      <p className="text-gray-500 text-sm">Connect Deliver Different to anything. Just describe what you need — Auto-Mate builds the integration.</p>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-full bg-cyan/15 flex items-center justify-center text-xl shrink-0">🤖</div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-navy mb-2">Tell Auto-Mate what you need</div>
            <div className="bg-lgrey rounded-xl p-4">
              <textarea
                rows={3}
                value={integrationPrompt}
                onChange={(e) => setIntegrationPrompt(e.target.value)}
                placeholder='e.g. "When a new order comes in from our Shopify store, create a delivery job and assign it to the nearest driver"'
                className="w-full bg-transparent text-sm text-navy focus:outline-none resize-none"
              />
            </div>
            <button className="mt-3 px-5 py-2.5 rounded-full bg-gradient-to-r from-cyan to-cyan-dark text-white text-sm font-semibold shadow-lg shadow-cyan/20 hover:shadow-cyan/40 transition">🧠 Build Integration</button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {INTEGRATIONS.map(ig => (
          <div key={ig.title} className="bg-white rounded-2xl p-5 shadow-sm card-hover border border-gray-100 cursor-pointer hover:border-cyan transition">
            <div className="text-2xl mb-2">{ig.icon}</div>
            <div className="text-sm font-semibold text-navy">{ig.title}</div>
            <div className="text-[11px] text-cyan font-medium mt-1">{ig.examples}</div>
            <div className="text-xs text-gray-400 mt-2">{ig.desc}</div>
          </div>
        ))}
      </div>
      <div className="bg-navy/5 rounded-2xl p-5 border border-navy/10">
        <div className="flex items-center gap-3">
          <div className="text-2xl">⚡</div>
          <div>
            <div className="text-sm font-semibold text-navy">No code required</div>
            <div className="text-xs text-gray-500">Auto-Mate translates your plain English into working integrations. Test, deploy, and monitor — all from this dashboard. Built by a team with 35 years of real-world courier experience.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
