import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = process.platform === 'win32'
  ? [['py', ['-3']], ['python', []], ['python3', []]]
  : [['python3', []], ['python', []]];

const selected = candidates.find(([command, prefix]) => {
  const probe = spawnSync(command, [...prefix, '-c', 'import sys; raise SystemExit(sys.version_info < (3, 10))'], {
    cwd: root,
    stdio: 'ignore',
  });
  return !probe.error && probe.status === 0;
});

if (!selected) {
  console.error('Python 3.10 or newer is required to run the Parsage host tests.');
  process.exit(1);
}

const [command, prefix] = selected;
const result = spawnSync(command, [
  ...prefix,
  '-m', 'unittest', 'discover',
  '-s', 'host',
  '-p', 'test_*.py',
], {
  cwd: root,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Unable to run host tests: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
