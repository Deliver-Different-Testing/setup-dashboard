---
sourceId: setup-dashboard/team-roles-and-tiles
title: Team: roles, Hub tiles and people
category: Getting set up
audience: [admin]
tags: [team, roles, users, staff, hub tiles, access control, tile access, invite, role actions, tenant admin, operations]
---

The Team step creates roles, switches on the Hub tiles each role can open, then adds people to those roles. A role needs a name. A person needs an email, a first name, a role chosen from the roles on this step, and the "send sign-in invite" tick, because adding a person always emails them a Hub sign-in invite.

Roles are created in Settings as Tenant Staff roles; people are created as contacts on the tenant's own client file. No staff file is created, and no password is set: the invite does that.

## Roles

Start with two: an admin role and an operations role. New roles start with every tile denied; tick the tiles on the role. Some tiles show a condition in brackets (for example a feature that must be on for the tenant) and only work when it holds. If a role with the same name already exists in Settings it is reused: the tiles you ticked are switched on, none are switched off.

## People

Email is their sign-in and must not already be in use. Last name, job title and mobile are optional. A person whose role isn't on this step shows "Needs: a role called X on this step". People are sent after roles, so a role that failed holds its people back.

## What DFRNT does on this step

Role actions (View Financial Data, Manage Users, Edit Settings and so on) follow each tile unless switched off, and only DFRNT can change them, in Settings > Roles. It's a checklist item here.

## If the tenant has no client file of type Tenant

Every person shows "Needs: the tenant's own client file". DFRNT creates it (Business step checklist). If there is more than one, set the trading name on the Business step to match the right one.
