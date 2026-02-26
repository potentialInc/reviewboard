#!/usr/bin/env node
/**
 * harness-cli — Deterministic CLI for claude-harness
 *
 * Usage:
 *   harness-cli audit run          Run 46-check deterministic audit
 *   harness-cli config validate    Validate harness.config.json
 *   harness-cli path check <file>  Check if file is protected
 *   harness-cli --help             Show help
 */

import { findProjectRoot } from "./utils/fs.ts";
import { auditRun } from "./commands/audit-run.ts";
import { bashGuard } from "./commands/bash-guard.ts";
import { configValidate } from "./commands/config-validate.ts";
import { pathCheck } from "./commands/path-check.ts";
import { skillDetect } from "./commands/skill-detect.ts";

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

function printHelp(): void {
  console.log(`
harness-cli — Deterministic CLI for claude-harness

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

function main(): void {
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
