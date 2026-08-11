# The Learning Loft of Elk Grove — Project Guide

## Project Overview
Static HTML/CSS website for a homeschool enrichment program in Elk Grove, CA. No build system — plain HTML, CSS, and vanilla JS. Hosted on GitHub Pages. Backend via Supabase (database + Edge Functions) and Resend (email).

## Stack
- **Frontend:** Static HTML/CSS/JS — no frameworks, no bundler
- **Styling:** Single stylesheet at `css/styles.css` with CSS custom properties
- **Backend:** Supabase (project ref: `otmuflfpogtpkzqrclmm`, region: us-west-1)
- **Email:** Resend (notifications to info@thelearninglofteg.com)
- **Hosting:** GitHub Pages from `main` branch → https://ill57.github.io/learning-loft-elk-grove/
- **Live reload:** browser-sync on port 3001

## Design System — Magnolia Farmhouse

Every page and UI element built for this project — including admin pages, forms, dashboards — must match this design system. Do not introduce new fonts, colors, or component styles that aren't defined here.

### Color Palette
```
--parchment:       #FAFAF8  ← page background
--parchment-mid:   #F2EFE9  ← alternate section background
--parchment-card:  #EDE9E2  ← card/tan section background
--white-warm:      #FFFFFF
--border:          #D8C7AF  ← all borders and dividers
--gold:            #C5A45D  ← accent
--green:           #526447  ← primary brand color, CTAs, nav
--green-sage:      #9EAD93  ← secondary green, icons
--green-pale:      #D4EAC8  ← light green backgrounds
--green-dark:      #3A5426  ← dark green text
--terracotta:      #C07A5B  ← primary accent buttons
--terracotta-light:#E8DDCB  ← warm tan (CTA section bg)
--terracotta-dark: #A95F45  ← hover state
--brown:           #9A6A4B
--text:            #2F2A22  ← headings
--text-body:       #6E665A  ← body copy
--text-muted:      #9C8573  ← captions, labels
```

### Typography
- **Headings:** `'Cormorant Garamond', Georgia, serif` (`var(--font-head)`) — elegant, warm
- **Body:** `'Nunito Sans', system-ui, sans-serif` (`var(--font-body)`) — friendly, readable
- Both fonts are loaded via Google Fonts on every page

### Spacing & Shape
- **Border radius:** `--r-sm: 12px` / `--r-md: 18px` / `--r-lg: 24px`
- **Shadows:** `--shadow-sm` / `--shadow-md` / `--shadow-lg`
- **Max content width:** `1200px` (`var(--max)`)
- **Nav height:** `84px` (`var(--nav-h)`)

### Buttons
```html
<a class="btn btn--terra">Primary action</a>      ← terracotta fill
<a class="btn btn--green">Secondary action</a>    ← green fill
<a class="btn btn--outline">Subtle</a>            ← dark outline
<a class="btn btn--outline-light">On dark bg</a>  ← light outline (for green/dark sections)
```

### Section Backgrounds (use these, don't invent new ones)
- Default: `--parchment` (page bg, no class needed)
- Alternate light: `--parchment-mid` (`.section--alt`)
- Warm card: `--parchment-card` (`.section--tan`)
- Dark green: `--green` (`.section--dark`) — use `color: white`, `btn--outline-light`
- White: `--white-warm` (`.section--warm`)

### Eyebrow Labels
```html
<p class="eyebrow">Section Label</p>
```
Small caps, letter-spaced, green color. Used above every section heading.

### Cards
- Background: `var(--white-warm)` or `var(--parchment-card)`
- Border: `1px solid var(--border)`
- Border radius: `var(--r-md)` or `var(--r-lg)`
- Padding: `1.75rem` to `2.5rem`
- Shadow: `var(--shadow-sm)` default, `var(--shadow-md)` on hover

