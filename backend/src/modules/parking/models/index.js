// Parking System — model registry.
//
// Eighteen new collections, every one prefixed `parking_`. No existing
// collection is read, written, extended or renamed by this module.
//
//   parking_partners       ParkingPartner
//   parking_locations      ParkingLocation
//   parking_slot_types     ParkingSlotType
//   parking_slots          ParkingSlot
//   parking_vehicle_types  ParkingVehicleType
//   parking_pricing        ParkingPricing
//   parking_availability   ParkingAvailability
//   parking_bookings       ParkingBooking
//   parking_payments       ParkingPayment
//   parking_transactions   ParkingTransaction
//   parking_qr_codes       ParkingQrCode
//   parking_scan_logs      ParkingScanLog
//   parking_staff          ParkingStaff
//   parking_reviews        ParkingReview
//   parking_notifications  ParkingNotification
//   parking_settings       ParkingSetting
//   parking_holidays       ParkingHoliday
//   parking_commissions    ParkingCommission

export { default as ParkingPartner } from './ParkingPartner.js';
export { default as ParkingLocation } from './ParkingLocation.js';
export { default as ParkingSlotType } from './ParkingSlotType.js';
export { default as ParkingSlot } from './ParkingSlot.js';
export { default as ParkingVehicleType } from './ParkingVehicleType.js';
export { default as ParkingPricing } from './ParkingPricing.js';
export { default as ParkingAvailability } from './ParkingAvailability.js';
export { default as ParkingBooking } from './ParkingBooking.js';
export { default as ParkingPayment } from './ParkingPayment.js';
export { default as ParkingTransaction } from './ParkingTransaction.js';
export { default as ParkingQrCode } from './ParkingQrCode.js';
export { default as ParkingScanLog } from './ParkingScanLog.js';
export { default as ParkingStaff } from './ParkingStaff.js';
export { default as ParkingReview } from './ParkingReview.js';
export { default as ParkingNotification } from './ParkingNotification.js';
export { default as ParkingSetting } from './ParkingSetting.js';
export { default as ParkingHoliday } from './ParkingHoliday.js';
export { default as ParkingCommission } from './ParkingCommission.js';
