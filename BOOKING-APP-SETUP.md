# Booking app setup

The booking app lives at `/app/` on the website. Before it can take bookings, it needs:

- **Supabase** (free): stores customer logins and bookings.
- **Gmail**: sends sign-in codes to customers and booking emails to home.holiday.help123@gmail.com.

Until this is done, the app shows "Bookings opening soon".

## 1. Gmail app password

Sign in to **home.holiday.help123@gmail.com**, then:

1. Go to https://myaccount.google.com/security and turn on **2-Step Verification** if it's off.
2. Go to https://myaccount.google.com/apppasswords, create one called `Home Holiday Help`, and copy the 16-letter password. You'll need it in steps 2 and 3.

## 2. Supabase

1. Sign up at https://supabase.com and create a **New project**:
   - Name: `home-holiday-help`
   - Region: **London**
   - Database password: anything strong. You won't need it for this setup.
2. **SQL Editor** → New query → paste everything from [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Authentication → Emails → SMTP Settings**: turn on **Custom SMTP**. Supabase's built-in email only sends a couple of emails an hour.
   - Sender email: `home.holiday.help123@gmail.com`
   - Sender name: `Home Holiday Help`
   - Host: `smtp.gmail.com`
   - Port: `465`
   - Username: `home.holiday.help123@gmail.com`
   - Password: the Gmail app password from step 1
4. **Authentication → Emails → Templates**: in **both** "Confirm signup" and "Magic Link", replace the message with:

   ```html
   <h2>Your Home Holiday Help sign-in code</h2>
   <p>Type this code into the booking app:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   ```

5. **Project Settings → API**: copy the **Project URL**, the **anon public** key and the **service_role** key, for step 3.

## 3. Vercel

In the `home-holiday-help` project, go to **Settings → Environment Variables** and add:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Project URL from Supabase |
| `SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (keep this secret) |
| `GMAIL_USER` | `home.holiday.help123@gmail.com` |
| `GMAIL_APP_PASSWORD` | the 16-letter app password |

Then go to **Deployments**, open the latest one, and click **⋯ → Redeploy**.

## Things to update later

- **Other babysitter's number**: `OTHER_SITTER_NUMBER` at the top of [`public/app/app.js`](public/app/app.js).
- **Sitters' weekly days and school holiday dates**: [`lib/schedule.js`](lib/schedule.js). Keep it in step with the Booking page.
