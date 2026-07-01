## Scope

~25 features across UI polish, backend, and integrations. To keep quality up and let you test as we go, I'll ship in 5 phases. You approve this plan once; I execute Phase 1 → 5 without stopping unless a blocker requires your input (e.g. connecting Twilio/OneDrive).

---

## Phase 1 — Communication & notifications (ships first)

1. **Staff chat** — new page, realtime, message-type flag (`message` vs `question` rendered in a different color). Master picks retention: manual / 24h auto-purge / N-day auto-purge. Cron via pg_cron.
2. **Circulars pinned to top of every page** — replaces current banner. Two types: `pinned` (stays until deleted) and `general` (auto-expires 24h). Principal/vice chooses at post time.
3. **Attendance-not-submitted alert (principal/vice)** — homepage widget: today's date → any class with no attendance row → shows class + assigned teacher + phone + one-tap WhatsApp reminder with class name pre-filled.
4. **Approval notifications on homepage** — leave approved/rejected and print-ready appear on requester's home with timestamp, approver name, and reason (for rejections). Uses realtime.
5. **Remove tagline** ("الذكاء الذي يرصد نبض المدرسة") from AppShell header; keep only on homepage hero.
6. **Remove greeting logo** next to "أهلاً …".

---

## Phase 2 — Master control panel

7. **Create user from dashboard** (no self-registration needed) via Auth Admin API.
8. **Disable/suspend features** — `feature_flags` table, per-feature toggle + custom suspend message.
9. **Edit app name** & **About text/contact** from Settings → Branding.
10. **Upload school header, footer, and per-approver signatures** — used in all generated PDFs. Header goes in Branding; signatures go on each approver's profile (upload UI in Users panel for master, own profile for principal/vice).
11. **Feature-info popups** — small (?) button next to each homepage feature card → dialog with usage explanation. Content editable by master.
12. **Medical/chronic info on student profile** — new fields (`medical_conditions`, `emergency_steps`) master-editable, visible to all staff.

---

## Phase 3 — Smart features

13. **Event documentation (توثيق فعالية)** — teacher submits `event_name` + `description`; principal/vice approves or requests edits. On approval → generate PDF with school header, dates, description, approver signature, EduPulse footer. Stored & visible to submitter + principal.
14. **Smarter behavior predictor** — combined risk score = behavior points + attendance rate (weighted). New visualization: risk trend chart per student, class heatmap, top-5 improving/declining. Better UI with progress rings + sparklines.
15. **Teacher homepage: today's schedule** with live "next class in X min" timer; upcoming class highlighted; remove full-week from homepage (keep it under الجدول).
16. **Circulars pinned at top of every page** (covered in Phase 1).
17. **Smarter reports** — filter builder: type (student / class / teacher / daily / weekly / date range) → generates on-screen table + printable PDF with school header.
18. **Schedule 3-tab view** — Own / Daily-by-class / Full-school. Master can upload an image of the schedule as an alternative to building it manually.
19. **Facility daily grid** — hour-slot table showing available/booked slots with booker name and time.
20. **Fix lesson planner print clipping** — proper `@page` margins, page-break rules, print-only stylesheet.

---

## Phase 4 — Data seeding & polish

21. **Expanded demo data** — sample attendance (7 days), print requests, leave requests (some approved/rejected), event submissions, behavior incidents spanning severity levels, bookings.
22. **Remove class comparison chart** (الغياب والتأخر آخر 30 يوم).
23. **UI polish pass** — verify homepage cards, spacing, RTL, mobile.

---

## Phase 5 — Integrations (require your action)

24. **OneDrive optional archive** — Master-only "Archive to OneDrive" button on generated PDFs. Requires you to connect your ministry Microsoft account via the connector when we get to this step. I'll pause and prompt you.
25. **SMS via Twilio** — "Send SMS" button next to every "Send WhatsApp" button (leave/print approvals, attendance reminders, parent behavior alerts). Requires you to:
   - Connect Twilio via the connector
   - Provide a Twilio phone number capable of sending to Bahrain (+973)
   - Fund the Twilio account
   I'll pause and prompt you when we reach this step. Cost: ~$0.03–0.08 per SMS.

---

## Technical notes

- **New tables:** `chat_messages`, `chat_settings`, `feature_flags`, `event_submissions`, `notifications`, `feature_help` (for popups). Extends: `students` (medical), `profiles` (signature_url), `circulars` (pinned bool + auto-expire), `app_settings` (app_name, header_url, footer_config, about_content).
- **New server fns:** `admin.createUser`, `admin.setFeatureFlag`, `events.submit/approve/reject`, `events.generatePdf`, `reports.build`, `notifications.markRead`, `chat.purge` (cron).
- **PDF generation:** server-side using `pdf-lib` (Worker-compatible). Header image + signature composited per doc.
- **Realtime:** Supabase channels for chat, notifications, circulars.
- **Auto-expire (24h circulars, chat retention):** `pg_cron` scheduled jobs.

## What I need from you mid-flight

- **Phase 5 only:** connect Twilio + OneDrive when I prompt. Everything before Phase 5 runs without interruption.

## Not doing (out of scope unless you ask)

- Removing "first account becomes master" — already done in a previous turn; will verify.
- Changing app name from EduPulse — Phase 2 makes it master-editable but I won't rename it myself.

## Suggested additions (tell me yes/no, will not build without approval)

- **Parent portal** (read-only) — parents log in with their phone to see their child's attendance/behavior/circulars.
- **AI weekly digest** — every Sunday, AI summarizes each class's week for the principal (attendance trend, top incidents, top improvers).
- **Substitute teacher auto-suggest** — when a teacher submits leave, AI suggests available substitutes based on schedule gaps.
- **Voice-to-text incident logging** — teacher taps mic, dictates incident, AI structures it into the form.
- **QR-code attendance** — student shows QR badge, teacher scans with phone camera; useful for high schools.

Reply "go" to start Phase 1, or edit the plan.