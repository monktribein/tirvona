/**
 * The model layer: schemas, models, sessions and ids. Application code
 * imports from here, never from the underlying library, so services stay
 * independent of it. Every read and write is stored in Supabase Postgres by
 * the driver in ./pg (installed by configureDatabase()).
 */
export * from "mongoose";
export { default } from "mongoose";
