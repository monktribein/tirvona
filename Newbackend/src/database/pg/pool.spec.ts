import { isConnectionLimitError, withConnectionRetry, type PgPool } from "./pool";

const limitError = () =>
  Object.assign(new Error("(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15"), {
    code: "XX000",
  });

const fakePool = (failures: number, error: () => Error = limitError) => {
  let calls = 0;
  const pool: PgPool = {
    connect: jest.fn(async () => {
      calls += 1;
      if (calls <= failures) throw error();
      return { query: async () => ({ rows: [], rowCount: 0 }), release: () => undefined };
    }),
    query: jest.fn(async () => {
      calls += 1;
      if (calls <= failures) throw error();
      return { rows: [{ ok: 1 }], rowCount: 1 };
    }),
    end: jest.fn(async () => undefined),
  };
  return pool;
};

describe("database connection-limit retry", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const settle = async <T>(promise: Promise<T>) => {
    const result = promise.then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    await jest.runAllTimersAsync();
    return result as Promise<{ value?: T; error?: any }>;
  };

  it("recognises the pooler's limit errors and nothing else", () => {
    expect(isConnectionLimitError(limitError())).toBe(true);
    expect(isConnectionLimitError({ code: "53300", message: "sorry, too many clients already" })).toBe(true);
    expect(isConnectionLimitError(new Error("duplicate key value violates unique constraint"))).toBe(false);
    expect(isConnectionLimitError(null)).toBe(false);
  });

  it("retries acquiring a connection until the pooler has room", async () => {
    const pool = fakePool(2);
    const out = await settle(withConnectionRetry(pool).connect());
    expect(out.error).toBeUndefined();
    expect(pool.connect).toHaveBeenCalledTimes(3);
  });

  it("retries a one-shot query refused at the limit", async () => {
    const pool = fakePool(1);
    const out = await settle(withConnectionRetry(pool).query("SELECT 1"));
    expect(out.value?.rows).toEqual([{ ok: 1 }]);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it("gives up after a bounded number of attempts", async () => {
    const pool = fakePool(100);
    const out = await settle(withConnectionRetry(pool).connect());
    expect(isConnectionLimitError(out.error)).toBe(true);
    expect(pool.connect).toHaveBeenCalledTimes(5);
  });

  it("never retries other errors (a failed write is not run twice)", async () => {
    const pool = fakePool(1, () => new Error("duplicate key value violates unique constraint"));
    const out = await settle(withConnectionRetry(pool).query("INSERT ..."));
    expect(out.error?.message).toMatch(/duplicate key/);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});
