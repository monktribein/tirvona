import { IsArray, IsMongoId, IsOptional, IsString } from "class-validator";
export class CreateSettlementDto {
  @IsOptional() @IsMongoId() ownerId?: string;
  @IsOptional() @IsArray() ashramIds?: string[];
}
export class CompleteSettlementDto {
  @IsString() payoutReference: string;
}
export class ProcessRefundDto {
  @IsOptional() @IsString() gatewayRefundId?: string;
  @IsOptional() @IsString() failureReason?: string;
}
