import { describe, it, expect } from "vitest";
import { validateConfig } from "../../src/core/config.ts";

describe("validateConfig", () => {
  const validConfig = {
    version: "1.0",
    safeMode: true,
    restrictions: {
      maxParallelAgents: 5,
      autoFixRetries: 3,
      requireConfirmation: ["deploy", "db", "secure"],
    },
  };

  // ── Happy path ──

  it("accepts a valid config with no errors or warnings", () => {
    const result = validateConfig(validConfig);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  // ── Top-level type validation ──

  it("rejects non-object config", () => {
    const result = validateConfig("not an object");
    expect(result.errors).toContainEqual("Config must be a JSON object");
  });

  it("rejects null config", () => {
    const result = validateConfig(null);
    expect(result.errors).toContainEqual("Config must be a JSON object");
  });

  it("reports missing required top-level keys", () => {
    const result = validateConfig({});
    expect(result.errors).toContainEqual("Missing required key: 'version'");
    expect(result.errors).toContainEqual("Missing required key: 'safeMode'");
    expect(result.errors).toContainEqual("Missing required key: 'restrictions'");
  });

  it("rejects wrong type for version", () => {
    const result = validateConfig({ ...validConfig, version: 123 });
    expect(result.errors.some((e) => e.includes("'version' must be a string"))).toBe(true);
  });

  it("rejects wrong type for safeMode", () => {
    const result = validateConfig({ ...validConfig, safeMode: "yes" });
    expect(result.errors.some((e) => e.includes("'safeMode' must be a boolean"))).toBe(true);
  });

  // ── Restriction sub-key validation ──

  it("reports missing restriction sub-keys", () => {
    const result = validateConfig({ ...validConfig, restrictions: {} });
    expect(result.errors).toContainEqual("Missing required key: 'restrictions.maxParallelAgents'");
    expect(result.errors).toContainEqual("Missing required key: 'restrictions.autoFixRetries'");
    expect(result.errors).toContainEqual("Missing required key: 'restrictions.requireConfirmation'");
  });

  it("rejects wrong type for maxParallelAgents", () => {
    const cfg = { ...validConfig, restrictions: { ...validConfig.restrictions, maxParallelAgents: "five" } };
    const result = validateConfig(cfg);
    expect(result.errors.some((e) => e.includes("maxParallelAgents' must be a number"))).toBe(true);
  });

  it("rejects wrong type for autoFixRetries", () => {
    const cfg = { ...validConfig, restrictions: { ...validConfig.restrictions, autoFixRetries: true } };
    const result = validateConfig(cfg);
    expect(result.errors.some((e) => e.includes("autoFixRetries' must be a number"))).toBe(true);
  });

  // ── Range validation ──

  it("rejects maxParallelAgents below 1", () => {
    const cfg = { ...validConfig, restrictions: { ...validConfig.restrictions, maxParallelAgents: 0 } };
    const result = validateConfig(cfg);
    expect(result.errors.some((e) => e.includes("between 1 and 100"))).toBe(true);
  });

  it("rejects maxParallelAgents above 100", () => {
    const cfg = { ...validConfig, restrictions: { ...validConfig.restrictions, maxParallelAgents: 999 } };
    const result = validateConfig(cfg);
    expect(result.errors.some((e) => e.includes("between 1 and 100"))).toBe(true);
  });

  it("rejects autoFixRetries below 0", () => {
    const cfg = { ...validConfig, restrictions: { ...validConfig.restrictions, autoFixRetries: -1 } };
    const result = validateConfig(cfg);
    expect(result.errors.some((e) => e.includes("between 0 and 20"))).toBe(true);
  });

  it("rejects autoFixRetries above 20", () => {
    const cfg = { ...validConfig, restrictions: { ...validConfig.restrictions, autoFixRetries: 50 } };
    const result = validateConfig(cfg);
    expect(result.errors.some((e) => e.includes("between 0 and 20"))).toBe(true);
  });

  it("accepts boundary values (1 and 100, 0 and 20)", () => {
    const cfg = { ...validConfig, restrictions: { ...validConfig.restrictions, maxParallelAgents: 1, autoFixRetries: 0 } };
    expect(validateConfig(cfg).errors).toHaveLength(0);

    const cfg2 = { ...validConfig, restrictions: { ...validConfig.restrictions, maxParallelAgents: 100, autoFixRetries: 20 } };
    expect(validateConfig(cfg2).errors).toHaveLength(0);
  });

  // ── requireConfirmation validation ──

  it("rejects non-array requireConfirmation", () => {
    const cfg = { ...validConfig, restrictions: { ...validConfig.restrictions, requireConfirmation: "deploy" } };
    const result = validateConfig(cfg);
    expect(result.errors.some((e) => e.includes("must be an array"))).toBe(true);
  });

  it("warns on empty requireConfirmation", () => {
    const cfg = { ...validConfig, restrictions: { ...validConfig.restrictions, requireConfirmation: [] } };
    const result = validateConfig(cfg);
    expect(result.warnings.some((w) => w.includes("empty"))).toBe(true);
  });

  it("rejects non-string elements in requireConfirmation", () => {
    const cfg = { ...validConfig, restrictions: { ...validConfig.restrictions, requireConfirmation: [42] } };
    const result = validateConfig(cfg);
    expect(result.errors.some((e) => e.includes("elements must be strings"))).toBe(true);
  });

  it("warns on unknown requireConfirmation values", () => {
    const cfg = { ...validConfig, restrictions: { ...validConfig.restrictions, requireConfirmation: ["unknown_op"] } };
    const result = validateConfig(cfg);
    expect(result.warnings.some((w) => w.includes("Unknown requireConfirmation value"))).toBe(true);
  });

  it("accepts all known requireConfirmation values", () => {
    const allKnown = ["deploy", "deploy:preview", "deploy:promote", "db", "db:migrate", "db:seed", "db:reset", "secure"];
    const cfg = { ...validConfig, restrictions: { ...validConfig.restrictions, requireConfirmation: allKnown } };
    const result = validateConfig(cfg);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  // ── Unknown key detection ──

  it("warns on unknown top-level keys", () => {
    const result = validateConfig({ ...validConfig, unknownKey: true });
    expect(result.warnings.some((w) => w.includes("Unknown top-level key: 'unknownKey'"))).toBe(true);
  });

  it("warns on unknown restriction keys", () => {
    const cfg = { ...validConfig, restrictions: { ...validConfig.restrictions, typoKey: 5 } };
    const result = validateConfig(cfg);
    expect(result.warnings.some((w) => w.includes("Unknown restriction key: 'typoKey'"))).toBe(true);
  });

  it("does not warn on known optional key _protectedPathsSource", () => {
    const result = validateConfig({ ...validConfig, _protectedPathsSource: "rules.json" });
    expect(result.warnings.filter((w) => w.includes("_protectedPathsSource"))).toHaveLength(0);
  });
});
