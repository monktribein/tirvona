import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { BadRequestException } from "@nestjs/common";

/**
 * Checks whether an IPv4 or IPv6 address belongs to private/reserved ranges.
 */
export function isPrivateIp(ip: string): boolean {
  // IPv4 checks
  if (ip.startsWith("127.")) return true; // Loopback
  if (ip.startsWith("10.")) return true; // Class A private
  if (ip.startsWith("192.168.")) return true; // Class C private
  if (ip.startsWith("169.254.")) return true; // Link-local
  if (ip === "0.0.0.0" || ip === "255.255.255.255") return true;

  // 172.16.0.0 – 172.31.255.255 (Class B private)
  const match172 = ip.match(/^172\.(\d+)\./);
  if (match172) {
    const secondOctet = Number(match172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }

  // IPv6 checks
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::" || lower.startsWith("fe80:") || lower.startsWith("fc00:") || lower.startsWith("fd00:")) {
    return true;
  }

  return false;
}

/**
 * Validates a Webhook URL against SSRF, requiring HTTPS in production
 * and rejecting localhost, loopbacks, internal hosts and private IPs.
 */
export async function validateWebhookUrl(rawUrl: string, isProduction = process.env.NODE_ENV === "production"): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BadRequestException("Invalid webhook callback URL");
  }

  if (isProduction && parsed.protocol !== "https:") {
    throw new BadRequestException("Webhook URL must use HTTPS in production");
  }

  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new BadRequestException("Webhook URL protocol must be HTTP or HTTPS");
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".arpa")
  ) {
    throw new BadRequestException("Private or local domain names are not permitted for webhooks");
  }

  // Check if hostname is directly an IP
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new BadRequestException("Private and reserved IP addresses are not permitted");
    }
    return parsed.toString();
  }

  // Resolve hostname via DNS to prevent DNS-rebinding to private infrastructure
  try {
    const resolved = await lookup(hostname, { all: true });
    for (const entry of resolved) {
      if (isPrivateIp(entry.address)) {
        throw new BadRequestException(
          `Webhook domain ${hostname} resolves to a private IP (${entry.address}), which is forbidden`,
        );
      }
    }
  } catch (error: any) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException(`Failed to resolve webhook domain: ${error.message || String(error)}`);
  }

  return parsed.toString();
}
