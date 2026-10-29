---
sourceId: setup-dashboard/customers-step
title: Customers: what each customer needs before it can be created
category: Getting set up
audience: [admin]
tags: [customers, clients, accounts, client code, address, invoice schedule, payment term, primary contact, booking sign-in, needs]
---

A customer is created in Settings > Clients & Customers when it has all of: client code, name, street address, suburb and city (in a US tenant: city and state), invoice schedule, payment term, a primary contact with first name and email, and the invite box ticked. Anything else is optional.

A row missing one of these is held back and labelled "Needs: …" with the field named; nothing is guessed or filled in for you.

## Optional fields

Unit or suite, post or zip code, country, latitude and longitude, phone, company email, invoice email, invoice method and notes. Latitude and longitude are not looked up for you; a customer created without them gets a note to set its map position in Settings before it is used on a client-address schedule.

## Codes and names must be unique

The dashboard checks client code, client name and contact email as you type and shows "already taken" where it can. The check covers inactive customers too. Settings has the final say when you send.

## Primary contact

The primary contact is the person who books jobs. Settings creates their booking sign-in with the customer and emails them an invite. That is why the row needs the invite tick before it is sent.

## Other booking contacts

Add extra contacts under the customer. Each needs a first name or surname and an email. They get no sign-in unless you tick "Sign-in + invite" on the contact.

## Apply to all

"Invoice schedule for all", "Payment term for all" and "Invite every primary contact when sent" set the value on every customer row at once.

## First customer on a brand-new tenant

Settings copies a site setting from an existing customer when it creates a new one. On a tenant with no customers at all the first create can fail with Settings' message on the row; DFRNT fixes it and you send again.
