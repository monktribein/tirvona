import { configureDatabase } from "./database";
import { enablePostgresDriver } from "./pg/pg-driver";

jest.mock("./pg/pg-driver", () => ({ enablePostgresDriver: jest.fn() }));

describe("configureDatabase", () => {
  beforeEach(() => jest.mocked(enablePostgresDriver).mockClear());

  it("requires SUPABASE_DB_URL", () => {
    expect(() => configureDatabase({})).toThrow(/SUPABASE_DB_URL/);
    expect(enablePostgresDriver).not.toHaveBeenCalled();
  });

  it("enables the Postgres driver with pool and TTL settings", () => {
    configureDatabase({ SUPABASE_DB_URL: "postgres://u:p@host:5432/postgres", SUPABASE_POOL_MAX: "not-a-number", SUPABASE_TTL_SWEEP: "false" });
    const options = jest.mocked(enablePostgresDriver).mock.calls[0][0];
    expect(options.connectionString).toBe("postgres://u:p@host:5432/postgres");
    expect(options.poolMax).toBe(10);
    expect(options.ttlSweep).toBe(false);
    expect(options.registry.databases).toMatchObject({ "": "public", tirvona_leads: "leads", tirvona_smart_contact: "smart_contact" });
  });
});
