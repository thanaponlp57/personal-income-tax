# Personal Income Tax — Micro-Frontend (P.N.D.91)

> A web app to calculate and file Thai personal income tax (P.N.D.91) with a 5-step wizard.
> Built with **Angular 22 (zoneless + signals)** in a **Micro-Frontend (Native Federation)** architecture,
> with auth through **Keycloak (OAuth2) using a same-origin BFF**, and deployed with **Docker + Nginx**.

This is a **portfolio** project. The goal is to make it close to real production work across the whole
stack — not just one screen. It includes an MFE host/remote setup, integration with a real backend
(separate microservices repo), auth/session/CSRF handling, and a production-like deployment with an
Nginx reverse proxy.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start (Docker — recommended)](#quick-start-docker--recommended)
- [Local Development (without Docker)](#local-development-without-docker)
- [Testing](#testing)
- [Build](#build)
- [Coding Conventions](#coding-conventions)
- [Current Scope & Next Steps](#current-scope--next-steps)

---

## Overview

The user fills in their data through a 5-step wizard. The system then calculates the tax using the
progressive rates for tax year 2568 (2025), lets the user file the return, and lets them download a
receipt:

```
1. Taxpayer   →  2. Income   →  3. Deductions   →  4. Review   →  5. Result / File
   (taxpayer)      (income)       (deductions)       (review)       (result)
```

- It calculates the **50% expense deduction (max 100,000)**, plus allowances for self / spouse /
  children / parents / insurance / provident fund / home loan interest / donations. Each item has a
  **cap**, and the app **shows the amount that was cut by the cap** so it is visible (it does not cap
  silently).
- It shows a **per-bracket tax breakdown** (8 brackets, 0–35%) and a summary of the final amount to
  **pay or to refund** based on tax already withheld at source.
- All tax rules live in a single service (`tax-calculator.service.ts`) that can be unit-tested on its
  own, without TestBed.

> MVP scope: supports income under Section 40(1) (salary / bonus).

---

## Key Features

| Area | Details |
|------|---------|
| **Micro-Frontend** | `shell` (Host) loads `personal-income-tax` (Remote) at runtime through `loadRemoteModule()` + `federation.manifest.json`. The remote works both standalone (`:4201`) and embedded in the shell. |
| **Zoneless + Signals** | No `zone.js` at all. All state uses `signal()` / `computed()`, and every component is `OnPush`. |
| **Stepper wizard + route guards** | You cannot skip a step before finishing the previous one (`canActivateStep`), and the wizard resumes from a draft automatically (`loadDraftGuard`). |
| **Draft autosave** | Saves a draft to the backend while you fill in the form (manual save + before leaving the page). Reset clears the draft, and a race on refresh is prevented. |
| **Auth (BFF / OAuth2)** | Login through Keycloak. The session cookie is **first-party** because Nginx reverse-proxies `/api` and `/oauth2` to the backend (this avoids third-party cookie blocking in Safari), and it attaches `X-XSRF-TOKEN` to prevent CSRF. |
| **Custom directives** | `tax-id-input` (formats the 13-digit tax ID) and `money-input` (adds thousands separators and controls the caret) are written as custom attribute directives. |
| **Production deploy** | Multi-stage Docker (node → nginx), `immutable` cache for hashed assets, `no-cache` for the manifest/entry, and CORS open only to the shell's origin. |

---

## Tech Stack

- **Angular 22.0.1** — standalone components, native signals, **zoneless by default**
- **TypeScript 6**
- **Native Federation** — `@angular-architects/native-federation` (runs on esbuild / `@angular/build:application`)
- **Bootstrap 5.3.8** (pinned) + Bootstrap Icons — CSS through Sass `@use`, JS through per-module ESM import (no jQuery)
- **Vitest** — unit tests (run through `@angular/build:unit-test`)
- **Playwright** — e2e tests
- **Docker + Nginx** — serves static files per app + reverse-proxies to the backend
- **Backend** (separate repo `personal-income-tax-service`): Spring `filing-service` + `tax-calc` (gRPC), Keycloak, Oracle, Kafka, Redis

---

## Architecture

### Micro-Frontend (Host ↔ Remote)

```
                       ┌────────────────────────────────────────┐
   Browser  ─────────▶ │  shell (Host)            :4200          │
                       │  - layout / navbar / routing            │
                       │  - federation.manifest.json             │
                       │  - provideHttpClient + XSRF (root)      │
                       └──────────────────┬─────────────────────┘
                                          │  loadRemoteModule('personal-income-tax', './routes')
                                          │  (fetch remoteEntry.json cross-origin → CORS required)
                       ┌──────────────────▼─────────────────────┐
                       │  personal-income-tax (Remote)  :4201    │
                       │  - exposes './routes'                   │
                       │  - tax wizard + calculator + filing     │
                       └─────────────────────────────────────────┘

   Shared singletons (Native Federation): @angular/*, rxjs
```

Points that were designed on purpose:
- **Never hardcode the remote URL in the code** — always resolve it through `federation.manifest.json`.
- **One-way dependency direction** — the remote must never import from `projects/shell`.
- **HttpClient/XSRF must also be provided at the shell (Host root injector)**, because the remote's
  `app.config.ts` only runs when standalone. Without this, a mutating request (POST/PUT) will not
  attach the token and the backend will answer 403.

### Auth & networking — same-origin BFF

In production (Docker), every FE request goes through the same Nginx that serves the static files,
and Nginx reverse-proxies on to the backend:

```
Browser ──https──▶ Nginx (taxfe.local:4200)
                     ├─ /                     → static (shell SPA)
                     └─ /api /oauth2          → proxy → BE (taxbe.local:8080) → Keycloak
                        /login /logout
```

The result is that the SESSION cookie is **first-party to `taxfe.local`** (it works in every browser,
including Safari), and `environment.apiBaseUrl` in production is empty `''`, so the app calls the API
with pure relative paths.

### Key decisions & trade-offs

| Decision | Choice | Reason / trade-off |
|----------|--------|--------------------|
| Federation | **Native Federation** | Angular 22 builds with esbuild. Webpack Module Federation would force a step back to the webpack builder, which is no longer maintained. Native Federation uses import maps on esbuild directly. ⚠️ The ecosystem is smaller and you must follow each Angular major version. |
| Repo layout | **One workspace, many projects** | A single `node_modules`, versions stay in sync automatically, good for a small team. ⚠️ Less independent than separate repos — revisit this when there are many teams. |
| Auth/cookie | **Same-origin BFF through Nginx** | The session cookie is first-party, which avoids third-party cookie blocking. ⚠️ The FE is tied to the reverse proxy; testing the full flow requires running through Nginx (Docker). |
| Bootstrap | **CSS bundle per app + JS as per-module ESM** | Independent, no global/jQuery. ⚠️ The CSS is duplicated (~30kB gzip per app) — if there are more remotes later, move the global CSS to the shell. |
| Manifest URL | **Fixed in `federation.manifest.json`** | Simple for a single environment. ⚠️ For many environments, inject it at runtime (for example, envsubst in the nginx entrypoint). |

---

## Project Structure

One Angular workspace, two projects (Host + Remote):

```
/
├── src/                          ← personal-income-tax  (Remote, :4201)
│   └── app/
│       ├── auth/                 ← auth.service, auth.guard (OAuth2/BFF)
│       ├── income-tax/
│       │   ├── services/         ← tax-calculator, tax-api, tax-wizard.store (signals)
│       │   ├── models/           ← tax.models.ts (all domain types)
│       │   ├── wizard/steps/     ← 5 steps: taxpayer/income/deductions/review/result
│       │   ├── wizard/guards/    ← gate step skipping + load draft
│       │   ├── directives/       ← tax-id-input, money-input
│       │   └── utils/            ← caret.util
│       └── shared/interceptors/  ← error.interceptor
├── projects/shell/               ← shell  (Host, :4200)
├── federation.config.mjs         ← Remote config (exposes './routes')
├── Dockerfile · compose.yml · nginx.conf   ← production build + serve + BFF proxy
└── ssl/                          ← cert for taxfe.local (dev/prod local)
```

---

## Prerequisites

This project is designed so that **the FE and the BE run on the same machine**.

| Required | Version / note |
|----------|----------------|
| Node.js | 24.x (Docker build uses `node:24-alpine`) |
| npm | 11.x |
| Docker + Docker Compose | For Quick Start and to run the backend |
| [mkcert](https://github.com/FiloSottile/mkcert) | Issues a cert for `taxfe.local` (local HTTPS) |
| **Backend stack** | The `personal-income-tax-service` repo is running — `filing-service` at `localhost:8080`, Keycloak at `localhost:8888` |

### 1) Set up `/etc/hosts`

```
127.0.0.1   taxfe.local
127.0.0.1   taxbe.local
```

> ⚠️ **Gotcha (macOS):** Names ending in `.local` can be resolved through mDNS instead of `/etc/hosts`.
> The symptom is that `curl` works but Chrome shows `ERR_ADDRESS_UNREACHABLE` when it redirects to OAuth2
> (Chrome picks an IPv6 address that has no real route). The quick fix is to turn IPv6 off temporarily
> on the interface you use:
> `sudo networksetup -setv6off Wi-Fi && sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder`
> (restore it with `-setv6automatic`). The long-term fix is to move away from `.local` to `.test` / `.localhost`.

### 2) Issue an SSL cert (if you do not have one in `ssl/` yet)

```bash
mkcert -install
mkcert -cert-file ssl/taxfe.local.pem -key-file ssl/taxfe.local-key.pem taxfe.local
```

### 3) Start the backend

First run the `personal-income-tax-service` stack so that `filing-service` is published at `localhost:8080`
and Keycloak at `localhost:8888` (see that repo's README).

---

## Quick Start (Docker — recommended)

This path is the closest to production: it builds both host and remote, serves them with Nginx over
HTTPS, and reverse-proxies auth to the backend on the same machine (`taxbe.local:host-gateway`).

```bash
docker compose up --build
```

Then open **https://taxfe.local:4200**

- shell (Host): `https://taxfe.local:4200`
- remote (Remote, standalone): `https://taxfe.local:4201`
- requests to `/api`, `/oauth2`, `/login`, `/logout` are proxied to `taxbe.local:8080` automatically
- the first page redirects to login at Keycloak → after login you return and can use the wizard

---

## Local Development (without Docker)

This is good for FE development that needs hot reload (run host + remote in two separate terminals):

```bash
npm install

# terminal 1 — Remote (:4201)
ng serve personal-income-tax

# terminal 2 — Host (:4200)
ng serve shell
```

Open `http://localhost:4200`

> The auth flow needs the BE running (`localhost:8080`), because the design is a same-origin BFF that
> relies on the Nginx reverse proxy. Testing the full login/filing flow end to end is smoothest through
> the Docker setup above.
> If you want to run dev over HTTPS / `taxfe.local`, use the prepared SSL config:
>
> ```bash
> npm run start:remote:cross   # Remote on https://taxfe.local:4201
> npm run start:cross          # Host   on https://taxfe.local:4200
> ```

---

## Testing

```bash
ng test                                   # all unit tests (Vitest)
npx vitest run src/app/income-tax/services/tax-calculator.service.spec.ts   # a single file
ng test shell                             # Host tests
npm run e2e                               # Playwright e2e
```

> If `ng test` breaks after moving machines (node_modules stuck in macOS quarantine): run
> `xattr -cr node_modules`, then run through `ng test` (not `npx vitest` directly).

---

## Build

```bash
ng build personal-income-tax              # → dist/personal-income-tax/browser
ng build shell --configuration production-ssl
```

(The Dockerfile runs these two commands in the build stage, then copies the output to Nginx in the serve stage.)

---

## Coding Conventions

These are required in both projects (Angular 22 baseline):

1. **Standalone only** — no NgModules
2. **Signals for state** — `signal()` / `computed()`; do not read a mutable field directly from the template
3. **Signal-based I/O** — `input()` / `output()`, not decorators
4. **`inject()` for DI** — no constructor injection
5. **`OnPush` on every component**
6. **Zoneless** — no `zone.js` in dependencies, polyfills, or test setup

Business logic (the tax rules) lives in an injectable service that can be tested without a component.
Components only bind and present.

Prettier: `printWidth: 100`, `singleQuote: true`, Angular parser for HTML templates.

---

## Current Scope & Next Steps

**Done:** MFE host/remote, the 5-step wizard with route guards, draft autosave, tax calculation for
Section 40(1), auth through Keycloak (BFF), filing + receipt, a Docker + Nginx production build, and
unit + e2e tests.

**To revisit as the system grows:**
- Inject the manifest URL at runtime instead of fixing it in a file, once there are many environments.
- Split a shared UI library (shared styles + common components) into a workspace library as more remotes are added.
- Support income types other than Section 40(1).
- Split the CI/CD pipeline to build/push an image per app.
