# Input API

`keyboardd` exposes the Input API over HTTP on loopback (default `:8787`). All
bodies and responses are JSON. Apps and the frontend provider talk to the same
API; the provider additionally pushes key events.

## Endpoints

| Method | Path                     | Purpose                                  |
|--------|--------------------------|------------------------------------------|
| GET    | `/api/health`            | Liveness/version                          |
| POST   | `/api/keyboard/show`     | Show keyboard with a layout               |
| POST   | `/api/keyboard/hide`     | Hide keyboard                            |
| POST   | `/api/keyboard/submit`   | Return composed value, then hide          |
| POST   | `/api/keyboard/focus`    | Focus an input → auto-show                |
| POST   | `/api/keyboard/blur`     | Blur an input → auto-hide if no focus     |
| POST   | `/api/keyboard/key`      | Inject a key/char (provider echo / HW)    |
| GET    | `/api/keyboard/state`    | Full current state                        |
| GET    | `/api/keyboard/render`   | Active provider's drawing spec            |
| GET    | `/api/keyboard/providers`| List providers + capabilities             |
| POST   | `/api/keyboard/provider` | Switch active provider                    |

### `POST /api/keyboard/show`

Request:
```json
{
  "layout": "text",            // text | number | url  (Phase 1)
  "value": "",                 // optional preset text
  "placeholder": "Search",     // optional hint
  "secure": false,             // mask output (number layout)
  "capabilities": ["Touch"],   // optional device capabilities
  "theme": "dark",             // light | dark | oled
  "options": {}                // provider-specific extras
}
```
Response `200`:
```json
{
  "state": {
    "visible": true,
    "layout": "text",
    "value": "",
    "placeholder": "Search",
    "secure": false,
    "capabilities": ["Touch"],
    "inputMode": "touch",
    "focusedInput": "",
    "provider": "stub",
    "theme": "dark"
  }
}
```
- Unknown layout name → `400` with `error.code: invalid_layout`.
- Reserved-but-unimplemented layout (`search`/`password`/`emoji`/`voice`/`ai`) →
  `501` with `error.code: layout_not_implemented`.
- `number` layout is the canonical layout for passwords/PINs/ports/codes; use
  `secure: true` to mask rather than the reserved `password` name.

### `POST /api/keyboard/hide`
Hides the keyboard. `200` with current `state` (`visible:false`).

### `POST /api/keyboard/submit`
Optional body `{ "value": "override" }`. Returns the composed (or overridden)
value, hides the keyboard, and clears focus.
Response `200`:
```json
{ "value": "hello", "state": { "visible": false, "value": "" } }
```

### `POST /api/keyboard/focus`
Request `{ "inputId": "search-box", "layout": "text", "value": "", "capabilities": ["Touch"] }`.
Sets the focused input and **auto-shows** the keyboard (Focus Manager). `200`
with `state`.

### `POST /api/keyboard/blur`
Request `{ "inputId": "search-box" }` (optional). Clears focus for that input; if
no input remains focused, **auto-hides**. `200` with `state`.

### `POST /api/keyboard/key`
Inject a key into the active composition. Used by providers (touch/dpad taps) and
by hardware keyboards.
Request:
```json
{ "key": "a" }            // printable char, OR a control token:
```
Control tokens (case-insensitive):
- `backspace` — delete last char (or selection)
- `space` — insert space
- `enter` — submit (returns value, hides)
- `clear` — empty the value
- `layout:switch` — cycle to next Phase-1 layout
- `hide` — hide keyboard

`200` with updated `state`. If keyboard is not visible → `409`
(`error.code: keyboard_hidden`).

### `GET /api/keyboard/state`
Returns the full `state` object.

### `GET /api/keyboard/render`
Returns the active provider's drawing specification (side-effect free), so a host
can paint exactly what the provider would without re-deriving it from state.

```json
{
  "provider": "stub",
  "render": {
    "layout": "text",
    "inputMode": "touch",
    "value": "",
    "placeholder": "Search",
    "secure": false,
    "capabilities": ["Touch"],
    "theme": "dark",
    "visible": true,
    "focusedInput": ""
  }
}
```

### `GET /api/keyboard/providers`
```json
{ "active": "stub",
  "providers": [ { "name": "stub", "capabilities": ["Touch","DPad","Gamepad","HardwareKeyboard"] } ] }
```

### `POST /api/keyboard/provider`
Request `{ "name": "stub" }`. Switches the active provider (Provider Manager).
`200` with `state`; unknown provider → `404`.

## PocketJS Runtime binding (`pjos.keyboard`)

The frontend provides a `pjos.keyboard` object that wraps the HTTP API so apps
write declarative code instead of raw fetch:

```ts
pjos.keyboard.show({ layout: "text", placeholder: "Search" });
pjos.keyboard.hide();
const value = await pjos.keyboard.submit();   // resolves with composed string
```

`pjos.keyboard.show` maps to `POST /api/keyboard/show`; `hide` → `/hide`;
`submit` → `/submit` and resolves the returned value. Focus integration is
automatic: an `<input>`/`TextField` gaining focus calls `focus`, losing focus
calls `blur`. The provider (pjos-keyboard) renders from `GET /state` and pushes
`tap`/button events via `POST /key`.

## Error shape
```json
{ "error": { "code": "invalid_layout", "message": "..." } }
```
HTTP status matches the code (400/404/409/501).
