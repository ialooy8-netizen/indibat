
# Plan: Take Indibat (انضباط) Live

Rebuild the single-file HTML demo as a real multi-user school management web app, keeping the same visual language (glassmorphism, Arabic-first RTL, premium futuristic feel) and the same feature set, but with a real backend, real accounts, and real persistence.

**Cost:** $0 to start. Lovable Cloud has a generous free tier that easily covers 60 staff + 400 students at school-day usage levels. Microsoft sign-in is free.

**Scale target:** 60 staff users, 400 student records, 1 school.

---

## 1. Backend (Lovable Cloud)

Enable Lovable Cloud and create the following tables (Postgres, with Row Level Security):

- `classes` — id, name
- `students` — id, class_id, name, parent_phone, behavior_points, etc.
- `attendance` — id, student_id, date, period, status, recorded_by
- `behavior_incidents` — id, student_id, type (reward/infraction), points, severity, note, teacher_id, date
- `parent_comms_log` — id, student_id, type, sender_id, timestamp
- `resource_bookings` — id, employee_id, resource, day, period, status, unseen_admin
- `leave_requests` — id, employee_id, reason, status, dates
- `print_requests` — id, employee_id, file_url, copies, status
- `circulars` — id, title, file_url, posted_by, date
- `timetables` — id, scope (class/teacher), payload
- `facility_config` — periods per day, working days, etc. (Master-editable)
- `profiles` — links to auth user, stores display name + Microsoft email
- `user_roles` — separate table (security best practice): user_id, role enum (`master`, `principal`, `teacher`, `print_manager`)

All role checks done via a `has_role()` SECURITY DEFINER function and enforced in RLS — never trusted from the client.

## 2. Authentication (Microsoft ministry accounts)

- Microsoft (Azure AD) sign-in via Lovable Cloud's SAML SSO / OIDC provider so staff log in with their existing ministry email — no new passwords.
- First sign-in creates a `profiles` row automatically (DB trigger). Master assigns the role from the User Accounts screen before the user gets access to anything sensitive.
- No public sign-up — the auth page only offers "Sign in with Microsoft".

## 3. Frontend rebuild (TanStack Start + React, RTL Arabic)

Port every section from the demo into proper routes, preserving the design language:

- `/auth` — Microsoft sign-in
- `/` — role-aware dashboard (sidebar order driven by role, exactly as in the spec)
- `/attendance` — Fast Attendance & Rewards Grid (teacher's main screen)
- `/students` — student list + profile cards with live stats & timeline
- `/students/import` — single entry / bulk paste / Excel upload (SheetJS)
- `/behavior/predictor` — AI Behavior Predictor + WhatsApp gateway button
- `/timetables`, `/facilities`, `/leaves`, `/print`, `/circulars`, `/reports`, `/settings`, `/users`
- Notification badges in the sidebar driven by live counts from the DB.
- Charts via Chart.js / Recharts. WhatsApp links via `https://wa.me/`. File previews via Base64 or Lovable Cloud Storage.
- Full Arabic RTL, glassmorphism styling matching the demo.

## 4. Hosting & deployment

Published on Lovable's free `.lovable.app` subdomain. Optional custom domain later. Backend changes deploy automatically; frontend changes go live via the Publish button.

## 5. What stays free

- Lovable Cloud free tier: database, auth, storage, edge functions
- Microsoft sign-in: free (uses the tenant the ministry already provides)
- WhatsApp via `wa.me/` links: free (opens user's WhatsApp Web/app)
- Hosting on `.lovable.app`: free

## 6. Out of scope for v1 (can add later)

- Native mobile apps
- Push notifications
- Direct SharePoint/OneDrive sync (can be added via the Microsoft connector if desired)
- Real WhatsApp Business API (paid)

---

## Build order (so it's usable fast)

1. Enable Cloud + Microsoft sign-in + roles + profiles
2. Students / classes / Excel import
3. Attendance + Behavior grid (teacher's daily-use screen)
4. Student profile cards + timeline
5. Principal dashboard + AI predictor + WhatsApp gateway
6. Facility booking matrix + leaves + print + circulars
7. Reports hub + settings + user management

---

## Technical notes (for reference)

- TanStack Start (React 19, Vite 7) with file-based routing under `src/routes/`
- Tailwind v4, RTL via `<html dir="rtl" lang="ar">`
- Supabase under the hood (Lovable Cloud); roles enforced via RLS + `has_role()` SECURITY DEFINER, never client-side
- Microsoft sign-in configured via `supabase--configure_social_auth` (Azure AD); requires one-time tenant app registration — I'll provide the exact redirect URI to paste into the Azure portal
- SheetJS for `.xlsx` parsing client-side
- Charts via Recharts (already in the stack)

Ready to start with step 1 (enable Cloud + Microsoft auth + roles + first screens) on your approval.
