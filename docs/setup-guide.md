# Deliver Different — Setup Dashboard Guide

## Overview

The Setup Dashboard is your one-stop onboarding wizard for getting a new courier company live on the Deliver Different (DF) platform. It's designed for DF staff who are onboarding new tenants — walking them through company setup, importing their data, configuring automations, and getting their team trained.

The wizard has 10 steps (0–9). You can complete them in order or jump around, but we recommend going in sequence since later steps build on earlier ones.

### Before You Start

- **Company details**: Have the tenant's legal name, EIN, and insurance documents ready
- **Migration info**: Know which TMS they're migrating from (CXT, Key Software, Datatrac, Crown, e-Courier, or none)
- **Data files**: Have their client list, rate card, and driver roster ready — CSV format preferred
- **Payment**: Credit card for billing setup (Visa, Mastercard, or Amex)
- **Estimated time**: 30–60 minutes depending on data volume

---

## Step 0: Company Profile 🏢

This is the foundation — everything else builds on top of the company profile.

### Company Basics
- **Company name**: Enter the trading name (what the company is known as)
- **Logo upload**: Drag and drop or click to upload. Used in the client portal and driver app
- **Geography & service areas**: Select the cities and regions they serve (e.g., Dallas–Fort Worth, Houston, Austin)
- **Verticals served**: Check which industries they deliver for — Medical, Legal, Food, Pharmacy, General, etc.
- **Current TMS system**: Select which system they're migrating from. This helps with Smart Import later
- **Monthly delivery volume**: Rough estimate — helps us size their account correctly

### Registration & Legal
- **Legal name**: The full legal entity name — must match their business registration exactly
- **EIN / Registration number**: Their tax ID or business registration number
- **Country & State**: Where the business is incorporated
- **Business type**: LLC, Corporation, Sole Proprietor, Partnership, etc.

### Company Documents
Upload required business documents:
- Business license
- Insurance certificate
- W-9 / tax forms

Accepted formats: PDF, JPG, PNG — up to 10MB per file. You can upload multiple documents.

### Billing
- Enter credit card details (Visa, Mastercard, Amex accepted)
- **The card is NOT charged until the first invoice** — this just stores it on file
- Enter the billing address for the card

### Primary Contact
- The main point of contact during onboarding
- Name, email, phone, and title
- This person will receive setup emails and be the go-to for questions

> **💡 Tip**: Double-check the legal name matches exactly what's on their business registration. Mismatches cause issues with invoicing and compliance later.

---

## Step 1: Team 👥

Add the people who'll be using the system day-to-day.

### Adding Team Members
- Click **"+ Add Member"** to add a new row
- Each person needs: **name**, **email**, and **role**
- Available roles:
  - **Admin** — Full access to everything. Can manage settings, billing, and users
  - **Dispatcher** — Can create and manage deliveries, assign drivers
  - **Accounts** — Access to invoicing, rates, and financial reports
  - **Driver Manager** — Can manage drivers, view performance, handle escalations

### Inviting Team Members
- Click **"Invite"** next to a team member to send them a setup email
- They'll receive instructions to set up their account and download the app
- Note: Invite functionality is a placeholder during onboarding — accounts activate when the tenant goes live

> **💡 Tip**: Start with at least one Admin and one Dispatcher. You can always add more team members later from DF Hub.

---

## Step 2: Clients 📋

Import the tenant's client list — the companies they deliver for.

### Three Ways to Add Clients

1. **Manual Entry**: Click **"+ Add Client"** and fill in company name, contact person, phone, email, and billing type
2. **CSV Upload**: Drag and drop a CSV file. The system auto-maps columns to DF fields
3. **Smart Import**: Click **"🔄 Smart Import from Competitor TMS"** for automatic competitor detection

### Smart Import Flow
1. Upload a CSV or Excel file exported from their old TMS
2. The system detects which competitor it came from (CXT, Key Software, Datatrac, Crown, e-Courier)
3. Columns are automatically mapped to DF fields with confidence scores
4. Review the mappings and adjust any that look wrong
5. Preview the first 10 rows to verify everything looks right
6. Click **Import All** to bring everything in

