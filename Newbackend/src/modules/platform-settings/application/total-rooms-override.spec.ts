import { PlatformSettingsService } from "./platform-settings.service";

describe("PlatformSettingsService - totalRoomsOverride", () => {
  let service: PlatformSettingsService;
  let mockModel: any;

  beforeEach(() => {
    mockModel = {
      findOneAndUpdate: jest.fn(),
    };
    service = new PlatformSettingsService(mockModel);
  });

  it("returns default totalRoomsOverride on initial get()", async () => {
    mockModel.findOneAndUpdate.mockResolvedValueOnce({
      key: "main",
      totalRoomsOverride: {
        enabled: false,
        totalRooms: null,
      },
    });

    const res = await service.get();
    expect(mockModel.findOneAndUpdate).toHaveBeenCalled();
    expect(res.totalRoomsOverride).toBeDefined();
    expect(res.totalRoomsOverride.enabled).toBe(false);
  });

  it("updates totalRoomsOverride fields when specified", async () => {
    mockModel.findOneAndUpdate
      .mockResolvedValueOnce({
        key: "main",
        notificationSound: {},
      })
      .mockResolvedValueOnce({
        key: "main",
        totalRoomsOverride: {
          enabled: true,
          totalRooms: 500,
          registeredRooms: 500,
        },
      });

    const user = { id: "admin-1", role: "super_admin" } as any;
    const dto = {
      totalRoomsOverride: {
        enabled: true,
        totalRooms: 500,
        registeredRooms: 500,
      },
    };

    const res = await service.update(user, dto);
    expect(mockModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
    const updateCall = mockModel.findOneAndUpdate.mock.calls[1];
    expect(updateCall[1].$set["totalRoomsOverride.enabled"]).toBe(true);
    expect(updateCall[1].$set["totalRoomsOverride.totalRooms"]).toBe(500);
    expect(updateCall[1].$set["totalRoomsOverride.registeredRooms"]).toBe(500);
    expect(res.totalRoomsOverride.enabled).toBe(true);
  });

  it("resets totalRoomsOverride when reset values are provided", async () => {
    mockModel.findOneAndUpdate
      .mockResolvedValueOnce({
        key: "main",
        notificationSound: {},
      })
      .mockResolvedValueOnce({
        key: "main",
        totalRoomsOverride: {
          enabled: false,
          totalRooms: null,
        },
      });

    const user = { id: "admin-1", role: "super_admin" } as any;
    const dto = {
      totalRoomsOverride: {
        enabled: false,
        totalRooms: null,
        registeredRooms: null,
      },
    };

    await service.update(user, dto);
    const updateCall = mockModel.findOneAndUpdate.mock.calls[1];
    expect(updateCall[1].$set["totalRoomsOverride.enabled"]).toBe(false);
    expect(updateCall[1].$set["totalRoomsOverride.totalRooms"]).toBeNull();
  });
});
