---
sourceId: setup-dashboard/rates-and-zones-step
title: Rates and zones: the order things are created in
category: Getting set up
audience: [admin]
tags: [rates, pricing, zones, vehicle sizes, fuel surcharge, zone rate, distance rate, speeds, services, rate card, order]
---

Rates and zones are created in Settings > Rates & Pricing in this order, because each later object refers to the earlier ones by name: vehicle sizes, then zone groups, zones and their zips, then fuel surcharges, then zone-to-zone rates, then distance rates. Enter them on the step in any order; Save & send creates them in that sequence and resolves names as it goes.

A rate that names a vehicle size or zone that doesn't exist yet, in Settings or on this step, is held back with "Needs: vehicle size X in Settings".

## Before you start

- Speeds (the services you sell, such as Standard or Same-day) must already exist. The dashboard picks from them and can't create one; that's a DFRNT checklist item.
- Depots must exist if any distance rate is tied to a depot.
- Customers that a rate is restricted to must be created on the Customers step first; rates refer to them by client code.

## Percentages

Fuel percentages are typed as percentages (12.5 means 12.5 %). The dashboard converts them for Settings.

## What is DFRNT-only here

Rate cards and the spreadsheet rate import are DFRNT-only in Settings and appear as a checklist item. NZ tenants' bulk zone rates have no form yet; DFRNT loads them.

## Already in Settings

The vehicle sizes and zones the tenant already has are listed on the step so you don't recreate them. A name that already exists is reused, not duplicated.
