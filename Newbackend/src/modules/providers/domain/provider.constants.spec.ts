import {
  ACTIVE_CASE_STATUSES,
  BOOKING_STATUSES,
  BOOKING_TRANSITIONS,
  CALENDAR_HOLDING_STATUSES,
  CONSULTATION_STATUSES,
  CONSULTATION_TRANSITIONS,
  FULFILMENT_TYPES,
  LEVEL_BY_CASE_TYPE,
  OFFERABLE_FULFILMENT_TYPES,
  PROVIDER_OPENABLE_CASE_TYPES,
  REJECTION_REASON_CODES,
  REQUIRED_EVIDENCE,
  RITUAL_STATUSES,
  RITUAL_TRANSITIONS,
  TERMINAL_BOOKING_STATUSES,
  VERIFICATION_CASE_TYPES,
  VERIFICATION_RANK,
  type BookingActor,
  type BookingStatus,
} from "./provider.constants";

describe("booking state machine", () => {
  const all = Object.entries(BOOKING_TRANSITIONS) as Array<[BookingStatus, (typeof BOOKING_TRANSITIONS)[BookingStatus]]>;

  it("defines every status exactly once", () => {
    expect(Object.keys(BOOKING_TRANSITIONS).sort()).toEqual([...BOOKING_STATUSES].sort());
  });

  it("only moves to statuses that exist", () => {
    for (const [, transitions] of all)
      for (const t of transitions) expect(BOOKING_STATUSES).toContain(t.to);
  });

  it("has no way out of a terminal state", () => {
    for (const status of TERMINAL_BOOKING_STATUSES) expect(BOOKING_TRANSITIONS[status]).toEqual([]);
    expect(BOOKING_TRANSITIONS.DISPUTED).toEqual([]);
  });

  it("never loops a status back to itself", () => {
    for (const [status, transitions] of all) for (const t of transitions) expect(t.to).not.toBe(status);
  });

  it("uses each command once per state", () => {
    for (const [status, transitions] of all) {
      const commands = transitions.map((t) => t.command);
      expect(new Set(commands).size).toBe(commands.length);
      void status;
    }
  });

  it("reaches CLOSED from PAYMENT_PENDING along the intended happy path", () => {
    const path = ["confirm_payment", "accept", "start_preparation", "mark_ready", "start", "complete", "queue_settlement", "close"];
    let state: BookingStatus = "PAYMENT_PENDING";
    for (const command of path) {
      const next: { to: BookingStatus } | undefined = BOOKING_TRANSITIONS[state].find((t) => t.command === command);
      expect(next).toBeDefined();
      state = next!.to;
    }
    expect(state).toBe("CLOSED");
  });

  it("keeps money-moving and provider-only steps away from the wrong actor", () => {
    const actorsOf = (command: string): BookingActor[] =>
      all.flatMap(([, ts]) => ts.filter((t) => t.command === command).flatMap((t) => [...t.actors]));
    // Only the payment integration confirms or fails a payment.
    expect(new Set(actorsOf("confirm_payment"))).toEqual(new Set(["SYSTEM"]));
    expect(new Set(actorsOf("fail_payment"))).toEqual(new Set(["SYSTEM"]));
    expect(new Set(actorsOf("expire_hold"))).toEqual(new Set(["SYSTEM"]));
    // A customer can never perform the provider's fulfilment steps.
    for (const command of ["accept", "decline", "start_preparation", "mark_ready", "start", "complete"])
      expect(actorsOf(command)).not.toContain("CUSTOMER");
    // Nobody but ops overrides.
    expect(new Set(actorsOf("cancel_by_ops"))).toEqual(new Set(["OPS"]));
  });

  it("demands a controlled reason wherever a booking is cancelled, declined or disputed", () => {
    for (const [, transitions] of all)
      for (const t of transitions)
        if (/cancel|decline|dispute|expire/.test(t.command)) {
          expect(t.reasons?.length).toBeGreaterThan(0);
        }
  });

  it("gives every state that holds provider time a way to give it back", () => {
    for (const status of CALENDAR_HOLDING_STATUSES) {
      if (status === "IN_PROGRESS") continue; // a started service completes or is disputed
      const cancels = BOOKING_TRANSITIONS[status].filter((t) => TERMINAL_BOOKING_STATUSES.includes(t.to));
      expect(cancels.length).toBeGreaterThan(0);
    }
  });

  it("does not leave time held in states that cannot move on", () => {
    for (const status of CALENDAR_HOLDING_STATUSES) expect(BOOKING_TRANSITIONS[status].length).toBeGreaterThan(0);
  });
});

