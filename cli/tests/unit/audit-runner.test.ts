import { describe, it, expect } from "vitest";
import { runAudit, type CheckResult, type CheckFn } from "../../src/audit/runner.ts";

// Suppress log output during tests
const originalWrite = process.stdout.write;

describe("runAudit", () => {
  // Capture stdout to avoid noisy test output
  let output: string;
  function captureOutput() {
    output = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += chunk.toString();
      return true;
    }) as typeof process.stdout.write;
  }
  function restoreOutput() {
    process.stdout.write = originalWrite;
  }

  it("returns 0 when all checks pass", () => {
    captureOutput();
    const checks: Array<{ section: string; fn: CheckFn }> = [
      {
        section: "Test Section",
        fn: () => [
          { id: "T-01", description: "Check A", pass: true },
          { id: "T-02", description: "Check B", pass: true },
        ],
      },
    ];
    const exitCode = runAudit("/tmp", checks);
    restoreOutput();
    expect(exitCode).toBe(0);
  });

  it("returns 1 when any check fails", () => {
    captureOutput();
    const checks: Array<{ section: string; fn: CheckFn }> = [
      {
        section: "Test Section",
        fn: () => [
          { id: "T-01", description: "Pass", pass: true },
          { id: "T-02", description: "Fail", pass: false, detail: "Something broke" },
        ],
      },
    ];
    const exitCode = runAudit("/tmp", checks);
    restoreOutput();
    expect(exitCode).toBe(1);
  });

  it("handles skipped checks without counting as pass or fail", () => {
    captureOutput();
    const checks: Array<{ section: string; fn: CheckFn }> = [
      {
        section: "Test Section",
        fn: () => [
          { id: "T-01", description: "Pass", pass: true },
          { id: "T-02", description: "Skipped", pass: false, skip: true, detail: "N/A" },
        ],
      },
    ];
    const exitCode = runAudit("/tmp", checks);
    restoreOutput();
    expect(exitCode).toBe(0); // skipped checks don't count as failures
  });

  it("aggregates results across multiple sections", () => {
    captureOutput();
    const checks: Array<{ section: string; fn: CheckFn }> = [
      {
        section: "Section A",
        fn: () => [{ id: "A-01", description: "Pass A", pass: true }],
      },
      {
        section: "Section B",
        fn: () => [{ id: "B-01", description: "Fail B", pass: false }],
      },
    ];
    const exitCode = runAudit("/tmp", checks);
    restoreOutput();
    expect(exitCode).toBe(1);
  });

  it("handles empty check list", () => {
    captureOutput();
    const exitCode = runAudit("/tmp", []);
    restoreOutput();
    expect(exitCode).toBe(0);
  });

  it("handles section with no results", () => {
    captureOutput();
    const checks: Array<{ section: string; fn: CheckFn }> = [
      { section: "Empty Section", fn: () => [] },
    ];
    const exitCode = runAudit("/tmp", checks);
    restoreOutput();
    expect(exitCode).toBe(0);
  });
});
