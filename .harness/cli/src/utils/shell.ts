import { execSync, spawnSync } from "node:child_process";

/**
 * Check if a command exists in PATH.
 * Input is validated to prevent shell injection.
 */
export function commandExists(cmd: string): boolean {
  if (!/^[a-zA-Z0-9._\/-]+$/.test(cmd)) {
    return false; // Invalid command name — reject silently
  }
  try {
    // Use spawnSync to avoid shell interpretation
    const result = spawnSync("sh", ["-c", `command -v "${cmd}"`], {
      stdio: "pipe",
      timeout: 5000,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Run a shell command and return { exitCode, stdout, stderr }.
 * Captures both stdout and stderr on success and failure.
 */
export function runCommand(
  cmd: string,
  options?: { cwd?: string; stdin?: string; timeout?: number },
): { exitCode: number; stdout: string; stderr: string } {
  try {
    const result = spawnSync("sh", ["-c", cmd], {
      cwd: options?.cwd,
      input: options?.stdin,
      timeout: options?.timeout ?? 30_000,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    });
    return {
      exitCode: result.status ?? 0,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return {
      exitCode: e.status ?? 1,
      stdout: (e.stdout as string) ?? "",
      stderr: (e.stderr as string) ?? "",
    };
  }
}
