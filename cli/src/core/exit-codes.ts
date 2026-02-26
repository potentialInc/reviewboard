/**
 * Exit code contract for claude-harness CLI.
 * These MUST match Claude Code hook semantics exactly.
 */
export const EXIT = {
  /** Success / allow action */
  OK: 0,
  /** Hard failure (P0) — stops auto-fix, blocks merge */
  HARD_FAIL: 1,
  /** Block action — PreToolUse hooks return 2 to reject the tool call */
  BLOCK: 2,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];
