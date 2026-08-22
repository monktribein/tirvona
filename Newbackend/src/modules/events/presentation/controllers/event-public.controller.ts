import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { Public } from "../../../../common/decorators/public.decorator";
import { EVENT_MODEL } from "../../domain/event.constants";
import { EventDiscoveryService } from "../../application/event-discovery.service";
import { EventSearchDto } from "../dtos/event.dto";

@ApiTags("Events & Festivals")
@Public()
@Controller("events")
export class EventPublicController {
  constructor(
    private readonly discovery: EventDiscoveryService,
    @InjectModel(EVENT_MODEL.Event) private readonly events: Model<any>,
  ) {}

  @Get("filters") filters() {
    return { success: true, data: this.discovery.filters() };
  }

  @Get("cities") async cities() {
    return { success: true, data: await this.discovery.cities() };
  }

  @Get() search(@Query() query: EventSearchDto) {
    return this.discovery.search(query);
  }

  @Get(":idOrSlug/days")
  @Header("Cache-Control", "no-store")
  async days(@Param("idOrSlug") idOrSlug: string) {
    const filter = /^[0-9a-f]{24}$/i.test(idOrSlug)
      ? { _id: idOrSlug }
      : { slug: idOrSlug.toLowerCase() };
    const event = await this.events.findOne({ ...filter, status: "approved" });
    if (!event) throw new NotFoundException("Event not found.");
    return {
      success: true,
      data: {
        eventId: event._id,
        days: await this.discovery.dayAvailability(event),
      },
    };
  }

  @Get(":idOrSlug")
  async detail(@Param("idOrSlug") idOrSlug: string) {
    const data = await this.discovery.detail(idOrSlug);
    if (!data) throw new NotFoundException("Event not found.");
    return { success: true, data };
  }
}
