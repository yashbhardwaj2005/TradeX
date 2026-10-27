import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const files = execFileSync('git', ['ls-files', '--cached', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const forbidden =
  /(^|\/)(node_modules|dist|\.data|artifacts|\.aws|\.codex|\.agents|\.vercel|\.render|\.railway)(\/|$)/;
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9_]{30,}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
  /AKIA[0-9A-Z]{16}/,
  /mongodb(?:\+srv)?:\/\/[^\s/]+:[^\s@]+@/,
];
const invalid = [];
for (const file of files) {
  if (
    forbidden.test(file) ||
    (/(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.env.example'))
  ) {
    invalid.push(file);
    continue;
  }
  const contents = readFileSync(file);
  if (contents.includes(0)) continue;
  if (secretPatterns.some((pattern) => pattern.test(contents.toString('utf8')))) invalid.push(file);
}
if (invalid.length) {
  console.error(
    `Release check failed. Remove private/generated content from Git: ${invalid.join(', ')}`,
  );
  process.exit(1);
}
console.log(
  `Release check passed: ${files.length} staged/tracked source files; no local databases, credentials, generated output or detected secret patterns.`,
);
