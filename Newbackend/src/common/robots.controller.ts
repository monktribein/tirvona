import { Controller, Get, Header, Req } from "@nestjs/common";
import { Request } from "express";
import { Public } from "./decorators/public.decorator";

@Controller()
export class RobotsController {
  @Public()
  @Get("robots.txt")
  @Header("Content-Type", "text/plain; charset=utf-8")
  @Header("Cache-Control", "public, max-age=86400")
  getRobots(@Req() req?: Request): string {
    const host = (req?.headers?.host || "").toLowerCase();

    // If accessed explicitly via the API subdomain (api.tirvona.com)
    if (host.startsWith("api.")) {
      return [
        "# Tirvona API",
        "# For the canonical website robots directives, see https://www.tirvona.com/robots.txt",
        "User-agent: *",
        "Disallow: /",
        "",
        "Host: https://www.tirvona.com",
        "Sitemap: https://www.tirvona.com/sitemap.xml",
        "",
      ].join("\n");
    }

    // Public website robots.txt for www.tirvona.com and web proxies
    return [
      "# Tirvona Robots.txt",
      "# https://www.tirvona.com",
      "",
      "User-agent: *",
      "",
      "# Public Crawlable Sections",
      "Allow: /",
      "Allow: /ashrams",
      "Allow: /ashrams/*",
      "Allow: /stays",
      "Allow: /stays/*",
      "Allow: /destinations",
      "Allow: /destinations/*",
      "Allow: /stays-near-prem-mandir-vrindavan",
      "Allow: /Stays-near-prem-mandir-vrindavan",
      "Allow: /stays-in-vrindavan",
      "Allow: /stays-near-banke-bihari-vrindavan",
      "Allow: /stays-near-iskcon-vrindavan",
      "Allow: /budget-stays-in-vrindavan",
      "Allow: /family-stays-in-vrindavan",
      "Allow: /temples",
      "Allow: /temples/*",
      "Allow: /aarti",
      "Allow: /aarti/*",
      "Allow: /live-pooja",
      "Allow: /live-pooja/*",
      "Allow: /circuits",
      "Allow: /circuits/*",
      "Allow: /pilgrimage-circuits",
      "Allow: /marketplace",
      "Allow: /marketplace/*",
      "Allow: /books",
      "Allow: /puja-items",
      "Allow: /handicrafts",
      "Allow: /religious-products",
      "Allow: /events",
      "Allow: /events/*",
      "Allow: /about",
      "Allow: /contact",
      "Allow: /faq",
      "Allow: /help",
      "Allow: /terms",
      "Allow: /privacy",
      "Allow: /refund-policy",
      "Allow: /cancellation-policy",
      "Allow: /stay-policies",
      "Allow: /govt-guidelines",
      "Allow: /local-guides",
      "Allow: /travel-guides",
      "Allow: /transport",
      "Allow: /restaurants",
      "Allow: /shops",
      "Allow: /services",
      "Allow: /careers",
      "Allow: /partner",
      "Allow: /volunteer",
      "",
      "# Disallow Private Portals, Auth, Administration, Staff and Sensitive Workflows",
      "Disallow: /admin/",
      "Disallow: /admin/*",
      "Disallow: /ashram-admin/",
      "Disallow: /ashram-admin/*",
      "Disallow: /ashram-owner/",
      "Disallow: /ashram-owner/*",
      "Disallow: /stay-admin/",
      "Disallow: /stay-admin/*",
      "Disallow: /stay-owner/",
      "Disallow: /stay-owner/*",
      "Disallow: /temple-owner/",
      "Disallow: /temple-owner/*",
      "Disallow: /owner/",
      "Disallow: /owner/*",
      "Disallow: /staff/",
      "Disallow: /staff/*",
      "Disallow: /login",
      "Disallow: /register",
      "Disallow: /reset-password",
      "Disallow: /profile",
      "Disallow: /dashboard",
      "Disallow: /booking/",
      "Disallow: /booking/*",
      "Disallow: /api/",
      "Disallow: /api/*",
      "Disallow: /c/",
      "Disallow: /c/*",
      "Disallow: /smart-contact.html",
      "Disallow: /index.html",
      "",
      "# Canonical Host and Sitemap",
      "Host: https://www.tirvona.com",
      "Sitemap: https://www.tirvona.com/sitemap.xml",
      "",
    ].join("\n");
  }
}
