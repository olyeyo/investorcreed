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
   `kv_store` table with Row Level Security, so each signed-in user can only
   ever see their own rows.

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

## Notes

- `xlsx` (SheetJS) parsing still happens entirely in the browser — the
  investor spreadsheet you import is never uploaded anywhere.
- Data model: everything the app previously kept in `window.storage` (pipeline
  contacts, imported directory) now lives in the `kv_store` table, one row per
  key, scoped to your `user_id`. If you outgrow this later, it's a natural
  migration path to proper relational tables (`contacts`, `directory`) with
  real columns and indexes instead of JSON blobs.
- The pipeline still comes pre-seeded with Sophia Amoruso, Kate McAndrew, and
  five pan-African investors on first load — that's `DEFAULT_CONTACTS` in
  `src/App.jsx`.
