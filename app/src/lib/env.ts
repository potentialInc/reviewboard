let validated = false;

/**
 * Validate required environment variables at startup.
 * Logs clear errors instead of cryptic runtime failures.
 */
export function validateEnv() {
  if (validated) return;
  validated = true;

  // Skip during build phase (next build collects page data without runtime env)
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SESSION_SECRET',
    'ADMIN_ID',
    'ADMIN_PASSWORD',
  ];

  const missing = required.filter((key) => !process.env[key]);

  // Validate SESSION_SECRET minimum length
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length < 32) {
    missing.push('SESSION_SECRET (must be at least 32 characters)');
  }

  if (missing.length > 0) {
    const msg = [
      '',
      'Missing required environment variables:',
      ...missing.map((k) => `  - ${k}`),
      '',
      'Check your .env.local file.',
      '',
    ].join('\n');

    // Log but don't crash — individual features handle missing vars gracefully.
    // Throwing here kills the server before it can listen on port 3000.
    console.error(msg);
  }
}
