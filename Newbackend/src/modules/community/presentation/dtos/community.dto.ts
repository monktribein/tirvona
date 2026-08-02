import { Type } from "class-transformer";
import { PartialType } from "@nestjs/swagger";
import {
  Allow,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
export class UserMemoryDto {
  @IsOptional() @IsObject() bookingDraft?: Record<string, unknown>;
  @IsOptional() @IsObject() plannerDraft?: Record<string, unknown>;
  @IsOptional() @IsObject() offerDraft?: Record<string, unknown>;
  @IsOptional() @IsArray() marketplaceCart?: unknown[];
  @IsOptional() @IsArray() wishlist?: string[];
  @IsOptional() @IsArray() recentSearches?: string[];
  @IsOptional() @IsArray() recentCities?: string[];
  @IsOptional() @IsObject() filters?: Record<string, unknown>;
  @IsOptional() @IsObject() dashboardState?: Record<string, unknown>;
  @IsOptional() @IsObject() profileProgress?: Record<string, unknown>;
  @IsOptional() @IsObject() preferences?: Record<string, unknown>;
  @IsOptional() @IsArray() recentlyViewed?: string[];
  @IsOptional() @IsObject() lastVisitedPage?: Record<string, unknown>;
}
export class VolunteerJobDto {
  @IsString() ashramId: string;
  @IsString() @MaxLength(160) ashramName: string;
  @IsString() city: string;
  @IsOptional() @IsString() state?: string;
  @IsString() @MaxLength(160) title: string;
  @IsString() department: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  openingsCount?: number;
  @IsOptional() @IsString() duration?: string;
  @IsOptional() @IsString() accommodation?: string;
  @IsOptional() @IsString() food?: string;
  @IsOptional() @IsString() stipend?: string;
  @IsOptional() @Allow() certificateProvided?: boolean;
  @IsOptional() @IsArray() responsibilities?: string[];
  @IsOptional() @IsArray() requirements?: string[];
  @IsOptional() @IsArray() benefits?: string[];
  @IsOptional() @IsObject() contactPerson?: Record<string, unknown>;
  @IsOptional() @IsString() deadline?: string;
  @IsOptional() @IsIn(["open", "closing_soon", "closed"]) status?: string;
}
export class UpdateVolunteerJobDto extends PartialType(VolunteerJobDto) {}
export class VolunteerApplicationDto {
  @IsString() jobId: string;
  @IsString() @MaxLength(120) applicantName: string;
  @IsEmail() email: string;
  @IsString() @MaxLength(30) phone: string;
  @IsString() city: string;
  @IsOptional() @IsString() education?: string;
  @IsOptional() @IsString() skills?: string;
  @IsOptional() @IsString() languages?: string;
  @IsOptional() @IsString() availability?: string;
  @IsString() @MaxLength(3000) motivation: string;
}
export class ApplicationStatusDto {
  @IsIn(["applied", "shortlisted", "interviewed", "accepted", "rejected"])
  status: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}
export class VisitorArticleDto {
  @IsString() bookingId: string;
  @IsString() @MaxLength(200) title: string;
  @IsString() category: string;
  @IsString() @MaxLength(350) shortDescription: string;
  @IsString() @MaxLength(50000) content: string;
  @IsString() featuredImage: string;
  @IsOptional() @IsArray() galleryImages?: string[];
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsIn(["draft", "pending"]) status?: string;
}
export class UpdateVisitorArticleDto extends PartialType(VisitorArticleDto) {}
export class ReviewVisitorArticleDto {
  @IsIn(["approve", "reject"]) action: "approve" | "reject";
  @IsOptional() @IsString() @MaxLength(1000) rejectionReason?: string;
}
export class ArticleCommentDto {
  @IsString() @MaxLength(2000) comment: string;
}
