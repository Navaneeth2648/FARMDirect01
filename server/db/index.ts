import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.ts';
import { seed } from './seed.ts';
import { runMigrations } from './migrations.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

export type Row = Record<string, any>;

let db: DatabaseSync | null = null;

export function openDb(file = config.databaseFile) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new DatabaseSync(file);
  conn.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  conn.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));
  runMigrations(conn);
  seed(conn);
  return conn;
}

export function getDb() {
  if (!db) db = openDb(config.isTest ? ':memory:' : config.databaseFile);
  return db;
}

/** Replace the shared connection (tests). */
export function setDb(conn: DatabaseSync) {
  db = conn;
}

export const q = {
  get<T = Row>(sql: string, ...params: any[]): T | undefined {
    return getDb().prepare(sql).get(...params) as T | undefined;
  },
  all<T = Row>(sql: string, ...params: any[]): T[] {
    return getDb().prepare(sql).all(...params) as T[];
  },
  run(sql: string, ...params: any[]) {
    return getDb().prepare(sql).run(...params);
  },
  tx<T>(fn: () => T): T {
    const conn = getDb();
    conn.exec('BEGIN');
    try {
      const out = fn();
      conn.exec('COMMIT');
      return out;
    } catch (e) {
      conn.exec('ROLLBACK');
      throw e;
    }
  },
};

/** Build "col = ?" assignments for a partial update from an allow-listed object. */
export function updateSet(data: Record<string, unknown>) {
  const keys = Object.keys(data).filter((k) => data[k] !== undefined);
  return {
    sql: keys.map((k) => `${k} = ?`).join(', '),
    values: keys.map((k) => toDb(data[k])),
    empty: keys.length === 0,
  };
}

export function toDb(v: unknown): any {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (Array.isArray(v) || (v && typeof v === 'object')) return JSON.stringify(v);
  return v;
}

export function insert(table: string, data: Record<string, unknown>) {
  const keys = Object.keys(data).filter((k) => data[k] !== undefined);
  q.run(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
    ...keys.map((k) => toDb(data[k])),
  );
}

const JSON_COLS = new Set([
  'local_names', 'seasons', 'regions', 'notify_channels', 'result_json', 'sources', 'crop_ids',
  'tags', 'farmer_categories', 'operating_locations', 'commodities', 'sourcing_regions', 'charges', 'breakdown',
  'changes', 'checks', 'submitted_data', 'evidence', 'vehicle_types', 'service_states', 'service_districts',
  'pending_changes', 'estimate', 'final_charges', 'permissions', 'measurements', 'crops', 'actions',
]);

/** Parse JSON columns and integer booleans for API output. */
export function out<T extends Row | undefined>(row: T): T {
  if (!row) return row;
  const r: Row = { ...row };
  for (const k of Object.keys(r)) {
    if (JSON_COLS.has(k) && typeof r[k] === 'string') {
      try { r[k] = JSON.parse(r[k]); } catch { /* leave as is */ }
    }
  }
  delete r.password_hash;
  return r as T;
}
