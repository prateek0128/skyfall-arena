# Single-player and multiplayer verification — 2026-10-17

> Historical evidence from 2026-10-17. The endpoint-discovery/deployment-blocked statements below describe that checkpoint, not current deployment status. The 2026-10-20 [release audit](release-readiness.md) records the confirmed public endpoints and limited TLS/probe/Upgrade checks; actual dashboard bindings, deployed SHAs and settings remain unverified. Original outcomes and logs are preserved.

No deployment, commit, production configuration change, or external service modification was performed. Browser test actions were limited to the game UI. Baseline repository commit was `6be3839`; the working tree was clean before these changes. Earlier Phase 4 and load-test evidence is retained.

## Verified, failed, and incomplete checks

| Environment / check | Result | Evidence |
|---|---|---|
| Deployed frontend HTTPS | PASS | `https://skyfall-arena-kappa.vercel.app/` returned HTTP/2 200; curl certificate verification result 0; HSTS header present. |
| Deployed solo smoke after multiplayer error | PASS | Wave 1 launched, jetpack reached 6 m and 81% fuel, Escape paused. This is not a full campaign playthrough. |
| Deployed multiplayer, two real browser clients | **FAIL / blocked before connection** | Audit Alpha and Audit Bravo independently clicked Create Room; both displayed the missing `VITE_WS_URL` error. No room or WebSocket handshake was created. |
| Production server endpoint discovery | **BLOCKED** | No actual WSS URL in README, `.env.example`, deployment files, environment, or existing reports. The deployed JS explicitly passes an undefined endpoint. Example domains are placeholders. |
| Production server TLS, proxy Upgrade routing, origins, health/readiness, logs and reconnect | **INCOMPLETE** | Server host, public endpoint, proxy mapping and log access are unavailable. The frontend TLS result establishes none of these server properties. |
| Local compiled-client two-browser lifecycle | PASS | Create/join, readiness guard, shared countdown, two combat results, rematch, both refresh/resume paths, host handoff, return to lobby, explicit leave. |
| Local remote flight and combat | PASS | Bravo boost depleted fuel to 66%; Alpha's canvas showed the remote pilot airborne with thrust effects. Alpha eliminated Bravo in both matches; both scoreboards showed Alpha 140 points / 1 elimination and Bravo eliminated. |
| Local solo with audit server stopped | PASS | After clean room exit and stopping port 2568, Single Player launched, reached 8 m / 79% fuel, destroyed one drone for 450 points, then paused at 1:12 / six drones remaining. Later observation showed the pause unchanged. |
| Whole solo campaign in browser | **NOT COMPLETED** | Rules/progression/victory/defeat have automated coverage; only a browser smoke was performed. |
| Live browser automatic retry after a transient network fault | **NOT EXERCISED** | Refresh plus explicit saved-session resume was exercised twice. Retry logic was inspected; server disconnect/token lifecycle has integration coverage. |
| Regression suite / typechecks / client and server production builds | PASS | 47/47 tests; both TypeScript checks; both builds. |

## Actual production configuration evidence

The supplied frontend served `https://skyfall-arena-kappa.vercel.app/assets/index-KM0p1WWa.js`. Its SHA-256 was:

`19ed4f2d308758a8ca08ca5687a251d479530c36e9a9fb236b4a4b2bec6c92af`

The observed production asset contains this callsite:

```js
const v=a1(void 0,location,!0);M=new WebSocket(v)
```

The endpoint helper throws on non-loopback pages before constructing a socket. Both real browser clients displayed exactly:

> Multiplayer is not configured. Set VITE_WS_URL when building the frontend. Single-player is available.

This is an omitted **build-time frontend endpoint**, not evidence of a refused WebSocket handshake or a down server. No production handshake, 101/403/429 response, or production server log could be captured because no target was configured. The application's fail-closed guard correctly preserves solo availability; it must not be replaced with a guessed hostname or localhost fallback on a public origin.

Repository inspection found no `.env.local`, actual deployment/server configuration, Node host or reverse-proxy deployment file. The relevant shell variables were unset. `vite.config.ts` contains React/chunk configuration and no deployed endpoint. `.env.example` documents `wss://arena.example.com/socket` and `https://game.example.com`, explicitly as placeholders; neither was probed. The README and earlier validation reports describe deployment requirements, not a deployed server. No server identity can be inferred from the Vercel frontend address.

### Console and operational capture

