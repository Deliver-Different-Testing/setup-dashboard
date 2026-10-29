---
sourceId: setup-dashboard/zone-groups-zones-zips
title: Zone groups, zones and zips or post codes
category: Getting set up
audience: [admin]
tags: [zones, zone groups, zips, zip codes, post codes, postcodes, suburbs, areas, import zips, zone names]
---

Zones are organised as zone group → zone → zips. A zone group is a set of zones that belong together (for example Auckland Metro or DFW). A zone is a named area inside it (CBD, North Shore, Downtown). Each zone has a list of zip or post codes, one zip per entry, comma separated on the form. A zone-to-zone rate prices travel from one zone to another, so a zip that isn't in any zone can't be rated.

Zone groups and zones need only a name; zips are optional on the form but needed for pricing.

## Importing zips

Use Import zips on the step with a file of one row per zip: Zone Group, Zone Name, Zip / Post Code. Rows with no group or zone name are reported and skipped. Repeated zips within a zone are ignored.

## Existing zones

Zones already in Settings are listed on the step and can be used in rates by name. A zone group or zone with the same name as an existing one is reused.

## Which zips go in a zone

Every zip you expect to pick up from or deliver to. Zips can be split across zones any way you price, but one zip belongs in one zone within a group.
