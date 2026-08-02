import { IsIn, IsString, MinLength } from "class-validator";
export class CreateTicketDto {
  @IsString() @MinLength(2) title: string;
  @IsString() @MinLength(2) description: string;
  @IsIn([
    "booking_issue",
    "payment_failed",
    "refund_request",
    "ashram_complaint",
    "other",
  ])
  category: string;
}
export class TicketMessageDto {
  @IsString() @MinLength(1) text: string;
}
