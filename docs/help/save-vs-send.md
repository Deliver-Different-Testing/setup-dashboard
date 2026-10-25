---
sourceId: setup-dashboard/save-vs-send
title: Save, Save & send, and what "sent" means
category: Getting set up
audience: [admin]
tags: [save, send, save and send, created, settings, routed operations, draft, resend, sign-in expired, role can't do this]
---

Save keeps your edits in the setup session and nothing leaves the dashboard. Save & send saves, then creates every complete row in the app that owns it (Settings for team, customers, rates, couriers and partners; Routed Operations for schedules) as you, and shows the result per row. Rows missing a required field are held back with "Needs: …" and can be sent later.

Sending again skips rows that are already Created.

## When to send

Send a step when its rows are complete. You don't have to send a whole step at once: a step with twenty customers and three missing addresses creates seventeen and holds three.

## What you'll see

- Created: the record exists in the owning app, with its id. Open it there to check.
- Failed: the owning app refused it. Its message is shown unchanged, for example a duplicate code.
- Needs data: the dashboard held it back before sending.

## If your sign-in has expired

The dashboard uses your Hub sign-in to act in Settings and Routed Operations. If you see "sign-in expired", sign in to Hub again in the same browser and send again.

## If your role can't do this

Each app decides what your role may create. A Tenant Staff role can create customers, couriers, zones and rates; rate cards and spreadsheet rate imports are DFRNT-only. When a push is refused you see the app's own message and the item appears in the step's DFRNT checklist.
