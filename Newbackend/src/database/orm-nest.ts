/**
 * Nest wiring for the model layer (see ./orm): schema decorators, model and
 * connection injection, and OrmModule for registering models.
 */
export * from "@nestjs/mongoose";
export { MongooseModule as OrmModule } from "@nestjs/mongoose";
