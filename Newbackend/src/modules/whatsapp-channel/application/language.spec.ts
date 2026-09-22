import { detectLanguage, resolveReplyLanguage } from "./language";

describe("reply language detection", () => {
  it("answers Devanagari in Hindi", () => {
    expect(detectLanguage("मुझे कमरा बुक करना है")).toBe("hi");
    expect(detectLanguage("नमस्ते")).toBe("hi");
  });

  it("answers Hinglish when Hindi words are typed in Latin script", () => {
    expect(detectLanguage("room book krna hai")).toBe("hinglish");
    expect(detectLanguage("bhai room chahiye near prem mandir")).toBe(
      "hinglish",
    );
    expect(detectLanguage("mujhe kal ke liye 2 log ka room chahiye")).toBe(
      "hinglish",
    );
  });

  it("answers plain English in English", () => {
    expect(detectLanguage("I want to book a room")).toBe("en");
    expect(detectLanguage("show me my bookings please")).toBe("en");
  });

  it("treats a mixed sentence as Hinglish, not English", () => {
    // A guest writing "room chahiye near Prem Mandir" is not writing English,
    // and answering them in English reads as the bot ignoring them.
    expect(detectLanguage("I need a room kal ke liye")).toBe("hinglish");
  });

  it("treats one Devanagari word in a Latin sentence as Hindi", () => {
    expect(detectLanguage("book a कमरा")).toBe("hi");
  });

  it("gives no verdict on a message too short to tell", () => {
    for (const value of ["2", "ok", "", "   ", "👍", "yes"])
      expect(detectLanguage(value)).toBeNull();
  });

  it("keeps the conversation's language when a message says nothing new", () => {
    // "2" in reply to "how many guests?" must not flip a Hindi conversation
    // into the default.
    expect(resolveReplyLanguage("2", "hi")).toBe("hi");
    expect(resolveReplyLanguage("", "en")).toBe("en");
  });

  it("switches language mid-conversation when the guest does", () => {
    expect(resolveReplyLanguage("मुझे कमरा चाहिए", "en")).toBe("hi");
    expect(resolveReplyLanguage("I changed my mind about this", "hi")).toBe(
      "en",
    );
  });

  it("falls back to the remembered profile language, then Hinglish", () => {
    expect(resolveReplyLanguage("2", null, "hi")).toBe("hi");
    expect(resolveReplyLanguage("2", null, null)).toBe("hinglish");
  });
});
