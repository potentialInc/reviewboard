import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CheckResult } from "../runner.ts";
import { commandExists } from "../../utils/shell.ts";
import { isExecutable, listFiles } from "../../utils/fs.ts";
import { loadConfig, validateConfig } from "../../core/config.ts";

const CRITICAL_HOOKS = [
  "hooks/session-start.sh",
  "hooks/pre-edit-arch-check.sh",
  "hooks/pre-edit-security-check.sh",
  "hooks/skill-activation-prompt.sh",
];

export function checkBootstrap(projectRoot: string): CheckResult[] {
  const results: CheckResult[] = [];

  // S0-01: jq installed
  results.push({
    id: "S0-01",
    description: "jq installed",
    pass: commandExists("jq"),
    detail: commandExists("jq") ? undefined : "brew install jq",
  });

  // S0-02: git installed
  results.push({
    id: "S0-02",
    description: "git installed",
    pass: commandExists("git"),
    detail: commandExists("git") ? undefined : "brew install git",
  });

  // S0-03: claude CLI installed
  results.push({
    id: "S0-03",
    description: "claude CLI installed",
    pass: commandExists("claude"),
    detail: commandExists("claude") ? undefined : "https://claude.ai/download",
  });

  // S0-04: tmux installed
  results.push({
    id: "S0-04",
    description: "tmux installed",
    pass: commandExists("tmux"),
    detail: commandExists("tmux") ? undefined : "brew install tmux",
  });

  // S0-05: timeout/gtimeout installed
  const hasTimeout = commandExists("timeout") || commandExists("gtimeout");
  results.push({
    id: "S0-05",
    description: "timeout/gtimeout installed",
    pass: hasTimeout,
    detail: hasTimeout ? undefined : "brew install coreutils",
  });

  // S0-06: All hooks/*.sh are executable
  const hookDir = resolve(projectRoot, "hooks");
  const hookFiles = listFiles(hookDir, /\.sh$/);
  const nonExec = hookFiles.filter((f) => !isExecutable(f));
  results.push({
    id: "S0-06",
    description: "All hooks/*.sh are executable",
    pass: nonExec.length === 0 && hookFiles.length > 0,
    detail: nonExec.length > 0 ? `${nonExec.length} hook(s) not executable` : undefined,
  });

  // S0-07: Critical hooks wired in .claude/settings.json
  const settingsPath = resolve(projectRoot, ".claude/settings.json");
  let missingHooks: string[] = [];
  if (existsSync(settingsPath)) {
    const settingsRaw = readFileSync(settingsPath, "utf-8");
    missingHooks = CRITICAL_HOOKS.filter((h) => !settingsRaw.includes(h));
  } else {
    missingHooks = CRITICAL_HOOKS;
  }
  results.push({
    id: "S0-07",
    description: "Critical hooks wired in .claude/settings.json",
    pass: missingHooks.length === 0,
    detail: missingHooks.length > 0 ? `Missing: ${missingHooks.join(", ")}` : undefined,
  });

  // S0-08: harness.config.json passes validation
  const config = loadConfig(projectRoot);
  if (config === null) {
    results.push({
      id: "S0-08",
      description: "harness.config.json passes validation",
      pass: false,
      detail: "Config file not found",
    });
  } else {
    const validation = validateConfig(config);
    results.push({
      id: "S0-08",
      description: "harness.config.json passes validation",
      pass: validation.errors.length === 0,
      detail: validation.errors.length > 0 ? validation.errors[0] : undefined,
    });
  }

  return results;
}
