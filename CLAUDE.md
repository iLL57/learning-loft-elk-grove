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
- "Enroll Now" CTA always links to `enrollment.html`

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
- [ ] Delete test submission (id: eaea48ce-9367-482d-9a94-a7064af21fec) from enrollment_submissions table — do this from the admin page once confirmed working in production
- [ ] Change admin account passwords from temp values (LoftDev#2026 / LoftOwner#2026) — do via Supabase dashboard → Authentication → Users
- [ ] Owner (info@thelearninglofteg.com) to create a personal Google Workspace email for day-to-day use; keep info@ for site/client contact

## Completed
- [x] Enrollment form with dynamic per-child name & age inputs
- [x] Supabase backend: enrollment_submissions table, RLS policies, Edge Function (submit-enrollment)
- [x] Resend email notifications → info@thelearninglofteg.com on each new submission
- [x] Admin dashboard (admin.html): Supabase Auth login + three tabs (Submissions, Enrolled Families, Leads & Outreach)
- [x] Submission status updates (New / Contacted / Enrolled / Declined) inline from admin
- [x] Fixed CORS issue blocking browser fetch to Edge Function
- [x] Custom Resend sending domain (thelearninglofteg.com) verified via Squarespace DNS; enrollment notifications now send from enrollments@thelearninglofteg.com instead of onboarding@resend.dev
