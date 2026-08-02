import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";

export interface AuthenticatedUser {
  _id: string;
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  permissions: string[];
  scopedAshramIds: string[];
  employerAshramId?: string;
  district?: string;
  state?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user,
);
