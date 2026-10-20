# SKYFALL ARENA — Phase 4 verification and operations

A React/TypeScript/Vite 3D jetpack game with Three.js, React Three Fiber and Rapier. Single-player wave survival runs entirely in the browser. Private 2–8 player matches use a persistent, authoritative Node/WebSocket server. No accounts, Supabase, database, or external services are required. Nothing in this repository deploys the application.

Phase 4 adds security/configuration checks, probes, bounded shutdown, operational metrics, lifecycle regressions and a reproducible load harness. **Local verification is not a production launch certification.** See remaining launch blockers below and the retained reports under `reports/`.

## Local gameplay/reliability update (2026-10-20)

The home screen retains equal Single Player and Multiplayer buttons. Local polish adds brief multiplayer hit flashes/authoritative elimination feedback, critical-hull cues, bounded drone evasion and varied attacks with a final 450 ms aim-lock warning, and **Return to Home** on survival results. WASD/arrows, room-code copy, blank initial names and all multiplayer authority rules remain unchanged.

Client connection/welcome attempts now time out after five seconds; automatic recovery is bounded to eight retries within a 20-second window. Rejected/replaced/expired sessions return to room entry with a useful error. Server restarts still destroy all in-memory rooms/tokens: create or join a fresh room after availability returns. This changes recovery UI, not server grace or persistence.

See [local gameplay/reliability evidence](reports/gameplay-reliability-validation.md) for commands, exact test counts, two-browser lobby/restart checks, independent solo combat, and incomplete browser checks. Historical production observations below describe their original audit dates; this update makes no new live-host claim.

## Current dual-mode verification (2026-10-17)

The supplied deployed frontend is `https://skyfall-arena-kappa.vercel.app/`. **Single-player launched and flew after a multiplayer configuration failure, but multiplayer is currently blocked in that deployed build.** Two real browser clients both displayed “Multiplayer is not configured. Set VITE_WS_URL when building the frontend.” The observed production JS passes an undefined endpoint before WebSocket construction. The repository only contains example WSS domains; the actual production Node endpoint and logs are unavailable. No endpoint was guessed and no production settings or deployment were changed.

Local source now explicitly offers **Single Player** and **Multiplayer · Private Rooms** together and fixes the multiplayer timer's `1:60` boundary display. An isolated production frontend build and unchanged local authoritative server passed a two-real-browser flow: create/join, ready guard, shared countdown, flight/boost, combat and matching 140-point/1-elimination results, rematch, both refresh/resumes, host handoff, return to an unready lobby, and leave. After stopping that server, single-player still flew, destroyed a drone for 450 points and paused correctly. The full campaign was not manually completed in the browser; existing automated progression/victory tests pass.

**47/47 tests, client/server typechecks and both production builds passed.** See [dual-mode verification](reports/dual-mode-verification.md) for raw console/server/build/test captures and exact read-only production diagnostic steps. Production server TLS/WSS, proxy upgrades, exact allowed origins, health/readiness, logs and reconnect remain unverified until the actual endpoint/access is available. HTTPS success for the frontend does not verify the server. Local success is not a production multiplayer pass. No release or publication was performed.

## Run locally

Node.js 20.19+ or 22.12+ is required (verification uses Node 24). Use a desktop WebGL2 browser.

```sh
npm ci
npm run dev:server
```

In another terminal:

```sh
npm run dev
```

Use Vite's printed URL. Default development origins are exactly `http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:4173`, and `http://127.0.0.1:4173`. A different port or LAN address must be added explicitly to `ALLOWED_ORIGINS` in the server shell. Single-player does not open a WebSocket until multiplayer is requested and remains usable if the server is unavailable or misconfigured.

Select **Multiplayer · Private Rooms** in the menu, create a room, and join its six-character code from another tab/window. Use the copy icon beside a room code to copy it; a checkmark and “Copied” confirm success. If clipboard access is unavailable, select the visible code and copy manually. Everyone readies up, the host starts a three-second countdown, then each pilot clicks **Take control**. Sessions use per-tab session storage; refresh requires reopening multiplayer and choosing **Reconnect saved session**.

## Controls and game rules

