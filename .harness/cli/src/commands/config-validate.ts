import { loadConfig, validateConfig } from "../core/config.ts";

/**
 * Validate harness.config.json.
 * Exit codes: 0=valid, 1=errors, 2=warnings only.
 */
export function configValidate(projectRoot: string, configPath?: string): number {
  const config = loadConfig(projectRoot, configPath);

  if (config === null) {
    console.error("[config] ERROR: Config file not found or invalid JSON.");
    console.error("  What to do: Run ./harness/project-init.sh --detect . to generate one.");
    return 1;
  }

  const { errors, warnings } = validateConfig(config);

  for (const err of errors) {
    console.log(`[config] ERROR: ${err}`);
  }
  for (const warn of warnings) {
    console.log(`[config] WARNING: ${warn}`);
  }

  console.log("");
  if (errors.length > 0) {
    console.log(`[config] FAILED: ${errors.length} error(s), ${warnings.length} warning(s)`);
    return 1;
  } else if (warnings.length > 0) {
    console.log(`[config] PASSED with ${warnings.length} warning(s)`);
    return 2;
  } else {
    console.log("[config] PASSED: Config is valid");
    return 0;
  }
}
