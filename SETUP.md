# Deploying — Vercel + Supabase, invite-only OTP

- **Host:** Vercel, at `https://forecasting.chris-apis.xyz`.
- **DB + auth:** Supabase. Login is a passwordless **email one-time code**.
- **Access:** **invite-only** — there is no public sign-up. An authenticated
  user invites a teammate from **Settings → Team access**; only **`@clay.com`**
  addresses can be invited or signed in. Auth emails come from
  **`no-reply@forecasting.chris-apis.xyz`** (custom SMTP).
- **Pipeline:** GitHub → Vercel. Push to `main` = production; PRs = preview URLs.

Enforcement layers: sign-in uses `shouldCreateUser:false` (no account, no code);
Supabase public sign-ups are disabled; the invite function only accepts
`@clay.com`; and **Row Level Security** blocks all data access unless the JWT
email is `@clay.com`. The anon key is safe in the client because RLS is the gate.

---

## 1. Supabase project + table + RLS

1. <https://supabase.com> → **New project** (e.g. `manager-forecasts`).
2. **SQL Editor → New query**, run:

```sql
create table public.forecast_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.forecast_kv enable row level security;

create policy "clay read"   on public.forecast_kv for select
  using      ( (auth.jwt() ->> 'email') ilike '%@clay.com' );
create policy "clay insert" on public.forecast_kv for insert
  with check ( (auth.jwt() ->> 'email') ilike '%@clay.com' );
create policy "clay update" on public.forecast_kv for update
  using      ( (auth.jwt() ->> 'email') ilike '%@clay.com' )
  with check ( (auth.jwt() ->> 'email') ilike '%@clay.com' );
create policy "clay delete" on public.forecast_kv for delete
  using      ( (auth.jwt() ->> 'email') ilike '%@clay.com' );
```

## 2. Auth configuration

**a. Disable public sign-up.** Authentication → **Sign In / Providers → Email**:
turn **off** "Allow new users to sign up". (Admin invites still work — they
bypass this. This is what makes it invite-only.)

**b. Put the code in the email.** Authentication → **Emails**:
- **Magic Link** template (used for the sign-in code) — include the token:
  ```
  Your sign-in code is: {{ .Token }}
  ```
- **Invite user** template — leave the link; you can add a friendly line.

**c. Custom SMTP so mail comes from your domain.** Authentication → **Emails →
SMTP Settings** → enable, and point it at a provider that has verified
`chris-apis.xyz` (Resend's free tier works well):
1. In the provider, **verify the domain `chris-apis.xyz`** by adding the SPF /
   DKIM (and DMARC) DNS records they give you. (You already control this domain
   for the Vercel host, so DNS is in the same place.)
2. In Supabase SMTP Settings, set:
   - **Sender email:** `no-reply@forecasting.chris-apis.xyz`
   - **Sender name:** `Forecast Cockpit`
   - host/port/username/password from the provider.
> Without custom SMTP, Supabase's built-in sender is rate-limited (a few/hour)
> and can't use your domain — so set this up before inviting real users.

**d. URLs.** Authentication → **URL Configuration**:
- **Site URL:** `https://forecasting.chris-apis.xyz`
- **Redirect URLs:** add `https://forecasting.chris-apis.xyz`,
  `http://localhost:5173`, and your Vercel preview pattern
  (`https://*.vercel.app`) for clicking invite/magic links.

## 3. Push to GitHub

```bash
git push -u origin feat/vercel-supabase    # then merge to main when ready
```

## 4. Import into Vercel + environment variables

Vercel → **Add New… → Project** → import the repo (Vite auto-detected; build
`npm run build`, output `dist`, both pinned in `vercel.json`).

Set env vars (Project → Settings → **Environment Variables**), for **Production
+ Preview**. Note the two groups:

**Client (must be `VITE_`-prefixed — these ship in the browser, safe by design):**

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<project>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the **anon public** key |
| `VITE_ALLOWED_EMAIL_DOMAIN` | `clay.com` |

**Server (NO `VITE_` prefix — used only by the `/api/*` functions, never shipped):**

| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | the **service_role** secret (Project Settings → API) |
| `ALLOWED_EMAIL_DOMAIN` | `clay.com` |
| `APP_URL` | `https://forecasting.chris-apis.xyz` |
| `AI_GATEWAY_API_KEY` | Vercel **AI Gateway** key (see below) — powers Suggest tips + Ask AI |
| `AI_MODEL` *(optional)* | a model id from your AI Gateway catalog, e.g. `anthropic/claude-sonnet-4.5` |

Deploy.

### AI features (Vercel AI Gateway)

"Suggest tips" and the **Ask AI** tab call models through the Vercel AI Gateway
from the `/api/ai` function — no model key in the browser, and the endpoint is
gated to signed-in `@clay.com` users. To enable:

1. Vercel dashboard → **AI Gateway** → create an **API key**.
2. Add it as `AI_GATEWAY_API_KEY` (server env, above). Optionally set `AI_MODEL`
   to any model in the gateway's catalog (default `anthropic/claude-sonnet-4.5`).
3. Redeploy. Until the key is set, the AI buttons fail gracefully and manual
   tip entry still works.

## 5. Attach the custom domain

Vercel → Project → **Settings → Domains → Add** → `forecasting.chris-apis.xyz`.
Add the CNAME (or A) record Vercel shows to `chris-apis.xyz`'s DNS. Once it
verifies, the app is live there over HTTPS.

## 6. Bootstrap the first user (you)

Invite-only has a chicken-and-egg: create the first account by hand.
Supabase → **Authentication → Users → Add user / Invite** → your `@clay.com`
email. Then open `https://forecasting.chris-apis.xyz`, enter that email, get the
code, sign in.

## 7. Invite the team

In the app: **Settings → Team access** → enter a teammate's `@clay.com` email →
**Invite**. They get an email from `no-reply@forecasting.chris-apis.xyz`, then
sign in with a one-time code. Non-`@clay.com` addresses are rejected.

## 8. Migrate the rescued data (when ready)

```bash
node scripts/backup-to-sql.mjs ~/Downloads/forecast-backup.json seed.sql
```
Paste `seed.sql` into Supabase → SQL Editor → Run. (`seed.sql` is gitignored —
it holds real data.)

---

## Local development

```bash
cp .env.example .env.local        # fill the VITE_ vars (and server vars if using `vercel dev`)
npm install && npm run dev        # http://localhost:5173
```
With no `.env.local`, the app runs on `localStorage` (no auth) for pure UI work.
To exercise `/api/invite` locally, use `npx vercel dev` with the server vars set.

## How auth works (recap)

1. User enters their `@clay.com` email → `signInWithOtp({ shouldCreateUser:false })`.
2. If they were invited (account exists) → Supabase emails a 6-digit code from
   `no-reply@forecasting.chris-apis.xyz`. If not → "ask an admin to invite you."
3. They enter the code → `verifyOtp` → session. RLS lets them read/write the
   `@clay.com`-only data.
4. Invites go through `/api/invite` (service_role, server-side), gated to
   authenticated `@clay.com` callers inviting `@clay.com` targets.

## Cost

Supabase free tier (500 MB DB, 50k MAU) and Vercel Hobby cover this comfortably;
the dataset is a few KB. (Custom SMTP provider may have its own free tier.)
