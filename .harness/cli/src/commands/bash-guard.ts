import { readFileSync } from "node:fs";
import { loadRules } from "../core/rules.ts";
import { normalizePath, isProtectedPath } from "../core/paths.ts";

/**
 * Bash tool guard — prevents dangerous Bash commands.
 *
 * Reads JSON from stdin: {"tool_input":{"command":"..."}}
 * Three-tier analysis:
 *   1. Network: blocks arbitrary download+execute (curl|bash), warns on package installs
 *   2. Write:   blocks writes to protected paths
 * Exit 0 = allow, exit 2 = block.
 */

// ── Dangerous network patterns: BLOCK (exit 2) ──
// Arbitrary code download + execution — supply-chain attack vector
const DANGEROUS_NETWORK_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bcurl\b.*\|\s*(?:bash|sh|zsh)\b/, label: "curl pipe to shell" },
  { pattern: /\bwget\b.*\|\s*(?:bash|sh|zsh)\b/, label: "wget pipe to shell" },
  { pattern: /\bcurl\b.*\|\s*sudo\b/, label: "curl pipe to sudo" },
  { pattern: /\bwget\b.*\|\s*sudo\b/, label: "wget pipe to sudo" },
];

// ── Package install patterns: WARN (exit 0 + stderr) ──
// Necessary for development but worth logging for visibility
const PACKAGE_INSTALL_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
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
  { pattern: /\bbrew\s+install\b/, label: "brew install" },
];

// ── Write patterns: BLOCK if targeting protected paths ──
// Patterns that write to files
const WRITE_PATTERNS = [
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
  /\bcat\s+.*?>\s*(?:"([^"]+)"|'([^']+)'|(\S+))/g,
];

type NetworkResult =
  | { action: "block"; label: string }
  | { action: "warn"; label: string }
  | null;

function checkNetworkCommand(command: string): NetworkResult {
  for (const { pattern, label } of DANGEROUS_NETWORK_PATTERNS) {
    if (pattern.test(command)) {
      return { action: "block", label };
    }
  }
  for (const { pattern, label } of PACKAGE_INSTALL_PATTERNS) {
    if (pattern.test(command)) {
      return { action: "warn", label };
    }
  }
  return null;
}

function extractTargetPaths(command: string): string[] {
  const paths: string[] = [];

  for (const pattern of WRITE_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(command)) !== null) {
      // Find the first non-undefined capture group
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

export function bashGuard(projectRoot: string): number {
  // Read JSON from stdin
  let input = "";
  try {
    input = readFileSync(0, "utf-8"); // fd 0 = stdin
  } catch {
    // No stdin or read error — block (fail-closed)
    process.stderr.write("[bash-guard] ERROR: Could not read stdin. Blocking for safety.\n");
    return 2;
  }

  if (!input.trim()) return 0;

  let command = "";
  try {
    const parsed = JSON.parse(input);
    const raw = parsed?.tool_input?.command;
    command = typeof raw === "string" ? raw : "";
  } catch {
    // Unparseable input — block (fail-closed)
    process.stderr.write("[bash-guard] ERROR: Could not parse stdin JSON. Blocking for safety.\n");
    return 2;
  }

  if (!command) return 0;

  // ── Network command check (independent of write-path analysis) ──
  const networkResult = checkNetworkCommand(command);
  if (networkResult?.action === "block") {
    process.stderr.write(
      `\n[bash-guard] BLOCKED: Dangerous network command detected.\n` +
      `  Type: ${networkResult.label}\n` +
      `  Command: ${command.slice(0, 120)}\n` +
      `\n  Downloading and executing arbitrary code is blocked by default.\n` +
      `  If this command is safe, approve it via Claude Code's permission prompt.\n\n`,
    );
    return 2;
  }
  if (networkResult?.action === "warn") {
    process.stderr.write(
      `[bash-guard] NOTE: Package install detected (${networkResult.label}).\n` +
      `  Command: ${command.slice(0, 120)}\n`,
    );
    // Allow — package installs are necessary for development
  }

  const rules = loadRules(projectRoot);
  const targetPaths = extractTargetPaths(command);

  if (targetPaths.length === 0 && command.length > 0) {
    // No write targets detected — log for visibility but allow (fail-open)
    const hasWriteHint = /[>|]|tee|cp\s|mv\s|rm\s|sed\s+-i|chmod|chown/.test(command);
    if (hasWriteHint) {
      process.stderr.write(
        `[bash-guard] WARN: Write-like command detected but no targets extracted.\n` +
        `  Command: ${command.slice(0, 120)}\n`,
      );
    }
  }

  for (const rawPath of targetPaths) {
    // Shell variable references can't be statically resolved — warn for visibility
    if (/\$[\{a-zA-Z_]/.test(rawPath)) {
      process.stderr.write(
        `[bash-guard] WARN: Write target contains shell variable (cannot verify statically).\n` +
        `  Target: ${rawPath}\n` +
        `  Command: ${command.slice(0, 120)}\n`,
      );
      continue;
    }

    const normalized = normalizePath(rawPath);
    const result = isProtectedPath(normalized, rules);

    if (result.blocked) {
      process.stderr.write(
        `\n[bash-guard] BLOCKED: Command writes to protected path.\n` +
        `  Path: ${rawPath}\n` +
        `  Matched: ${result.matchedPrefix}\n` +
        `  Command: ${command.slice(0, 120)}\n` +
        `\n  Protected paths cannot be modified by agents.\n` +
        `  If this edit is needed, a human must update architecture/rules.json.\n\n`,
      );
      return 2;
    }
  }

  return 0;
}
