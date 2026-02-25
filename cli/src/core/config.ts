import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ConfigError } from "./errors.ts";

export interface HarnessConfig {
  version: string;
  safeMode: boolean;
  restrictions: {
    maxParallelAgents: number;
    autoFixRetries: number;
    requireConfirmation: string[];
  };
}

const REQUIRED_TOP_KEYS = ["version", "safeMode", "restrictions"] as const;
const REQUIRED_RESTRICTION_KEYS = [
  "maxParallelAgents",
  "autoFixRetries",
  "requireConfirmation",
] as const;
const KNOWN_TOP_KEYS = [
  "version",
  "safeMode",
  "restrictions",
  "_protectedPathsSource",
];
const KNOWN_RESTRICTION_KEYS = [
  "maxParallelAgents",
  "autoFixRetries",
  "requireConfirmation",
];
const KNOWN_RC_VALUES = [
  "deploy",
  "deploy:preview",
  "deploy:promote",
  "db",
  "db:migrate",
  "db:seed",
  "db:reset",
  "secure",
];

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function loadConfig(projectRoot: string, customPath?: string): HarnessConfig | null {
  const configPath = customPath ?? resolve(projectRoot, "harness.config.json");
  if (!existsSync(configPath)) return null;

  const raw = readFileSync(configPath, "utf-8");
  try {
    return JSON.parse(raw) as HarnessConfig;
  } catch {
    throw new ConfigError(
      `${configPath} is not valid JSON.`,
      "Check for trailing commas, missing quotes, or unmatched braces.",
    );
  }
}

export function validateConfig(config: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof config !== "object" || config === null) {
    errors.push("Config must be a JSON object");
    return { errors, warnings };
  }

  const obj = config as Record<string, unknown>;

  // Required top-level keys
  for (const key of REQUIRED_TOP_KEYS) {
    if (!(key in obj) || obj[key] === null || obj[key] === undefined) {
      errors.push(`Missing required key: '${key}'`);
    }
  }

  // Type checks
  if ("version" in obj && typeof obj.version !== "string") {
    errors.push(`'version' must be a string (got ${typeof obj.version})`);
  }
  if ("safeMode" in obj && typeof obj.safeMode !== "boolean") {
    errors.push(`'safeMode' must be a boolean (got ${typeof obj.safeMode})`);
  }

  // Restriction sub-keys
  if ("restrictions" in obj && typeof obj.restrictions === "object" && obj.restrictions !== null) {
    const restrictions = obj.restrictions as Record<string, unknown>;

    for (const key of REQUIRED_RESTRICTION_KEYS) {
      if (!(key in restrictions) || restrictions[key] === null || restrictions[key] === undefined) {
        errors.push(`Missing required key: 'restrictions.${key}'`);
      }
    }

    if ("maxParallelAgents" in restrictions) {
      if (typeof restrictions.maxParallelAgents !== "number") {
        errors.push(`'restrictions.maxParallelAgents' must be a number (got ${typeof restrictions.maxParallelAgents})`);
      } else if (restrictions.maxParallelAgents < 1 || restrictions.maxParallelAgents > 100) {
        errors.push(`'restrictions.maxParallelAgents' must be between 1 and 100 (got ${restrictions.maxParallelAgents})`);
      }
    }
    if ("autoFixRetries" in restrictions) {
      if (typeof restrictions.autoFixRetries !== "number") {
        errors.push(`'restrictions.autoFixRetries' must be a number (got ${typeof restrictions.autoFixRetries})`);
      } else if (restrictions.autoFixRetries < 0 || restrictions.autoFixRetries > 20) {
        errors.push(`'restrictions.autoFixRetries' must be between 0 and 20 (got ${restrictions.autoFixRetries})`);
      }
    }
    if ("requireConfirmation" in restrictions) {
      if (!Array.isArray(restrictions.requireConfirmation)) {
        errors.push(`'restrictions.requireConfirmation' must be an array (got ${typeof restrictions.requireConfirmation})`);
      } else {
        if (restrictions.requireConfirmation.length === 0) {
          warnings.push("'restrictions.requireConfirmation' is empty — no dangerous keywords will be blocked.");
        }
        for (const val of restrictions.requireConfirmation) {
          if (typeof val !== "string") {
            errors.push(`'restrictions.requireConfirmation' elements must be strings (got ${typeof val})`);
          } else if (!KNOWN_RC_VALUES.includes(val)) {
            warnings.push(`Unknown requireConfirmation value: '${val}' (known: ${KNOWN_RC_VALUES.join(", ")})`);
          }
        }
      }
    }

    // Unknown restriction keys
    for (const key of Object.keys(restrictions)) {
      if (!KNOWN_RESTRICTION_KEYS.includes(key)) {
        warnings.push(`Unknown restriction key: '${key}' (typo? known: ${KNOWN_RESTRICTION_KEYS.join(", ")})`);
      }
    }
  }

  // Unknown top-level keys
  for (const key of Object.keys(obj)) {
    if (!KNOWN_TOP_KEYS.includes(key)) {
      warnings.push(`Unknown top-level key: '${key}' (typo? known: ${KNOWN_TOP_KEYS.join(", ")})`);
    }
  }

  return { errors, warnings };
}
