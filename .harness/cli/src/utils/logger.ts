const COLORS = {
  red: "\x1b[0;31m",
  green: "\x1b[0;32m",
  yellow: "\x1b[1;33m",
  cyan: "\x1b[0;36m",
  reset: "\x1b[0m",
} as const;

export function logPass(id: string, message: string): void {
  const padded = message.padEnd(45);
  console.log(`  ${id}  ${padded}${COLORS.green}PASS${COLORS.reset}`);
}

export function logFail(id: string, message: string, detail?: string): void {
  const padded = message.padEnd(45);
  const detailStr = detail ? `  ${detail}` : "";
  console.log(`  ${id}  ${padded}${COLORS.red}FAIL${COLORS.reset}${detailStr}`);
}

export function logSkip(id: string, message: string, reason?: string): void {
  const padded = message.padEnd(45);
  const reasonStr = reason ? `  (${reason})` : "";
  console.log(`  ${id}  ${padded}${COLORS.yellow}SKIP${COLORS.reset}${reasonStr}`);
}

export function logSection(title: string): void {
  console.log(`\n${COLORS.cyan}=== ${title} ===${COLORS.reset}`);
}

export function logSummary(pass: number, fail: number, skip: number): void {
  const total = pass + fail + skip;
  console.log(`\n${"─".repeat(50)}`);
  console.log(`  RESULT: ${pass}/${total} PASS, ${fail} FAIL${skip > 0 ? `, ${skip} SKIP` : ""}`);
  if (fail === 0) {
    console.log(`  ${COLORS.green}All checks passed.${COLORS.reset}`);
  } else {
    console.log(`  ${COLORS.red}${fail} check(s) failed. Fix before proceeding.${COLORS.reset}`);
  }
}