### Forms
- Input/select border: `var(--border)`, radius `var(--r-sm)`
- Focus ring: `var(--green)` outline
- Label: `font-weight: 700`, `font-size: .85rem`, `color: var(--text)`
- Submit button: use `.form-submit` class (green fill, full width)
- Section headings inside forms: `font-size: .85rem`, uppercase, `color: var(--text-muted)`

### Nav
- Always use the existing `<nav class="nav">` markup from any page
- Logo: `images/horizontal-nav-logo-soft-web-transparent.png` at `height: 74px`
- CTA links to `enrollment.html`, labeled **"Enrollment"** (owner reverted from "Join Interest List" after feedback). Active sitewide.

### Footer
- Always use the existing footer markup from any page
- Logo: `images/primary-logo-warm-web-ivory-bg.png` at `height: 64px`
- Instagram: https://www.instagram.com/thelearninglofteg

### Fade-up Animations
New content sections should use the `.fade-up` class on elements that should animate in on scroll. The JS in `js/main.js` handles the IntersectionObserver.

## Page Structure
Every page follows this shell:
```
<nav> → page hero or page-hero section → content sections → <footer>
```
Copy nav and footer from an existing page — don't rewrite them.

## File Structure
```
/
├── index.html, about.html, program.html, enrollment.html, contact.html
├── css/styles.css          ← single stylesheet, do not create new CSS files
├── js/main.js              ← shared JS (nav toggle, fade-up observer)
├── images/                 ← all brand assets
│   ├── program-icons/      ← SVG program icons
│   └── ...                 ← logos, photos
└── supabase/
    ├── functions/          ← Edge Functions (Deno)
    └── migrations/         ← SQL migrations (always add new ones, never edit old)
```

## Supabase / Backend Rules
- **Never** put the service role key in frontend code. It lives only in Edge Function secrets.
- The anon/public key (`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`) is safe to use in frontend JS for auth only.
- All form submissions go through Edge Functions, never directly to the DB from the client.
- RLS must be enabled on every table. Grant access explicitly — never rely on defaults.
- New database tables → new migration file with timestamp prefix (`YYYYMMDDHHMMSS_description.sql`). Never edit existing migration files.

## Pending TODOs
- [ ] Delete test submission (id: eaea48ce-9367-482d-9a94-a7064af21fec) from enrollment_submissions table — form is now confirmed working end-to-end in production (verified 2026-07-21), safe to delete from the admin page anytime
- [ ] Change admin account passwords from temp values (LoftDev#2026 / LoftOwner#2026) — do via Supabase dashboard → Authentication → Users
- [ ] Owner (info@thelearninglofteg.com) to create a personal Google Workspace email for day-to-day use; keep info@ for site/client contact
- [ ] Program page's Enrichment Studios cards still need real course descriptions from the owner for Word & World, Canvas & Curtain, and Lead & Launch (current bullet lists/tags are placeholders — Word & World's is newly drafted, Canvas & Curtain/Lead & Launch are left over from the old Art Fusion/Life Skills copy)
- [ ] Remove the "Time" column from the Program page's daily schedule table, and remove the "Morning Move & Groove" and "Closing Circle" rows entirely
- [ ] `enrollment-forms-download` branch (uncommitted to main) has the real enrollment PDF forms (Student Enrollment Form, Fee Schedule, Liability & Medical Authorization) with a date-gated reveal on enrollment.html set for Friday, August 14, 2026, 10:00 AM Pacific — needs merging before/around that date. **Merge conflict warning:** this branch and `admin-portal-updates` both modified enrollment.html independently (the latter renamed the page to "Online Application" and changed child fields to Name+Grade Level) — reconcile carefully rather than blindly taking one side.
- [ ] Square is only wired up with **Sandbox** credentials (`SQUARE_ENVIRONMENT=sandbox`) — verified end-to-end (payment link creation + `initial_payment_received` auto-flip via webhook) with a real throwaway test submission and a Square sandbox test card. To go live: get production `SQUARE_ACCESS_TOKEN` + `SQUARE_LOCATION_ID` from the owner, register a **production** webhook subscription (same as sandbox but against `https://connect.squareup.com/v2/webhooks/subscriptions` instead of the sandbox host) for a new `SQUARE_WEBHOOK_SIGNATURE_KEY`, then set `SQUARE_ENVIRONMENT=production` and swap in the new token/location/signature key. No code changes needed — `SQUARE_ENVIRONMENT` already switches the base URL between `connect.squareupsandbox.com` and `connect.squareup.com`.

