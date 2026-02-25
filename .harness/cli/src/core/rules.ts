import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export interface ArchRules {
  layers: { order: string[]; direction: string };
  protected_paths: { paths: string[]; enforcement: string; message: string };
  exceptions: {
    allowed_core_edits: string[];
    allowed_cross_layer: string[];
    allowed_large_files: string[];
    allowed_naming_exceptions: string[];
  };
}

const INLINE_PROTECTED = ["harness/", "hooks/", "architecture/", ".claude/", "CLAUDE.md"];

function loadProtectedPathsTxt(projectRoot: string): string[] {
  const txtPath = resolve(projectRoot, "architecture/protected-paths.txt");
  if (!existsSync(txtPath)) return INLINE_PROTECTED;
  try {
    return readFileSync(txtPath, "utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  } catch {
    return INLINE_PROTECTED;
  }
}

export function loadRules(projectRoot: string): ArchRules | null {
  const rulesPath = resolve(projectRoot, "architecture/rules.json");
  if (!existsSync(rulesPath)) return null;

  const raw = readFileSync(rulesPath, "utf-8");
  try {
    return JSON.parse(raw) as ArchRules;
  } catch (e) {
    process.stderr.write(`[rules] Warning: ${rulesPath} is not valid JSON — using defaults.\n`);
    return null;
  }
}

export function getProtectedPaths(rules: ArchRules | null, projectRoot?: string): string[] {
  if (rules?.protected_paths?.paths && rules.protected_paths.paths.length > 0) {
    return rules.protected_paths.paths;
  }
  if (projectRoot) {
    return loadProtectedPathsTxt(projectRoot);
  }
  return INLINE_PROTECTED;
}

export function getAllowedEdits(rules: ArchRules | null): string[] {
  return rules?.exceptions?.allowed_core_edits ?? [];
}

export function getLayerOrder(rules: ArchRules | null): string[] {
  return rules?.layers?.order ?? ["types", "config", "repo", "service", "runtime", "ui"];
}
