import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../../common/decorators/roles.decorator";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { PartnerManagementService } from "../application/partner-management.service";
import {
  CreateApiKeyDto,
  CreatePartnerDto,
  CreateWebhookDto,
  UpdatePartnerDto,
  UpdateWebhookDto,
} from "./dtos/partner-management.dto";

@ApiTags("Admin / Partners")
@ApiBearerAuth()
@Roles("super_admin")
@Controller("partners")
export class PartnerAdminController {
  constructor(private readonly service: PartnerManagementService) {}

  // Partners
  @Post()
  @ApiOperation({ summary: "Create a partner organization" })
  async createPartner(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePartnerDto,
  ) {
    return { success: true, data: await this.service.createPartner(user, dto) };
  }

  @Get()
  @ApiOperation({ summary: "List all partner organizations" })
  async listPartners() {
    return { success: true, data: await this.service.listPartners() };
  }

  // Static GET routes must be declared BEFORE `@Get(":id")`, otherwise Nest
  // matches "webhooks" / "deliveries" as a partner id.
  @Get("webhooks")
  @ApiOperation({ summary: "List registered webhooks" })
  async listWebhooks(@Query("partnerId") partnerId?: string) {
    return { success: true, data: await this.service.listWebhooks(partnerId) };
  }

  @Get("deliveries")
  @ApiOperation({ summary: "List webhook delivery logs" })
  async listDeliveries(
    @Query("webhookId") webhookId?: string,
    @Query("partnerId") partnerId?: string,
    @Query("status") status?: string,
    @Query("limit") limit?: number,
  ) {
    return {
      success: true,
      data: await this.service.listDeliveryLogs({ webhookId, partnerId, status, limit }),
    };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get partner by ID" })
  async getPartner(@Param("id") id: string) {
    return { success: true, data: await this.service.getPartner(id) };
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update partner status, permissions, or scope" })
  async updatePartner(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdatePartnerDto,
  ) {
    return { success: true, data: await this.service.updatePartner(user, id, dto) };
  }

  // API Keys
  @Post(":partnerId/keys")
  @ApiOperation({ summary: "Generate API key for partner (secret revealed once)" })
  async createApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param("partnerId") partnerId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return { success: true, data: await this.service.createApiKey(user, partnerId, dto) };
  }

  @Get(":partnerId/keys")
  @ApiOperation({ summary: "List API keys for partner" })
  async listApiKeys(@Param("partnerId") partnerId: string) {
    return { success: true, data: await this.service.listApiKeys(partnerId) };
  }

  @Post("keys/:keyId/revoke")
  @ApiOperation({ summary: "Revoke API key" })
  async revokeApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param("keyId") keyId: string,
  ) {
    return { success: true, data: await this.service.revokeApiKey(user, keyId) };
  }

  @Post("keys/:keyId/rotate")
  @ApiOperation({ summary: "Rotate API key (revokes old and generates new)" })
  async rotateApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param("keyId") keyId: string,
  ) {
    return { success: true, data: await this.service.rotateApiKey(user, keyId) };
  }

  // Webhooks
  @Post(":partnerId/webhooks")
  @ApiOperation({ summary: "Register webhook endpoint for partner" })
  async createWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Param("partnerId") partnerId: string,
    @Body() dto: CreateWebhookDto,
  ) {
    return { success: true, data: await this.service.createWebhook(user, partnerId, dto) };
  }

  @Patch("webhooks/:webhookId")
  @ApiOperation({ summary: "Update webhook URL, status, or events" })
  async updateWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Param("webhookId") webhookId: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return { success: true, data: await this.service.updateWebhook(user, webhookId, dto) };
  }

  @Delete("webhooks/:webhookId")
  @ApiOperation({ summary: "Delete webhook endpoint" })
  async deleteWebhook(@Param("webhookId") webhookId: string) {
    return await this.service.deleteWebhook(webhookId);
  }

  @Post("webhooks/:webhookId/rotate-secret")
  @ApiOperation({ summary: "Rotate webhook signing secret" })
  async rotateWebhookSecret(
    @CurrentUser() user: AuthenticatedUser,
    @Param("webhookId") webhookId: string,
  ) {
    return { success: true, data: await this.service.rotateWebhookSecret(user, webhookId) };
  }

  @Post("webhooks/:webhookId/test")
  @ApiOperation({ summary: "Send a signed test event to a webhook endpoint" })
  async testWebhook(@Param("webhookId") webhookId: string) {
    return { success: true, data: await this.service.sendTestWebhook(webhookId) };
  }

  // Webhook Delivery Logs
  @Post("deliveries/:id/retry")
  @ApiOperation({ summary: "Retry a webhook delivery" })
  async retryDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return { success: true, data: await this.service.retryDelivery(id) };
  }
}
