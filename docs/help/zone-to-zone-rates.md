---
sourceId: setup-dashboard/zone-to-zone-rates
title: Zone-to-zone rates
category: Getting set up
audience: [admin]
tags: [zone rates, zone to zone, from zone, to zone, charge, driver rate, speed, service, vehicle size, customer codes, import rates]
---

A zone-to-zone rate prices a job from one zone to another for a given speed and vehicle size. It needs: a name, from zone, to zone, speed, at least one vehicle size, the customer charge and the driver rate. Customer codes are optional: blank means the rate applies to every customer.

Zones and vehicle sizes are named exactly as created on this step or already in Settings; a name that resolves to nothing holds the rate back.

## Driver rate

The driver rate is what the courier is paid for that leg; it is required because Settings requires it. Enter 0 if drivers are paid another way.

## Same rate both directions

Create two rows: A to B and B to A. The dashboard does not mirror.

## Importing rates

Import rates takes a file with Rate Name, From Zone, To Zone, Customer Charge, Driver Rate and Vehicle Size. Speed is not in the file (old systems name services in their own words); pick it on each row after import. Dollar signs in amounts are ignored.

## Similar-rate warnings

Settings may warn that a similar rate exists. The rate is still created and the warning stays on the row so you can check.
