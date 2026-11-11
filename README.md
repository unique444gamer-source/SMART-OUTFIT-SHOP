# SMART OUTFIT — Full-stack starter

A fresh responsive fashion storefront and admin interface based on the supplied 33 reference screenshots. The frontend currently includes a working local demo flow (catalog, category filtering, sorting, wishlist, cart, checkout demo, account demo, product management, order status management). The Express/MongoDB API provides persistent product, auth, and order endpoints.

## Requirements
- Node.js 20+
- MongoDB 7+ (local or Atlas)

## Run locally
1. Copy `server/.env.example` to `server/.env` and set a strong `JWT_SECRET` and `MONGODB_URI`.
2. From the project root run `npm install`.
3. Run `npm install --prefix client` and `npm install --prefix server`.
4. Run `npm run dev`.
5. Storefront: http://localhost:5173 — API health: http://localhost:5000/api/health

## Production build
`npm run build` creates `client/dist`. Deploy the API with the `server` directory and set environment variables. Deploy the client as a static site and configure the API base URL/proxy before connecting the frontend to production endpoints.

## Important before launch
- The storefront demo currently persists cart, wishlist, sample products, orders and demo account in browser localStorage. It is not yet wired to the API.
- Checkout is a demo and does not collect payment. Integrate a supported Bangladesh payment provider (e.g. SSLCommerz or bKash merchant checkout) before accepting online payments.
- Add an admin bootstrap/role provisioning flow; never allow public self-registration as admin.
- Replace demo contact details and remote Unsplash images with your licensed product photos and real business information.
- Add validation, rate limiting, CSRF/security headers, email/SMS notifications, inventory reservation, backups, logging, privacy/terms pages and end-to-end tests before production.
- Visuals are a first implementation guided by the contact sheet; exact pixel matching requires reviewing each full-resolution reference screen against the rendered page and iterating.
