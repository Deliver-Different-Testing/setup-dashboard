---
sourceId: setup-dashboard/prepare-contacts-file
title: Preparing a booking contacts file
category: Getting set up
audience: [admin]
tags: [contacts file, booking contacts, customer users, csv template, client code, import contacts, data preparation]
---

A contacts file has one row per extra booking contact, attached to a customer by Client Code. Required: Client Code, First Name, Email. Optional: Last Name, Mobile, Job Title. Import customers first and save, then Import contacts; a row whose Client Code matches no customer on the step is reported and skipped. Contacts loaded this way have no sign-in until you tick "Sign-in + invite" on each one.

## Column reference

| Column | Required | Notes |
|---|---|---|
| Client Code | yes | The customer's code from the customer file. The customer's exact name also works. |
| First Name | yes | Either first name or last name may be blank, not both. |
| Last Name | no | |
| Email | yes | Becomes the username if a sign-in is created. Unique. |
| Mobile | no | |
| Job Title | no | |

## Don't repeat the primary contact

The primary contact is already on the customer row. Listing them again creates a second contact with the same email, which fails on uniqueness.
