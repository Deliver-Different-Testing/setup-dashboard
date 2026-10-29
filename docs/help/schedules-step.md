---
sourceId: setup-dashboard/schedules-step
title: Schedules: depots, origins and day windows
category: Getting set up
audience: [admin]
tags: [schedules, routed operations, depot, destination depot, pickup depot, origin, client address, direct, day windows, cutoff, default schedule]
---

A schedule is created in Routed Operations > Schedules (NEW). It needs a name, a destination depot, an origin type (depot, client address or direct), and at least one day window with a start and end time (24-hour HH:mm), one window per day of the week. Depot origin also needs a pickup depot. Client-address origin needs an origin depot and at least one customer code, and can't be the default.

Customer codes blank means it is the default schedule for every customer. Speed and booking cutoff are optional.

## Origins

- Depot: goods are collected at the pickup depot and delivered to the destination depot's region.
- Client address: collected at the customer's own address; name the depot that serves that area as the origin depot.
- Direct: point to point.

## Day windows

Tick the days the schedule runs and give each a start and end. A cutoff time (and cutoff day offset) is when bookings for that day close; leave it blank for none. Windows must be within one day; one window per day.

## Customers

Codes must be customers created on the Customers step in this setup. A schedule for a customer that already existed in Routed Operations is set up there.

## Duplicates

Routed Operations allows two schedules with the same name. The dashboard won't send a name it has already created, so re-sending is safe, but choose distinct names.

## Depots missing

If the depot pickers are empty, DFRNT hasn't created depots yet. It's a required item on the Business step.
