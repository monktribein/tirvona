import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createHmac } from "node:crypto";
import { PartnerCryptoService } from "./partner-crypto.service";
import { PartnerWebhookDispatcherService } from "./partner-webhook-dispatcher.service";
import { PartnerWebhookWorker } from "./partner-webhook.worker";

// The receiver in this test runs on 127.0.0.1, which the SSRF guard (correctly) refuses in real use.
jest.mock("./ssrf-validator.util", () => ({ validateWebhookUrl: jest.fn().mockResolvedValue("ok") }));

const crypto = new PartnerCryptoService({ get: () => "test-secret-key-32-chars-at-least" } as any);

/** In-memory stand-in for the ORM models, just enough for the dispatcher + worker. */
const memoryModel = (rows: any[] = []) => ({
  rows,
  find: (q: any = {}) => {
    const match = (r: any) =>
      Object.entries(q).every(([k, v]: [string, any]) => {
        if (v && typeof v === "object" && "$in" in v) return v.$in.map(String).includes(String(r[k]));
        if (Array.isArray(r[k])) return r[k].includes(v);
        return String(r[k]) === String(v);
      });
    return { lean: async () => rows.filter(match) };
  },
  findOne: (q: any = {}) => {
    const row = rows.find((r) => Object.entries(q).every(([k, v]) => String(r[k]) === String(v)));
    if (row) row.save = async () => undefined;
    return Promise.resolve(row ?? null);
  },
  findById: (id: string) => {
    const row = rows.find((r) => String(r._id) === String(id));
    const p: any = Promise.resolve(row ?? null);
    p.select = () => Promise.resolve(row ?? null);
    p.lean = () => Promise.resolve(row ?? null);
    return p;
  },
  create: async (doc: any) => {
    const row = { ...doc, save: async () => undefined };
    rows.push(row);
    return row;
  },
});

describe("Partner webhook delivery (dispatcher -> worker -> HTTP receiver)", () => {
  let server: Server;
  let received: { headers: IncomingMessage["headers"]; body: string }[];
  let receiverStatus = 200;
  let url: string;
  let secret: string;

  const partners = memoryModel([
    { _id: "p-ok", status: "active", allowedPermissions: ["bookings.read", "payments.read"], scopedAshramIds: [] },
    { _id: "p-scoped", status: "active", allowedPermissions: ["bookings.read"], scopedAshramIds: ["ashram-A"] },
    { _id: "p-nopay", status: "active", allowedPermissions: ["bookings.read"], scopedAshramIds: [] },
    { _id: "p-off", status: "suspended", allowedPermissions: ["bookings.read"], scopedAshramIds: [] },
  ]);
  const webhooks = memoryModel();
  const events = memoryModel();
  const logs = memoryModel();
  const queued: any[] = [];
  const queue = { add: jest.fn(async (_name: string, data: any) => queued.push(data)) };

  beforeAll(async () => {
    received = [];
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        received.push({ headers: req.headers, body });
        res.statusCode = receiverStatus;
        res.end("ok");
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;

    secret = "whsec_testsecret1234";
    const enc = crypto.encryptSecret(secret);
    const base = {
      url,
      status: "active",
      secretCiphertext: enc.ciphertext,
      secretIv: enc.iv,
      secretTag: enc.tag,
      secretLast4: enc.last4,
    };
    for (const [i, partnerId] of ["p-ok", "p-scoped", "p-nopay", "p-off"].entries()) {
      webhooks.rows.push({
        ...base,
        _id: `w${i}`,
        partnerId,
        subscribedEvents: ["booking.created", "payment.succeeded"],
      });
    }
  });

  afterAll(async () => {
    await new Promise((r) => server.close(r));
  });

  const dispatcher = () =>
    new PartnerWebhookDispatcherService(partners as any, webhooks as any, events as any, queue as any);
  const worker = () => new PartnerWebhookWorker(webhooks as any, events as any, logs as any, crypto);
  const runJob = (data: any, attemptsMade = 0) => worker().process({ data, attemptsMade } as any);

  it("only fans out to partners that are active, permitted and in scope", async () => {
    queued.length = 0;
    await dispatcher().publishEvent("booking.created", { bookingId: "TRV-1", ashramId: "ashram-B" });
    // p-ok (global) and p-nopay (bookings.read) receive it; p-scoped is limited to ashram-A; p-off is suspended
    expect(queued.map((j) => j.webhookId).sort()).toEqual(["w0", "w2"]);

    queued.length = 0;
    await dispatcher().publishEvent("booking.created", { bookingId: "TRV-2", ashramId: "ashram-A" });
    expect(queued.map((j) => j.webhookId).sort()).toEqual(["w0", "w1", "w2"]);

    queued.length = 0;
    await dispatcher().publishEvent("payment.succeeded", { bookingId: "TRV-2", ashramId: "ashram-A" });
    // payment events need payments.read: only p-ok has it
    expect(queued.map((j) => j.webhookId)).toEqual(["w0"]);
  });

  it("delivers a signed envelope the receiver can verify", async () => {
    queued.length = 0;
    received.length = 0;
    await dispatcher().publishEvent("booking.created", { bookingId: "TRV-9", ashramId: "ashram-A", createdAt: new Date("2026-10-19") });
    const job = queued.find((j) => j.webhookId === "w0");
    await runJob(job);

    expect(received).toHaveLength(1);
    const { headers, body } = received[0];
    const envelope = JSON.parse(body);
    expect(envelope).toMatchObject({ type: "booking.created", apiVersion: "v1", data: { bookingId: "TRV-9" } });
    expect(envelope.id).toBe(job.eventId);
    expect(headers["x-tirvona-event"]).toBe("booking.created");
    expect(headers["x-tirvona-delivery-id"]).toBe(job.eventId);

    // Receiver-side verification, exactly as documented to partners.
    const [t, v1] = String(headers["x-tirvona-signature"]).split(",").map((p) => p.split("=")[1]);
    const expected = createHmac("sha256", secret).update(`t=${t}.${body}`).digest("hex");
    expect(v1).toBe(expected);

    expect(logs.rows.at(-1)).toMatchObject({ status: "success", responseStatusCode: 200, eventType: "booking.created" });
  });

  it("records a failure and lets the queue retry when the receiver errors", async () => {
    queued.length = 0;
    receiverStatus = 500;
    await dispatcher().publishEvent("booking.created", { bookingId: "TRV-10", ashramId: "ashram-A" });
    const job = queued.find((j) => j.webhookId === "w0");
    await expect(runJob(job)).rejects.toThrow(/Webhook returned HTTP 500/);
    expect(logs.rows.at(-1)).toMatchObject({ status: "failed", responseStatusCode: 500 });

    receiverStatus = 200;
    await runJob(job, 1); // BullMQ retry
    expect(logs.rows.at(-1)).toMatchObject({ status: "success", attemptNumber: 2 });
  });

  it("sends a signed test event on demand", async () => {
    received.length = 0;
    queued.length = 0;
    const eventId = await dispatcher().sendTestEvent("w0");
    expect(eventId).toBeTruthy();
    await runJob(queued[0]);
    const envelope = JSON.parse(received[0].body);
    expect(envelope.type).toBe("webhook.test");
  });
});
