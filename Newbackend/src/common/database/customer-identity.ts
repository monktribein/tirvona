import { type Schema, SchemaTypes } from "mongoose";

/**
 * The two ways a customer can own a record: a website account (`User`) or a
 * WhatsApp-only guest (`WhatsAppCustomer`). Stays introduced the rule on
 * `Booking`; parking, aarti, events and the marketplace share it through here
 * so every module enforces the same thing the same way.
 */

/** An optional reference to the WhatsApp guest identity. */
export const whatsappCustomerRef = () => ({
  type: SchemaTypes.ObjectId,
  ref: "WhatsAppCustomer",
  default: null,
});

/**
 * Exactly one customer identity per row — never both, never neither.
 *
 * This replaces `accountField: required`: previously the row needed a
 * `users` document, which is why a WhatsApp guest could not have one without
 * a fake account being invented for them. Now the rule is that an identity
 * exists, not which collection it lives in. Existing website rows are
 * unaffected — they already carry the account field and never the other.
 */
export const requireOneCustomerIdentity = (
  schema: Schema,
  options: { accountField?: string; label: string },
): void => {
  const accountField = options.accountField ?? "customerId";
  schema.pre("validate", function enforceOneCustomerIdentity() {
    const row = this as any;
    const hasAccount = Boolean(row.get?.(accountField) ?? row[accountField]);
    const hasWhatsApp = Boolean(
      row.get?.("whatsappCustomerId") ?? row.whatsappCustomerId,
    );
    if (hasAccount === hasWhatsApp)
      throw new Error(
        hasAccount
          ? `A ${options.label} cannot belong to both a website account and a WhatsApp customer`
          : `A ${options.label} must belong to either a website account or a WhatsApp customer`,
      );
  });
};
