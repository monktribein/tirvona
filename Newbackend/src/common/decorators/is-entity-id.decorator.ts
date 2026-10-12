import { Matches } from "class-validator";
import type { ValidationOptions } from "class-validator";

const ENTITY_ID = /^[0-9a-f]{24}$/i;

/** A record id: 24 hexadecimal characters. */
export const IsEntityId = (options?: ValidationOptions): PropertyDecorator =>
  Matches(ENTITY_ID, {
    message: ({ property }) => `${property} must be a valid id`,
    ...options,
  });
