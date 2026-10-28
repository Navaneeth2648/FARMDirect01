# FARMDirect

A smart-agriculture platform and trusted marketplace for Indian farmers, verified buyers, storage and transport providers, experts and administrators.

It covers:
- **Marketplace:** produce lots, buyer requirements, offers and counter-offers, transparent pricing, orders with two-sided confirmation, delivery and quality inspection, payment tracking, disputes.
- **Storage:** nearby warehouse and cold-storage discovery and booking, with capacity control, digital receipts and release.
- **Transport:** quotes and delivery milestones.
- **Trust:** graduated verification, conditional business documents, fraud flags, restrictions and appeals.
- **Farm tools:** farm and crop management, crop-stage advisory, crop calendar, crop-aware weather, AI crop diagnosis, AI assistant, mandi prices, soil and water, satellite NDVI, alerts, schemes, knowledge centre, community, product verification, expert workspace.
- **Administration:** an admin console with role-based permissions and a platform-fee report.
- **Medha AI:** the in-app assistant (Gemini, server-side only) grounded in the user's farm, lots, offers, nearby verified storage, forecast, mandi prices, recent Crop Doctor checks and schemes. It suggests screens to open but never performs actions.
- **Quality grading:** farmers request an inspection; verified field agents, experts or authorised admins record crop-specific measurements, photos and a grade with reasons. Inspected grades are versioned and kept separate from farmer-reported values. Not an official certification.
- **Directory and inputs:** verified-buyer directory with enquiries; farm-input orders from verified dealers with atomic stock reservation.
- **Reference data:** Crop & Pest Guide (text entries pending expert review, images only with licence and credit) and official crop statistics (admin-imported with source, date, unit and status; empty until imported).
- **Public site:** homepage at `/` for signed-out visitors and a Learning Centre with 15 step-by-step guides at `/learn`.

The original browser-only prototype is kept for reference at `/marketplace/legacy`. `/marketplace` now goes to the real marketplace.

> **Honesty rule used throughout:** every external service is optional. When a service is not configured, the app shows a clear "not configured" state. It never shows invented weather, prices, diagnoses, products or dealers.

---

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Tailwind CSS 4, Vite 8, Leaflet (maps), lucide icons |
| Backend | Express 4 (TypeScript via `tsx`), zod validation, multer uploads |
| Database | SQLite through Node's built-in `node:sqlite` (no native build). Schema in `server/db/schema.sql`, written to be portable to Postgres |
| AI | Google Gemini (`@google/genai`), server-side only |
| Weather | Open-Meteo forecast and geocoding APIs |
| Market data | Agmarknet daily prices via data.gov.in |
| Satellite | Sentinel Hub Statistical API (Sentinel-2 L2A NDVI) |

```
server/
  app.ts             Express app: security headers, CSRF check, rate limits, /api routes, SPA serving
  index.ts           Entry point: bootstraps the super admin, starts background jobs
  config.ts          All environment configuration
  db/                schema.sql, seed.ts (crop catalogue, stage timelines, general guidance, central schemes)
  lib/               auth (sessions, RBAC), security (scrypt, HMAC, rate limit, audit), http helpers
  providers/         Adapters: weather, mandi, ai, sms, satellite (timeouts, retries, validation, API logs)
  services/          agroRules (weather × crop-stage rules), schedule (crop calendar), cropStage, notify
  routes/            REST API under /api/v1/*
  jobs.ts            Task reminders, forecast warnings, price-watch alerts, retention cleanup
  tests/             Vitest + supertest suite
src/
  App.tsx, components/   Original marketplace prototype (unchanged)
  platform/              New platform: api client, auth context, i18n, design system (ui.tsx), Layout, pages/
public/sw.js             Service worker: offline app shell + cached read-only farm data
```

## Quick start (development)

