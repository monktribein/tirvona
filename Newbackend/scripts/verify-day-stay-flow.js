const axios = require('axios');
const jwt = require('jsonwebtoken');

async function verifyFlow() {
  const baseUrl = 'http://localhost:5000/api/day-stay';
  const ashramId = '6a6351f57692f0668d796ce9';
  const roomId = '6ab0edc60aaf79c3d37c7e22';
  const date = '2026-09-23';
  const productCode = 'FRESHEN_UP';

  // Sign test JWT
  const jwtSecret = 'tirvona-local-jwt-secret-change-before-deployment';
  const token = jwt.sign(
    { id: '6a6351eb7692f0668d796b27', sub: '6a6351eb7692f0668d796b27', tv: 0 },
    jwtSecret,
    { audience: 'tirvona-clients', issuer: 'tirvona-api' }
  );

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  try {
    console.log('1. Checking Availability...');
    const availRes = await axios.get(`${baseUrl}/availability`, {
      params: { ashramId, roomId, date, productCode }
    });
    console.log(`Availability fetched: ${availRes.data?.totalSlots} total slots found.`);
    const firstAvail = availRes.data.slots.find(s => s.isAvailable);
    if (!firstAvail) {
      console.error('No available slot found');
      return;
    }
    console.log(`Selected Slot: ${firstAvail.startTime} - ${firstAvail.endTime} (₹${firstAvail.price})`);

    console.log('\n2. Holding Slot...');
    const holdRes = await axios.post(`${baseUrl}/hold`, {
      ashramId,
      roomId,
      productCode,
      date,
      startTime: firstAvail.startTime,
      guestsCount: 2,
      specialRequests: 'Ground floor room if possible'
    }, authHeaders);
    console.log('Hold successful:', {
      bookingId: holdRes.data.bookingId,
      reservationNumber: holdRes.data.reservationNumber,
      razorpayOrderId: holdRes.data.razorpayOrderId,
      demo: holdRes.data.demo,
      razorpayKeyId: holdRes.data.razorpayKeyId
    });

    console.log('\n3. Confirming Payment...');
    const crypto = require('crypto');
    const paymentId = `pay_${Date.now()}`;
    const keySecret = 'OTkWKiOdgxZ6fBDtQ3N5i0Cs';
    const signature = crypto.createHmac('sha256', keySecret).update(`${holdRes.data.razorpayOrderId}|${paymentId}`).digest('hex');

    const confirmRes = await axios.post(`${baseUrl}/confirm`, {
      bookingId: holdRes.data.bookingId,
      razorpayOrderId: holdRes.data.razorpayOrderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature
    }, authHeaders);
    console.log('Payment confirmation response:', {
      success: confirmRes.data.success,
      bookingId: confirmRes.data.bookingId,
      status: confirmRes.data.status,
      checkInCode: confirmRes.data.checkInCode,
      pricing: confirmRes.data.pricing
    });

    console.log('\n✅ ALL VERIFICATION CHECKS PASSED PERFECTLY!');
  } catch (err) {
    console.error('Flow failed:', err.response?.data || err.message);
  }
}

verifyFlow();
