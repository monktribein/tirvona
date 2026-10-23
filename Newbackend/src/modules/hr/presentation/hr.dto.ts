import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { IsEntityId } from "../../../common/decorators/is-entity-id.decorator";
import {
  HR_ATTENDANCE_STATUSES,
  HR_EMPLOYEE_STATUSES,
  HR_EMPLOYMENT_TYPES,
  HR_LEAVE_STATUSES,
  HR_LEAVE_TYPES,
  HR_CORRECTION_STATUSES,
  HR_TASK_PRIORITIES,
  HR_TASK_STATUSES,
} from "../domain/hr.constants";

const trim = () => Transform(({ value }) => (typeof value === "string" ? value.trim() : value));

/** An empty form field means "not given". */
const blankToUndefined = () =>
  Transform(({ value }) => {
    const text = typeof value === "string" ? value.trim() : value;
    return text === "" ? undefined : text;
  });

/** Query-string booleans arrive as "true" / "1". */
const queryBoolean = () =>
  Transform(({ value }) => (value === true || value === "true" || value === "1" ? true : value === false || value === "false" || value === "0" ? false : value));

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_KEY_MESSAGE = { message: "Use a date in the format YYYY-MM-DD" };
const OFFICE_CODE = /^[A-Za-z0-9-]{2,20}$/;
const EMPLOYEE_CODE = /^[A-Za-z0-9-]{2,30}$/;
const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

const asList = () =>
  Transform(({ value }) => (Array.isArray(value) ? value : typeof value === "string" && value ? value.split(",") : value));

export class PageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

// ---------------------------------------------------------------- offices, departments, designations

export class HrOfficeDto {
  @trim() @IsString() @Matches(OFFICE_CODE, { message: "Office code: 2-20 letters, digits or dashes" }) code: string;
  @trim() @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @trim() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @trim() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @trim() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @blankToUndefined() @IsEmail() @MaxLength(120) email?: string;
}

