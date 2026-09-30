# Support Management module

Tickets, customer ↔ staff conversation, internal notes, attachments, SLA tracking and KPIs. All routes are under the global `/api` prefix and appear in Swagger under **Support** and **Support Admin**.

## What it reuses

| Need | Reused from |
|---|---|
| Users, login, JWT, roles | `auth`, `users`, global `JwtAuthGuard` + `RolesGuard` (`super_admin` always passes) |
| Notifications | `notifications`: `InAppNotificationService` writes the `user_notifications` inbox row (what `GET /api/notifications` returns), emits the `notification` socket event and sends FCM push |
| File storage | `uploads/UploadsService` (Cloudinary). Support only accepts images + PDF (type detected from bytes), max 10 MB |
| Audit trail | `audit_logs` (`module: "support"`, `action: "support.*"`) |
| Linked records | read live, read-only, from their own collections (bookings, payments, refunds, marketplace orders, aarti, parking, events, ashrams, temples). Nothing is copied into the ticket except id + reference + a short label |

## Collections

| Collection | Model | Notes |
|---|---|---|
| `booking_support_tickets` | `SupportTicket` | Name kept from the first version so old tickets, the admin section summary and governance CRUD keep working. `ticketNumber` unique (`TIR-000001`) |
| `support_ticket_messages` | `SupportMessage` | Conversation. `internal: true` = staff-only note, filtered out of every customer query |
| `support_ticket_activities` | `SupportActivity` | Timeline. `visibleToUser` rows show on the customer's ticket, without staff notes |
| `support_categories` | `SupportCategory` | Data, not an enum. 14 defaults seeded on boot (never overwritten). `handlerRoles` lets e.g. `marketplace_manager` work that category |
| `support_attachments` | `SupportAttachment` | Upload record. A ticket/message can only use ids the same user uploaded and has not used yet |
| `support_counters` | `SupportCounter` | Atomic `$inc` behind ticket numbers |

**Upgrading old tickets.** On every boot `SupportMigrationService` seeds missing categories and converts tickets from the first version in place: it assigns ticket numbers, maps the old lower-case status/priority/category values, renames `title` → `subject` and moves embedded `messages` into `support_ticket_messages`. It is idempotent and safe with several instances. Indexes are created by the existing `npm run db:indexes`, which covers every registered model.

## Access

| Who | Sees | Can |
|---|---|---|
| Customer (any signed-in user) | Own tickets only (other ids → 404) | Create, reply, attach, close/confirm, reopen within 30 days. Never sees internal notes, priority, escalation, assignee identity or staff change notes |
| `support` | Assigned to them + unassigned queue | Take/release, reply, internal notes, status/priority/category, escalate, link records, raise tickets for customers |
| `support` + permission `support.manage_all` | Every ticket | The above, plus assigning anyone and the full dashboard |
| `marketplace_manager`, `finance_manager`, `service_manager`, `national_admin` | Assigned + unassigned tickets **in categories whose `handlerRoles` include their role** | Work those tickets (no raising tickets for customers, no customer lookup) |
| `super_admin` | Everything | Everything, including categories |

## Statuses, SLA

`OPEN → IN_PROGRESS / WAITING_FOR_USER → RESOLVED → CLOSED`, with `REOPENED` from resolved/closed (`STAFF_TRANSITIONS` in `domain/support.constants.ts`). Transitions are conditional updates, so two agents cannot overwrite each other (409 → refresh).
Automatic moves: a customer reply to `WAITING_FOR_USER` → `IN_PROGRESS` (or `OPEN` if unassigned); a customer reply to `RESOLVED` → `REOPENED`; the first public staff reply to `OPEN`/`REOPENED` → `IN_PROGRESS` (and an agent replying to an unassigned ticket takes it).

SLA targets per priority (first response / resolution): URGENT 1 h / 8 h, HIGH 4 h / 24 h, MEDIUM 12 h / 72 h, LOW 24 h / 120 h. `firstResponseMinutes` and `resolutionMinutes` are stored when they happen, so dashboard averages are plain aggregates.

## API

Customer (`/api/support`): `GET categories`, `GET linkable?type=`, `POST attachments` (multipart `file`), `GET|POST tickets`, `GET tickets/:id`, `POST tickets/:id/messages`, `POST tickets/:id/close`, `POST tickets/:id/reopen`.
First-version routes kept for old app builds: `POST /`, `GET /`, `POST :id/message`, `POST :id/resolve`.

Staff (`/api/support/admin`): `GET dashboard`, `GET tickets` (`view=all|mine|unassigned|urgent|escalated|overdue`, `status`/`priority` comma lists, `category`, `assignedTo`, `userId`, `entityType`, `from`/`to`, `search`, `sort=newest|oldest|priority|activity|due`, `page`, `limit`), `POST tickets`, `GET|PATCH tickets/:id`, `POST tickets/:id/assign|escalate|messages`, `PUT tickets/:id/related-entity`, `GET staff`, `GET customers?search=`, `GET customers/:userId/linkable?type=`, `GET categories`, `POST categories` and `PUT categories/:id` (super_admin).

Rate limits (per signed-in user): 10 new tickets/hour, 60 replies/10 min, 30 uploads/15 min.

## Frontend

Customer: profile → **Help & Support** (`/profile/support`, `/new`, `/:ticketId`), also in the header user menu. Staff: **Support Management** sidebar group (`/admin/support`, `/tickets?view=…`, `/tickets/:id` workspace, `/tickets/new`, `/staff`, `/categories`). The old `/support` address redirects by role.