Requires **Node.js 22.13+** (24 recommended).

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run dev
```

This starts the API on :3001 and Vite on :3000, with `/api` proxied to the API. Open http://localhost:3000.

- **OTPs in development:** with no SMS provider configured, the code is shown on screen and printed in the API console.
- **Super admin:** create one with `npm run create-admin -- 9XXXXXXXXX <password> "Your Name"`, or set the `SUPER_ADMIN_*` variables.
- **Production-like local run:** `npm run build` then `npm start`. The API serves the built app on :3001.

**Local test accounts** were created in the development database (`data/farmdirect.db`, which is git-ignored) while this build was being verified. They exist only on this machine:

| Role | Phone | Sign-in |
|---|---|---|
| Farmer (older test account) | 9000000001 | password `devfarmer123` or SMS code |
| Farmer (registered through the new flow) | 9000000021 | SMS code only (no password set) |
| Verified buyer | 9000000031 | SMS code only |
| Storage provider (facility verified) | 9000000041 | password `devstorage123` |
| Super admin | 9000000009 | `/admin/login`, password `devadmin12345`, then the one-time code shown on screen |

In development the SMS code appears on screen because no SMS provider is configured. Delete `data/` to start with a clean database.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | API (watch mode) and Vite dev server |
| `npm run build` | Production build of the frontend into `dist/` |
| `npm start` | Production server (API and built frontend) |
| `npm test` | Backend test suite (60 tests: platform and marketplace workflows) |
| `npm run lint` | TypeScript type check of the frontend and backend |
| `npm run create-admin -- <phone> <password> "<name>"` | Create or promote a super admin |

## Configuration

All variables are documented in [.env.example](.env.example). Summary:

| Variable | Needed for | Without it |
|---|---|---|
| `APP_SECRET` | **Required in production.** Signs verification codes and hashes IPs | Server refuses to start in production |
| `DATABASE_FILE`, `UPLOAD_DIR` | Where data and photos are stored | Defaults to `./data` |
| `GEMINI_API_KEY` (+ `GEMINI_MODEL`) | Crop Doctor and AI assistant | Photos are stored and can go to experts, but there is no AI analysis; the assistant shows a setup notice |
| `DATA_GOV_IN_API_KEY` | Mandi prices | Mandi page shows a setup notice and an empty table |
| `OPEN_METEO_API_KEY` | Commercial weather use | Free non-commercial Open-Meteo endpoint is used |
| `SMS_PROVIDER` + MSG91 / Twilio keys | Real OTP SMS | Development: OTP shown on screen. Production: OTP login and registration disabled |
| `SENTINELHUB_CLIENT_ID/SECRET` | NDVI satellite statistics | Boundaries can be mapped; NDVI shows a setup notice |
| `SUPER_ADMIN_PHONE/PASSWORD` | Bootstrapping the first admin | Use `npm run create-admin` |
| `ADMIN_MFA` | Password + one-time code for administrators (default `on`) | `off` is for an isolated local machine only. In production, admin sign-in needs an SMS provider |
| `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET` | Online payment collection, verified by server-side signature and signed webhook | Payments are recorded by the payer and become "confirmed" only when the recipient confirms. No escrow either way |

## Marketplace, storage and trust

### Who signs in where

| Entry point | Who | How |
|---|---|---|
| `/login` → **I am a Farmer** (`/login/farmer`, `/register/farmer`) | Farmers, FPO managers | Mobile + SMS code (password optional). 4-step registration with progress saved on the phone and voice hints |
| `/login` → **I am a Buyer** (`/login/buyer`, `/register/buyer`) | Traders, wholesalers, retailers, processors, exporters, institutions, cooperatives | Mobile + SMS code, then business verification |
| `/admin/login` | Staff only (no public registration) | Password + one-time code. Lockout after 5 failures. 12-hour sessions |
| `/register/partner` | Storage operators, transporters, experts, dealers, field agents | Password + SMS code |

All of these use the same accounts, sessions and server-side role checks.

**Administrator roles and permissions:** super administrator (everything), platform administrator, verification officer, marketplace operations administrator, storage verification officer, dispute-resolution officer, finance and reconciliation officer, content and support administrator. The full matrix is in `server/lib/permissions.ts`. Only the super administrator manages administrators and fees. Changing or suspending an administrator signs them out immediately.

### Trust levels

- **Farmers:**
  1. Mobile verified.
  2. Profile complete (state, district, village). This level can publish and sell.
  3. Identity verified, through any government ID reviewed by staff. This level removes the per-order cap, ₹2 lakh by default.
  Land ownership and Aadhaar are not required.
- **Buyers** move through these states: mobile verified → documents pending → under review → verified, or more information needed, rejected (with a reason), suspended or deactivated. Required documents depend on buyer type, registration type and purchase size (PAN, GSTIN, FSSAI, registration certificate, authorisation). Format checks and cross-checks (PAN inside GSTIN, the same GSTIN on another account) are recorded for the reviewer. **A buyer is verified only by a reviewer's decision.** Unverified buyers can browse but cannot make offers, post requirements or see farmer phone numbers.
- **Storage facilities and transporters** are bookable only after staff approval. Changes to verification-sensitive details (address, capacity, licence, operator) wait for re-approval while the live listing stays unchanged.
- **Fraud safeguards:**
  - Automatic flags: registration bursts, listing bursts, exact duplicate lots (blocked), prices far from mandi data, offer floods (blocked), repeated cancellations, repeated non-delivery disputes, shared GSTIN/PAN.
  - User reports, restrictions with reasons, and appeals decided by a different reviewer.
  - Step-up SMS code for high-value confirmations and for cancelling confirmed orders.
- **Documents** are stored privately, outside the web root. They open only through 5-minute links signed for one user, permission is re-checked on every access, and each view or denial is logged.
- **Records that can't be changed:** `audit_logs` and the dispute timeline cannot be updated or deleted (enforced by database triggers).

### Transaction flow

1. **Lot:** the farmer publishes a lot (draft → published → offer received → negotiating → reserved / partly sold → sold, or expired / withdrawn).
2. **Negotiation:** offers and counter-offers keep a full history and an expiry time. Accepting creates an order and **reserves the quantity atomically**, so two buyers can't buy the same remaining stock.
3. **Confirmation:** both sides confirm the agreed terms, shown with a full cost breakdown: product value, each charge and who pays it, platform fee (0% by default), and tax on fees only. Unconfirmed reservations expire automatically.
4. **Changes after confirmation:** terms change only through an amendment the other party approves.
5. **Delivery:** the buyer records delivery and quality inspection. Settlement is recalculated on the accepted quantity.
6. **Payment and completion:** payment records are created from the agreed terms. The order completes only when payments are confirmed and no dispute is open.
7. **Disputes:** case timeline, evidence with access control, officer assignment, internal notes, decision, and one appeal reviewed by a different officer.

### Storage booking

- **Discovery:** map and list of verified facilities, filtered by distance, crop compatibility, dates, quantity, type and insurance.
- **Booking:** a 3-step wizard with a rate-card estimate and the cancellation policy. A request holds capacity for 48 hours while the facility decides.
- **Capacity:** checked per day against overlapping bookings and maintenance periods, inside a transaction, so overbooking is impossible.
- **Lifecycle:** requested → booking fee due → confirmed → check-in scheduled → in storage (with a digital receipt: quantity, condition, moisture, bin, photos) → release requested → released (final charges from actual days stored) → completed (once charges are paid).
- **Traceability:** every quantity, condition and status change is recorded with time and user.

### Price comparison

The comparison sorts selling options by **estimated net realization**. The options are: firm buyer offers, verified buyer requirements, recent official mandi prices, and storing now to sell later. For storage it shows a break-even price rather than a forecast. Unknown costs (transport without a rate or quote, mandi commission) are shown as unknown, never guessed. No future price is promised.

## Deployment (Render)

The existing Render service (`farmdirectykisan-connect-qd31.onrender.com`) used `vite preview`, which only serves static files. The platform now needs the Node server. [render.yaml](render.yaml) defines:

- Build: `npm ci --include=dev && npm run build`
- Start: `npm start`
- A **persistent disk** at `/var/data` for the SQLite database and photos. Without a disk, Render wipes the data on every deploy.
- Health check: `GET /api/health`

Set `GEMINI_API_KEY`, `DATA_GOV_IN_API_KEY`, the SMS variables, `SUPER_ADMIN_*` and (optionally) the `RAZORPAY_*` keys in the Render dashboard. **An SMS provider is required in production**: without it, OTP registration and administrator sign-in are refused.

**Backups:** copy `farmdirect.db` (or use `sqlite3 farmdirect.db ".backup backup.db"`) and the `uploads/` folder on a schedule.

**Scaling beyond one instance:** move to Postgres (the schema is portable), use Redis for rate limits, and use object storage (S3/GCS) for photos.

## Security and privacy

- Passwords are hashed with scrypt. Sessions use random tokens, stored only as SHA-256 hashes, in an httpOnly, SameSite=Lax cookie (Secure in production). Sessions are revoked on password reset or change and on suspension.
- OTPs are stored as HMACs, expire after 10 minutes, allow 5 attempts, and are rate-limited per number and per IP. Login and reset responses do not reveal whether a number is registered.
- **Role-based access control is enforced on the server** (`requireRole`). Professional roles (expert, dealer, field agent, FPO) need admin verification before they get privileged access. Only super admins can grant admin roles.
- Every input is validated with zod. All SQL is parameterised. State-changing requests from another origin are rejected. Security headers are set.
- Uploaded files are checked by their magic bytes (JPEG/PNG/WebP only, 8 MB limit), stored under random names outside the web root, and served only to the owner or to verified experts on a case the farmer opened. Owners can delete photos.
- Precise GPS is stored only after explicit consent. Users can export all their data and delete their account (cascading delete including photos).
- Admin, expert, moderation and verification actions are written to an audit log.

## Feature status

### Complete and verified end to end

- Registration with OTP, login (password or OTP), password reset, sessions, logout, password change.
- Eight roles with professional verification, plus role-aware navigation.
- Skippable onboarding: language, location with village search or GPS, farm, first crop, notification channels.
- Multiple farms and plots, crop cycles, edit-conflict detection (409 instead of silently overwriting), regional-fit warnings.
- Crop catalogue with 14 crops and crop-specific stage timelines. Current stage and progress are calculated from the sowing date.
- Crop calendar in list and month views:
  - generated tasks with no duplicates when a crop is rescheduled
  - past tasks backfilled as skipped
  - custom and repeating tasks, rescheduling, notes
  - daily due/overdue reminders
- Weather (live Open-Meteo):
  - current conditions, 24-hour and 9-day forecasts, charts, sunrise and sunset, UV
  - location search, saved farms, cache with a stale-data fallback
- Weather × crop-stage recommendations (irrigation, spraying windows, fertiliser timing, waterlogging, heat, cold, wind, harvest). Each one comes only from a crop/stage + weather rule and shows "Why".
- Forecast-derived farm warnings, labelled as not official IMD warnings.
- Personalised dashboard drawing on every module, with sources and timestamps.
- Soil tests with Soil Health Card rating interpretation and history comparison. Irrigation log with waterlogging notes.
- Farm operations: expenses, harvests and sales, activity log, profit summary by crop cycle. Estimates are kept separate from confirmed figures.
- Alerts:
  - verified alerts issued by admins or verified experts, deduplicated, with expiry
  - in-app fan-out, subscriptions, read/unread
- Notification centre with deduplication, quiet hours and per-channel delivery logs.
- Knowledge centre and news/events CMS:
  - workflow: draft → review → publish
  - safety-critical content must be published by an expert or admin
  - feedback, related items, bookmarks, recently viewed, share, listen (TTS)
- Government schemes directory (7 central schemes seeded, linking to official sites), with filters and a "last checked by admin" workflow.
- Product authenticity verification:
  - HMAC-checksummed codes, with only hashes stored
  - first scan reports genuine; repeat scans warn of a possible copied pack; forged or unknown codes are rejected
  - rate limits, an audit trail of attempts, suspicious-product reports
  - QR scanning via the browser BarcodeDetector API, with manual entry as fallback
- Product catalogue: admin-managed, manufacturer-sourced records with draft/published/withdrawn states.
- Service-provider directory: listing applications, admin verification, distance sorting, contact requests with phone sharing only by consent.
- Community: posts and replies, held-for-moderation spam/scam heuristics, auto-hide after 3 reports, an "expert verified" badge, moderation queue.
- Expert desk:
  - case queue, assign, reply (notifies the farmer), escalate
  - field visits, observations, follow-ups
  - confirm or correct AI diagnoses
  - advisory authoring and peer review
- Admin console: stats, registrations, module usage, API health, data freshness, users (role, suspend, verify), providers, content, schemes, products and code issuing, alerts, moderation, reports, integrations status, broadcast, audit log.
- Satellite: draw a plot boundary on an OpenStreetMap map, saved as GeoJSON.
- Accessibility and reach:
  - EN/HI/TE/ML navigation, large-text and high-contrast modes, keyboard focus styles, skip link
  - text-to-speech on advisories, alerts, schemes and assistant replies; speech-to-text in the assistant
  - mobile bottom navigation, on-device image compression before upload
- Offline: a service worker caches the app shell and read-only farm, advisory, task and scheme data. Changes made offline are never queued, so nothing is silently overwritten.

### Implemented but needs your API key (code complete; real output not tested here)

- **Crop Doctor AI:** Gemini multimodal diagnosis with a strict JSON schema, confidence handling, "retake photo" handling and background processing. Upload, storage, permissions and the not-configured path are tested.
- **AI assistant:** Gemini grounded in the farm, live forecast, stored mandi prices and advisory records, with citations, an escalation flag and history controls. The not-configured path is tested.
- **Mandi prices:** data.gov.in Agmarknet adapter. Parsing and validation are unit-tested; history accumulates from each fetch; includes watchlist alerts, comparison, share and data-error reporting.
- **SMS OTP:** MSG91 and Twilio adapters.
- **NDVI:** Sentinel Hub statistical time series with cloud masking.

### Partial or limitations

- **Government e-crop records** are not connected. `/api/v1/ecrop/status` reports this and lists what is needed: an authorised data-sharing agreement or API from the state agriculture department, farmer consent per retrieval, server-side credentials and a record mapping. Farmer-entered crops are always labelled as farmer-reported.
- **Crop statistics** show an empty state until an administrator imports rows from an official publication (Statistics page → Import, needs the `data.manage` permission).
- **Crop & Pest Guide** has 8 starter text entries marked "awaiting expert review" and no images. Images can be added only with a licence and credit.
- **Medha AI** answers need `GEMINI_API_KEY`. Without it, the page shows a setup notice and the server still returns suggested screens. Reply quality and language were not tested here without a key.
- **Input payments** create a payment requirement when the dealer confirms. Payment then uses the same payment-record flow as orders (gateway only if Razorpay is configured).

- **Translations:** navigation and common actions are in 4 languages. Most page body text and the seeded advisories are in English only. Advisory content in other languages must be written in the CMS and reviewed by experts (machine translation is deliberately not used for safety-critical text).
- **Seeded advisories** are general, non-chemical guidance marked "awaiting expert review". An agronomist should review them and add region- and variety-specific packages of practice. Stage durations are typical medium-duration values; tune them per region.
- **Schemes** are seeded from general knowledge and marked "not yet re-checked". An admin should verify each one against its official site.
- **Push and email notifications** are not implemented. In-app notifications work, and the SMS/email/push preferences are recorded and logged as `not_configured`.
- **Offline writes** are not queued. You must be online to save. Drafts of the sell wizard and registration are saved on the device.
- **Old prototype:** the earlier browser-only marketplace is kept at `/marketplace/legacy` with a clear "demo data" banner. Farmers' own listings from it can be imported as drafts from the Sell page; the prototype's demo listings are not imported.
- **Payments:** money is not collected by FARMDirect unless Razorpay is configured. No escrow is offered. Refunds are recorded and confirmed by the receiving party.
- **Transport:** milestones are recorded by the transporter and receiver. There is no live GPS tracking, and none is simulated. Distances are straight-line × 1.3 estimates.
- **Mandi comparisons** in "sell options" can't include travel cost to a mandi, because mandi locations aren't mapped.
- **Marketplace page body text** is in English. Notifications for marketplace events have short templates in all 4 languages.
- **Not built (needs regulated or partner integrations):** credit and insurance referrals, FPO bulk procurement, warehouse receipts financing, yield forecasting, crop-suitability analysis.
- OSM tiles are fine for light use. Use a licensed tile or imagery provider at scale.

## API overview

All routes are under `/api`. Everything except `/api/health` and `/api/auth/*` needs a session.

`/auth` (otp/request, register, login, login/otp, reset, change-password, logout, me) ·
`/v1/me` (profile, export, delete, saved, recent) ·
`/v1/dashboard` · `/v1/farms` (+ plots) · `/v1/cycles` · `/v1/tasks` · `/v1/records/{activities|soil-tests|irrigation|expenses|harvests}` · `/v1/finance/summary` ·
`/v1/weather` (+ geocode) · `/v1/crops` · `/v1/advisory` (+ my, review, soil/:id) · `/v1/market` (status, prices, history, compare, facets, watchlist, feedback) ·
`/v1/diagnosis` (upload, status, image, save, expert) · `/v1/assistant` (messages, conversations) ·
`/v1/alerts` (+ subscriptions) · `/v1/notifications` · `/v1/content` · `/v1/schemes` · `/v1/products` · `/v1/verify` (+ batches, report) · `/v1/providers` ·
`/v1/community` · `/v1/moderation` · `/v1/cases` · `/v1/expert` · `/v1/admin` · `/v1/satellite`

**Marketplace, storage and trust (added):**
`/auth` (+ login/mfa, set-password, step-up/request, step-up/verify) ·
`/v1/buyer` (profile, documents, accept-terms, submit) · `/v1/verification` (mine, farmer-identity) · `/v1/documents/:id` (link, file, delete) · `/v1/trust` (reports, restrictions, appeals) ·
`/v1/marketplace` (lots, lots/mine, lots/:id, publish, withdraw, photos, import-legacy, lots/:id/sell-options, demand, prices) ·
`/v1/offers` (create, preview, threads, :id/respond, :id/withdraw) · `/v1/orders` (list, :id, confirm, cancel, progress, deliver, complete, amendments, statement) ·
`/v1/storage` (facilities, check, bookings, cancel, extend, release-request, enquiries) · `/v1/storage/provider` (facilities, rates, blackouts, documents, submit, incidents, bookings decide / schedule-checkin / receive / movement / release / complete, receipts photos, enquiries) ·
`/v1/transport` (estimate, requests, accept-quote, confirm-delivery, cancel, provider/*) · `/v1/payments` (list, mark-paid, confirm-receipt, report-problem, gateway-order, gateway-verify) · `/api/webhooks/razorpay` ·
`/v1/disputes` (open, evidence, comments, appeal) · `/v1/ops/disputes` (assign, status, note, decide) ·
`/v1/grading` (criteria, requests, assign, results, results/:id/photos, review, cancel) · `/v1/guides` · `/v1/statistics` (+ import, batch delete) · `/v1/ecrop` (status, fetch → 503 not_configured) ·
`/v1/businesses` (directory, :userId/enquiries, enquiries, enquiries/:id/reply) · `/v1/inputs` (offers, offers/mine, orders, orders/:id/status, orders/:id/cancel) · `/v1/ops/revenue` ·
`/v1/ops` (verifications, facilities, bookings, lots, demand, orders, offers, payments + reconcile, transport-providers, fraud, reports, restrictions, appeals, settings, admins, audit, analytics, documents access log)

**Database migrations:** `server/db/migrations.ts` holds append-only migrations, applied once at startup and recorded in `schema_migrations`. `001_marketplace_trust_storage` adds account-security columns and about 35 tables: buyer profiles, verification, documents, fraud and appeals, lots, demand, offers, orders, storage, transport, payments, disputes. It also adds the append-only triggers. Existing records are kept.

`002_grading_guides_statistics_directory_inputs` adds `grading_requests`, `grading_results`, `field_guides`, `crop_statistics`, `business_enquiries`, `input_offers` and `input_orders`, plus `payment_records.input_order_id`. `003_medha_actions` adds `messages.actions` (the suggested screens stored with each Medha reply). No existing table or column is renamed or removed.
