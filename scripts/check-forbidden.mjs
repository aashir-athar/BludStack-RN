#!/usr/bin/env node
// Pre-commit guard for the BludStack house rules. lint-staged passes the staged
// file paths as argv; we read each and reject any that violate the rules so a
// regression never lands in a commit:
//
//   * No em-dash (U+2014) or en-dash (U+2013) anywhere. Use a hyphen or rewrite.
//     Box-drawing (U+2500) in comment headers and arrows (U+2192) are allowed.
//   * No emoji. Vectors come from @expo/vector-icons / BrandMark, never glyphs.
//
// Patterns use \u escapes and messages stay ASCII so this guard never trips on
// itself. Exit non-zero on any violation, printing file:line for a one-line fix.
import { readFileSync } from 'node:fs';

// lint-staged passes staged paths as argv. The repo-wide `npm run check:forbidden`
// pipes `git ls-files` in on stdin instead, which is cross-platform (no xargs).
function readStdin() {
  try {
    return readFileSync(0, 'utf8')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

const files = process.argv.length > 2 ? process.argv.slice(2) : readStdin();

// Built from char codes (U+2013 en-dash, U+2014 em-dash) so this guard file
// contains no literal forbidden character and never flags itself.
const DASHES = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
// Conservative: the emoji planes + regional flags + the emoji variation
// selector. Deliberately excludes BMP symbol/arrow blocks so technical glyphs
// the codebase uses in comments (arrows, checks) are not flagged.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/u;

let violations = 0;

for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // deleted/renamed in this commit
  }
  text.split(/\r?\n/).forEach((line, i) => {
    if (DASHES.test(line)) {
      console.error(`${file}:${i + 1}  forbidden em/en dash - use a hyphen or rewrite`);
      violations++;
    }
    if (EMOJI.test(line)) {
      console.error(`${file}:${i + 1}  forbidden emoji - use a vector icon instead`);
      violations++;
    }
  });
}

if (violations > 0) {
  console.error(`\nBlocked: ${violations} house-rule violation(s). Fix them and re-stage.`);
  process.exit(1);
}