- **WASD or arrow keys**: camera-relative movement (equivalent keys do not stack). **Mouse**: aim/look. **Space**: jetpack. **Shift + Space**: boost. **Left mouse**: fire. Hold **right mouse and drag** if pointer lock is refused.
- **Escape**: pause single-player or open the multiplayer flight menu. A multiplayer match **continues** while its local menu is open. Blur clears held input; stale commands stop after 250 ms of simulation time, while gravity and damage remain active.
- Fuel drains at 23/s normally or 38/s under boost and regenerates at 19/s without thrust. Empty fuel must recover above 18%. Falls recover at spawn, restore fuel, and cost 25 hull.
- Single-player: three waves of seven moving/attacking drones, 80 seconds per wave, 3/4/5 hits per drone, +15 hull between waves. Hits award 50; kills award 300 × combo, chained within five seconds up to 5×. Timeout or hull loss defeats; clearing wave three wins. Results include score, kills, active time and accuracy.
- Multiplayer: last living pilot wins, or highest surviving score then hull at two minutes; equal leaders share victory. Each player hit deals 25 damage and adds 10 points; each elimination adds 100. Server results feed a shared scoreboard; the host can rematch or return everyone to lobby. No mid-match joins. Lobby launches require at least two connected, ready pilots.

## Production environment

No secret variables are needed: identities are guests and resume tokens are generated in memory. Never place secrets in `VITE_*` variables. `.env.example` contains placeholders, not working deployment settings.

| Variable | Consumer | Requirement/default |
|---|---|---|
| `VITE_WS_URL` | Vite, **build-time**, public | Required for multiplayer on a public production hostname; use an actual `wss://` URL, optionally with a proxy path. Local preview may omit it. |
| `NODE_ENV` | Node server | Set `production` for deployment. Unknown values fail startup. |
| `ALLOWED_ORIGINS` | Node server | **Required in production**: exact comma-separated HTTPS frontend origins, without paths, credentials, wildcards or trailing slashes. Development defaults to the local origins above. |
| `HOST` | Node server | `127.0.0.1`; explicitly choose the private interface or `0.0.0.0` when required by a container/proxy. |
| `PORT` | Node server | Integer `2567` by default; 1–65535. |
| `ALLOW_ORIGINLESS` | Node server | `false` in production, `true` in development. Only enable deliberately for non-browser tools. An Origin header is not authentication and can be forged outside browsers. |
| `MAX_CONNECTIONS_PER_IP` | Node server | `32`, within global limit 256. |
| `IP_UPGRADE_BURST` | Node server | `40`, refills at 2 upgrades/s. |
| `IP_ROOM_COMMAND_BURST` | Node server | `60`, refills at 10 commands/s. Shared across sockets from the same TCP peer IP. |
| `HEARTBEAT_MS` | Node server | `15000`, valid 1000–60000. Ping/pong liveness interval. |
| `SESSION_TIMEOUT_MS` | Node server | `10000`, valid 1000–60000. Unjoined sockets are closed. Leaving a room closes its socket. |
| `SHUTDOWN_MS` | Node server | `5000`, valid 100–30000. Maximum cooperative socket-close period before forced termination. |
| `LOG_INTERVAL_MS` | Node server | `30000`, valid 1000–300000. Structured operational metric interval. |

Vite reads frontend variables from `.env.local` or the build environment. **Node does not load Vite's env file**: supply server variables through its shell/process manager. Restart/rebuild the relevant component when configuration changes. The client reports invalid/missing public endpoints without taking down single-player. HTTPS pages and public production multiplayer require WSS.

Example commands using placeholder domains (do not run unchanged):

```sh
VITE_WS_URL=wss://arena.example.com/socket npm run build
NODE_ENV=production HOST=127.0.0.1 PORT=2567 \
  ALLOWED_ORIGINS=https://game.example.com npm run start:server
```

## Render server preparation — manual deployment only

No Render service has been created, and no production server hostname is known. The existing server already reads `HOST` and `PORT`; no networking, physics or security-code change is required. **Render ingress requires `HOST=0.0.0.0`**. Leaving this application's local default `127.0.0.1` would prevent ingress. The public service uses Render-managed TLS; Node continues to serve HTTP on its internal port. References: [Render Web Services](https://render.com/docs/web-services), [WebSockets](https://render.com/docs/websocket), [health checks](https://render.com/docs/health-checks), [Node versions](https://render.com/docs/node-version).

