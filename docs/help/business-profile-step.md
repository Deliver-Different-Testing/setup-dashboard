---
sourceId: setup-dashboard/business-profile-step
title: Business profile: what to fill in and what DFRNT checks
category: Getting set up
audience: [admin]
tags: [business profile, company, trading name, legal name, primary contact, depots, logo, tenant client file, system settings]
---

The Business profile step records who the tenant is: trading name (required), legal name, country, registration number, state of incorporation, business type, where and what they deliver, the system they are moving from, deliveries per month, and the primary contact for the setup (name and email required). This step writes nothing to any app.

The fields are grouped as Company, Registration, Operations and Primary setup contact.

- **Country** is a list: New Zealand, Australia, United States, United Kingdom, Canada or Other. Choose Other to type any other country.
- **The registration number is named for the country**: NZBN, ABN, EIN, Company number or Business number. The state (or province) of incorporation only shows where it applies, and stays visible if it already holds a value. Business type suggests the usual types for the country, but you can type anything.
- **Where they deliver** and **What they deliver** take one entry per chip. Press Enter or type a comma to add one. Pasting "Auckland, Wellington" makes two.

Its job is the DFRNT checklist that must be done before anyone is invited.

## The DFRNT checklist on this step

- Tenant's own client file exists (client type Tenant). Staff and roles hang off it. Required.
- System settings and email wording are this tenant's: company name, address, bank and tax details, sender and reply addresses, sign-in invite and password-reset wording. Required, and it blocks every invite until ticked.
- Depots created. Schedules, distance rates and fleets need them. Required.
- Tenant logo uploaded. Optional.

## "This tenant's system settings now"

The card shows the company address, admin email, country code and application name currently stored for this tenant, and counts of customers, staff, couriers, zones and active automations already in the system. An address or admin email that doesn't contain the trading or legal name is marked "Not this tenant". Nothing is checked until a trading name is entered. Ask DFRNT to fix it in System Settings before the checklist item is ticked.

## Trading name matters later

If the tenant has more than one client file of type Tenant, the Team step uses the trading name here to pick the right one. Spell it as it appears in Settings.
