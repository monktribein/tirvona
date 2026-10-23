import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { HrAccessService } from "../application/hr-access.service";
import { HrTasksService } from "../application/hr-tasks.service";
import {
  HrTaskCommentDto,
  HrTaskCreateDto,
  HrTaskOptionalNoteDto,
  HrTaskProgressDto,
  HrTaskQueryDto,
  HrTaskReasonDto,
  HrTaskReassignDto,
  HrTaskReviewDto,
  HrTaskSubmitDto,
  HrTaskUpdateDto,
} from "./hr.dto";

/**
 * Daily tasks. Who may do what is decided per task in HrTasksService: HR task staff manage
 * every task, a manager only their direct reports' tasks, and the assignee works on their own.
 */
@Controller("hr/tasks")
export class HrTasksController {
  constructor(
    private readonly access: HrAccessService,
    private readonly tasks: HrTasksService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: HrTaskQueryDto) {
    return { success: true, ...(await this.tasks.list(await this.access.resolve(user), query)) };
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: HrTaskCreateDto) {
    const data = await this.tasks.create(await this.access.resolve(user), dto);
    return { success: true, message: data.length > 1 ? `Task assigned to ${data.length} employees` : "Task assigned", data };
  }

  @Get(":id")
  async get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.tasks.get(await this.access.resolve(user), id) };
  }

  @Patch(":id")
  async update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: HrTaskUpdateDto) {
    return { success: true, message: "Task updated", data: await this.tasks.update(await this.access.resolve(user), id, dto) };
  }

  @Post(":id/start")
  async start(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, message: "Task started", data: await this.tasks.start(await this.access.resolve(user), id) };
  }

  @Post(":id/progress")
  async progress(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: HrTaskProgressDto) {
    return { success: true, message: "Progress saved", data: await this.tasks.progress(await this.access.resolve(user), id, dto.progressPercent, dto.note) };
  }

  @Post(":id/block")
  async block(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: HrTaskReasonDto) {
    return { success: true, message: "Task marked blocked", data: await this.tasks.block(await this.access.resolve(user), id, dto.reason) };
  }

  @Post(":id/unblock")
  async unblock(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: HrTaskOptionalNoteDto) {
    return { success: true, message: "Task unblocked", data: await this.tasks.unblock(await this.access.resolve(user), id, dto.note) };
  }

  @Post(":id/submit")
  async submit(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: HrTaskSubmitDto) {
    return { success: true, message: "Submitted for review", data: await this.tasks.submit(await this.access.resolve(user), id, dto) };
  }

  @Post(":id/review")
  async review(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: HrTaskReviewDto) {
    return {
      success: true,
      message: dto.decision === "approve" ? "Task approved" : "Task sent back",
      data: await this.tasks.review(await this.access.resolve(user), id, dto.decision, dto.comment),
    };
  }

  @Post(":id/reopen")
  async reopen(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: HrTaskReasonDto) {
    return { success: true, message: "Task reopened", data: await this.tasks.reopen(await this.access.resolve(user), id, dto.reason) };
  }

  @Post(":id/cancel")
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: HrTaskReasonDto) {
    return { success: true, message: "Task cancelled", data: await this.tasks.cancel(await this.access.resolve(user), id, dto.reason) };
  }

  @Post(":id/reassign")
  async reassign(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: HrTaskReassignDto) {
    return { success: true, message: "Task reassigned", data: await this.tasks.reassign(await this.access.resolve(user), id, dto.employeeId, dto.reason) };
  }

  @Post(":id/comments")
  async comment(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: HrTaskCommentDto) {
    return { success: true, message: "Comment added", data: await this.tasks.comment(await this.access.resolve(user), id, dto.message) };
  }
}
