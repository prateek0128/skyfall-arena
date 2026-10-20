# Render preparation evidence — 2026-10-17

> Historical evidence from 2026-10-17. The endpoint-discovery/deployment-blocked statements below describe that checkpoint, not current deployment status. The 2026-10-20 [release audit](release-readiness.md) records the confirmed public endpoints and limited TLS/probe/Upgrade checks; actual dashboard bindings, deployed SHAs and settings remain unverified. Original outcomes and logs are preserved.

No Render service, deployment, commit, push, Vercel environment change or external configuration change was made. The pre-existing uncommitted menu/clock work and verification artifacts were preserved. No production hostname is known or invented.

## Change scope

- Added `.env.render.example`, a **manual/non-secret example**, not an active environment file or a deployment Blueprint. It sets Node 24.18.0, production mode, `HOST=0.0.0.0`, `PORT=10000`, the single exact origin `https://skyfall-arena-kappa.vercel.app`, and `ALLOW_ORIGINLESS=false`.
- Added two regressions to `server/hardening.test.ts` that read this exact profile. They verify local defaults remain loopback/2567, configurable port overrides still work, default rate/heartbeat/session/shutdown budgets are unchanged, the configured listener binds IPv4 wildcard, probes return ready 200, root-path WebSockets admit the exact frontend origin, and missing/HTTP/lookalike origins get 403.
- Updated README with exact manual Render dashboard settings, environment settings, TLS/Upgrade behavior, single-instance/restart limits, proxy/IP admission caveat, and subsequent Vercel build-time endpoint verification.
- Added this evidence, the raw verification log and startup-smoke JSON. No production application/server/shared logic or dependency version/lockfile changed for Render preparation. Global/default binding was deliberately left unchanged; the existing HOST override is sufficient for Render.

## Verified build and runtime commands

Node **v24.18.0**, macOS/Darwin; this does not claim a Render/Linux deployment has run.

A temporary directory was populated with copies of `package.json`, `package-lock.json`, `tsconfig.server.json`, `server/` and `shared/`. The installed dependencies of the working checkout were not reinstalled or changed.

1. `npm ci --include=dev`: **PASS**, 102 packages, zero audit vulnerabilities reported, 5 s install output.
2. `NODE_ENV=production npm ci --include=dev`: **PASS**, 102 packages, zero audit vulnerabilities reported, 8 s install output. TypeScript dev dependencies remain available with production mode.
3. `NODE_ENV=production npm run build:server`: **PASS** in that fresh copy; `dist-server/server/index.js` exists and is nonempty.
4. `npm run start:server`: **PASS** from the clean copy with the Render profile. It listened on `0.0.0.0:10000`, `/health` and `/ready` returned 200 with ready true, and an actual local WebSocket connected to `/` with the configured frontend Origin and received a welcome after a normal create command. The client left; SIGTERM to the locally spawned process group completed the existing drain/stop, with zero rooms/connections. This proves the command starts the compiled entrypoint and initializes Rapier under the production profile locally; Render ingress/TLS remain untested. See [structured smoke outcome](render-start-smoke.json).

The exact one-line Render dashboard build command is `npm ci --include=dev && npm run build:server`; start is `npm run start:server`. Node runs HTTP internally; Render terminates public TLS. `/ready` is the intended dashboard health-check path, not `/`, which deliberately returns 404 to normal HTTP. Root `/` is an already-supported WebSocket upgrade path; no `/socket` route was added.

## Tests and production builds

- Relevant command: `node --import tsx --test server/hardening.test.ts server/integration.test.ts server/rooms.test.ts server/simulation.test.ts shared/protocol.test.ts`.
- Result: **30 tests, 30 passed, 0 failed/cancelled/skipped**, 3198.058968 ms.
- `npm test`: **49 tests, 49 passed, 0 failed/cancelled/skipped**, 4531.317587 ms. Includes existing solo gameplay, client presentation, real WebSocket combat/reconnect/rematch, authority, origin, rate, lifecycle and shutdown coverage.
- `npm run typecheck`: **PASS**, client `tsc -b` and server `tsc -p tsconfig.server.json --noEmit`.
- `npm run build`: **PASS**, client and server production builds. Client transformed 357 modules in 8.02 s; server TypeScript compiled successfully. Existing Three/Rapier engine size warnings remain (703.77 kB / 2237.13 kB chunks); initialization still emits the upstream Rapier deprecation warning.
- npm clean-install output contains install-script policy warnings for esbuild/fsevents. No global install-script policy was approved or weakened; this server-only build/start succeeded without it. These logs do not prove a clean frontend build under that fresh install, which Render does not need: the frontend remains separately built on Vercel. The working checkout's complete frontend build passed as recorded above.
- `git diff --check`: **PASS**.

[Raw command output](render-preparation.log) preserves clean-install, server startup/shutdown, relevant/full test, typecheck and build output. No resume tokens, payloads or secrets were exported. No extra performance/load benchmark was run and none is implied.

## Deployment settings and remaining blockers

The README's Render section is the manual checklist. Key settings: **Node Web Service**, root directory blank, build and start commands above, health check `/ready`, one always-on instance, autoscaling off, Auto-Deploy off while validating, exact HTTPS allowed origin, originless false, and Render's managed PORT default 10000. Rate/security defaults are unchanged. No disk or database is needed or useful for restoring the current RAM-only room state.

The actual Render hostname does not exist in this evidence. After an authorized future deployment, copy the assigned HTTPS service URL; check probes and TLS; use that confirmed host with the **`wss://` scheme and `/` path**, without internal `:10000`, for Vercel's Production `VITE_WS_URL`. A new frontend build/deployment must also be authorized. No value was installed in Vercel here.

Open two real clients on the existing Vercel frontend and verify the actual WebSocket 101/Origin, create/join/ready/countdown, synchronized combat/results, rematch, reconnect/host handoff/lobby, and solo independence. Capture server/proxy logs for any failures. Verify TCP-peer IP admission behind Render without disabling budgets or trusting spoofable forwarding headers. One-instance state does not survive process replacement; rolling deploy overlap can also separate old/new room maps. Free-tier idle spin-down/cold start and all restarts end RAM rooms. Paid always-on service avoids idle spin-down, not maintenance or state loss.

Local macOS tests cannot establish Render runtime capacity, Linux compatibility under the actual service image, public TLS/Upgrade/probe behavior, effective proxy/IP origin policy, a live production hostname, or two-client production success. Those remain blocked until the reviewed code is made available remotely and a separately authorized Render/Vercel deployment and verification occur. Do not claim launch readiness from preparation alone.

Sources checked on 2026-10-17: [Render Web Services](https://render.com/docs/web-services), [WebSockets](https://render.com/docs/websocket), [Health Checks](https://render.com/docs/health-checks), [Node Version](https://render.com/docs/node-version), and [Free-instance behavior](https://render.com/docs/free).
