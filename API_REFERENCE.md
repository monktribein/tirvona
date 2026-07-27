# Tirvona (Ashray Bharat) — Backend API Reference

REST API for the Flutter / mobile client. Same endpoints the web app uses.

## Base URL
```
Local dev:   http://localhost:5000
Production:  https://<your-render-app>.onrender.com   ← replace after deploy
```
All routes below are prefixed with **`/api`**. Example: `POST {BASE_URL}/api/auth/login`.

**Interactive docs (Swagger UI):** `{BASE_URL}/api/docs` · raw spec: `{BASE_URL}/api/docs.json`
The OpenAPI spec lives at [`backend/openapi.yaml`](backend/openapi.yaml) — feed it to `openapi-generator` to auto-generate the Dart client.

> Mobile apps call the API directly — there is **no CORS restriction** for native Flutter (CORS only applies to browsers).

## Auth model (JWT)
1. Call `login` / `register` / `otp/verify` → response contains `data.token`.
2. Store the token (e.g. `flutter_secure_storage`).
3. Send it on every protected request:
   ```
   Authorization: Bearer <token>
   ```
Token is valid 30 days. A `401` means missing/expired token; `403` means wrong role or suspended account.

## Response envelope
Every response is JSON in this shape:
```json
{ "success": true, "data": { }, "message": "optional", "count": 0 }
```
On error: `{ "success": false, "message": "reason" }` with an HTTP 4xx/5xx status.

## Roles
`customer`, `owner`, `manager`, `reception`, `housekeeping`, `district_officer`, `govt_admin`, `super_admin`.
The **Auth** column shows who may call each endpoint (🔓 = public, 🔐 = any logged-in user, otherwise the allowed roles).

---

## 🔑 Auth — `/api/auth`
| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| POST | `/register` | 🔓 | `{ name, email, phone, password, role?, district?, state? }` → returns user + `token` |
| POST | `/login` | 🔓 | `{ email, password }` → returns user + `token` |
| POST | `/otp/send` | 🔓 | `{ phone }` — dev returns `otp` in response (demo) |
| POST | `/otp/verify` | 🔓 | `{ phone, otp }` → returns user + `token` (auto-creates guest) |
| POST | `/forgot-password` | 🔓 | `{ email }` → returns reset `code` (demo) |
| POST | `/reset-password` | 🔓 | `{ email, code, newPassword }` |
| GET | `/me` | 🔐 | current user profile |
| PUT | `/me` | 🔐 | `{ name?, phone? }` update own profile |
| GET | `/owner-staff` | owner, super_admin | list owner's staff |
| POST | `/owner-staff` | owner, super_admin | `{ name, email, phone, password, role }` create staff |
| PUT | `/owner-staff/:id/password` | owner, super_admin | `{ password }` reset staff password |
| PUT | `/owner-staff/:id/status` | owner, super_admin | toggle staff active/suspended |

## 🏠 Ashrams — `/api/ashrams`
| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| GET | `/` | 🔓 | **Search.** Query: `destination, checkIn, checkOut, guests, minPrice, maxPrice, amenities, rating, verified` |
| GET | `/:id` | 🔓 | one ashram + its rooms |
| GET | `/my-listings/all` | owner, manager, super_admin | listings owned by caller |
| POST | `/` | owner, super_admin | `{ name, description, address, history, rules, amenities }` |
| PUT | `/:id` | owner, manager, super_admin | update fields |
| POST | `/:id/documents` | owner, super_admin | `{ trustDeedUrl, fireSafetyCertificateUrl, landOwnershipUrl }` (URLs from Upload API) |

## 🛏️ Rooms — `/api/rooms`
| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| POST | `/` | owner, manager, super_admin | `{ ashramId, name, type, acType, capacity, totalInventory, basePrice, amenities?, pricingRules? }` |
| PUT | `/:id` | owner, manager, super_admin | update room |
| POST | `/:id/availability` | owner, manager, super_admin | `{ date, bookedCount?, maintenanceCount?, customPrice? }` |
| GET | `/:id/calendar` | 🔐 | Query: `startDate, endDate` → per-day price/availability |

