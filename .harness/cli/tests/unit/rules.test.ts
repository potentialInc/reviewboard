import { describe, it, expect } from "vitest";
import { getProtectedPaths, getAllowedEdits, getLayerOrder } from "../../src/core/rules.ts";
import type { ArchRules } from "../../src/core/rules.ts";

const INLINE_PROTECTED = ["harness/", "hooks/", "architecture/", ".claude/", "CLAUDE.md"];
const DEFAULT_LAYERS = ["types", "config", "repo", "service", "runtime", "ui"];

function makeRules(overrides?: Partial<ArchRules>): ArchRules {
  return {
    layers: { order: ["types", "config", "repo", "service", "runtime", "ui"], direction: "top-down" },
    protected_paths: { paths: ["harness/", "hooks/", "architecture/"], enforcement: "hard-fail", message: "blocked" },
    exceptions: {
      allowed_core_edits: ["cli/"],
      allowed_cross_layer: [],
      allowed_large_files: [],
      allowed_naming_exceptions: [],
    },
    ...overrides,
  };
}

describe("getProtectedPaths", () => {
  it("returns paths from rules when available", () => {
    const rules = makeRules();
    expect(getProtectedPaths(rules)).toEqual(["harness/", "hooks/", "architecture/"]);
  });

  it("returns inline protected paths when rules is null", () => {
    expect(getProtectedPaths(null)).toEqual(INLINE_PROTECTED);
  });

  it("returns inline protected paths when rules has empty paths", () => {
    const rules = makeRules({
      protected_paths: { paths: [], enforcement: "hard-fail", message: "" },
    });
    // With projectRoot undefined, falls back to INLINE_PROTECTED
    expect(getProtectedPaths(rules)).toEqual(INLINE_PROTECTED);
  });

  it("returns inline protected paths when protected_paths is missing", () => {
    const rules = { layers: { order: [], direction: "" }, exceptions: { allowed_core_edits: [], allowed_cross_layer: [], allowed_large_files: [], allowed_naming_exceptions: [] } } as ArchRules;
    expect(getProtectedPaths(rules)).toEqual(INLINE_PROTECTED);
  });
});

describe("getAllowedEdits", () => {
  it("returns allowed_core_edits from rules", () => {
    const rules = makeRules();
    expect(getAllowedEdits(rules)).toEqual(["cli/"]);
  });

  it("returns empty array when rules is null", () => {
    expect(getAllowedEdits(null)).toEqual([]);
  });

  it("returns empty array when exceptions is missing", () => {
    const rules = { layers: { order: [], direction: "" }, protected_paths: { paths: [], enforcement: "", message: "" } } as unknown as ArchRules;
    expect(getAllowedEdits(rules)).toEqual([]);
  });
});

describe("getLayerOrder", () => {
  it("returns layer order from rules", () => {
    const rules = makeRules({ layers: { order: ["a", "b", "c"], direction: "top-down" } });
    expect(getLayerOrder(rules)).toEqual(["a", "b", "c"]);
  });

  it("returns default layer order when rules is null", () => {
    expect(getLayerOrder(null)).toEqual(DEFAULT_LAYERS);
  });

  it("returns default layer order when layers is missing", () => {
    const rules = {} as unknown as ArchRules;
    expect(getLayerOrder(rules)).toEqual(DEFAULT_LAYERS);
  });
});
