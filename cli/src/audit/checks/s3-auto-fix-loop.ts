import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { CheckResult } from "../runner.ts";
import { isExecutable } from "../../utils/fs.ts";
import { loadConfig } from "../../core/config.ts";

/**
 * S3: Auto-fix loop integrity checks.
 * Verifies guards, timeout handling, and safeMode integration.
 */
export function checkAutoFixLoop(projectRoot: string): CheckResult[] {
  const results: CheckResult[] = [];
  const scriptPath = resolve(projectRoot, "harness/auto-fix-loop.sh");

  if (!existsSync(scriptPath)) {
    return [{
      id: "S3-00",
      description: "auto-fix-loop.sh exists",
      pass: false,
      detail: "File not found",
    }];
  }

  const source = readFileSync(scriptPath, "utf-8");

  // S3-01: Guard tests run after successful command
  const hasGuardOnSuccess = source.includes("guard") && source.includes("tests after success");
  results.push({
    id: "S3-01",
    description: "Guard tests run after successful command",
    pass: hasGuardOnSuccess,
    detail: hasGuardOnSuccess ? undefined : "No guard-after-success logic found in source",
  });

  // S3-02: Guard tests run after each fix attempt
  const hasGuardAfterFix = source.includes("guard tests after fix") || source.includes("Guard Tests: check harness integrity after fix");
  results.push({
    id: "S3-02",
    description: "Guard tests run after each fix attempt",
    pass: hasGuardAfterFix,
    detail: hasGuardAfterFix ? undefined : "No guard-after-fix logic found in source",
  });

  // S3-03: P0 failure (exit 1) stops loop immediately
  const hasP0Stop = source.includes("exit 1") && (source.includes("CRITICAL") || source.includes("P0"));
  results.push({
    id: "S3-03",
    description: "P0 guard failure stops loop immediately (exit 1)",
    pass: hasP0Stop,
    detail: hasP0Stop ? undefined : "No P0 hard-fail exit found in source",
  });

  // S3-04: Timeout (exit 124) treated as failure
  const hasTimeoutHandling = source.includes("124") && source.includes("timed out");
  results.push({
    id: "S3-04",
    description: "Timeout (exit 124) treated as failure",
    pass: hasTimeoutHandling,
    detail: hasTimeoutHandling ? undefined : "No timeout (124) handling found in source",
  });

  // S3-05: safeMode limits retries from config
  const config = loadConfig(projectRoot);
  const hasSafeModeLogic = source.includes("safeMode") || source.includes("safe-mode");

  let safeModeCorrect = false;
  if (hasSafeModeLogic && config !== null) {
    const hasAutoFixRetries = source.includes("autoFixRetries");
    safeModeCorrect = hasSafeModeLogic && hasAutoFixRetries;
  } else if (hasSafeModeLogic) {
    safeModeCorrect = true; // Logic exists even if config missing
  }

  results.push({
    id: "S3-05",
    description: "safeMode limits retries from config",
    pass: safeModeCorrect,
    detail: safeModeCorrect ? undefined : "safeMode/autoFixRetries logic not found in source",
  });

  return results;
}
