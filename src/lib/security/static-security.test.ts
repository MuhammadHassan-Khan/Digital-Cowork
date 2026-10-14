import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Static security review (IMPLEMENTATION_PLAN Step 6: "Review RLS,
 * environment variable exposure and log privacy"; PRD §7: never expose
 * secrets in browser code, keep logs private).
 *
 * These tests scan the shipped source (test files excluded — they document
 * the rules and never enter a bundle) so regressions fail CI loudly:
 *  1. only NEXT_PUBLIC_* variables may be read outside `server-only` files;
 *  2. no console output anywhere (no emails/tokens/ids in logs, ever);
 *  3. the LiveKit secrets module keeps its `server-only` guard;
 *  4. `.env*` stays git-ignored while `.env.example` remains trackable.
 */

const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const sourceFiles = walk(SRC);
const SERVER_ONLY_IMPORT = /^import ["']server-only["'];/m;
const ENV_ACCESS = /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g;
const CONSOLE_CALL = /console\.(log|error|warn|info|debug|trace)\s*\(/;

describe("static security review", () => {
  it("scans a plausible number of source files (guard against path rot)", () => {
    expect(sourceFiles.length).toBeGreaterThan(20);
  });

  it("reads only NEXT_PUBLIC_* env vars outside server-only modules", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      const text = readFileSync(file, "utf8");
      const isServerOnly = SERVER_ONLY_IMPORT.test(text);
      for (const match of text.matchAll(ENV_ACCESS)) {
        const name = match[1];
        if (!name.startsWith("NEXT_PUBLIC_") && !isServerOnly) {
          offenders.push(`${file.replace(/\\/g, "/")}: process.env.${name}`);
        }
      }
      if (!isServerOnly && text.includes("process.env[")) {
        offenders.push(
          `${file.replace(/\\/g, "/")}: dynamic process.env[...] access`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never writes to the console (log privacy — PRD §7)", () => {
    const offenders = sourceFiles
      .filter((file) => CONSOLE_CALL.test(readFileSync(file, "utf8")))
      .map((file) => file.replace(/\\/g, "/"));
    expect(offenders).toEqual([]);
  });

  it("keeps the LiveKit secrets behind the server-only guard", () => {
    const text = readFileSync(
      join(SRC, "lib", "livekit", "server.ts"),
      "utf8",
    );
    expect(SERVER_ONLY_IMPORT.test(text)).toBe(true);
  });

  it("git-ignores real env files but keeps the example trackable", () => {
    const gitignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    expect(gitignore).toMatch(/^\.env\*$/m);
    expect(gitignore).toMatch(/^!\.env\.example$/m);
  });
});
