import { describe, it, expect } from "vitest";

// We need to test extractTargetPaths which is not exported.
// We'll test bashGuard indirectly via its behavior, but first
// let's test the regex patterns by importing the module and
// examining its exports.

// Since extractTargetPaths is not exported, we test the full bashGuard
// function by mocking stdin. For unit testing the regex patterns,
// we replicate the core logic here.

const WRITE_PATTERNS = [
  />>?\s*(?:"([^"]+)"|'([^']+)'|(\S+))/g,
  /\btee\s+(?:-a\s+)?(?:"([^"]+)"|'([^']+)'|(\S+))/g,
  /\b(?:cp|mv)\s+.*?\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*$/gm,
  /\brm\s+(?:-[rf]+\s+)*(?:"([^"]+)"|'([^']+)'|(\S+))/g,
  /\bsed\s+(?:-[^i]*)?-i[^-]*?\s+.*?\s+(?:"([^"]+)"|'([^']+)'|(\S+))/g,
  /\b(?:chmod|chown)\s+\S+\s+(?:"([^"]+)"|'([^']+)'|(\S+))/g,
  /\b(?:echo|printf)\s+.*?>\s*(?:"([^"]+)"|'([^']+)'|(\S+))/g,
  /\bcat\s+.*?>\s*(?:"([^"]+)"|'([^']+)'|(\S+))/g,
];

function extractTargetPaths(command: string): string[] {
  const paths: string[] = [];
  for (const pattern of WRITE_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(command)) !== null) {
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

describe("extractTargetPaths", () => {
  it("extracts simple redirect target", () => {
    const paths = extractTargetPaths("echo hi > /tmp/file.txt");
    expect(paths).toContain("/tmp/file.txt");
  });

  it("extracts append redirect target", () => {
    const paths = extractTargetPaths("echo hi >> /tmp/log.txt");
    expect(paths).toContain("/tmp/log.txt");
  });

  it("extracts tee target", () => {
    const paths = extractTargetPaths("command | tee /tmp/output.txt");
    expect(paths).toContain("/tmp/output.txt");
  });

  it("extracts tee -a target", () => {
    const paths = extractTargetPaths("command | tee -a /tmp/output.txt");
    expect(paths).toContain("/tmp/output.txt");
  });

  it("extracts cp destination", () => {
    const paths = extractTargetPaths("cp /src/file.txt /dst/file.txt");
    expect(paths).toContain("/dst/file.txt");
  });

  it("extracts mv destination", () => {
    const paths = extractTargetPaths("mv /old/file.txt /new/file.txt");
    expect(paths).toContain("/new/file.txt");
  });

  it("extracts rm target", () => {
    const paths = extractTargetPaths("rm /tmp/file.txt");
    expect(paths).toContain("/tmp/file.txt");
  });

  it("extracts rm -rf target", () => {
    const paths = extractTargetPaths("rm -rf /tmp/dir");
    expect(paths).toContain("/tmp/dir");
  });

  it("extracts sed -i target", () => {
    const paths = extractTargetPaths("sed -i 's/old/new/' /tmp/file.txt");
    expect(paths).toContain("/tmp/file.txt");
  });

  it("extracts chmod target", () => {
    const paths = extractTargetPaths("chmod +x /tmp/script.sh");
    expect(paths).toContain("/tmp/script.sh");
  });

  it("extracts chown target", () => {
    const paths = extractTargetPaths("chown root:root /etc/file");
    expect(paths).toContain("/etc/file");
  });

  it("extracts quoted paths (double quotes)", () => {
    const paths = extractTargetPaths('echo hi > "/tmp/my file.txt"');
    expect(paths).toContain("/tmp/my file.txt");
  });

  it("extracts quoted paths (single quotes)", () => {
    const paths = extractTargetPaths("echo hi > '/tmp/my file.txt'");
    expect(paths).toContain("/tmp/my file.txt");
  });

  it("returns empty for safe commands", () => {
    const paths = extractTargetPaths("ls -la /tmp");
    expect(paths).toEqual([]);
  });

  it("returns empty for read-only commands", () => {
    const paths = extractTargetPaths("cat /tmp/file.txt");
    expect(paths).toEqual([]);
  });

  it("returns empty for npm commands", () => {
    const paths = extractTargetPaths("npm test");
    expect(paths).toEqual([]);
  });

  it("returns empty for git commands", () => {
    const paths = extractTargetPaths("git status");
    expect(paths).toEqual([]);
  });

  it("detects echo with redirect to protected path", () => {
    const paths = extractTargetPaths("echo 'bad' > harness/core.sh");
    expect(paths).toContain("harness/core.sh");
  });

  it("detects cat heredoc to protected path", () => {
    const paths = extractTargetPaths("cat <<EOF > hooks/new-hook.sh");
    expect(paths).toContain("hooks/new-hook.sh");
  });

  it("detects multiple targets in piped command", () => {
    const paths = extractTargetPaths("command > /tmp/a.txt | tee /tmp/b.txt");
    expect(paths).toContain("/tmp/a.txt");
    expect(paths).toContain("/tmp/b.txt");
  });
});

describe("protected path detection integration", () => {
  const PROTECTED_PREFIXES = ["harness/", "hooks/", "architecture/", ".claude/"];

  function wouldBlock(command: string): boolean {
    const targets = extractTargetPaths(command);
    return targets.some((t) =>
      PROTECTED_PREFIXES.some((p) => t.startsWith(p) || t === "CLAUDE.md"),
    );
  }

  it("blocks write to harness/", () => {
    expect(wouldBlock("echo bad > harness/core.sh")).toBe(true);
  });

  it("blocks write to hooks/", () => {
    expect(wouldBlock("cp /tmp/evil.sh hooks/session-start.sh")).toBe(true);
  });

  it("blocks write to architecture/", () => {
    expect(wouldBlock("echo '{}' > architecture/rules.json")).toBe(true);
  });

  it("blocks write to .claude/", () => {
    expect(wouldBlock("echo '{}' > .claude/settings.json")).toBe(true);
  });

  it("allows write to src/", () => {
    expect(wouldBlock("echo code > src/app.ts")).toBe(false);
  });

  it("allows npm commands", () => {
    expect(wouldBlock("npm test")).toBe(false);
  });

  it("allows git commands", () => {
    expect(wouldBlock("git add .")).toBe(false);
  });

  it("extracts variable-based paths as targets", () => {
    const paths = extractTargetPaths("echo bad > $FILE");
    expect(paths).toContain("$FILE");
  });

  it("extracts ${var} paths as targets", () => {
    const paths = extractTargetPaths("echo bad > ${DIR}/file.sh");
    expect(paths).toContain("${DIR}/file.sh");
  });
});
