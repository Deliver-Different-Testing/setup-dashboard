// Auto-Mate's scripted lines, one set per step (index = position in STEPS).
// Kept truthful to what each step does: nothing is pre-filled or switched on for you.
export const CHAT_MESSAGES: Record<number, string[]> = {
  0: [
    "Hey! I'm Auto-Mate, your setup guide. 👋",
    "Start with who you are. DFRNT also checks your system settings and email wording here before anyone on your team is invited.",
  ],
  1: [
    "Now your team. 👥",
    "Create a role for each kind of user (an admin and an operations role is a good start), tick the tiles each can open, then add people. Each person gets a sign-in invite by email when you send.",
  ],
  2: [
    "Time for your customers. 📋",
    "Upload a file from your old system or add them here. Every customer needs a real address, an invoice schedule, a payment term and a primary contact - anything missing is flagged, never filled in for you.",
  ],
  3: [
    "Rates and zones. 💰",
    "Add your vehicle sizes and zones first, then the rates that use them. A rate with no customer codes applies to every customer.",
  ],
  4: [
    "Schedules. 🗓️",
    "Each schedule needs a destination depot and the days and times it runs. Leave the customer list empty for a default schedule.",
  ],
  5: [
    "Couriers and fleets. 🚗",
    "Add your vehicle fleets, then your couriers with the email and first password they'll use in the driver app.",
  ],
  6: [
    "Agents and network partners. 🤝",
    "Add the partners you work with. Give a partner a contact email if they should log in to their own portal.",
  ],
  7: [
    "Automations. ⚡",
    "Notification and auto-assign rules are built in Settings > Automations, where your own job statuses and message templates are. Tick it off here when they're in.",
  ],
  8: [
    "Integrations. 🔌",
    "Carriers, Shopify and partner links are connected in Integration Manager. Tick each one off as it's done.",
  ],
  9: [
    "App configuration. ⚙️",
    "Catalogues, dispatch settings and the sign-up page live in Settings > Admin Setup.",
  ],
  10: [
    "Last one - training! 🏋️",
    "Work through the challenges for each role. Your progress is saved with this setup.",
  ],
}
