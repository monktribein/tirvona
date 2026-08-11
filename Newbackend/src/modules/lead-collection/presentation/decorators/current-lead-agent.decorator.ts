import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { AuthenticatedLeadUser } from "../../domain/lead-collection.types";
import type { LeadRequest } from "../guards/lead-agent.guard";

/** The field agent attached by `LeadAgentGuard`. */
export const CurrentLeadAgent = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedLeadUser =>
    context.switchToHttp().getRequest<LeadRequest>()
      .leadUser as AuthenticatedLeadUser,
);
