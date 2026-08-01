import Notification from '../models/Notification.js';

/**
 * Dispatch enterprise notifications to Stay Admin (Owner) and Super Admin
 */
export const dispatchBookingNotifications = async (bookingData) => {
  const {
    bookingId,
    reservationNumber,
    ashramId,
    ashramName,
    ownerId,
    roomName,
    guestName,
    guestPhone,
    guestEmail,
    checkInDate,
    checkOutDate,
    guestsCount,
    totalAmount,
    specialRequests,
  } = bookingData;

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

  const formattedCheckIn = formatDate(checkInDate);
  const formattedCheckOut = formatDate(checkOutDate);

  try {
    // 1. Stay Admin (Ashram Owner) In-App Enterprise Notification
    if (ownerId) {
      await Notification.create({
        recipientId: ownerId,
        recipientRole: 'owner',
        title: 'New Booking Received',
        message: `New reservation ${reservationNumber || bookingId} received for ${ashramName} (${roomName}) from ${guestName}. Dates: ${formattedCheckIn} to ${formattedCheckOut}. Total: ₹${totalAmount} (Pay at Ashram).`,
        type: 'in_app',
        severity: 'info',
        module: 'BOOKING_ENGINE',
        action: 'VIEW_RESERVATION',
        metadata: {
          bookingId,
          reservationNumber,
          ashramId,
          ashramName,
          roomName,
          guestName,
          guestPhone,
          guestEmail,
          checkInDate: formattedCheckIn,
          checkOutDate: formattedCheckOut,
          guestsCount,
          totalAmount,
          specialRequests: specialRequests || 'None',
        },
      });
    }

    // 2. Super Admin Enterprise Notification
    await Notification.create({
      recipientRole: 'super_admin',
      title: 'New Booking Created',
      message: `Enterprise Reservation ${reservationNumber || bookingId} created for ${ashramName} by ${guestName}. Status: Confirmed (Reservation Mode).`,
      type: 'in_app',
      severity: 'info',
      module: 'BOOKING_ENGINE',
      action: 'AUDIT_BOOKING',
      metadata: {
        bookingId,
        reservationNumber,
        ashramName,
        guestName,
        status: 'confirmed',
        paymentStatus: 'pending',
      },
    });

    console.log(`[Notification Engine] Notifications dispatched for reservation ${bookingId}`);
  } catch (err) {
    console.error('[Notification Engine] Error dispatching booking notifications:', err.message);
  }
};

/**
 * Dispatch Booking Confirmation Email
 */
export const sendBookingConfirmationEmail = async (bookingData) => {
  const {
    bookingId,
    reservationNumber,
    ashramName,
    guestName,
    guestEmail,
    guestPhone,
    checkInDate,
    checkOutDate,
    guestsCount,
    totalAmount,
    checkInCode,
  } = bookingData;

  const emailSubject = `Booking Confirmed - ${bookingId}`;
  const emailBody = `
==================================================
TIRVONA SACRED STAYS - RESERVATION CONFIRMATION
==================================================

Dear ${guestName},

Your ashram stay reservation has been CONFIRMED!

RESERVATION DETAILS:
--------------------------------------------------
Booking ID: ${bookingId}
Reservation Number: ${reservationNumber}
Ashram Name: ${ashramName}
Check-In Date: ${new Date(checkInDate).toDateString()}
Check-Out Date: ${new Date(checkOutDate).toDateString()}
Guests: ${guestsCount}
Counter Check-In Code: ${checkInCode}

PAYMENT SUMMARY:
--------------------------------------------------
Payment Status: Pending (Pay at Ashram)
Total Payable at Check-In: ₹${totalAmount}

CONTACT & ASSISTANCE:
--------------------------------------------------
Ashram Helpline: +91 98765 43210
Guest Support: ${guestEmail} | ${guestPhone}

Thank you for booking with Tirvona Sacred Stays.
==================================================
`;

  console.log(`\n--- [EMAIL DISPATCHER] ---`);
  console.log(`TO: ${guestEmail}`);
  console.log(`SUBJECT: ${emailSubject}`);
  console.log(emailBody);
  console.log(`---------------------------\n`);

  return { success: true, subject: emailSubject, to: guestEmail };
};

/**
 * SMS Architecture Placeholder (Ready for Twilio / MSG91 Integration)
 */
export const sendBookingConfirmationSMS = async (bookingData) => {
  const { bookingId, guestPhone, ashramName } = bookingData;
  console.log(`[SMS Gateway Architecture] (Ready): Confirmation SMS queued for ${guestPhone}: "Your reservation ${bookingId} at ${ashramName} is Confirmed. Pay at Ashram."`);
  return { success: true, queued: true };
};
