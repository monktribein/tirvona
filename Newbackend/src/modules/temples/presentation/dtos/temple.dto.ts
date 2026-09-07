import { PartialType } from "@nestjs/swagger";
import { IsString, IsOptional, IsBoolean, IsArray, IsNumber, ValidateNested, IsDateString, IsEnum, Min, Max, IsUrl, ArrayMinSize, ArrayMaxSize, Matches, MinLength } from "class-validator";
import { Type } from "class-transformer";

export class AddressDto {
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() landmark?: string;
  @IsOptional() @IsString() area?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() pincode?: string;
  
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  @Min(-180, { each: true })
  @Max(180, { each: true })
  coordinates?: number[]; // [longitude, latitude]

  @IsOptional() @IsUrl({ require_tld: false }) mapUrl?: string;
  @IsOptional() @IsUrl({ require_tld: false }) googleMapsEmbedUrl?: string;
  @IsOptional() @IsString() plusCode?: string;
}

export class TempleMediaDto {
  @IsOptional() @IsUrl({ require_tld: false }) coverImage?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) galleryImages?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) templeExteriorImages?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) templeInteriorImages?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) deityImages?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) architectureImages?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) festivalImages?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) aartiImages?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) additionalImages?: string[];
  @IsOptional() @IsUrl({ require_tld: false }) videoUrl?: string;
  @IsOptional() @IsUrl({ require_tld: false }) youtubeUrl?: string;
  @IsOptional() @IsUrl({ require_tld: false }) liveStreamUrl?: string;
  @IsOptional() @IsUrl({ require_tld: false }) officialWebsite?: string;
}

export class TimeSlotDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsString() endTime?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isClosed?: boolean;
  @IsOptional() @IsBoolean() isOpen24Hours?: boolean;
  @IsOptional() @IsBoolean() isSpecialTiming?: boolean;
}

export class DayTimingDto {
  @IsString()
  @IsEnum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])
  dayOfWeek: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  timeSlots: TimeSlotDto[];
}

export class VisitorInfoDto {
  @IsOptional() @IsString() bestTimeToVisit?: string;
  @IsOptional() @IsString() recommendedVisitDuration?: string;
  @IsOptional() @IsString() entryFee?: string;
  @IsOptional() @IsString() dressCode?: string;
  @IsOptional() @IsString() photographyAllowed?: string;
  @IsOptional() @IsString() mobilePhoneAllowed?: string;
  @IsOptional() @IsString() footwearInstructions?: string;
  @IsOptional() @IsString() idRequired?: string;
  @IsOptional() @IsString() wheelchairAccessible?: string;
  @IsOptional() @IsString() seniorCitizenInformation?: string;
  @IsOptional() @IsString() childrenPolicy?: string;
  @IsOptional() @IsString() prasadAvailable?: string;
  @IsOptional() @IsString() lockerAvailable?: string;
  @IsOptional() @IsString() parkingAvailable?: string;
  @IsOptional() @IsString() foodAvailable?: string;
  @IsOptional() @IsString() drinkingWater?: string;
  @IsOptional() @IsString() washrooms?: string;
  @IsOptional() @IsString() cloakRoom?: string;
  @IsOptional() @IsString() securityInformation?: string;
  @IsOptional() @IsString() templeRules?: string;
  @IsOptional() @IsString() importantInstructions?: string;
  @IsOptional() @IsString() emergencyContact?: string;
  @IsOptional() @IsString() templeContactNumber?: string;
}

export class DarshanInfoDto {
  @IsOptional() @IsString() darshanType?: string;
  @IsOptional() @IsString() generalDarshan?: string;
  @IsOptional() @IsString() specialDarshan?: string;
  @IsOptional() @IsString() vipDarshan?: string;
  @IsOptional() @IsString() darshanDuration?: string;
  @IsOptional() @IsString() queueInformation?: string;
  @IsOptional() @IsString() entryGateInformation?: string;
  @IsOptional() @IsString() specialEntryInformation?: string;
  @IsOptional() @IsString() restrictions?: string;
}

export class HowToReachDto {
  @IsOptional() @IsString() byAir?: string;
  @IsOptional() @IsString() byTrain?: string;
  @IsOptional() @IsString() byBus?: string;
  @IsOptional() @IsString() byRoad?: string;
  @IsOptional() @IsString() nearestRailwayStation?: string;
  @IsOptional() @IsString() nearestAirport?: string;
  @IsOptional() @IsString() nearestBusStand?: string;
}

export class TempleSeoDto {
  @IsOptional() @IsString() seoTitle?: string;
  @IsOptional() @IsString() seoDescription?: string;
  @IsOptional() @IsString() seoKeywords?: string;
  @IsOptional() @IsString() canonicalUrl?: string;
  @IsOptional() @IsString() ogTitle?: string;
  @IsOptional() @IsString() ogDescription?: string;
  @IsOptional() @IsString() ogImage?: string;
  @IsOptional() @IsString() twitterTitle?: string;
  @IsOptional() @IsString() twitterDescription?: string;
  @IsOptional() @IsString() twitterImage?: string;
}

export class CreateTempleDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug?: string;
  @IsOptional() @IsString() templeShortName?: string;
  @IsOptional() @IsString() shortDescription?: string;
  @IsOptional() @IsString() description?: string;
  
  @IsOptional() @IsString() deity?: string;
  @IsOptional() @IsString() templeType?: string;
  @IsOptional() @IsString() religiousTradition?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) templeTags?: string[];
  
  @IsOptional() @IsString() establishedYear?: string;
  @IsOptional() @IsString() historicalPeriod?: string;
  @IsOptional() @IsString() founder?: string;
  @IsOptional() @IsString() dynasty?: string;
  @IsOptional() @IsString() historicalSignificance?: string;
  @IsOptional() @IsString() religiousSignificance?: string;
  @IsOptional() @IsString() spiritualSignificance?: string;
  @IsOptional() @IsString() templeStory?: string;
  @IsOptional() @IsString() importantBeliefs?: string;
  @IsOptional() @IsString() importantTraditions?: string;
  @IsOptional() @IsString() importantRituals?: string;
  @IsOptional() @IsString() architecturalStyle?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TempleMediaDto)
  media?: TempleMediaDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DayTimingDto)
  timings?: DayTimingDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => VisitorInfoDto)
  visitorInfo?: VisitorInfoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DarshanInfoDto)
  darshanInfo?: DarshanInfoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => HowToReachDto)
  howToReach?: HowToReachDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TempleSeoDto)
  seo?: TempleSeoDto;

  @IsOptional()
  @IsString()
  @IsEnum(["draft", "published", "archived", "active"])
  status?: string;

  @IsOptional() @IsBoolean() isVerified?: boolean;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsBoolean() isPopular?: boolean;
}

export class UpdateTempleDto extends PartialType(CreateTempleDto) {}

export class CreateAartiDto {
  @IsString() name: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime: string;
  @IsOptional() @IsArray() @IsString({ each: true }) days?: string[];
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() specialNotes?: string;
  @IsOptional() @IsString() liveStreamUrl?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateFestivalDto {
  @IsString() name: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() specialTiming?: string;
  @IsOptional() @IsString() specialAarti?: string;
  @IsOptional() @IsString() importantInformation?: string;
  @IsOptional() @IsString() expectedCrowdLevel?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
