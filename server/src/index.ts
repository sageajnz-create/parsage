import { createParsageServer } from './server.js';
import { DurableStore } from './store.js';
import { installProcessCrashHandler } from './crash.js';
import { log } from './log.js';

installProcessCrashHandler('signaling');

const application = createParsageServer({
  store: DurableStore.open()
});

application.listen().catch(error => {
  log.error('server_start_failed', { message: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});

let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  application.close()
    .then(() => process.exit(0))
    .catch(error => {
      log.error('server_stop_failed', { message: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
