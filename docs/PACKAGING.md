# Packaging and installation (framework view)

The artifact `keyboard.pkg` is produced by the `pjos-keyboard` repository:

```sh
cd ../pjos-keyboard
npm install
npm run build && npm run pack:keyboard
# -> keyboard.pkg + keyboard.pkg.sha256
```

Format and the full install flow are documented there
(`pjos-keyboard/docs/PACKAGING.md`). Summary:

| Item | Value |
|------|-------|
| Artifact | `keyboard.pkg` — gzipped tar |
| Contents | `manifest.json`, `dist/`, `README.md`, `SHA256SUMS` |
| Package id | `org.pjos.keyboard`, `abi: 1` |
| Future name | `keyboard.pj` — reserved, not emitted |

## Install flow (documented only)

No handheld is attached to this host, so the flow below is **not executed** here.

1. `sha256sum -c keyboard.pkg.sha256`
2. `tar -xzf keyboard.pkg -C /usr/share/pjos/keyboard/1`
3. `cd /usr/share/pjos/keyboard/1 && sha256sum -c SHA256SUMS`
4. Ensure `keyboardd` runs (`KEYBOARDD_ADDR=127.0.0.1:8787 /usr/bin/keyboardd`),
   then check `GET /api/health`.
5. Point the shell at `manifest.json.entry`; keep the provider origin's CORS
   access to the API (already answered by `keyboardd`).
6. Rollback: `rm -rf /usr/share/pjos/keyboard/1`. Apps fall back to the `stub`
   provider, so a bad provider cannot wedge text input.

## Verified here

- The package builds and its checksum verifies on this host.
- Archive layout is exactly `manifest.json`, `dist/`, `README.md`, `SHA256SUMS`.
- `abi` is enforced by convention: a shell must reject an `abi` it does not know.

## Not verified here

- Installing on a real image/handheld, the shell mounting the extracted entry,
  and reading back a real device's capability set.
