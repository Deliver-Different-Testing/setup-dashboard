---
sourceId: setup-dashboard/booking-contacts
title: Other booking contacts and their sign-ins
category: Getting set up
audience: [admin]
tags: [contacts, booking contacts, users, customer users, sign-in, invite, primary contact, import contacts]
---

A customer has one primary contact, who always gets a booking sign-in, and any number of other booking contacts, who don't unless you tick "Sign-in + invite" on them. An extra contact needs an email (it becomes their username) and a first name or surname. Mobile and job title are optional.

Contacts are created right after their customer when the step is sent; a contact whose customer failed waits until the customer is created.

## Importing contacts

Import customers first, save, then use Import contacts. Each contact row must name its customer by client code (or exact name) in the Client Code column so it can be attached. Rows for a customer that isn't on this step are reported and skipped.

## If a sign-in fails

The contact is still created. The row shows "Contact created, but the sign-in wasn't" with Settings' reason, usually that the email is already a sign-in somewhere. Fix the email in Settings or use a different one.
