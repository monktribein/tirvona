import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { Permissions } from "../../../common/decorators/permissions.decorator";
import { HR_PERMISSIONS } from "../domain/hr.constants";
import { HrAccessService } from "../application/hr-access.service";
import { HrAttendanceService } from "../application/hr-attendance.service";
import { HrEmployeesService } from "../application/hr-employees.service";
import { HrOrganisationService } from "../application/hr-organisation.service";
import { HrReportsService } from "../application/hr-reports.service";
import {
  HrAccountLookupDto,
  HrDashboardQueryDto,
  HrDepartmentDto,
  HrDepartmentUpdateDto,
  HrDesignationDto,
  HrDesignationUpdateDto,
  HrEmployeeDto,
  HrEmployeeQueryDto,
  HrEmployeeStatusDto,
  HrEmployeeUpdateDto,
  HrOfficeDto,
  HrOfficeUpdateDto,
  HrRangeQueryDto,
  HrSettingsDto,
  HrTaskReportQueryDto,
} from "./hr.dto";

/**
 * HR administration: dashboard, offices, departments, designations, employees, settings and
 * reports. Every service call re-checks the caller's HR permissions and scope; the
 * @Permissions markers below are an extra gate on the routes that need exactly one permission.
 */
@Controller("hr")
export class HrAdminController {
  constructor(
    private readonly access: HrAccessService,
    private readonly organisation: HrOrganisationService,
    private readonly employees: HrEmployeesService,
    private readonly reports: HrReportsService,
    private readonly attendance: HrAttendanceService,
  ) {}

  @Get("dashboard")
  async dashboard(@CurrentUser() user: AuthenticatedUser, @Query() query: HrDashboardQueryDto) {
    return { success: true, data: await this.reports.dashboard(await this.access.resolve(user), query) };
  }

  // ---- offices

  @Get("offices")
  async offices(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.organisation.listOffices(await this.access.resolve(user)) };
  }

  @Permissions(HR_PERMISSIONS.employees)
  @Post("offices")
  async createOffice(@CurrentUser() user: AuthenticatedUser, @Body() dto: HrOfficeDto) {
    return { success: true, message: "Office added", data: await this.organisation.createOffice(await this.access.resolve(user), dto) };
  }

  @Permissions(HR_PERMISSIONS.employees)
  @Patch("offices/:id")
  async updateOffice(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: HrOfficeUpdateDto) {
    return { success: true, message: "Office updated", data: await this.organisation.updateOffice(await this.access.resolve(user), id, dto) };
  }

  // ---- departments and designations

  @Get("departments")
  async departments(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.organisation.listDepartments(await this.access.resolve(user)) };
  }

  @Permissions(HR_PERMISSIONS.employees)
  @Post("departments")
  async createDepartment(@CurrentUser() user: AuthenticatedUser, @Body() dto: HrDepartmentDto) {
    return { success: true, message: "Department added", data: await this.organisation.createDepartment(await this.access.resolve(user), dto) };
  }

  @Permissions(HR_PERMISSIONS.employees)
  @Patch("departments/:id")
  async updateDepartment(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: HrDepartmentUpdateDto) {
    return { success: true, message: "Department updated", data: await this.organisation.updateDepartment(await this.access.resolve(user), id, dto) };
  }

  @Get("designations")
  async designations(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.organisation.listDesignations(await this.access.resolve(user)) };
  }

  @Permissions(HR_PERMISSIONS.employees)
  @Post("designations")
  async createDesignation(@CurrentUser() user: AuthenticatedUser, @Body() dto: HrDesignationDto) {
    return { success: true, message: "Designation added", data: await this.organisation.createDesignation(await this.access.resolve(user), dto) };
  }

  @Permissions(HR_PERMISSIONS.employees)
  @Patch("designations/:id")
  async updateDesignation(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: HrDesignationUpdateDto) {
    return { success: true, message: "Designation updated", data: await this.organisation.updateDesignation(await this.access.resolve(user), id, dto) };
  }

  // ---- settings

  @Get("settings")
  async settings(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.organisation.getSettings(await this.access.resolve(user)) };
  }

  @Permissions(HR_PERMISSIONS.employees)
  @Patch("settings")
  async updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: HrSettingsDto) {
    return { success: true, message: "HR settings saved", data: await this.organisation.updateSettings(await this.access.resolve(user), dto) };
  }

  // ---- employees

  @Get("employees")
  async listEmployees(@CurrentUser() user: AuthenticatedUser, @Query() query: HrEmployeeQueryDto) {
    return { success: true, ...(await this.employees.list(await this.access.resolve(user), query)) };
  }

  /** Declared before ":id" so "directory" is not read as an id. */
  @Get("employees/directory")
  async directory(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.employees.directory(await this.access.resolve(user)) };
  }

  @Get("employees/:id")
  async getEmployee(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.employees.get(await this.access.resolve(user), id) };
  }

  @Permissions(HR_PERMISSIONS.employees)
  @Post("employees")
  async createEmployee(@CurrentUser() user: AuthenticatedUser, @Body() dto: HrEmployeeDto) {
    return { success: true, message: "Employee added", data: await this.employees.create(await this.access.resolve(user), dto) };
  }

  @Permissions(HR_PERMISSIONS.employees)
  @Patch("employees/:id")
  async updateEmployee(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: HrEmployeeUpdateDto) {
    return { success: true, message: "Employee updated", data: await this.employees.update(await this.access.resolve(user), id, dto) };
  }

  @Permissions(HR_PERMISSIONS.employees)
  @Patch("employees/:id/status")
  async setEmployeeStatus(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: HrEmployeeStatusDto) {
    return {
      success: true,
      message: dto.status === "inactive" ? "Employee deactivated" : "Employee reactivated",
      data: await this.employees.setStatus(await this.access.resolve(user), id, dto),
    };
  }

  @Permissions(HR_PERMISSIONS.employees)
  @Get("account-lookup")
  async accountLookup(@CurrentUser() user: AuthenticatedUser, @Query() query: HrAccountLookupDto) {
    return { success: true, data: await this.employees.accountLookup(await this.access.resolve(user), query) };
  }

  // ---- reports

  @Permissions(HR_PERMISSIONS.reports)
  @Get("reports/tasks")
  async taskReport(@CurrentUser() user: AuthenticatedUser, @Query() query: HrTaskReportQueryDto) {
    return { success: true, data: await this.reports.taskReport(await this.access.resolve(user), query) };
  }

  @Get("reports/attendance")
  async attendanceReport(@CurrentUser() user: AuthenticatedUser, @Query() query: HrRangeQueryDto) {
    return { success: true, data: await this.attendance.summary(await this.access.resolve(user), query) };
  }
}
