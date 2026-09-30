import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { SUPPORT_MANAGE_ALL_PERMISSION } from "./domain/support.constants";
import { actor, buildSupport } from "./testing/support-harness";

const ticketInput = (extra: Record<string, unknown> = {}) => ({
  subject: "Room not allocated",
  description: "I reached the ashram but no room was allocated to my booking.",
  category: "booking",
  ...extra,
});

async function setup() {
  const h = await buildSupport();
  const customer = await h.register(actor("customer"));
  const other = await h.register(actor("customer"));
  const agent = await h.register(actor("support"));
  const agent2 = await h.register(actor("support"));
  const lead = await h.register(actor("support", { permissions: [SUPPORT_MANAGE_ALL_PERMISSION] }));
  const admin = await h.register(actor("super_admin"));
  return { h, customer, other, agent, agent2, lead, admin };
}

describe("Support management — end to end", () => {
  it("seeds the default categories once", async () => {
    const { h } = await setup();
    const keys = (await h.categories.listActive()).map((c: any) => c.key);
    expect(keys).toEqual(expect.arrayContaining(["booking", "hotel_stay", "temple", "ashram", "pandit_jyotish", "marketplace", "order", "payment", "refund", "cancellation", "account", "verification", "technical", "other"]));
    expect(await h.categories.seedDefaults()).toBe(0);
  });

  it("creates a ticket with a TIR number, SLA dates and notifications", async () => {
    const { h, customer, agent } = await setup();
    const t = await h.tickets.createForCustomer(customer, ticketInput());
    expect(t.ticketNumber).toBe("TIR-000001");
    expect(t.status).toBe("OPEN");
    expect(t).not.toHaveProperty("priority");
    const stored: any = await h.models.tickets.findById(t._id).lean();
    expect(stored.firstResponseDueAt).toBeTruthy();
    expect(stored.resolutionDueAt).toBeTruthy();
    expect(h.notifications.some((n) => n.userIds.includes(customer.id) && n.kind === "support.created")).toBe(true);
    expect(h.notifications.some((n) => n.userIds.includes(agent.id) && n.deepLink === `/admin/support/tickets/${t._id}`)).toBe(true);
  });

  it("never hands out the same ticket number twice", async () => {
    const { h, customer } = await setup();
    const made = await Promise.all(Array.from({ length: 8 }, () => h.tickets.createForCustomer(customer, ticketInput())));
    const numbers = made.map((t) => t.ticketNumber);
    expect(new Set(numbers).size).toBe(8);
    expect(numbers.sort()[7]).toBe("TIR-000008");
  });

  it("rejects unknown or inactive categories", async () => {
    const { h, customer } = await setup();
    await expect(h.tickets.createForCustomer(customer, ticketInput({ category: "nope" }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it("isolates customers from each other's tickets", async () => {
    const { h, customer, other } = await setup();
    const t = await h.tickets.createForCustomer(customer, ticketInput());
    await expect(h.tickets.getMine(other, t._id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(h.tickets.replyAsCustomer(other, t._id, "hello")).rejects.toBeInstanceOf(NotFoundException);
    expect((await h.tickets.listMine(other, {})).total).toBe(0);
    expect((await h.tickets.listMine(customer, {})).total).toBe(1);
    await expect(h.tickets.adminList(customer, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("links a customer's own booking and shows live details to staff only", async () => {
    const { h, customer, other, admin } = await setup();
    const ashramId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    h.linked.ashrams = [{ _id: ashramId, name: "Sri Krishna Ashram" }];
    h.linked.booking_bookings = [
      { _id: bookingId, bookingId: "BK-12345", customerId: new Types.ObjectId(customer.id), ashramId, status: "confirmed", paymentStatus: "paid", checkInDate: new Date("2026-10-01"), checkOutDate: new Date("2026-10-03"), guestsCount: 2, roomsBookedCount: 1, pricing: { totalAmount: 2400, amountPaid: 2400 } },
    ];
    // Someone else cannot link it, and the error does not reveal it exists.
    await expect(h.tickets.createForCustomer(other, ticketInput({ relatedEntity: { type: "booking", reference: "BK-12345" } }))).rejects.toThrow("could not find");

    const t = await h.tickets.createForCustomer(customer, ticketInput({ relatedEntity: { type: "booking", reference: "BK-12345" } }));
    expect(t.relatedEntity).toEqual({ type: "booking", reference: "BK-12345", label: "Stay booking BK-12345" });

    const view = await h.tickets.adminGet(admin, t._id);
    expect(view.relatedEntity!.exists).toBe(true);
    expect(view.relatedEntity!.title).toBe("Sri Krishna Ashram · BK-12345");
    const fields = Object.fromEntries(view.relatedEntity!.fields.map((f: any) => [f.label, f.value]));
    expect(fields.Payment).toBe("paid");
    expect(fields.Total).toBe(2400);

    // The booking is deleted later: the ticket still opens, with the stored snapshot.
    h.linked.booking_bookings = [];
    const after = await h.tickets.adminGet(admin, t._id);
    expect(after.relatedEntity).toMatchObject({ exists: false, reference: "BK-12345" });

    const owned = await h.entities.listOwned("booking", customer.id);
    expect(owned).toHaveLength(0);
  });

  it("keeps internal notes away from the customer and tracks first response", async () => {
    const { h, customer, agent } = await setup();
    const t = await h.tickets.createForCustomer(customer, ticketInput());
    await h.tickets.replyAsStaff(agent, t._id, { body: "Checked with the ashram — guest is VIP", internal: true });
    let stored: any = await h.models.tickets.findById(t._id).lean();
    expect(stored.firstResponseAt).toBeFalsy();
    expect(stored.status).toBe("OPEN");

    const { ticket } = await h.tickets.replyAsStaff(agent, t._id, { body: "Your room is now allocated: 204." });
    expect(ticket.status).toBe("IN_PROGRESS");
    expect(String(ticket.assignedTo)).toBe(agent.id); // replying took the ticket
    stored = await h.models.tickets.findById(t._id).lean();
    expect(stored.firstResponseAt).toBeTruthy();
    expect(stored.firstResponseMinutes).toBeGreaterThanOrEqual(0);
    expect(stored.unreadForUser).toBe(1);
    expect(h.notifications.some((n) => n.userIds.includes(customer.id) && n.kind === "support.reply")).toBe(true);

    const mine = await h.tickets.getMine(customer, t._id);
    expect(mine.messages).toHaveLength(1);
    expect(mine.messages[0].body).toBe("Your room is now allocated: 204.");
    expect(mine.messages[0].senderName).toContain("Tirvona Support");
    expect(JSON.stringify(mine)).not.toContain("VIP");
    expect(JSON.stringify(mine)).not.toMatch(/escalat|priority|internal/i);
    // Opening it marks the staff reply read.
    expect(((await h.models.tickets.findById(t._id).lean()) as any).unreadForUser).toBe(0);

    const staffView = await h.tickets.adminGet(agent, t._id);
    expect(staffView.messages.map((m: any) => m.internal)).toEqual([true, false]);
  });

  it("enforces who can assign and who can see a ticket", async () => {
    const { h, customer, agent, agent2, lead } = await setup();
    const t = await h.tickets.createForCustomer(customer, ticketInput());
    // An agent cannot hand the ticket to someone else …
    await expect(h.tickets.assign(agent, t._id, agent2.id)).rejects.toBeInstanceOf(ForbiddenException);
    // … but a supervisor can.
    await h.tickets.assign(lead, t._id, agent2.id);
    expect(h.notifications.some((n) => n.userIds.includes(agent2.id) && n.kind === "support.assigned")).toBe(true);
    // Now it is agent2's: agent no longer sees it.
    await expect(h.tickets.adminGet(agent, t._id)).rejects.toBeInstanceOf(NotFoundException);
    expect((await h.tickets.adminList(agent, {})).total).toBe(0);
    expect((await h.tickets.adminList(agent2, { view: "mine" })).total).toBe(1);
    // Customers cannot be assignees.
    await expect(h.tickets.assign(lead, t._id, customer.id)).rejects.toBeInstanceOf(BadRequestException);
    // agent2 may release it; agent may then claim it.
    await h.tickets.assign(agent2, t._id, null);
    const claimed = await h.tickets.assign(agent, t._id, agent.id);
    expect(String(claimed.assignedTo)).toBe(agent.id);
  });

  it("limits handler roles to the categories they handle", async () => {
    const { h, customer } = await setup();
    const mm = await h.register(actor("marketplace_manager"));
    const booking = await h.tickets.createForCustomer(customer, ticketInput());
    const order = await h.tickets.createForCustomer(customer, ticketInput({ category: "marketplace", subject: "Damaged idol" }));
    const list = await h.tickets.adminList(mm, {});
    expect(list.data.map((t: any) => t.ticketNumber)).toEqual([order.ticketNumber]);
    await expect(h.tickets.adminGet(mm, booking._id)).rejects.toBeInstanceOf(NotFoundException);
    expect(h.notifications.some((n) => n.userIds.includes(mm.id) && n.body.includes("Damaged idol"))).toBe(true);
  });

  it("validates status transitions and supports resolve → reopen → close", async () => {
    const { h, customer, agent } = await setup();
    const t = await h.tickets.createForCustomer(customer, ticketInput());
    await expect(h.tickets.update(agent, t._id, { status: "REOPENED" })).rejects.toBeInstanceOf(BadRequestException);

    await h.tickets.update(agent, t._id, { status: "WAITING_FOR_USER" });
    await h.tickets.replyAsCustomer(customer, t._id, "Here is my ID proof");
    expect(((await h.models.tickets.findById(t._id).lean()) as any).status).toBe("OPEN");

    const resolved = await h.tickets.update(agent, t._id, { status: "RESOLVED", note: "Room allocated" });
    expect(resolved.resolvedAt).toBeTruthy();
    expect(resolved.resolutionMinutes).toBeGreaterThanOrEqual(0);
    expect(h.notifications.some((n) => n.userIds.includes(customer.id) && n.kind === "support.resolved")).toBe(true);

    const mine = await h.tickets.getMine(customer, t._id);
    expect(mine.canReopen).toBe(true);
    const reopened = await h.tickets.reopenAsCustomer(customer, t._id, "Room was changed again");
    expect(reopened.status).toBe("REOPENED");
    const stored: any = await h.models.tickets.findById(t._id).lean();
    expect(stored.reopenedCount).toBe(1);
    expect(stored.resolvedAt).toBeFalsy();

    const closed = await h.tickets.closeAsCustomer(customer, t._id);
    expect(closed.status).toBe("CLOSED");
    await expect(h.tickets.replyAsCustomer(customer, t._id, "one more thing")).rejects.toBeInstanceOf(BadRequestException);
    await expect(h.tickets.replyAsStaff(agent, t._id, { body: "hi" })).rejects.toBeInstanceOf(BadRequestException);
    // Internal notes are still allowed on a closed ticket.
    await h.tickets.replyAsStaff(agent, t._id, { body: "closing note", internal: true });

    const timeline = (await h.tickets.getMine(customer, t._id)).activity.map((a: any) => a.to);
    expect(timeline).toEqual(["OPEN", "WAITING_FOR_USER", "OPEN", "RESOLVED", "REOPENED", "CLOSED"]);
  });

  it("detects a concurrent status change instead of overwriting it", async () => {
    const { h, customer, agent } = await setup();
    const t = await h.tickets.createForCustomer(customer, ticketInput());
    const stale: any = await h.models.tickets.findById(t._id).lean();
    await h.tickets.update(agent, t._id, { status: "IN_PROGRESS" });
    await expect((h.tickets as any).transition(stale, "RESOLVED", agent)).rejects.toBeInstanceOf(ConflictException);
  });

  it("only accepts the uploader's own, unused attachments", async () => {
    const { h, customer, other } = await setup();
    const mineFile = await h.attachments.upload(customer, { originalname: "../../evil<script>.png", size: 100, buffer: Buffer.from("x") } as any);
    expect(mineFile.fileName).toBe("evilscript.png");
    const theirs = await h.attachments.upload(other, { originalname: "a.png", size: 100, buffer: Buffer.from("x") } as any);

    await expect(h.tickets.createForCustomer(customer, ticketInput({ attachmentIds: [theirs._id] }))).rejects.toThrow("invalid or already used");
    const t = await h.tickets.createForCustomer(customer, ticketInput({ attachmentIds: [mineFile._id] }));
    expect(t.attachments).toHaveLength(1);
    expect(t.attachments[0].url).toContain("cloudinary");
    await expect(h.tickets.replyAsCustomer(customer, t._id, "again", [mineFile._id])).rejects.toThrow("invalid or already used");

    const second = await h.attachments.upload(customer, { originalname: "b.pdf", size: 100, buffer: Buffer.from("x") } as any);
    const msg = await h.tickets.replyAsCustomer(customer, t._id, "see attached", [second._id]);
    expect(msg.attachments[0].fileName).toBe("b.pdf");
  });

  it("searches, filters, sorts and paginates for staff", async () => {
    const { h, customer, other, admin } = await setup();
    const a = await h.tickets.createForCustomer(customer, ticketInput({ subject: "Payment deducted twice", category: "payment" }));
    await h.tickets.createForCustomer(other, ticketInput({ subject: "Cannot login", category: "account" }));
    const c = await h.tickets.createForCustomer(other, ticketInput({ subject: "Refund pending", category: "refund" }));
    await h.tickets.update(admin, c._id, { priority: "URGENT" });

    expect((await h.tickets.adminList(admin, { search: a.ticketNumber })).data.map((t: any) => t._id)).toEqual([a._id]);
    expect((await h.tickets.adminList(admin, { search: "twice" })).total).toBe(1);
    expect((await h.tickets.adminList(admin, { search: customer.email })).total).toBe(1);
    expect((await h.tickets.adminList(admin, { category: "account" })).total).toBe(1);
    expect((await h.tickets.adminList(admin, { view: "urgent" })).data.map((t: any) => t._id)).toEqual([c._id]);
    expect((await h.tickets.adminList(admin, { priority: ["URGENT", "HIGH"] })).total).toBe(2); // payment (HIGH) + refund (now URGENT)
    expect((await h.tickets.adminList(admin, { sort: "priority" })).data[0]._id).toBe(c._id);
    const page2 = await h.tickets.adminList(admin, { page: 2, limit: 2, sort: "oldest" });
    expect(page2.total).toBe(3);
    expect(page2.data).toHaveLength(1);
    expect((await h.tickets.adminList(admin, { view: "unassigned" })).total).toBe(3);
  });

  it("escalation raises priority and alerts supervisors", async () => {
    const { h, customer, agent, lead, admin } = await setup();
    const t = await h.tickets.createForCustomer(customer, ticketInput({ category: "account" }));
    const up = await h.tickets.escalate(agent, t._id, "Customer is stranded at the property");
    expect(up.isEscalated).toBe(true);
    expect(up.priority).toBe("HIGH");
    const alert = h.notifications.find((n) => n.kind === "support.escalated")!;
    expect(alert.userIds).toEqual(expect.arrayContaining([lead.id, admin.id]));
    expect((await h.tickets.adminList(admin, { view: "escalated" })).total).toBe(1);
  });

  it("computes dashboard KPIs from stored data", async () => {
    const { h, customer, agent, admin } = await setup();
    const t1 = await h.tickets.createForCustomer(customer, ticketInput());
    const t2 = await h.tickets.createForCustomer(customer, ticketInput({ category: "payment" }));
    await h.tickets.createForCustomer(customer, ticketInput({ category: "technical" }));
    await h.tickets.update(admin, t2._id, { priority: "URGENT" });
    await h.tickets.replyAsStaff(agent, t1._id, { body: "Looking into it" });
    await h.tickets.update(agent, t1._id, { status: "RESOLVED" });

    const d = await h.dashboard.overview(admin);
    expect(d.totals.total).toBe(3);
    expect(d.totals.open).toBe(2);
    expect(d.totals.resolved).toBe(1);
    expect(d.totals.urgentOpen).toBe(1);
    expect(d.totals.unassignedOpen).toBe(2);
    expect(d.totals.resolvedToday).toBe(1);
    expect(d.averages.firstResponse.sample).toBe(1);
    expect(d.averages.resolution.sample).toBe(1);
    expect(d.byCategory.find((c: any) => c.key === "booking")).toMatchObject({ label: "Booking", count: 1 });
    expect(d.byPriority.find((p: any) => p.key === "URGENT")!.count).toBe(1);
    expect(d.workload).toEqual([]); // t1 is resolved, so nobody has open work
    const agentView = await h.dashboard.overview(agent);
    expect(agentView.scope).toBe("own_queue");
  });

  it("lets staff raise a ticket on a customer's behalf", async () => {
    const { h, customer, agent, lead } = await setup();
    await expect(h.tickets.adminCreate(agent, { ...ticketInput(), userId: customer.id, assignedTo: lead.id } as any)).rejects.toBeInstanceOf(ForbiddenException);
    const t = await h.tickets.adminCreate(agent, { ...ticketInput(), userId: customer.id, priority: "HIGH", assignedTo: agent.id } as any);
    expect(t.source).toBe("admin");
    expect(t.priority).toBe("HIGH");
    expect((await h.tickets.listMine(customer, {})).total).toBe(1);
    expect(h.notifications.some((n) => n.userIds.includes(customer.id) && n.deepLink === `/profile/support/${t._id}`)).toBe(true);
  });

  it("upgrades tickets from the first version in place", async () => {
    const { h, customer, agent } = await setup();
    const legacyId = new Types.ObjectId().toHexString();
    const created = new Date(Date.now() - 3 * 60 * 60 * 1000);
    h.models.tickets.store.set(legacyId, {
      _id: legacyId,
      userId: customer.id,
      title: "Old ticket",
      description: "From the old page",
      category: "payment_failed",
      status: "in_progress",
      priority: "high",
      assignedTo: agent.id,
      messages: [
        { senderId: customer.id, text: "Any update?", timestamp: new Date(created.getTime() + 60_000) },
        { senderId: agent.id, text: "Checking with the bank", timestamp: new Date(created.getTime() + 30 * 60_000) },
      ],
      createdAt: created,
      updatedAt: created,
    });
    await h.tickets.createForCustomer(customer, ticketInput()); // TIR-000001 already taken
    expect(await h.migration.upgradeLegacyTickets()).toBe(1);
    expect(await h.migration.upgradeLegacyTickets()).toBe(0);

    const row: any = await h.models.tickets.findById(legacyId).lean();
    expect(row.ticketNumber).toBe("TIR-000002");
    expect(row).toMatchObject({ subject: "Old ticket", status: "IN_PROGRESS", priority: "HIGH", category: "payment", categoryLabel: "Payment", messageCount: 2, firstResponseMinutes: 30 });
    expect(row.title).toBeUndefined();
    expect(row.messages).toBeUndefined();
    const mine = await h.tickets.getMine(customer, legacyId);
    expect(mine.messages.map((m: any) => m.senderType)).toEqual(["user", "staff"]);
  });

  it("never shows staff notes on status changes to the customer", async () => {
    const { h, customer, agent } = await setup();
    const t = await h.tickets.createForCustomer(customer, ticketInput());
    await h.tickets.update(agent, t._id, { category: "hotel_stay", note: "Owner is difficult, handle carefully" });
    await h.tickets.update(agent, t._id, { status: "RESOLVED", note: "Refund denied per owner" });
    const mine = await h.tickets.getMine(customer, t._id);
    expect(mine.activity.map((a: any) => a.action)).toEqual(["created", "category_changed", "status_changed"]);
    expect(JSON.stringify(mine)).not.toMatch(/difficult|denied/);
    const staffView = await h.tickets.adminGet(agent, t._id);
    expect(JSON.stringify(staffView.activity)).toContain("Refund denied per owner");
  });

  it("keeps raising tickets for customers to the support team", async () => {
    const { h, customer } = await setup();
    const mm = await h.register(actor("marketplace_manager"));
    await expect(h.tickets.adminCreate(mm, { ...ticketInput({ category: "marketplace" }), userId: customer.id } as any)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(h.tickets.searchCustomers(mm, "customer")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(h.tickets.adminList(customer, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(h.dashboard.overview(customer)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("keeps the legacy create route working", async () => {
    const { h, customer } = await setup();
    const t = await h.tickets.createLegacy(customer, { title: "Help", description: "short", category: "refund_request" });
    expect(t.category).toBe("refund");
    expect(t.ticketNumber).toMatch(/^TIR-\d{6}$/);
  });
});
