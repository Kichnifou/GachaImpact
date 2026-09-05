import 'dotenv/config';

import { buildApp } from './app.js';
import { loadConfig } from './config/environment.js';
import { createRuntimeDependencies } from './infrastructure/runtime-dependencies.js';

const config = loadConfig();
const dependencies = createRuntimeDependencies(config);
const app = await buildApp(config, dependencies);

async function stop(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, 'Stopping server');
  await app.close();
  process.exit(0);
}

process.once('SIGINT', () => void stop('SIGINT'));
process.once('SIGTERM', () => void stop('SIGTERM'));

try {
  await dependencies.start();
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error, 'Unable to start server');
  await app.close();
  process.exit(1);
}
