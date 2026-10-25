---
sourceId: setup-dashboard/couriers-and-fleets-step
title: Couriers and fleets, and the initial app password
category: Getting set up
audience: [admin]
tags: [couriers, drivers, driver list, fleets, vehicle fleets, driver app, password, initial password, courier code, courier type, master, independent, gig]
---

Couriers are created in Settings > Driver List with a driver-app login. Each needs a first name, surname, email (their app login) and an initial password of at least 8 characters that you type. The password is sent once to create the login and is then forgotten by the dashboard; it is never shown again, so pass it to the courier yourself. No email is sent to a courier.

Fleets need only a name (50 characters or fewer); a depot is optional.

## Uniqueness

Email must be new, and the first name + surname pair must not already exist as a courier. Courier code is optional; blank takes the next number. The dashboard checks all three as you type.

## Courier type

Master (the default), Independent or Gig. Leave it blank for Master.

## Fleet assignment

Pick a fleet on the courier row if you like, but creating a courier can't set the fleet. After sending, assign couriers to fleets in Settings > Driver List; the row's note reminds you which fleet, and it's a Tenant checklist item on the step.

## Importing drivers

Import drivers takes First Name, Last Name, Email, and optionally Courier Code, Mobile, Vehicle Type and Vehicle Fleet. Passwords are never in a file: each imported row shows "Needs: initial app password" until you type one.
