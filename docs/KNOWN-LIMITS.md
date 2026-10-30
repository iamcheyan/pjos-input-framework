# Known limits and unverified claims

Everything below is either a deliberate Phase 1 boundary or something this host
cannot verify. Nothing here is claimed as done.

## Deliberate Phase 1 boundaries

- **No input methods.** No pinyin, wubi, Japanese, voice, AI completion,
  prediction, emoji, or swipe. They belong to future external providers
  (`FcitxProvider`/`RimeProvider`/`MozcProvider`/`VoiceProvider`), which Phase 1
  only reserves as names.
- **Three layouts only.** `text`, `number`, `url`. `search`/`password`/`emoji`/
  `voice`/`ai` are reserved and answer 501.
- **Single foreground keyboard.** No multi-window or background keyboard state.
- **Persistence is optional.** `keyboardd` defaults to in-memory; the
  `modernc.org/sqlite` store needs `-tags sqlite` and is unused by Phase 1 logic.
- **Gamepad transport is a seam.** `pjos-keyboard` consumes `pjos:pad` window
  events; no evdev bridge is included, so real handheld buttons are unconnected.

## Environment limits (HX90)

This host has no display server, no touchscreen, no e-ink panel, and no handheld
attached. Consequently:

- **Not verified:** real touch input latency/accuracy, e-ink ghosting and refresh
  behavior, real D-pad/evdev button codes, OLED true-black on an OLED panel,
  install onto a running image, and booting a device with `keyboardd`.
- **Verified instead:** logic and wiring via unit tests, a real `keyboardd` binary
  over HTTP, and headless Chromium driving the rendered provider — see
  `pjos-keyboard/docs/MOCK-AND-HEADLESS.md`.
- No system input stack, input-method framework, or NixOS input configuration was
  modified. Phase 1 needed no new dependency, so **no Nix change was made** and no
  global Nix lock was taken.

## Integration status

The three app repositories (Pocket Launcher, Pocket Settings, Pocket Files) were
**not modified**. Their trees belong to concurrent goals and the objective forbids
editing or copying them. They integrate by adopting
[`INTEGRATION-CONTRACT.md`](INTEGRATION-CONTRACT.md) in their own sessions:

- Field-level mapping for every input in each app is specified.
- Until an app adopts it, it keeps its current behavior; `keyboardd` is additive.
- No app test depends on this framework, so nothing in their CI changes.

## Known rough edges

| Area | Limitation | Mitigation |
|------|-----------|------------|
| DPad focus memory | Focus is a `{row,col}` point, not key ids; a layout switch can land on a different key | `clampPoint` keeps it inside the grid; acceptable for Phase 1 |
| URL layout | No `-`/`_` or full symbol row; only the required `.com / : @ .` extras | add keys in `LAYOUTS.url` if needed |
| Shift | Only letters uppercase; no caps-lock state | one-shot shift, cleared after a key |
| CORS | `Access-Control-Allow-Origin: *` on a loopback service | service binds 127.0.0.1; restrict origins when a non-loopback host appears |
| Stub provider | Draws nothing | intentional: headless/desktop hosts and fallback |
