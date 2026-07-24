#!/usr/bin/env node
// Dev smoke test: fetch and print Daily Notes for a date (default today).
// Reads NOTAION_EMAIL / NOTAION_PASSWORD / NOTAION_API_URL from the process
// environment, or from a local .env.local file next to this script.
// Usage:  node smoke.js [yyyy-MM-dd]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadConfig } from "./src/config.js";
import { createAuth } from "./src/auth.js";
import { createApi } from "./src/api.js";
import { listDailyNotes } from "./src/tools/dailyNote.js";

// Minimal .env.local loader (KEY=VALUE per line; ignores blanks and #comments).
function loadEnvFile() {
  const here = dirname(fileURLToPath(import.meta.url));
  try {
    const raw = readFileSync(join(here, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // no .env.local — rely on the process environment
  }
}

loadEnvFile();

const date = process.argv[2];
const config = loadConfig();
const auth = createAuth(config);
const api = createApi({ apiUrl: config.apiUrl, auth });

const notes = await listDailyNotes(api, { date });
const label = date || "today";
console.log(`\n${notes.length} Daily Note(s) for ${label} @ ${config.apiUrl}\n`);
for (const n of notes) {
  console.log(`• [${n.category}] ${n.title}`);
  if (n.content) {
    for (const line of String(n.content).split("\n")) console.log(`    ${line}`);
  }
  console.log(`    id=${n.id}  time=${n.timestamp}\n`);
}
