# Phase 4 verification evidence

Recorded on 2026-10-17 Asia/Kolkata; raw JSON timestamps are UTC. No deployment, commit, or external service modification was performed. This is local evidence, not production certification. The latest harness correction, 44-test verification and passing scoped continuous-fire measurement are recorded in the follow-up section below.

## Original Phase 4 checkpoint checks

- `npm test`: **40 tests, 40 passed, 0 failed/cancelled/skipped**, final run duration 3007.71503 ms.
- `npm run typecheck`: client and server checks passed.
- `npm run build`: client Vite build and server TypeScript build passed; Vite still reports the existing large engine chunks.
- `node --check scripts/load-test.mjs` and `node --check scripts/load-server.mjs`: passed.
- `node scripts/bundle-report.mjs`: [raw/compressed asset-size estimates](bundle-sizes.json).

Tests retain all twelve solo gameplay checks and real multi-client combat/reconnect/rematch/capacity scenarios. New cases cover exact/production origins and missing Origin, configuration errors, malformed/binary/oversized/forged messages, token-bucket/IP budgets, duplicate/unauthorized commands, heartbeat and unjoined-session timeouts, graceful drain/restart notice/upgrade refusal, failure probes/logs, abrupt disconnect expiry, volatile restart invalidation, inactive connected lobby expiry, and failed-bind cleanup/retry. The failed-bind regression found a relayed WebSocket server error that could prevent the listener promise rejecting; an explicit error handler fixes it, and the final test passes.

## Measured profiles

Host: Node v24.18.0; Darwin 25.6.0 x64; Intel Core i5-1038NG7 @ 2.00 GHz; 8 logical CPUs. Compiled Node server runs in a child process; real `ws` clients run in the parent on the same desktop/loopback. The desktop is not a dedicated/isolated production host. Rendering, TLS, WAN, reverse-proxy behavior and edge-admission capacity are **not** measured. The single-IP admission limits are deliberately lifted for co-located bots; normal per-socket/schema/physics validation remains enabled.

| Raw report | Rooms × players | Measured | Workload | Tick p95 / max | CPU (one-core basis) | End RSS | Median snapshots/s | Max receive gap | Result |
|---|---|---|---|---|---|---|---|---|---|
| [load-4x8.json](load-4x8.json) | 4 × 8 | 30.00 s | flight only | 4.25 / 27.11 ms | 11.86% | 104.62 MiB | 14.999 | 129.98 ms | PASS |
| [load-8x8.json](load-8x8.json) | 8 × 8 | 30.00 s | flight only | 6.95 / 71.04 ms | 20.69% | 111.68 MiB | 14.999 | 136.41 ms | PASS |
| [load-diagnostic.json](load-diagnostic.json) | 2 × 8 | 8.00 s | combat | 3.78 / 5.81 ms | 9.17% | 96.74 MiB | 14.998 | 123.37 ms | PASS |

The sustained flight runs used five seconds of warmup. Both kept every pilot alive and moving with acknowledged input, no results/idle snapshots, no protocol errors, no disconnects and no dropped simulation catch-up time. Each client received about 450 snapshots in 30 seconds. The 32-client run had **0/901 over-budget ticks**; the 64-client run had **2/900** (0.22%), including its 71.04 ms maximum. The maximum is not hidden by the favorable percentile. Peak lifetime RSS was 104.62 MiB / 111.68 MiB respectively. Outbound payloads were 50,352,400 / 100,594,696 bytes over the server metric windows (transport/TLS overhead excluded). CPU values are server-process user+system time divided by elapsed time, expressed relative to one core, not whole-machine utilization.

Snapshot rates/gaps are client receive measurements, **not end-to-end or one-way network latency**. Server metric windows include a few extra milliseconds for the IPC collection round trip. Local profiles do not prove 256-player or 32-room capacity. Later startup-bind error handling does not alter the measured steady-state simulation workload.

### Failed combat runs retained

- [load-4x8-initial.json](load-4x8-initial.json): 32-client, 30-second continuous-fire attempt **failed** the sustained-active-pilot check. P95 tick work 6.25 ms; no disconnects; not a valid eight-active-pilots-per-room capacity pass. This early report lacked per-pilot diagnostics.
- [load-4x8-combat.json](load-4x8-combat.json): the next 32-client continuous-fire attempt **also failed** that check. Per-pilot diagnostics confirm **14 of 32 pilots eliminated** before the end. P95 tick work 7.03 ms, but fewer active pilots means it must not be sold as sustained full combat load.
- [load-diagnostic.json](load-diagnostic.json): a short earlier diagnostic, 16 clients, two-second warmup and eight measured seconds, passed with real shots and all pilots active. It predates the deterministic driver-phase refinement. It is useful short combat evidence, not a long-duration or final sustained-combat benchmark.

