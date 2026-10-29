---
sourceId: setup-dashboard/setup-steps-and-statuses
title: Step statuses, requests to the tenant and what "Needs:" means
category: Getting set up
audience: [admin]
tags: [status, not started, waiting on tenant, in progress, done, needs, requests, progress, checklist, row results]
---

Each step shows one of four statuses. Not started: nothing entered. Waiting on tenant: DFRNT has asked for something and it hasn't been supplied yet. In progress: there is data, or rows have been sent, or a checklist item is ticked. Done: a person marked it done. A step can only be marked done when there are no open requests, every row is created, and every required checklist item is ticked.

A row showing "Needs: …" is held back because a required field is missing; fill it in and send again.

## Requests to the tenant

Any step can carry a request such as "Customer list with addresses" with an optional due date. While a request is open the step shows Waiting on tenant and the header shows how many items are outstanding and for how many days. Press Supplied when it arrives.

## Row results

After Save & send each row shows one of: Pending (not sent yet), Needs data (held back, with the list of what's missing), Created (with the record's id in the owning app), Failed (with the owning app's own message, word for word), or Skipped. Sending again only sends rows that are not yet Created, so you can fix one row and resend without duplicating the others. A failed row never causes rows after it to be sent twice.

## Checklist items

Each step starts with a short checklist of things no form can do: work in another app's screens (for example assigning couriers to fleets in Settings > Driver List) or work only DFRNT can do (creating depots). Each item names its owner, Tenant or DFRNT, links to the right screen where there is one, and is ticked by a person. Required items block Done.

## Reopening

A done step can be reopened. Nothing is undone; it just lets you add or resend rows.
