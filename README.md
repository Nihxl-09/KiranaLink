# 🛒 KiranaLink
### Connecting Local Retailers with Digital Customers

**KiranaLink** is a multi-retailer commerce platform designed to bring local stores into one digital ecosystem. It enables customers to discover products across participating neighbourhood retailers while helping independent retailers manage their stores, inventory, orders, and promotions digitally.

Instead of depending on a single store, customers can explore alternative participating retailers whenever a product is unavailable.

<p align="center">
  <a href="https://kiranalink.vercel.app/">Customer Application</a> •
  <a href="https://kiranlink-1.vercel.app/">Retailer Application</a> •
  <a href="https://github.com/Nihxl-09/KiranaLink">GitHub Repository</a>
</p>

---

## 📌 The Problem

Local retailers often struggle with:
- Limited digital visibility.
- Manual inventory and order management.
- Difficulty competing with large e-commerce platforms.
- Limited access to digital marketing tools.

Customers also face difficulties finding products across different local shops, especially when their preferred retailer is out of stock.

## 💡 Our Solution

KiranaLink creates a connected digital marketplace for independent local retailers.

- Discover products from participating local stores.
- Explore alternative retailers when products are unavailable.
- Browse store-specific catalogues and product availability.
- Place orders directly with participating retailers.
- Give retailers digital tools to manage inventory, orders, and promotions.

---

## 🏗️ Platform Structure

KiranaLink consists of three applications:

### 1. Customer Application
- Discover local retailers and their products.
- Search and browse available products.
- Explore participating stores.
- Add products to a store-specific cart.
- Place orders and track order status.
- View order history.

**Live Application:** https://kiranalink.vercel.app/

### 2. Retailer Application
- Register and manage a retail store.
- Create and manage product catalogues.
- Update inventory and product availability.
- Receive and manage customer orders.
- Update order statuses.
- Review payments and sales summaries.
- Access subscription and promotional features.

**Live Application:** https://kiranlink-1.vercel.app/

### 3. Web Portal
A shared entry point that directs customers and retailers to their respective applications.

---

## ⚙️ Technology Stack

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

---

## 🧩 System Architecture

KiranaLink follows a shared-backend architecture with separate customer and retailer applications.

| Component | Responsibility |
|---|---|
| Customer App | Shopping, product discovery, and order management |
| Retailer App | Store, inventory, and order management |
| Shared Backend | Common business logic and data access |
| Supabase | Authentication, database, storage, and secure operations |
| Razorpay | Merchant subscription and advertising payments |

PostgreSQL acts as the central source of truth for inventory and orders.

Row Level Security (RLS) ensures that users can access only the data permitted by their roles.

---

## 📁 Project Structure

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

---

## 💰 Business Model

KiranaLink is designed around multiple revenue streams:

- **Retailer Subscriptions:** Paid plans for participating retailers.
- **Platform Fees:** Configurable fees on customer orders.
- **Sponsored Advertisements:** Promoted stores and products.
- **Promotional Campaigns:** Special offers and group-buying opportunities.

Subscription plans and transaction charges are configurable business-model components. Actual pricing and revenue depend on the commercial rollout.

---

## 🔐 Security and Reliability

- Supabase Row Level Security.
- Authenticated database operations.
- Shop-specific inventory management.
- Server-validated checkout.
- Secure payment webhook verification.
- Secure session storage on mobile.
- Private credentials stored as backend environment secrets.

---

## 🚀 Getting Started

### Requirements

- Node.js 24
- npm 11
- Visual Studio Code
- Android Studio or Expo Go
- Supabase project

### 1. Clone the Repository

```bash
git clone https://github.com/Nihxl-09/KiranaLink.git

cd KiranaLink
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Supabase

1. Create a Supabase project.
2. Apply database migrations in numerical order.
3. Configure customer and retailer environment files using their respective `.env.example` files.
4. Add the Supabase project URL and publishable/anon key.
5. Configure authentication redirect URLs.

### 4. Run the Applications

**Start Customer Application**

```bash
npm run customer
```

**Start Retailer Application**

```bash
npm run retailer
```

**Run Web Applications**

```bash
npm run customer:web
npm run retailer:web
npm run portal:web
```

---

## 🌐 Deploy Web Apps to Vercel

Create three Vercel projects connected to this repository, one for each application.

For every project, configure the Root Directory as the repository root (`.`) so npm can resolve shared workspaces.

### Build Configuration

| Vercel Project | Build Command | Output Directory |
|---|---|---|
| Customer | `npm run web:build --workspace @kiranalink/customer` | `apps/customer/dist` |
| Retailer | `npm run web:build --workspace @kiranalink/retailer` | `apps/retailer/dist` |
| Portal | `npm run portal:web:build` | `apps/portal/dist` |

### Environment Variables

**Customer and Retailer Projects**

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

**Portal Project**

```env
EXPO_PUBLIC_CUSTOMER_APP_URL=
EXPO_PUBLIC_RETAILER_APP_URL=
```

Use the deployed Customer and Retailer URLs in the Portal environment variables.

### Deployment Steps

1. Deploy Customer and Retailer applications first.
2. Configure the Portal environment variables using their deployed URLs.
3. Deploy the Portal application.
4. In Supabase Auth URL Configuration, allow each deployed application's `/auth/callback` URL.
5. Deploy Supabase migrations and Edge Functions separately.

**Note:** Vercel hosts the web exports only. Supabase migrations and Edge Functions must be deployed separately.

---

## 📊 Current Development Status

Implemented code includes:

- [x] Customer and retailer authentication.
- [x] Store registration and onboarding.
- [x] Product catalogue and inventory management.
- [x] Product image uploads.
- [x] Store discovery and product search.
- [x] Store-specific shopping carts.
- [x] Order placement and status management.
- [x] Payment review and inventory updates.
- [x] Retailer subscriptions and advertising infrastructure.
- [x] Product pools and promotional functionality.
- [x] Push notification infrastructure.

**Production Readiness:** Some integrations require additional production configuration and testing. Live payment processing, push delivery, and production deployment should not be considered verified until tested against their respective services.

---

## 🔮 Future Scope

- Consolidated multi-retailer shopping experience.
- Improved cross-store product discovery.
- Smart product recommendations.
- Advanced retailer analytics.
- Expanded promotional campaigns.
- Improved delivery coordination.
- Wider geographical expansion.

---

## 🎯 Vision

Our vision is to empower independent local retailers with accessible digital commerce tools while making neighbourhood shopping more convenient for customers.

<p align="center">
  <h3 align="center">KiranaLink — Bringing Local Stores Together.</h3>
</p>

---

## 🔗 Project Links

| Resource | Link |
|---|---|
| GitHub Repository | https://github.com/Nihxl-09/KiranaLink |
| Customer Application | https://kiranalink.vercel.app/ |
| Retailer Application | https://kiranlink-1.vercel.app/ |

---

<p align="center">
  Built with ❤️ to empower local businesses.
</p>
