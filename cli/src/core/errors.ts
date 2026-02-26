import { EXIT, type ExitCode } from "./exit-codes.ts";

export class HarnessError extends Error {
  constructor(
    message: string,
    public readonly exitCode: ExitCode,
    public readonly whatToDo?: string,
  ) {
    super(message);
    this.name = "HarnessError";
  }
}

export class ConfigError extends HarnessError {
  constructor(message: string, whatToDo?: string) {
    super(message, EXIT.HARD_FAIL, whatToDo);
    this.name = "ConfigError";
  }
}

export class PathBlockedError extends HarnessError {
  constructor(path: string, protectedPrefix: string) {
    super(
      `BLOCKED: '${path}' is a protected harness path.`,
      EXIT.BLOCK,
      `Protected paths: ${protectedPrefix}. To allow edits, a human must add this path to 'exceptions.allowed_core_edits' in architecture/rules.json`,
    );
    this.name = "PathBlockedError";
  }
}

export class ConfirmationRequiredError extends HarnessError {
  constructor(keyword: string) {
    super(
      `CONFIRMATION REQUIRED: '${keyword}' can cause irreversible changes.`,
      EXIT.BLOCK,
      "Explain to the user what will happen, ask for confirmation, then retry.",
    );
    this.name = "ConfirmationRequiredError";
  }
}