- Production Alpha console: one existing Rapier initialization deprecation warning at `2026-10-17T14:34:55.650Z`; no captured console errors. Production Bravo: no captured warning/error entries. The configuration failure is rendered as an application alert, not logged as an uncaught error.
- Local Alpha/Bravo: existing Rapier warning once per document initialization/refresh, no captured console errors or WebSocket handshake errors. Pointer lock was unavailable in this automation session; the supported drag-look path remained usable and combat worked.
- The isolated local server answered `/health` and `/ready` with HTTP 200 and `{"ok":true,"ready":true,"draining":false,"protocol":1}`. Its structured logs record four successful browser connections, two refresh closes (1001), final leave closes (1005), then drain/stop with **zero rooms and zero connections**. There were no command/origin rejections, heartbeat or backpressure failures in this session. The server used the exact allowlist `http://127.0.0.1:4180`; other options retained development defaults, including originless admission. This does not verify production admission configuration.
- This was a functional browser audit with concurrent desktop/build/test activity, **not a performance benchmark**. Do not compare its operational tick/CPU log with the controlled Phase 4 load profiles.

Retained captures:

- [Browser observations and console evidence](mode-audit-browser-evidence.json) — explicitly manual observations, not fabricated network traces.
- [Raw local server output](mode-audit-local-server.log).
- [Production frontend headers](mode-audit-frontend-headers.txt).
- [Complete test output](mode-audit-tests.log) and [production build output](mode-audit-build.log).

## Code trace and preserved authority

1. `src/main.tsx` selects solo or multiplayer rendering. `HUD` starts/resumes/restarts the existing browser campaign; `World` mounts the solo player/targets/controller and local Rapier simulation. Importing the network store does not connect. Only explicit create/join/reconnect actions open a socket. The solo smoke succeeded with the audit server stopped and on the deployed page after the multiplayer configuration error.
2. `MultiplayerHUD` calls `network.connect` for create/join. `shared/websocket-url.ts` validates the build-time public endpoint and secure schemes; `server/app.ts` validates exact Origin, admission limits, frame size, rates and protocol before `Rooms.command` handles membership. Room codes, guest identities and private rotating resume tokens stay server-issued.
3. `Rooms` admits 2–8 pilots only to a lobby. Ready states are broadcast; host start requires at least two connected pilots and all connected pilots ready. Countdown/reset are server-owned. Both browser clients saw launch countdown 3 and matching rosters.
4. `MultiplayerScene` sends keyboard/aim/thrust/boost/fire intents at up to 30 Hz. The authoritative server runs Rapier, fuel, bounds/recovery, 200 ms fire cooldown, cover-aware camera/weapon raycasts, 25-damage hits, scores and outcomes. Clients send no authoritative position/damage/score. `network.sample` interpolates snapshots (35 ms local / 100 ms remote delay, teleport snapping). Remote thrust was visible from the other client.
5. Both browsers observed a first Alpha victory at 140 / 1. Host rematch reset scores/hull/alive state and started a new countdown; a second Alpha victory again matched on both scoreboards. After host transfer to Bravo, only Bravo offered host result actions, including Return to Lobby; it reset both readiness states and disabled Start until readiness was restored.
6. During each match a different client refreshed, reopened Multiplayer and chose Reconnect Saved Session within the server's 20-second window. The same roster identity resumed. Alpha host refresh transferred host to Bravo; reconnect did not reclaim it. The code rotates resume tokens and revokes replacement sockets; integration tests verify rotation and stale-token/session rejection. Browser automation deliberately did not export credentials.
7. Both clients explicitly left before the isolated server was stopped. Its drain log confirms zero remaining rooms/connections. The audit did not alter guest identity rules, tokens, rate limits, validation, origins, heartbeat, room lifecycle or authoritative simulation.

There are no authenticated accounts in this architecture; guest resume credentials are the existing authentication mechanism. No account service was added or weakened.

## Confirmed fixes only

- Main menu previously labelled solo launch “ENTER THE ARENA” and exposed multiplayer as a separate floating choice. It now explicitly offers **SINGLE PLAYER** and **MULTIPLAYER · PRIVATE ROOMS** together. Loading gates solo launch as before; opening multiplayer still does not require a reachable server. Pause, restart, results and the mode switch from those screens remain intact. Two static-render regressions cover labels/loading and ensure render does not invoke launch callbacks; the real local UI also verified the integrated choices.
- The old multiplayer clock formatted 119.99 seconds as **1:60**. A regression reproduced that failure before the fix. The formatter now rounds total remaining seconds before splitting minutes/seconds; boundary regressions cover 120, 119.99, 119, 60.01, 60, 59.99, 0.01 and 0. Only presentation changed; match duration/outcomes remain server-owned.

