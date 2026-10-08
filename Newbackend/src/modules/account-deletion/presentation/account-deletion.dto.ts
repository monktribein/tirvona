import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class DeleteAccountDto {
  /** Accounts that sign in with a password prove it with the password. */
  @IsOptional() @IsString() @MaxLength(128) password?: string;

  /** Google accounts have no password; they re-authenticate with Google. */
  @IsOptional() @IsString() @MaxLength(4096) googleCredential?: string;

  /** Typed confirmation, so a stray request can never erase an account. */
  @IsIn(["DELETE"], { message: 'Type "DELETE" to confirm' })
  confirmText: string;

  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
