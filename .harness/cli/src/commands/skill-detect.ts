import { readFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { loadSkills, findMagicKeyword, matchKeywords } from "../core/skills.ts";
import { loadConfig } from "../core/config.ts";

/**
 * Detect skills from a prompt (magic keywords + keyword matching).
 * Emits context injection text to stdout (agent binding, PRD, memory).
 * Exit codes: 0 = allowed, 2 = blocked (confirmation required or jq missing).
 */
export function skillDetect(projectRoot: string, prompt?: string): number {
  // Read prompt from stdin if not provided as argument
  let userPrompt = prompt ?? "";
  if (!userPrompt) {
    try {
      const input = readFileSync(0, "utf-8");
      // Try JSON parse first (Claude Code sends {"prompt":"..."})
      try {
        const parsed = JSON.parse(input);
        userPrompt = parsed?.prompt ?? input;
      } catch {
        userPrompt = input;
      }
    } catch {
      return 0; // No input — allow through
    }
  }

  if (!userPrompt.trim()) return 0;

  const skills = loadSkills(projectRoot);
  if (!skills) return 0; // No skill rules — allow through

  // ── Magic Keyword Detection ──
  const magicMatch = findMagicKeyword(userPrompt, skills);

  if (magicMatch) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`MAGIC KEYWORD: ${magicMatch.keyword} → ${magicMatch.skillName}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Check if confirmation required
    const config = loadConfig(projectRoot);
    const requireConfirm = config?.restrictions?.requireConfirmation ?? [];
    const keywordBase = magicMatch.keyword.replace(/:$/, "");

    if (requireConfirm.some((rc) => rc === keywordBase || rc.startsWith(keywordBase + ":"))) {
      console.log("");
      console.log(`⛔ CONFIRMATION REQUIRED: '${magicMatch.keyword}' can cause irreversible changes.`);
      console.log("");
      console.log("This prompt is BLOCKED until the user explicitly confirms.");
      console.log("You MUST:");
      console.log("  1. Explain to the user what will happen");
      console.log("  2. Ask the user to confirm");
      console.log("  3. Only after the user says yes, resubmit the prompt");
      console.log("");
      console.log("Do NOT proceed without explicit user confirmation.");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      return 2;
    }

    // PRD injection
    const prdResolver = resolve(projectRoot, "harness/prd-resolver.sh");
    if (existsSync(prdResolver)) {
      try {
        const prdLine = execSync(`"${prdResolver}" --inject`, {
          cwd: projectRoot,
          encoding: "utf-8",
          timeout: 5000,
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

    // Skill binding
    const { skill } = magicMatch;
    const skillFilePath = resolve(projectRoot, skill.file);

    if (!existsSync(skillFilePath)) {
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

    // Memory injection
    if (keywordBase === "fix" || keywordBase === "test") {
      injectMemory(projectRoot, "MISTAKES.md", "KNOWN BUG PATTERNS");
    }
    if (keywordBase === "arch" || keywordBase === "refactor") {
      injectMemory(projectRoot, "DECISIONS.md", "ARCHITECTURE DECISIONS");
    }

    // Log activation
    logActivation(projectRoot, magicMatch.skillName, magicMatch.keyword, userPrompt);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    return 0;
  }

  // ── Keyword Matching (2+ threshold) ──
  const matches = matchKeywords(userPrompt, skills);
  if (matches.length > 0) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("SKILL SUGGESTIONS:");
    for (const m of matches) {
      console.log(`  → ${m.skillName}(${m.priority})`);
    }
    console.log("");
    console.log("TIP: Use magic keywords for instant activation (e.g., fix: test: build:)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }

  // Context injection for bug-related prompts
  const promptLower = userPrompt.toLowerCase();
  if (/\b(bug|fix|error|fail|broken)\b/i.test(promptLower)) {
    injectMemory(projectRoot, "MISTAKES.md", "KNOWN BUG PATTERNS");
  }
  if (/\b(decide|choice|approach|which|how to)\b/i.test(promptLower)) {
    injectMemory(projectRoot, "DECISIONS.md", "ARCHITECTURE DECISIONS");
  }

  return 0;
}

function injectMemory(projectRoot: string, filename: string, header: string): void {
  const filePath = resolve(projectRoot, "memory", filename);
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf-8").trim();
  if (!content) return;

  const lines = content.split("\n");
  const tail = lines.slice(-30).join("\n");

  console.log("");
  console.log(`${header} (from memory/${filename}):`);
  console.log("---");
  console.log(tail);
  console.log("---");
}

function logActivation(projectRoot: string, skillName: string, keyword: string, prompt: string): void {
  try {
    const logDir = resolve(projectRoot, ".worktree-logs");
    mkdirSync(logDir, { recursive: true });
    const logFile = resolve(logDir, "skill-activations.log");
    const snippet = prompt.slice(0, 80).replace(/\n/g, " ");
    const timestamp = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    appendFileSync(logFile, `${timestamp}|${skillName}|${keyword}|${snippet}\n`);
  } catch {
    // Non-critical — skip logging
  }
}
