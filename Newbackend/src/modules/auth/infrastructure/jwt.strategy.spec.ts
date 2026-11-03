import { ConfigService } from "@nestjs/config";
import { JwtStrategy } from "./jwt.strategy";

const account = (role: string, scopedAshramIds: string[] = []) => ({
  _id: { toString: () => "user-1" },
  name: "Test",
  email: "t@example.test",
  phone: "9999999999",
  role,
  status: "active",
  permissions: [],
  scopedAshramIds,
  tokenVersion: 0,
  isDeleted: false,
});

const strategyFor = (user: object, areaStays: string[] | null) => {
  const users = { findById: jest.fn().mockResolvedValue(user) } as any;
  const location = { stayIdsInArea: jest.fn().mockResolvedValue(areaStays) } as any;
  const config = new ConfigService({ jwtSecret: "test-secret", jwtIssuer: "tirvona-api", jwtAudience: "tirvona-clients" });
  return { strategy: new JwtStrategy(config, users, location), location };
};

describe("JwtStrategy and area-scoped logins", () => {
  it("gives an HR or Executive login the stays of its office area as its assigned stays", async () => {
    for (const role of ["hr", "executive"]) {
      const { strategy, location } = strategyFor(account(role, ["stale-stay"]), ["stay-a", "stay-b"]);
      const user = await strategy.validate({ sub: "user-1", tv: 0 });
      expect(user.scopedAshramIds).toEqual(["stay-a", "stay-b"]);
      expect(location.stayIdsInArea).toHaveBeenCalledWith(expect.objectContaining({ id: "user-1", role }));
    }
  });

  it("gives an area login without an office no stays at all", async () => {
    const { strategy } = strategyFor(account("executive", ["stale-stay"]), []);
    expect((await strategy.validate({ sub: "user-1", tv: 0 })).scopedAshramIds).toEqual([]);
  });

  it("leaves every other role's assigned stays exactly as stored", async () => {
    const { strategy, location } = strategyFor(account("manager", ["stay-x"]), ["stay-a"]);
    expect((await strategy.validate({ sub: "user-1", tv: 0 })).scopedAshramIds).toEqual(["stay-x"]);
    expect(location.stayIdsInArea).not.toHaveBeenCalled();
  });
});
