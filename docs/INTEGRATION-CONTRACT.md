# Integration contract — Launcher, Settings, Files

This is the contract the three app repositories implement. It is **additive**:
nothing here requires rewriting an app, and no app source is copied into
PJOS-LINUX or pjos-keyboard. Each app's own goal/session applies it.

## The only rule

An app must not render or drive a keyboard itself. It:

1. tells `keyboardd` that an input is focused (or explicitly shows a layout),
2. forwards the provider's keys to `keyboardd`,
3. asks `keyboardd` for the composed value on submit.

`keyboardd` owns visibility, the composed value, focus, layout validation, and the
provider. The provider (`pjos-keyboard`) draws the keyboard and pushes keys.

## App-side wiring (framework-agnostic)

```ts
import { createPjosKeyboard } from "pjos-keyboard";

const pjos = createPjosKeyboard();           // default: http://127.0.0.1:8787

// Focus-driven (preferred): the app never calls show/hide explicitly.
onFocus:   (id, layout) => pjos.focus(id, { layout })
onBlur:    (id)         => pjos.blur(id)
onSubmit:  ()           => pjos.submit()     // resolves the composed string
```

Explicit control (dialogs that open a keyboard without a DOM focus event):

```ts
await pjos.show({ layout: "text", placeholder: "Search", capabilities });
const value = await pjos.submit();
```

## Mounting the provider (shell/launcher responsibility)

The shell mounts `KeyboardProvider` once and forwards keys. Apps never mount it:

```tsx
import { KeyboardProvider, InputApiClient } from "pjos-keyboard";

const client = new InputApiClient();
<KeyboardProvider
  layout={state.layout}
  theme={state.theme}
  capabilities={state.capabilities}
  placeholder={state.placeholder}
  secure={state.secure}
  onKey={(key) => void client.key(key)}
  onSubmit={(value) => void client.submit(value)}
/>
```

If apps already have their own text field, they pass its value through
`value` + `onKey` so the OSK and the field never disagree.

## Per-app input inventory

Only the input **kind** matters; each maps to one layout. Password/PIN/port/code
use the `number` layout plus `secure: true` (there is no separate password layout
in Phase 1).

### Pocket Launcher

| Input | Layout | Notes |
|-------|--------|-------|
| Search box | `text` | focus-driven show/hide |
| Address/URL bar | `url` | `.com` `/` `:` `@` `.` keys |
| Command palette input | `text` | reuse the search box path |

Contract: `POST /api/keyboard/focus {inputId:"launcher.search", layout:"text"}`;
submit returns the query string. The launcher keeps its own search/session state —
`keyboardd` never stores app queries.

### Pocket Settings

| Input | Layout | Secure |
|-------|--------|--------|
| Wi-Fi password | `number` | yes |
| SSH port | `number` | no |
| WebDAV URL/host | `url` | no |
| WebDAV user/password | `text` / `number` | password yes |
| Device name | `text` | no |
| Settings search | `text` | no |

Contract: focus with the field's id (`settings.wifi.password`, …); the value only
ever travels from `submit()` into the existing settings API. `keyboardd` does not
persist secrets and does not interpret fields.

### Pocket Files

| Input | Layout | Notes |
|-------|--------|-------|
| File search | `text` | |
| Create directory name | `text` | |
| Rename | `text` | prefill with `value` |
| Tag/label edit | `text` | |

Contract: `focus(id, {layout:"text", value: currentName})` for rename so the
provider starts with the existing name; submit returns the new name.

## Sequencing and safety

- Prefer focus-driven wiring: it needs one hook per field and no lifecycle code.
- Wire the three repos **after** `keyboardd` is available; until then `stub` is the
  provider and nothing renders (apps keep their current behavior).
- If an app cannot adopt the contract yet, leave it alone and ship this document.
  Do not fork or edit another goal's working tree.
- Each repo keeps its own commits/PRs and its own tests. This framework adds no
  test dependency on them, and no app test changes because of it.

## Failure behavior an app must tolerate

| Condition | What the app should do |
|-----------|------------------------|
| `keyboardd` unreachable | keep the current input path; do not block the UI |
| `501 layout_not_implemented` | fall back to `text` (`number` for secrets) |
| `409 keyboard_hidden` on `key` | ignore; the provider raced a hide |
| provider = `stub` | expect no visible keyboard (headless/desktop) |
