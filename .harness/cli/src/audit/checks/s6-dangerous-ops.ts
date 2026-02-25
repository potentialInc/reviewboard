import { resolve } from "node:path";
import type { CheckResult } from "../runner.ts";
import { runCommand } from "../../utils/shell.ts";
import { isExecutable } from "../../utils/fs.ts";
import { readJsonFile } from "../../utils/fs.ts";

/**
 * S6: Dangerous operation blocking checks.
 * Tests that deploy/db/secure keywords are properly blocked.
 */
export function checkDangerousOps(projectRoot: string): CheckResult[] {
  const results: CheckResult[] = [];
  const hook = resolve(projectRoot, "hooks/skill-activation-prompt.sh");

  if (!isExecutable(hook)) {
    return [{
      id: "S6-00",
      description: "skill-activation-prompt.sh is executable",
      pass: false,
      detail: "Hook not found or not executable",
    }];
  }

  // S6-01: deploy: keyword blocked (exit 2)
  {
    const { exitCode } = runCommand(`echo "deploy: push to production" | "${hook}"`, { cwd: projectRoot });
    results.push({
      id: "S6-01",
      description: "deploy: keyword blocked (exit 2)",
      pass: exitCode === 2,
      detail: exitCode !== 2 ? `exit ${exitCode}, expected 2` : undefined,
    });
  }

  // S6-02: db: keyword blocked (exit 2)
  {
    const { exitCode } = runCommand(`echo "db: reset database" | "${hook}"`, { cwd: projectRoot });
    results.push({
      id: "S6-02",
      description: "db: keyword blocked (exit 2)",
      pass: exitCode === 2,
      detail: exitCode !== 2 ? `exit ${exitCode}, expected 2` : undefined,
    });
  }

  // S6-03: secure: keyword blocked (exit 2)
  {
    const { exitCode } = runCommand(`echo "secure: audit secrets" | "${hook}"`, { cwd: projectRoot });
    results.push({
      id: "S6-03",
      description: "secure: keyword blocked (exit 2)",
      pass: exitCode === 2,
      detail: exitCode !== 2 ? `exit ${exitCode}, expected 2` : undefined,
    });
  }

  // S6-04: requireConfirmation config matches dangerous keywords
  const configPath = resolve(projectRoot, "harness.config.json");
  const config = readJsonFile<{
    restrictions?: { requireConfirmation?: string[] };
  }>(configPath);

  if (config === null) {
    results.push({
      id: "S6-04",
      description: "requireConfirmation includes deploy/db/secure",
      pass: false,
      detail: "harness.config.json not found or invalid",
    });
  } else {
    const required = config.restrictions?.requireConfirmation ?? [];
    const hasDeploy = required.some((k) => k.includes("deploy"));
    const hasDb = required.some((k) => k.includes("db"));
    const hasSecure = required.some((k) => k.includes("secure"));
    const allPresent = hasDeploy && hasDb && hasSecure;

    const missing: string[] = [];
    if (!hasDeploy) missing.push("deploy");
    if (!hasDb) missing.push("db");
    if (!hasSecure) missing.push("secure");

    results.push({
      id: "S6-04",
      description: "requireConfirmation includes deploy/db/secure",
      pass: allPresent,
      detail: allPresent ? undefined : `Missing: ${missing.join(", ")}`,
    });
  }

  return results;
}
