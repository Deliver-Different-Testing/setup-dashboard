# Setup Dashboard guide

The end-user guide now lives as a help centre in [`docs/help/`](help/README.md): one short article per question, written
to be published into the Customer Success Platform's Knowledge Base (the "Deliver Different guides" collection) so Ask
Auto-Mate can answer setup questions and tenants preparing their own data files know what each file must contain.

The guide that used to be here described the March 2026 prototype (EIN, credit-card and document-upload fields, a
10-step order, Admin Manager writes) and was removed on 25 Oct 2026 because none of it matched the product.

## Where to start

- [What the Setup Dashboard is and how a setup runs](help/setup-dashboard-overview.md)
- [Step statuses, requests to the tenant and "Needs:"](help/setup-steps-and-statuses.md)
- [Save, Save & send, and what "sent" means](help/save-vs-send.md)
- [When the setup emails someone, and how to stop it](help/invites-and-emails.md)
- [Setting up a brand-new tenant: the order that avoids dead ends](help/brand-new-tenant-order.md)
- [What the messages mean](help/troubleshooting-messages.md)

## Steps

Business profile · Team · Customers · Rates and zones · Schedules · Couriers and fleets · Agents and network partners ·
Automations · Integrations · App configuration · Training. One article per step, plus one per object on the Rates step
(vehicle sizes, zones and zips, fuel surcharges, zone-to-zone rates, distance rates). See `help/manifest.json` for the list.

## Preparing your own data

- [Getting your data out of your old system](help/exporting-from-your-old-system.md)
- [Smart Import: upload, map, preview, load](help/smart-import-how-it-works.md)
- [Which files it accepts and which systems it recognises](help/smart-import-files-and-systems.md)
- File guides: [customers](help/prepare-customer-file.md), [booking contacts](help/prepare-contacts-file.md),
  [drivers](help/prepare-driver-file.md), [zones and zips](help/prepare-zones-file.md),
  [zone-to-zone rates](help/prepare-rates-file.md), [team](help/prepare-team-file.md)
