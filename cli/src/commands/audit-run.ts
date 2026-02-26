import { runAudit } from "../audit/runner.ts";
import { checkBootstrap } from "../audit/checks/s0-bootstrap.ts";
import { checkMagicKeyword } from "../audit/checks/s1-magic-keyword.ts";
import { checkProtectedPaths } from "../audit/checks/s2-protected-paths.ts";
import { checkAutoFixLoop } from "../audit/checks/s3-auto-fix-loop.ts";
import { checkOrchestrator } from "../audit/checks/s4-orchestrator.ts";
import { checkAutopilot } from "../audit/checks/s5-autopilot.ts";
import { checkDangerousOps } from "../audit/checks/s6-dangerous-ops.ts";
import { checkLearningLoop } from "../audit/checks/s7-learning-loop.ts";

/**
 * Run the full deterministic audit checklist.
 * Returns process exit code: 0 = all pass, 1 = any fail.
 */
export function auditRun(projectRoot: string): number {
  const checks = [
    { section: "S0: Bootstrap & Prerequisites", fn: checkBootstrap },
    { section: "S1: Magic Keyword & Skill Activation", fn: checkMagicKeyword },
    { section: "S2: Protected Path Enforcement", fn: checkProtectedPaths },
    { section: "S3: Auto-Fix Loop Integrity", fn: checkAutoFixLoop },
    { section: "S4: Orchestrator Guard Integration", fn: checkOrchestrator },
    { section: "S5: Autopilot Safety", fn: checkAutopilot },
    { section: "S6: Dangerous Operation Blocking", fn: checkDangerousOps },
    { section: "S7: Learning Loop / Memory", fn: checkLearningLoop },
  ];

  return runAudit(projectRoot, checks);
}
