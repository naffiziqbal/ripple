# 🌊 Ripple — Mini Social Feed

A lightweight social app: post short text updates, scroll a shared feed, like and comment, and get push notifications (Firebase Cloud Messaging) when someone interacts with your posts.

| Part | Stack |
| --- | --- |
| `backend/` | Node.js · Express 5 · TypeScript · PostgreSQL (pg) · JWT · Zod · Firebase Admin (FCM) · Vitest + Supertest |
| `mobile/` | React Native · Expo (expo-router) · TypeScript · NativeWind (Tailwind CSS) · TanStack Query · expo-notifications |

---

## Quick start

### 1. Backend

```bash
cd backend
npm install
docker compose up -d   # starts PostgreSQL 16 (user/pass/db: ripple) on host port 5433
cp .env.example .env   # optional — sensible dev defaults are built in
npm run dev            # → http://localhost:4000
```

- The schema is migrated automatically on boot (idempotent `CREATE TABLE IF NOT EXISTS`).
- Host port **5433** is used on purpose so an existing local Postgres on 5432 never conflicts (`POSTGRES_PORT` overrides it; keep `DATABASE_URL` in sync).
- Already running Postgres yourself? Just set `DATABASE_URL` in `.env` and skip Docker.
- Without a Firebase service account the API runs in **log-only push mode** (notifications are printed to stdout), so everything works locally with zero Firebase setup.

Run the test suite (33 integration tests against a dedicated `ripple_test` database, created automatically — covers auth + refresh rotation, feed, likes, comments, notifications, and the realtime WebSocket):

```bash
npm test        # vitest + supertest
npm run typecheck
```

### 2. Mobile app

```bash
cd mobile
npm install
npx expo start
```

Open in **Expo Go** (same Wi-Fi as your machine — the app auto-detects the API host from the Metro bundler) or run an emulator. To point at a different API host:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.50:4000 npx expo start
```

### 3. Firebase push notifications (optional, needed for real FCM)

1. Create a Firebase project → **Project settings → Service accounts → Generate new private key**, save it as `backend/firebase-service-account.json` (or set `FIREBASE_SERVICE_ACCOUNT` in `.env`).
2. Add an Android app in Firebase (package `com.ripple.app`), download `google-services.json` into `mobile/`, and add `"googleServicesFile": "./google-services.json"` under `android` in `mobile/app.json`.
3. Remote push requires a **development build** (Expo Go can't receive FCM):
   ```bash
   cd mobile && npx expo run:android   # or: eas build --profile development
   ```
4. Log in on a device → the app registers its FCM token via `PUT /auth/device-token` → likes/comments from other users arrive as push notifications; tapping one deep-links to the post.

---

## API overview

Base URL: `http://localhost:4000` — all `/posts` routes require `Authorization: Bearer <token>`.

| Method | Route | Description |
| --- | --- | --- |
| POST | `/auth/signup` | Create account `{ username, password }` → `{ token, refreshToken, user }` |
| POST | `/auth/login` | Log in → `{ token, refreshToken, user }` |
| POST | `/auth/refresh` | Rotate refresh token → new `{ token, refreshToken }` (reuse detection revokes all sessions) |
| POST | `/auth/logout` | Revoke a refresh token |
| GET | `/auth/me` | Current user from token |
| PUT | `/auth/device-token` | Register FCM device token `{ token }` |
| GET | `/posts?page=1&limit=10&username=alice` | Paginated feed, newest first; optional author filter |
| POST | `/posts` | Create text post `{ content }` (≤ 500 chars) |
| GET | `/posts/:id` | Single post with counts + `likedByMe` |
| DELETE | `/posts/:id` | Delete your own post (403 otherwise) |
| POST | `/posts/:id/like` | Toggle like → `{ liked, likeCount }` (notifies author) |
| POST | `/posts/:id/comment` | Add comment `{ content }` (notifies author) |
| GET | `/posts/:id/comments?page&limit` | Paginated comment list, oldest first |
| GET | `/notifications?page&limit` | Your like/comment history + `unreadCount` |
| POST | `/notifications/read-all` | Clear the unread badge |
| WS | `/realtime?token=<jwt>` | Live events: `post:new`, `post:deleted`, `post:liked`, `comment:new`, `notification:new` |

Access tokens are short-lived (15 min); the mobile client transparently rotates the refresh token on 401 (single-flight) and logs out when rotation fails. `/auth/*` credential endpoints are rate-limited (10/min per IP) with a 300/min global limit, behind `helmet` headers.

Feed items include `likeCount`, `commentCount`, `likedByMe`, and a two-comment `recentComments` preview so the feed renders without N+1 requests.

---

## Design notes

**Backend**
- **Layered modules** (`modules/auth`, `modules/posts`, `modules/notifications`): thin routers → services holding business logic → a shared PostgreSQL pool with idempotent boot-time migration. Hand-written parameterized SQL — no ORM overhead, no injection surface.
- **Validation at the edge** with Zod schemas; typed request helpers (`parseBody`/`parseQuery`/`parseIdParam`) return `400` with field-level details.
- **Typed error handling**: `ApiError` + a single error middleware; Express 5 forwards async throws natively.
- **Security details**: bcrypt password hashing, uniform login errors with dummy-hash comparison to avoid username-timing oracles, case-insensitive unique usernames enforced by a functional unique index (no check-then-insert race), JWT config via validated env.
- **Query craft**: feed counts and `likedByMe` computed in one query; comment previews batched with a `ROW_NUMBER()` window over `ANY($1::int[])` — no N+1; like toggle is a delete-first + `ON CONFLICT DO NOTHING` insert, race-safe without explicit locking.
- **Push notifications are fire-and-forget** — FCM failure can never fail or slow the originating request, and the service degrades to log-only mode when unconfigured. Every like/comment also lands as a persistent row in `notifications`, powering the in-app notification center and unread badge.
- **Realtime**: a `ws` WebSocket endpoint fed by an in-process event bus (`realtime/events.ts`) keeps domain services decoupled from transport; feed events broadcast, notification events target only the recipient. The app falls back to 60s polling if the socket drops.
- **Auth hardening**: 15-minute access tokens with rotating refresh tokens (sha256-hashed at rest, reuse detection revokes all sessions), rate-limited credential endpoints, `helmet` headers.
- **Tests are integration-level** (Supertest against the real app + a real Postgres test database, truncated between tests), covering auth, pagination, filtering, like toggling, comments, and authorization failures.

**Mobile**
- **expo-router protected stacks**: `(auth)` and `(app)` groups guarded by session state — no manual navigation on login/logout, the router re-renders to the right stack.
- **TanStack Query** for all server state: infinite-scroll feed (`useInfiniteQuery`), pull-to-refresh, and **optimistic like toggling** with rollback on error across every cached feed and the post detail view.
- **NativeWind (Tailwind)** styling with a small design-token theme (`brand` / `ink` / `surface`), reusable `Button`/`Field`/`EmptyState` primitives.
- **Typed API client** mirroring the backend DTOs; base URL auto-derives from the Metro host so Expo Go on a phone hits your dev machine without config.
- **Notifications**: foreground display handler, Android channel setup, token registration after login, and tap → deep link to the relevant post.
