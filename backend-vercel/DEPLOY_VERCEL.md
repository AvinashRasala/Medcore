# Deploying MedCore to Vercel (Frontend + Backend, both serverless)

This guide covers deploying **both** the frontend and the backend to
Vercel. The backend lives in `backend-vercel/` — a serverless-function
version of the original Express API, restructured specifically for
Vercel's runtime model.

> **Note:** the original `backend/` folder (Express + Prisma, always-on
> server) is left untouched in case you ever want to deploy it to a
> platform built for long-running servers instead (Render, Railway). Use
> `backend-vercel/` for Vercel deployment.

---

## 0. Why this needed restructuring (read once, skip if you don't care)

Vercel runs **serverless functions** — each API call spins up fresh and
shuts down, no persistent process. The original Express app assumed one
long-running process with shared middleware. To deploy on Vercel:

- Routes are consolidated into **8 functions total** (`auth.js`,
  `patients.js`, `doctors.js`, `appointments.js`, `medical-records.js`,
  `bills.js`, `dashboard.js`, `health.js`), each handling multiple
  related operations via `?id=` / `?action=` query params instead of
  separate files per route. This is deliberate — Vercel's free Hobby
  plan caps a deployment at **12 serverless functions total**, and the
  straightforward one-file-per-route approach would have needed ~30.
- Auth/CORS/error-handling became plain function wrappers (`lib/auth.js`,
  `lib/cors.js`) called explicitly inside each handler, since there's no
  shared middleware chain.
- **Database connections must use Supabase's pooler** (port `6543`, not
  `5432`) — serverless functions can spin up many short-lived connections
  at once, and without pooling you exhaust Postgres's connection limit
  fast. This is the #1 thing that breaks silently if skipped.

---

## 1. Push your code to GitHub

Vercel deploys from a Git repository. If you haven't already:

```bash
cd hospital-management-system
git init
git add .
git commit -m "Initial commit"
```

Create a new repo on GitHub, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

---

## 2. Get your Supabase POOLER connection string

This is different from the direct connection you used for local development.

1. Open your Supabase project → click **Connect**
2. Find the **Transaction pooler** section (port `6543`)
3. Copy the string — it looks like:
   ```
   postgresql://postgres.qjserrzfqylrejylspdc:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
4. Replace `[PASSWORD]` with your real password (URL-encoded if it has
   special characters — `@` becomes `%40`, etc.)

**This is the URL you'll paste into Vercel's environment variables for the
backend — not the `db.xxx.supabase.co:5432` one you used locally.**

---

## 3. Deploy the backend (`backend-vercel/`)

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. When asked for the **Root Directory**, set it to `backend-vercel`
4. Framework Preset: choose **Other** (it's not Next.js/etc.)
5. Before clicking Deploy, expand **Environment Variables** and add:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | your Supabase **pooler** string from step 2 |
   | `JWT_SECRET` | any long random string |
   | `JWT_EXPIRES_IN` | `7d` |
   | `CORS_ORIGIN` | `*` for now (we'll tighten this in step 5) |
   | `NODE_ENV` | `production` |

6. Click **Deploy**

Vercel will run `npx prisma generate` automatically (set in `vercel.json`)
and deploy every file under `api/` as its own function.

**Copy the deployed URL** — it'll look like `https://medcore-backend.vercel.app`.

### 3.1 Run migrations against this database (one-time, from your computer)

Vercel doesn't run `prisma migrate dev` for you. Run it locally, pointed at
the same database:

```bash
cd backend-vercel
# create a temporary .env with the SAME pooler DATABASE_URL you used above
npx prisma migrate dev --name init
npm run seed
```

This creates the tables and demo data in your Supabase database — the
same one your deployed Vercel functions will read from.

### 3.2 Verify the backend is live

Visit:
```
https://medcore-backend.vercel.app/api/health
```
You should see `{"status":"ok", ...}`.

---

## 4. Deploy the frontend (`frontend/`)

1. Back in Vercel → **Add New Project** again
2. Import the **same repo**
3. Root Directory: set to `frontend`
4. Framework Preset: Vercel should auto-detect **Vite**
5. Add environment variable:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://medcore-backend.vercel.app/api` (your backend URL + `/api`) |
   | `VITE_DEPLOYMENT_TARGET` | `vercel` |

   **The second variable is critical** — without it, the frontend will
   call the old path-based URLs (`/patients/abc123`) instead of the
   consolidated query-param URLs (`/patients?id=abc123`) that
   `backend-vercel` actually expects, and every request will 404.

6. Click **Deploy**

You'll get a URL like `https://medcore-frontend.vercel.app`.

---

## 5. Lock down CORS (recommended, takes 1 minute)

Now that you have your real frontend URL, go back to the **backend**
project in Vercel:

1. Project → Settings → Environment Variables
2. Edit `CORS_ORIGIN`, change `*` to your actual frontend URL, e.g.
   `https://medcore-frontend.vercel.app`
3. Redeploy the backend (Settings → Deployments → re-deploy latest, or
   just push any small change to trigger it)

---

## 6. Test it

Open your frontend URL, log in with:
- `admin@hospital.com` / `Password123!`

If login fails, check the browser console / Network tab first — almost
all issues at this point are one of:

| Symptom | Likely cause |
|---|---|
| CORS error in console | `CORS_ORIGIN` on backend doesn't match frontend URL exactly (check for trailing slash) |
| Network error / failed to fetch | `VITE_API_URL` on frontend is wrong, or missing `/api` suffix |
| 500 error, "too many connections" | `DATABASE_URL` is using the direct connection (5432) instead of pooler (6543) |
| 401 on every request after login | `JWT_SECRET` differs between when you logged in and now (e.g. you changed it and redeployed) — log in again |
| Refreshing `/patients` gives 404 | Frontend's `vercel.json` rewrite rule missing — confirm `frontend/vercel.json` exists and was deployed |

---

## 7. Ongoing deploys

Every `git push` to your main branch automatically redeploys both
projects on Vercel — no manual redeploy needed after the first setup.
