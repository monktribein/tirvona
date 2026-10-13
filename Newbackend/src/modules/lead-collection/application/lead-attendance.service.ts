import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import { Model, Types } from "../../../database/orm";
import {
  LEAD_ATTENDANCE_MODEL,
  LEAD_CONNECTION,
  LEAD_USER_MODEL,
} from "../domain/lead-collection.constants";
import type { AuthenticatedLeadUser } from "../domain/lead-collection.types";
import {
  AttendanceQueryDto,
} from "../presentation/dtos/lead-attendance.dto";

const buildGoogleMapsUrl = (lat?: number | null, lng?: number | null) => {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return "";
  return `https://www.google.com/maps?q=${lat},${lng}`;
};

const finiteOrNull = (value: unknown): number | null => {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

/** The device fix sent with a check-in or check-out, or nulls when there was none. */
const readCoords = (dto: any) => {
  const lat = finiteOrNull(dto?.coords?.lat ?? dto?.latitude);
  const lng = finiteOrNull(dto?.coords?.lng ?? dto?.longitude);
  const valid = lat !== null && lng !== null && !(lat === 0 && lng === 0);
  return {
    lat: valid ? lat : null,
    lng: valid ? lng : null,
    accuracy: valid ? finiteOrNull(dto?.coords?.accuracy ?? dto?.accuracy) : null,
  };
};

const getTodayDateString = () => {
  // Keyed in IST so the attendance day rolls over at local midnight,
  // not UTC midnight (which would flip "today" at 5:30am IST).
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
};

const formatTimeInIST = (date: Date) => {
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
};

@Injectable()
export class LeadAttendanceService {
  constructor(
    @InjectModel(LEAD_ATTENDANCE_MODEL, LEAD_CONNECTION)
    private readonly attendanceModel: Model<any>,
    @InjectModel(LEAD_USER_MODEL, LEAD_CONNECTION)
    private readonly userModel: Model<any>,
  ) {}

  async markCheckIn(agent: AuthenticatedLeadUser, dto: any) {
    // Only a real device fix is stored. An invented point would show up on the
    // route map and add a phantom leg to the day's distance.
    const { lat, lng, accuracy } = readCoords(dto);

    const today = getTodayDateString();
    const now = new Date();
    const formatted = formatTimeInIST(now);
    const mapsUrl = buildGoogleMapsUrl(lat, lng);
    const agentIdObj = this.objectId(agent.id);

    const existing = await this.attendanceModel.findOne({
      $or: [{ agentId: agent.id }, { agentId: agentIdObj }],
      date: today,
    });

    if (existing && existing.checkedIn && !existing.checkedOut) {
      return {
        message: "Already checked in today",
        record: existing,
      };
    }

    const update = {
      $set: {
        agentId: agent.id,
        agentName: agent.name,
        agentPhone: agent.phone,
        role: agent.role,
        state: agent.state,
        district: agent.district,
        date: today,
        checkedIn: true,
        checkedOut: false,
        checkInTime: now,
        checkInFormattedTime: formatted,
        checkInCoords: {
          lat,
          lng,
          accuracy,
        },
        checkInAddress: dto.address || `${agent.district || 'Mathura'}, ${agent.state || 'Uttar Pradesh'}`,
        checkInMapsUrl: mapsUrl,
        checkOutTime: null,
        checkOutFormattedTime: "",
        status: "checked_in",
        notes: dto.notes || "",
      },
    };
    const filter = {
      $or: [{ agentId: agent.id }, { agentId: agentIdObj }],
      date: today,
    };

    let doc;
    try {
      doc = await this.attendanceModel.findOneAndUpdate(filter, update, {
        upsert: true,
        new: true,
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        doc = await this.attendanceModel.findOneAndUpdate(filter, update, { new: true });
      } else {
        throw err;
      }
    }

    return {
      message: "Check-in recorded successfully",
      record: doc,
    };
  }

  async markCheckOut(agent: AuthenticatedLeadUser, dto: any) {
    const { lat, lng, accuracy } = readCoords(dto);

    const today = getTodayDateString();
    const now = new Date();
    const formatted = formatTimeInIST(now);
    const mapsUrl = buildGoogleMapsUrl(lat, lng);
    const agentIdObj = this.objectId(agent.id);

    const record = await this.attendanceModel.findOne({
      $or: [{ agentId: agent.id }, { agentId: agentIdObj }],
      date: today,
    });

    if (!record || !record.checkInTime) {
      throw new BadRequestException("You must check in first before checking out");
    }

    const diffMs = Math.max(0, now.getTime() - new Date(record.checkInTime).getTime());
    const totalMinutes = Math.round(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const formattedHours = hours > 0 ? `${hours} hr ${mins} min` : `${mins} min`;

    const status = totalMinutes >= 240 ? "present" : "half_day";

    const updated = await this.attendanceModel.findOneAndUpdate(
      {
        $or: [{ agentId: agent.id }, { agentId: agentIdObj }],
        date: today,
      },
      {
        $set: {
          checkedOut: true,
          checkOutTime: now,
          checkOutFormattedTime: formatted,
          checkOutCoords: {
            lat,
            lng,
            accuracy,
          },
          checkOutAddress: dto.address || `${agent.district || 'Mathura'}, ${agent.state || 'Uttar Pradesh'}`,
          checkOutMapsUrl: mapsUrl,
          totalWorkingMinutes: totalMinutes,
          formattedWorkingHours: formattedHours,
          status,
          notes: dto.notes ? `${record.notes || ''} | ${dto.notes}`.trim() : record.notes,
        },
      },
      { new: true },
    );

    return {
      message: "Check-out recorded successfully",
      record: updated,
    };
  }

  async getTodayStatus(agentId: string) {
    const today = getTodayDateString();
    const agentIdObj = this.objectId(agentId);
    const record = await this.attendanceModel.findOne({
      $or: [{ agentId }, { agentId: agentIdObj }],
      date: today,
    }).lean();
    return record || null;
  }

  async getAgentAttendanceHistory(agentId: string, query?: AttendanceQueryDto) {
    const user = await this.userModel.findById(agentId).lean();
    if (!user) throw new NotFoundException("Field executive not found");

    const agentIdObj = this.objectId(agentId);
    const filter: Record<string, any> = {
      $or: [{ agentId: agentId }, { agentId: agentIdObj }],
    };
    if (query?.date) filter.date = query.date;
    if (query?.startDate || query?.endDate) {
      filter.date = {};
      if (query.startDate) filter.date.$gte = query.startDate;
      if (query.endDate) filter.date.$lte = query.endDate;
    }

    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 31));
    const page = Math.max(1, Number(query?.page) || 1);

    const [rawItems, total] = await Promise.all([
      this.attendanceModel
        .find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.attendanceModel.countDocuments(filter),
    ]);

    // Calculate aggregated stats
    const allRecords = await this.attendanceModel.find(filter).lean();
    const totalDaysPresent = allRecords.filter((r) => r.checkedIn).length;
    const totalMinutesWorked = allRecords.reduce((sum, r) => sum + (r.totalWorkingMinutes || 0), 0);
    const totalHoursNum = Number((totalMinutesWorked / 60).toFixed(1));

    const defaultAddress = `${user.district || "Mathura"}, ${user.state || "Uttar Pradesh"}, India`;

    // A missing fix stays missing: the dashboards say "No GPS coords" rather
    // than plot an invented point.
    const location = (coords: any, legacy: any, address: string, mapsUrl: string) => {
      const latitude = coords?.lat ?? legacy?.latitude ?? null;
      const longitude = coords?.lng ?? legacy?.longitude ?? null;
      if (latitude === null || longitude === null) return null;
      return {
        latitude,
        longitude,
        accuracy: coords?.accuracy ?? legacy?.accuracy ?? null,
        address: address || legacy?.address || defaultAddress,
        mapsUrl: mapsUrl || legacy?.mapsUrl || buildGoogleMapsUrl(latitude, longitude),
      };
    };

    const records = rawItems.map((r: any) => {
      const checkInLocation = location(r.checkInCoords, r.checkInLocation, r.checkInAddress, r.checkInMapsUrl);
      const checkOutLocation = r.checkedOut
        ? location(r.checkOutCoords, r.checkOutLocation, r.checkOutAddress, r.checkOutMapsUrl)
        : null;
      const toCoords = (loc: any) => (loc ? { lat: loc.latitude, lng: loc.longitude, accuracy: loc.accuracy } : null);

      return {
        _id: r._id,
        date: r.date,
        checkedIn: Boolean(r.checkedIn),
        checkInTime: r.checkInTime,
        checkInFormattedTime: r.checkInFormattedTime,
        checkInCoords: toCoords(checkInLocation),
        checkInLocation,
        checkedOut: Boolean(r.checkedOut),
        checkOutTime: r.checkOutTime,
        checkOutFormattedTime: r.checkOutFormattedTime,
        checkOutCoords: toCoords(checkOutLocation),
        checkOutLocation,
        totalWorkingMinutes: r.totalWorkingMinutes || 0,
        formattedWorkingHours: r.formattedWorkingHours || "",
        totalHours: r.totalWorkingMinutes ? Number((r.totalWorkingMinutes / 60).toFixed(1)) : 0,
        status: r.status || (r.checkedOut ? "present" : "checked_in"),
        notes: r.notes || "",
      };
    });

    const summary = {
      totalDaysPresent,
      totalWorkingHours: totalHoursNum,
      totalHoursWorked: `${totalHoursNum} hrs`,
      totalMinutesWorked,
      totalRecords: total,
    };

    return {
      agent: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        state: user.state,
        district: user.district,
        employeeCode: user.employeeCode,
      },
      summary,
      stats: summary,
      records,
      items: records,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  private objectId(id: string): any {
    try {
      return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : id;
    } catch {
      return id;
    }
  }

  async getDistrictTodayAttendance(district: string) {
    const today = getTodayDateString();
    const filter: Record<string, any> = { date: today };
    if (district) filter.district = district;

    return this.attendanceModel
      .find(filter)
      .sort({ checkInTime: -1 })
      .lean();
  }

  async getAllAgentsAttendanceSummary() {
    const today = getTodayDateString();
    const todayLogs = await this.attendanceModel.find({ date: today }).lean();
    
    // Aggregation for all agents total days present
    const totals = await this.attendanceModel.aggregate([
      { $match: { checkedIn: true } },
      {
        $group: {
          _id: "$agentId",
          daysPresent: { $sum: 1 },
          totalMinutes: { $sum: "$totalWorkingMinutes" },
          lastAttendanceDate: { $max: "$date" },
        },
      },
    ]);

    const summaryMap: Record<string, any> = {};
    for (const t of totals) {
      if (t._id) {
        summaryMap[String(t._id)] = {
          daysPresent: t.daysPresent,
          totalHours: (t.totalMinutes / 60).toFixed(1),
          lastAttendanceDate: t.lastAttendanceDate,
        };
      }
    }

    const todayMap: Record<string, any> = {};
    for (const log of todayLogs) {
      const aId = log.agentId;
      if (aId) {
        todayMap[String(aId)] = log;
      }
    }

    return {
      summaryMap,
      todayMap,
    };
  }
}
