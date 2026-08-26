import { RESERVED_SLUGS, slugify, uniqueSlug } from "./slug.util";

const takenBy = (taken: string[]) => async (candidate: string) =>
  taken.includes(candidate);

describe("slugify", () => {
  it("produces a clean lowercase slug", () => {
    expect(slugify("Saptrishi Ashram")).toBe("saptrishi-ashram");
  });

  it("strips punctuation, apostrophes and repeated separators", () => {
    expect(slugify("  Shri  Ram's --- Dharamshala!! ")).toBe(
      "shri-rams-dharamshala",
    );
  });

  it("folds accents rather than dropping the word", () => {
    expect(slugify("Rishikésh Āshram")).toBe("rishikesh-ashram");
  });

  it("never leaves a leading or trailing separator", () => {
    expect(slugify("--Haridwar--")).toBe("haridwar");
    expect(slugify("!!!")).toBe("");
  });

  it("keeps slugs to a sane length without a dangling dash", () => {
    const slug = slugify("a".repeat(200));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("returns the clean slug when nothing has taken it", async () => {
    expect(
      await uniqueSlug("Saptrishi Ashram", { exists: takenBy([]) }),
    ).toBe("saptrishi-ashram");
  });

  it("appends the smallest free counter on a collision", async () => {
    expect(
      await uniqueSlug("Shiv Mandir", {
        exists: takenBy(["shiv-mandir", "shiv-mandir-2"]),
      }),
    ).toBe("shiv-mandir-3");
  });

  it("lets the same name stay clean in a different scope", async () => {
    // The caller scopes `exists` to one city, so Haridwar's taken slug does not
    // force a counter on to Rishikesh's identically named ashram.
    const haridwar = await uniqueSlug("Shiv Mandir", {
      exists: takenBy(["shiv-mandir"]),
    });
    const rishikesh = await uniqueSlug("Shiv Mandir", { exists: takenBy([]) });
    expect(haridwar).toBe("shiv-mandir-2");
    expect(rishikesh).toBe("shiv-mandir");
  });

  it("keeps a reserved word from shadowing a real route", async () => {
    const slug = await uniqueSlug("Book", { exists: takenBy([]) });
    expect(RESERVED_SLUGS.has(slug)).toBe(false);
    expect(slug).toBe("book-listing");
  });

  it("falls back when the name slugs to nothing", async () => {
    expect(await uniqueSlug("!!!", { exists: takenBy([]) })).toBe("listing");
  });

  it("still resolves when every counter is exhausted", async () => {
    const slug = await uniqueSlug("Busy", {
      exists: async () => true,
      maxAttempts: 3,
    });
    expect(slug.startsWith("busy-")).toBe(true);
  });
});
