#!/usr/bin/env node
/**
 * Cross-repo integration test: proves the "app calls the Input API" chain.
 *
 *   app-side pjos.keyboard  →  keyboardd (real binary)  →  provider hooks
 *
 * keyboardd's own tests cover the in-process stub provider; here we verify the
 * HTTP contract that an application and the pjos-keyboard provider rely on,
 * against the real service binary. No browser and no device are needed.
 *
 * Prereqs (both are checked, with an actionable message when missing):
 *   cd ../PJOS-LINUX/runtime/keyboardd && go build -o /tmp/keyboardd ./cmd/keyboardd
 *   cd ../pjos-keyboard && npm run build:lib
 *
 * Usage: node tests/integration-input-api.mjs [path-to-keyboardd]
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const libPath = join(here, "..", "..", "pjos-keyboard", "dist-lib", "index.mjs");
const binary = process.argv[2] ?? "/tmp/keyboardd";

if (!existsSync(libPath)) {
  console.error(`missing ${libPath} — run: (cd ../pjos-keyboard && npm run build:lib)`);
  process.exit(2);
}
if (!existsSync(binary)) {
  console.error(`missing ${binary} — run: (cd ../PJOS-LINUX/runtime/keyboardd && go build -o /tmp/keyboardd ./cmd/keyboardd)`);
  process.exit(2);
}

const { InputApiClient, createPjosKeyboard } = await import(libPath);

const port = 18899;
const baseUrl = `http://127.0.0.1:${port}`;

const failures = [];
const check = (name, condition, detail) => {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}${detail ? `: ${detail}` : ""}`);
    console.log(`  FAIL ${name}${detail ? `: ${detail}` : ""}`);
  }
};

async function waitForHealth(timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

const server = spawn(binary, [], {
  env: { ...process.env, KEYBOARDD_ADDR: `127.0.0.1:${port}`, KEYBOARDD_DB: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
let stderr = "";
server.stderr.on("data", (chunk) => {
  stderr += String(chunk);
});

try {
  const healthy = await waitForHealth();
  check("keyboardd starts and answers /api/health", healthy, stderr.trim());
  if (!healthy) throw new Error("keyboardd did not start");

  const client = new InputApiClient(baseUrl);
  const pjos = createPjosKeyboard(client);

  // 1. App shows the keyboard for a layout.
  const shown = await pjos.show({ layout: "url", capabilities: ["Touch"], placeholder: "Address" });
  check("pjos.keyboard.show opens the url layout", shown.visible && shown.layout === "url");
  check("capability Touch selects touch mode", shown.inputMode === "touch");

  // 2. Provider pushes keys (this is what the UI provider does per tap).
  for (const key of ["h", "t", "t", "p", ":", "/", "/"]) {
    await client.key(key);
  }
  const typed = await client.state();
  check("provider keys compose on the service", typed.value === "http://", typed.value);

  // 3. Reserved layout is refused, so the provider never invents one.
  let reservedRejected = false;
  try {
    await client.show({ layout: "emoji" });
  } catch (error) {
    reservedRejected = error.code === "layout_not_implemented" && error.status === 501;
  }
  check("reserved layout is rejected with 501", reservedRejected);

  // 4. DPad capability switches navigation mode without device names.
  const dpadShown = await pjos.show({ layout: "text", capabilities: ["DPad", "Gamepad"] });
  check("DPad capability selects dpad mode", dpadShown.inputMode === "dpad");

  // 5. Submit resolves the composed value and hides the keyboard.
  const value = await pjos.submit();
  const afterSubmit = await client.state();
  check("pjos.keyboard.submit resolves the value", typeof value === "string");
  check("submit hides the keyboard", afterSubmit.visible === false);

  // 6. Focus Manager: focus auto-shows, blur auto-hides.
  const focused = await pjos.focus("settings-ssid", { layout: "text" });
  check("focus auto-shows the keyboard", focused.visible === true && focused.focusedInput === "settings-ssid");
  const blurred = await pjos.blur("settings-ssid");
  check("blur auto-hides the keyboard", blurred.visible === false);

  // 7. Provider Manager reports the stub provider for a headless host.
  const providers = await client.providers();
  check(
    "active provider is discoverable",
    providers.active === "stub" && providers.providers.some((p) => p.name === "stub"),
  );

  // 8. Unknown provider is not silently accepted.
  let unknownRejected = false;
  try {
    await client.setProvider("does-not-exist");
  } catch (error) {
    unknownRejected = error.status === 404;
  }
  check("unknown provider rejected with 404", unknownRejected);

  // 9. CORS: the provider runs on another origin.
  const preflight = await fetch(`${baseUrl}/api/keyboard/key`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://127.0.0.1:5199",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  check(
    "CORS preflight allows the provider origin",
    preflight.status === 204 && preflight.headers.get("access-control-allow-origin") === "*",
  );
} finally {
  server.kill("SIGTERM");
}

if (failures.length > 0) {
  console.error(`\n${failures.length} integration check(s) failed`);
  process.exit(1);
}
console.log("\nintegration: app -> Input API -> keyboardd chain verified");
