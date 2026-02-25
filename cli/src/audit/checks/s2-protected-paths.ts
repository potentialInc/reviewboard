import { resolve } from "node:path";
import type { CheckResult } from "../runner.ts";
import { runCommand } from "../../utils/shell.ts";
import { isExecutable } from "../../utils/fs.ts";

/**
 * S2: Protected path enforcement checks.
 * Tests pre-edit-arch-check.sh with various paths and expects correct exit codes.
 */
export function checkProtectedPaths(projectRoot: string): CheckResult[] {
  const results: CheckResult[] = [];
  const hook = resolve(projectRoot, "hooks/pre-edit-arch-check.sh");

  if (!isExecutable(hook)) {
    return [{
      id: "S2-00",
      description: "pre-edit-arch-check.sh is executable",
      pass: false,
      detail: "Hook not found or not executable",
    }];
  }

  // Helper: run the hook and check exit code
  function testPath(id: string, desc: string, testPath: string, expectedExit: number): CheckResult {
    const fullPath = testPath.startsWith("/") ? testPath : resolve(projectRoot, testPath);
    const { exitCode } = runCommand(`"${hook}" "${fullPath}"`, { cwd: projectRoot });
    return {
      id,
      description: desc,
      pass: exitCode === expectedExit,
      detail: exitCode !== expectedExit ? `exit ${exitCode}, expected ${expectedExit}` : undefined,
    };
  }

  // S2-01~03: Core protected paths blocked
  results.push(testPath("S2-01", "harness/ edit blocked (exit 2)", "harness/auto-fix-loop.sh", 2));
  results.push(testPath("S2-02", "hooks/ edit blocked (exit 2)", "hooks/session-start.sh", 2));
  results.push(testPath("S2-03", "architecture/ edit blocked (exit 2)", "architecture/rules.json", 2));

  // S2-04~05: .claude/ and CLAUDE.md blocked
  results.push(testPath("S2-04", ".claude/ edit blocked (exit 2)", ".claude/settings.json", 2));
  results.push(testPath("S2-05", "CLAUDE.md edit blocked (exit 2)", "CLAUDE.md", 2));

  // S2-06~07: Path traversal blocked
  results.push(testPath("S2-06", "Path traversal (../) blocked", "src/../harness/core.sh", 2));
  results.push(testPath("S2-07", "Deep traversal (../../) blocked", "src/types/../../hooks/hook.sh", 2));

  // S2-08: Non-protected path allowed
  results.push(testPath("S2-08", "Non-protected path allowed (exit 0)", "src/service/foo.ts", 0));

  return results;
}