describe("other lifecycles", () => {
  it("only transitions rituals between known statuses and never out of ARCHIVED", () => {
    for (const [from, tos] of Object.entries(RITUAL_TRANSITIONS)) {
      expect(RITUAL_STATUSES).toContain(from);
      for (const to of tos) expect(RITUAL_STATUSES).toContain(to);
    }
    expect(RITUAL_TRANSITIONS.ARCHIVED).toEqual([]);
    // Publishing is only reachable from APPROVED: nothing skips review.
    const into = Object.entries(RITUAL_TRANSITIONS).filter(([, tos]) => tos.includes("PUBLISHED")).map(([from]) => from);
    expect(into).toEqual(["APPROVED"]);
  });

  it("ends consultations in a final state", () => {
    for (const final of ["COMPLETED", "CANCELLED", "NO_SHOW"] as const) expect(CONSULTATION_TRANSITIONS[final]).toEqual([]);
    for (const [from, tos] of Object.entries(CONSULTATION_TRANSITIONS)) {
      expect(CONSULTATION_STATUSES).toContain(from);
      for (const to of tos) expect(CONSULTATION_STATUSES).toContain(to);
    }
  });
});

describe("verification rules", () => {
  it("ranks levels in the order the trust architecture defines", () => {
    expect(VERIFICATION_RANK.UNVERIFIED).toBe(0);
    expect(VERIFICATION_RANK.IDENTITY_VERIFIED).toBeLessThan(VERIFICATION_RANK.PROFESSIONAL_VERIFIED);
    expect(VERIFICATION_RANK.PROFESSIONAL_VERIFIED).toBeLessThan(VERIFICATION_RANK.INSTITUTION_VERIFIED);
    expect(VERIFICATION_RANK.INSTITUTION_VERIFIED).toBeLessThan(VERIFICATION_RANK.TIRVONA_TRUSTED);
  });

  it("grants a level for every case type, and never lets a provider open the trust review", () => {
    for (const type of VERIFICATION_CASE_TYPES) expect(LEVEL_BY_CASE_TYPE[type]).toBeDefined();
    expect(PROVIDER_OPENABLE_CASE_TYPES).not.toContain("TRUST_REVIEW");
    expect(LEVEL_BY_CASE_TYPE.TRUST_REVIEW).toBe("TIRVONA_TRUSTED");
  });

  it("asks for evidence on every case type except the earned one", () => {
    for (const type of VERIFICATION_CASE_TYPES)
      if (type === "TRUST_REVIEW") expect(REQUIRED_EVIDENCE[type]).toEqual([]);
      else expect(REQUIRED_EVIDENCE[type].length).toBeGreaterThan(0);
  });

  it("blocks a duplicate case while one is open or in review", () => {
    expect([...ACTIVE_CASE_STATUSES]).toEqual(["OPEN", "IN_REVIEW"]);
  });

  it("treats fraud and policy rejections as final and clerical ones as fixable", () => {
    expect(REJECTION_REASON_CODES.FRAUD_SUSPECTED.resubmittable).toBe(false);
    expect(REJECTION_REASON_CODES.POLICY_VIOLATION.resubmittable).toBe(false);
    expect(REJECTION_REASON_CODES.DUPLICATE_ACCOUNT.resubmittable).toBe(false);
    expect(REJECTION_REASON_CODES.ILLEGIBLE_EVIDENCE.resubmittable).toBe(true);
    expect(REJECTION_REASON_CODES.NAME_MISMATCH.resubmittable).toBe(true);
  });
});

describe("fulfilment types", () => {
  it("never lets a provider sell an institution-authorized service before the authorization ledger exists", () => {
    expect(FULFILMENT_TYPES).toContain("INSTITUTION_AUTHORIZED");
    expect(OFFERABLE_FULFILMENT_TYPES).not.toContain("INSTITUTION_AUTHORIZED");
    expect(OFFERABLE_FULFILMENT_TYPES).toHaveLength(FULFILMENT_TYPES.length - 1);
  });
});
