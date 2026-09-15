import { NotificationOutboxService } from "./notification-outbox.service";

describe("NotificationOutboxService WhatsApp recovery", () => {
  it("never re-enqueues a send whose delivery Meta left unconfirmed", async () => {
    const filters: Array<Record<string, any>> = [];
    const model = () => ({
      find: jest.fn((filter: Record<string, any>) => {
        filters.push(filter);
        return {
          sort: () => ({ limit: () => ({ lean: async () => [] }) }),
        };
      }),
      updateOne: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
      collection: { collectionName: "test_notifications" },
    });
    const service = new NotificationOutboxService(
      { getJob: jest.fn(), add: jest.fn() } as never,
      model() as never,
      model() as never,
      model() as never,
      model() as never,
      model() as never,
      { doesExist: jest.fn().mockReturnValue(true) } as never,
    );

    await service.dispatch();

    const recovery = filters.find((filter) => filter.status === "sent");
    expect(recovery?.["meta.whatsappStatus"]).toEqual({
      $nin: ["sent", "unconfirmed"],
    });
    expect(recovery?.["meta.whatsappReason"]).toEqual({
      $ne: "test_mode_recipient_not_allowed",
    });
  });
});