### Billing Types
- **Monthly** — Invoiced at the end of each month
- **Per Delivery** — Charged per individual delivery
- **Weekly** — Invoiced weekly
- **COD** — Cash on delivery

> **💡 Tip**: CSV import is the fastest method for 10+ clients. Make sure the file has a header row with a "name" or "company" column — that's how the mapper identifies client records.

---

## Step 3: Rates 💰

Set up the base rate card. This applies to all clients by default — you can add client-specific rates later in Hub.

### Base Rates
- **Per Delivery**: Flat fee per delivery
- **Per KM Rate**: Distance-based charge
- **Minimum Charge**: The floor — no delivery costs less than this
- **Fuel Surcharge**: Percentage added to cover fuel costs
- **Wait Time**: Per-minute charge when a driver has to wait
- **After Hours**: Percentage surcharge for deliveries outside business hours

### Zone Pricing Grid
Set prices by zone and distance range. The grid lets you define:
- **Zones**: Downtown, Suburban, Metro Wide (or custom zones)
- **Distance ranges**: 0–5km, 5–15km, 15–30km, 30km+
- Each cell is a price point

### Weight Breaks
Surcharges for heavier packages:
- 0–5kg: No surcharge
- 5–15kg: +$2.00
- 15–30kg: +$5.00
- 30–50kg: +$10.00
- 50kg+: Quote required

### Accounting Connection
Link to Xero, QuickBooks, or MYOB to sync invoices automatically. This opens in DF Hub.

> **💡 Tip**: Start with a simple rate card. You can add client-specific rates, time-based pricing, and custom surcharges later in Hub.

---

## Step 4: Couriers 🚗

Add the drivers who'll be making deliveries.

### Adding Drivers
- **Manual**: Click **"+ Add Courier"** and fill in name, phone, vehicle type, and assigned zone
- **QR Code**: Generate a QR code that drivers scan to self-register. They download the app and they're ready to go
- **Smart Import**: Click **"🔄 Smart Import Drivers"** to import from a competitor TMS export

### Vehicle Types
- 🚗 **Car** — Standard sedan/hatchback
- 🚐 **Van** — Larger cargo capacity
- 🏍️ **Bike** — Motorcycle or bicycle (urban areas)
- 🚛 **Truck** — Heavy/oversized deliveries

### Zones
Assign each driver to their primary zone (Downtown, Suburban, Metro Wide). Drivers can still accept jobs outside their zone, but auto-dispatch prioritizes zone matches.

> **💡 Tip**: The QR code method is fastest for large fleets. Share the QR via SMS to reach remote drivers who aren't in the room.

---

## Step 5: Automations ⚡

Toggle automations on or off. These run automatically once the tenant is live.

### Available Automations
| Automation | What it does |
|---|---|
| **SMS on Pickup** | Texts the recipient when the driver picks up the package |
| **SMS on Delivery** | Texts the recipient when the package is delivered |
| **Email Proof of Delivery** | Sends a POD email with photo/signature to the client |
| **Late Delivery Alert** | Notifies the dispatcher when a delivery is running late |
| **Daily Summary Email** | End-of-day summary to the admin: deliveries, issues, revenue |
| **Auto-Reassign** | If a driver doesn't accept a job within 5 minutes, auto-assigns to the next available driver |
| **Live Tracking Link** | Sends the recipient a real-time tracking link |
| **Delivery Rating** | Post-delivery feedback request to the recipient |

> **💡 Tip**: Enable **SMS on Pickup**, **SMS on Delivery**, and **Live Tracking Link** at minimum — these are what clients and their customers expect. The rest can be turned on later.

---

## Step 6: Integrations 🔌

Connect the tenant's other business tools to DF.

### Available Integrations
- **Xero / QuickBooks** — Automatic invoice syncing
- **Webhooks** — Real-time event notifications to external systems
- **API Keys** — Generate keys for third-party integrations
- **Email Integration** — Inbound email parsing (send an email to create a delivery)

These integrations are configured in **DF Hub** — clicking any integration card opens Hub in a new tab.

> **💡 Tip**: Set up accounting integration early so invoices sync automatically from day one. It saves hours of manual data entry.

---

## Step 7: App Config 📱

Configure the driver app and delivery workflows.

