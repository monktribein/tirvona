# Retired source (not compiled)

This folder is outside `src/`, so it is neither built nor tested (`jest` ignores it).

`commerce-marketplace-orders/` holds the first-generation single-vendor marketplace order flow
(`marketplace_orders` + `marketplace_payments`). It was replaced by the vendor marketplace
(`marketplace_master_orders` + `marketplace_vendor_orders`, in `src/modules/marketplace`), which
the frontend already used. Only the customer address book was still needed and now lives in
`src/modules/commerce/.../marketplace-address.*`.

It was moved here instead of being deleted so the cleanup stays reversible. **Delete this folder
once the database cleanup is final** (see `database/cleanup/README.md`).
