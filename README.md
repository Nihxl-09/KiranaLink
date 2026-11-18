# KiranaLink — Customer, Retailer and Portal

A React Native / Expo monorepo for two connected apps, with Android, iOS, and web targets, plus a shared web entry portal:
- `apps/customer` — customer shopping experience
- `apps/retailer` — retailer operations experience
- `apps/portal` — shared customer/retailer entry page
- `packages/ui` — shared UI and design tokens
- `packages/backend` — typed Supabase client and commerce operations
- `supabase/migrations` — relational schema, RLS policies and transactional RPCs

## Requirements
- Windows 10/11
- Node.js 24 and npm 11
- VS Code
- Android Studio (Android emulator) or Expo Go on an Android phone
- A Supabase project for authentication and cloud data

## Web apps

Start a web app in a browser:

```powershell
npm run customer:web
npm run retailer:web
npm run portal:web
```

The portal runs at `http://localhost:8084` and links to the Customer app at `http://localhost:8082` and Retailer app at `http://localhost:8083` by default. It is an entry page; sign-in continues in the selected app so credentials and Supabase sessions are not passed between origins.

For production, set `EXPO_PUBLIC_CUSTOMER_APP_URL` and `EXPO_PUBLIC_RETAILER_APP_URL` to the deployed app URLs before building the portal. These public URL settings can be supplied through the build environment or by copying `apps/portal/.env.example` to `apps/portal/.env` and changing the values. The production build intentionally does not fall back to localhost when either URL is missing.

Create a static web export from an app folder with `npm run web:build` or the portal with `npm run portal:web:build`. Customer and retailer sessions in a browser use browser local storage; native apps continue to use SecureStore.

## Mobile first run

From this folder, install dependencies:

```powershell
npm install
```

Start the customer or retailer app:

```powershell
npm run customer
npm run retailer
```

Press `a` in the Expo terminal to open an Android emulator, or scan the QR code with Expo Go.

## Configure Supabase

1. Create a Supabase project and apply migrations `0001` through `0007` in numeric order.
2. Copy `apps/customer/.env.example` and `apps/retailer/.env.example` to `.env` in their respective folders.
3. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` using the project URL and client-safe publishable/anon key.
4. In Supabase **Authentication → URL Configuration → Redirect URLs**, allow `exp://**` for Expo Go development and `kiranalink://auth/callback` plus `kiranalink-business://auth/callback` for installed app builds. Remove localhost entries once no longer needed, and keep `Confirm email` enabled under the Email provider.
5. Restart Expo after changing environment values.

The mobile apps intentionally show a setup screen when those values are absent. Local `.env` files are ignored by Git. The `EXPO_PUBLIC_` Supabase URL and publishable/anon key are included in client builds and are not secrets; never put a service-role key, Razorpay secret, webhook secret, or other private credential in app code, a public environment variable, or a committed file.
Signup and password recovery links return to an app deep link using PKCE. The app rejects malformed email addresses before sending requests; only Supabase can verify that a correctly formatted address can actually receive mail.

Migration `0006_shop_owner_insert_policy.sql` restores the owner-only shop insert policy. Migration `0007_create_retailer_shop_rpc.sql` creates shops through an authenticated, owner-scoped database function that assigns `owner_id` from the verified Supabase identity.

## Merchant plans, advertisements and product pools

Migration `0005_merchant_growth_and_pools.sql` adds the merchant trial and plan catalogue, ad campaigns, pooled product reservations, RLS policies and transactional RPCs. The three-month ₹0 trial starts the first time a shop is published. Basic is ₹299/month and Advanced is ₹599/month. A shop without a valid trial or active subscription is hidden from customers and cannot accept orders.

Merchant subscriptions and advertisements use Razorpay-hosted checkout. Deploy these Supabase Edge Functions after applying the migration:

```powershell
supabase functions deploy create-merchant-subscription
supabase functions deploy create-ad-payment-link
supabase functions deploy cancel-merchant-subscription
supabase functions deploy razorpay-webhook
```

Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` as Supabase Function secrets. Never put them in either app’s `.env` file. Configure a Razorpay webhook pointing to `https://<project-ref>.supabase.co/functions/v1/razorpay-webhook` for:

- `payment_link.paid` and `payment_link.expired`
- `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.paused`, `subscription.resumed`, `subscription.cancelled`, `subscription.completed`, and `subscription.pending`

