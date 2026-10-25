---
sourceId: setup-dashboard/troubleshooting-messages
title: What the messages on the Setup Dashboard mean
category: Getting set up
audience: [admin]
tags: [error, message, needs, sign-in expired, role can't do this, not switched on, already taken, duplicate, failed, waiting for DFRNT, troubleshooting]
---

Most messages on the dashboard are one of these. "Needs: …" means the row is missing a required field and was held back; fill it in and send again. "Sign-in expired" means your Hub sign-in has lapsed; sign in to Hub again in the same browser. "Your role can't do this" means the owning app refused your role; DFRNT does that item. "Setup Dashboard is not switched on for your account.

Ask DFRNT." means the tile isn't enabled for you. Anything else on a Failed row is the owning app's own message, shown word for word.

## Needs: tick 'send sign-in invite'

The row would email someone and you haven't confirmed it. Tick the box on the row.

## Waiting for DFRNT to confirm the tenant's system settings and invite wording

No invite goes out until DFRNT ticks that item on the Business step. Everything that doesn't email still sends.

## Needs: customer X created on the Clients step

A rate, fuel surcharge or schedule names a customer code the dashboard didn't create. Add the customer on the Customers step and send it first, or leave the codes blank so the item applies to every customer.

## Needs: vehicle size X in Settings / zone X in Settings

The name doesn't match a vehicle size or zone created on this step or already in Settings. Check spelling against the "Already in Settings" list.

## Needs: the tenant's own client file

The tenant has no client file of type Tenant, so staff can't be attached. DFRNT creates it (Business step checklist). If there are several, set the trading name on the Business step to match the right one.

## Needs: a role called X on this step

A person's role isn't one of the roles on the Team step. Add the role or change the person's role.

## Needs: initial app password (8+ characters)

Every courier needs a typed password before sending. Imported drivers never have one.

## Already taken

The code, name or email exists already. Codes and emails are checked against inactive records too. "Unchecked" means the check couldn't run; the owning app still enforces it on send.

## Failed: a message from Settings or Routed Operations

Shown unchanged. Common ones: a duplicate code or email, a missing lookup on a brand-new tenant (create one customer first), or a field the app validates further than the dashboard does. Fix the row and send again; created rows aren't resent.

## Possible duplicate 'X' (import preview)

The same name appears twice in the file. Remove one before loading, or both rows load and the second fails on send.
