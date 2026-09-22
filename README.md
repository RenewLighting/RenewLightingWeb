This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Employee portal and application login

The **Employee Login** navigation item opens `/employee`. Auth.js uses Google sign-in and accepts only Google-verified `@renewlighting.com` email addresses. After authentication, employees see an application launcher for Inventory and future internal tools.

The Inventory application is hosted at `https://warehouse.renewlighting.com`. The
portal creates a short-lived, signed `HttpOnly` cookie for the
`.renewlighting.com` domain before redirecting an authenticated employee to
Inventory. The Render service validates the cookie on every inventory request.

### 1. Rotate exposed credentials

If a Google client secret has ever been committed, open Google Cloud Console, rotate
the secret, and update the hosting provider. Removing it from the latest commit does
not remove it from Git history.

### 2. Configure Google OAuth

In Google Cloud Console, configure an OAuth 2.0 **Web application**:

- Add `https://renewlighting.com` as an authorized JavaScript origin.
- Add `https://renewlighting.com/api/auth/callback/google` as an authorized redirect URI.
- Add the equivalent `https://www.renewlighting.com` values only if `www` serves the application instead of redirecting to the root domain.
- Set the OAuth consent screen to **Internal** if `renewlighting.com` is managed by Google Workspace. Otherwise, keep the application in testing until it is ready for production and add employee accounts as test users.

### 3. Configure Vercel

Copy `.env.example` to `.env.local` for local development. In the Vercel project,
add the following variables to the Production environment:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://renewlighting.com
INVENTORY_ORIGIN=https://warehouse.renewlighting.com
WAREHOUSE_PROXY_SECRET=
```

Generate different random values for `NEXTAUTH_SECRET` and `WAREHOUSE_PROXY_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Run the command twice. Do not prefix these variables with `NEXT_PUBLIC_`. Redeploy
the Vercel project after saving them, and make sure `renewlighting.com` is assigned
to that production deployment.

### 4. Configure the inventory subdomain and Render

In Render, add `warehouse.renewlighting.com` as the warehouse service's custom
domain. Render will show the DNS record target required to verify it. At the DNS
provider that manages `renewlighting.com`, create the `inventory` CNAME record
with exactly that Render-provided target. Let Render issue its TLS certificate
before testing barcode scanning; phone cameras require HTTPS.

Set these warehouse service environment variables in Render:

```env
DATABASE_URL=
INVENTORY_REQUIRE_AUTH=1
WAREHOUSE_PROXY_SECRET=
```

Use the same `WAREHOUSE_PROXY_SECRET` value in Vercel and Render. Do not expose it
to browser code. The warehouse service's `/healthz` endpoint remains public for
Render health checks; all other pages and APIs require the signed employee cookie.

### 5. Verify production

After deploying both repositories:

1. Visit `https://renewlighting.com/employee` in a private browser window.
2. Confirm a verified `@renewlighting.com` account can sign in and open Inventory.
3. Confirm a non-company Google account receives an access-denied message.
4. Confirm `https://warehouse.renewlighting.com` returns `401` without first using the employee portal.
5. Confirm `https://warehouse.renewlighting.com/healthz` returns `200` for Render.
6. Exercise inventory page loads, API writes, barcode scanning, file uploads, and sign-out through `https://warehouse.renewlighting.com`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to optimize its local font assets.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

Never commit OAuth credentials or application secrets. If a credential is exposed in
Git history, rotate it immediately and store the replacement only in the hosting
provider's encrypted environment variables.