## Completed
- [x] Enrollment form with dynamic per-child name & age inputs
- [x] Supabase backend: enrollment_submissions table, RLS policies, Edge Function (submit-enrollment)
- [x] Resend email notifications → info@thelearninglofteg.com on each new submission
- [x] Admin dashboard (admin.html): Supabase Auth login + three tabs (Submissions, Enrolled Students, Leads & Outreach)
- [x] Submission status updates (New / Contacted / Enrolled / Declined) inline from admin
- [x] Fixed CORS issue blocking browser fetch to Edge Function
- [x] Custom Resend sending domain (thelearninglofteg.com) verified via Squarespace DNS; enrollment notifications now send from enrollments@thelearninglofteg.com instead of onboarding@resend.dev
- [x] Program page reworked to match owner's official schedule: renamed rotations (Roots & Research, Lead & Launch, Speak & Story/Canvas & Curtain), clarified Word & World and Closing Circle as shared blocks rather than rotations, removed grade-band references in favor of age-group language, added a Days/Hours/Location/How-to-Enroll info grid with a generated photo
- [x] Re-enabled Program nav link on the homepage placeholder (`index.html`) to point to the reworked program page
- [x] Real homepage content (from `homepage-copy-refresh` branch, ~11 owner-requested content items) merged to main, replacing the temporary "Under Construction" placeholder; Enroll Now links disabled sitewide on the restored homepage to match the rest of the site
- [x] About page content refresh (from `about-section-refresh` branch, owner-approved: reordered Our Story above Mission, green hero, new hero subtext, updated mission paragraph, repurposed mission cards with new icons, new Core Values list, real family photo) merged to main
- [x] Removed all em dashes sitewide per owner's request (a tell for AI-generated content) and applied her follow-up copy edits: homepage "Who We Are" heading/paragraph, Program page hero/schedule text and rotation card bullets/tags, corrected stale "2:30 PM" hours references, fixed a pre-rebrand enrollment form dropdown
- [x] Added Tuition & Fees, Program Calendar, and Affordability/Commitment content to `enrollment.html` from the owner's tuition doc; re-enabled all "Enroll Now" links sitewide (relabeled "Join Interest List" to accurately describe an interest form, not instant enrollment)
- [x] Replaced the enrollment form with the owner's new Pre-Enrollment Interest Form (2026–2027 school year): single Parent/Guardian Name field, new Days-per-Week/Tuition-Exchange/Charter-Program questions, dropped outdated fields. Full stack shipped: new Supabase migration, updated `submit-enrollment` Edge Function (deployed), updated `admin.html` display — verified end-to-end with a real test submission
- [x] Admin dashboard: added CSV export and status filters to the Submissions tab; restructured Enrolled Families into Enrolled Students (new `enrolled_students` table, one row per student with a required TK-6 grade level, payment tracking moved from per-family to per-student) with matching admin UI, grade/payment filters, and updated Add/Edit modal
- [x] Retired "Speak & Story" per owner's request (language/culture folded into the other studios instead of taught standalone): removed the homepage card, restructured the Program page's combined rotation card into "Canvas & Curtain" only, dropped the day-alternation framing, updated the "Five"→"Four" areas count and Program page meta description
- [x] Relabeled all "Join Interest List" / "Express Your Interest" CTAs and buttons sitewide back to "Enrollment" per owner feedback
- [x] Phase 1 of the full enrollment workflow (application → admin review → package sent / waitlisted / rejected): renamed "Pre-Enrollment Interest Form" to "Online Application" (per-child fields now collect Name + Grade Level instead of Name + Age), new `submission_students` table (one row per child), applicant now gets an acknowledgment email (previously only admin was notified), new `admin-submission-action` Edge Function handles all three review outcomes with admin-authenticated access, `enrolled_students` unified to a single `parent_name` field with new `documents_signed`/`initial_payment_received` tracking toggles in the admin UI. SignWell/Square wiring (Phase 2/3) still pending credentials — see Pending TODOs.
- [x] Legacy pre-schema-change submissions (19 real families from a CSV export, 29 children total) backfilled into `submission_students` against their existing `enrollment_submissions` rows — grouped correctly by family, grade level pre-filled with a best guess from the original free-text age and confirmed by admin at send-package time, original age text preserved in a new `notes` column
- [x] "Send Enrollment Package" now requires admin to confirm (or correct) each student's grade level via a mandatory inline dropdown before sending — prevents an imported/inferred grade from silently becoming the enrolled grade
- [x] Phase 2/3 (SignWell + Square) code built and deployed: `send_package` creates one SignWell signing document and one Square quick-pay link per student and emails both to the applicant; two new webhook Edge Functions (`signwell-webhook`, `square-webhook`) verify each platform's signature scheme and auto-flip `documents_signed`/`initial_payment_received` on completion. New `enrolled_students` columns: `signwell_document_id`, `signwell_signing_url`, `square_payment_link_id`, `square_order_id`, `square_payment_link_url`. Square (Phase 3) still pending credentials — see Pending TODOs.
- [x] Reformatted both `forms/enrollment-form.pdf` and `forms/liability-medical-authorization.pdf` (on `enrollment-forms-download`, not yet merged) via Claude Design: added branding/logo to the Enrollment Form, fixed cramped label/checkbox spacing on both so SignWell fields can be placed cleanly, kept multi-line sections from splitting across page breaks, and matched Emergency Contacts table styling/column proportions across both documents
- [x] Square Phase 3 built and verified in Sandbox: `send_package` creates a Square quick-pay link per student and `square-webhook` auto-flips `initial_payment_received` on a completed sandbox payment. Fixed two bugs found during testing: (1) the Square base URL was hardcoded to production (`connect.squareup.com`) — sandbox is a fully separate host (`connect.squareupsandbox.com`), not just a different token against the same URL, now switched via a new `SQUARE_ENVIRONMENT` secret; (2) both `signwell-webhook` and `square-webhook` only accepted POST and returned 405 on the GET/HEAD reachability check each platform's dashboard sends when a webhook URL is first registered, blocking subscription setup — both now return 200 on GET/HEAD while still requiring full signature verification on real POST events. Production Square credentials still pending — see Pending TODOs.
- [x] SignWell template built combining all 3 enrollment PDFs into one document with a single "Parent/Guardian" recipient role; `send_package` prefills `student_name`, `student_name_liability`, `parent_name`, `parent_phone`, `parent_email`, `parent_printed_name`, `parent_printed_name_liability` via `template_fields` (student name and printed name need `_liability`-suffixed duplicates since they appear on both PDFs within the same document and SignWell requires unique API IDs per document — no data source exists yet for Date of Birth or Home Address, so those stay manual-entry). `SIGNWELL_API_KEY`, `SIGNWELL_TEMPLATE_ID`, and `SIGNWELL_WEBHOOK_ID` are set and verified working end-to-end with a real throwaway test submission (document created, fields correctly prefilled, `documents_signed` auto-flipped to `true` via webhook after signing, test data cleaned up). Both webhook functions were also fixed to accept GET/HEAD reachability-check requests (previously returned 405, blocking webhook registration in both platforms' dashboards).
