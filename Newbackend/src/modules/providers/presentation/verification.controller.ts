import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { ProviderVerificationService } from "../application/provider-verification.service";
import { Idempotent } from "../infrastructure/idempotency.interceptor";
import {
  AddEvidenceDto,
  DecideVerificationDto,
  OpenVerificationCaseDto,
  VerificationQueueQueryDto,
} from "./dto/verification.dto";
import { ObjectIdPipe } from "./object-id.pipe";
import { ProviderApi } from "./provider-api.decorator";

const REVIEWERS = ["verification_reviewer", "super_admin"] as const;

/**
 * Provider verification (SRS M07, Data Dictionary 7.22/7.23).
 *
 * Providers open a case, attach evidence metadata and submit it; reviewers
 * claim and decide it. Reads are limited to the case's owner and reviewers; a
 * reviewer can never review their own provider account (service-enforced).
 */
@ProviderApi()
@Controller({ path: "verification-cases", version: "2" })
export class VerificationCasesController {
  constructor(private readonly verification: ProviderVerificationService) {}

  /** PROVIDER (own profile) or reviewer/ops (for a given providerId). */
  @Post()
  @Idempotent("verification.open", { sensitive: true })
  open(@CurrentUser() user: AuthenticatedUser, @Body() dto: OpenVerificationCaseDto) {
    return this.verification.open(user, dto);
  }

  /** Owner: their cases. Reviewers: the review queue. */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: VerificationQueueQueryDto) {
    return this.verification.list(user, query);
  }

  @Get(":caseId")
  one(@CurrentUser() user: AuthenticatedUser, @Param("caseId", ObjectIdPipe) caseId: string) {
    return this.verification.get(user, caseId);
  }

  @Post(":caseId/evidence")
  @Idempotent("verification.evidence", { sensitive: true })
  evidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param("caseId", ObjectIdPipe) caseId: string,
    @Body() dto: AddEvidenceDto,
  ) {
    return this.verification.addEvidence(user, caseId, dto);
  }

  /** Provider: hand the case to the reviewers. */
  @Post(":caseId\\:submit")
  @Idempotent("verification.submit", { sensitive: true })
  submit(@CurrentUser() user: AuthenticatedUser, @Param("caseId", ObjectIdPipe) caseId: string) {
    return this.verification.submit(user, caseId);
  }

  /** Provider: open a fresh case after a rejection that allows it. */
  @Post(":caseId\\:resubmit")
  @Idempotent("verification.resubmit", { sensitive: true })
  resubmit(@CurrentUser() user: AuthenticatedUser, @Param("caseId", ObjectIdPipe) caseId: string) {
    return this.verification.resubmit(user, caseId);
  }

  @Roles(...REVIEWERS)
  @Post(":caseId\\:claim")
  @Idempotent("verification.claim", { sensitive: true })
  claim(@CurrentUser() user: AuthenticatedUser, @Param("caseId", ObjectIdPipe) caseId: string) {
    return this.verification.claim(user, caseId);
  }

  @Roles(...REVIEWERS)
  @Post(":caseId\\:decide")
  @Idempotent("verification.decide", { sensitive: true })
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param("caseId", ObjectIdPipe) caseId: string,
    @Body() dto: DecideVerificationDto,
  ) {
    return this.verification.decide(user, caseId, dto);
  }
}
