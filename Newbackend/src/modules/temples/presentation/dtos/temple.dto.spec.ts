import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { CreateAartiDto, CreateTempleDto, UpdateTempleDto } from "./temple.dto";

// The same options as the app's global ValidationPipe.
const check = <T extends object>(cls: new () => T, body: object) => {
  const dto = plainToInstance(cls, body);
  const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
  return { dto, errors };
};

describe("temple form validation", () => {
  it("saves a temple with only a name and a city", () => {
    const { errors } = check(CreateTempleDto, { name: "Shri Radha Raman Mandir", address: { city: "Vrindavan" } });
    expect(errors).toEqual([]);
  });

  it("treats an empty slug as not given instead of refusing to save", () => {
    const { dto, errors } = check(CreateTempleDto, { name: "Shri Radha Raman Mandir", slug: "  " });
    expect(errors).toEqual([]);
    expect(dto.slug).toBeUndefined();
    // A slug that is given must still be valid.
    expect(check(CreateTempleDto, { name: "Temple", slug: "Not A Slug" }).errors).toHaveLength(1);
  });

  it("accepts the pujari's details and the temple's social media links", () => {
    const { errors } = check(UpdateTempleDto, {
      visitorInfo: { templeContactNumber: "+91 98765 43210", priestName: "Pt. Shyam Sharma", priestPhone: "9876500000" },
      media: {
        officialWebsite: "https://example.org",
        instagramUrl: "https://instagram.com/temple",
        facebookUrl: "https://facebook.com/temple",
        twitterUrl: "https://x.com/temple",
        youtubeUrl: "https://youtube.com/@temple",
      },
    });
    expect(errors).toEqual([]);
  });

  it("lets an aarti be saved with just its name and start time", () => {
    expect(check(CreateAartiDto, { name: "Mangla Aarti", startTime: "04:30" }).errors).toEqual([]);
    expect(check(CreateAartiDto, { name: "Mangla Aarti", startTime: "04:30", endTime: "" }).errors).toEqual([]);
    expect(check(CreateAartiDto, { name: "Mangla Aarti", startTime: "04:30", endTime: "25:00" }).errors).toHaveLength(1);
    expect(check(CreateAartiDto, { name: "Mangla Aarti" }).errors).toHaveLength(1);
  });
});