No gameplay/physics/security/server configuration changes were made. The deployed frontend still has the old menu/formatter until a separately authorized future deployment; no local fix was presented as already deployed.

## Commands and validation

```sh
node --import tsx --test src/components/MainMenuActions.test.tsx src/multiplayer/clock.test.ts
npm run typecheck
npm test
npm run build
```

Final relevant regression run: **3/3 passed**, 3443.051618 ms. Complete suite: **47 tests, 47 passed, 0 failed/cancelled/skipped**, 6565.424422 ms. Client/server typechecks passed. Client Vite production build transformed 357 modules in 30.49 s; server TypeScript production build passed. Existing large Three/Rapier chunk warnings and the upstream Rapier initialization warning remain visible. No unrelated dependency/bundle change was attempted.

The local real-browser audit used separate terminals and temporary build output (these are **local-only**, not recommended production endpoint values):

```sh
NODE_ENV=development HOST=127.0.0.1 PORT=2568 ALLOWED_ORIGINS=http://127.0.0.1:4180 npm run start:server
VITE_WS_URL=ws://127.0.0.1:2568 npx vite build --outDir /tmp/skyfall-browser-audit-dist --emptyOutDir
npx vite preview --host 127.0.0.1 --port 4180 --strictPort --outDir /tmp/skyfall-browser-audit-dist
```

The compiled server used here had unchanged server sources. Port 2568 and the audit preview were started solely for this audit and stopped afterward; the user's existing 4173/2567 listeners were preserved. The local build endpoint override was process-scoped and never saved to environment/configuration files. Plain `npm run build` was separately verified without it.

## Next production diagnostics — read-only; not performed without endpoint/access

1. In the hosting dashboard, **read** the active frontend deployment's `VITE_WS_URL` build-time configuration and identify the existing persistent Node server's actual public WSS endpoint. Do not guess from the frontend hostname or use example/loopback URLs. No production setting was changed in this audit. An active frontend asset compiled with `undefined` will need a separately authorized future configuration/build/deployment step; source fixes alone cannot change it.
2. Obtain read-only Node runtime and reverse-proxy logs and effective runtime values for `NODE_ENV`, `ALLOWED_ORIGINS`, `HOST`, `PORT`, and IP/originless admission settings. The expected frontend Origin for this deployment is exactly `https://skyfall-arena-kappa.vercel.app`. Compare it to the **actual** allowlist; do not automatically edit it. Verify the proxy's real-client IP/admission policy rather than weakening budgets.
3. With the operator-confirmed HTTPS probe base/path, run `curl --fail-with-body -i "$SERVER_PROBE_BASE/health"` and the equivalent `/ready` (normal certificate verification; never `-k`). Expect both 200 and readiness true when serving. Verify any proxy path rewriting explicitly. These probe URLs cannot be filled in from the current evidence.
4. Once a configured active deployment is available, open two independent browser clients. In DevTools preserve Console and Network logs before create/join. Record the actual WSS Request URL, TLS validity, exact Origin and Upgrade response **101**. For a rejection, correlate `upgrade_rejected`/`command_rejected` and proxy status/logs; a 403 may be origin policy, 429 admission/rate, 502 upstream/proxy — establish the actual cause rather than assuming it.
5. Repeat ready/unready/host launch/countdown, flight/boost/aim/combat, shared results, rematch, return to lobby, refresh/manual resume and host transfer. Also exercise a temporary network interruption shorter than reconnect grace and verify automatic resume/token rotation without exposing tokens; test expired reconnect and stale input braking. Recheck solo while the server is unavailable.

Production WSS operation, allowed origins, proxy upgrades, server probes/logs, and production reconnect remain launch blockers. No production multiplayer success or overall production readiness is claimed.

## Changed files

`src/main.tsx`, `src/components/HUD.tsx`, `src/components/MainMenuActions.tsx`, `src/components/MainMenuActions.test.tsx`, `src/multiplayer/MultiplayerHUD.tsx`, `src/multiplayer/clock.ts`, `src/multiplayer/clock.test.ts`, `package.json`, `README.md`, the appended Phase 4 summary, this report and its five capture files. Application/server environment configuration, authoritative server/shared logic, single-player campaign rules, and earlier failed load reports remain unchanged.
