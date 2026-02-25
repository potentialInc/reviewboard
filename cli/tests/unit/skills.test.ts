import { describe, it, expect } from "vitest";
import { findMagicKeyword, matchKeywords } from "../../src/core/skills.ts";
import type { SkillRules } from "../../src/core/skills.ts";

const mockSkills: SkillRules = {
  version: "1.0",
  skills: {
    "feature-builder": {
      type: "agent",
      enforcement: "suggest",
      priority: "high",
      file: "agents/feature-builder.md",
      magicKeyword: "build:",
      promptTriggers: {
        keywords: ["feature", "implement", "create", "add", "build"],
      },
    },
    "bug-fixer": {
      type: "agent",
      enforcement: "suggest",
      priority: "high",
      file: "agents/bug-fixer.md",
      magicKeyword: "fix:",
      promptTriggers: {
        keywords: ["fix", "bug", "error", "crash", "broken"],
      },
    },
    "deploy-manager": {
      type: "skill",
      enforcement: "require",
      priority: "high",
      file: "skills/deploy.md",
      magicKeyword: "deploy:",
      promptTriggers: {
        keywords: ["deploy", "release", "production", "staging"],
      },
    },
    "test-runner": {
      type: "agent",
      enforcement: "suggest",
      priority: "medium",
      file: "agents/test-runner.md",
      magicKeyword: "test:",
      promptTriggers: {
        keywords: ["test", "spec", "coverage", "assertion"],
      },
    },
  },
};

describe("findMagicKeyword", () => {
  it("detects build: at start of prompt", () => {
    const result = findMagicKeyword("build: add login page", mockSkills);
    expect(result).not.toBeNull();
    expect(result!.keyword).toBe("build:");
    expect(result!.skillName).toBe("feature-builder");
  });

  it("detects fix: at start of prompt", () => {
    const result = findMagicKeyword("fix: auth crash on login", mockSkills);
    expect(result).not.toBeNull();
    expect(result!.keyword).toBe("fix:");
    expect(result!.skillName).toBe("bug-fixer");
  });

  it("detects deploy: at start", () => {
    const result = findMagicKeyword("deploy: push to staging", mockSkills);
    expect(result).not.toBeNull();
    expect(result!.keyword).toBe("deploy:");
  });

  it("detects test: keyword", () => {
    const result = findMagicKeyword("test: add unit tests for auth", mockSkills);
    expect(result).not.toBeNull();
    expect(result!.keyword).toBe("test:");
  });

  it("is case insensitive", () => {
    const result = findMagicKeyword("BUILD: uppercase prompt", mockSkills);
    expect(result).not.toBeNull();
    expect(result!.keyword).toBe("build:");
  });

  it("detects keyword after whitespace", () => {
    const result = findMagicKeyword("please build: add a new feature", mockSkills);
    expect(result).not.toBeNull();
    expect(result!.keyword).toBe("build:");
  });

  it("returns null for no keyword", () => {
    const result = findMagicKeyword("just a regular prompt without keywords", mockSkills);
    expect(result).toBeNull();
  });

  it("returns null for partial keyword matches", () => {
    const result = findMagicKeyword("builder pattern implementation", mockSkills);
    expect(result).toBeNull();
  });

  it("returns null for keyword without colon", () => {
    const result = findMagicKeyword("build the login page", mockSkills);
    expect(result).toBeNull();
  });

  it("returns null for empty prompt", () => {
    const result = findMagicKeyword("", mockSkills);
    expect(result).toBeNull();
  });

  it("handles skills with no magicKeyword", () => {
    const skills: SkillRules = {
      version: "1.0",
      skills: {
        "no-keyword": {
          type: "agent",
          enforcement: "suggest",
          priority: "low",
          file: "agents/noop.md",
        },
      },
    };
    const result = findMagicKeyword("build: something", skills);
    expect(result).toBeNull();
  });
});

describe("matchKeywords", () => {
  it("matches 2+ keywords for feature-builder", () => {
    const result = matchKeywords("implement a new feature for the app", mockSkills);
    expect(result.length).toBeGreaterThan(0);
    const fb = result.find((r) => r.skillName === "feature-builder");
    expect(fb).toBeDefined();
    expect(fb!.matchCount).toBeGreaterThanOrEqual(2);
  });

  it("matches 2+ keywords for bug-fixer", () => {
    const result = matchKeywords("fix the crash error in auth module", mockSkills);
    const bf = result.find((r) => r.skillName === "bug-fixer");
    expect(bf).toBeDefined();
    expect(bf!.matchCount).toBeGreaterThanOrEqual(2);
  });

  it("does not match with only 1 keyword", () => {
    const result = matchKeywords("implement something", mockSkills);
    const fb = result.find((r) => r.skillName === "feature-builder");
    expect(fb).toBeUndefined();
  });

  it("returns empty array for unrelated prompt", () => {
    const result = matchKeywords("hello world", mockSkills);
    expect(result).toEqual([]);
  });

  it("sorts by match count descending", () => {
    const result = matchKeywords(
      "fix the bug error crash in broken module",
      mockSkills,
    );
    if (result.length >= 2) {
      expect(result[0].matchCount).toBeGreaterThanOrEqual(result[1].matchCount);
    }
  });

  it("is case insensitive", () => {
    const result = matchKeywords("IMPLEMENT a new FEATURE", mockSkills);
    const fb = result.find((r) => r.skillName === "feature-builder");
    expect(fb).toBeDefined();
  });
});
