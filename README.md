# MedCore — Hospital Management System

A full-stack hospital management system with patient registration, doctor
scheduling, appointment booking, medical records, billing/invoicing, and an
admin analytics dashboard.

**Stack:** React (Vite) + Tailwind CSS on the frontend · Node.js + Express +
PostgreSQL + Prisma on the backend · JWT authentication with role-based
access control (Admin / Doctor / Receptionist).

> **Deploying to Vercel?** Skip to `backend-vercel/DEPLOY_VERCEL.md` — it
> uses a serverless-function version of this same API, since Vercel
> doesn't run always-on Express servers. Everything below this point
> describes local development with the standard Express backend.

---

## 1. What's included

| Module | Description |
|---|---|
| **Auth** | JWT login, role-based access (Admin, Doctor, Receptionist), email verification on signup |
| **Patients** | Register, search, view full patient history |
| **Doctors** | Profiles, specializations, weekly schedules, computed availability, deactivate/reactivate (preserves history) |
| **Profile** | Every staff member can edit their own name, phone, and profile photo |
| **Appointments** | Booking with automatic double-booking prevention, status workflow |
| **Medical Records** | Diagnosis, symptoms, prescriptions tied to patient + doctor + visit |
| **Billing** | Invoice generation, line items, partial payments, payment status |
| **Admin Dashboard** | Live stats, appointment trends, revenue trends, busiest doctors |
| **Audit Log** | Every create/update/delete is recorded with who + when |

---

## 2. Project structure

```
hospital-management-system/
├── backend/                  # Express API (always-on server)
│   ├── prisma/
│   │   ├── schema.prisma     # Full data model (10 tables)
│   │   └── seed.js           # Demo data generator
│   └── src/
│       ├── controllers/      # Business logic per module
│       ├── routes/           # Express routers + role guards
│       ├── middleware/       # auth, error handling
│       ├── utils/            # validation (Zod), code generators, audit log
│       ├── app.js
│       └── server.js
│
├── backend-vercel/           # SAME functionality, restructured as
│   ├── api/                  # Vercel serverless functions — use this
│   ├── lib/                  # folder instead of backend/ if deploying
│   ├── prisma/                # to Vercel. See DEPLOY_VERCEL.md inside.
│   └── DEPLOY_VERCEL.md
│
└── frontend/                 # React (Vite) SPA — works with either backend
    └── src/
        ├── api/              # Axios client + endpoint functions
        ├── context/          # Auth context
        ├── components/       # Reusable UI (modals, badges, tables, etc.)
        ├── layouts/          # Sidebar layout
        ├── pages/            # One file per screen
        └── App.jsx           # Routes + role-based access
```

**Which backend should you run?**
- **Local development, or deploying to Render/Railway** → use `backend/`
  (the setup instructions below are for this one)
- **Deploying to Vercel** → use `backend-vercel/` instead, and follow
  `backend-vercel/DEPLOY_VERCEL.md` for the full walkthrough (different
  environment variables, different connection string requirements)

They share the same Prisma schema and the same frontend works with
either — only the backend's internal structure differs.

---

## 3. Setup — Backend

### 3.1 Get a PostgreSQL database (pick one, free options shown)

