import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { CheckResult } from "../runner.ts";
import { isExecutable } from "../../utils/fs.ts";

/**
 * S4: Orchestrator guard integration checks.
 * Verifies orchestrator.sh has proper safety measures.
 */
export function checkOrchestrator(projectRoot: string): CheckResult[] {
  const results: CheckResult[] = [];
  const scriptPath = resolve(projectRoot, "orchestrator.sh");

  if (!existsSync(scriptPath)) {
    return [{
      id: "S4-00",
      description: "orchestrator.sh exists",
      pass: false,
      detail: "File not found",
    }];
  }

  const source = readFileSync(scriptPath, "utf-8");

  // S4-01: tasks.json schema validation before launch
  const hasSchemaValidation = source.includes("jq empty") || source.includes("not valid JSON");
  results.push({
    id: "S4-01",
    description: "tasks.json schema validated before launch",
    pass: hasSchemaValidation,
    detail: hasSchemaValidation ? undefined : "No JSON validation found in source",
  });

  // S4-02: safeMode limits parallel agent count
  const hasSafeMode = source.includes("safeMode") && source.includes("maxParallelAgents");
  results.push({
    id: "S4-02",
    description: "safeMode limits parallel agent count",
    pass: hasSafeMode,
    detail: hasSafeMode ? undefined : "safeMode/maxParallelAgents logic not found",
  });

  // S4-03: Guard tests run after all agents complete (Phase 3b)
  const hasGuardPhase = source.includes("guard tests") || source.includes("Phase 3b");
  results.push({
    id: "S4-03",
    description: "Guard tests run after agents complete",
    pass: hasGuardPhase,
    detail: hasGuardPhase ? undefined : "No guard test phase found in source",
  });

  // S4-04: P0 guard failure blocks auto-PR
  const blocksAutoPR = source.includes("AUTO_PR=false") && (source.includes("GUARD_P0_FAIL") || source.includes("CRITICAL"));
  results.push({
    id: "S4-04",
    description: "P0 guard failure blocks auto-PR",
    pass: blocksAutoPR,
    detail: blocksAutoPR ? undefined : "AUTO_PR blocking on guard failure not found",
  });

  // S4-05: PRD injection into agent prompts
  const hasPrdInjection = source.includes("prd-resolver") || source.includes("PRD");
  results.push({
    id: "S4-05",
    description: "PRD injection into agent prompts",
    pass: hasPrdInjection,
    detail: hasPrdInjection ? undefined : "No PRD injection found in orchestrator",
  });

  // S4-06: Agent timeout enforcement
  const hasAgentTimeout = source.includes("AGENT_TIMEOUT") && (source.includes("timeout") || source.includes("_timeout_cmd"));
  results.push({
    id: "S4-06",
    description: "Agent execution has timeout enforcement",
    pass: hasAgentTimeout,
    detail: hasAgentTimeout ? undefined : "No agent timeout logic found",
  });

  return results;
}
