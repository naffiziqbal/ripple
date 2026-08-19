import { Client } from 'pg';

const ADMIN_URL =
  process.env.DATABASE_ADMIN_URL ?? 'postgres://ripple:ripple@localhost:5433/ripple';
const TEST_DB = 'ripple_test';

/** Runs once before the suite: make sure the dedicated test database exists. */
export default async function globalSetup(): Promise<void> {
  const client = new Client({ connectionString: ADMIN_URL });
  try {
    await client.connect();
  } catch (err) {
    throw new Error(
      `Cannot reach PostgreSQL at ${ADMIN_URL}. Start it first: docker compose up -d\n(${
        err instanceof Error ? err.message : err
      })`
    );
  }
  try {
    await client.query(`CREATE DATABASE ${TEST_DB}`);
  } catch (err) {
    const duplicate = err instanceof Error && 'code' in err && err.code === '42P04';
    if (!duplicate) throw err;
  } finally {
    await client.end();
  }
}
