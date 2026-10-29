---
sourceId: setup-dashboard/exporting-from-your-old-system
title: Getting your data out of your old system
category: Getting set up
audience: [admin]
tags: [export, old system, migration, competitor tms, key software, datatrac, cxt, ontime, elite extra, customer export, driver export, rate export, data preparation]
---

You need five exports from your old system, each as a CSV or Excel file with a header row: customers (often called accounts or clients), customer contacts or users, drivers, your zone or zip table, and your rate table. Export master lists, not job history; the dashboard does not import jobs, bookings or invoices.

Deliver Different never logs in to your old system: you run the exports and upload the files, and anything the files lack is filled in on the step before it is sent.

## What to look for in each system

- Customers: the account or client master list. You want code, name, address parts, phone, email and the main contact's name and email. Billing terms don't transfer; you pick them on the step.
- Contacts or users: customer-side users who book. Keep the column that names their customer (code or name).
- Drivers: the driver or courier list with name, email and mobile. Email is required for the app login; collect any missing ones before you import.
- Zones: the zip-to-zone or suburb-to-zone table. One row per zip is ideal; a suburb list needs a post code column added.
- Rates: the zone-to-zone rate table. A matrix (zones across and down) must be unpivoted to one row per cell.

## Clean the files first

Remove inactive customers you don't want carried over, duplicate rows, and test accounts. Fix split or merged address cells. A tidy file loads with few "Needs:" rows; a raw dump loads but leaves you fixing every row on screen.

## Check sizes

The preview shows the first 20 rows and warnings for the whole file. A warning per row usually means a column is missing or mapped wrong; fix the file or the mapping rather than the rows.
