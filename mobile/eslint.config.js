// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      // Reanimated shared values are intentionally mutable: `sharedValue.value = x`
      // is the library's core API and the only way to drive UI-thread animations.
      // The React-Compiler immutability rule (new in eslint-config-expo 56) flags
      // every such write as a false positive, so we disable just that one rule.
      // All other React-Compiler rules (refs, preserve-manual-memoization) stay on.
      'react-hooks/immutability': 'off',
      // Natural-English apostrophes and quotes in UI copy are not bugs; keep the
      // rule only for the genuinely ambiguous '>' and '}' in JSX text.
      'react/no-unescaped-entities': ['error', { forbid: ['>', '}'] }],
    },
  },
  {
    ignores: ['dist/*'],
  },
]);
