import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import type { CreateTicketDto } from "../presentation/support.dto";
@Injectable()
export class SupportService {
  constructor(
    @InjectModel("SupportTicket") private readonly tickets: Model<any>,
  ) {}
  create(user: AuthenticatedUser, dto: CreateTicketDto): Promise<any> {
    return this.tickets.create({ ...dto, userId: user.id, status: "open" });
  }
  list(user: AuthenticatedUser): Promise<any[]> {
    const filter =
      user.role === "super_admin"
        ? {}
        : user.role === "support"
          ? { $or: [{ assignedTo: user.id }, { assignedTo: null }] }
          : { userId: user.id };
    return this.tickets
      .find(filter)
      .populate("userId", "name email phone")
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 })
      .lean();
  }
  private allowed(user: AuthenticatedUser, row: any): boolean {
    return (
      String(row.userId) === user.id ||
      ["support", "super_admin"].includes(user.role)
    );
  }
  async message(
    user: AuthenticatedUser,
    id: string,
    text: string,
  ): Promise<any> {
    const row = await this.tickets.findById(id);
    if (!row) throw new NotFoundException("Ticket not found");
    if (!this.allowed(user, row))
      throw new ForbiddenException("Not authorized to comment on this ticket");
    if (user.role === "support" && !row.assignedTo) {
      row.assignedTo = user.id;
      row.status = "in_progress";
    }
    row.messages.push({ senderId: user.id, text, timestamp: new Date() });
    return row.save();
  }
  async resolve(user: AuthenticatedUser, id: string): Promise<any> {
    const row = await this.tickets.findById(id);
    if (!row) throw new NotFoundException("Ticket not found");
    if (!this.allowed(user, row))
      throw new ForbiddenException("Not authorized");
    row.status = "resolved";
    return row.save();
  }
}
