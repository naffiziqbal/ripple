import { Pool, types } from 'pg';
import { config } from '../config';

// COUNT(*) and other int8 columns arrive as strings by default — parse to number.
types.setTypeParser(types.builtins.INT8, (value) => Number(value));

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: config.DATABASE_URL });
  }
  return pool;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = null;
}
