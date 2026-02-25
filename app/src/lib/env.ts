let validated = false;

/**
 * Validate required environment variables at startup.
 * Logs clear errors instead of cryptic runtime failures.
 */
export function validateEnv() {
  if (validated) return;
  validated = true;

  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    const msg = [
      '',
      'Missing required environment variables:',
      ...missing.map((k) => `  - ${k}`),
      '',
      'Check your .env.local file.',
      '',
    ].join('\n');

    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg);
    }
    console.error(msg);
  }
}
