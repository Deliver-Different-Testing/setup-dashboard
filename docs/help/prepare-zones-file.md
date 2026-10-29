---
sourceId: setup-dashboard/prepare-zones-file
title: Preparing a zones and zips file
category: Getting set up
audience: [admin]
tags: [zones file, zip file, post code file, zone group, zone name, csv template, import zips, suburbs, data preparation]
---

A zones file has one row per zip or post code with three columns, all required: Zone Group, Zone Name, Zip / Post Code. Rows that share a zone name are gathered into that zone; rows that share a group name into that group. A row with no group or zone is reported and skipped; a zip repeated within a zone is ignored.

The file builds zones only; rates between them come from the rates file or the form.

## Column reference

| Column | Required | Notes |
|---|---|---|
| Zone Group | yes | e.g. Auckland Metro, DFW. Also recognised as Group or Region. |
| Zone Name | yes | e.g. CBD, North Shore, Downtown. Also recognised as Zone or Area. |
| Zip / Post Code | yes | One per row. Also recognised as PostCode, Zip, ZipCode. |

## From a suburb list

If your old system keys zones by suburb rather than post code, add a post code column from a public post code list before importing; the zone's membership is by zip.

## Sample rows

Auckland Metro, CBD, 1010
Auckland Metro, CBD, 1011
Auckland Metro, North Shore, 0620
