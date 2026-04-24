export interface HelpItem {
  step: number
  title: string
  emoji: string
  content: string
  tips: string[]
}

export const HELP_CONTENT: HelpItem[] = [
  {
    step: 0,
    title: 'Company Profile',
    emoji: '🏢',
    content: `This is the foundation — everything else builds on it.

**Company Basics**
• Enter the trading name and upload a logo
• Select the cities/regions they serve
• Check the industry verticals (Medical, Legal, Food, etc.)
• Select their current TMS for migration planning
• Choose their monthly delivery volume range

**Registration & Legal**
• Legal name must match their business registration exactly
• Enter EIN/registration number, country, state, and business type

**Company Documents**
• Upload business license, insurance certificate, and W-9/tax forms
• Accepted: PDF, JPG, PNG — up to 10MB per file

**Billing**
• Enter credit card details (Visa, Mastercard, Amex)
• The card is NOT charged until the first invoice

**Primary Contact**
• Main point of contact during onboarding — name, email, phone, title`,
    tips: [
      'Double-check the legal name matches exactly what\'s on their business registration — mismatches cause invoicing issues later.',
      'Logo is used in the client portal and driver app, so use a clean, high-res version.',
      'If they\'re not migrating from another TMS, select "None" — you can still import CSVs manually.',
    ],
  },
  {
    step: 1,
    title: 'Team',
    emoji: '👥',
    content: `Add the people who'll be using the system day-to-day.

**Adding Members**
• Click "+ Add Member" to add a new row
• Each person needs: name, email, and role

**Available Roles**
• **Admin** — Full access to everything including settings and billing
• **Dispatcher** — Can create and manage deliveries, assign drivers
• **Accounts** — Access to invoicing, rates, and financial reports
• **Driver Manager** — Can manage drivers, view performance, handle escalations

**Inviting**
• Click "Invite" to send them a setup email
• Invites are placeholder during onboarding — accounts activate when live`,
    tips: [
      'Start with at least one Admin and one Dispatcher. You can add more later.',
      'The person doing the onboarding should be added as Admin.',
      'Driver Manager role is great for fleet supervisors who don\'t need billing access.',
    ],
  },
  {
    step: 2,
    title: 'Clients',
    emoji: '📋',
    content: `Import the tenant's client list — the companies they deliver for.

**Three Ways to Add**
1. **Manual**: Click "+ Add Client", fill in company, contact, phone, email, billing type
2. **CSV Upload**: Drag & drop a CSV file — columns are auto-mapped
3. **Smart Import**: Click "🔄 Smart Import from Competitor TMS" for automatic detection

**Smart Import Flow**
1. Upload CSV/Excel from their old TMS
2. System detects the competitor (CXT, Key Software, Datatrac, Crown, e-Courier)
3. Columns auto-map with confidence scores
4. Review and adjust mappings
5. Preview first 10 rows → Import all

**Billing Types**
• Monthly, Per Delivery, Weekly, COD`,
    tips: [
      'CSV import is fastest for 10+ clients.',
      'Make sure the CSV has a header row with a "name" or "company" column.',
      'Smart Import works best with unmodified exports from the original TMS.',
    ],
  },
  {
    step: 3,
    title: 'Rates',
    emoji: '💰',
    content: `Set up the base rate card. Client-specific rates can be added later in Hub.

**Base Rates**
• Per Delivery, Per KM, Minimum Charge, Fuel Surcharge, Wait Time, After Hours

**Zone Pricing Grid**
• Set prices by zone (Downtown, Suburban, Metro Wide) × distance range
• Each cell is a price point

**Weight Breaks**
• Surcharges for heavier packages: 0–5kg free, then tiered up to 50kg+

**Accounting**
• Connect Xero, QuickBooks, or MYOB (opens in Hub)`,
    tips: [
      'Start with a simple rate card — you can add complexity later.',
      'The Minimum Charge is important: it prevents micro-deliveries from being unprofitable.',
      'Fuel surcharge is typically 8–12% in most markets.',
    ],
  },
  {
    step: 4,
    title: 'Couriers',
    emoji: '🚗',
    content: `Add the drivers who'll be making deliveries.

**Adding Drivers**
• **Manual**: Click "+ Add Courier" — name, phone, vehicle type, zone
• **QR Code**: Generate a QR code for driver self-registration
• **Smart Import**: Import from a competitor TMS export

**Vehicle Types**
• 🚗 Car — Standard sedan/hatchback
• 🚐 Van — Larger cargo capacity
• 🏍️ Bike — Motorcycle or bicycle (urban)
• 🚛 Truck — Heavy/oversized deliveries

**Zones**
• Assign each driver to a primary zone
• Auto-dispatch prioritizes zone matches`,
    tips: [
      'The QR code method is fastest for large fleets — share via SMS for remote drivers.',
      'Drivers can still accept jobs outside their zone; the zone is just a preference for auto-dispatch.',
      'Vehicle type affects which jobs are offered — don\'t assign a bike courier to furniture deliveries!',
    ],
  },
  {
    step: 5,
    title: 'Automations',
    emoji: '⚡',
    content: `Toggle automations on or off. These run automatically once the tenant is live.

**Available Automations**
• **SMS on Pickup** — Texts recipient when driver picks up
• **SMS on Delivery** — Texts recipient when delivered
• **Email Proof of Delivery** — POD email with photo/signature
• **Late Delivery Alert** — Notifies dispatcher when running late
• **Daily Summary Email** — End-of-day summary to admin
• **Auto-Reassign** — Reassigns after 5 min if driver doesn't accept
• **Live Tracking Link** — Real-time tracking link for recipient
• **Delivery Rating** — Post-delivery feedback request`,
    tips: [
      'Enable SMS on Pickup, SMS on Delivery, and Live Tracking Link at minimum — clients expect these.',
      'Auto-Reassign is great for busy fleets but can surprise drivers who were about to accept.',
      'Daily Summary Email is useful for admin oversight but can feel like spam — ask the tenant first.',
    ],
  },
  {
    step: 6,
    title: 'Integrations',
    emoji: '🔌',
    content: `Connect the tenant's other business tools to DF.

**Available Integrations**
• **Xero / QuickBooks** — Automatic invoice syncing
• **Webhooks** — Real-time event notifications to external systems
• **API Keys** — Generate keys for third-party integrations
• **Email Integration** — Inbound email parsing to create deliveries

All integrations are configured in **DF Hub** — clicking a card opens Hub in a new tab.`,
    tips: [
      'Set up accounting integration early so invoices sync from day one.',
      'Webhooks are for technical users — most tenants won\'t need them initially.',
      'Email integration lets clients create deliveries by sending an email — great for less tech-savvy clients.',
    ],
  },
  {
    step: 7,
    title: 'App Config',
    emoji: '📱',
    content: `Configure the driver app and delivery workflows.

**Settings (in DF Hub)**
• **Driver App Settings** — Photo, signature, barcode requirements
• **Delivery Profiles** — Pre-configured workflows by vertical:
  - 🏥 Medical — Full chain of custody
  - ⚖️ Legal — Signature required
  - 🍕 Food — Temperature + photo
  - 📦 General — Standard POD
  - 💊 Pharmacy — ID verification
• **Notification Templates** — Customize SMS/email wording
• **Branding** — Logo and colors for client portal
• **Feature Flags** — Enable/disable platform features`,
    tips: [
      'Set up at least one delivery profile matching the tenant\'s main vertical.',
      'Medical and Pharmacy profiles have stricter requirements — make sure drivers understand what\'s needed.',
      'Custom branding makes the client portal feel like their own product.',
    ],
  },
  {
    step: 8,
    title: 'Partners',
    emoji: '🤝',
    content: `Connect to the DF carrier network for overflow and partnerships.

**Network Features**
• **Agents & Partners Network** — 821+ carriers available
• **Overflow Settings** — Auto-route overflow to partner carriers
• **Rate Sharing** — Inter-carrier rate agreements
• **Network Directory** — Browse partners by region

All partner settings are configured in **DF Hub**.`,
    tips: [
      'Joining the network gives instant overflow capacity — no obligation, toggle on when needed.',
      'Overflow kicks in automatically when all drivers are busy.',
      'Rate sharing lets you set up preferred pricing with specific partners.',
    ],
  },
  {
    step: 9,
    title: 'Training',
    emoji: '🎓',
    content: `Get the whole team up to speed with gamified training.

**XP Levels**
• 🥉 Rookie (0 XP) → 🥈 Operator (100 XP) → 🥇 Pro (250 XP) → 💎 Expert (500 XP) → 🏆 Master (1000 XP)

**Skill Paths by Role**
• **Dispatcher**: First Dispatch → Speed Run → Shadow Mode → Zero Touch → Master
• **Admin**: First Client → Rate Builder → Zone Setup → Import Clients → Master
• **Accounts**: First Invoice → Batch Invoice → Xero Sync → Master
• **Driver**: App Install → First Delivery → POD Pro → Barcode → Master

**Leaderboard**
Real-time leaderboard shows who's progressing fastest.`,
    tips: [
      'Encourage friendly competition — the Master challenge requires completing ALL challenges in a path.',
      'Dispatchers should prioritize "First Dispatch" then "Shadow Mode" for Auto-Dispatch.',
      'Drivers: "App Ready" → "First Delivery" → "POD Pro" is the critical path.',
    ],
  },
]

export const FULL_GUIDE_URL = 'https://github.com/deliverdifferent/setup-dashboard/blob/main/docs/setup-guide.md'
