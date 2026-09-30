/// <reference types="jest" />
/**
 * Test harness: the real support services wired to in-memory models, a fake
 * read-only connection for linked records, a fake upload store and a
 * recording notifier. Test-only; never touches a database.
 */
import { Types } from "mongoose";
import sift from "sift";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { AuditLogSchema } from "../../audit/audit.module";
import { createInMemoryModel, normalize } from "../../marketplace/testing/in-memory-model";
import { UserSchema } from "../../users/infrastructure/persistence/user.schema";
import { SupportAttachmentService } from "../application/support-attachment.service";
import { SupportCategoryService } from "../application/support-category.service";
import { SupportDashboardService } from "../application/support-dashboard.service";
import { SupportEntityService } from "../application/support-entity.service";
import { SupportMigrationService } from "../application/support-migration.service";
import { SupportTicketService } from "../application/support-ticket.service";
import {
  SupportActivitySchema,
  SupportAttachmentSchema,
  SupportCategorySchema,
  SupportCounterSchema,
  SupportMessageSchema,
  SupportTicketSchema,
} from "../infrastructure/support.schema";

export function actor(role = "customer", extra: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  const id = new Types.ObjectId().toHexString();
  return {
    _id: id,
    id,
    name: `${role} person`,
    email: `${id}@example.com`,
    phone: "9876543210",
    role,
    status: "active",
    permissions: [],
    scopedAshramIds: [],
    scopedTempleIds: [],
    ...extra,
  };
}

/** Read-only fake of `connection.collection(name)` backed by plain arrays. */
function fakeConnection(data: Record<string, any[]>) {
  return {
    collection(name: string) {
      const rows = () => (data[name] ?? []).map(normalize);
      return {
        findOne: async (filter: any) => rows().find(sift(normalize(filter))) ?? null,
        find: (filter: any) => {
          let out = rows().filter(sift(normalize(filter)));
          const cursor = {
            sort: () => cursor,
            limit: (n: number) => {
              out = out.slice(0, n);
              return cursor;
            },
            toArray: async () => out,
          };
          return cursor;
        },
      };
    },
  };
}

/** The in-memory model does not apply schema timestamps; stamp creates like MongoDB would (strictly increasing). */
let clock = 0;
function withTimestamps<T extends { create: (...args: any[]) => any }>(model: T): T {
  const original = model.create.bind(model);
  const stamp = (doc: any) => {
    clock = Math.max(Date.now(), clock + 1);
    const at = new Date(clock);
    return { createdAt: at, updatedAt: at, ...doc };
  };
  (model as any).create = (input: any, opts?: any) =>
    original(Array.isArray(input) ? input.map(stamp) : stamp(input), opts);
  return model;
}

export async function buildSupport() {
  const raw = {
    tickets: createInMemoryModel("SupportTicket", SupportTicketSchema, { unique: [["ticketNumber"]] }),
    messages: createInMemoryModel("SupportMessage", SupportMessageSchema),
    activities: createInMemoryModel("SupportActivity", SupportActivitySchema),
    categories: createInMemoryModel("SupportCategory", SupportCategorySchema, { unique: [["key"]] }),
    attachments: createInMemoryModel("SupportAttachment", SupportAttachmentSchema),
    counters: createInMemoryModel("SupportCounter", SupportCounterSchema, { unique: [["key"]] }),
    users: createInMemoryModel("User", UserSchema),
    audit: createInMemoryModel("AuditLog", AuditLogSchema),
  };
  const models = Object.fromEntries(
    Object.entries(raw).map(([name, model]) => [name, withTimestamps(model)]),
  ) as typeof raw;
  const linked: Record<string, any[]> = {};
  const notifications: Array<{ userIds: string[]; title: string; body: string; deepLink?: string; kind?: string }> = [];
  const notifier: any = {
    notifyUsers: async (userIds: string[], input: any) => {
      notifications.push({ userIds: [...new Set(userIds.map(String))], ...input });
    },
  };
  let uploadSeq = 0;
  const uploads: any = {
    upload: async (file: any) => {
      if (!file) throw new Error("no file");
      uploadSeq++;
      return { url: `https://res.cloudinary.com/demo/support/${uploadSeq}.png`, publicId: `p${uploadSeq}`, bytes: 1234, mimeType: "image/png", kind: "image" };
    },
  };

  const categories = new SupportCategoryService(models.categories, models.tickets);
  const entities = new SupportEntityService(fakeConnection(linked) as any);
  const attachments = new SupportAttachmentService(models.attachments, uploads);
  const tickets = new SupportTicketService(
    models.tickets,
    models.messages,
    models.activities,
    models.counters,
    models.users,
    models.audit,
    categories,
    entities,
    attachments,
    notifier,
  );
  const dashboard = new SupportDashboardService(models.tickets, models.categories, models.users, tickets);
  const migration = new SupportMigrationService(models.tickets, models.messages, models.activities, categories, tickets);
  await categories.seedDefaults();

  /** Registers a person as an active user account so staff lookups find them. */
  const register = async (user: AuthenticatedUser) => {
    await models.users.create({
      _id: user.id,
      name: user.name,
      email: user.email,
      phone: `9${Math.floor(Math.random() * 1e9).toString().padStart(9, "0")}`,
      role: user.role,
      status: "active",
      permissions: user.permissions,
    });
    return user;
  };

  return { models, linked, notifications, categories, entities, attachments, tickets, dashboard, migration, register };
}
