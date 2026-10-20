# Gameplay polish and multiplayer reliability — 2026-10-20

Local validation only. The user reports production verification already completed; this task neither repeats nor certifies it. Historical Phase 4/dual-mode reports are preserved. No deployment, commit, push, production configuration change, dependency, database, or service was added.

## Scope and findings

The working tree already contained the prominent home-screen button change (`MainMenuActions.tsx`, its test, and `style.css`); it was preserved. Reviewed README, Phase 4/dual-mode architecture and evidence, client input/render/state/reconnect code, shared protocol, authoritative rooms/simulation/transport, and tests before edits. Baseline `npm test`: **63 passed, 0 failed**.

Server lifecycle/security audit did not demonstrate a runtime defect requiring a server change. Exact origin validation, command/rate limits, intent-only authority, private rotating tokens, old-socket revocation, 20-second grace, host handoff, stale-input braking, idle expiry and single-process storage remain intact. Guest identity is token-based, not account authentication.

Confirmed client issues: exhausted retry attempts left the stale room/player visible; a replaced session cleared its credentials but retained room UI; stalled connection/welcome had no client deadline. Recovery now bounds each connection/welcome attempt to five seconds, with at most eight automatic retries within a 20-second recovery deadline. It clears the stale room and credentials on rejection, replacement or exhausted recovery and tells the player to create/join again. Fatal restart messages terminate recovery. Socket generations plus a per-attempt close guard ignore delayed messages/close events. A timer advances recovery even when the browser never emits close. Normal welcome saves the rotated token, restores identity and snapshots, and clears the connection timer. Leave cancels timers.

Gameplay uses existing systems: short emissive avatar hit flashes; authoritative elimination confirmation; existing hit markers/beams/impact/destruction particles and audio retained; particle/beam arrays compact in place rather than filtering every frame. Low-health hull styling and a critical-hull survival hint; survival results now offer Return to Home as well as Play Again. Returning home resets the run/telemetry/results while preserving loaded/audio preferences. Drone profiles retain existing health/damage/wave speeds/timers/scoring, add smooth bounded proximity evasion and deterministic varied cooldowns, track early in the warning, then lock aim for the final 450 ms. Warning rings remain visible and the final shot still raycasts against cover. This is polish, not a claim of fully balanced difficulty.

## Automated verification

Commands actually run (loopback socket tests require sandbox network permission):

```sh
npm test
node --import tsx --test src/multiplayer/network.test.ts src/game/logic.test.ts
node --import tsx --test src/multiplayer/network.test.ts
npm run typecheck
npm run build
# Repeated after final edits:
npm test
npm run typecheck
npm run build
git diff --check
```

- Baseline suite: **63/63**.
- Focused gameplay/client recovery tests: **15/15**; separate recovery rerun **1/1**.
- Expanded full suite: **69/69**, zero failed/cancelled/skipped. Includes real WebSocket multi-client combat, reconnect/token rotation, rematch, capacity, restart invalidation, probes/shutdown and security tests.
- Added deterministic tests for interleaved ready/unready/start and duplicate start, simultaneous lethal fire and idempotent award, active-room disconnect/resume, results host departure, multi-room isolation, expiry/cleanup, client recovery timeouts/exhaustion/fatal restart/replacement, stale welcome suppression and duplicate shot feedback. Uses controlled room ticks and mocked client timers; no arbitrary sleeps added for race tests.
- Initial typecheck found a duplicate test-only import introduced during editing; removed before final checks.
- Client/server TypeScript checks and both production builds: **passed**, exit code 0. Existing Rapier initialization and large Three/Rapier engine warnings remain unsuppressed.

## Actual browser checks

Ran Vite on `http://localhost:5173/` and the compiled existing server on loopback port 2567 (`npm run dev`, `npm run start:server`). Two independent browser tabs used names PolishAlpha and PolishBravo.

- Both used the existing prominent Multiplayer button. Created room `2MTRM5`, joined by its real code; both rosters showed both names, and both received READY state changes.
- Browser automation intermittently timed out on background-tab CDP interactions; showing the browser restored some controls. The attempted host launch was not observed to transition. **This run does not establish browser countdown/combat/results/rematch or transient reconnect success**; these have real WebSocket integration coverage, not a new full two-browser playthrough.
- Stopped the owned server gracefully while in the lobby. The browser displayed “Server restarting. This room will end; create a new room after reconnecting.” and returned to private-room entry with the entered custom name preserved.
- Restarted the same local server: joining old code `2MTRM5` returned “Room not found.” Creating fresh room `FZS9X7` succeeded. Left the room and stopped the owned server again. This is an actual lobby restart check; restart during an active match is covered by automated server tests, not this browser run.
- With server stopped, Single Player launched, thrust reached **8 m / 82% fuel**, shooting destroyed one drone for **450 points**, incoming fire reduced hull to **92**, and warning rings were visibly rendered. Pause/resume worked. No console error/warning entries were returned by the checked browser log API; the server still logged the known Rapier initialization warning.

