import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { MarketplaceAddressService } from "../application/marketplace-address.service";
import {
  AddressDto,
  UpdateAddressDto,
} from "./dtos/marketplace-address.dto";

@Controller("marketplace")
export class MarketplaceAddressController {
  constructor(private readonly service: MarketplaceAddressService) {}

  @Get("addresses")
  addresses(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listAddresses(user).then((data) => ({
      success: true,
      count: data.length,
      data,
    }));
  }

  @Post("addresses")
  async addAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddressDto,
  ) {
    return { success: true, data: await this.service.createAddress(user, dto) };
  }

  @Put("addresses/:id")
  async editAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return {
      success: true,
      data: await this.service.updateAddress(user, id, dto),
    };
  }

  @Delete("addresses/:id")
  removeAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.service.deleteAddress(user, id);
  }
}
