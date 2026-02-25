import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { CheckResult } from "../runner.ts";

/**
 * S5: Autopilot PRD/guard/safeMode checks.
 * Verifies autopilot.sh and autopilot-inner.sh safety measures.
 */
export function checkAutopilot(projectRoot: string): CheckResult[] {
  const results: CheckResult[] = [];
  const outerPath = resolve(projectRoot, "scripts/autopilot.sh");
  const innerPath = resolve(projectRoot, "scripts/autopilot-inner.sh");

  if (!existsSync(outerPath) || !existsSync(innerPath)) {
    return [{
      id: "S5-00",
      description: "autopilot.sh and autopilot-inner.sh exist",
      pass: false,
      detail: `Missing: ${[!existsSync(outerPath) && "autopilot.sh", !existsSync(innerPath) && "autopilot-inner.sh"].filter(Boolean).join(", ")}`,
    }];
  }

  const outerSource = readFileSync(outerPath, "utf-8");
  const innerSource = readFileSync(innerPath, "utf-8");

  // S5-01: PRD injection before autopilot execution
  const hasPrdInjection = innerSource.includes("prd-resolver") || innerSource.includes("PRD");
  results.push({
    id: "S5-01",
    description: "PRD injection in autopilot-inner.sh",
    pass: hasPrdInjection,
    detail: hasPrdInjection ? undefined : "No PRD resolver invocation found",
  });

  // S5-02: Guard tests run before autopilot completion
  const hasGuardTests = innerSource.includes("guard") && innerSource.includes("run-tests.sh");
  results.push({
    id: "S5-02",
    description: "Guard tests run before autopilot completion",
    pass: hasGuardTests,
    detail: hasGuardTests ? undefined : "No guard test invocation found in autopilot-inner.sh",
  });

  // S5-03: safeMode limits retries in autopilot
  const hasSafeMode = outerSource.includes("safeMode") || outerSource.includes("safe-mode");
  results.push({
    id: "S5-03",
    description: "safeMode limits autopilot retries",
    pass: hasSafeMode,
    detail: hasSafeMode ? undefined : "No safeMode logic found in autopilot.sh",
  });

  // S5-04: P0 guard failure stops autopilot (exit 1)
  const hasP0Stop = innerSource.includes("P0") && innerSource.includes("exit 1");
  results.push({
    id: "S5-04",
    description: "P0 guard failure stops autopilot (exit 1)",
    pass: hasP0Stop,
    detail: hasP0Stop ? undefined : "No P0 hard-fail exit found in autopilot-inner.sh",
  });

  // S5-05: Rate limit detection and backoff
  const hasRateLimit = innerSource.includes("rate") && (innerSource.includes("backoff") || innerSource.includes("BACKOFF"));
  results.push({
    id: "S5-05",
    description: "Rate limit detection with exponential backoff",
    pass: hasRateLimit,
    detail: hasRateLimit ? undefined : "No rate limit/backoff logic found",
  });

  return results;
}
