#!/usr/bin/env node

// src/utils/fs.ts
import { existsSync, readFileSync, statSync, readdirSync, accessSync, constants } from "node:fs";
import { resolve, join } from "node:path";
function readJsonFile(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}
function isExecutable(filePath) {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
function listFiles(dirPath, pattern) {
  if (!existsSync(dirPath)) return [];
  try {
    const entries = readdirSync(dirPath);
    const files = entries.map((e) => join(dirPath, e)).filter((f) => statSync(f).isFile());
    if (pattern) return files.filter((f) => pattern.test(f));
    return files;
  } catch {
    return [];
  }
}
function findProjectRoot(startDir) {
  let dir = startDir ?? process.cwd();
  for (let i = 0; i < 20; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md")) && existsSync(resolve(dir, "harness.config.json"))) {
      return dir;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}
function findRepoRoot(harnessRoot) {
  const parent = resolve(harnessRoot, "..");
  if (existsSync(resolve(parent, ".harness")) && existsSync(resolve(parent, "CLAUDE.md"))) {
    return parent;
  }
  return harnessRoot;
}

// src/utils/logger.ts
var COLORS = {
  red: "\x1B[0;31m",
  green: "\x1B[0;32m",
  yellow: "\x1B[1;33m",
  cyan: "\x1B[0;36m",
  reset: "\x1B[0m"
};
function logPass(id, message) {
  const padded = message.padEnd(45);
  console.log(`  ${id}  ${padded}${COLORS.green}PASS${COLORS.reset}`);
}
function logFail(id, message, detail) {
  const padded = message.padEnd(45);
  const detailStr = detail ? `  ${detail}` : "";
  console.log(`  ${id}  ${padded}${COLORS.red}FAIL${COLORS.reset}${detailStr}`);
}
function logSkip(id, message, reason) {
  const padded = message.padEnd(45);
  const reasonStr = reason ? `  (${reason})` : "";
  console.log(`  ${id}  ${padded}${COLORS.yellow}SKIP${COLORS.reset}${reasonStr}`);
}
function logSection(title) {
  console.log(`
${COLORS.cyan}=== ${title} ===${COLORS.reset}`);
}
function logSummary(pass, fail, skip) {
  const total = pass + fail + skip;
  console.log(`
${"\u2500".repeat(50)}`);
  console.log(`  RESULT: ${pass}/${total} PASS, ${fail} FAIL${skip > 0 ? `, ${skip} SKIP` : ""}`);
  if (fail === 0) {
    console.log(`  ${COLORS.green}All checks passed.${COLORS.reset}`);
  } else {
    console.log(`  ${COLORS.red}${fail} check(s) failed. Fix before proceeding.${COLORS.reset}`);
  }
}

// src/audit/runner.ts
function runAudit(projectRoot, checks) {
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

// src/audit/checks/s0-bootstrap.ts
import { existsSync as existsSync3, readFileSync as readFileSync3 } from "node:fs";
import { resolve as resolve3 } from "node:path";

// src/utils/shell.ts
import { spawnSync } from "node:child_process";
function commandExists(cmd) {
  if (!/^[a-zA-Z0-9._\/-]+$/.test(cmd)) {
    return false;
  }
  try {
    const result = spawnSync("sh", ["-c", `command -v "${cmd}"`], {
      stdio: "pipe",
      timeout: 5e3
    });
    return result.status === 0;
  } catch {
    return false;
  }
}
function runCommand(cmd, options) {
  try {
    const result = spawnSync("sh", ["-c", cmd], {
      cwd: options?.cwd,
      input: options?.stdin,
      timeout: options?.timeout ?? 3e4,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8"
    });
    return {
      exitCode: result.status ?? 0,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? ""
    };
  } catch (err) {
    const e = err;
    return {
      exitCode: e.status ?? 1,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? ""
    };
  }
}

// src/core/config.ts
import { readFileSync as readFileSync2, existsSync as existsSync2 } from "node:fs";
import { resolve as resolve2 } from "node:path";

// src/core/exit-codes.ts
var EXIT = {
  /** Success / allow action */
  OK: 0,
  /** Hard failure (P0) — stops auto-fix, blocks merge */
  HARD_FAIL: 1,
  /** Block action — PreToolUse hooks return 2 to reject the tool call */
  BLOCK: 2
};

// src/core/errors.ts
var HarnessError = class extends Error {
  constructor(message, exitCode, whatToDo) {
    super(message);
    this.exitCode = exitCode;
    this.whatToDo = whatToDo;
    this.name = "HarnessError";
  }
};
var ConfigError = class extends HarnessError {
  constructor(message, whatToDo) {
    super(message, EXIT.HARD_FAIL, whatToDo);
    this.name = "ConfigError";
  }
};

// src/core/config.ts
var REQUIRED_TOP_KEYS = ["version", "safeMode", "restrictions"];
var REQUIRED_RESTRICTION_KEYS = [
  "maxParallelAgents",
  "autoFixRetries",
  "requireConfirmation"
];
var KNOWN_TOP_KEYS = [
  "version",
  "safeMode",
  "restrictions",
  "_protectedPathsSource"
];
var KNOWN_RESTRICTION_KEYS = [
  "maxParallelAgents",
  "autoFixRetries",
  "requireConfirmation"
];
var KNOWN_RC_VALUES = [
  "deploy",
  "deploy:preview",
  "deploy:promote",
  "db",
  "db:migrate",
  "db:seed",
  "db:reset",
  "secure"
];
function loadConfig(projectRoot, customPath) {
  const configPath = customPath ?? resolve2(projectRoot, "harness.config.json");
  if (!existsSync2(configPath)) return null;
  const raw = readFileSync2(configPath, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    throw new ConfigError(
      `${configPath} is not valid JSON.`,
      "Check for trailing commas, missing quotes, or unmatched braces."
    );
  }
}
function validateConfig(config) {
  const errors = [];
  const warnings = [];
  if (typeof config !== "object" || config === null) {
    errors.push("Config must be a JSON object");
    return { errors, warnings };
  }
  const obj = config;
  for (const key of REQUIRED_TOP_KEYS) {
    if (!(key in obj) || obj[key] === null || obj[key] === void 0) {
      errors.push(`Missing required key: '${key}'`);
    }
  }
  if ("version" in obj && typeof obj.version !== "string") {
    errors.push(`'version' must be a string (got ${typeof obj.version})`);
  }
  if ("safeMode" in obj && typeof obj.safeMode !== "boolean") {
    errors.push(`'safeMode' must be a boolean (got ${typeof obj.safeMode})`);
  }
  if ("restrictions" in obj && typeof obj.restrictions === "object" && obj.restrictions !== null) {
    const restrictions = obj.restrictions;
    for (const key of REQUIRED_RESTRICTION_KEYS) {
      if (!(key in restrictions) || restrictions[key] === null || restrictions[key] === void 0) {
        errors.push(`Missing required key: 'restrictions.${key}'`);
      }
    }
    if ("maxParallelAgents" in restrictions) {
      if (typeof restrictions.maxParallelAgents !== "number") {
        errors.push(`'restrictions.maxParallelAgents' must be a number (got ${typeof restrictions.maxParallelAgents})`);
      } else if (restrictions.maxParallelAgents < 1 || restrictions.maxParallelAgents > 100) {
        errors.push(`'restrictions.maxParallelAgents' must be between 1 and 100 (got ${restrictions.maxParallelAgents})`);
      }
    }
    if ("autoFixRetries" in restrictions) {
      if (typeof restrictions.autoFixRetries !== "number") {
        errors.push(`'restrictions.autoFixRetries' must be a number (got ${typeof restrictions.autoFixRetries})`);
      } else if (restrictions.autoFixRetries < 0 || restrictions.autoFixRetries > 20) {
        errors.push(`'restrictions.autoFixRetries' must be between 0 and 20 (got ${restrictions.autoFixRetries})`);
      }
    }
    if ("requireConfirmation" in restrictions) {
      if (!Array.isArray(restrictions.requireConfirmation)) {
        errors.push(`'restrictions.requireConfirmation' must be an array (got ${typeof restrictions.requireConfirmation})`);
      } else {
        if (restrictions.requireConfirmation.length === 0) {
          warnings.push("'restrictions.requireConfirmation' is empty \u2014 no dangerous keywords will be blocked.");
        }
        for (const val of restrictions.requireConfirmation) {
          if (typeof val !== "string") {
            errors.push(`'restrictions.requireConfirmation' elements must be strings (got ${typeof val})`);
          } else if (!KNOWN_RC_VALUES.includes(val)) {
            warnings.push(`Unknown requireConfirmation value: '${val}' (known: ${KNOWN_RC_VALUES.join(", ")})`);
          }
        }
      }
    }
    for (const key of Object.keys(restrictions)) {
      if (!KNOWN_RESTRICTION_KEYS.includes(key)) {
        warnings.push(`Unknown restriction key: '${key}' (typo? known: ${KNOWN_RESTRICTION_KEYS.join(", ")})`);
      }
    }
  }
  for (const key of Object.keys(obj)) {
    if (!KNOWN_TOP_KEYS.includes(key)) {
      warnings.push(`Unknown top-level key: '${key}' (typo? known: ${KNOWN_TOP_KEYS.join(", ")})`);
    }
  }
  return { errors, warnings };
}

// src/audit/checks/s0-bootstrap.ts
var CRITICAL_HOOKS = [
  "hooks/session-start.sh",
  "hooks/pre-edit-arch-check.sh",
  "hooks/pre-edit-security-check.sh",
  "hooks/skill-activation-prompt.sh"
];
function checkBootstrap(projectRoot) {
  const results = [];
  results.push({
    id: "S0-01",
    description: "jq installed",
    pass: commandExists("jq"),
    detail: commandExists("jq") ? void 0 : "brew install jq"
  });
  results.push({
    id: "S0-02",
    description: "git installed",
    pass: commandExists("git"),
    detail: commandExists("git") ? void 0 : "brew install git"
  });
  results.push({
    id: "S0-03",
    description: "claude CLI installed",
    pass: commandExists("claude"),
    detail: commandExists("claude") ? void 0 : "https://claude.ai/download"
  });
  results.push({
    id: "S0-04",
    description: "tmux installed",
    pass: commandExists("tmux"),
    detail: commandExists("tmux") ? void 0 : "brew install tmux"
  });
  const hasTimeout = commandExists("timeout") || commandExists("gtimeout");
  results.push({
    id: "S0-05",
    description: "timeout/gtimeout installed",
    pass: hasTimeout,
    detail: hasTimeout ? void 0 : "brew install coreutils"
  });
  const hookDir = resolve3(projectRoot, "hooks");
  const hookFiles = listFiles(hookDir, /\.sh$/);
  const nonExec = hookFiles.filter((f) => !isExecutable(f));
  results.push({
    id: "S0-06",
    description: "All hooks/*.sh are executable",
    pass: nonExec.length === 0 && hookFiles.length > 0,
    detail: nonExec.length > 0 ? `${nonExec.length} hook(s) not executable` : void 0
  });
  const repoRoot = findRepoRoot(projectRoot);
  const settingsPaths = [
    resolve3(repoRoot, ".claude/settings.json"),
    resolve3(repoRoot, ".claude/settings.local.json"),
    resolve3(projectRoot, ".claude/settings.json"),
    resolve3(projectRoot, ".claude/settings.local.json")
  ];
  let missingHooks = CRITICAL_HOOKS;
  for (const sp of settingsPaths) {
    if (existsSync3(sp)) {
      const settingsRaw = readFileSync3(sp, "utf-8");
      const missing = CRITICAL_HOOKS.filter((h) => !settingsRaw.includes(h));
      if (missing.length < missingHooks.length) {
        missingHooks = missing;
      }
    }
  }
  results.push({
    id: "S0-07",
    description: "Critical hooks wired in .claude/settings.json",
    pass: missingHooks.length === 0,
    detail: missingHooks.length > 0 ? `Missing: ${missingHooks.join(", ")}` : void 0
  });
  const config = loadConfig(projectRoot);
  if (config === null) {
    results.push({
      id: "S0-08",
      description: "harness.config.json passes validation",
      pass: false,
      detail: "Config file not found"
    });
  } else {
    const validation = validateConfig(config);
    results.push({
      id: "S0-08",
      description: "harness.config.json passes validation",
      pass: validation.errors.length === 0,
      detail: validation.errors.length > 0 ? validation.errors[0] : void 0
    });
  }
  return results;
}

// src/audit/checks/s1-magic-keyword.ts
import { existsSync as existsSync4 } from "node:fs";
import { resolve as resolve4 } from "node:path";
function checkMagicKeyword(projectRoot) {
  const results = [];
  const rulesPath = resolve4(projectRoot, "skills/skill-rules.json");
  const hook = resolve4(projectRoot, "hooks/skill-activation-prompt.sh");
  const rules = readJsonFile(rulesPath);
  if (rules === null) {
    results.push({
      id: "S1-01",
      description: "skill-rules.json loadable",
      pass: false,
      detail: "File not found or invalid JSON"
    });
    return results;
  }
  let allSkillFilesExist = true;
  const missingFiles = [];
  for (const [name, skill] of Object.entries(rules.skills)) {
    if (!skill.magicKeyword) continue;
    const filePath = resolve4(projectRoot, skill.file);
    if (!existsSync4(filePath)) {
      allSkillFilesExist = false;
      missingFiles.push(`${name}: ${skill.file}`);
    }
  }
  results.push({
    id: "S1-01",
    description: "All magic keywords map to existing skill files",
    pass: allSkillFilesExist,
    detail: missingFiles.length > 0 ? `Missing: ${missingFiles.join(", ")}` : void 0
  });
  if (!isExecutable(hook)) {
    results.push({
      id: "S1-02",
      description: "Magic keyword triggers PRD injection",
      pass: false,
      detail: "skill-activation-prompt.sh not found or not executable"
    });
  } else {
    const prdResolver = resolve4(projectRoot, "harness/prd-resolver.sh");
    const hasPrdResolver = existsSync4(prdResolver) && isExecutable(prdResolver);
    const { stdout } = runCommand(`echo "build: test feature" | "${hook}"`, { cwd: projectRoot });
    const hasPrd = stdout.includes("SOURCE OF TRUTH") || stdout.includes("PRD");
    if (!hasPrd && hasPrdResolver) {
      const hookSource = runCommand(`cat "${hook}"`, { cwd: projectRoot }).stdout;
      const hasInjectionCode = hookSource.includes("prd-resolver") || hookSource.includes("PRD");
      results.push({
        id: "S1-02",
        description: "Magic keyword triggers PRD injection",
        pass: hasInjectionCode,
        detail: hasInjectionCode ? "PRD injection code present (no active PRD file)" : "PRD injection code missing"
      });
    } else {
      results.push({
        id: "S1-02",
        description: "Magic keyword triggers PRD injection",
        pass: hasPrd || !hasPrdResolver,
        detail: hasPrd ? void 0 : !hasPrdResolver ? "No prd-resolver.sh (PRD system not configured)" : "PRD injection not found in output"
      });
    }
  }
  if (!isExecutable(hook)) {
    results.push({
      id: "S1-03",
      description: "Agent binding output contains BINDING",
      pass: false,
      detail: "Hook not executable"
    });
  } else {
    const { stdout } = runCommand(`echo "build: test" | "${hook}"`, { cwd: projectRoot });
    const hasBinding = stdout.includes("BINDING");
    results.push({
      id: "S1-03",
      description: "Agent binding output contains BINDING",
      pass: hasBinding,
      detail: hasBinding ? void 0 : "BINDING not found in hook output"
    });
  }
  {
    const tsxBin = resolve4(projectRoot, "cli/node_modules/.bin/tsx");
    const cliSrc = resolve4(projectRoot, "cli/src/index.ts");
    if (existsSync4(tsxBin) && existsSync4(cliSrc)) {
      const { exitCode, stdout } = runCommand(
        `echo "build: test" | "${tsxBin}" "${cliSrc}" skill detect`,
        { cwd: projectRoot }
      );
      const works = exitCode === 0 && stdout.includes("MAGIC KEYWORD");
      results.push({
        id: "S1-04",
        description: "Skill detection works without jq (TypeScript native JSON)",
        pass: works,
        detail: works ? void 0 : `exit ${exitCode}, no MAGIC KEYWORD in output`
      });
    } else {
      results.push({
        id: "S1-04",
        description: "Skill detection works without jq (TypeScript native JSON)",
        pass: false,
        detail: "tsx or CLI source not found"
      });
    }
  }
  const dangerousKeywords = ["deploy:", "db:", "secure:"];
  let allBlocked = true;
  const notBlocked = [];
  if (!isExecutable(hook)) {
    allBlocked = false;
    notBlocked.push("hook not executable");
  } else {
    for (const kw of dangerousKeywords) {
      const { exitCode } = runCommand(`echo "${kw} test" | "${hook}"`, { cwd: projectRoot });
      if (exitCode !== 2) {
        allBlocked = false;
        notBlocked.push(`${kw} \u2192 exit ${exitCode}`);
      }
    }
  }
  results.push({
    id: "S1-05",
    description: "deploy/db/secure keywords \u2192 exit 2 (blocked)",
    pass: allBlocked,
    detail: notBlocked.length > 0 ? notBlocked.join("; ") : void 0
  });
  if (!isExecutable(hook)) {
    results.push({
      id: "S1-06",
      description: "Skill activation log is recorded",
      pass: false,
      skip: true,
      detail: "Hook not executable"
    });
  } else {
    const logPath = resolve4(projectRoot, ".worktree-logs/skill-activations.log");
    const beforeExists = existsSync4(logPath);
    runCommand(`echo "build: log test" | "${hook}"`, { cwd: projectRoot });
    const afterExists = existsSync4(logPath);
    results.push({
      id: "S1-06",
      description: "Skill activation log is recorded",
      pass: afterExists,
      detail: !afterExists ? "skill-activations.log not created after activation" : void 0
    });
  }
  return results;
}

// src/audit/checks/s2-protected-paths.ts
import { resolve as resolve5 } from "node:path";
function checkProtectedPaths(projectRoot) {
  const results = [];
  const hook = resolve5(projectRoot, "hooks/pre-edit-arch-check.sh");
  const repoRoot = findRepoRoot(projectRoot);
  if (!isExecutable(hook)) {
    return [{
      id: "S2-00",
      description: "pre-edit-arch-check.sh is executable",
      pass: false,
      detail: "Hook not found or not executable"
    }];
  }
  function testPath(id, desc, testPath2, expectedExit, root) {
    const base = root ?? projectRoot;
    const fullPath = testPath2.startsWith("/") ? testPath2 : resolve5(base, testPath2);
    const { exitCode } = runCommand(`"${hook}" "${fullPath}"`, { cwd: projectRoot });
    return {
      id,
      description: desc,
      pass: exitCode === expectedExit,
      detail: exitCode !== expectedExit ? `exit ${exitCode}, expected ${expectedExit}` : void 0
    };
  }
  results.push(testPath("S2-01", "harness/ edit blocked (exit 2)", "auto-fix-loop.sh", 2));
  results.push(testPath("S2-02", "hooks/ edit blocked (exit 2)", "hooks/session-start.sh", 2));
  results.push(testPath("S2-03", "architecture/ edit blocked (exit 2)", "architecture/rules.json", 2));
  results.push(testPath("S2-04", ".claude/ edit blocked (exit 2)", ".claude/settings.json", 2, repoRoot));
  results.push(testPath("S2-05", "CLAUDE.md edit blocked (exit 2)", "CLAUDE.md", 2, repoRoot));
  results.push(testPath("S2-06", "Path traversal (../) blocked", "app/../.harness/auto-fix-loop.sh", 2, repoRoot));
  results.push(testPath("S2-07", "Deep traversal (../../) blocked", "app/src/../../.harness/hooks/hook.sh", 2, repoRoot));
  results.push(testPath("S2-08", "Non-protected path allowed (exit 0)", "app/src/service/foo.ts", 0, repoRoot));
  return results;
}

// src/audit/checks/s3-auto-fix-loop.ts
import { readFileSync as readFileSync4, existsSync as existsSync5 } from "node:fs";
import { resolve as resolve6 } from "node:path";
function checkAutoFixLoop(projectRoot) {
  const results = [];
  const scriptPath = resolve6(projectRoot, "auto-fix-loop.sh");
  if (!existsSync5(scriptPath)) {
    return [{
      id: "S3-00",
      description: "auto-fix-loop.sh exists",
      pass: false,
      detail: "File not found"
    }];
  }
  const source = readFileSync4(scriptPath, "utf-8");
  const hasGuardOnSuccess = source.includes("guard") && source.includes("tests after success");
  results.push({
    id: "S3-01",
    description: "Guard tests run after successful command",
    pass: hasGuardOnSuccess,
    detail: hasGuardOnSuccess ? void 0 : "No guard-after-success logic found in source"
  });
  const hasGuardAfterFix = source.includes("guard tests after fix") || source.includes("Guard Tests: check harness integrity after fix");
  results.push({
    id: "S3-02",
    description: "Guard tests run after each fix attempt",
    pass: hasGuardAfterFix,
    detail: hasGuardAfterFix ? void 0 : "No guard-after-fix logic found in source"
  });
  const hasP0Stop = source.includes("exit 1") && (source.includes("CRITICAL") || source.includes("P0"));
  results.push({
    id: "S3-03",
    description: "P0 guard failure stops loop immediately (exit 1)",
    pass: hasP0Stop,
    detail: hasP0Stop ? void 0 : "No P0 hard-fail exit found in source"
  });
  const hasTimeoutHandling = source.includes("124") && source.includes("timed out");
  results.push({
    id: "S3-04",
    description: "Timeout (exit 124) treated as failure",
    pass: hasTimeoutHandling,
    detail: hasTimeoutHandling ? void 0 : "No timeout (124) handling found in source"
  });
  const config = loadConfig(projectRoot);
  const hasSafeModeLogic = source.includes("safeMode") || source.includes("safe-mode");
  let safeModeCorrect = false;
  if (hasSafeModeLogic && config !== null) {
    const hasAutoFixRetries = source.includes("autoFixRetries");
    safeModeCorrect = hasSafeModeLogic && hasAutoFixRetries;
  } else if (hasSafeModeLogic) {
    safeModeCorrect = true;
  }
  results.push({
    id: "S3-05",
    description: "safeMode limits retries from config",
    pass: safeModeCorrect,
    detail: safeModeCorrect ? void 0 : "safeMode/autoFixRetries logic not found in source"
  });
  return results;
}

// src/audit/checks/s4-orchestrator.ts
import { readFileSync as readFileSync5, existsSync as existsSync6 } from "node:fs";
import { resolve as resolve7 } from "node:path";
function checkOrchestrator(projectRoot) {
  const results = [];
  const scriptPath = resolve7(projectRoot, "orchestrator.sh");
  if (!existsSync6(scriptPath)) {
    return [{
      id: "S4-00",
      description: "orchestrator.sh exists",
      pass: false,
      detail: "File not found"
    }];
  }
  const source = readFileSync5(scriptPath, "utf-8");
  const hasSchemaValidation = source.includes("jq empty") || source.includes("not valid JSON");
  results.push({
    id: "S4-01",
    description: "tasks.json schema validated before launch",
    pass: hasSchemaValidation,
    detail: hasSchemaValidation ? void 0 : "No JSON validation found in source"
  });
  const hasSafeMode = source.includes("safeMode") && source.includes("maxParallelAgents");
  results.push({
    id: "S4-02",
    description: "safeMode limits parallel agent count",
    pass: hasSafeMode,
    detail: hasSafeMode ? void 0 : "safeMode/maxParallelAgents logic not found"
  });
  const hasGuardPhase = source.includes("guard tests") || source.includes("Phase 3b");
  results.push({
    id: "S4-03",
    description: "Guard tests run after agents complete",
    pass: hasGuardPhase,
    detail: hasGuardPhase ? void 0 : "No guard test phase found in source"
  });
  const blocksAutoPR = source.includes("AUTO_PR=false") && (source.includes("GUARD_P0_FAIL") || source.includes("CRITICAL"));
  results.push({
    id: "S4-04",
    description: "P0 guard failure blocks auto-PR",
    pass: blocksAutoPR,
    detail: blocksAutoPR ? void 0 : "AUTO_PR blocking on guard failure not found"
  });
  const hasPrdInjection = source.includes("prd-resolver") || source.includes("PRD");
  results.push({
    id: "S4-05",
    description: "PRD injection into agent prompts",
    pass: hasPrdInjection,
    detail: hasPrdInjection ? void 0 : "No PRD injection found in orchestrator"
  });
  const hasAgentTimeout = source.includes("AGENT_TIMEOUT") && (source.includes("timeout") || source.includes("_timeout_cmd"));
  results.push({
    id: "S4-06",
    description: "Agent execution has timeout enforcement",
    pass: hasAgentTimeout,
    detail: hasAgentTimeout ? void 0 : "No agent timeout logic found"
  });
  return results;
}

// src/audit/checks/s5-autopilot.ts
import { readFileSync as readFileSync6, existsSync as existsSync7 } from "node:fs";
import { resolve as resolve8 } from "node:path";
function checkAutopilot(projectRoot) {
  const results = [];
  const outerPath = resolve8(projectRoot, "scripts/autopilot.sh");
  const innerPath = resolve8(projectRoot, "scripts/autopilot-inner.sh");
  if (!existsSync7(outerPath) || !existsSync7(innerPath)) {
    return [{
      id: "S5-00",
      description: "autopilot.sh and autopilot-inner.sh exist",
      pass: false,
      detail: `Missing: ${[!existsSync7(outerPath) && "autopilot.sh", !existsSync7(innerPath) && "autopilot-inner.sh"].filter(Boolean).join(", ")}`
    }];
  }
  const outerSource = readFileSync6(outerPath, "utf-8");
  const innerSource = readFileSync6(innerPath, "utf-8");
  const hasPrdInjection = innerSource.includes("prd-resolver") || innerSource.includes("PRD");
  results.push({
    id: "S5-01",
    description: "PRD injection in autopilot-inner.sh",
    pass: hasPrdInjection,
    detail: hasPrdInjection ? void 0 : "No PRD resolver invocation found"
  });
  const hasGuardTests = innerSource.includes("guard") && innerSource.includes("run-tests.sh");
  results.push({
    id: "S5-02",
    description: "Guard tests run before autopilot completion",
    pass: hasGuardTests,
    detail: hasGuardTests ? void 0 : "No guard test invocation found in autopilot-inner.sh"
  });
  const hasSafeMode = outerSource.includes("safeMode") || outerSource.includes("safe-mode");
  results.push({
    id: "S5-03",
    description: "safeMode limits autopilot retries",
    pass: hasSafeMode,
    detail: hasSafeMode ? void 0 : "No safeMode logic found in autopilot.sh"
  });
  const hasP0Stop = innerSource.includes("P0") && innerSource.includes("exit 1");
  results.push({
    id: "S5-04",
    description: "P0 guard failure stops autopilot (exit 1)",
    pass: hasP0Stop,
    detail: hasP0Stop ? void 0 : "No P0 hard-fail exit found in autopilot-inner.sh"
  });
  const hasRateLimit = innerSource.includes("rate") && (innerSource.includes("backoff") || innerSource.includes("BACKOFF"));
  results.push({
    id: "S5-05",
    description: "Rate limit detection with exponential backoff",
    pass: hasRateLimit,
    detail: hasRateLimit ? void 0 : "No rate limit/backoff logic found"
  });
  return results;
}

// src/audit/checks/s6-dangerous-ops.ts
import { resolve as resolve9 } from "node:path";
function checkDangerousOps(projectRoot) {
  const results = [];
  const hook = resolve9(projectRoot, "hooks/skill-activation-prompt.sh");
  if (!isExecutable(hook)) {
    return [{
      id: "S6-00",
      description: "skill-activation-prompt.sh is executable",
      pass: false,
      detail: "Hook not found or not executable"
    }];
  }
  {
    const { exitCode } = runCommand(`echo "deploy: push to production" | "${hook}"`, { cwd: projectRoot });
    results.push({
      id: "S6-01",
      description: "deploy: keyword blocked (exit 2)",
      pass: exitCode === 2,
      detail: exitCode !== 2 ? `exit ${exitCode}, expected 2` : void 0
    });
  }
  {
    const { exitCode } = runCommand(`echo "db: reset database" | "${hook}"`, { cwd: projectRoot });
    results.push({
      id: "S6-02",
      description: "db: keyword blocked (exit 2)",
      pass: exitCode === 2,
      detail: exitCode !== 2 ? `exit ${exitCode}, expected 2` : void 0
    });
  }
  {
    const { exitCode } = runCommand(`echo "secure: audit secrets" | "${hook}"`, { cwd: projectRoot });
    results.push({
      id: "S6-03",
      description: "secure: keyword blocked (exit 2)",
      pass: exitCode === 2,
      detail: exitCode !== 2 ? `exit ${exitCode}, expected 2` : void 0
    });
  }
  const configPath = resolve9(projectRoot, "harness.config.json");
  const config = readJsonFile(configPath);
  if (config === null) {
    results.push({
      id: "S6-04",
      description: "requireConfirmation includes deploy/db/secure",
      pass: false,
      detail: "harness.config.json not found or invalid"
    });
  } else {
    const required = config.restrictions?.requireConfirmation ?? [];
    const hasDeploy = required.some((k) => k.includes("deploy"));
    const hasDb = required.some((k) => k.includes("db"));
    const hasSecure = required.some((k) => k.includes("secure"));
    const allPresent = hasDeploy && hasDb && hasSecure;
    const missing = [];
    if (!hasDeploy) missing.push("deploy");
    if (!hasDb) missing.push("db");
    if (!hasSecure) missing.push("secure");
    results.push({
      id: "S6-04",
      description: "requireConfirmation includes deploy/db/secure",
      pass: allPresent,
      detail: allPresent ? void 0 : `Missing: ${missing.join(", ")}`
    });
  }
  return results;
}

// src/audit/checks/s7-learning-loop.ts
import { existsSync as existsSync8 } from "node:fs";
import { resolve as resolve10 } from "node:path";
function checkLearningLoop(projectRoot) {
  const results = [];
  const summaryHook = resolve10(projectRoot, "hooks/on-stop-summary.sh");
  const reflectHook = resolve10(projectRoot, "hooks/auto-reflect.sh");
  results.push({
    id: "S7-01",
    description: "on-stop-summary.sh is executable",
    pass: isExecutable(summaryHook),
    detail: isExecutable(summaryHook) ? void 0 : "Hook not found or not executable"
  });
  results.push({
    id: "S7-02",
    description: "auto-reflect.sh is executable",
    pass: isExecutable(reflectHook),
    detail: isExecutable(reflectHook) ? void 0 : "Hook not found or not executable"
  });
  if (isExecutable(summaryHook)) {
    const { exitCode } = runCommand(`"${summaryHook}"`, { cwd: projectRoot });
    const progressExists = existsSync8(resolve10(projectRoot, "memory/PROGRESS.md"));
    results.push({
      id: "S7-03",
      description: "on-stop-summary.sh writes PROGRESS.md",
      pass: exitCode === 0 && progressExists,
      detail: exitCode !== 0 ? `Hook exit code: ${exitCode}` : !progressExists ? "PROGRESS.md not found after hook execution" : void 0
    });
  } else {
    results.push({
      id: "S7-03",
      description: "on-stop-summary.sh writes PROGRESS.md",
      pass: false,
      skip: true,
      detail: "Hook not executable"
    });
  }
  if (isExecutable(reflectHook)) {
    const { exitCode } = runCommand(`"${reflectHook}"`, { cwd: projectRoot });
    const patternsExists = existsSync8(resolve10(projectRoot, "memory/PATTERNS.md"));
    results.push({
      id: "S7-04",
      description: "auto-reflect.sh writes PATTERNS.md",
      pass: exitCode === 0 && patternsExists,
      detail: exitCode !== 0 ? `Hook exit code: ${exitCode}` : !patternsExists ? "PATTERNS.md not found after hook execution" : void 0
    });
  } else {
    results.push({
      id: "S7-04",
      description: "auto-reflect.sh writes PATTERNS.md",
      pass: false,
      skip: true,
      detail: "Hook not executable"
    });
  }
  return results;
}

// src/commands/audit-run.ts
function auditRun(projectRoot) {
  const checks = [
    { section: "S0: Bootstrap & Prerequisites", fn: checkBootstrap },
    { section: "S1: Magic Keyword & Skill Activation", fn: checkMagicKeyword },
    { section: "S2: Protected Path Enforcement", fn: checkProtectedPaths },
    { section: "S3: Auto-Fix Loop Integrity", fn: checkAutoFixLoop },
    { section: "S4: Orchestrator Guard Integration", fn: checkOrchestrator },
    { section: "S5: Autopilot Safety", fn: checkAutopilot },
    { section: "S6: Dangerous Operation Blocking", fn: checkDangerousOps },
    { section: "S7: Learning Loop / Memory", fn: checkLearningLoop }
  ];
  return runAudit(projectRoot, checks);
}

// src/commands/bash-guard.ts
import { readFileSync as readFileSync8 } from "node:fs";

// src/core/rules.ts
import { readFileSync as readFileSync7, existsSync as existsSync9 } from "node:fs";
import { resolve as resolve11 } from "node:path";
var INLINE_PROTECTED = [".harness/", "harness/", "hooks/", "architecture/", ".claude/", "CLAUDE.md"];
function loadProtectedPathsTxt(projectRoot) {
  const txtPath = resolve11(projectRoot, "architecture/protected-paths.txt");
  if (!existsSync9(txtPath)) return INLINE_PROTECTED;
  try {
    return readFileSync7(txtPath, "utf-8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  } catch {
    return INLINE_PROTECTED;
  }
}
function loadRules(projectRoot) {
  const rulesPath = resolve11(projectRoot, "architecture/rules.json");
  if (!existsSync9(rulesPath)) return null;
  const raw = readFileSync7(rulesPath, "utf-8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`[rules] Warning: ${rulesPath} is not valid JSON \u2014 using defaults.
`);
    return null;
  }
}
function getProtectedPaths(rules, projectRoot) {
  if (rules?.protected_paths?.paths && rules.protected_paths.paths.length > 0) {
    return rules.protected_paths.paths;
  }
  if (projectRoot) {
    return loadProtectedPathsTxt(projectRoot);
  }
  return INLINE_PROTECTED;
}
function getAllowedEdits(rules) {
  return rules?.exceptions?.allowed_core_edits ?? [];
}

// src/core/paths.ts
import { realpathSync, lstatSync } from "node:fs";
import { relative } from "node:path";
function normalizePath(inputPath) {
  const isAbsolute = inputPath.startsWith("/");
  const parts = inputPath.split("/").filter(Boolean);
  const normalized = [];
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
function resolveSymlinks(filePath) {
  try {
    const stat = lstatSync(filePath);
    if (stat.isSymbolicLink()) {
      return realpathSync(filePath);
    }
  } catch {
  }
  return filePath;
}
function computeRelativePath(filePath, projectRoot) {
  const canonicalFile = normalizePath(resolveSymlinks(filePath));
  const canonicalRoot = normalizePath(projectRoot);
  if (canonicalFile.startsWith(canonicalRoot + "/")) {
    return canonicalFile.slice(canonicalRoot.length + 1);
  }
  return relative(canonicalRoot, canonicalFile);
}
function isProtectedPath(relPath, rules, projectRoot) {
  const protectedPaths = getProtectedPaths(rules, projectRoot);
  const allowedEdits = getAllowedEdits(rules);
  for (const protectedPrefix of protectedPaths) {
    if (relPath.startsWith(protectedPrefix) || relPath === protectedPrefix.replace(/\/$/, "")) {
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

// src/commands/bash-guard.ts
var DANGEROUS_NETWORK_PATTERNS = [
  { pattern: /\bcurl\b.*\|\s*(?:bash|sh|zsh)\b/, label: "curl pipe to shell" },
  { pattern: /\bwget\b.*\|\s*(?:bash|sh|zsh)\b/, label: "wget pipe to shell" },
  { pattern: /\bcurl\b.*\|\s*sudo\b/, label: "curl pipe to sudo" },
  { pattern: /\bwget\b.*\|\s*sudo\b/, label: "wget pipe to sudo" }
];
var PACKAGE_INSTALL_PATTERNS = [
  { pattern: /\bcurl\s+-[^\s]*[oO]\b/, label: "curl download to file" },
  { pattern: /\bwget\s/, label: "wget download" },
  { pattern: /\bnpm\s+(install|i|ci|add)\b/, label: "npm install" },
  { pattern: /\byarn\s+(add|install)\b/, label: "yarn add/install" },
  { pattern: /\bpnpm\s+(add|install|i)\b/, label: "pnpm add/install" },
  { pattern: /\bpip3?\s+install\b/, label: "pip install" },
  { pattern: /\bgem\s+install\b/, label: "gem install" },
  { pattern: /\bcargo\s+install\b/, label: "cargo install" },
  { pattern: /\bgo\s+install\b/, label: "go install" },
  { pattern: /\bapt(?:-get)?\s+install\b/, label: "apt install" },
  { pattern: /\bbrew\s+install\b/, label: "brew install" }
];
var WRITE_PATTERNS = [
  // Redirect operators
  />>?\s*(?:"([^"]+)"|'([^']+)'|(\S+))/g,
  // tee command
  /\btee\s+(?:-a\s+)?(?:"([^"]+)"|'([^']+)'|(\S+))/g,
  // cp/mv to destination
  /\b(?:cp|mv)\s+.*?\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*$/gm,
  // rm
  /\brm\s+(?:-[rf]+\s+)*(?:"([^"]+)"|'([^']+)'|(\S+))/g,
  // sed -i (in-place edit)
  /\bsed\s+(?:-[^i]*)?-i[^-]*?\s+.*?\s+(?:"([^"]+)"|'([^']+)'|(\S+))/g,
  // chmod/chown
  /\b(?:chmod|chown)\s+\S+\s+(?:"([^"]+)"|'([^']+)'|(\S+))/g,
  // echo/printf to file
  /\b(?:echo|printf)\s+.*?>\s*(?:"([^"]+)"|'([^']+)'|(\S+))/g,
  // cat heredoc to file
  /\bcat\s+.*?>\s*(?:"([^"]+)"|'([^']+)'|(\S+))/g
];
function checkNetworkCommand(command2) {
  for (const { pattern, label } of DANGEROUS_NETWORK_PATTERNS) {
    if (pattern.test(command2)) {
      return { action: "block", label };
    }
  }
  for (const { pattern, label } of PACKAGE_INSTALL_PATTERNS) {
    if (pattern.test(command2)) {
      return { action: "warn", label };
    }
  }
  return null;
}
function extractTargetPaths(command2) {
  const paths = [];
  for (const pattern of WRITE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(command2)) !== null) {
      for (let i = 1; i < match.length; i++) {
        if (match[i]) {
          paths.push(match[i]);
          break;
        }
      }
    }
  }
  return paths;
}
function bashGuard(projectRoot) {
  let input = "";
  try {
    input = readFileSync8(0, "utf-8");
  } catch {
    process.stderr.write("[bash-guard] ERROR: Could not read stdin. Blocking for safety.\n");
    return 2;
  }
  if (!input.trim()) return 0;
  let command2 = "";
  try {
    const parsed = JSON.parse(input);
    const raw = parsed?.tool_input?.command;
    command2 = typeof raw === "string" ? raw : "";
  } catch {
    process.stderr.write("[bash-guard] ERROR: Could not parse stdin JSON. Blocking for safety.\n");
    return 2;
  }
  if (!command2) return 0;
  const networkResult = checkNetworkCommand(command2);
  if (networkResult?.action === "block") {
    process.stderr.write(
      `
[bash-guard] BLOCKED: Dangerous network command detected.
  Type: ${networkResult.label}
  Command: ${command2.slice(0, 120)}

  Downloading and executing arbitrary code is blocked by default.
  If this command is safe, approve it via Claude Code's permission prompt.

`
    );
    return 2;
  }
  if (networkResult?.action === "warn") {
    process.stderr.write(
      `[bash-guard] NOTE: Package install detected (${networkResult.label}).
  Command: ${command2.slice(0, 120)}
`
    );
  }
  const rules = loadRules(projectRoot);
  const targetPaths = extractTargetPaths(command2);
  if (targetPaths.length === 0 && command2.length > 0) {
    const hasWriteHint = /[>|]|tee|cp\s|mv\s|rm\s|sed\s+-i|chmod|chown/.test(command2);
    if (hasWriteHint) {
      process.stderr.write(
        `[bash-guard] WARN: Write-like command detected but no targets extracted.
  Command: ${command2.slice(0, 120)}
`
      );
    }
  }
  for (const rawPath of targetPaths) {
    if (/\$[\{a-zA-Z_]/.test(rawPath)) {
      process.stderr.write(
        `[bash-guard] WARN: Write target contains shell variable (cannot verify statically).
  Target: ${rawPath}
  Command: ${command2.slice(0, 120)}
`
      );
      continue;
    }
    const normalized = normalizePath(rawPath);
    const result = isProtectedPath(normalized, rules);
    if (result.blocked) {
      process.stderr.write(
        `
[bash-guard] BLOCKED: Command writes to protected path.
  Path: ${rawPath}
  Matched: ${result.matchedPrefix}
  Command: ${command2.slice(0, 120)}

  Protected paths cannot be modified by agents.
  If this edit is needed, a human must update architecture/rules.json.

`
      );
      return 2;
    }
  }
  return 0;
}

// src/commands/config-validate.ts
function configValidate(projectRoot, configPath) {
  const config = loadConfig(projectRoot, configPath);
  if (config === null) {
    console.error("[config] ERROR: Config file not found or invalid JSON.");
    console.error("  What to do: Run ./harness/project-init.sh --detect . to generate one.");
    return 1;
  }
  const { errors, warnings } = validateConfig(config);
  for (const err of errors) {
    console.log(`[config] ERROR: ${err}`);
  }
  for (const warn of warnings) {
    console.log(`[config] WARNING: ${warn}`);
  }
  console.log("");
  if (errors.length > 0) {
    console.log(`[config] FAILED: ${errors.length} error(s), ${warnings.length} warning(s)`);
    return 1;
  } else if (warnings.length > 0) {
    console.log(`[config] PASSED with ${warnings.length} warning(s)`);
    return 2;
  } else {
    console.log("[config] PASSED: Config is valid");
    return 0;
  }
}

// src/commands/path-check.ts
import { resolve as resolve13 } from "node:path";
var LAYERS = ["types", "config", "repo", "service", "runtime", "ui"];
function pathCheck(projectRoot, filePath) {
  const rules = loadRules(projectRoot);
  const repoRoot = findRepoRoot(projectRoot);
  const absolutePath = filePath.startsWith("/") ? filePath : resolve13(repoRoot, filePath);
  const relPath = computeRelativePath(absolutePath, repoRoot);
  const result = isProtectedPath(relPath, rules);
  if (result.blocked) {
    console.log(`[arch-check] BLOCKED: '${relPath}' is a protected harness path.`);
    if (result.matchedPrefix) {
      console.log(`[arch-check] Matched: ${result.matchedPrefix}`);
    }
    console.log(
      `[arch-check] To allow edits, a human must add this path to 'exceptions.allowed_core_edits' in architecture/rules.json`
    );
    return 2;
  }
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

// src/commands/skill-detect.ts
import { readFileSync as readFileSync10, existsSync as existsSync11, mkdirSync, appendFileSync } from "node:fs";
import { resolve as resolve15 } from "node:path";
import { execSync as execSync2 } from "node:child_process";

// src/core/skills.ts
import { readFileSync as readFileSync9, existsSync as existsSync10 } from "node:fs";
import { resolve as resolve14 } from "node:path";
function loadSkills(projectRoot) {
  const rulesPath = resolve14(projectRoot, "skills/skill-rules.json");
  if (!existsSync10(rulesPath)) return null;
  const raw = readFileSync9(rulesPath, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function findMagicKeyword(prompt, skills) {
  const promptLower = prompt.toLowerCase();
  for (const [skillName, skill] of Object.entries(skills.skills)) {
    if (!skill.magicKeyword) continue;
    const kw = skill.magicKeyword;
    const regex = new RegExp(`(^|\\s)${escapeRegex(kw)}\\s`, "i");
    if (regex.test(promptLower)) {
      return { keyword: kw, skillName, skill };
    }
  }
  return null;
}
function matchKeywords(prompt, skills) {
  const promptLower = prompt.toLowerCase();
  const matches = [];
  for (const [skillName, skill] of Object.entries(skills.skills)) {
    const keywords = skill.promptTriggers?.keywords ?? [];
    let matchCount = 0;
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${escapeRegex(kw)}\\b`, "i");
      if (regex.test(promptLower)) {
        matchCount++;
      }
    }
    if (matchCount >= 2) {
      matches.push({ skillName, priority: skill.priority, matchCount });
    }
  }
  return matches.sort((a, b) => b.matchCount - a.matchCount);
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// src/commands/skill-detect.ts
function skillDetect(projectRoot, prompt) {
  let userPrompt = prompt ?? "";
  if (!userPrompt) {
    try {
      const input = readFileSync10(0, "utf-8");
      try {
        const parsed = JSON.parse(input);
        userPrompt = parsed?.prompt ?? input;
      } catch {
        userPrompt = input;
      }
    } catch {
      return 0;
    }
  }
  if (!userPrompt.trim()) return 0;
  const skills = loadSkills(projectRoot);
  if (!skills) return 0;
  const magicMatch = findMagicKeyword(userPrompt, skills);
  if (magicMatch) {
    console.log("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
    console.log(`MAGIC KEYWORD: ${magicMatch.keyword} \u2192 ${magicMatch.skillName}`);
    console.log("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
    const config = loadConfig(projectRoot);
    const requireConfirm = config?.restrictions?.requireConfirmation ?? [];
    const keywordBase = magicMatch.keyword.replace(/:$/, "");
    if (requireConfirm.some((rc) => rc === keywordBase || rc.startsWith(keywordBase + ":"))) {
      console.log("");
      console.log(`\u26D4 CONFIRMATION REQUIRED: '${magicMatch.keyword}' can cause irreversible changes.`);
      console.log("");
      console.log("This prompt is BLOCKED until the user explicitly confirms.");
      console.log("You MUST:");
      console.log("  1. Explain to the user what will happen");
      console.log("  2. Ask the user to confirm");
      console.log("  3. Only after the user says yes, resubmit the prompt");
      console.log("");
      console.log("Do NOT proceed without explicit user confirmation.");
      console.log("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
      return 2;
    }
    const prdResolver = resolve15(projectRoot, "harness/prd-resolver.sh");
    if (existsSync11(prdResolver)) {
      try {
        const prdLine = execSync2(`"${prdResolver}" --inject`, {
          cwd: projectRoot,
          encoding: "utf-8",
          timeout: 5e3
        }).trim();
        if (prdLine) {
          console.log("");
          console.log(`SOURCE OF TRUTH: Read CLAUDE.md first. ${prdLine}`);
        }
      } catch {
        console.log("");
        console.log("WARNING: PRD injection failed.");
      }
    }
    const { skill } = magicMatch;
    const skillFilePath = resolve15(projectRoot, skill.file);
    if (!existsSync11(skillFilePath)) {
      console.log("");
      console.log(`WARNING: Skill file not found: ${skill.file}`);
    } else if (skill.type === "agent") {
      console.log(`ACTION: Load agent instructions from ${skill.file}`);
    } else if (skill.type === "mode") {
      console.log(`ACTION: Follow orchestration mode in ${skill.file}`);
    } else {
      console.log(`ACTION: Reference ${skill.file}`);
    }
    if (skill.enforcement === "require") {
      console.log("");
      console.log(`BINDING: You MUST use ${magicMatch.skillName} (${skill.file}). This is a hard requirement.`);
      console.log("Do NOT choose a different agent or skip these instructions.");
    }
    if (keywordBase === "fix" || keywordBase === "test") {
      injectMemory(projectRoot, "MISTAKES.md", "KNOWN BUG PATTERNS");
    }
    if (keywordBase === "arch" || keywordBase === "refactor") {
      injectMemory(projectRoot, "DECISIONS.md", "ARCHITECTURE DECISIONS");
    }
    logActivation(projectRoot, magicMatch.skillName, magicMatch.keyword, userPrompt);
    console.log("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
    return 0;
  }
  const matches = matchKeywords(userPrompt, skills);
  if (matches.length > 0) {
    console.log("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
    console.log("SKILL SUGGESTIONS:");
    for (const m of matches) {
      console.log(`  \u2192 ${m.skillName}(${m.priority})`);
    }
    console.log("");
    console.log("TIP: Use magic keywords for instant activation (e.g., fix: test: build:)");
    console.log("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
  }
  const promptLower = userPrompt.toLowerCase();
  if (/\b(bug|fix|error|fail|broken)\b/i.test(promptLower)) {
    injectMemory(projectRoot, "MISTAKES.md", "KNOWN BUG PATTERNS");
  }
  if (/\b(decide|choice|approach|which|how to)\b/i.test(promptLower)) {
    injectMemory(projectRoot, "DECISIONS.md", "ARCHITECTURE DECISIONS");
  }
  return 0;
}
function injectMemory(projectRoot, filename, header) {
  const filePath = resolve15(projectRoot, "memory", filename);
  if (!existsSync11(filePath)) return;
  const content = readFileSync10(filePath, "utf-8").trim();
  if (!content) return;
  const lines = content.split("\n");
  const tail = lines.slice(-30).join("\n");
  console.log("");
  console.log(`${header} (from memory/${filename}):`);
  console.log("---");
  console.log(tail);
  console.log("---");
}
function logActivation(projectRoot, skillName, keyword, prompt) {
  try {
    const logDir = resolve15(projectRoot, ".worktree-logs");
    mkdirSync(logDir, { recursive: true });
    const logFile = resolve15(logDir, "skill-activations.log");
    const snippet = prompt.slice(0, 80).replace(/\n/g, " ");
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d+Z$/, "Z");
    appendFileSync(logFile, `${timestamp}|${skillName}|${keyword}|${snippet}
`);
  } catch {
  }
}

// src/index.ts
var args = process.argv.slice(2);
var command = args[0];
var subcommand = args[1];
function printHelp() {
  console.log(`
harness-cli \u2014 Deterministic CLI for claude-harness

Commands:
  audit run              Run deterministic audit checklist (46 checks)
  config validate        Validate harness.config.json
  path check <file>      Check if a file path is protected
  bash-guard             Guard Bash tool (reads stdin JSON, exit 0/2)
  skill detect <prompt>  Detect magic keywords and suggest skills
  --help, -h             Show this help

Examples:
  npx tsx src/index.ts audit run
  npx tsx src/index.ts path check harness/core.sh
`);
}
function main() {
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }
  const projectRoot = findProjectRoot();
  switch (command) {
    case "audit": {
      if (subcommand === "run") {
        const exitCode = auditRun(projectRoot);
        process.exit(exitCode);
      }
      console.error(`Unknown audit subcommand: ${subcommand}`);
      process.exit(1);
      break;
    }
    case "config": {
      if (subcommand === "validate") {
        const exitCode = configValidate(projectRoot, args[2]);
        process.exit(exitCode);
      }
      console.error(`Unknown config subcommand: ${subcommand}`);
      process.exit(1);
      break;
    }
    case "bash-guard": {
      const exitCode = bashGuard(projectRoot);
      process.exit(exitCode);
      break;
    }
    case "path": {
      if (subcommand === "check" && args[2]) {
        const exitCode = pathCheck(projectRoot, args[2]);
        process.exit(exitCode);
      }
      console.error("Usage: harness-cli path check <file>");
      process.exit(1);
      break;
    }
    case "skill": {
      if (subcommand === "detect") {
        const exitCode = skillDetect(projectRoot, args[2]);
        process.exit(exitCode);
      }
      console.error("Usage: harness-cli skill detect [prompt]");
      process.exit(1);
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}
main();
