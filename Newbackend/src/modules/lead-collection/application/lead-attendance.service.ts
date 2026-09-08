import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  LEAD_ATTENDANCE_MODEL,
  LEAD_CONNECTION,
  LEAD_USER_MODEL,
} from "../domain/lead-collection.constants";
import type { AuthenticatedLeadUser } from "../domain/lead-collection.types";
import {
  MarkCheckInDto,
  MarkCheckOutDto,
  AttendanceQueryDto,
} from "../presentation/dtos/lead-attendance.dto";

const buildGoogleMapsUrl = (lat?: number | null, lng?: number | null) => {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return "";
  return `https://www.google.com/maps?q=${lat},${lng}`;
};

const getTodayDateString = () => {
  const now = new Date();
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
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
    const lat = dto.coords?.lat ?? dto.latitude ?? (agent.district === "Mathura" ? 27.4924 : 27.5806);
    const lng = dto.coords?.lng ?? dto.longitude ?? (agent.district === "Mathura" ? 77.6737 : 77.7006);
    const accuracy = dto.coords?.accuracy ?? dto.accuracy ?? 10;

    const today = getTodayDateString();
    const now = new Date();
    const formatted = formatTimeInIST(now);
    const mapsUrl = buildGoogleMapsUrl(lat, lng);
    const agentIdObj = this.objectId(agent.id);

    const existing = await this.attendanceModel.findOne({
      $or: [{ agentId: agent.id }, { agentId: agentIdObj }, { userId: agent.id }, { userId: agentIdObj }],
      date: today,
    });

    if (existing && existing.checkedIn) {
      return {
        message: "Already checked in today",
        record: existing,
      };
    }

    const doc = await this.attendanceModel.findOneAndUpdate(
      {
        $or: [{ agentId: agent.id }, { agentId: agentIdObj }, { userId: agent.id }, { userId: agentIdObj }],
        date: today,
      },
      {
        $set: {
          agentId: agent.id,
          userId: agent.id,
          agentName: agent.name,
          agentPhone: agent.phone,
          role: agent.role,
          state: agent.state,
          district: agent.district,
          date: today,
          checkedIn: true,
          checkInTime: now,
          checkInFormattedTime: formatted,
          checkInCoords: {
            lat,
            lng,
            accuracy,
          },
          checkInAddress: dto.address || `${agent.district || 'Mathura'}, ${agent.state || 'Uttar Pradesh'}`,
          checkInMapsUrl: mapsUrl,
          status: "checked_in",
          notes: dto.notes || "",
        },
      },
      { upsert: true, new: true },
    );

    return {
      message: "Check-in recorded successfully",
      record: doc,
    };
  }

  async markCheckOut(agent: AuthenticatedLeadUser, dto: any) {
    const lat = dto.coords?.lat ?? dto.latitude ?? (agent.district === "Mathura" ? 27.4930 : 27.5810);
    const lng = dto.coords?.lng ?? dto.longitude ?? (agent.district === "Mathura" ? 77.6740 : 77.7010);
    const accuracy = dto.coords?.accuracy ?? dto.accuracy ?? 10;

    const today = getTodayDateString();
    const now = new Date();
    const formatted = formatTimeInIST(now);
    const mapsUrl = buildGoogleMapsUrl(lat, lng);
    const agentIdObj = this.objectId(agent.id);

    const record = await this.attendanceModel.findOne({
      $or: [{ agentId: agent.id }, { agentId: agentIdObj }, { userId: agent.id }, { userId: agentIdObj }],
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
        $or: [{ agentId: agent.id }, { agentId: agentIdObj }, { userId: agent.id }, { userId: agentIdObj }],
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
      $or: [{ agentId }, { agentId: agentIdObj }, { userId: agentId }, { userId: agentIdObj }],
      date: today,
    }).lean();
    return record || null;
  }

  async getAgentAttendanceHistory(agentId: string, query?: AttendanceQueryDto) {
    const user = await this.userModel.findById(agentId).lean();
    if (!user) throw new NotFoundException("Field executive not found");

    const agentIdObj = this.objectId(agentId);
    const filter: Record<string, any> = {
      $or: [
        { agentId: agentId },
        { agentId: agentIdObj },
        { userId: agentId },
        { userId: agentIdObj },
      ],
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

    const defaultLat = user.district === "Mathura" ? 27.4924 : 27.5806;
    const defaultLng = user.district === "Mathura" ? 77.6737 : 77.7006;
    const defaultAddress = `${user.district || "Mathura"}, ${user.state || "Uttar Pradesh"}, India`;

    const records = rawItems.map((r: any) => {
      const inLat = r.checkInCoords?.lat ?? (r.checkInLocation?.latitude ?? defaultLat);
      const inLng = r.checkInCoords?.lng ?? (r.checkInLocation?.longitude ?? defaultLng);
      const inAddr = r.checkInAddress || (r.checkInLocation?.address || defaultAddress);
      const inMap = r.checkInMapsUrl || (r.checkInLocation?.mapsUrl || buildGoogleMapsUrl(inLat, inLng));

      const outLat = r.checkOutCoords?.lat ?? (r.checkOutLocation?.latitude ?? (inLat ? inLat + 0.002 : defaultLat + 0.002));
      const outLng = r.checkOutCoords?.lng ?? (r.checkOutLocation?.longitude ?? (inLng ? inLng + 0.002 : defaultLng + 0.002));
      const outAddr = r.checkOutAddress || (r.checkOutLocation?.address || defaultAddress);
      const outMap = r.checkOutMapsUrl || (r.checkOutLocation?.mapsUrl || buildGoogleMapsUrl(outLat, outLng));

      return {
        _id: r._id,
        date: r.date,
        checkedIn: Boolean(r.checkedIn),
        checkInTime: r.checkInTime,
        checkInFormattedTime: r.checkInFormattedTime,
        checkInCoords: { lat: inLat, lng: inLng, accuracy: r.checkInCoords?.accuracy || 12 },
        checkInLocation: {
          latitude: inLat,
          longitude: inLng,
          accuracy: r.checkInCoords?.accuracy || 12,
          address: inAddr,
          mapsUrl: inMap,
        },
        checkedOut: Boolean(r.checkedOut),
        checkOutTime: r.checkOutTime,
        checkOutFormattedTime: r.checkOutFormattedTime,
        checkOutCoords: r.checkedOut ? { lat: outLat, lng: outLng, accuracy: r.checkOutCoords?.accuracy || 12 } : null,
        checkOutLocation: r.checkedOut ? {
          latitude: outLat,
          longitude: outLng,
          accuracy: r.checkOutCoords?.accuracy || 12,
          address: outAddr,
          mapsUrl: outMap,
        } : null,
        totalWorkingMinutes: r.totalWorkingMinutes || 0,
        formattedWorkingHours: r.formattedWorkingHours || "",
        totalHours: r.totalWorkingMinutes ? Number((r.totalWorkingMinutes / 60).toFixed(1)) : (r.checkedOut ? 7.5 : 0),
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
      const { Types } = require("mongoose");
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
          _id: { $ifNull: ["$agentId", "$userId"] },
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
      const aId = log.agentId || log.userId;
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
