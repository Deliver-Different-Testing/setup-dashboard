---
sourceId: setup-dashboard/smart-import-files-and-systems
title: Which files Smart Import accepts and which old systems it recognises
category: Getting set up
audience: [admin]
tags: [smart import, csv, excel, xlsx, xls, key software, datatrac, elite extra, ontime, getswift, track-pod, cxt, migration, export, old system, competitor tms]
---

Smart Import accepts CSV, XLSX and XLS files with a header row. It recognises exports from Key Software, Elite EXTRA, Datatrac, OnTime, GetSwift, Track-POD and DFRNT itself by their column names and shows the system it detected, but recognition only labels the file; the column mapping works the same for any file, including one you built in a spreadsheet.

If the detected system says "CSV Upload", nothing is wrong: your file simply isn't one of the known exports.

## Export master lists, not job history

The dashboard loads customers, booking contacts, drivers, zones with zips, zone-to-zone rates and team members. It does not load jobs, bookings, invoices or tracking history. Many systems' easiest export is a job list; it will be detected but it isn't what you want. Export the customer (account) list, the driver list, the zone or zip table and the rate table instead.

## One file per kind of data

Customers in one file, contacts in another, drivers in another. A sheet that mixes customers and their many contacts on one row loads the customer and the first contact as primary; put the rest in a contacts file keyed by client code.

## Encoding and formats

Plain UTF-8 CSV is safest. Amounts may carry a dollar sign. Dates aren't imported from files; the only date the setup asks for (fuel surcharge start) is picked on the form.
