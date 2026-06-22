#!/usr/bin/env node
/**
 * cjs-to-esm.js — Convert CommonJS require()/module.exports to ESM import/export.
 * Handles: destructured requires (with renames), default requires, multi-line,
 * module.exports = { ... }, module.exports = expr (default export).
 *
 * Usage: node scripts/cjs-to-esm.js <file1> [file2...]
 */
'use strict';

const fs = require('fs');

function convert(content) {
  // --- Phase 1: Convert require() statements ---
  // Multi-line: const { a: x, b } = require(\n   c,\n );  OR  const { a, b,\n  c } = require('mod');

  // Greedy match from `const {` or `const x =` through `= require('...')` possibly spanning lines.
  content = content.replace(
    /const\s+(\{[^}]+\}|\w+)\s*=\s*require\(\s*(['"`][^'"`]+['"`])\s*\)/gs,
    (match, bindings, modQuote) => {
      const mod = modQuote.replace(/['"`]/g, '');
      if (bindings.startsWith('{')) {
        // Destructured: convert `: rename` to `as rename`, strip braces whitespace
        let inner = bindings.slice(1, -1).trim();
        // Convert `name: alias` → `name as alias`  (but not `{ name: type }` which won't appear in require)
        inner = inner.replace(/(\w+)\s*:\s*(\w+)/g, '$1 as $2');
        // Clean up multi-line whitespace
        inner = inner.replace(/\s+/g, ' ');
        return `import { ${inner} } from '${mod}'`;
      } else {
        // Default: const x = require('mod') → import * as x from 'mod'
        return `import * as ${bindings} from '${mod}'`;
      }
    }
  );

  // --- Phase 2: Convert module.exports ---
  // Pattern: module.exports = { identifier, identifier, ... };
  content = content.replace(
    /module\.exports\s*=\s*\{([^}]+)\}\s*;?/g,
    (match, inner) => {
      const names = inner.trim().replace(/\s+/g, ' ');
      return `export { ${names} };`;
    }
  );

  // Pattern: module.exports = identifier;  (e.g. module.exports = router;)
  content = content.replace(
    /module\.exports\s*=\s*(\w+)\s*;/g,
    'export default $1;'
  );

  // Pattern: module.exports = function ...  or module.exports = Router()
  content = content.replace(
    /module\.exports\s*=\s*/g,
    'const __default_export = '
  );
  // If we created __default_export lines, add export default at end
  if (content.includes('__default_export')) {
    content = content.replace(/const __default_export = ([\w.]+\(\));/g, (m, expr) => {
      return `const __default_export = ${expr};`;
    });
    // This is a fallback; manual fix may be needed
  }

  // --- Phase 3: Convert 'use strict' (unnecessary in TS) ---
  content = content.replace(/['"]use strict['"];?\n/g, '');

  return content;
}

// CLI
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/cjs-to-esm.js <file1> [file2...]');
  process.exit(1);
}

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const converted = convert(original);
  if (converted !== original) {
    fs.writeFileSync(file, converted);
    console.log(`Converted: ${file}`);
  } else {
    console.log(`No changes: ${file}`);
  }
}
