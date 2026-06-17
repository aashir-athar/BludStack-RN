// Runs on staged files at commit time (via husky + lint-staged).
// We intentionally do NOT auto-format here: the source is hand-aligned and
// Prettier would flatten it. Instead we enforce the house rules (no em/en dash,
// no emoji) on exactly the files being committed. ESLint/typecheck/tests are the
// CI gate; this hook is the fast, local non-negotiable guard.
export default {
  '*.{ts,tsx,js,jsx,mjs,cjs,json,md,yml,yaml,sql}': 'node scripts/check-forbidden.mjs',
};
