---
sourceId: setup-dashboard/prepare-rates-file
title: Preparing a zone-to-zone rates file
category: Getting set up
audience: [admin]
tags: [rates file, rate table, zone rates, csv template, from zone, to zone, charge, driver rate, vehicle size, import rates, data preparation]
---

A rates file has one row per zone-to-zone rate with six columns, all required: Rate Name, From Zone, To Zone, Customer Charge ($), Driver Rate ($), Vehicle Size. Zone names must match zones on the step or already in Settings; vehicle sizes likewise. Speed (the service level) isn't in the file because old systems name services in their own words: pick it on each row after import.

Customer codes aren't in the file either; a loaded rate applies to every customer until you list codes on the row.

## Column reference

| Column | Required | Notes |
|---|---|---|
| Rate Name | yes | Unique within the step, e.g. CBD-North Shore Van Standard. |
| From Zone | yes | Exact zone name. |
| To Zone | yes | Exact zone name. A to B and B to A are two rows. |
| Customer Charge ($) | yes | Dollar sign optional. |
| Driver Rate ($) | yes | Courier pay for the leg. 0 if paid another way. |
| Vehicle Size | yes | One vehicle size name per row. Add more sizes on the row afterwards if the rate covers several. |

## From a rate matrix

Most systems export rates as a grid (zones down the side, zones across the top). Unpivot it to one row per cell before importing: a spreadsheet pivot or a short script does it.

## After loading

Set the speed on every row (there is no apply-to-all for speed yet) and send. Settings may warn about similar rates; the warning stays on the row.
