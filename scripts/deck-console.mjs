#!/usr/bin/env node
const host = process.argv[2]?.includes(":") ? process.argv[2] : process.argv[2] && `${process.argv[2]}:8081`;
const seconds = Number(process.argv[3] ?? 120);
if (!host) {
  console.error("usage: node scripts/deck-console.mjs <deck-ip[:port]> [seconds]");
  process.exit(1);
}

let targets;
try {
  const res = await fetch(`http://${host}/json`, { signal: AbortSignal.timeout(8000) });
  targets = await res.json();
} catch (err) {
  console.error(`Could not reach http://${host}/json (${err.message}).`);
  console.error("Check that the Deck is awake and Remote CEF Debugging is on.");
  process.exit(1);
}

console.log("Pages on the Deck:");
for (const t of targets) console.log(`  - ${t.title}`);

const target = targets.find((t) => /QuickAccess/i.test(t.title)) ?? targets.find((t) => /SharedJSContext/i.test(t.title));
if (!target?.webSocketDebuggerUrl) {
  console.error("Quick Access page not found. Open the Quick Access menu once and try again.");
  process.exit(1);
}
console.log(`\nWatching "${target.title}" for ${seconds}s. Now open HaqGen and pick a game.\n`);

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const send = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }));
const text = (args = []) =>
  args.map((a) => (a.value !== undefined ? (typeof a.value === "string" ? a.value : JSON.stringify(a.value)) : a.description ?? a.type)).join(" ");

ws.addEventListener("open", () => {
  send("Runtime.enable");
  send("Log.enable");
});
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === "Runtime.consoleAPICalled") {
    console.log(`[console.${msg.params.type}] ${text(msg.params.args)}`);
  } else if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    console.log(`[ERROR] ${d.exception?.description ?? d.text}`);
  } else if (msg.method === "Log.entryAdded") {
    const e = msg.params.entry;
    if (e.level === "error" || e.level === "warning") console.log(`[log.${e.level}] ${e.text}`);
  }
});
ws.addEventListener("error", (e) => console.error("Connection error:", e.message ?? e));

setTimeout(() => {
  console.log("\nDone.");
  ws.close();
  process.exit(0);
}, seconds * 1000);
