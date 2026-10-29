---
sourceId: setup-dashboard/invoice-schedule-and-payment-term
title: Choosing a customer's invoice schedule and payment term
category: Getting set up
audience: [admin]
tags: [invoice schedule, payment term, billing, invoicing, monthly, weekly, days, tenant default, apply to all]
---

Every customer must have an invoice schedule (how often they are invoiced) and a payment term (how long they have to pay). Both are picked from the lists the tenant already has in Settings; the one marked "(tenant default)" is the usual choice. If the right schedule or term isn't in the list it has to be added in Settings first; the dashboard can't create one.

Use "Invoice schedule for all" and "Payment term for all" to set the same value on every customer row.

## From a file

Customer files don't carry these two fields: old systems name them differently and the ids are the tenant's own. Import the customers, then set both with the apply-to-all pickers and adjust the exceptions by hand.

## Where it ends up

On the customer in Settings > Clients & Customers, where it can be changed at any time after the setup.
