---
sourceId: setup-dashboard/prepare-team-file
title: Preparing a team (staff) list file
category: Getting set up
audience: [admin]
tags: [team file, staff list, user list, csv template, role, email, import team, data preparation]
---

A team file has one row per staff member. Required: First Name, Email, Role. Optional: Last Name, Job Title, Mobile. Role must be the exact name of a role on the Team step (create the roles first), or the row shows "Needs: a role called X on this step".

After import, tick "send sign-in invite" on each person; adding a person always emails them a Hub invite, and nothing is sent until the box is ticked.

## Column reference

| Column | Required | Notes |
|---|---|---|
| First Name | yes | A single Name column is split at the last space. |
| Last Name | no | |
| Email | yes | Their Hub sign-in. Unique across all contacts. |
| Job Title | no | |
| Mobile | no | |
| Role | yes | Must match a role name on the step. Also recognised as Department or Group. |

## Keep it to staff

Couriers go in the driver file, customer users in the contacts file. A team member is someone who opens Hub tiles.
