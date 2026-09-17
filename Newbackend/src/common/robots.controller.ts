import { Controller, Get, Header } from "@nestjs/common";
import { Public } from "./decorators/public.decorator";

@Controller()
export class RobotsController {
  @Public()
  @Get("robots.txt")
  @Header("Content-Type", "text/plain; charset=utf-8")
  @Header("Cache-Control", "public, max-age=86400")
  getRobots(): string {
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
}