export class HrOfficeUpdateDto {
  @IsOptional() @trim() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @trim() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @trim() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @trim() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @trim() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class HrDepartmentDto {
  @trim() @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsOptional() @trim() @IsString() @MaxLength(300) description?: string;
}

export class HrDepartmentUpdateDto {
  @IsOptional() @trim() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @trim() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class HrDesignationDto {
  @trim() @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsOptional() @blankToUndefined() @IsEntityId() departmentId?: string;
}

export class HrDesignationUpdateDto {
  @IsOptional() @trim() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  /** Empty string clears the department. */
  @IsOptional() @trim() @IsString() departmentId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class HrSettingsDto {
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true })
  weeklyOffDays?: number[];
  @IsOptional() @IsInt() @Min(1) @Max(72) dueSoonHours?: number;
}

// ---------------------------------------------------------------- employees

export class HrEmployeeDto {
  /** Leave empty to generate the next EMP-#### code. */
  @IsOptional() @blankToUndefined() @IsString() @Matches(EMPLOYEE_CODE, { message: "Employee ID: 2-30 letters, digits or dashes" })
  employeeCode?: string;
  @trim() @IsString() @MinLength(2) @MaxLength(120) fullName: string;
  @IsOptional() @blankToUndefined() @IsEmail() @MaxLength(120) workEmail?: string;
  @IsOptional() @blankToUndefined() @IsString() @Matches(/^\+?[0-9 ()-]{7,20}$/, { message: "Enter a valid contact number" }) phone?: string;
  @IsOptional() @blankToUndefined() @IsUrl({ protocols: ["https"], require_protocol: true }) @MaxLength(500) photoUrl?: string;
  @IsEntityId() primaryOfficeId: string;
  /** Extra offices for someone who works from more than one. */
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsEntityId({ each: true }) officeIds?: string[];
  @IsOptional() @blankToUndefined() @IsEntityId() departmentId?: string;
  @IsOptional() @blankToUndefined() @IsEntityId() designationId?: string;
  @IsOptional() @blankToUndefined() @IsEntityId() reportingManagerId?: string;
  @IsOptional() @IsIn(HR_EMPLOYMENT_TYPES as unknown as string[]) employmentType?: string;
  @IsOptional() @blankToUndefined() @Matches(DATE_KEY, DATE_KEY_MESSAGE) joiningDate?: string;
  @IsOptional() @trim() @IsString() @MaxLength(2000) responsibilities?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(60, { each: true }) skills?: string[];
  @IsOptional() @trim() @IsString() @MaxLength(2000) notes?: string;
  /** Links an existing Tirvona login. Grants no access by itself. */
  @IsOptional() @blankToUndefined() @IsEntityId() userId?: string;
}

/** Every field optional; an empty string clears an optional link (department, manager, login...). */
export class HrEmployeeUpdateDto {
  @IsOptional() @trim() @IsString() @MinLength(2) @MaxLength(120) fullName?: string;
  @IsOptional() @trim() @IsString() @MaxLength(120) workEmail?: string;
  @IsOptional() @trim() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @trim() @IsString() @MaxLength(500) photoUrl?: string;
  @IsOptional() @IsEntityId() primaryOfficeId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsEntityId({ each: true }) officeIds?: string[];
  @IsOptional() @trim() @IsString() departmentId?: string;
  @IsOptional() @trim() @IsString() designationId?: string;
  @IsOptional() @trim() @IsString() reportingManagerId?: string;
  @IsOptional() @IsIn(HR_EMPLOYMENT_TYPES as unknown as string[]) employmentType?: string;
  @IsOptional() @trim() @IsString() joiningDate?: string;
  @IsOptional() @trim() @IsString() @MaxLength(2000) responsibilities?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(60, { each: true }) skills?: string[];
  @IsOptional() @trim() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @trim() @IsString() userId?: string;
}

export class HrEmployeeStatusDto {
  @IsIn(HR_EMPLOYEE_STATUSES as unknown as string[]) status: "active" | "inactive";
  @IsOptional() @trim() @IsString() @MaxLength(300) reason?: string;
}

export class HrEmployeeQueryDto extends PageQueryDto {
  @IsOptional() @trim() @IsString() @MaxLength(80) search?: string;
  @IsOptional() @IsEntityId() officeId?: string;
  @IsOptional() @IsEntityId() departmentId?: string;
  @IsOptional() @IsEntityId() designationId?: string;
  @IsOptional() @IsEntityId() managerId?: string;
  @IsOptional() @IsIn(["active", "inactive", "all"]) status?: string;
  @IsOptional() @IsIn(["name", "code", "joiningDate", "createdAt"]) sort?: string;
  @IsOptional() @IsIn(["asc", "desc"]) order?: "asc" | "desc";
}

export class HrAccountLookupDto {
  @IsOptional() @blankToUndefined() @IsEmail() email?: string;
  @IsOptional() @blankToUndefined() @IsString() @MaxLength(20) phone?: string;
}

// ---------------------------------------------------------------- tasks

export class HrTaskCreateDto {
  @trim() @IsString() @MinLength(3) @MaxLength(160) title: string;
  @IsOptional() @trim() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @trim() @IsString() @MaxLength(1000) expectedOutcome?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @IsEntityId({ each: true }) employeeIds: string[];
  /** Must be true to give the same task to more than one employee. */
  @IsOptional() @IsBoolean() assignToMultiple?: boolean;
  /** IST date the work is for; defaults to today. */
  @IsOptional() @Matches(DATE_KEY, DATE_KEY_MESSAGE) assignedDate?: string;
  @IsDateString() dueAt: string;
  @IsOptional() @IsIn(HR_TASK_PRIORITIES as unknown as string[]) priority?: string;
  /** Generated once per form, so a retried or double-clicked request creates the task once. */
  @IsOptional() @IsString() @Matches(REQUEST_ID) idempotencyKey?: string;
}

export class HrTaskUpdateDto {
  @IsOptional() @trim() @IsString() @MinLength(3) @MaxLength(160) title?: string;
  @IsOptional() @trim() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @trim() @IsString() @MaxLength(1000) expectedOutcome?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsIn(HR_TASK_PRIORITIES as unknown as string[]) priority?: string;
}

export class HrTaskQueryDto extends PageQueryDto {
  @IsOptional() @IsEntityId() employeeId?: string;
  @IsOptional() @IsEntityId() officeId?: string;
  @IsOptional() @IsEntityId() departmentId?: string;
  @IsOptional() @asList() @IsArray() @IsIn(HR_TASK_STATUSES as unknown as string[], { each: true }) status?: string[];
  @IsOptional() @IsIn(HR_TASK_PRIORITIES as unknown as string[]) priority?: string;
  /** Assigned on exactly this IST date. */
  @IsOptional() @Matches(DATE_KEY, DATE_KEY_MESSAGE) date?: string;
  @IsOptional() @Matches(DATE_KEY, DATE_KEY_MESSAGE) from?: string;
  @IsOptional() @Matches(DATE_KEY, DATE_KEY_MESSAGE) to?: string;
  /** Approved (completed) on this IST date. */
  @IsOptional() @Matches(DATE_KEY, DATE_KEY_MESSAGE) completedOn?: string;
  @IsOptional() @queryBoolean() @IsBoolean() overdue?: boolean;
  @IsOptional() @trim() @IsString() @MaxLength(80) search?: string;
}

export class HrMyTasksQueryDto extends PageQueryDto {
  @IsOptional() @IsIn(["today", "open", "history"]) view?: "today" | "open" | "history";
}

export class HrTaskProgressDto {
  @IsOptional() @IsInt() @Min(0) @Max(100) progressPercent?: number;
  @trim() @IsString() @MinLength(2) @MaxLength(1000) note: string;
}

export class HrTaskReasonDto {
  @trim() @IsString() @MinLength(3) @MaxLength(1000) reason: string;
}

export class HrTaskOptionalNoteDto {
  @IsOptional() @trim() @IsString() @MaxLength(1000) note?: string;
}

export class HrTaskSubmitDto {
  @trim() @IsString() @MinLength(3) @MaxLength(4000) completionSummary: string;
  @IsOptional() @blankToUndefined() @IsUrl({ protocols: ["https", "http"], require_protocol: true }) @MaxLength(500) deliverableUrl?: string;
}

export class HrTaskReviewDto {
  @IsIn(["approve", "reject"]) decision: "approve" | "reject";
  @IsOptional() @trim() @IsString() @MaxLength(1000) comment?: string;
}

export class HrTaskReassignDto {
  @IsEntityId() employeeId: string;
  @trim() @IsString() @MinLength(3) @MaxLength(1000) reason: string;
}

export class HrTaskCommentDto {
  @trim() @IsString() @MinLength(1) @MaxLength(2000) message: string;
}

// ---------------------------------------------------------------- attendance & leave

export class HrAttendanceQueryDto extends PageQueryDto {
  @IsOptional() @Matches(DATE_KEY, DATE_KEY_MESSAGE) date?: string;
  @IsOptional() @IsEntityId() officeId?: string;
  @IsOptional() @IsEntityId() departmentId?: string;
  @IsOptional() @IsEntityId() employeeId?: string;
  @IsOptional() @IsIn(["present", "half_day", "absent", "on_leave", "not_marked"]) status?: string;
  @IsOptional() @trim() @IsString() @MaxLength(80) search?: string;
}

export class HrAttendanceMarkDto {
  @IsEntityId() employeeId: string;
  @Matches(DATE_KEY, DATE_KEY_MESSAGE) date: string;
  @IsIn(HR_ATTENDANCE_STATUSES as unknown as string[]) status: string;
  @IsOptional() @IsDateString() checkInAt?: string;
  @IsOptional() @IsDateString() checkOutAt?: string;
  @IsOptional() @IsEntityId() officeId?: string;
  /** Why HR is entering or changing this day; kept in the audit log. */
  @trim() @IsString() @MinLength(3) @MaxLength(500) reason: string;
}

export class HrCheckInDto {
  @IsOptional() @IsEntityId() officeId?: string;
}

export class HrRangeQueryDto {
  @Matches(DATE_KEY, DATE_KEY_MESSAGE) from: string;
  @Matches(DATE_KEY, DATE_KEY_MESSAGE) to: string;
  @IsOptional() @IsEntityId() officeId?: string;
  @IsOptional() @IsEntityId() departmentId?: string;
  @IsOptional() @IsEntityId() employeeId?: string;
}

export class HrTaskReportQueryDto extends HrRangeQueryDto {
  @IsOptional() @IsIn(["employee", "office", "department"]) groupBy?: "employee" | "office" | "department";
}

export class HrLeaveRequestDto {
  @Matches(DATE_KEY, DATE_KEY_MESSAGE) fromDate: string;
  @Matches(DATE_KEY, DATE_KEY_MESSAGE) toDate: string;
  @IsIn(HR_LEAVE_TYPES as unknown as string[]) type: string;
  @trim() @IsString() @MinLength(3) @MaxLength(500) reason: string;
}

/** HR records leave for an employee; it is approved straight away. */
export class HrLeaveRecordDto extends HrLeaveRequestDto {
  @IsEntityId() employeeId: string;
}

export class HrLeaveQueryDto extends PageQueryDto {
  @IsOptional() @IsIn(HR_LEAVE_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsEntityId() employeeId?: string;
  @IsOptional() @IsEntityId() officeId?: string;
}

export class HrDecisionDto {
  @IsIn(["approve", "reject"]) decision: "approve" | "reject";
  @IsOptional() @trim() @IsString() @MaxLength(500) note?: string;
}

export class HrCorrectionRequestDto {
  @Matches(DATE_KEY, DATE_KEY_MESSAGE) date: string;
  @IsIn(HR_ATTENDANCE_STATUSES as unknown as string[]) requestedStatus: string;
  @IsOptional() @IsDateString() requestedCheckInAt?: string;
  @IsOptional() @IsDateString() requestedCheckOutAt?: string;
  @trim() @IsString() @MinLength(5) @MaxLength(500) reason: string;
}

export class HrCorrectionQueryDto extends PageQueryDto {
  @IsOptional() @IsIn(HR_CORRECTION_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsEntityId() employeeId?: string;
}

// ---------------------------------------------------------------- dashboard

export class HrDashboardQueryDto {
  @IsOptional() @Matches(DATE_KEY, DATE_KEY_MESSAGE) date?: string;
  @IsOptional() @IsEntityId() officeId?: string;
  @IsOptional() @IsEntityId() departmentId?: string;
  @IsOptional() @IsEntityId() employeeId?: string;
  @IsOptional() @IsIn(HR_TASK_STATUSES as unknown as string[]) status?: string;
}
