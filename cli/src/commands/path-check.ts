import { resolve } from "node:path";
import { computeRelativePath, isProtectedPath } from "../core/paths.ts";
import { loadRules } from "../core/rules.ts";

const LAYERS = ["types", "config", "repo", "service", "runtime", "ui"];

/**
 * Check if a file path is protected and report layer context.
 * Exit codes: 0 = allowed, 2 = blocked.
 */
export function pathCheck(projectRoot: string, filePath: string): number {
  const rules = loadRules(projectRoot);
  // Resolve relative paths against the project root (not CWD)
  const absolutePath = filePath.startsWith("/") ? filePath : resolve(projectRoot, filePath);
  const relPath = computeRelativePath(absolutePath, projectRoot);
  const result = isProtectedPath(relPath, rules);

  if (result.blocked) {
    console.log(`[arch-check] BLOCKED: '${relPath}' is a protected harness path.`);
    if (result.matchedPrefix) {
      console.log(`[arch-check] Matched: ${result.matchedPrefix}`);
    }
    console.log(
      `[arch-check] To allow edits, a human must add this path to 'exceptions.allowed_core_edits' in architecture/rules.json`,
    );
    return 2;
  }

  // Layer rule check (informational only, for src/ files)
  const srcMatch = relPath.match(/^(?:.*\/)?src\/([^/]+)\//);
  if (srcMatch) {
    const layer = srcMatch[1];
    const layerIndex = LAYERS.indexOf(layer);

    if (layerIndex >= 0) {
      const canImportFrom = LAYERS.slice(0, layerIndex).join(", ") || "(none)";
      const forbidden = LAYERS.slice(layerIndex + 1).join(", ") || "(none)";

      console.log(`[arch-check] Editing file in layer '${layer}' (level ${layerIndex}).`);
      console.log(`[arch-check] This layer can only import from: ${canImportFrom}`);
      console.log(`[arch-check] Forbidden imports from: ${forbidden}`);
    }
  }

  return 0;
}
