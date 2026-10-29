---
sourceId: setup-dashboard/rates-apply-to-every-customer
title: Why a rate with no customer codes applies to every customer
category: Getting set up
audience: [admin]
tags: [applies to every customer, all customers, default rate, customer codes, client specific rate, restrict rate]
---

In Settings, a rate with no customer list is a default rate and applies to every customer, present and future. The dashboard keeps that rule and says so on each rate: a row with blank customer codes shows "Applies to every customer" before you send, and the created record is noted the same way. To restrict a rate, list the client codes of the customers it is for, comma separated.

Those customers must have been created on the Customers step in this setup so the dashboard can look up their ids.

## A customer created outside this setup

The dashboard can only resolve codes it created itself. For a rate restricted to a customer that already existed in Settings, create the rate as a default rate here and set its customer list in Settings > Rates & Pricing afterwards, or add the customer on the Customers step first.

## Fuel surcharges

A fuel surcharge takes one customer code, not a list. Blank means general.
