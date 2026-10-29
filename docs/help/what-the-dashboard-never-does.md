---
sourceId: setup-dashboard/what-the-dashboard-never-does
title: What the Setup Dashboard never does for you
category: Getting set up
audience: [admin]
tags: [defaults, placeholder, guardrails, safety, no defaults, never emails, never stores password, import doesn't send, what it does not do]
---

The dashboard never fills in a value you didn't give: no placeholder addresses, no default zone, no made-up vehicle. A missing required field holds the row back, labelled "Needs: …". It never emails anyone without the invite tick on the row and DFRNT's confirmation of the tenant's system settings. It never keeps a courier's password after the login is created.

Loading a file never creates anything; only Save & send does. And it never writes to a record it created before: sending again skips rows already Created.

## Why so strict

An earlier version of the tool filled gaps with sample values to keep going. Those values ended up on real customer records and on invoices. Holding a row back is cheaper than finding "123 Main St" on a statement later.

## What that means for you

Expect "Needs:" rows after an import. They are the dashboard asking for the data your file didn't have, and the list on each row tells you exactly what.

## What it also doesn't do

- Create depots, speeds, the tenant's own client file, rate cards or NZ bulk zone rates: DFRNT checklist items.
- Assign couriers to fleets: done in Settings > Driver List after the courier exists.
- Build automation rules, connect integrations or set app configuration: done on those apps' screens and ticked off here.
- Look up map positions for addresses: set latitude and longitude on the customer in Settings if a client-address schedule needs them.
- Import jobs, bookings, invoices or history.