Bots receive normal damage and no immortality or server-state overrides. The default flight profile explicitly uses `--fire=false`; the harness still fails if a participant dies/stops moving or rooms go idle. `--fire=true` is available for combat experiments, whose failures are saved and exit nonzero. Representative combat-aware churn/rematch and target-host soak testing remain launch blockers.

## Reproduce

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run loadtest -- --rooms=4 --players=8 --seconds=30 --warmup=5 --fire=false --output=reports/load-4x8.json
npm run loadtest -- --rooms=8 --players=8 --seconds=30 --warmup=5 --fire=false --output=reports/load-8x8.json
# Combat profile may fail sustained activity because normal eliminations reduce participation:
npm run loadtest -- --rooms=4 --players=8 --seconds=30 --warmup=5 --fire=true --output=reports/load-combat-new.json
npm run bundle:report
```

Run profiles sequentially on an otherwise quiet host when comparing capacity; concurrent build/test/desktop workloads affect scheduling. Preserve original reports if recording another run. Tests and harnesses need permission to bind loopback sockets in restricted sandboxes.

## Engine findings

Public Rapier `init()` has no arguments; the package's wrapper passes raw embedded WASM bytes to a loader that warns about its own legacy calling convention. Changing application arguments cannot fix that call. No warning suppression, package-source patch or speculative upgrade was applied. Physics tests still pass.

Latest build: UI entry 247,872 bytes; world 221,017 bytes; Three.js 703,765 bytes; Rapier runtime 2,237,128 bytes. Rapier gzip estimate 830,285 bytes and Brotli estimate 615,480 bytes. These are offline estimates; actual content-encoding, transfer time and caching must be verified on the hosting stack. Lazy/cached engine chunks remain intact; no dependency changes were introduced in Phase 4.

## Changed files

- Updated: `server/app.ts`, `server/index.ts`, `server/rooms.ts`, `shared/protocol.ts`, `shared/protocol.test.ts`, `src/multiplayer/network.ts`, `package.json`, `.env.example`, `README.md`.
- Added: `server/config.ts`, `server/limits.ts`, `server/metrics.ts`, `server/hardening.test.ts`, `shared/websocket-url.ts`, `scripts/load-server.mjs`, `scripts/load-test.mjs`, `scripts/bundle-report.mjs`, this report and the raw JSON artifacts.
- Existing arena rendering, solo wave/combat rules, multiplayer authoritative simulation, effects and dependencies were preserved. The directory still has no Git repository, so there is no Git diff or commit.

## Remaining launch blockers

Real TLS/WSS and HTTPS hosting, correct allowed origins, trusted-proxy IP admission policy, probe/supervisor/log collection verification, target-host long soak and representative sustained combat, WAN/adverse-network and browser/device coverage. A single server instance is required; state/result loss on every restart must be accepted and communicated. No authenticated accounts, durable results, horizontal room routing, prediction or lag compensation was added. Large engine chunks and the upstream initialization warning remain. No production-readiness certification is claimed.

## Sustained-combat harness correction (follow-up)

This supersedes the original checkpoint's statement that no valid 30-second continuous-fire profile exists. It establishes only the defined local cover-fire/skirmish workload, not elimination-heavy deathmatch or production capacity. No `server/`, `shared/`, `src/`, dependency, physics, damage, security or transport implementation changed in this follow-up. The harness still launches the same authoritative compiled server. Only bot strategy, harness diagnostics/assertions, tests, package test command and documentation changed.

### Cause and scenario

The old bots clustered around their spawns and fired at fixed yaw 0 / pitch 0.85. Upward aim is not a guarantee of missing: the server first casts from its derived third-person camera and then from the weapon toward that aim point. Nearby moving pilots, including pilots behind the shooter, can enter those paths. Four ordinary 25-damage hits eliminate a pilot, disabling that pilot's physics/input/fire. Thus the retained 14-death run gradually measured fewer active combatants, even while sockets still received snapshots. Its favorable tick percentile cannot validate 32 continuously active combatants. A new regression reproduces the camera-path hit with the unmodified authoritative simulation.

The revised `skirmish` scenario flies in separated paired lanes, uses synchronized hover/boost timing, and warms up without firing. Every measured second uses ordinary movement/flight/boost/fire intents. A harness-only Rapier mirror of shared geometry and camera/weapon rays chooses cover-fire directions and seeks two nonlethal hits per pilot. Small aim searches and short bursts avoid phase-locking every attack attempt between the server's 200 ms cooldown opportunities. Snapshot age over 150 ms or an unsafe predicted shot pauses firing; these pauses are counted, never exempted from activity checks. Predictions are fallible: actual collateral damage can still occur and a death fails the run.

No immortality, health refill, respawn, teleport, client-reported transforms/hits or server overrides were added. The server retains normal health, damage, fuel, bounds, cooldown, rate/schema validation and outcomes. The pre-existing harness-only co-located IP admission allowances remain disclosed above. Parent aim-planning CPU contends on the same desktop but is excluded from the server-process CPU measurement.

Original survival, acknowledged input, displacement, room-playing, error/disconnect, delivery, tick-budget and no-dropped-time checks remain. They are **stronger** now: every received snapshot must contain eight alive pilots; each complete one-second window must contain >=15 acknowledged inputs, >=4 authoritative shots and >0.03 units of travel for every pilot. Also require >=4 shots/second overall, >0.5 units overall displacement, no shot-progress gap >500 ms, and full starting health plus >=2 server-recorded hits and >=50 damage received per pilot during measurement. Empty/missing windows fail. Normal elimination and cooldown rules are covered by existing regression tests. `legacy` retains the original fixed-aim behavior for comparison, subject to the stronger assertions.

### Final measured result: PASS for this defined workload

Raw report: [load-combat-sustained-4x8.json](load-combat-sustained-4x8.json), generated `2026-10-16T20:50:36.905Z`. Same host/environment as the preceding measurements; no builds/tests were run concurrently with this final measurement.

| Measurement | Actual result |
|---|---|
| Rooms / players | 4 rooms × 8 players = 32 real WebSocket clients |
| Warmup / measured duration | 5 s movement-only / 30.005877865 s firing |
| Server metrics window | 30015.613622 ms (includes IPC collection margin) |
| Tick p95 / max | 6.850299 / 70.891519 ms |
| Over-budget ticks (>33.333 ms) | 3/901 (0.3330%) |
| Server snapshot deliveries / payload | 14,416 / 62,306,288 bytes |
| Client median snapshots/s | 14.997061643 |
| Receive-gap p95 / max | 72.341700 / 158.791959 ms |
| Server CPU (one-core basis) | 16.337234% |
| End RSS / peak lifetime RSS / heap | 105.449219 / 105.890625 / 19.905197 MiB |
| Disconnects / heartbeat / backpressure closes | 0 / 0 / 0 |
| Dropped simulation time / rejected commands / client errors | 0 ms / 0 / 0 |
| Accepted shots / registered hits | 4,800 / 66 |

All 32 pilots stayed alive in every observed snapshot, each accepted exactly 150 shots, each registered 2–3 hits and received 50–75 damage, ending at 25–50 health. Across all 960 complete pilot-second windows, minima were 5 shots, 26 acknowledged inputs and 3.026891 units of travel. Maximum observed shot-progress gap was 294.602861 ms. There were 6 stale-snapshot fire-paused input frames and 0 unsafe-aim pauses; all activity thresholds still passed. The raw report includes every pilot's full per-second windows and all nine checks.

This is sustained **firing/raycast, flight and snapshot delivery** with bounded hit/damage work. Hits are concentrated in the opening skirmishes, followed by mostly cover fire. It does not prove continuously high hit/elimination rates, death/rematch churn, long soaks, larger room counts, human movement distributions, WAN/TLS/browser performance, or target-host capacity. The 70.89 ms maximum and three over-budget ticks are explicitly retained despite the passing p95 and <1% over-budget threshold.

### Evidence preservation and intermediate failures

The original failed reports remain byte-for-byte unchanged (SHA-256 checked before and after this work):

- `load-4x8-initial.json`: `57c7e0326f35abf0b97ec1ca9170bb7d80f03b52ebf62070584fc346b44876a2`
- `load-4x8-combat.json`: `2fee05b4709f9149b9d83d1b864ce4a93df119793d3b9330f26b4d01297a4003`

All intermediate reports are retained, with their original `passed` values. These reflect successive harness revisions, not server behavior changes. The first 32-client intermediate run overlapped a short harness unit-test invocation, so it is development evidence rather than the final isolated measurement.

| Report | Rooms × players | Seconds | Result | Reason/context |
|---|---|---|---|---|
| [load-skirmish-diagnostic-1.json](load-skirmish-diagnostic-1.json) | 1 × 8 | 8.000616 | FAIL | Initial aim-aware driver; steering interpreted world feedback in aim-local coordinates; incomplete hits. |
| [load-skirmish-diagnostic-2.json](load-skirmish-diagnostic-2.json) | 1 × 8 | 11.999775 | FAIL | Steering corrected; camera-path collateral and incomplete hits. |
| [load-skirmish-diagnostic-3.json](load-skirmish-diagnostic-3.json) | 1 × 8 | 30.001333 | FAIL | Camera guards/aim search; some attack bursts missed cooldown opportunities. |
| [load-combat-sustained-4x8-attempt1.json](load-combat-sustained-4x8-attempt1.json) | 4 × 8 | 30.001688 | FAIL | All firing/activity checks passed; unequal received damage failed the added per-pilot skirmish check. |
| [load-combat-sustained-4x8-attempt2.json](load-combat-sustained-4x8-attempt2.json) | 4 × 8 | 30.003175 | FAIL | Separated lanes with mixed flight profiles; one elimination and incomplete skirmish checks. |
| [load-combat-sustained-4x8-attempt3.json](load-combat-sustained-4x8-attempt3.json) | 4 × 8 | 30.001548 | PASS | Synchronized flight, no warmup fire; all checks passed; each pilot 150 shots and two hits. |
| [load-combat-sustained-4x8.json](load-combat-sustained-4x8.json) | 4 × 8 | 30.005878 | PASS | Fresh-build confirmation, all checks passed; final numbers above. |

### Verification and exact final commands

```sh
node --import tsx --test scripts/load-scenario.test.mjs
npm test
npm run typecheck
npm run build
node --check scripts/load-test.mjs
node --check scripts/load-scenario.mjs
node --check scripts/load-server.mjs
npm run loadtest -- --rooms=4 --players=8 --seconds=30 --warmup=5 --fire=true --scenario=skirmish --output=reports/load-combat-sustained-4x8.json
npm run loadtest -- --rooms=1 --players=2 --seconds=5 --warmup=2 --fire=false --output=reports/load-flight-regression.json
shasum -a 256 reports/load-4x8-initial.json reports/load-4x8-combat.json
```

Use fresh output filenames on rerun: exclusive writes refuse overwriting existing evidence. Load commands above are the exact commands used (stdout redirected to temporary local logs). Restricted sandboxes must permit the local listener. `--scenario=legacy --fire=true` reproduces the old bot strategy with stronger current checks, not a promised passing result.

- Harness-specific regression run: **4/4 passed**, 0 failures/cancelled/skipped, 424.007347 ms. Covers authoritative aim agreement, fixed-upward camera-path collateral, stopping targeting at observed half health without mutation, and failures for death, missing/sparse or inactive windows and stalled fire.
- Full `npm test`: **44 tests, 44 passed, 0 failed/cancelled/skipped**, 3073.735053 ms. Includes unchanged gameplay elimination/cooldown/cover and real multi-client lifecycle/combat/security regressions.
- `npm run typecheck`: client and server passed.
- `npm run build`: client Vite build and server TypeScript production build passed. Client built in 5.58 s, 355 transformed modules. Existing Three/Rapier large-chunk warning persists (703.77 kB / 2237.13 kB); upstream Rapier initialization warning remains unsuppressed. No dependency/bundle changes were needed for this harness fix.
- All three `node --check` commands passed.

- Flight-only compatibility regression: [load-flight-regression.json](load-flight-regression.json), **PASS**, 1 room / 2 players, 5.001756735 measured seconds after 2 s warmup. Tick p95/max 0.869425/1.294361 ms, 0/151 over budget, 150 deliveries, median 14.994732 snapshots/s, max gap 100.033343 ms. CPU 4.522631% of one core, RSS/peak/heap 94.468750/94.484375/12.697113 MiB. Zero errors, disconnects, rejected commands or dropped simulation time. This short profile verifies harness compatibility, not a new capacity claim.

### Follow-up changed files and remaining blockers

Updated `scripts/load-test.mjs`, `package.json`, `README.md`, and this evidence report. Added `scripts/load-scenario.mjs`, `scripts/load-scenario.test.mjs`, `load-skirmish-diagnostic-1.json`, `load-skirmish-diagnostic-2.json`, `load-skirmish-diagnostic-3.json`, `load-combat-sustained-4x8-attempt1.json`, `load-combat-sustained-4x8-attempt2.json`, `load-combat-sustained-4x8-attempt3.json`, `load-combat-sustained-4x8.json` and `load-flight-regression.json` under `reports/`. Build artifacts were regenerated. The original failed JSON reports and all application/server/shared sources remain unchanged. There is no Git repository in this directory.

Remaining launch blockers are the infrastructure, WAN/browser and restart guarantees documented above, longer target-host soaks, and elimination/rematch/churn-heavy combat measurements. The scenario intentionally cannot prove unlimited sustained damage with finite hull and no respawn. No deployment, commit or external service modification occurred.
