import { createParsageServer } from './server.js';

const application = createParsageServer();

application.listen().catch(error => {
  console.error('[Parsage] Failed to start signaling server:', error);
  process.exit(1);
});

let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  application.close()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('[Parsage] Failed to stop signaling server cleanly:', error);
      process.exit(1);
    });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
