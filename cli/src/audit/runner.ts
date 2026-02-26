import { logPass, logFail, logSkip, logSection, logSummary } from "../utils/logger.ts";

export interface CheckResult {
  id: string;
  description: string;
  pass: boolean;
  skip?: boolean;
  detail?: string;
}

export type CheckFn = (projectRoot: string) => CheckResult[];

/**
 * Run all audit checks and print results.
 * Returns exit code: 0=all pass, 1=any fail.
 *
 * Check determinism:
 *   - Most checks are fully deterministic (file existence, config parsing, pattern matching).
 *   - Some checks (S1-02, S1-03, S1-06, S7-03, S7-04) execute hooks and verify output,
 *     making them semi-deterministic (depend on hook implementation and filesystem state).
 *   - Semi-deterministic checks are still repeatable given the same project state.
 */
export function runAudit(projectRoot: string, checks: Array<{ section: string; fn: CheckFn }>): number {
  let totalPass = 0;
  let totalFail = 0;
  let totalSkip = 0;

  for (const { section, fn } of checks) {
    logSection(section);
    const results = fn(projectRoot);

    for (const r of results) {
      if (r.skip) {
        logSkip(r.id, r.description, r.detail);
        totalSkip++;
      } else if (r.pass) {
        logPass(r.id, r.description);
        totalPass++;
      } else {
        logFail(r.id, r.description, r.detail);
        totalFail++;
      }
    }
  }

  logSummary(totalPass, totalFail, totalSkip);
  return totalFail > 0 ? 1 : 0;
}