When you choose to deploy, connect the actual Git repository containing the reviewed changes. The local absolute filesystem path cannot be entered as Render's repository source. The current branch is `main`, but uncommitted/local-only changes are not available to Render until you separately authorize and publish them. No commit/push is performed by this preparation.

Enter these settings in **New → Web Service** (not Static Site, Private Service, or Background Worker):

| Dashboard setting | Value |
|---|---|
| Repository / Branch | Your actual repository / the branch containing the reviewed version (`main` locally) |
| Root Directory | Leave blank: repository root containing `package.json`, `server/`, and `shared/` |
| Language / Runtime | Node |
| Build Command | `npm ci --include=dev && npm run build:server` |
| Start Command | `npm run start:server` |
| Health Check Path | `/ready` |
| Instance count | **1**, manual scaling; no autoscaling or multiple replicas |
| Instance type | An always-on paid instance for persistent gameplay; target-host capacity still requires testing |
| Auto-Deploy | Off while validating; deploy manually only when authorized |
| Persistent disk / database | None required; neither restores this application's RAM state |
| Region / service name | Choose for your players/account; the name does not confirm an available public hostname |

`npm ci --include=dev` deliberately includes TypeScript and Node types even with `NODE_ENV=production`. `npm run build:server` compiles the shared/server TypeScript to `dist-server/`, including the verified entrypoint `dist-server/server/index.js`; `npm run start:server` executes that file. No `tsx`, Vite dev server, watch mode, backgrounding (`&`), frontend build or custom start wrapper is required for the Render server. Do not change Root Directory to `server/`, because compilation/imports also require `shared/` and the root configuration/lockfile.

Copy these **non-secret server settings** from [.env.render.example](.env.render.example) into Render's environment settings:

```text
NODE_VERSION=24.18.0
NODE_ENV=production
HOST=0.0.0.0
ALLOWED_ORIGINS=https://skyfall-arena-kappa.vercel.app
ALLOW_ORIGINLESS=false
```

Render supplies `PORT=10000` by default; leave that managed default in place. The example also records `PORT=10000` for reproducibility. If you intentionally configure another supported port, the application uses it. **Do not append `:10000` to the public browser URL.** `NODE_VERSION` pins the Node version used for local verification; the dashboard environment pin takes precedence over Render defaults. The application entrypoint does not automatically load either `.env.render.example` or Vite's `.env.local`; enter server variables in Render. Do not put `VITE_WS_URL` or credentials into this server profile. No Supabase/service-role/API secrets are required.

Keep `ALLOWED_ORIGINS` exactly as shown: one HTTPS origin with **no trailing slash**, wildcard, preview hostname or extra localhost origin. Leave all existing per-socket/IP budgets, schema validation, command sequencing, rotating guest resume credentials and authoritative simulation intact. A new regression loads this exact profile and verifies wildcard binding, probes, root-path WebSocket admission for the frontend origin, and rejection of missing, HTTP and lookalike origins.

### Ingress, probes and state guarantees

