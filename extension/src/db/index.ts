/**
 * Database module entry point.
 * Re-exports the singleton database instance and types.
 */
export { db, ArclineDatabase } from './schema';
export type { SpaceRecord, ItemRecord } from './schema';
