import { AccountRegistry } from './account.js';
import { DurableStore } from './store.js';
import { log } from './log.js';
import { buildSupportBundle, writeSupportBundle } from './support-bundle.js';
import { checkForUpdate } from './updates.js';

const command = process.argv[2] || 'help';

if (command === 'support-bundle') {
  const accounts = new AccountRegistry(DurableStore.open());
  const bundle = buildSupportBundle({
    accounts,
    logs: log.recent(),
    uptime: process.uptime()
  });
  const file = writeSupportBundle(bundle, process.argv[3]);
  process.stdout.write(`${file}\n`);
} else if (command === 'check-update') {
  const status = await checkForUpdate();
  process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
  process.exit(0);
} else {
  process.stdout.write(`Usage: node cli.js <support-bundle|check-update> [outfile]\n`);
  process.exit(2);
}
