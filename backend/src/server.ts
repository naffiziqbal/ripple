import http from 'node:http';
import { createApp } from './app';
import { config } from './config';
import { getPool } from './db';
import { migrate } from './db/migrate';
import { initNotifications } from './modules/notifications/notifications.service';
import { attachRealtime } from './realtime/ws-server';

async function main(): Promise<void> {
  await migrate(getPool());
  initNotifications();

  const server = http.createServer(createApp());
  attachRealtime(server);
  server.listen(config.PORT, () => {
    console.log(`Ripple API listening on http://localhost:${config.PORT} (${config.NODE_ENV})`);
  });
}

main().catch((err) => {
  if (err instanceof Error && 'code' in err && err.code === 'ECONNREFUSED') {
    console.error(
      `Cannot reach PostgreSQL at ${config.DATABASE_URL}.\n` +
        'Is the database running? Start it with: docker compose up -d'
    );
  } else {
    console.error('Failed to start server:', err);
  }
  process.exit(1);
});
