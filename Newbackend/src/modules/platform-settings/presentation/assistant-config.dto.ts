import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { ASSISTANT_ENTRY_ID, ASSISTANT_LABEL_MAX, ASSISTANT_MAX_ENTRIES } from "../domain/assistant-config";

export class AssistantEntryDto {
  @IsString() @Matches(ASSISTANT_ENTRY_ID) @MaxLength(120) id!: string;
  @IsBoolean() visible!: boolean;
  @IsBoolean() enabled!: boolean;
  @IsInt() @Min(0) @Max(100000) order!: number;
  @IsOptional() @IsString() @MaxLength(ASSISTANT_LABEL_MAX) label?: string;
}

export class SaveAssistantConfigDto {
  @IsArray()
  @ArrayMaxSize(ASSISTANT_MAX_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => AssistantEntryDto)
  entries!: AssistantEntryDto[];
  @IsOptional() @IsInt() @Min(0) expectedRevision?: number;
}
