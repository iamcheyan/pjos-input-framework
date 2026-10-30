# PJOS Universal Input Framework — Architecture

## Goal

Provide a single on-screen keyboard (OSK) path for all PJOS frontends. Applications
**never** open or drive a keyboard directly; they call the **Input API**, which is
implemented by `keyboardd`. `keyboardd` owns keyboard visibility, the composed
value, focus, layout validation, and provider loading/switching. The default
keyboard UI is the `PocketKeyboardProvider` implemented in the separate
`pjos-keyboard` repository.

```
 App (PocketJS / frontend)
        │  pjos.keyboard.show({layout}) / hide() / submit()
        ▼
 ┌─────────────────────────────────────────┐
 │  keyboardd  (PJOS-LINUX/runtime/keyboardd)│   ← Phase 1 (this repo)
 │   - Input API (HTTP, loopback)            │
 │   - Focus Manager (auto show/hide)        │
 │   - Layout validation                     │
 │   - Provider Manager (load/switch)        │
 │   - State store (optional sqlite)         │
 └─────────────────────────────────────────┘
        │  Show/Hide/Render/Submit + key events
        ▼
 ┌─────────────────────────────────────────┐
 │  KeyboardProvider                         │
 │   - stub (in-process, tests/desktop)      │   ← Phase 1 default
 │   - PocketKeyboardProvider (TS/React)     │   ← Phase 2 (pjos-keyboard)
 │   - reserved: Fcitx / Rime / Mozc / Voice │
 └─────────────────────────────────────────┘
```

## Boundaries

- **Phase 1** (`PJOS-LINUX/runtime/keyboardd`) is pure Go, pure-Go dependencies
  (`modernc.org/sqlite` only if persistence is enabled). It implements the Input
  API, Focus Manager, Provider Manager, layout validation, and a `stub` provider
  for headless/desktop development and tests.
- **Phase 2** (`pjos-keyboard`) is TypeScript/React/Vite (not Electron). It renders
  the on-screen keyboard and implements the `PocketKeyboardProvider` behaviour by
  consuming the Input API over loopback HTTP and pushing key events back.
- Frontends/applications MUST only use the Input API. No application may render or
  drive a keyboard on its own.
- Phase 1 does **not** implement pinyin/wubi/Japanese/voice/AI/predictive/emoji/
  swipe input methods. Those are external integrations (Fcitx5/Rime/Mozc) that
  register as future providers.

## Capability Model (shared, authoritative)

Capabilities describe what input hardware is available. They are **never** tied to
a device name in code — selection is capability-driven.

| Capability        | Meaning                                        |
|-------------------|------------------------------------------------|
| `Touch`           | Touchscreen / pointer (tap to input)            |
| `DPad`            | Directional pad + action buttons (handhelds)    |
| `Gamepad`         | Gamepad-style buttons (A/B/Start/Select)        |
| `HardwareKeyboard`| Physical QWERTY keyboard present                |

Device → capability reference (used only by device profiles / config, not by
`if device==` branches in UI code):

| Device            | Capabilities                              |
|-------------------|-------------------------------------------|
| RG34XX / RG35XX / RG40XX | `DPad`, `Gamepad`                  |
| Leaf3C            | `Touch`, `DPad` (e-ink + touch)           |
| Android Tablet    | `Touch`                                   |
| Desktop (Debug)   | `Touch`, `HardwareKeyboard`               |

### Input mode selection (capability-driven)

The keyboard UI selects its navigation mode from capabilities, **never** from a
device string:

1. If `Touch` is available → **Touch Mode** (tap to input/delete/confirm).
2. Else if `DPad` is available → **DPad Mode** (move focus, A confirm, B delete,
   Start finish, Select switch layout).
3. `HardwareKeyboard` lets physical keystrokes feed keys through the same key
   event path.

`keyboardd` computes a recommended input mode from the negotiated capabilities and
exposes it in `State.inputMode` so the frontend renders the right mode without
re-deriving device facts.

## Provider contract

```go
type KeyboardProvider interface {
    Name() string
    Capabilities() []Capability
    Show(req ShowRequest, st State) RenderSpec
    Hide(st State)
    Render(st State) RenderSpec   // side-effect free drawing spec
    Submit(value string, st State)
}
```

`Render` returns a `RenderSpec` instead of touching a display, so providers that
have no surface (the stub, a headless host) still satisfy the contract. The
Manager also emits `OnShow`/`OnHide`/`OnKey`/`OnSubmit` notifications around those
calls. `GET /api/keyboard/render` exposes the active provider's spec.

## State

`keyboardd` is the single source of truth for:

- `visible` — keyboard shown or not
- `layout` — active layout (`text`/`number`/`url` in Phase 1)
- `value` — the composed text
- `placeholder` — hint text
- `secure` — mask output (number layout used for passwords/PINs/codes)
- `capabilities` — negotiated device capabilities
- `inputMode` — recommended `touch`/`dpad`
- `focusedInput` — id of the focused input field (Focus Manager)
- `provider` — active provider name
- `theme` — `light`/`dark`/`oled`

## Persistence

Optional. When `KEYBOARDD_DB` is set, `keyboardd` persists device capability
profiles and last state with `modernc.org/sqlite` (pure Go, no cgo). Default is
in-memory (suitable for dev/tests). Phase 1 does not require persistence; it is a
hook for future device profiles.

## Repositories

- `PJOS-LINUX/runtime/keyboardd` — backend service + tests (Phase 1).
- `pjos-keyboard` — frontend provider + showcase + tests (Phase 2).
- `pjos-input-framework` — this coordination repo: contract docs, cross-repo
  integration test, packaging helper. Contains **no** source that must be merged
  into the other two repos.