- HTTP probes and WebSocket upgrades share the same listener and internal `PORT`. Render handles public TLS and Upgrade forwarding; no application TLS certificates or extra WebSocket port are needed. Use **WSS** publicly. `/ready` returns 200 only when the server is ready, and 503 during failure/drain/stalled scheduling. `/health` remains the separate liveness diagnostic. Rapier initializes before the listener starts. An ordinary HTTP request to `/` returns 404; that is expected and is why the health path must not be `/`.
- The current WebSocket server has no path restriction. Its root URL `/` is locally verified and needs no invented `/socket` or `/ws` suffix. For the ordinary direct Render Web Service setup described here, use the assigned public hostname with the **root path**. If you later introduce a custom proxy/path, verify that routing explicitly before changing the client endpoint.
- Rooms, match results, guest identities and reconnect tokens live in one Node process. A disconnect may resume that same process within 20 seconds; a restart, redeploy, crash, instance replacement or idle shutdown loses all rooms/tokens. A disk cannot restore them. Render may interrupt connections for maintenance, even on a paid instance. Multiple replicas can route new joins/resumes to a different room map and are unsupported. A rolling deploy can briefly overlap old/new processes; do not promise room continuity or admit new matches during planned maintenance.
- Free instances spin down after 15 minutes without inbound traffic and may take about a minute to wake. They are useful for experiments, not a promise of persistent availability. An always-on instance avoids idle spin-down, **not** restarts or maintenance. See [Render Free limitations](https://render.com/docs/free).
- SIGTERM invokes the existing drain/1012 restart notice and bounded five-second shutdown. Keep platform shutdown grace longer than this; Render documents a default 30-second window. Do not add a second Node worker/process manager cluster. Collect JSON operational logs, including `server_started`, `upgrade_rejected`, `command_rejected`, `server_metrics`, `server_draining` and `server_stopped`; the upstream Rapier warning remains on stderr.
- **Proxy/IP admission remains an operational check:** the server intentionally uses the TCP peer and does not trust `X-Forwarded-For`. Render proxy traffic can share app-level IP budgets. Verify the actual peer/admission behavior and trusted edge protections on Render; do not bypass or increase limits to hide rejections. The local single-room/two-browser pass does not establish Render capacity.

### After a separately authorized Render deployment: Vercel and two-client verification

1. Wait for `/ready` to pass and the Render logs to show `server_started`. Copy the **actual assigned HTTPS service URL** from the dashboard. No such URL exists in this repository yet; never derive it from a suggested service name or use the example domains.
2. Check both `/health` and `/ready` on that real HTTPS origin with normal certificate verification. Expect 200 and readiness true. Do not use `curl -k`, a private Render hostname, localhost or the internal port in the public client.
3. Form `VITE_WS_URL` by changing that confirmed service URL's scheme from `https://` to `wss://` and using `/` as its path for this direct setup. There is no required `/socket` suffix. This is a derivation rule, **not a claimed deployed endpoint**.
4. In the existing Vercel frontend project, open **Environment Variables**, add `VITE_WS_URL` for **Production**, and set it to the confirmed WSS root URL. Only this public URL belongs in the frontend. A new Vercel production build/deployment must be separately authorized: environment changes do not update old bundles. Confirm the active frontend is no longer using an undefined endpoint. Preview environments are not allowed by the server profile and require a deliberate origin policy if later needed; do not enable wildcard origins.
5. Open `https://skyfall-arena-kappa.vercel.app/` in two independent browser tabs/windows. Preserve Console and Network logs. Create a room in one, join the actual code in the other, and verify a WebSocket **101 Switching Protocols** to the confirmed WSS URL with exactly that frontend Origin. Verify both rosters, ready/unready, host launch guard, countdown, flight/boost, hits/elimination, matching results, rematch and return to lobby.
6. Refresh one pilot and choose saved-session reconnect inside 20 seconds. Exercise host handoff and a temporary network interruption; correlate server/proxy logs. Test expired reconnect and an actual server restart: old rooms must end rather than falsely resume. Confirm single-player works with the server unavailable. Record failures rather than declaring production success.

Local preparation verification (2026-10-17, Node 24.18.0 on macOS): both clean installs (`npm ci --include=dev`, including `NODE_ENV=production`) passed in an isolated temporary source copy, with 102 packages installed and zero audit vulnerabilities reported. The fresh `npm run build:server` generated the expected entrypoint; the exact `npm run start:server` command passed probes, root WebSocket room creation and graceful SIGTERM checks on `0.0.0.0:10000`. The 30 relevant server/protocol tests and full **49/49 tests** passed; client/server TypeScript checks and both production builds passed. See [Render preparation evidence](reports/render-preparation.md), [raw verification output](reports/render-preparation.log) and [startup smoke result](reports/render-start-smoke.json). This is local evidence, not a Render/Linux or public-TLS certification. Existing Rapier/bundle warnings remain. npm also reported install-script policy warnings for esbuild/fsevents in the isolated install; the server build/start succeeded without changing that policy.

Remaining blockers: the reviewed source must become available to Render, a service must actually be provisioned/deployed, its hostname/TLS/Upgrade/probes/origins and proxy admission must be verified, and two real production clients plus target-host soak/load testing must pass. The local preparation and tests do not establish production readiness. Vercel's active frontend remains unchanged and blocked until a confirmed endpoint is baked into a new build. No service, hostname, route rewrite, disk, database or deployment was created here.

## Deployment requirements — not performed here

1. Serve `dist/` over HTTPS. Supply the real `VITE_WS_URL` **before** building. Cache hashed assets immutably, revalidate `index.html`, and verify gzip/Brotli negotiation on the serving infrastructure. `npm run preview` is a local verifier, not a production frontend server.
2. Run `dist-server/server/index.js` as a supervised, long-lived Node ESM process. Install locked dependencies with `npm ci` (build first if omitting dev dependencies in the runtime image). Route WebSocket Upgrade traffic through a TLS reverse proxy to the private Node port; set its idle timeout longer than the heartbeat cycle and its termination grace longer than `SHUTDOWN_MS` plus probe/network margin.
3. Use **one authoritative server instance** for this release. Rooms have no shared directory or cross-process state. Per-client sticky sessions alone do not route a new joining player to the correct room. Horizontal scaling requires future room-aware routing/state work; do not add random replicas behind a generic load balancer.
4. Probes: `GET /health` is liveness; `GET /ready` is readiness. Allow startup time for WASM initialization before declaring a failure. Only route new traffic after readiness 200. Probe failures/timeouts must be handled by the supervisor; a blocked event loop cannot answer HTTP. Keep the Node port/probes private where possible. There is no public metrics endpoint.
5. **Proxy/IP policy must be chosen and tested.** The application uses `req.socket.remoteAddress` and never trusts spoofable `X-Forwarded-For`. Behind a single reverse proxy all traffic may share one IP budget. Configure the aggregate app budgets intentionally and enforce per-real-client limits at the trusted edge. Raising app limits without an edge policy weakens abuse protection. HTTP/upgrade volumetric abuse and TLS termination remain infrastructure responsibilities.
6. Verify on the actual target CPU/memory limit and network, including eight human players, representative sustained combat, adverse latency/disconnects, a long soak, graceful drain, and abrupt restart. These are launch blockers until verified; local loopback numbers do not establish hosted capacity.

## Probes, logs, shutdown and restart guarantees

`GET /health` returns 200 while the process is live, including cooperative drain, and 503 after a caught simulation/command failure. `GET /ready` returns 200 only while not draining/failed and the simulation scheduler has progressed recently; otherwise 503. Unknown paths are 404, or 503 while unavailable. Methods other than GET return 405. Probe responses use `Cache-Control: no-store`. The listener starts only after Rapier initializes.

Standard output is JSON Lines for startup, connection open/close, admission/policy rejection, heartbeat/session timeout, periodic metrics, simulation/command failure, drain and stop. Logs omit tokens, names, invite codes and raw payloads. Metrics report tick-work percentiles (up to the most recent 18,000 samples), over-budget ticks, dropped catch-up time, message/byte counts, rejection/backpressure counts, CPU average as percent of one core, current RSS/heap, process-lifetime peak RSS, and event-loop delay. These logs require collection/rotation/alerting on the eventual host. Rapier currently emits one upstream non-JSON warning on stderr.

**Exact volatile-state guarantees:**

- Rooms, guest identities, scores, host membership and tokens exist only in that process's memory. There is no database, snapshot file, restart restoration, durable final result, or match migration. This is deliberate: partial restoration without a durable identity/state design would give false guarantees.
- SIGINT/SIGTERM first makes readiness 503 and stops simulation/admission. Connected clients are sent a fatal restart notice, then close code 1012. Cooperative clients clear the ended session and return to room creation/join; the notice is best effort, not a delivery guarantee. Unresponsive sockets are terminated by `SHUTDOWN_MS`, timers stop, worlds free, and HTTP closes. Repeated shutdown calls share the same promise. Active matches end rather than waiting to finish.
- A crash/SIGKILL cannot send a notice. A new process knows none of the old rooms or tokens. A retry against it rejects the old session; the client then clears it and must create/join again. If the process remains unavailable, bounded automatic retries stop; manual reconnect or single-player remains available. Old invite codes do not restore matches, even if a code is randomly reused later.
- A normal observed disconnect retains that pilot's reconnect right for 20 seconds of **monotonic wall time**, independent of bounded physics catch-up. Resume rotates the 256-bit token and revokes the prior socket. Delayed close events cannot detach its replacement. Explicit leave revokes immediately. Lost close events are detected after up to roughly two heartbeat intervals (30 seconds by default), followed by the 20-second reconnect window; stalls/network scheduling can extend observation latency.
- Host transfers immediately on observed disconnect; returning does not reclaim it. Disconnect during countdown cancels launch and clears readiness. After grace, lobby pilots are removed, active pilots forfeit, and wholly abandoned rooms are freed once all reconnect rights expire. Disconnected rows may remain in a results roster while connected players still view it. Wholly abandoned cleanup is bounded by grace/heartbeat observation. Connected lobbies/results also expire after ten minutes without a room command, with a fatal notice and invalidated membership; entering results and observing a disconnect reset that idle clock.

## Security audit scope

Protocol v1 accepts only strict intent schemas: finite bounded aim, discrete movement, booleans, monotonic input sequence, exact fields/version, and valid IDs/codes. Client transforms, damage, score and hits are never accepted. Server Rapier handles geometry, acceleration, fuel, fall bounds, camera/weapon occlusion, 200 ms fire cooldown and outcomes. Tests cover forged authority, unauthorized host actions, duplicate commands and stale sessions.

Per-socket token buckets allow a 60-message burst/refill of 60/s and a 10-room-command burst/refill of 10/s. Per-IP admission and command buckets survive reconnects and expire inactive entries after a minute; the map is bounded to 4096 IPs. Other limits: 2 KiB frames, three malformed-command strikes, 128 KiB outbound backpressure, 32 rooms and 256 total connections. Production browser origins are exact allowlisted HTTPS origins; missing Origin is refused by default. No wildcard suffix matching is used.

Invite codes use 32 symbols × six positions (30 random bits), collision-checked among live rooms. They are invitations, **not account authentication or passwords**; budgets reduce guessing but do not turn them into credentials. Resume tokens use 256 random bits, timing-safe comparison and rotation, are private to their owner, and are never in public snapshots/logs. Guest names are unverified labels. Bots, aim automation, collusion, distributed denial of service and stolen browser-session storage are not solved by authority or origin filtering.

## Verify and reproduce load measurements

```sh
npm test
npm run typecheck
npm run build
npm run bundle:report
npm run loadtest -- --rooms=4 --players=8 --seconds=30 --warmup=5 --fire=false --output=reports/load-flight-4x8-rerun.json
npm run loadtest -- --rooms=8 --players=8 --seconds=30 --warmup=5 --fire=false --output=reports/load-flight-8x8-rerun.json
```

Tests bind loopback ports and require permission in a restricted sandbox. Build outputs are `dist/` and `dist-server/`. The harness requires the compiled server and starts/cleans up an isolated child on a random loopback port. It accepts 1–32 rooms, 2–8 players, 5–120 measured seconds, and 1–30 warmup seconds. Use a **new output filename** for every run: exclusive creation refuses to overwrite retained evidence.

The default `--fire=false` measures flight/snapshot capacity. `--fire=true --scenario=skirmish` measures **continuous nonlethal cover fire with bounded real skirmishes**, not elimination-heavy deathmatch capacity. Snapshot-informed bots mirror the shared arena and camera/weapon rays locally to choose safe cover-fire directions, fly in separated paired lanes with synchronized hover/boost timing, seek two real hits each, and then keep firing while flying. Warmup uses movement without firing; all activity thresholds apply throughout the measured firing window. They receive ordinary damage. There is no immunity, health reset, respawn, server-state injection or validation bypass. The server still determines movement, fuel, raycasts, cooldowns, hits and outcomes. Extra aim-planning CPU runs in the parent on the same host; reported CPU is the server process only. Both camera and weapon paths need checking: the old fixed upward aim could target nearby pilots through the third-person camera ray, eliminating 14/32 in the retained failure.

Every measured snapshot must keep the entire roster alive and the match playing. Each pilot must move more than 0.5 units overall, acknowledge at least 15 inputs and travel more than 0.03 units in **every complete one-second window**. Firing profiles additionally require at least four authoritative shots per second, at least four per second overall, and no shot-progress gap over 500 ms. Skirmish profiles also require every pilot to start at full health, register at least two authoritative hits and receive at least 50 damage during measurement. Safety/stale-snapshot fire pauses are counted and cannot excuse a failed threshold. `--scenario=legacy --fire=true` retains the former fixed-aim driver for comparison; valid eliminations can still make it fail. No failed result is converted to a pass.

```sh
# After npm run build; choose fresh filenames for reruns:
npm run loadtest -- --rooms=4 --players=8 --seconds=30 --warmup=5 --fire=true --scenario=skirmish --output=reports/load-combat-rerun.json
npm run loadtest -- --rooms=4 --players=8 --seconds=30 --warmup=5 --fire=true --scenario=legacy --output=reports/load-combat-legacy-rerun.json
node --import tsx --test scripts/load-scenario.test.mjs
```

The parent load-generator process and child server share a desktop host. Reports measure **server process** tick work/CPU/memory and **client** snapshot interarrival gaps/rates, not one-way WAN latency. Payload byte counts exclude transport/TLS overhead. Single-IP admission bursts are explicitly lifted for co-located bots; payload validation, per-socket budgets, physics, cooldowns and authority remain enabled. Thus this measures simulation/delivery work, not production edge admission capacity. Limits/checks are encoded in the harness: p95 tick work <33.33 ms, <1% over-budget ticks, zero dropped simulation time/errors/disconnects, every client ≥13.5 snapshots/s, max snapshot gap <500 ms, all pilots active. A failed check exits nonzero and retains a report.

Latest verification: **44/44 tests passed**, client/server typechecks and both production builds passed. The retained `reports/load-combat-sustained-4x8.json` passes the defined 4-room/32-player cover-fire/skirmish scenario for **30.006 s**, with **4,800 accepted shots / 66 hits**, all pilots alive throughout, tick p95/max **6.85/70.89 ms**, **3/901** over-budget ticks, **14,416 snapshot deliveries**, **16.34%** server CPU on one-core basis, **105.45 MiB** end RSS, and **zero disconnects/dropped simulation time**. Hits occur mainly in the opening skirmishes; continuous high-damage/elimination capacity remains unproven. A separate flight-only regression also passes. Original failed reports and every intermediate attempt are preserved; no server/gameplay/security behavior changed for this correction.

Actual retained measurements and verification outcomes are in `reports/phase4-validation.md` and raw JSON reports. Failed/diagnostic runs are retained rather than presented as passing benchmarks. No inference about the 32-room maximum or hosted capacity is justified by a smaller local profile.

## Rapier warning and bundle investigation

The installed Rapier 0.19.2 public declaration is `init(): Promise<void>`. Inspection of its installed JS shows that public wrapper passing a raw embedded WASM buffer to the internal loader, while the loader warns that it expects `{module_or_path: ...}`. Passing options to the public no-argument wrapper cannot change that internal call. Tests and live physics still initialize correctly. No console suppression, unverified dependency upgrade, or vendored package patch was applied.

The engine remains lazily split from the UI and shared across cached chunks. The dominant ~2.24 MB JavaScript chunk is Rapier's **embedded base64 WASM**, not duplicated multiplayer assets. Three.js is ~704 KB. Replacing the compatibility package with separately hosted WASM changes initialization/asset hosting and the physics dependency integration; it is not a safe cosmetic warning fix. `npm run bundle:report` records raw/gzip/Brotli sizes without hiding Vite's warning. Compression estimates do not prove a production server sends compressed content. Configure and measure that on the actual hosting layer.

## Source map and remaining limitations

- `shared/`: versioned protocol/validation, arena geometry, flight rules, frontend endpoint validation.
- `server/`: authoritative simulation, room lifecycle, environment validation, token buckets, transport/probes/drain/logging/metrics, and unit/integration tests.
- `src/multiplayer/`: networking/reconnect, interpolated server snapshots, multiplayer rendering and menus. `src/game/` and `src/components/` retain solo gameplay/HUD/effects.
- `scripts/`: isolated compiled-server load runner and bundle report. `reports/`: measured evidence, including failed runs.

Remaining launch blockers are target-infrastructure TLS/origin/proxy/IP policy verification, WAN/adverse-network and browser/device coverage, representative sustained-combat and longer target-host soak/capacity testing, and accepting the documented loss of all rooms/results on restart. No client prediction, lag compensation, authentication, durable results, multi-instance routing, music/positional audio or mobile touch gameplay was added. Server authority is preserved, but high-latency competitive feel is unchanged. Existing engine size and Rapier warning remain visible. No deployment or external service modification has been performed.