- Survival naturally reached **Wave time expired**: results showed **450 score, 1/21 drones, 30% accuracy, 3 hits/10 shots**, with Play Again and Return to Home controls. Focus/blur paused the simulation as designed; a held non-movement key kept browser focus during the final timer interval. The temporary browser tab was closed when the turn ended before clicking Return to Home. Its reset/retry semantics have automated store coverage, but the new button click-through remains a browser check to complete.

## Operational limits and incomplete checks

All rooms, results and resume tokens remain in process memory. Grace covers a live process only; a restart destroys the room. Fresh room creation works after the server returns. The client gives up rather than pretending to resume expired state. One persistent instance remains required; this task adds no persistence, routing, lag compensation or prediction.

Not newly verified here: WAN/adverse-network/production behavior, target-host capacity/soak, full three-wave browser victory, new difficulty balance across devices, audio quality, or an entire two-browser combat/reconnect/rematch loop. No load-capacity claim is made. The existing sustained-load reports retain their original scope and results. Test-tool timeouts are recorded above rather than reported as passing gameplay checks.

## Final completion record

- `npm test > reports/gameplay-reliability-tests.log 2>&1`: **69 tests, 69 passed, 0 failed/cancelled/skipped**, 5147.760221 ms; exit 0.
- `npm run typecheck > reports/gameplay-reliability-typecheck.log 2>&1`: client and server passed; exit 0.
- `npm run build > reports/gameplay-reliability-build.log 2>&1`: client and server passed; exit 0. Vite client build 8.01 s. Existing engine-size warnings only.
- `git diff --check`: passed, exit 0.
- Owned local game servers were stopped; no listener remained on test ports 5173/2567 at the final check. No production setting/service, deploy, commit or push was performed.

Raw review evidence: [tests](gameplay-reliability-tests.log), [TypeScript](gameplay-reliability-typecheck.log), [build](gameplay-reliability-build.log). These are local test outputs, not production logs. Browser observations above were captured from the actual UI; no browser screenshot artifact was retained for this update.

Changed for this task:

- `src/game/drone.ts` (new), `Targets.tsx`: bounded reactive evasion, tracking/lock warning, varied attack timing.
- `src/game/Effects.tsx`: in-place bounded effect compaction.
- `src/game/store.ts`, `src/components/HUD.tsx`: home reset/results action and critical-hull cues.
- `src/multiplayer/Scene.tsx`, `MultiplayerHUD.tsx`, `network.ts`: avatar hit flash, authoritative elimination notice, hull cue and bounded session recovery.
- `src/game/logic.test.ts`, `src/multiplayer/network.test.ts` (new), `server/rooms.test.ts`, `server/simulation.test.ts`: focused gameplay/recovery/lifecycle/combat regressions.
- `package.json`: register the client recovery test.
- `src/style.css`: critical-hull styling; previous home-button styles preserved.
- `README.md`, this report, and the three raw logs above.

Previously modified home-button files `src/components/MainMenuActions.tsx` and `MainMenuActions.test.tsx` remain in the working tree unchanged by this task. No server runtime, shared protocol, environment, database or authentication configuration was changed.

## Browser validation completion — 2026-10-20

**Both previously outstanding browser validations are now complete locally.** This follow-up supersedes the earlier incomplete status for the two-browser lifecycle and Return to Home click-through only. Previous observations and raw evidence remain intact. It does not claim WAN, live-host, automatic network-fault retry, or a full three-wave victory check.

Read this report and inspected the current diff before running. No new application, server, shared protocol, environment or security changes were needed; no confirmed regression was found, so no new regression code was added. The existing modified work was preserved.

### Actual two-client multiplayer run: PASS

Used two real, independent in-app browser tabs at `http://localhost:5173/`, against the existing compiled authoritative server at port 2567. Each tab had its own session storage. No state injection, direct input-command script, reduced timers, damage overrides, or server-rule changes were used.

