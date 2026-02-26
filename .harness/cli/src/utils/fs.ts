import { existsSync, readFileSync, statSync, readdirSync, accessSync, constants } from "node:fs";
import { resolve, join } from "node:path";

/**
 * Safe JSON file read — returns null on missing/invalid.
 */
export function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

/**
 * Check if a file exists and is executable.
 */
export function isExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * List files in a directory matching a pattern.
 */
export function listFiles(dirPath: string, pattern?: RegExp): string[] {
  if (!existsSync(dirPath)) return [];
  try {
    const entries = readdirSync(dirPath);
    const files = entries
      .map((e) => join(dirPath, e))
      .filter((f) => statSync(f).isFile());
    if (pattern) return files.filter((f) => pattern.test(f));
    return files;
  } catch {
    return [];
  }
}

/**
 * Resolve project root (harness root) from a starting directory.
 * Walks up to find CLAUDE.md + harness.config.json.
 * Returns the harness root where config files live.
 */
export function findProjectRoot(startDir?: string): string {
  let dir = startDir ?? process.cwd();
  for (let i = 0; i < 20; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md")) && existsSync(resolve(dir, "harness.config.json"))) {
      return dir;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/**
 * Find the git repo root from the harness root.
 * In nested layout (.harness/), the repo root is one level up.
 * In flat layout, repo root = harness root.
 */
export function findRepoRoot(harnessRoot: string): string {
  const parent = resolve(harnessRoot, "..");
  if (existsSync(resolve(parent, ".harness")) && existsSync(resolve(parent, "CLAUDE.md"))) {
    return parent;
  }
  return harnessRoot;
}