- **Local**: install Postgres and create a database, e.g. `hospital_db`
- **Hosted (no local install needed)**: [Supabase](https://supabase.com), [Neon](https://neon.tech), or [Railway](https://railway.app) all offer a free Postgres instance in under 2 minutes — copy the connection string they give you.

### 3.2 Install & configure

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and set:
```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
JWT_SECRET="<any long random string>"
```

### 3.2.1 Set up email verification (Resend)

New accounts (self-signup and admin-added doctors) must verify their
email before they can log in. This requires a free Resend account:

1. Sign up at [resend.com](https://resend.com) — free tier is 3,000 emails/month
2. Create an API key, copy it
3. Add to `.env`:
   ```
   RESEND_API_KEY="re_your_key_here"
   RESEND_FROM_EMAIL="MedCore <onboarding@resend.dev>"
   FRONTEND_URL="http://localhost:5173"
   ```

**Note:** without verifying your own domain in Resend, the sandbox
sender (`onboarding@resend.dev`) can only deliver to the email address
you signed up to Resend with. This is fine for testing/demoing — sign up
to Resend using an email you can actually check. To send to any
recipient, verify a real domain in the Resend dashboard later (no code
changes needed, just update `RESEND_FROM_EMAIL`).

Demo accounts created by the seed script (below) are pre-verified and
skip this requirement entirely.

### 3.2.2 Note on profile photos & doctor deactivation

This version adds:
- A `profilePhoto` column on users (stores a Base64 image, no external
  file storage needed)
- Doctor deactivation via the existing `isActive` column

If you're upgrading an existing database rather than starting fresh, run:
```bash
npx prisma migrate dev --name add_profile_and_status
```
This is already covered if you're running the full migration sequence
below for the first time.

### 3.3 Create the database tables

```bash
npx prisma migrate dev --name init
```

This reads `prisma/schema.prisma` and creates every table for you.

### 3.4 Seed demo data (highly recommended for a demo)

```bash
npm run seed
```

This creates:
- 1 Admin, 1 Receptionist, 4 Doctors (different specializations)
- 6 Patients with full profiles
- 10 appointments (mix of past/completed and upcoming)
- Medical records for completed visits
- 6 invoices (some paid, some unpaid) — so the dashboard charts have real data immediately

**Login credentials (all use password `Password123!`):**
| Role | Email |
|---|---|
| Admin | `admin@hospital.com` |
| Receptionist | `reception@hospital.com` |
| Doctor | `doctor1@hospital.com` (through `doctor4@hospital.com`) |

### 3.5 Run the server

```bash
npm run dev
```

API runs at `http://localhost:5000`. Check `http://localhost:5000/api/health`.

---

## 4. Setup — Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Opens at `http://localhost:5173`. The login page has one-click buttons to
autofill each demo account.

---

## 5. Demoing this to your manager — suggested flow

1. **Log in as Admin** → land on the Dashboard. Point out the live revenue
   chart, appointment trend, and "busiest doctors" widget — all computed
   from real database aggregates, not hardcoded.
2. **Patients tab** → register a new patient live, show the search.
3. **Appointments tab** → book an appointment: pick a doctor, pick a date,
   and show that only *actually open* slots are offered (the backend computes
   this from the doctor's weekly schedule minus existing bookings).
4. **Log out, log in as a Doctor** (`doctor1@hospital.com`) → show that
   doctors only see their own appointments, and can write a medical record
   for a patient (diagnosis, prescription).
5. **Log in as Receptionist** → create an invoice with multiple line items,
   show the auto-calculated subtotal/tax/total, then record a partial
   payment and show the status change from Unpaid → Partially Paid.
6. Mention the **role-based permissions** (try to access `/billing` as a
   Doctor — it redirects, because billing is receptionist/admin-only) and
   the **audit log** table tracking who changed what.

---

## 6. Why these technical choices (talking points for your manager)

- **PostgreSQL over MongoDB**: patients, doctors, appointments, and bills
  are inherently relational — an appointment *must* reference a valid
  patient and doctor, a bill *must* tie to a real patient. Postgres
  enforces this with foreign keys; a document database would require
  manually re-implementing those guarantees in application code.
- **Prisma ORM**: type-safe queries, migrations are version-controlled
  files (not manual SQL scripts), and the schema file itself doubles as
  living documentation of the data model.
- **Server-side total calculation on bills**: the API never trusts a
  client-submitted total — it recalculates subtotal/tax/discount from the
  line items every time, which prevents a tampered request from creating
  an incorrect invoice.
- **JWT + role middleware**: every sensitive route (`authorize("ADMIN")`,
  etc.) declares its allowed roles directly in the route file, so
  permissions are easy to audit by reading `routes/`.
- **Double-booking prevention**: appointment creation checks for time-range
  overlaps against the doctor's existing schedule before committing,
  not just exact-timestamp collisions.

---

## 7. Moving this to production later

- Swap the rate limiter / add Redis-backed sessions if you need to scale
  beyond a single server instance.
- Add email/SMS notifications for appointment confirmations (a good
  "phase 2" to mention if asked about roadmap).
- Add file uploads for lab reports / scanned documents (would need an
  object storage bucket, e.g. S3-compatible).
- Put the frontend behind a CDN and the backend behind a reverse proxy
  (Nginx) with HTTPS — both are standard but were left out here to keep
  local setup simple.

---

## 8. Troubleshooting

- **"Can't reach database server"** — double check `DATABASE_URL` in
  `backend/.env` and that your Postgres instance is running/reachable.
- **CORS errors in the browser console** — make sure `CORS_ORIGIN` in
  `backend/.env` matches the URL the frontend actually runs on (default
  `http://localhost:5173`).
- **Login works but every other page is empty** — check the browser
  console/network tab; usually means `VITE_API_URL` in `frontend/.env`
  doesn't match where the backend is actually running.
