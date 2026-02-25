import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { CheckResult } from "../runner.ts";
import { isExecutable } from "../../utils/fs.ts";
import { runCommand } from "../../utils/shell.ts";

/**
 * S7: Learning loop / memory recording checks.
 * Verifies on-stop-summary.sh and auto-reflect.sh functionality.
 */
export function checkLearningLoop(projectRoot: string): CheckResult[] {
  const results: CheckResult[] = [];
  const summaryHook = resolve(projectRoot, "hooks/on-stop-summary.sh");
  const reflectHook = resolve(projectRoot, "hooks/auto-reflect.sh");

  // S7-01: on-stop-summary.sh is executable
  results.push({
    id: "S7-01",
    description: "on-stop-summary.sh is executable",
    pass: isExecutable(summaryHook),
    detail: isExecutable(summaryHook) ? undefined : "Hook not found or not executable",
  });

  // S7-02: auto-reflect.sh is executable
  results.push({
    id: "S7-02",
    description: "auto-reflect.sh is executable",
    pass: isExecutable(reflectHook),
    detail: isExecutable(reflectHook) ? undefined : "Hook not found or not executable",
  });

  // S7-03: on-stop-summary.sh writes to memory/PROGRESS.md
  if (isExecutable(summaryHook)) {
    const { exitCode } = runCommand(`"${summaryHook}"`, { cwd: projectRoot });
    const progressExists = existsSync(resolve(projectRoot, "memory/PROGRESS.md"));
    results.push({
      id: "S7-03",
      description: "on-stop-summary.sh writes PROGRESS.md",
      pass: exitCode === 0 && progressExists,
      detail: exitCode !== 0
        ? `Hook exit code: ${exitCode}`
        : !progressExists
          ? "PROGRESS.md not found after hook execution"
          : undefined,
    });
  } else {
    results.push({
      id: "S7-03",
      description: "on-stop-summary.sh writes PROGRESS.md",
      pass: false,
      skip: true,
      detail: "Hook not executable",
    });
  }

  // S7-04: auto-reflect.sh writes to memory/PATTERNS.md
  if (isExecutable(reflectHook)) {
    const { exitCode } = runCommand(`"${reflectHook}"`, { cwd: projectRoot });
    const patternsExists = existsSync(resolve(projectRoot, "memory/PATTERNS.md"));
    results.push({
      id: "S7-04",
      description: "auto-reflect.sh writes PATTERNS.md",
      pass: exitCode === 0 && patternsExists,
      detail: exitCode !== 0
        ? `Hook exit code: ${exitCode}`
        : !patternsExists
          ? "PATTERNS.md not found after hook execution"
          : undefined,
    });
  } else {
    results.push({
      id: "S7-04",
      description: "auto-reflect.sh writes PATTERNS.md",
      pass: false,
      skip: true,
      detail: "Hook not executable",
    });
  }

  return results;
}
