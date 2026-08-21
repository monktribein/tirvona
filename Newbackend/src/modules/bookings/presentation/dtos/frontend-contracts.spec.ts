import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  AshramQueryDto,
  UpdateAddOnDto,
  UpdateAshramDto,
} from "../../../ashrams/presentation/dtos/ashram.dto";
import { RegisterDto } from "../../../auth/presentation/dtos/auth.dto";
import { USER_ROLES } from "../../../users/infrastructure/persistence/user.schema";
import {
  ConfirmBookingPaymentDto,
  CreateReviewDto,
  SaveOfferDto,
} from "./booking.dto";
describe("legacy frontend DTO contracts", () => {
  it("accepts the nested review rating sent by CustomerDashboard", async () => {
    const dto = plainToInstance(CreateReviewDto, {
      bookingId: "507f1f77bcf86cd799439011",
      ashramId: "507f1f77bcf86cd799439012",
      rating: {
        overall: 5,
        cleanliness: 5,
        service: 4,
        location: 5,
        valueForMoney: 4,
      },
      comment: "A peaceful stay",
    });
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).toHaveLength(0);
  });
  it("accepts the demo payment transaction identifier", async () => {
    const dto = plainToInstance(ConfirmBookingPaymentDto, {
      method: "upi",
      transactionId: "TXN-DEMO-123",
    });
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).toHaveLength(0);
  });
  it("accepts all search parameters emitted by SearchPage", async () => {
    const dto = plainToInstance(AshramQueryDto, {
      verified: "true",
      destination: "Rishikesh",
      type: "Yoga",
      checkIn: "2026-08-10",
      checkOut: "2026-08-12",
      guests: "2",
      amenities: "AC,River View",
    });
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).toHaveLength(0);
  });
  it("accepts the owner offer wizard payload", async () => {
    const dto = plainToInstance(SaveOfferDto, {
      offerTitle: "Festival Stay",
      shortTitle: "Festival",
      subtitle: "Save now",
      offerType: "Festival Offer",
      ashramId: "507f1f77bcf86cd799439012",
      applicableAshrams: ["507f1f77bcf86cd799439012"],
      description: "Festival offer",
      fullHtmlDescription: "<p>Offer</p>",
      highlights: ["Meal"],
      termsAndConditions: ["Online only"],
      promoCode: "FESTIVAL20",
      discountType: "Percentage",
      discountValue: 20,
      maximumDiscount: 500,
      minimumBookingAmount: 1000,
      bannerImage: "/banner.png",
      thumbnailImage: "/thumb.png",
      desktopBanner: "/desktop.png",
      mobileBanner: "/mobile.png",
      galleryImages: [],
      validFrom: "2026-08-01",
      validTill: "2026-08-31",
      maximumRedemptions: 100,
      perUserLimit: 1,
      priority: 1,
      featured: true,
      status: "active",
    });
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).toHaveLength(0);
  });
  it("accepts the partial ashram edit sent by ManageAshramsPage", async () => {
    const dto = plainToInstance(UpdateAshramDto, {
      name: "Shanti Ashram",
      description: "A calm riverside ashram",
      history: "Founded in 1954",
      rules: ["No smoking", "Silence after 9pm"],
      amenities: ["AC", "River View"],
      images: ["https://cdn.example.com/a.jpg"],
    });
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).toHaveLength(0);
  });
  it("strips the server fields the add-on editor round-trips", async () => {
    const dto = plainToInstance(UpdateAddOnDto, {
      _id: "507f1f77bcf86cd799439011",
      ashramId: "507f1f77bcf86cd799439012",
      createdAt: "2026-01-01T00:00:00.000Z",
      name: "Morning Prasad",
      price: "150",
      unit: "per_person",
      unitLabel: "Person",
      maxQuantity: 4,
      enabled: true,
    });
    expect(await validate(dto, { whitelist: true })).toHaveLength(0);
    expect(dto.price).toBe(150);
  });
  it("accepts the enable toggle the add-on list sends on its own", async () => {
    const dto = plainToInstance(UpdateAddOnDto, { enabled: false });
    expect(await validate(dto, { whitelist: true })).toHaveLength(0);
  });
  it("requires identity details when registering an owner", async () => {
    const dto = plainToInstance(RegisterDto, {
      name: "Ashram Owner",
      email: "owner@example.com",
      phone: "+919999999991",
      password: "SecurePass#123",
      role: "owner",
    });
    const fields = (await validate(dto)).map((error) => error.property);
    expect(fields).toEqual(
      expect.arrayContaining(["govtIdType", "govtIdNumber"]),
    );
  });
  it("keeps every supported RBAC role unique", () => {
    expect(new Set(USER_ROLES).size).toBe(USER_ROLES.length);
    expect(USER_ROLES).toEqual(
      expect.arrayContaining([
        "super_admin",
        "national_admin",
        "state_admin",
        "district_officer",
        "inspector",
        "owner",
        "manager",
        "reception",
        "housekeeping",
        "staff",
        "finance_manager",
        "support",
        "customer",
      ]),
    );
  });
});
