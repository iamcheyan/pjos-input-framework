# PJOS Universal Input Framework — Coordination

Coordinates the two deliverables of the Input Framework goal and holds the
integration contract, cross-repo integration test, and orchestration. It contains
**no** source that must be merged into the other repositories.

## Deliverables

| Repo | Phase | Contents |
|------|-------|----------|
| `PJOS-LINUX/runtime/keyboardd` | 1 | `keyboardd` service, Input API, Focus Manager, Provider Manager, layout validation, stub provider, tests |
| `pjos-keyboard` | 2 | `PocketKeyboardProvider` UI (Vite/React/TS): Text/Number/URL layouts, Touch/DPad nav, capability selection, Light/Dark/OLED themes, Desktop Debug showcase, `keyboard.pkg` |
| this repo | — | contract docs, integration test, `make test` orchestration |

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — layers, boundaries, capability model, state.
- [`docs/INPUT-API.md`](docs/INPUT-API.md) — Input API endpoints + `pjos.keyboard` binding.
- [`docs/INTEGRATION-CONTRACT.md`](docs/INTEGRATION-CONTRACT.md) — field-level mapping for Launcher / Settings / Files.
- [`docs/PACKAGING.md`](docs/PACKAGING.md) — `keyboard.pkg` and the install flow.
- [`docs/KNOWN-LIMITS.md`](docs/KNOWN-LIMITS.md) — Phase 1 boundaries and everything unverified here.

## Verify everything

```sh
make test
```

Runs, in order:

1. `go vet ./...` + `go test ./...` in `PJOS-LINUX/runtime/keyboardd`
2. `typecheck` + `vitest` (43 tests) + app build + library build in `pjos-keyboard`
3. `tests/integration-input-api.mjs` — starts the real `keyboardd` binary and
   exercises `app → Input API → keyboardd` (13 checks: layouts, capability→mode,
   key composition, 501/404 refusals, focus auto-show/hide, CORS).

Expected paths: the Makefile uses `$HOME/development/{PJOS-LINUX,pjos-keyboard}`.
Override `KEYBOARDD=` / `KEYBOARD=` if the checkouts live elsewhere.

## Constraints enforced by this framework

- Apps and frontends only call the Input API; nothing renders a keyboard directly.
- Phase 1 implements no input methods (no pinyin/wubi/Japanese/voice/AI/emoji/swipe).
- The three Pocket app repositories are integrated only through the contract
  document; their trees are never edited or copied.
- Verification on this headless host uses mock providers plus headless Chromium.
  Real touchscreen/e-ink/DPad hardware and installation onto a device are **not**
  claimed — see [`docs/KNOWN-LIMITS.md`](docs/KNOWN-LIMITS.md).
