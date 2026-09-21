# Tirvona Day Stay Engine™ — Architectural & Technical Decisions

---

## 1. Decision Log

### DEC-001: Schema Extension Strategy over Separate Day Stay Database
- **Context**: Day Stay requires time-based inventory, but sits inside the existing Tirvona platform.
- **Decision**: Extend existing Mongoose schemas (`AshramSchema`, `RoomSchema`, `BookingSchema`) and add a centralized product catalog (`DayStayProductSchema`).
- **Rationale**: Preserves single-source-of-truth for Users, Ashrams, Payments, Refunds, and Admin oversight while avoiding duplicate data models.
- **Classification**: Technical Decision.

### DEC-002: Backward Compatibility & Default Booking Type
- **Context**: Millions of existing or ongoing overnight bookings must remain uninterrupted without requiring breaking data migrations.
- **Decision**: Add `bookingType` with `enum: ['overnight', 'day_rest', 'freshen_up']` and default `"overnight"`. `dayStayDetails` is completely optional.
- **Rationale**: Existing queries, reporting, and overnight flows continue to work seamlessly without database migration downtime.
- **Classification**: Technical Decision.

### DEC-003: Configurable Durations over Hard-Coded Products
- **Context**: MVP pilot focuses on 90-minute Freshen-Up, 3-Hour, and 6-Hour Day Rest, but future requirements may introduce other durations (e.g. 120m, 240m).
- **Decision**: Created `day_stay_products` collection with `durationMinutes`, min/max constraints, and dynamic product catalog lookups.
- **Rationale**: Avoids hard-coded business rules in backend logic.
- **Classification**: Product / Technical Decision.

### DEC-004: Timezone Storage Strategy
- **Context**: Day Stays are time-window sensitive.
- **Decision**: Persist all specific slot instances (`slotStartTime`, `slotEndTime`, `graceExpiresAt`, `housekeepingEndsAt`) as UTC ISO `Date` timestamps in MongoDB, while storing recurring property operational hours (`operatingHours: { start: "06:00", end: "20:00" }`) as 24-hour time strings evaluated against property local time (`Asia/Kolkata`).
- **Rationale**: Standardizes database indexing and prevents DST or server timezone skew.
- **Classification**: Technical Decision.
