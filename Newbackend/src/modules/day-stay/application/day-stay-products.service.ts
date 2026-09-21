import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { CreateDayStayProductDto } from "../presentation/dtos/day-stay.dto";

@Injectable()
export class DayStayProductsService {
  private readonly logger = new Logger(DayStayProductsService.name);

  constructor(
    @InjectModel("DayStayProduct")
    private readonly productModel: Model<any>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultProducts();
  }

  async seedDefaultProducts(): Promise<void> {
    // Remove deprecated 90m and 3h products
    await this.productModel.deleteMany({ productCode: { $in: ["FRESHEN_UP", "DAY_REST_3H"] } });

    const defaultProducts = [
      {
        productCode: "DAY_REST_4H",
        productType: "day_rest",
        displayName: "Day Rest (4 Hours)",
        durationMinutes: 240,
        sortOrder: 1,
        active: true,
        description: "Comfortable private AC room to relax, unpack, freshen up, and re-energize.",
      },
      {
        productCode: "DAY_REST_6H",
        productType: "day_rest",
        displayName: "Day Rest (6 Hours)",
        durationMinutes: 360,
        sortOrder: 2,
        active: true,
        description: "Extended peace and comfort for elderly family members, yatris, and tired pilgrims.",
      },
    ];

    for (const prod of defaultProducts) {
      await this.productModel.findOneAndUpdate(
        { productCode: prod.productCode },
        { $set: prod },
        { upsert: true, new: true }
      );
      this.logger.log(`Seeded Day Stay Product: ${prod.productCode}`);
    }
  }

  async getActiveProducts(): Promise<any[]> {
    return this.productModel.find({ active: true }).sort({ sortOrder: 1 }).lean();
  }

  async getProductByCode(productCode: string): Promise<any> {
    const prod = await this.productModel.findOne({ productCode: productCode.toUpperCase() }).lean();
    if (!prod) {
      throw new NotFoundException(`Day stay product ${productCode} not found`);
    }
    return prod;
  }

  async createProduct(dto: CreateDayStayProductDto, actorId?: string): Promise<any> {
    return this.productModel.create({
      ...dto,
      productCode: dto.productCode.toUpperCase(),
      createdBy: actorId,
    });
  }
}
