![Ripple](mobile/assets/images/brand-banner.png)

# Ripple

**A real-time social feed app — post short thoughts, watch likes and comments ripple across every connected device in about a second.**

Full-stack TypeScript: Express 5 API on PostgreSQL with JWT + rotating refresh tokens, and a React Native (Expo) app styled with Tailwind. Push notifications via Firebase Cloud Messaging, live updates over WebSocket, transactional email via Firebase Auth + Resend.

## Try it in 60 seconds

- 📱 **Install the production app (Android):** [download APK](https://expo.dev/artifacts/eas/OLjXhgswGVEdNa1P1ukxA-mJYZq6iKL-0tGcid8FI8o.apk) — standalone, no setup, runs against the live API
- 🌐 **Live API:** `https://api.ripple.nafiziqbal.com` ([health](https://api.ripple.nafiziqbal.com/health))
- Sign up with a real email, post something, then like it from a second account — the push notification and the real-time feed update both land within a second.

## Features

**Product**
- Text posts (500 chars) in a shared feed — infinite scroll, pull-to-refresh, filter by author
- Like (optimistic, with a signature "ripple" animation) and threaded comments with pagination
- **Real-time**: other users' posts, likes, and comments appear within ~1s over WebSocket (60s polling fallback)
- **Push notifications** (FCM) when your post is liked or commented — tapping opens the thread
- In-app notification center with unread badge
- Email accounts: signup with mandatory email, login with username *or* email, account-creation email, and a fully in-app password reset (6-digit OTP by email → verify → new password)
- Delete your own posts; session survives app restarts

**Engineering**
- JWT access tokens (15 min) + **rotating refresh tokens** with reuse detection (a replayed token revokes every session for that user)
- Firebase Auth as the credential store (server-mediated via REST — no Firebase SDK in the app), Postgres as the domain store, graceful bcrypt fallback when Firebase is unconfigured
- OTP reset: hashed codes, 10-min expiry, 5-attempt lockout, single-purpose reset tokens, all sessions revoked on reset
- Rate limiting (credential endpoints 10/min per IP), `helmet`, Zod validation at every edge, uniform login errors with timing-safe comparisons
- Feed queries avoid N+1: counts, `likedByMe`, and comment previews computed in single queries (window functions, `ANY($1::int[])` batching)
- Push + email are fire-and-forget and degrade to log-only when unconfigured — the API never fails because a side effect did
- **42 integration tests** (Supertest against a real Postgres test database, including a live WebSocket test)

## Stack

| | |
| --- | --- |
| **API** | Node.js · Express 5 · TypeScript · PostgreSQL (`pg`, hand-written SQL) · Zod · `ws` · firebase-admin · nodemailer |
| **App** | React Native · Expo SDK 57 (expo-router) · TypeScript · NativeWind (Tailwind) · TanStack Query · expo-notifications |
| **Infra** | Docker Compose (Postgres) · EAS Build · Firebase (Auth + FCM) · Resend (SMTP) |
| **Testing** | Vitest 4 · Supertest · dedicated auto-created test database |

## Architecture

```
mobile (Expo)                      backend (Express)
┌─────────────────────┐            ┌──────────────────────────────┐
│ expo-router screens │── HTTPS ──▶│ routers → services → pg pool │
│ TanStack Query      │            │   Zod validation · ApiError  │
│ optimistic updates  │◀── WSS ────│ ws server ◀─ event bus       │
│ FCM device token    │            │   (decoupled via emitter)    │
└─────────────────────┘            └──────┬───────────┬───────────┘
                                          ▼           ▼
                                   PostgreSQL   Firebase (Auth+FCM) · Resend
```

- **Layered modules** (`auth`, `posts`, `notifications`): thin routers → services holding business logic → one migrated connection pool. Swapping any external service touches one module.
- **Realtime is decoupled**: domain services emit typed events to an in-process bus; the WebSocket layer subscribes. Feed events broadcast; notification events target only the recipient's sockets.
- **Auth split**: Firebase owns passwords (so reset genuinely works), Postgres owns identity (username, profile, relations), our JWT layer owns sessions. The mobile client auto-refreshes on 401 with a single-flight rotation and logs out when rotation fails.

## Running locally

**Backend** (needs Docker):
```bash
cd backend
pnpm install            # or npm install
docker compose up -d    # PostgreSQL 16 on host port 5433 (avoids clashing with a local 5432)
cp .env.example .env    # dev defaults work out of the box
pnpm dev                # → http://localhost:4000
```
Schema migrates automatically on boot. Without Firebase/SMTP credentials everything still runs: pushes and OTP emails print to stdout instead of sending.

**Mobile:**
```bash
cd mobile
npm install
npx expo start          # scan the QR with Expo Go (same Wi-Fi — API host auto-detected)
```
Point at any API with `EXPO_PUBLIC_API_URL=http://<host>:4000 npx expo start`.

**Tests:**
```bash
cd backend && pnpm test   # 42 integration tests; creates ripple_test db automatically
```

### Full credentials (optional, for push + real emails)

| What | Where | Enables |
| --- | --- | --- |
| `backend/firebase-service-account.json` | Firebase console → Service accounts | FCM push sending, Admin password updates |
| `FIREBASE_WEB_API_KEY` in `backend/.env` | `google-services.json` → `api_key` | Firebase email auth + account-creation mail |
| `SMTP_URL` in `backend/.env` | Resend/Brevo/any SMTP | Real OTP reset emails |
| `mobile/google-services.json` | Firebase console → Android app | FCM token on device (also stored as an EAS file env var for cloud builds) |

> **Push requires a dev/production build** — Expo Go cannot receive remote notifications (SDK 53+ platform restriction). The app detects Expo Go and degrades gracefully. Build with `npx eas-cli build -p android --profile development`.

## API reference

Base: `https://api.ripple.nafiziqbal.com` — `/posts` and `/notifications` require `Authorization: Bearer <token>`.

| Method | Route | Description |
| --- | --- | --- |
| POST | `/auth/signup` | `{ username, email, password }` → `{ token, refreshToken, user }` + account-creation email |
| POST | `/auth/login` | `{ identifier, password }` — identifier is username **or** email |
| POST | `/auth/refresh` | Rotate refresh token; reuse detection revokes all sessions |
| POST | `/auth/logout` | Revoke a refresh token |
| POST | `/auth/forgot-password` | Email a 6-digit reset code (404 if no such account) |
| POST | `/auth/verify-reset-otp` | Verify code (5 attempts, 10-min TTL) → short-lived `resetToken` |
| POST | `/auth/reset-password` | Set new password; revokes every session |
| GET | `/auth/me` | Current user |
| PUT | `/auth/device-token` | Register FCM device token |
| GET | `/posts?page&limit&username` | Paginated feed, newest first, optional author filter |
| POST | `/posts` | Create a text post (≤500 chars) |
| GET / DELETE | `/posts/:id` | Read / delete own post (403 otherwise) |
| POST | `/posts/:id/like` | Toggle like → `{ liked, likeCount }` (notifies author) |
| POST | `/posts/:id/comment` | Add comment (notifies author) |
| GET | `/posts/:id/comments?page&limit` | Paginated comments, oldest first |
| GET | `/notifications?page&limit` | Like/comment history + `unreadCount` |
| POST | `/notifications/read-all` | Clear the unread badge |
| WS | `/realtime?token=<jwt>` | `post:new` · `post:deleted` · `post:liked` · `comment:new` · `notification:new` |

## Design

A deliberate identity — **"a pond at night"** — instead of a default social-app skin: deep teal-black ground, a single warm coral accent (likes, primary actions), and a rare aqua glint (brand, focus). Three typefaces with strict roles: Comfortaa for the wordmark, Sora for UI, Atkinson Hyperlegible for reading. The signature interaction: **liking a post drops a stone** — concentric rings ripple out from under your thumb. All brand assets (icon, splash, adaptive icons, this banner) are generated from one reproducible script.

## What I'd add next

Comment editing/deletion · profile pages · E2E tests (Maestro) · CI pipeline running the suite against a Postgres service · iOS push (needs `@react-native-firebase/messaging` for FCM tokens on iOS) · S3-style media posts · cursor-based pagination once feeds grow.
