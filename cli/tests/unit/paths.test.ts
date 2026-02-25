import { describe, it, expect } from "vitest";
import { normalizePath, computeRelativePath, isProtectedPath } from "../../src/core/paths.ts";
import type { ArchRules } from "../../src/core/rules.ts";

describe("normalizePath", () => {
  it("resolves . segments", () => {
    expect(normalizePath("/a/./b/c")).toBe("/a/b/c");
  });

  it("resolves .. segments", () => {
    expect(normalizePath("/a/b/../c")).toBe("/a/c");
  });

  it("resolves multiple .. segments", () => {
    expect(normalizePath("/a/b/c/../../d")).toBe("/a/d");
  });

  it("handles leading ..", () => {
    expect(normalizePath("/a/../..")).toBe("/");
  });

  it("removes duplicate slashes", () => {
    expect(normalizePath("/a//b///c")).toBe("/a/b/c");
  });

  it("preserves absolute paths", () => {
    const result = normalizePath("/usr/local/bin");
    expect(result).toBe("/usr/local/bin");
  });

  it("handles relative paths", () => {
    const result = normalizePath("src/core/paths.ts");
    expect(result).toBe("src/core/paths.ts");
  });

  it("handles empty path components", () => {
    expect(normalizePath("/a/b/")).toBe("/a/b");
  });

  it("handles root path", () => {
    expect(normalizePath("/")).toBe("/");
  });
});

describe("computeRelativePath", () => {
  it("strips project root prefix", () => {
    const result = computeRelativePath("/project/src/app.ts", "/project");
    expect(result).toBe("src/app.ts");
  });

  it("handles nested paths", () => {
    const result = computeRelativePath("/project/harness/core.sh", "/project");
    expect(result).toBe("harness/core.sh");
  });

  it("handles paths with . and ..", () => {
    const result = computeRelativePath("/project/src/../harness/core.sh", "/project");
    expect(result).toBe("harness/core.sh");
  });
});

describe("isProtectedPath", () => {
  const mockRules: ArchRules = {
    layers: { order: [], direction: "top-down" },
    protected_paths: {
      paths: ["harness/", "hooks/", "architecture/", ".claude/", "CLAUDE.md"],
      enforcement: "block",
      message: "test",
    },
    exceptions: {
      allowed_core_edits: [],
      allowed_cross_layer: [],
      allowed_large_files: [],
      allowed_naming_exceptions: [],
    },
  };

  it("blocks harness/ paths", () => {
    const result = isProtectedPath("harness/core.sh", mockRules);
    expect(result.blocked).toBe(true);
    expect(result.matchedPrefix).toBe("harness/");
  });

  it("blocks hooks/ paths", () => {
    const result = isProtectedPath("hooks/pre-edit.sh", mockRules);
    expect(result.blocked).toBe(true);
  });

  it("blocks architecture/ paths", () => {
    const result = isProtectedPath("architecture/rules.json", mockRules);
    expect(result.blocked).toBe(true);
  });

  it("blocks .claude/ paths", () => {
    const result = isProtectedPath(".claude/settings.json", mockRules);
    expect(result.blocked).toBe(true);
  });

  it("blocks CLAUDE.md exactly", () => {
    const result = isProtectedPath("CLAUDE.md", mockRules);
    expect(result.blocked).toBe(true);
  });

  it("allows non-protected paths", () => {
    const result = isProtectedPath("src/app.ts", mockRules);
    expect(result.blocked).toBe(false);
    expect(result.matchedPrefix).toBeNull();
  });

  it("allows cli/ paths", () => {
    const result = isProtectedPath("cli/src/index.ts", mockRules);
    expect(result.blocked).toBe(false);
  });

  it("allows tests/ paths", () => {
    const result = isProtectedPath("tests/smoke/test-foo.sh", mockRules);
    expect(result.blocked).toBe(false);
  });

  it("respects allowed_core_edits exceptions", () => {
    const rulesWithException: ArchRules = {
      ...mockRules,
      exceptions: {
        ...mockRules.exceptions,
        allowed_core_edits: ["harness/worktree-manager.sh"],
      },
    };
    const result = isProtectedPath("harness/worktree-manager.sh", rulesWithException);
    expect(result.blocked).toBe(false);
    expect(result.isAllowed).toBe(true);
  });

  it("blocks harness/ even with partial exception", () => {
    const rulesWithException: ArchRules = {
      ...mockRules,
      exceptions: {
        ...mockRules.exceptions,
        allowed_core_edits: ["harness/worktree-manager.sh"],
      },
    };
    const result = isProtectedPath("harness/orchestrator.sh", rulesWithException);
    expect(result.blocked).toBe(true);
  });

  it("handles null rules by using fallback", () => {
    const result = isProtectedPath("harness/core.sh", null);
    expect(result.blocked).toBe(true);
  });
});
