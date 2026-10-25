---
sourceId: setup-dashboard/setup-dashboard-overview
title: What the Setup Dashboard is and how a setup runs
category: Getting set up
audience: [admin]
tags: [setup dashboard, onboarding, getting started, wizard, steps, new tenant, go live]
---

The Setup Dashboard is the step-by-step way to get a new company live on DFRNT. It opens from the Hub tile called Setup Dashboard, uses your normal Hub sign-in, and walks through eleven steps: Business profile, Team, Customers, Rates and zones, Schedules, Couriers and fleets, Agents and network partners, Automations, Integrations, App configuration and Training.

Each step creates real records in the app that owns them (Settings or Routed Operations) as you, row by row, and shows you the result of every row.

## What it does

- Collects the data for each step in a form, or loads it from a file with Smart Import.
- Checks each row against the owning app's own rules and holds back any row that is missing something, labelled "Needs: …".
- Creates the complete rows in Settings or Routed Operations when you press Save & send.
- Tracks progress: each step is Not started, Waiting on tenant, In progress or Done, and records what DFRNT asked you for.
- Carries a short checklist per step for work that has to be done in another app's screens, or by DFRNT.

## What it does not do

- It never invents a value. An empty required field stays empty and the row is held back.
- It never emails anyone until you tick the invite box on that row, and never before DFRNT has confirmed the tenant's own system settings.
- It never stores a courier's password after the courier is created, and never shows it back.
- Loading a file never sends anything anywhere. Only Save & send does.

## Order

Go in order the first time. Later steps look up what earlier ones created: rates need vehicle sizes and zones, schedules need depots and customers, partners need at least one customer to exist.
