---
sourceId: setup-dashboard/brand-new-tenant-order
title: Setting up a brand-new tenant: the order that avoids dead ends
category: Getting set up
audience: [admin]
tags: [new tenant, empty tenant, order, depots, tenant client file, speeds, first customer, checklist, DFRNT does this, dead end]
---

On a tenant with nothing in it yet, do these in order. DFRNT first: confirm the system settings and email wording, create the tenant's own client file, create depots, and make sure the speeds (services) exist. Then you: Team (roles, then people), one customer at least, vehicle sizes and zones, rates, schedules, fleets and couriers, partners last.

Each later item looks up an earlier one, and three of them have no form in the dashboard at all, which is why they are DFRNT checklist items on the Business step.

## Why this order

- Depots: schedules need a destination depot, distance rates can be tied to depots, fleets can have one. No depot pickers fill until DFRNT creates them.
- Tenant client file: every team member is attached to it. Without it every person shows "Needs: the tenant's own client file".
- Speeds: rates and schedules pick a speed from the list; the dashboard can't create one.
- First customer before partners: Settings copies site and billing values for a new partner from an existing customer, so the first partner on an empty tenant fails until one customer exists.
- First customer on an empty tenant: Settings also copies a site setting from an existing customer when creating one; the very first create can fail with Settings' message. DFRNT fixes it and you send again.
- Roles before people: a person needs a role on the step; roles are created first in the same send, so one send usually does both.

## The checklist is the memory

Every one of these is a checklist item with an owner. Tick them as they're done so the next person opening the setup can see what's left.
