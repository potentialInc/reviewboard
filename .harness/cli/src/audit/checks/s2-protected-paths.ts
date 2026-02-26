import { resolve } from "node:path";
import type { CheckResult } from "../runner.ts";
import { runCommand } from "../../utils/shell.ts";
import { isExecutable, findRepoRoot } from "../../utils/fs.ts";

/**
 * S2: Protected path enforcement checks.
 * Tests pre-edit-arch-check.sh with various paths and expects correct exit codes.
 */
export function checkProtectedPaths(projectRoot: string): CheckResult[] {
  const results: CheckResult[] = [];
  const hook = resolve(projectRoot, "hooks/pre-edit-arch-check.sh");
  const repoRoot = findRepoRoot(projectRoot);

  if (!isExecutable(hook)) {
    return [{
      id: "S2-00",
      description: "pre-edit-arch-check.sh is executable",
      pass: false,
      detail: "Hook not found or not executable",
    }];
  }

  // Helper: run the hook and check exit code
  function testPath(id: string, desc: string, testPath: string, expectedExit: number, root?: string): CheckResult {
    const base = root ?? projectRoot;
    const fullPath = testPath.startsWith("/") ? testPath : resolve(base, testPath);
    const { exitCode } = runCommand(`"${hook}" "${fullPath}"`, { cwd: projectRoot });
    return {
      id,
      description: desc,
      pass: exitCode === expectedExit,
      detail: exitCode !== expectedExit ? `exit ${exitCode}, expected ${expectedExit}` : undefined,
    };
  }

  // S2-01~03: Core protected paths blocked (relative to harness root)
  results.push(testPath("S2-01", "harness/ edit blocked (exit 2)", "auto-fix-loop.sh", 2));
  results.push(testPath("S2-02", "hooks/ edit blocked (exit 2)", "hooks/session-start.sh", 2));
  results.push(testPath("S2-03", "architecture/ edit blocked (exit 2)", "architecture/rules.json", 2));

  // S2-04~05: .claude/ and CLAUDE.md blocked (at repo root)
  results.push(testPath("S2-04", ".claude/ edit blocked (exit 2)", ".claude/settings.json", 2, repoRoot));
  results.push(testPath("S2-05", "CLAUDE.md edit blocked (exit 2)", "CLAUDE.md", 2, repoRoot));

  // S2-06~07: Path traversal blocked (from repo root)
  results.push(testPath("S2-06", "Path traversal (../) blocked", "app/../.harness/auto-fix-loop.sh", 2, repoRoot));
  results.push(testPath("S2-07", "Deep traversal (../../) blocked", "app/src/../../.harness/hooks/hook.sh", 2, repoRoot));

  // S2-08: Non-protected path allowed (at repo root)
  results.push(testPath("S2-08", "Non-protected path allowed (exit 0)", "app/src/service/foo.ts", 0, repoRoot));

  return results;
}
