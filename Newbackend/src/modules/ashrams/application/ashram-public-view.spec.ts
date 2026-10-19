import { withoutPrivateAshramFields } from "./ashrams.service";

describe("public ashram view", () => {
  const row = {
    _id: "a1",
    name: "Seva Ashram",
    ownerId: "u9",
    contact: { phone: "1", email: "e@x.in" },
    trust: { trustName: "Seva Trust", panNo: "ABCDE1234F", trustType: "trust" },
    documents: { trustDeedUrl: "https://cdn/x.pdf" },
    inspectionDetails: { comments: "internal" },
    rejectionReason: "r",
    availabilityRequest: { pending: true },
    dayStayConfig: { enabled: true, verificationData: { notes: "n" } },
  };

  it("removes owner, KYC and review internals", () => {
    const out: any = withoutPrivateAshramFields(row);
    expect(out.ownerId).toBeUndefined();
    expect(out.documents).toBeUndefined();
    expect(out.inspectionDetails).toBeUndefined();
    expect(out.rejectionReason).toBeUndefined();
    expect(out.availabilityRequest).toBeUndefined();
    expect(out.trust.panNo).toBeUndefined();
    expect(out.dayStayConfig.verificationData).toBeUndefined();
  });

  it("keeps what the public page shows and does not mutate the input", () => {
    const out: any = withoutPrivateAshramFields(row);
    expect(out.name).toBe("Seva Ashram");
    expect(out.contact.email).toBe("e@x.in");
    expect(out.trust.trustName).toBe("Seva Trust");
    expect(out.dayStayConfig.enabled).toBe(true);
    expect(row.trust.panNo).toBe("ABCDE1234F");
  });
});
