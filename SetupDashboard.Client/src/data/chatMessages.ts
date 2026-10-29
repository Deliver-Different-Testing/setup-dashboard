// Auto-Mate's scripted lines, one set per step (index = position in STEPS).
// Kept truthful to what each step does: nothing is pre-filled or switched on for you.
export const CHAT_MESSAGES: Record<number, string[]> = {
  0: [
    "Hi, I'm Auto-Mate, your setup guide. 👋",
    "Start with your business details. DFRNT also checks your system settings and email wording here, before anyone on your team is invited.",
  ],
  1: [
    "Next, your team.",
    "Create a role for each type of user. An admin role and an operations role is a good start. Tick the tiles each role can open, then add people. Each person gets a sign-in invite by email when you send.",
  ],
  2: [
    "Now your customers.",
    "Upload a file from your old system, or add customers here. Each one needs a real address, an invoice schedule, a payment term and a primary contact. Anything missing is flagged, never filled in for you.",
  ],
  3: [
    "Rates and zones.",
    "Add your vehicle sizes and zones first, then the rates that use them. A rate with no customer codes applies to every customer.",
  ],
  4: [
    "Schedules.",
    "Give each schedule a destination depot, plus the days and times it runs. Leave the customer list empty to make it the default schedule.",
  ],
  5: [
    "Couriers and fleets.",
    "Add your vehicle fleets first. Then add couriers with the email and first password they'll use to sign in to the courier app.",
  ],
  6: [
    "Agents and network partners.",
    "Add the partners you work with. Give a partner a contact email if they should sign in to their own portal.",
  ],
  7: [
    "Automations.",
    "Build notification and auto-assign rules in Settings > Automations, where your job statuses and message templates live. Tick this step off once they're in.",
  ],
  8: [
    "Integrations.",
    "Connect carriers, Shopify and partner links in Integration Manager. Tick each one off here when it's connected.",
  ],
  9: [
    "App setup.",
    "Catalogues, dispatch settings and the sign-up page live in Settings > Admin Setup.",
  ],
  10: [
    "Last step: training. 🏋️",
    "Work through the challenges for each role. Your progress is saved with this setup.",
  ],
}
