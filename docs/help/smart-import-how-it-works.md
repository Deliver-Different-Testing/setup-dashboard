---
sourceId: setup-dashboard/smart-import-how-it-works
title: Smart Import: upload a file, map its columns, preview, load
category: Getting set up
audience: [admin]
tags: [smart import, import, upload, csv, excel, xlsx, column mapping, confidence, ai suggestion, preview, warnings, load rows, bulk]
---

Smart Import loads rows from a CSV or Excel file into a step. Four screens: upload the file; check the column mapping (each of your columns is matched to a dashboard field with a confidence score, green 80 % and above, amber 50 to 79, red below, and you can change any match); preview the first 20 rows with warnings; then load. Loading only fills the step's rows.

Nothing is created in Settings or Routed Operations until you press Save & send on the step, so you can tidy rows up first.

## Where it is

Customers step: Import customers, Import contacts. Rates step: Import zips, Import rates. Couriers step: Import drivers. Team and Training steps: Import team. Save the step before importing; the buttons are disabled while there are unsaved edits.

## Mapping

Columns are matched by name, including common names from other systems (Account, CustCode, Address1, Zip, DriverName and so on). A match below 75 % is left unmapped for you to pick. Columns you don't map are ignored.

When AI suggestions are switched on, any column the name match couldn't place is offered to Claude (Anthropic's AI) with up to three of its values, and its pick shows as "AI suggestion - check it". Only the column names and those sample values are sent, and every digit is replaced with 9 and every email with name@example.com first. Check each AI suggestion before you preview; change or skip it like any other match.

## Warnings on the preview

- "'X' isn't in this file": a required field has no column. Rows still load; each will show "Needs: X" until you fill it in on the step.
- "Row 12: Required field 'Email' is empty": that row will be held back until filled.
- "Possible duplicate 'Acme'": the same name appears twice in the file.

## After loading

Imported rows are appended to the step. Required values the file didn't have (invoice schedule, payment term, speed, a courier's initial password) are set on the step before sending.

## File limits

CSV, XLSX or XLS, one sheet, a header row, one record per row. Excel files are read from the first sheet with data.
