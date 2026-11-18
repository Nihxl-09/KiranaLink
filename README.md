# KiranaLink
### Connecting Local Retailers with Digital Customers
customer link:[KiranaLink](https://kiranalink.vercel.app/)
merchant link:[KiranaLink -Business](https://kiranlink-1.vercel.app/)
KiranaLink is a multi-retailer commerce platform designed to bring local stores into one digital ecosystem. It helps customers discover products across participating neighbourhood retailers while enabling independent retailers to manage their stores, inventory and orders digitally.

Instead of depending on a single store, customers can explore other participating retailers within the same platform when a product is unavailable.

## The Problem

Local retailers often struggle with digital visibility, inventory management and competing with large e-commerce platforms.

Customers also face difficulties finding products across different local shops, especially when their preferred retailer is out of stock.

## Our Solution

KiranaLink creates a connected digital marketplace for independent local retailers.

- Discover products from participating local stores.
- Explore alternative retailers when products are unavailable.
- Browse store-specific catalogues and availability.
- Place orders directly with participating retailers.
- Give retailers digital tools to manage inventory, orders and promotions.

## Platform Structure

KiranaLink consists of three applications:

### 1. Customer Application
- Discover local retailers and their products.
- Search and browse available products.
- Explore participating stores.
- Add products to a store-specific cart.
- Place orders and track order status.
- View order history.

### 2. Retailer Application
- Register and manage a retail store.
- Create and manage product catalogues.
- Update inventory and product availability.
- Receive and manage customer orders.
- Update order statuses.
- Review payments and sales summaries.
- Access subscription and promotional features.

### 3. Web Portal
A shared entry point that directs customers and retailers to their respective applications.

## Technology Stack

| Category | Technologies |
|---|---|
| Mobile Development | React Native |
| Framework | Expo SDK 54 |
| Web Development | React Native Web |
| Language | TypeScript |
| Navigation | Expo Router |
| Backend | Supabase |
| Database | PostgreSQL |
| Authentication | Supabase Auth |
| File Storage | Supabase Storage |
| Database Security | Row Level Security (RLS) |
| Payment Integration | Razorpay |
| Notifications | Expo Notifications |
| Secure Session Storage | Expo SecureStore |
| Build & Deployment | EAS Build |
| Package Management | npm Workspaces |
| Version Control | Git & GitHub |

## System Architecture

KiranaLink follows a shared-backend architecture with separate customer and retailer applications.

- Customer App: Customer shopping and order experience.
- Retailer App: Store and order management.
- Shared Backend: Common business logic and data access.
- Supabase: Authentication, database, storage and secure operations.
- Razorpay: Merchant subscription and advertising payments.

PostgreSQL acts as the central source of truth for inventory and orders. Row Level Security ensures that users can access only the data permitted by their roles.

## Project Structure

```text
KiranaLink/
│
├── apps/
│   ├── customer/       # Customer application
│   ├── retailer/       # Retailer application
│   └── portal/         # Shared web portal
│
├── packages/
│   ├── ui/             # Shared UI components
│   └── backend/        # Supabase client and operations
│
├── supabase/
│   ├── migrations/     # Database schema and policies
│   └── functions/      # Backend edge functions
│
├── docs/
│
├── package.json
└── README.md
```

## Business Model

KiranaLink is designed around multiple revenue streams:

- Retailer subscription plans.
- Platform fees on customer orders.
- Sponsored store and product advertisements.
- Promotional campaigns and group-buying opportunities.

Subscription plans and transaction charges are configurable business-model components. Actual pricing and revenue depend on the commercial rollout.

## Security and Reliability

- Supabase Row Level Security.
- Authenticated database operations.
- Shop-specific inventory management.
- Server-validated checkout.
- Secure payment webhook verification.
- Secure session storage on mobile.
- Private credentials stored as backend environment secrets.

## Getting Started

### Requirements

- Node.js 24
- npm 11
- VS Code
- Android Studio or Expo Go
- Supabase project

### Installation

Clone the repository:

```bash
git clone https://github.com/Nihxl-09/KiranaLink.git
cd KiranaLink
```

Install dependencies:

```bash
npm install
```

### Configure Supabase

1. Create a Supabase project.
2. Apply database migrations in numerical order.
3. Configure the customer and retailer environment files using their respective `.env.example` files.
4. Add the Supabase project URL and publishable/anon key.
5. Configure authentication redirect URLs.

### Run the Applications

Start the customer application:

```bash
npm run customer
```

Start the retailer application:

```bash
npm run retailer
```

Run the web applications:

```bash
npm run customer:web
npm run retailer:web
npm run portal:web
```

## Deploy web apps to Vercel

Create three Vercel projects connected to this repository, one for each app. For every project, set the Root Directory to the repository root (`.`) so npm can resolve the shared workspaces. Use the following build settings:

| Vercel project | Build command | Output directory |
| --- | --- | --- |
| Customer | `npm run web:build --workspace @kiranalink/customer` | `apps/customer/dist` |
| Retailer | `npm run web:build --workspace @kiranalink/retailer` | `apps/retailer/dist` |
| Portal | `npm run portal:web:build` | `apps/portal/dist` |

Add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the Customer and Retailer projects. Add `EXPO_PUBLIC_CUSTOMER_APP_URL` and `EXPO_PUBLIC_RETAILER_APP_URL` to the Portal project, using the deployed Customer and Retailer URLs. Deploy Customer and Retailer first, then configure and deploy the Portal. In Supabase Auth URL Configuration, allow each deployed app's `/auth/callback` URL. Vercel hosts the web exports only; Supabase migrations and Edge Functions must be deployed separately.

## Current Development Status

Implemented code includes:

- Customer and retailer authentication.
- Store registration and onboarding.
- Product catalogue and inventory management.
- Product image uploads.
- Store discovery and product search.
- Store-specific shopping carts.
- Order placement and status management.
- Payment review and inventory updates.
- Retailer subscriptions and advertising infrastructure.
- Product pools and promotional functionality.
- Push notification infrastructure.

Some integrations require additional production configuration and testing. Live payment processing, push delivery and production deployment should not be considered verified until tested against the respective services.

## Future Scope

- Consolidated multi-retailer shopping experience.
- Improved cross-store product discovery.
- Smart product recommendations.
- Advanced retailer analytics.
- Expanded promotional campaigns.
- Improved delivery coordination.
- Wider geographical expansion.

## Vision

Our vision is to empower independent local retailers with accessible digital commerce tools while making neighbourhood shopping more convenient for customers.

**KiranaLink — Bringing Local Stores Together.**

---

**Repository:** https://github.com/Nihxl-09/KiranaLink
