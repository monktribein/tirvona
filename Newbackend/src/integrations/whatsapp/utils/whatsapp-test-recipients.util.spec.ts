import {
  isAllowedTestRecipient,
  parseTestRecipients,
} from "./whatsapp-test-recipients.util";

describe("WhatsApp test recipients", () => {
  describe("parseTestRecipients", () => {
    it("normalizes a single Indian number", () => {
      expect(parseTestRecipients("919936968762")).toEqual(["919936968762"]);
    });

    it("treats +91, 91 and a bare 10-digit mobile as the same number", () => {
      expect(
        parseTestRecipients("+919936968762, 919936968762,9936968762"),
      ).toEqual(["919936968762"]);
    });

    it("supports multiple comma-separated recipients with stray spaces", () => {
      expect(parseTestRecipients(" +919936968762 ,  98111 11111 ")).toEqual([
        "919936968762",
        "919811111111",
      ]);
    });

    it("drops invalid entries and handles an unset value", () => {
      expect(parseTestRecipients("12345, ,abc")).toEqual([]);
      expect(parseTestRecipients(undefined)).toEqual([]);
    });
  });

  describe("isAllowedTestRecipient", () => {
    const testMode = (recipients: string) => ({
      testMode: true,
      testRecipients: parseTestRecipients(recipients),
    });

    it("allows every recipient when test mode is off", () => {
      expect(
        isAllowedTestRecipient(
          { testMode: false, testRecipients: ["919936968762"] },
          "+919876543210",
        ),
      ).toBe(true);
      expect(isAllowedTestRecipient(undefined, "+919876543210")).toBe(true);
    });

    it("allows an allow-listed recipient in any format", () => {
      const policy = testMode("919936968762");
      expect(isAllowedTestRecipient(policy, "+919936968762")).toBe(true);
      expect(isAllowedTestRecipient(policy, "919936968762")).toBe(true);
      expect(isAllowedTestRecipient(policy, "99369 68762")).toBe(true);
    });

    it("blocks a recipient who is not on the list", () => {
      expect(
        isAllowedTestRecipient(testMode("919936968762"), "+919876543210"),
      ).toBe(false);
    });

    it("allows any of several listed recipients", () => {
      const policy = testMode("919936968762,919811111111");
      expect(isAllowedTestRecipient(policy, "9811111111")).toBe(true);
      expect(isAllowedTestRecipient(policy, "+919936968762")).toBe(true);
      expect(isAllowedTestRecipient(policy, "9822222222")).toBe(false);
    });

    it("fails closed: an empty or invalid list blocks everyone", () => {
      expect(isAllowedTestRecipient(testMode(""), "+919936968762")).toBe(false);
      expect(isAllowedTestRecipient(testMode("abc"), "+919936968762")).toBe(
        false,
      );
    });

    it("blocks a missing or invalid phone in test mode", () => {
      const policy = testMode("919936968762");
      expect(isAllowedTestRecipient(policy, undefined)).toBe(false);
      expect(isAllowedTestRecipient(policy, "12345")).toBe(false);
    });
  });
});
