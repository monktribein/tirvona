import { Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import { renderEmail, renderEmailText, type EmailDetailRow } from "./email-template";

const logger = new Logger("TeamAlert");

/**
 * Tells the Tirvona team (TEAM_ALERT_EMAIL) that something happened on the platform, for example a new
 * stay owner account or a new stay. It uses the existing Resend account and email template.
 *
 * It never throws and is never awaited by the caller's request, so a mail problem can not break a signup.
 * Nothing is sent when Resend is not configured or TEAM_ALERT_EMAIL is empty.
 */
export const sendTeamAlert = (
  config: Pick<ConfigService, "get"> | undefined,
  input: { subject: string; title: string; message: string; details: EmailDetailRow[] },
): void => {
  void (async () => {
    try {
      const apiKey = config?.get<string>("resendApiKey");
      const from = config?.get<string>("resendFromEmail");
      const to = String(config?.get<string>("teamAlertEmail") ?? "").trim();
      if (!apiKey || !from || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return;
      const siteUrl = String(config?.get<string>("frontendUrl") ?? "").replace(/\/+$/, "");
      const body = {
        title: input.title,
        message: input.message,
        siteUrl,
        details: input.details.filter((row) => String(row.value ?? "").trim()),
      };
      // The Resend SDK reports API-level rejections in `error` instead of throwing.
      const result: any = await new Resend(apiKey).emails.send({
        from,
        to,
        subject: input.subject,
        html: renderEmail(body),
        text: renderEmailText(body),
      });
      if (result?.error) logger.warn(`Team alert rejected by Resend: ${String(result.error.message ?? "").slice(0, 200)}`);
    } catch (error) {
      logger.warn(`Team alert failed: ${(error as Error).message}`);
    }
  })();
};
