import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export interface Skill {
  type: "agent" | "mode" | "skill";
  enforcement: "require" | "suggest";
  priority: "high" | "medium" | "low";
  file: string;
  magicKeyword?: string;
  promptTriggers?: {
    keywords?: string[];
    intentPatterns?: string[];
  };
}

export interface SkillRules {
  version: string;
  skills: Record<string, Skill>;
}

export function loadSkills(projectRoot: string): SkillRules | null {
  const rulesPath = resolve(projectRoot, "skills/skill-rules.json");
  if (!existsSync(rulesPath)) return null;

  const raw = readFileSync(rulesPath, "utf-8");
  try {
    return JSON.parse(raw) as SkillRules;
  } catch {
    return null;
  }
}

/**
 * Detect a magic keyword (e.g. "build:", "fix:") at the start of or within a prompt.
 * Returns the matched keyword and its associated skill name.
 */
export function findMagicKeyword(
  prompt: string,
  skills: SkillRules,
): { keyword: string; skillName: string; skill: Skill } | null {
  const promptLower = prompt.toLowerCase();

  for (const [skillName, skill] of Object.entries(skills.skills)) {
    if (!skill.magicKeyword) continue;
    const kw = skill.magicKeyword;
    // Match keyword at start or after whitespace
    const regex = new RegExp(`(^|\\s)${escapeRegex(kw)}\\s`, "i");
    if (regex.test(promptLower)) {
      return { keyword: kw, skillName, skill };
    }
  }

  return null;
}

/**
 * Match prompt against keyword triggers (requires 2+ matches to reduce false positives).
 */
export function matchKeywords(
  prompt: string,
  skills: SkillRules,
): Array<{ skillName: string; priority: string; matchCount: number }> {
  const promptLower = prompt.toLowerCase();
  const matches: Array<{ skillName: string; priority: string; matchCount: number }> = [];

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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
