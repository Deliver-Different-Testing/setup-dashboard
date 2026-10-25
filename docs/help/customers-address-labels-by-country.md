---
sourceId: setup-dashboard/customers-address-labels-by-country
title: City and State, or Suburb and City: address fields by country
category: Getting set up
audience: [admin]
tags: [address, suburb, city, state, zip code, post code, US, NZ, australia, address fields, country]
---

The two required address fields after the street change label by country. In a US tenant they are City and State. Everywhere else they are Suburb and City. They are the same two fields underneath, so a file exported from a US system with City and State columns maps to Suburb and City in a non-US tenant, and the other way round. Post code or zip code is optional in both.

## Filling them in

- US: 123 Main St / Dallas / TX / 75001 → Street address, City, State, Zip code.
- NZ: 12 Queen St / Ponsonby / Auckland / 1011 → Street address, Suburb, City, Post code.
- Country is optional text; leave it blank if every customer is in the tenant's own country.

## In Smart Import

The customer file's "Suburb (US: City)" and "City (US: State)" columns are the same two fields. Map City → the first and State → the second for a US tenant.
