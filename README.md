# Outreach Terminal

Founder/investor outreach tracker, backed by Supabase so your data persists
across devices instead of living in one browser's localStorage.

## Security notes — read first

- **Never share your Supabase database password with anyone, including me.**
  It's for direct Postgres access (psql, ORMs, migrations) and isn't used
  anywhere in this app.
- The app only needs your **Project URL** and **anon/public API key**
  (Dashboard → Project Settings → API). These are meant to be public in
  client-side code — they're safe because Row Level Security (RLS) restricts
  what each signed-in user can actually read or write, not secrecy of the key.
- `.env.local` is gitignored. Never commit real keys — use `.env.example` as
  the template and set real values in Vercel's Environment Variables instead.

## 1. Set up the database

1. Open your project's SQL Editor: `https://supabase.com/dashboard/project/byygfvgqjtcajvlrhmcc/sql/new`
2. Paste the contents of `supabase/schema.sql` and run it. This creates a
   `kv_store` table with Row Level Security — it's now only used for one tiny
   flag (whether the default contacts have been seeded for you yet).
3. Then run `supabase/schema_v2_directory.sql` too (same place, new query).
   This adds the real tables: `contacts` (your pipeline), `directory_batches`
   (one row per spreadsheet you import), and `directory_investors` (the rows
   inside each import, linked back to its batch). All three have RLS scoped
   to your user, same as `kv_store`.

## 2. Restrict sign-ups to just you

By default Supabase Auth lets anyone sign up. Since this holds your investor
outreach data, lock it down:

1. Dashboard → **Authentication → Sign In / Providers → Email** → turn off
   "Allow new users to sign up".
2. Dashboard → **Authentication → Users → Add user** → create yourself
   manually with your email (send yourself an invite or set a password).

Now only accounts you create manually can sign in.

## 3. Get your API keys

Dashboard → **Project Settings → API**:

- **Project URL** — already filled into `.env.example`
  (`https://byygfvgqjtcajvlrhmcc.supabase.co`)
- **anon / public key** — copy it

## 4. Local setup (optional, to test first)

```bash
cp .env.example .env.local
# paste your real anon key into .env.local
npm install
npm run dev
```

Visit `http://localhost:5173`, sign in with the email you created in step 2 —
you'll get a magic link by email.

## 5. Commit and push to your repo

```bash
git init
git add .
git commit -m "Outreach terminal with Supabase backend"
git branch -M main
git remote add origin https://github.com/olyeyo/investorcreed.git
git push -u origin main
```

(If the repo already has a commit from GitHub's own setup — e.g. a README —
pull first: `git pull origin main --allow-unrelated-histories`, resolve any
conflict, then push.)

## 6. Deploy on Vercel

1. [vercel.com/new](https://vercel.com/new) → import `olyeyo/investorcreed`.
2. Vercel auto-detects Vite (build command `npm run build`, output `dist`).
3. **Before deploying**, add environment variables under
   Settings → Environment Variables:
   - `VITE_SUPABASE_URL` = `https://byygfvgqjtcajvlrhmcc.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (your anon key from step 3)
4. Deploy.

## 7. Point www.suckmill.com at it

Project → **Settings → Domains → Add** → `www.suckmill.com`.

At your domain registrar, add the DNS record Vercel shows you:

- **CNAME**: host `www` → value `cname.vercel-dns.com`
- Optional: **A** record on the root (`suckmill.com`) → `76.76.21.21`, then
  set it to redirect to `www` in Vercel's domain settings.

DNS can take minutes to hours to propagate.

## 8. Set up email reminders (Resend)

Marking a contact as contacted now sends you a reminder email at
olyeyo3@gmail.com, via a Vercel serverless function (`api/send-notification.js`)
— your Resend API key stays server-side and is never shipped to the browser.

1. Get an API key at [resend.com](https://resend.com) → API Keys.
2. In Vercel: Settings → Environment Variables → add `RESEND_API_KEY`
   (**no** `VITE_` prefix — that prefix is what tells Vite to expose a
   variable to the browser, which you don't want here).
3. Redeploy.
4. Note: `resend.dev` sender addresses only deliver to the email you signed
   up to Resend with, until you verify your own sending domain. For anything
   beyond testing, verify a domain in Resend and change the `from` address in
   `api/send-notification.js`.
5. Every send attempt (success or failure) is logged to the `email_log`
   table — run `supabase/schema_v3_email_log.sql` to create it.
6. Local testing: plain `npm run dev` (Vite) does **not** run `/api` routes.
   Use `npx vercel dev` instead if you want to test the email locally.

Tracking replies automatically (not just sends) would need real inbound email
infrastructure — a verified domain plus a webhook parsing incoming mail. That's
a bigger, separate setup; for now, replies are still tracked manually via the
"Replied" status in your pipeline.

- The **One-Pager** tab generates a print-ready investor teaser (Georgia
  serif, letter-size, its own light document styling deliberately separate
  from the dark app chrome) — edit fields on the left, "Export PDF" uses the
  browser's native print-to-PDF. It doesn't persist yet — refreshing resets it
  to the default draft — since that'd need its own Supabase table; say the
  word if you want that wired in.

## Notes

- `xlsx` (SheetJS) parsing still happens entirely in the browser — the
  investor spreadsheet you import is never uploaded anywhere.
- Data model: the pipeline lives in `contacts`, one row per person. Every
  spreadsheet you import becomes its own row in `directory_batches` (name, row
  count, import date) plus its rows in `directory_investors` — so importing a
  second or third spreadsheet never overwrites an earlier one, and you can
  delete a single batch (and its rows) without touching the others.
- Auth is email+password (see `AuthGate.jsx`) rather than magic-link, to avoid
  Supabase's shared-sender email rate limit during normal use — set your
  password directly in Authentication → Users in the dashboard.
- The pipeline still comes pre-seeded with Sophia Amoruso, Kate McAndrew, and
  five pan-African investors on first load — that's `DEFAULT_CONTACTS` in
  `src/App.jsx`.
