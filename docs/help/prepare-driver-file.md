---
sourceId: setup-dashboard/prepare-driver-file
title: Preparing a driver (courier) list file
category: Getting set up
audience: [admin]
tags: [driver file, courier list, driver roster, csv template, courier code, vehicle type, fleet, import drivers, data preparation, password]
---

A driver file has one row per courier. Required: First Name, Last Name, Email. Optional: Courier Code, Mobile, Vehicle Type, Vehicle Fleet. Passwords are never put in a file: after import every row shows "Needs: initial app password" and you type one (8+ characters) per courier on the step before sending.

Email is the courier's driver-app login and must be new; the first name + last name pair must not already be a courier.

## Column reference

| Column | Required | Notes |
|---|---|---|
| First Name | yes | A single "Name" or "DriverName" column is split at the last space. |
| Last Name | yes | |
| Email | yes | Driver-app login. Unique. |
| Courier Code | no | Your existing driver number. Blank takes the next number. Unique. |
| Mobile | no | |
| Vehicle Type | no | Free text, e.g. Van. |
| Vehicle Fleet | no | A fleet name on the step. Noted on the row; assign in Settings > Driver List after sending. |

## Common mistakes

- Drivers without an email: there is no login without one. Collect them before import.
- Two drivers with the same first and last name: Settings rejects the second. Add a middle initial.
- Shared or company email addresses: each courier needs their own.