Razorpay signs each webhook; the function verifies the HMAC over the raw body and uses the event ID to prevent duplicate processing. Use Razorpay test credentials and a test webhook before switching to live credentials. The app must be deployed with these Edge Functions and webhook settings before subscription status or ad placement can update.

Ads start at ₹599 for seven days, with duration-based pricing computed by the database. A campaign becomes visible only after the verified payment webhook. Product pools reserve customer quantities without charging while the target is open; when the target is reached, the database locks stock and creates a standard cash/UPI order for each participant. Participants pay through the shop’s existing order flow after those orders are created. An expired or underfilled pool creates no order and takes no payment. Pool participation and payments have not been tested against a live Supabase or Razorpay project.

## Push notifications and development builds

Remote push notifications are not available in Expo Go. The apps now include Expo development-client support and internal Android APK build profiles. From each app folder, initialize its separate EAS project and build/install the custom development client:

```powershell
cd apps/customer
npx eas-cli@latest init
npx eas-cli@latest build --profile development --platform android
```

In a second terminal, repeat from the retailer app:

```powershell
cd apps/retailer
npx eas-cli@latest init
npx eas-cli@latest build --profile development --platform android
```

After installing the generated APK, start its matching Metro server from the monorepo root with `npm run customer:dev-client` or `npm run retailer:dev-client`. Device permission and an EAS project ID are required.

Configure Android FCM v1 credentials in EAS for each project before testing delivery. For actual delivery, deploy `supabase/functions/dispatch-push` and configure a Supabase Database Webhook for `public.notifications` inserts, posting to the function URL with an `x-push-webhook-secret` header. Configure `SUPABASE_SERVICE_ROLE_KEY` and `PUSH_WEBHOOK_SECRET` as Supabase Function secrets only, never in either app’s `.env` file. Web previews do not register native Expo push tokens.

## Implemented code paths

- Email/password customer and retailer sign-in and account creation.
- Email confirmation deep links, password recovery, malformed-email validation, and custom not-found screens.
- Shop onboarding, catalogue and shop-specific inventory management.
- Product photo selection and Supabase Storage upload with public reads and shop-member-only writes.
- Icon-led tab navigation and refreshed sign-in UX.
- Customer-visible order status history and push-event/token plumbing (push sending requires EAS and the Supabase webhook setup above).
- Shop publication requires a contact phone, street address, city/state, a fulfilment option, and an active in-stock product; this is enforced by the database as well as the retailer UI.
- Merchant trial and subscription status, Razorpay-backed sponsored store/product campaigns, Advanced team access and date-range reports, priority placement, and stock-checked product pools are implemented behind migration `0005`.
- Customer shop discovery, catalogue search, one-shop cart and server-validated checkout.
- Customer shop discovery shows published Supabase shops and their real catalogue items only; empty states never display fabricated products, prices, or stock.
- Pickup/delivery configuration, cash and manually verified UPI references.
- Order status transitions, retailer payment review, stock adjustment history, daily summary RPC and order-linked support tickets.

These flows are code prepared for deployment, not proof of a live service. Local `.env` files are ignored by Git; registration, deep links, RLS, and commerce flows still need device-level verification.

## Architecture decisions

- Two separate operational apps, one shared backend, and a portal that routes web visitors to the appropriate sign-in page.
- PostgreSQL is the source of truth for inventory and orders.
- Row-level security separates customer, retailer and shop data.
- Inventory is shop-specific; products are catalogue records.
- Order item prices are snapshotted at purchase time.
- Checkout, stock reservation, payment verification and order transitions run through authenticated database functions.
- Supabase sessions use Expo SecureStore; the app only receives the publishable/anon key.

## Remaining release gates

- Set the Customer/Retailer portal URLs to the actual production web deployments and test both routes.
- Verify email confirmation/recovery redirects, RLS, checkout, stock restoration and payment review on both apps against Supabase.
- Implement account anonymization with an approved retention policy and a separate admin dashboard with securely provisioned admin roles.
- Delivery is tracked through retailer-updated order statuses; courier dispatch/GPS tracking and automatic Razorpay collection for customer orders are not included. Subscription and ad checkout require Razorpay configuration and webhook deployment.
- Complete RLS/security review, accessibility/localization, privacy/terms/support processes, Android device end-to-end testing, monitoring and staged release before production.
