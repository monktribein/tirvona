import { Controller, Get, Header, Req } from "@nestjs/common";
import { Request } from "express";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import { Public } from "./decorators/public.decorator";
import { citySlug, slugify } from "./slug/slug.util";

interface SitemapEntry {
  loc: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: number;
  lastmod?: string;
}

@Controller()
export class SitemapController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @Public()
  @Get("sitemap.xml")
  @Header("Content-Type", "application/xml; charset=utf-8")
  @Header("Cache-Control", "public, max-age=3600")
  async getSitemap(@Req() _req?: Request): Promise<string> {
    const baseUrl = "https://www.tirvona.com";
    const today = new Date().toISOString().split("T")[0];

    const entriesMap = new Map<string, SitemapEntry>();

    const addEntry = (
      path: string,
      changefreq: SitemapEntry["changefreq"],
      priority: number,
      lastmod?: string,
    ) => {
      const cleanPath = path.startsWith("/") ? path : `/${path}`;
      const loc = `${baseUrl}${cleanPath}`;
      if (!entriesMap.has(loc)) {
        entriesMap.set(loc, {
          loc,
          changefreq,
          priority,
          lastmod: lastmod || today,
        });
      }
    };

    // 1. Core Home & Hubs
    addEntry("/", "daily", 1.0);
    addEntry("/ashrams", "daily", 0.9);
    addEntry("/stays", "daily", 0.9);
    addEntry("/destinations", "weekly", 0.9);

    // 2. Destination Hubs
    addEntry("/ashrams/vrindavan", "daily", 0.9);
    addEntry("/ashrams/haridwar", "weekly", 0.8);
    addEntry("/ashrams/rishikesh", "weekly", 0.8);
    addEntry("/ashrams/varanasi", "weekly", 0.8);
    addEntry("/ashrams/ayodhya", "weekly", 0.8);
    addEntry("/ashrams/mathura", "weekly", 0.8);

    // 3. Curated Vrindavan SEO Landing Pages
    addEntry("/stays-in-vrindavan", "daily", 0.9);
    addEntry("/stays-near-prem-mandir-vrindavan", "daily", 0.9);
    addEntry("/Stays-near-prem-mandir-vrindavan", "daily", 0.9);
    addEntry("/stays-near-banke-bihari-vrindavan", "daily", 0.9);
    addEntry("/stays-near-iskcon-vrindavan", "daily", 0.9);
    addEntry("/budget-stays-in-vrindavan", "daily", 0.9);
    addEntry("/family-stays-in-vrindavan", "daily", 0.9);

    // 4. Curated Known Approved Properties
    addEntry("/ashrams/vrindavan/hotel-krishna-anandam", "weekly", 0.85);
    addEntry("/ashrams/vrindavan/sukhram-dham", "weekly", 0.85);
    addEntry("/ashrams/vrindavan/hotel-shakun-palace", "weekly", 0.85);
    addEntry("/ashrams/vrindavan/sukhram-dham-a", "weekly", 0.85);
    addEntry("/ashrams/mathura/hotel-dwarika-palace", "weekly", 0.85);

    // 5. Dynamic Database Approved Ashrams
    try {
      if (this.connection?.readyState === 1) {
        const ashramModel = this.connection.models["Ashram"];
        if (ashramModel) {
          const approvedAshrams = await ashramModel
            .find({
              status: { $in: ["approved", "active"] },
            })
            .select("slug citySlug address name updatedAt")
            .lean()
            .exec();

          for (const item of approvedAshrams as any[]) {
            const rawCity =
              item.citySlug ||
              (item.address?.city ? citySlug(item.address.city) : "") ||
              "vrindavan";
            const rawSlug = item.slug || (item.name ? slugify(item.name) : "");
            if (rawCity && rawSlug) {
              const lastmod = item.updatedAt
                ? new Date(item.updatedAt).toISOString().split("T")[0]
                : today;
              addEntry(`/ashrams/${rawCity}/${rawSlug}`, "weekly", 0.8, lastmod);
            }
          }
        }
      }
    } catch {
      // If DB query fails, static & curated entries are still safely returned
    }

    // 6. Spiritual Hubs
    addEntry("/temples", "weekly", 0.8);
    addEntry("/aarti", "weekly", 0.8);
    addEntry("/live-pooja", "weekly", 0.8);
    addEntry("/pilgrimage-circuits", "weekly", 0.8);
    addEntry("/marketplace", "weekly", 0.7);
    addEntry("/events", "weekly", 0.7);

    // 7. Policy and Trust Pages
    addEntry("/about", "monthly", 0.6);
    addEntry("/contact", "monthly", 0.6);
    addEntry("/faq", "monthly", 0.6);
    addEntry("/help", "monthly", 0.6);
    addEntry("/terms", "monthly", 0.5);
    addEntry("/privacy", "monthly", 0.5);
    addEntry("/refund-policy", "monthly", 0.5);
    addEntry("/cancellation-policy", "monthly", 0.5);
    addEntry("/stay-policies", "monthly", 0.5);
    addEntry("/govt-guidelines", "monthly", 0.5);

    const urlsXml = Array.from(entriesMap.values())
      .map(
        (entry) => `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>
  </url>`,
      )
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`;
  }
}
