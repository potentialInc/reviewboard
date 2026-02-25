import { realpathSync, lstatSync } from "node:fs";
import { resolve, relative } from "node:path";
import { getProtectedPaths, getAllowedEdits, type ArchRules } from "./rules.ts";

/**
 * Normalize a path: resolve . and .. components.
 * Pure implementation — no external tools needed.
 */
export function normalizePath(inputPath: string): string {
  const isAbsolute = inputPath.startsWith("/");
  const parts = inputPath.split("/").filter(Boolean);
  const normalized: string[] = [];

  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      normalized.pop();
    } else {
      normalized.push(part);
    }
  }

  const result = normalized.join("/");
  return isAbsolute ? `/${result}` : result;
}

/**
 * Resolve symlinks to get the real path.
 * Uses Node's built-in realpathSync — no python3 or readlink dependency.
 */
export function resolveSymlinks(filePath: string): string {
  try {
    const stat = lstatSync(filePath);
    if (stat.isSymbolicLink()) {
      return realpathSync(filePath);
    }
  } catch {
    // File may not exist yet (pre-edit check for new files)
  }
  return filePath;
}

/**
 * Compute relative path from project root.
 */
export function computeRelativePath(filePath: string, projectRoot: string): string {
  const canonicalFile = normalizePath(resolveSymlinks(filePath));
  const canonicalRoot = normalizePath(projectRoot);

  if (canonicalFile.startsWith(canonicalRoot + "/")) {
    return canonicalFile.slice(canonicalRoot.length + 1);
  }

  return relative(canonicalRoot, canonicalFile);
}

/**
 * Check if a relative path falls under any protected path prefix.
 */
export function isProtectedPath(
  relPath: string,
  rules: ArchRules | null,
  projectRoot?: string,
): { blocked: boolean; matchedPrefix: string | null; isAllowed: boolean } {
  const protectedPaths = getProtectedPaths(rules, projectRoot);
  const allowedEdits = getAllowedEdits(rules);

  for (const protectedPrefix of protectedPaths) {
    if (relPath.startsWith(protectedPrefix) || relPath === protectedPrefix.replace(/\/$/, "")) {
      // Check if explicitly allowed
      for (const allowed of allowedEdits) {
        if (relPath.startsWith(allowed) || relPath === allowed) {
          return { blocked: false, matchedPrefix: protectedPrefix, isAllowed: true };
        }
      }
      return { blocked: true, matchedPrefix: protectedPrefix, isAllowed: false };
    }
  }

  return { blocked: false, matchedPrefix: null, isAllowed: false };
}
