import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { UsersService } from "../application/users.service";
import {
  AdminResetPasswordDto,
  BulkDeleteUsersDto,
  ChangeRoleDto,
  CreateAccountDto,
  CreateStaffDto,
  PermissionsDto,
  PermanentDeleteDto,
  SuspendUserDto,
  UserQueryDto,
  UserStatusDto,
  UpdateAccountDto,
} from "./user.dto";
@Controller("users")
export class UsersController {
  constructor(private readonly service: UsersService) {}
  @Get("staff")
  @Roles(
    "ashram_admin",
    "ashram_owner",
    "stay_admin",
    "owner",
    "super_admin",
  )
  async staff(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.service.staff(user);
    return { success: true, count: data.length, data };
  }
  @Post("staff")
  @Roles(
    "ashram_admin",
    "ashram_owner",
    "stay_admin",
    "owner",
    "super_admin",
  )
  async createStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStaffDto,
  ) {
    return { success: true, data: await this.service.createStaff(user, dto) };
  }
  @Delete("staff/:id")
  @Roles(
    "ashram_admin",
    "ashram_owner",
    "stay_admin",
    "owner",
    "super_admin",
  )
  async removeStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    await this.service.removeStaff(user, id);
    return { success: true, message: "Staff member deactivated" };
  }
  @Get()
  @Roles("super_admin")
  async list(
    @Query() query: UserQueryDto,
  ) {
    const data = await this.service.list(query);
    return { success: true, count: data.length, data };
  }
  @Post("create-account") @Roles("super_admin") async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAccountDto,
  ) {
    const result = await this.service.createAccount(user, dto);
    return {
      success: true,
      message: "Account created successfully",
      tempPassword: result.tempPassword,
      data: result.user,
    };
  }
  @Patch(":id")
  @Roles("super_admin")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return {
      success: true,
      message: "Account details updated successfully",
      data: await this.service.updateAccount(user, id, dto),
    };
  }
  @Patch(":id/status") @Roles("super_admin") async status(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UserStatusDto,
  ) {
    return {
      success: true,
      message: `User status updated to ${dto.status}`,
      data: await this.service.status(user, id, dto.status),
    };
  }
  @Patch(":id/suspend") @Roles("super_admin") async suspend(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: SuspendUserDto,
  ) {
    return {
      success: true,
      message: `Account successfully suspended (${dto.suspensionType})`,
      data: await this.service.suspend(user, id, dto),
    };
  }
  @Patch(":id/reactivate") @Roles("super_admin") async reactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return {
      success: true,
      message: "Account successfully reactivated",
      data: await this.service.reactivate(user, id),
    };
  }
  @Patch(":id/role") @Roles("super_admin") async role(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ChangeRoleDto,
  ) {
    return {
      success: true,
      message: `Role changed to ${dto.role}`,
      data: await this.service.role(user, id, dto.role),
    };
  }
  @Patch(":id/permissions") @Roles("super_admin") async permissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: PermissionsDto,
  ) {
    return {
      success: true,
      message: "Permissions updated successfully",
      data: await this.service.permissions(user, id, dto.permissions),
    };
  }
  @Post(":id/reset-password") @Roles("super_admin") async reset(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: AdminResetPasswordDto,
  ) {
    const tempPassword = await this.service.reset(user, id, dto.password);
    return {
      success: true,
      message: "Password reset successfully",
      tempPassword,
    };
  }
  @Delete("bulk/soft-delete")
  @Roles("super_admin")
  async bulkSoftDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkDeleteUsersDto,
  ) {
    const count = await this.service.bulkSoftDelete(user, dto.ids);
    return {
      success: true,
      message: `${count} account(s) moved to Deleted Accounts`,
      count,
    };
  }
  @Delete(":id/soft-delete") @Roles("super_admin") async softDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return {
      success: true,
      message: "Account soft deleted. Moved to Deleted Accounts queue.",
      data: await this.service.softDelete(user, id),
    };
  }
  @Delete(":id/permanent-delete") @Roles("super_admin") async permanentDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: PermanentDeleteDto,
  ) {
    await this.service.permanentDelete(user, id, dto.adminPassword);
    return {
      success: true,
      message: "Account permanently purged from database.",
    };
  }
  @Patch(":id/restore") @Roles("super_admin") async restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return {
      success: true,
      message: "Account restored to Active status.",
      data: await this.service.restore(user, id),
    };
  }
}