## 📅 Bookings — `/api/bookings`
| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| POST | `/create` | customer | `{ ashramId, roomId, checkInDate, checkOutDate, guestsCount, roomsBookedCount, services }` |
| POST | `/:id/payment/order` | customer | creates Razorpay order → `{ orderId, amount, currency, keyId }` or `{ demo:true }` |
| POST | `/:id/payment` | customer | `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` **or** demo `{ method, transactionId }` |
| GET | `/history` | customer | caller's bookings |
| GET | `/:id` | 🔐 (booking owner or scoped staff) | single booking detail |
| GET | `/dashboard` | owner, manager, reception, super_admin | Query: `ashramId?, status?, date?` |
| POST | `/:id/checkin` | owner, manager, reception | `{ checkInCode }` (6-digit) |
| POST | `/:id/checkout` | owner, manager, reception | — |
| POST | `/:id/cancel` | 🔐 (owner of booking or staff) | `{ reason? }` |

### Booking → payment flow (mobile)
1. `POST /bookings/create` → returns booking with `_id`, `checkInCode`, `pricing.totalAmount`.
2. `POST /bookings/:id/payment/order` → if `demo:true`, skip gateway; else open **Razorpay Flutter SDK** with `orderId`/`keyId`/`amount`.
3. `POST /bookings/:id/payment` with the Razorpay result (or demo body) → booking becomes `confirmed`.

## ⭐ Reviews — `/api/reviews`
| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| POST | `/` | 🔐 customer | `{ ashramId, bookingId, rating:{overall,cleanliness,service,location,valueForMoney}, comment }` — only after checkout |
| GET | `/ashram/:ashramId` | 🔓 | approved reviews for an ashram |

## 🎉 Offers — `/api/offers`
| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| GET | `/public/active` | 🔓 | active homepage offers/deals |
| POST | `/` | owner, super_admin | create offer |
| GET | `/my-offers` | owner, super_admin | caller's offers |
| PUT | `/:id` | owner, super_admin | update |
| DELETE | `/:id` | owner, super_admin | delete |

## 🧹 Housekeeping — `/api/housekeeping`
| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| GET | `/` | owner, manager, reception, housekeeping, super_admin | room-unit board (auto-provisions units) |
| PATCH | `/:id` | same | `{ status: clean\|dirty\|cleaning\|maintenance, notes? }` |

## 🎫 Support — `/api/support`
| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| POST | `/` | customer, owner, manager | `{ title, description, category }` |
| GET | `/` | 🔐 | tickets (scoped by role) |
| POST | `/:id/message` | 🔐 | `{ text }` |
| POST | `/:id/resolve` | 🔐 | mark resolved |

## ✅ Verification (Govt) — `/api/verify`
| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| GET | `/pending` | district_officer, govt_admin, super_admin | ashrams awaiting review |
| POST | `/:id/schedule` | district_officer, super_admin | `{ date }` |
| POST | `/:id/status` | district_officer, govt_admin, super_admin | `{ status: approved\|rejected\|suspended, comments?, rejectionReason? }` |

## 📊 Analytics — `/api/analytics`
| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| GET | `/dashboard` | owner, manager, super_admin | Query: `ashramId?` |
| GET | `/system` | govt_admin, super_admin | nationwide stats |
| GET | `/audit-logs` | super_admin | Query: `module?, action?` |

## 👥 Users — `/api/users`
| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| GET | `/staff` | owner, super_admin | staff at owner's ashrams |
| POST | `/staff` | owner, super_admin | `{ name, email, phone, password, role, ashramId }` |
| DELETE | `/staff/:id` | owner, super_admin | deactivate staff |
| GET | `/` | super_admin, govt_admin | Query: `role?, status?, search?` |
| PATCH | `/:id/status` | super_admin | `{ status: active\|suspended\|pending }` |

## 📤 File Upload (Cloudinary) — `/api/uploads`
| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| POST | `/` | 🔐 | **`multipart/form-data`** — field `file` (image/PDF ≤10MB), optional `folder` → returns `{ url, publicId }` |

Returns **503** if the server has no Cloudinary keys configured. Store the returned `url` (e.g. in an ashram's `images`/`documents`). Images/PDFs live on **Cloudinary**; MongoDB only stores the URL string.

---

## Real-time (Socket.io) — optional
Connect to the **same base URL** with a Socket.io client:
```dart
socket.emit('join_dashboard', userId);          // join your room
socket.on('booking_update', (data) { ... });     // booking confirmed/checkin/checkout/cancel
socket.on('housekeeping_update', (data) { ... }); // room status change
```
> Real-time needs a persistent server (Render), not serverless.

## Quick Dart/Flutter example
```dart
final base = 'https://<your-render-app>.onrender.com/api';

// Login
final res = await http.post(Uri.parse('$base/auth/login'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({'email': email, 'password': password}));
final token = jsonDecode(res.body)['data']['token'];

// Authenticated request
final me = await http.get(Uri.parse('$base/auth/me'),
  headers: {'Authorization': 'Bearer $token'});
```
