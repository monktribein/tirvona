import { BadRequestException } from "@nestjs/common";
import { LeadAttendanceService } from "./lead-attendance.service";
import type { AuthenticatedLeadUser } from "../domain/lead-collection.types";

describe("LeadAttendanceService", () => {
  const agent: AuthenticatedLeadUser = {
    id: "507f1f77bcf86cd799439011",
    name: "Ravindra",
    phone: "7535886336",
    email: "",
    role: "field_agent",
    status: "active",
    region: "",
    state: "Uttar Pradesh",
    district: "Mathura",
    employeeCode: "",
  };

  // In-memory fake collection so the DTO-to-schema write contract is
  // exercised the same way Mongoose strict mode would enforce it.
  function createAttendanceModelMock() {
    const ALLOWED_FIELDS = new Set([
      "agentId",
      "agentName",
      "agentPhone",
      "role",
      "state",
      "district",
      "date",
      "checkedIn",
      "checkInTime",
      "checkInFormattedTime",
      "checkInCoords",
      "checkInAddress",
      "checkInMapsUrl",
      "checkedOut",
      "checkOutTime",
      "checkOutFormattedTime",
      "checkOutCoords",
      "checkOutAddress",
      "checkOutMapsUrl",
      "totalWorkingMinutes",
      "formattedWorkingHours",
      "status",
      "notes",
    ]);

    let store: Record<string, any> | null = null;

    const matches = (filter: any, doc: Record<string, any> | null) => {
      if (!doc) return false;
      if (filter.date !== undefined && doc.date !== filter.date) return false;
      if (filter.$or) {
        return filter.$or.some((clause: any) =>
          Object.entries(clause).every(([k, v]) => String(doc[k]) === String(v)),
        );
      }
      return true;
    };

    const applySet = (set: Record<string, any>) => {
      for (const key of Object.keys(set)) {
        if (!ALLOWED_FIELDS.has(key)) {
          const err: any = new Error(
            `Path "${key}" is not in schema, strict mode is 'true', and upsert is 'true'.`,
          );
          err.name = "StrictModeError";
          throw err;
        }
      }
      store = { ...(store || {}), ...set };
    };

    return {
      findOne: jest.fn(async (filter: any) => (matches(filter, store) ? store : null)),
      findOneAndUpdate: jest.fn(async (filter: any, update: any, opts: any) => {
        const exists = matches(filter, store);
        if (!exists && !opts?.upsert) return null;
        applySet(update.$set);
        return store;
      }),
      __getStore: () => store,
    };
  }

  it("check-in succeeds without touching a non-schema userId field", async () => {
    const attendanceModel = createAttendanceModelMock();
    const service = new LeadAttendanceService(attendanceModel as any, {} as any);

    const result = await service.markCheckIn(agent, {
      coords: { lat: 27.58, lng: 77.7, accuracy: 10 },
      address: "Mathura, Uttar Pradesh",
    });

    expect(result.message).toBe("Check-in recorded successfully");
    expect(attendanceModel.__getStore()).toMatchObject({
      agentId: agent.id,
      checkedIn: true,
      checkedOut: false,
    });
  });

  it("does not create a duplicate record on a second check-in the same day", async () => {
    const attendanceModel = createAttendanceModelMock();
    const service = new LeadAttendanceService(attendanceModel as any, {} as any);

    await service.markCheckIn(agent, { coords: { lat: 27.58, lng: 77.7 } });
    const second = await service.markCheckIn(agent, { coords: { lat: 27.58, lng: 77.7 } });

    expect(second.message).toBe("Already checked in today");
    expect(attendanceModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it("rejects check-out before check-in", async () => {
    const attendanceModel = createAttendanceModelMock();
    const service = new LeadAttendanceService(attendanceModel as any, {} as any);

    await expect(
      service.markCheckOut(agent, { coords: { lat: 27.58, lng: 77.7 } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("checks out successfully after a check-in, using the same agentId identity", async () => {
    const attendanceModel = createAttendanceModelMock();
    const service = new LeadAttendanceService(attendanceModel as any, {} as any);

    await service.markCheckIn(agent, { coords: { lat: 27.58, lng: 77.7 } });
    const result = await service.markCheckOut(agent, { coords: { lat: 27.581, lng: 77.701 } });

    expect(result.message).toBe("Check-out recorded successfully");
    expect(attendanceModel.__getStore()).toMatchObject({
      agentId: agent.id,
      checkedOut: true,
    });
  });

  it("allows checking in again after a checkout completes (new shift, same day)", async () => {
    const attendanceModel = createAttendanceModelMock();
    const service = new LeadAttendanceService(attendanceModel as any, {} as any);

    await service.markCheckIn(agent, { coords: { lat: 27.58, lng: 77.7 } });
    await service.markCheckOut(agent, { coords: { lat: 27.581, lng: 77.701 } });
    const rein = await service.markCheckIn(agent, { coords: { lat: 27.582, lng: 77.702 } });

    expect(rein.message).toBe("Check-in recorded successfully");
    expect(attendanceModel.__getStore()).toMatchObject({
      checkedIn: true,
      checkedOut: false,
    });
  });
});
