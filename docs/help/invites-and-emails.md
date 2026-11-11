---
sourceId: setup-dashboard/invites-and-emails
title: When the setup emails someone, and how to stop it
category: Getting set up
audience: [admin]
tags: [invite, email, sign-in invite, password reset, booking sign-in, notification, held, tick, invite every primary contact]
---

Three things in the setup send an email: adding a team member (a Hub sign-in invite), creating a customer (Settings always emails the primary contact a booking sign-in), and giving a partner a contact email (an invite to their portal).

Nothing is emailed until two conditions are met: you tick the "send sign-in invite" box on that row, and DFRNT has ticked "System settings and email wording are this tenant's" on the Business step. Until then the row is held with "Needs: …" and no email goes out.

## Why the second condition

A new tenant database can carry another company's sender address and invite wording. The invite email takes its subject, body and reply address from the tenant's system settings, so those must be yours before the first invite. The Business step shows what the settings say right now so you can see if they look wrong.

## Rows that never email

Couriers: creating a courier makes their driver-app login with the password you typed. No email is sent; tell them their password yourself.
Vehicle sizes, zones, rates, schedules, fleets: no people involved, no email.

## Extra booking contacts

Other contacts on a customer are created without a sign-in unless you tick "Email a sign-in invite to this contact" on that contact.

## Inviting everyone at once

On the Customers step, "Confirm all invites" ticks the box on every customer. Use it only when you've checked the contact emails are right: each one receives a real email.
