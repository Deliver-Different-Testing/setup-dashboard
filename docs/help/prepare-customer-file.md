---
sourceId: setup-dashboard/prepare-customer-file
title: Preparing a customer list file
category: Getting set up
audience: [admin]
tags: [customer file, client list, account list, csv template, columns, client code, address, primary contact, import customers, data preparation]
---

A customer file has one row per customer with these columns. Required: Client Code, Client Name, Street Address, Suburb (US: City), City (US: State), Primary Contact First Name, Primary Contact Email. Optional: Unit / Suite, Post / Zip Code, Country, Phone, Company Email, Invoice Email, Primary Contact Surname, Primary Contact Mobile.

Invoice schedule and payment term aren't in the file; set them on the step after import. Column names don't have to match exactly: Account, CustCode, Company, Address1, Zip and similar are recognised, and you can fix any mapping on screen.

## Column reference

| Column | Required | Notes |
|---|---|---|
| Client Code | yes | Short unique code, e.g. ACME01. Must not already exist, even on an inactive customer. |
| Client Name | yes | Trading name as it should appear on bookings and invoices. Unique. |
| Street Address | yes | Number and street only. |
| Unit / Suite | no | Level, suite, unit. |
| Suburb (US: City) | yes | US tenants: the city. Elsewhere: the suburb. |
| City (US: State) | yes | US tenants: the state. Elsewhere: the city. |
| Post / Zip Code | no | |
| Country | no | Leave blank for the tenant's own country. |
| Phone | no | Company switchboard. |
| Company Email | no | General address. |
| Invoice Email | no | Where invoices go, if different. |
| Primary Contact First Name | yes | The person who books. If you only have a full name, put it here; it is split at the last space. |
| Primary Contact Surname | no | |
| Primary Contact Email | yes | Becomes their booking sign-in. Unique across all contacts. |
| Primary Contact Mobile | no | |

## Common mistakes

- Same code or name twice in the file: the preview flags "Possible duplicate".
- Address in one cell ("12 Queen St, Ponsonby, Auckland 1011"): split it into the four columns first.
- A generic contact email (accounts@…) used for several customers: each sign-in must be unique.
- City and State in a non-US tenant: map them to Suburb and City.

## Sample row

ACME01, Acme Supplies, 12 Queen St, Level 3, Ponsonby, Auckland, 1011, , 09 123 4567, hello@acme.co.nz, ap@acme.co.nz, Jane, Smith, jane@acme.co.nz, 021 555 123
