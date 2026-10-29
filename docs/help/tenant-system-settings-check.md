---
sourceId: setup-dashboard/tenant-system-settings-check
title: Why invites wait for the tenant's system settings
category: Getting set up
audience: [admin]
tags: [system settings, email wording, invite blocked, waiting for DFRNT, sender address, reply address, another tenant, copied database]
---

Every invite the setup sends takes its wording, sender and reply address from the tenant's own system settings. A new tenant database is often created as a copy, so those values can belong to another company. That is why every row that would email someone shows "Waiting for DFRNT to confirm the tenant's system settings and invite wording (Business step)" until DFRNT ticks that item.

It is not an error; it is the dashboard refusing to send a customer an email signed by someone else.

## What DFRNT checks

Company name and address, bank and tax details, the from and reply-to addresses, the admin and enquiry addresses, and the sign-in invite and password-reset subject and body.

## What you can do meanwhile

Everything that doesn't email: vehicle sizes, zones and zips, rates, schedules, fleets, couriers (no email is sent to couriers). Save your customers and team with the invite box ticked; they send as soon as the item is ticked and you press Save & send again.
