# Product scope and release gates

## Release 0.1 — Mobile foundation
- Two independently launchable Expo apps and a shared web entry portal for selecting Customer or Retailer.
- Shared visual tokens.
- Initial customer and retailer landing experiences.
- Initial PostgreSQL schema and restrictive RLS baseline.

## Release 0.2 — Identity and onboarding
- Prepared: email/password sign-in and account creation for both apps, app deep-link callbacks using PKCE, password reset, malformed-email validation, retailer shop setup, customer delivery addresses, and SecureStore-backed sessions.
- Remaining: verify Supabase redirect allowlists and email confirmation on devices; implement phone verification and account deletion.

## Release 0.3 — Catalogue and inventory
- Prepared: customer catalogue search/category filtering, retailer product and shop-specific inventory editing, and stock adjustment audit.
- Prepared: retailer product-photo selection and upload to a public Supabase Storage bucket, with shop-member write policies.
- Requires applying migration `0003_product_media.sql` and testing upload/read policies against the configured project.

## Release 0.4 — Orders
- Prepared: single-shop cart, server-side price verification and stock reservation, order status workflow, cash/manual UPI review, daily reports and order-linked support tickets.
- Prepared: customer-visible manual order timeline and database events for push notifications.
- Manual UPI confirmation does not move money. Automated refunds and payment-provider integration are not implemented.
- These flows have not been run against a live Supabase project.

## Production release gates
- Run end-to-end tests with independent customer and retailer accounts against Supabase, including email/deep-link confirmation, recovery, storage policies and order timelines.
- Deploy the push Edge Function, configure the notifications Database Webhook, and initialize EAS project IDs before push delivery can be tested.
- Account anonymization and a separate admin dashboard remain to be implemented.
- Delivery is retailer-managed status tracking; courier dispatch/GPS tracking and payment-provider integration are not included.
- Security review of every RLS policy.
- No service-role key in client applications.
- Server-side authorization and input validation.
- End-to-end tests on real Android devices.
- Accessibility checks and localization review; current icon navigation has labels, but a full audit remains outstanding.
- Privacy policy, terms, data deletion and support process.
- Crash monitoring and staged rollout.
- Payment provider verification before accepting real money.