### Settings (configured in DF Hub)
- **Driver App Settings**: What's required on pickup/delivery — photo, signature, barcode scan
- **Delivery Profiles**: Pre-configured workflows by vertical:
  - 🏥 Medical — Full chain of custody
  - ⚖️ Legal — Signature required
  - 🍕 Food — Temperature check + photo
  - 📦 General — Standard proof of delivery
  - 💊 Pharmacy — ID verification required
- **Notification Templates**: Customize SMS and email wording
- **Branding**: Upload logo and set colors for the client portal
- **Feature Flags**: Enable or disable specific platform features

> **💡 Tip**: Set up at least one delivery profile that matches the tenant's main vertical. Profiles control what drivers see and must complete for each delivery type.

---

## Step 8: Partners 🤝

Connect to the DF carrier network for overflow and partnerships.

### Network Features
- **Agents & Partners Network**: Access to 821+ carriers across the network
- **Overflow Settings**: Automatically route overflow jobs to partner carriers when your fleet is at capacity
- **Rate Sharing**: Set up inter-carrier rate agreements
- **Network Directory**: Browse available partners by region and capability

All partner settings are configured in **DF Hub**.

> **💡 Tip**: Joining the network gives instant overflow capacity — when all your drivers are busy, jobs automatically route to trusted partners. There's no obligation — toggle it on when you need it.

---

## Step 9: Training 🎓

Get the whole team up to speed with gamified training.

### How It Works
- Each team member has an **XP score** and a **level**
- Levels progress as they complete challenges:
  - 🥉 **Rookie** (0 XP) — Just getting started
  - 🥈 **Operator** (100 XP) — Knows the basics
  - 🥇 **Pro** (250 XP) — Comfortable with daily operations
  - 💎 **Expert** (500 XP) — Power user
  - 🏆 **Master** (1000 XP) — Completed all challenges in their path

### Skill Paths by Role
- **Dispatcher**: First Dispatch → Speed Run → Shadow Mode → Auto-Suggest → Multi-Stop → Reassign → Zero Touch → Master
- **Admin**: First Client → Rate Builder → Zone Setup → Automation Rule → KB Article → Import Clients → Reporting → Master
- **Accounts**: First Invoice → Batch Invoice → Xero Sync → Statement → Rate Review → Master
- **Driver**: App Install → First Delivery → POD Pro → Barcode → Nav Ace → Streak → Master

### Key First Challenges
- **Dispatchers**: Start with "First Dispatch" then try "Shadow Mode" to get comfortable with Auto-Dispatch
- **Admins**: Complete "First Client" then "Rate Builder"
- **Drivers**: "App Ready" → "First Delivery" → "POD Pro"

### Leaderboard
The training step shows a real-time leaderboard so the team can see who's progressing fastest.

> **💡 Tip**: Encourage friendly competition! The Master challenge requires completing ALL challenges in a role's path — it's the ultimate achievement.

---

## Session Management

### Resume
If you close the browser mid-setup, your progress is automatically saved. When you return, you'll see a **"Resume"** prompt asking if you want to pick up where you left off.

### Reset
Click **"⚠️ Reset"** in the header to tear down everything and start fresh. This deletes all entities created during the session from the TMS.

⚠️ **Use with caution** — this cannot be undone.

---

## Troubleshooting

| Issue | Solution |
|---|---|
| **CSV not importing** | Make sure the file has a header row with a "name" or "company" column |
| **Smart Import shows low confidence** | The system couldn't detect the competitor format. Switch to "Generic" mode and map columns manually |
| **"Session not found" error** | Your session may have expired. Start a new session |
| **Backend not connected** | The app works offline (data saves locally) but won't push to TMS until the backend is running on port 3001 |
| **Logo not uploading** | Check file size (max 10MB) and format (JPG, PNG, SVG) |
| **Team member didn't receive invite** | Invites are placeholder during onboarding — accounts activate when the tenant goes live |

---

## Need Help?

- **In-app**: Click the **❓ Help** button in the top-right corner for contextual help on any step
- **DF Hub**: Most advanced configuration happens in [DF Hub](https://hub.deliverdifferent.com)
- **Support**: Contact the DF onboarding team at support@deliverdifferent.com