1. **Create/join:** BrowserAlpha created private room **6M62G7**. BrowserBravo joined by entering that actual code. Both rosters showed exactly those two members.
2. **Ready/countdown:** Both readied through their UI buttons; Alpha's Start Match launched the shared countdown. Both entered the active match.
3. **Disconnect/reconnect:** Refreshed Bravo's tab during the active match (closing its original socket), opened Multiplayer, and clicked Reconnect Saved Session within the existing grace period. Bravo returned to the active room as BrowserBravo. Alpha's roster showed both original names connected, with exactly two members and unchanged host. This verifies refresh/manual resume, not automatic retry under packet loss. Private token values were neither collected nor logged; token rotation/stale-token rejection retain automated coverage.
4. **Combat/results:** Alpha clicked Take Control and fired at Bravo using the canvas. The server eliminated Bravo. Alpha saw Victory and Bravo saw Match Over; both displayed **Last pilot standing · BrowserAlpha**, Alpha **140 points / 1 elimination**, and Bravo **0 / 0 · ELIMINATED**.
5. **Rematch:** Alpha clicked Rematch. Both saw the new countdown and scores reset to **0 / 0**; Bravo's active HUD showed **100 hull**. Bravo took control and thrust (fuel observed at **88%**). Alpha took control and fired again. Both reached the same second results: Alpha **140 / 1**, Bravo **0 / 0 · ELIMINATED**, with the same winner.
6. **Return to lobby:** Alpha clicked Return to Lobby. Both saw Ready Your Squad, the same code and names, and **both Not Ready**. Start Match was disabled until readiness. Both left using existing UI flows; server metrics later showed **rooms: 0, connections: 0**.

One rematch canvas action reported a browser automation timeout after dispatch; subsequent fresh reads of **both** clients confirmed that the action had completed and both were in matching results. No pass was inferred merely from attempting the action. Using longer locator timeouts allowed the host launch that had been blocked by background-tab tooling in the previous run. Checked console error/warning captures were empty for both clients.

Evidence: [Alpha results](browser-completion-alpha-results.png), [Bravo results](browser-completion-bravo-results.png), [returned lobby](browser-completion-lobby.png), [console capture](browser-completion-console.json), [local server log](browser-completion-server.log). Screenshots show the first results and final lobby; second-match outcomes were verified through both browser accessibility trees, not a retained second-match screenshot. Server log contains operational events/metrics rather than per-shot records. It reports zero rejected commands, heartbeat timeouts and backpressure disconnects during this run. This interactive check is not a capacity benchmark; the log's tick maxima/over-budget ticks remain visible.

### Actual single-player results/navigation run: PASS

After leaving multiplayer, launched Single Player normally. Kept browser focus with a non-movement `x` key hold while the real simulation ran; no timer/state shortcuts were used. Observed hull falling through **60**, then **4** with the critical-hull hint. Natural defeat showed **Hull integrity lost**, **0 score**, **0/21 drones**, **1:08 survival**, and **0 hits / 0 shots**.

Clicked **Return to Home** on that actual results screen. The **Own the Open Sky** main menu appeared with both prominent mode buttons; hull and fuel reset to **100**, score/destroyed counts to **0**, and results were cleared. Clicked **Multiplayer**: the existing **Fly Together / Create Room / Join Room** entry appeared with the name field blank. Returned via Single-Player Survival and clicked **Single Player**: a fresh wave launched with **seven drones, 100 hull, 100 fuel, zero score**. Escape paused the new run correctly. Console error/warning capture was empty.

Evidence: [natural solo results](browser-completion-solo-results.png), [home after the actual click](browser-completion-return-home.png), [solo console capture](browser-completion-solo-console.json).

### Commands and final checks

```sh
# Local browser services (stopped after validation):
npm run dev
npm run start:server > reports/browser-completion-server.log 2>&1

# Complete suite includes all relevant solo, multiplayer and client recovery tests:
npm test > reports/browser-completion-tests.log 2>&1
npm run typecheck > reports/browser-completion-typecheck.log 2>&1
npm run build > reports/browser-completion-build.log 2>&1
git diff --check
```

The first sandboxed Vite startup could not bind (`EPERM`) and the initial browser navigation consequently returned connection refused. Re-running the same local Vite command with approved sandbox network permission succeeded. An attempt to read that failed-navigation error tab was rejected by the browser URL policy; a fresh normal localhost tab loaded successfully. These were local tooling/startup issues, not patched game defects. No security protection was disabled.

- **Tests: 69 tests, 69 passed, 0 failed/cancelled/skipped**, 4118.608305 ms; exit 0. [Raw tests](browser-completion-tests.log).
- **TypeScript: client and server passed**, exit 0. [Raw checks](browser-completion-typecheck.log).
- **Production builds: client and server passed**, exit 0; Vite **7.27 s**. Existing large-engine warnings remain. [Raw build](browser-completion-build.log).
- **`git diff --check`: passed**, exit 0.
- Owned local test servers stopped; no listeners remained on ports 5173 or 2567. Temporary successful game tabs closed. No deploy, commit, push, production setting change, external service modification, or server authority/security change occurred.

Files added/updated for this follow-up: this report, `browser-completion-server.log`, `browser-completion-tests.log`, `browser-completion-typecheck.log`, `browser-completion-build.log`, two console JSON captures, and five PNG evidence captures. No application source changes.

Remaining unexecuted scope: production/WAN checks, automatic retry under a real transient network fault, complete three-wave victory playthrough, and target-host load/soak/device coverage. The server-restart limitation remains unchanged: in-memory rooms/results/tokens do not survive a process restart. **Neither of the two requested browser scenarios remains incomplete.**
