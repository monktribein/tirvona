import { IsArray, IsOptional, IsString } from "class-validator";
import { IsEntityId } from "../../../../common/decorators/is-entity-id.decorator";
export class CreateSettlementDto {
  @IsOptional() @IsEntityId() ownerId?: string;
  @IsOptional() @IsArray() ashramIds?: string[];
}
export class CompleteSettlementDto {
  @IsString() payoutReference: string;
}
export class ProcessRefundDto {
  @IsOptional() @IsString() gatewayRefundId?: string;
  @IsOptional() @IsString() failureReason?: string;
}
