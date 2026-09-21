# Tirvona Day Stay Engine™ — Implementation Plan

**Date:** September 2026  
**Author:** Senior Full-Stack Engineer & Solution Architect  
**Platform:** Tirvona Accommodation Ecosystem  

---

## Task Breakdown & Roadmap

### Phase 1: Database Schemas & Core Domain Models
- **DAYSTAY-001**: Extend `AshramSchema` & `RoomSchema` with `dayStayConfig`, operating hours, and bathroom/amenity flags.
- **DAYSTAY-002**: Create `DayStayProduct` schema and seed MVP products (Freshen-Up 90m, Day Rest 3H, Day Rest 6H).
- **DAYSTAY-003**: Extend `BookingSchema` with `bookingType: 'overnight' | 'day_rest' | 'freshen_up'` and `dayStayDetails`.

### Phase 2: Backend Time-Slot Availability & Concurrency Engine
- **DAYSTAY-004**: Implement `DayStayInventoryService` with interval overlap math, housekeeping buffer, grace period, and overnight protection.
- **DAYSTAY-005**: Implement atomic inventory locking (`DayStayBookingService.holdSlot`) with 10-minute hold TTL and race condition safety.
- **DAYSTAY-006**: Integrate Razorpay payment verification and booking confirmation callback for Day Stay.

### Phase 3: Extensions, Operations & Vendor Control
- **DAYSTAY-007**: Implement `DayStayExtensionService` (forward availability quote and extension booking flow).
- **DAYSTAY-008**: Implement `DayStayVendorService` (instant "BLOCK DAY STAY" for today/tomorrow/range, live reception radar, overstay tracking).
- **DAYSTAY-009**: Implement "Tirvona Day Rest Verified™" admin verification workflow and audit logging.

### Phase 4: Frontend Pilgrim Discovery & Booking Experience
- **DAYSTAY-010**: Enhance `SearchPage.tsx` and `HomePage.tsx` with Day Stay mode selector, arrival time picker, and duration tabs.
- **DAYSTAY-011**: Enhance `AshramDetailPage.tsx` with Day Stay product cards, bathroom photo prominence, transparent operational policies, and quick booking drawer.
- **DAYSTAY-012**: Build Pilgrim Active Stay & Extension drawer on customer dashboard.

### Phase 5: Vendor & Admin Management UI
- **DAYSTAY-013**: Build Vendor Day Stay Management tab in `OwnerDashboard.tsx` with prominent "BLOCK DAY STAY" button, buffer settings, and live status monitor.
- **DAYSTAY-014**: Build Admin Day Rest Verification inspection modal in `VerificationQueuePage.tsx`.

### Phase 6: Reviews, Notifications & Quality Assurance
- **DAYSTAY-015**: Extend review system for Day Stay specific ratings (bathroom hygiene, check-in speed, family suitability).
- **DAYSTAY-016**: Add notification templates for Day Stay confirmations, 30m checkout alerts, and overstay notices.
- **DAYSTAY-017**: Comprehensive test suite (unit tests, concurrency simulation for simultaneous bookings on the last available slot, regression tests for overnight stays).
