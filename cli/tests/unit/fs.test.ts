import { describe, it, expect } from "vitest";
import { readJsonFile, isExecutable, listFiles, findProjectRoot } from "../../src/utils/fs.ts";
import { writeFileSync, mkdirSync, rmSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `harness-fs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("readJsonFile", () => {
  it("reads valid JSON file", () => {
    const dir = makeTmpDir();
    const file = join(dir, "test.json");
    writeFileSync(file, '{"key": "value"}');
    expect(readJsonFile<{ key: string }>(file)).toEqual({ key: "value" });
    rmSync(dir, { recursive: true });
  });

  it("returns null for non-existent file", () => {
    expect(readJsonFile("/tmp/does-not-exist-abcdef.json")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    const dir = makeTmpDir();
    const file = join(dir, "bad.json");
    writeFileSync(file, "not json {{{");
    expect(readJsonFile(file)).toBeNull();
    rmSync(dir, { recursive: true });
  });
});

describe("isExecutable", () => {
  it("returns true for executable file", () => {
    const dir = makeTmpDir();
    const file = join(dir, "exec.sh");
    writeFileSync(file, "#!/bin/bash\necho hi");
    chmodSync(file, 0o755);
    expect(isExecutable(file)).toBe(true);
    rmSync(dir, { recursive: true });
  });

  it("returns false for non-executable file", () => {
    const dir = makeTmpDir();
    const file = join(dir, "noexec.txt");
    writeFileSync(file, "hello");
    chmodSync(file, 0o644);
    expect(isExecutable(file)).toBe(false);
    rmSync(dir, { recursive: true });
  });

  it("returns false for non-existent file", () => {
    expect(isExecutable("/tmp/does-not-exist-xyz")).toBe(false);
  });
});

describe("listFiles", () => {
  it("lists all files in directory", () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, "a.txt"), "");
    writeFileSync(join(dir, "b.json"), "");
    mkdirSync(join(dir, "subdir"));
    const files = listFiles(dir);
    expect(files).toHaveLength(2);
    expect(files.some((f) => f.endsWith("a.txt"))).toBe(true);
    expect(files.some((f) => f.endsWith("b.json"))).toBe(true);
    rmSync(dir, { recursive: true });
  });

  it("filters files by pattern", () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, "a.txt"), "");
    writeFileSync(join(dir, "b.json"), "");
    const files = listFiles(dir, /\.json$/);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("b.json");
    rmSync(dir, { recursive: true });
  });

  it("returns empty array for non-existent directory", () => {
    expect(listFiles("/tmp/does-not-exist-dir-xyz")).toEqual([]);
  });
});

describe("findProjectRoot", () => {
  it("finds project root when CLAUDE.md and harness.config.json exist", () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, "CLAUDE.md"), "# Test");
    writeFileSync(join(dir, "harness.config.json"), "{}");
    const subdir = join(dir, "a", "b", "c");
    mkdirSync(subdir, { recursive: true });
    const root = findProjectRoot(subdir);
    expect(root).toBe(dir);
    rmSync(dir, { recursive: true });
  });

  it("returns cwd when no project root found", () => {
    const dir = makeTmpDir();
    const root = findProjectRoot(dir);
    expect(root).toBe(process.cwd());
    rmSync(dir, { recursive: true });
  });
});
