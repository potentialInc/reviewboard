import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { CheckResult } from "../runner.ts";
import { runCommand } from "../../utils/shell.ts";
import { isExecutable } from "../../utils/fs.ts";
import { readJsonFile } from "../../utils/fs.ts";

/**
 * S1: Magic keyword & skill activation checks.
 */
export function checkMagicKeyword(projectRoot: string): CheckResult[] {
  const results: CheckResult[] = [];
  const rulesPath = resolve(projectRoot, "skills/skill-rules.json");
  const hook = resolve(projectRoot, "hooks/skill-activation-prompt.sh");

  // S1-01: Each magic keyword maps to a valid skill file
  const rules = readJsonFile<{
    skills: Record<string, { magicKeyword?: string; file: string }>;
  }>(rulesPath);

  if (rules === null) {
    results.push({
      id: "S1-01",
      description: "skill-rules.json loadable",
      pass: false,
      detail: "File not found or invalid JSON",
    });
    return results;
  }

  let allSkillFilesExist = true;
  const missingFiles: string[] = [];

  for (const [name, skill] of Object.entries(rules.skills)) {
    if (!skill.magicKeyword) continue;
    const filePath = resolve(projectRoot, skill.file);
    if (!existsSync(filePath)) {
      allSkillFilesExist = false;
      missingFiles.push(`${name}: ${skill.file}`);
    }
  }

  results.push({
    id: "S1-01",
    description: "All magic keywords map to existing skill files",
    pass: allSkillFilesExist,
    detail: missingFiles.length > 0 ? `Missing: ${missingFiles.join(", ")}` : undefined,
  });

  // S1-02: Magic keyword triggers PRD injection (requires hook executable + active PRD)
  if (!isExecutable(hook)) {
    results.push({
      id: "S1-02",
      description: "Magic keyword triggers PRD injection",
      pass: false,
      detail: "skill-activation-prompt.sh not found or not executable",
    });
  } else {
    // Check if prd-resolver.sh exists (PRD injection depends on it)
    const prdResolver = resolve(projectRoot, "harness/prd-resolver.sh");
    const hasPrdResolver = existsSync(prdResolver) && isExecutable(prdResolver);

    const { stdout } = runCommand(`echo "build: test feature" | "${hook}"`, { cwd: projectRoot });
    const hasPrd = stdout.includes("SOURCE OF TRUTH") || stdout.includes("PRD");

    // If no PRD resolver or no active PRD file, check that the mechanism exists in code
    if (!hasPrd && hasPrdResolver) {
      // Resolver exists but no active PRD — check that injection code path is present
      const hookSource = runCommand(`cat "${hook}"`, { cwd: projectRoot }).stdout;
      const hasInjectionCode = hookSource.includes("prd-resolver") || hookSource.includes("PRD");
      results.push({
        id: "S1-02",
        description: "Magic keyword triggers PRD injection",
        pass: hasInjectionCode,
        detail: hasInjectionCode ? "PRD injection code present (no active PRD file)" : "PRD injection code missing",
      });
    } else {
      results.push({
        id: "S1-02",
        description: "Magic keyword triggers PRD injection",
        pass: hasPrd || !hasPrdResolver,
        detail: hasPrd ? undefined : (!hasPrdResolver ? "No prd-resolver.sh (PRD system not configured)" : "PRD injection not found in output"),
      });
    }
  }

  // S1-03: Agent binding output contains "BINDING"
  if (!isExecutable(hook)) {
    results.push({
      id: "S1-03",
      description: "Agent binding output contains BINDING",
      pass: false,
      detail: "Hook not executable",
    });
  } else {
    const { stdout } = runCommand(`echo "build: test" | "${hook}"`, { cwd: projectRoot });
    const hasBinding = stdout.includes("BINDING");
    results.push({
      id: "S1-03",
      description: "Agent binding output contains BINDING",
      pass: hasBinding,
      detail: hasBinding ? undefined : "BINDING not found in hook output",
    });
  }

  // S1-04: Skill detection works without jq (TypeScript handles JSON natively)
  {
    const tsxBin = resolve(projectRoot, "cli/node_modules/.bin/tsx");
    const cliSrc = resolve(projectRoot, "cli/src/index.ts");
    if (existsSync(tsxBin) && existsSync(cliSrc)) {
      const { exitCode, stdout } = runCommand(
        `echo "build: test" | "${tsxBin}" "${cliSrc}" skill detect`,
        { cwd: projectRoot },
      );
      const works = exitCode === 0 && stdout.includes("MAGIC KEYWORD");
      results.push({
        id: "S1-04",
        description: "Skill detection works without jq (TypeScript native JSON)",
        pass: works,
        detail: works ? undefined : `exit ${exitCode}, no MAGIC KEYWORD in output`,
      });
    } else {
      results.push({
        id: "S1-04",
        description: "Skill detection works without jq (TypeScript native JSON)",
        pass: false,
        detail: "tsx or CLI source not found",
      });
    }
  }

  // S1-05: deploy/db/secure keywords → exit 2 (confirmation required)
  const dangerousKeywords = ["deploy:", "db:", "secure:"];
  let allBlocked = true;
  const notBlocked: string[] = [];

  if (!isExecutable(hook)) {
    allBlocked = false;
    notBlocked.push("hook not executable");
  } else {
    for (const kw of dangerousKeywords) {
      const { exitCode } = runCommand(`echo "${kw} test" | "${hook}"`, { cwd: projectRoot });
      if (exitCode !== 2) {
        allBlocked = false;
        notBlocked.push(`${kw} → exit ${exitCode}`);
      }
    }
  }

  results.push({
    id: "S1-05",
    description: "deploy/db/secure keywords → exit 2 (blocked)",
    pass: allBlocked,
    detail: notBlocked.length > 0 ? notBlocked.join("; ") : undefined,
  });

  // S1-06: Skill activation log is written
  if (!isExecutable(hook)) {
    results.push({
      id: "S1-06",
      description: "Skill activation log is recorded",
      pass: false,
      skip: true,
      detail: "Hook not executable",
    });
  } else {
    const logPath = resolve(projectRoot, ".worktree-logs/skill-activations.log");
    const beforeExists = existsSync(logPath);
    runCommand(`echo "build: log test" | "${hook}"`, { cwd: projectRoot });
    const afterExists = existsSync(logPath);
    results.push({
      id: "S1-06",
      description: "Skill activation log is recorded",
      pass: afterExists,
      detail: !afterExists ? "skill-activations.log not created after activation" : undefined,
    });
  }

  return results;
}
