import type { ReplyLanguage } from "./language";
import { formatDateTime } from "./stay-slots";

/**
 * Replies for the parts of the stay flow that show the guest real data:
 * the property, its room categories, offers, coupons, the booking summary
 * with its price breakdown, and refund status.
 *
 * Every figure in these messages is passed in — it came from the booking
 * domain (`BookingsService.quote` and friends). Nothing here adds, rounds or
 * derives a price; it only lays the given lines out and labels them.
 */

type Phrase = Record<ReplyLanguage, string>;

const pick = (phrase: Phrase, language: ReplyLanguage): string =>
  phrase[language] ?? phrase.hinglish;

export const money = (amount: number): string =>
  `₹${Number(amount ?? 0).toLocaleString("en-IN")}`;

const day = (value: Date | string): string =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const when = (isoDate: string, time?: string): string =>
  time ? formatDateTime(isoDate, time) : day(`${isoDate}T00:00:00.000Z`);

const clip = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;

export interface SummaryInput {
  property: string;
  city?: string;
  rooms: { name: string; units: number }[];
  checkInDate: string;
  checkInTime?: string;
  checkOutDate: string;
  checkOutTime?: string;
  policyCheckIn?: string;
  policyCheckOut?: string;
  nights: number;
  guests: number;
  adults?: number;
  children?: number;
  /** Straight from `quote.services` — never composed here. */
  addOns: { name: string; quantity: number; totalPrice: number }[];
  flatServices: { key: string; price: number }[];
  coupon?: { code: string; title?: string } | null;
  pricing: {
    basePrice: number;
    servicesPrice: number;
    extraGuestAmount: number;
    platformFee: number;
    gstAmount: number;
    gstPercent: number;
    discountAmount: number;
    totalAmount: number;
  };
  cancellationPolicy?: string;
}

const SERVICE_LABEL: Record<string, Phrase> = {
  prasad: { en: "Prasad", hi: "प्रसाद", hinglish: "Prasad" },
  meals: { en: "Meals", hi: "भोजन", hinglish: "Meals" },
  parking: { en: "Parking", hi: "पार्किंग", hinglish: "Parking" },
  locker: { en: "Locker", hi: "लॉकर", hinglish: "Locker" },
};

type Labels = Record<string, string>;

const PROPERTY_LABELS: Record<ReplyLanguage, Labels> = {
  en: { checkIn: "Check-in", checkOut: "Check-out", amenities: "Amenities", minStay: "Minimum stay", nights: "night(s)", policy: "Cancellation" },
  hi: { checkIn: "चेक-इन", checkOut: "चेक-आउट", amenities: "सुविधाएँ", minStay: "न्यूनतम ठहराव", nights: "रात", policy: "कैंसिलेशन" },
  hinglish: { checkIn: "Check-in", checkOut: "Check-out", amenities: "Facilities", minStay: "Minimum stay", nights: "raat", policy: "Cancellation" },
};

const SUMMARY_LABELS: Record<ReplyLanguage, Labels> = {
  en: { head: "*Booking summary*", stay: "Stay", rooms: "Rooms", checkIn: "Check-in", checkOut: "Check-out", nights: "Nights", guests: "Guests", adults: "adults", children: "children", services: "Services", coupon: "Coupon", price: "*Price*", room: "Room charges", extra: "Extra guest charge", fee: "Platform fee", gst: "GST", discount: "Discount", total: "Total", policy: "Cancellation", standard: "Standard check-in/out" },
  hi: { head: "*बुकिंग विवरण*", stay: "ठहराव", rooms: "कमरे", checkIn: "चेक-इन", checkOut: "चेक-आउट", nights: "रातें", guests: "मेहमान", adults: "वयस्क", children: "बच्चे", services: "सेवाएँ", coupon: "कूपन", price: "*कीमत*", room: "कमरे का शुल्क", extra: "अतिरिक्त मेहमान शुल्क", fee: "प्लेटफ़ॉर्म शुल्क", gst: "GST", discount: "छूट", total: "कुल", policy: "कैंसिलेशन", standard: "सामान्य चेक-इन/आउट" },
  hinglish: { head: "*Booking summary*", stay: "Stay", rooms: "Rooms", checkIn: "Check-in", checkOut: "Check-out", nights: "Nights", guests: "Guests", adults: "adults", children: "bacche", services: "Services", coupon: "Coupon", price: "*Price*", room: "Room charges", extra: "Extra guest charge", fee: "Platform fee", gst: "GST", discount: "Discount", total: "Total", policy: "Cancellation", standard: "Standard check-in/out" },
};

const DETAIL_LABELS: Record<ReplyLanguage, Labels> = {
  en: { rooms: "Rooms", checkIn: "Check-in", checkOut: "Check-out", guests: "Guests", status: "Status", payment: "Payment", total: "Total", code: "Arrival code", refund: "Refund" },
  hi: { rooms: "कमरे", checkIn: "चेक-इन", checkOut: "चेक-आउट", guests: "मेहमान", status: "स्थिति", payment: "भुगतान", total: "कुल", code: "आगमन कोड", refund: "रिफ़ंड" },
  hinglish: { rooms: "Rooms", checkIn: "Check-in", checkOut: "Check-out", guests: "Guests", status: "Status", payment: "Payment", total: "Total", code: "Arrival code", refund: "Refund" },
};

export const stayCopy = {
  propertyIntro: (
    language: ReplyLanguage,
    p: {
      name: string;
      city: string;
      description: string;
      amenities: string[];
      checkInTime?: string;
      checkOutTime?: string;
      minStay?: number;
      cancellationPolicy?: string;
    },
  ): string => {
    const l = PROPERTY_LABELS[language] ?? PROPERTY_LABELS.hinglish;
    const lines = [
      `🏠 *${p.name}*${p.city ? `, ${p.city}` : ""}`,
      p.description ? clip(p.description, 240) : "",
      p.amenities.length
        ? `${l.amenities}: ${p.amenities.slice(0, 6).join(", ")}`
        : "",
      p.checkInTime ? `${l.checkIn}: ${p.checkInTime}` : "",
      p.checkOutTime ? `${l.checkOut}: ${p.checkOutTime}` : "",
      p.minStay && p.minStay > 1 ? `${l.minStay}: ${p.minStay} ${l.nights}` : "",
      p.cancellationPolicy ? `${l.policy}: ${clip(p.cancellationPolicy, 200)}` : "",
    ];
    return lines.filter(Boolean).join("\n");
  },

  pickRoomCategory: (
    language: ReplyLanguage,
    input: { nights: number; guests: number },
  ): string =>
    pick(
      {
        en: `Room categories for ${input.nights} night(s), ${input.guests} guest(s). Tap one — or type it, e.g. "2 deluxe and 1 standard".`,
        hi: `${input.nights} रात, ${input.guests} मेहमान के लिए कमरे। एक चुनें — या लिखें, जैसे "2 deluxe और 1 standard"।`,
        hinglish: `${input.nights} raat, ${input.guests} guest ke liye room categories. Ek chunein — ya likhein, jaise "2 deluxe aur 1 standard".`,
      },
      language,
    ),

  /**
   * The same question before any date is known. The guest picks the kind of
   * room first and the calendar is then read for that category, so the dates
   * offered are the ones that category actually has open — which is why this
   * cannot mention nights or guests yet.
   */
  pickRoomCategoryUndated: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Here are the room categories at this stay. Tap the one you'd like.",
        hi: "यहाँ इस ठहरने की कमरा श्रेणियाँ हैं। जो चाहिए उसे चुनें।",
        hinglish:
          "Yahan is stay ki room categories hain. Jo chahiye use tap karein.",
      },
      language,
    ),

  /** Heads the tappable list of dates this room category actually has open. */
  pickStayDate: (
    language: ReplyLanguage,
    which: "checkIn" | "checkOut",
  ): string =>
    pick(
      which === "checkIn"
        ? {
            en: "These dates are open for this room. Tap your check-in date.",
            hi: "इस कमरे के लिए ये तारीखें खुली हैं। चेक-इन तारीख चुनें।",
            hinglish:
              "Is room ke liye ye dates open hain. Check-in date tap karein.",
          }
        : {
            en: "Tap your check-out date.",
            hi: "चेक-आउट तारीख चुनें।",
            hinglish: "Check-out date tap karein.",
          },
      language,
    ),

  /** Per-night price and units left, as the calendar reports them. */
  dateRowDescription: (
    language: ReplyLanguage,
    r: { price?: number; available?: number },
  ): string => {
    const parts = [
      r.price ? money(Number(r.price)) : null,
      r.available !== undefined && r.available !== null
        ? pick(
            {
              en: `${r.available} left`,
              hi: `${r.available} बचे`,
              hinglish: `${r.available} bache`,
            },
            language,
          )
        : null,
    ].filter(Boolean);
    return parts.join(" · ");
  },

  /**
   * No night in the calendar is open for this category. The guest is offered
   * another category rather than left at a dead end.
   */
  noOpenDates: (language: ReplyLanguage): string =>
    pick(
      {
        en: "This room has no open dates in the next month. Please pick another category.",
        hi: "इस कमरे की अगले महीने कोई तारीख खाली नहीं है। कृपया दूसरी श्रेणी चुनें।",
        hinglish:
          "Is room ki agle mahine koi date khali nahi hai. Kripya dusri category chunein.",
      },
      language,
    ),

  roomRowDescription: (
    language: ReplyLanguage,
    r: {
      acType?: string;
      capacity?: number;
      basePrice?: number;
      /** The room's own rate discount applied — what pricing actually charges. */
      sellingPrice?: number;
      unitsLeft?: number | null;
    },
  ): string => {
    const nightly = r.sellingPrice ?? r.basePrice;
    const guests = r.capacity
      ? pick(
          {
            en: `up to ${r.capacity} guests`,
            hi: `${r.capacity} मेहमान तक`,
            hinglish: `${r.capacity} guest tak`,
          },
          language,
        )
      : "";
    const left =
      r.unitsLeft === null || r.unitsLeft === undefined
        ? ""
        : pick(
            {
              en: `${r.unitsLeft} left`,
              hi: `${r.unitsLeft} बचे`,
              hinglish: `${r.unitsLeft} bacche`,
            },
            language,
          );
    return [
      r.acType,
      guests,
      nightly ? `${money(nightly)}/night` : "",
      left,
    ]
      .filter(Boolean)
      .join(" · ");
  },

  noRoomsForDates: (language: ReplyLanguage): string =>
    pick(
      {
        en: "No room category is open for those dates and guests. You can try other dates or a different place — just tell me.",
        hi: "इन तारीखों और मेहमानों के लिए कोई कमरा उपलब्ध नहीं है। आप दूसरी तारीखें या दूसरी जगह बता सकते हैं।",
        hinglish: "In dates aur guests ke liye koi room available nahi hai. Aap doosri dates ya doosri jagah bata sakte hain.",
      },
      language,
    ),

  roomUnitsExceed: (
    language: ReplyLanguage,
    input: { room: string; left: number },
  ): string =>
    pick(
      {
        en: `Only ${input.left} unit(s) of ${input.room} are open for those dates. Tell me a smaller number or another category.`,
        hi: `उन तारीखों में ${input.room} की सिर्फ़ ${input.left} यूनिट खाली हैं। कम संख्या या दूसरी श्रेणी बताइए।`,
        hinglish: `Un dates mein ${input.room} ke sirf ${input.left} unit khaali hain. Kam number ya doosri category bataiye.`,
      },
      language,
    ),

  roomAmbiguous: (
    language: ReplyLanguage,
    names: string[],
  ): string =>
    pick(
      {
        en: `That could be ${names.join(" or ")}. Which one do you mean?`,
        hi: `यह ${names.join(" या ")} हो सकता है। आपका मतलब कौन सा है?`,
        hinglish: `Ye ${names.join(" ya ")} ho sakta hai. Aapka matlab kaunsa hai?`,
      },
      language,
    ),

  roomsChosen: (
    language: ReplyLanguage,
    rooms: { name: string; units: number }[],
  ): string =>
    pick(
      {
        en: `Rooms: ${rooms.map((r) => `${r.units} × ${r.name}`).join(", ")}`,
        hi: `कमरे: ${rooms.map((r) => `${r.units} × ${r.name}`).join(", ")}`,
        hinglish: `Rooms: ${rooms.map((r) => `${r.units} × ${r.name}`).join(", ")}`,
      },
      language,
    ),

  pickRoomFirst: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Please choose a room category first, then I can apply that.",
        hi: "पहले कोई कमरा चुनें, फिर मैं वह लागू कर दूँगा।",
        hinglish: "Pehle koi room category chunein, phir main wo laga dunga.",
      },
      language,
    ),

  quoteRefused: (language: ReplyLanguage, reason: string): string =>
    pick(
      {
        en: `I couldn't price that: ${reason}`,
        hi: `मैं इसकी कीमत नहीं निकाल पाया: ${reason}`,
        hinglish: `Main iska price nahi nikal paya: ${reason}`,
      },
      language,
    ),

  summary: (language: ReplyLanguage, s: SummaryInput): string => {
    const l = SUMMARY_LABELS[language] ?? SUMMARY_LABELS.hinglish;
    const guestLine =
      s.adults !== undefined || s.children !== undefined
        ? `${s.guests} (${s.adults ?? 0} ${l.adults}${s.children ? `, ${s.children} ${l.children}` : ""})`
        : String(s.guests);
    const serviceLines = [
      ...s.addOns.map(
        (a) => `  • ${a.name} × ${a.quantity}: ${money(a.totalPrice)}`,
      ),
      ...s.flatServices.map(
        (f) =>
          `  • ${pick(SERVICE_LABEL[f.key] ?? { en: f.key, hi: f.key, hinglish: f.key }, language)}: ${money(f.price)}`,
      ),
    ];
    const p = s.pricing;
    const priceLines = [
      l.price,
      `${l.room}: ${money(p.basePrice)}`,
      p.servicesPrice > 0 ? `${l.services}: ${money(p.servicesPrice)}` : "",
      p.extraGuestAmount > 0 ? `${l.extra}: ${money(p.extraGuestAmount)}` : "",
      p.platformFee > 0 ? `${l.fee}: ${money(p.platformFee)}` : "",
      p.gstAmount > 0
        ? `${l.gst}${p.gstPercent ? ` (${p.gstPercent}%)` : ""}: ${money(p.gstAmount)}`
        : "",
      p.discountAmount > 0
        ? `${l.discount}${s.coupon ? ` (${s.coupon.code})` : ""}: -${money(p.discountAmount)}`
        : "",
      `${l.total}: *${money(p.totalAmount)}*`,
    ];
    return [
      l.head,
      `🏠 ${l.stay}: ${s.property}${s.city ? `, ${s.city}` : ""}`,
      `🛏 ${l.rooms}: ${s.rooms.map((r) => `${r.units} × ${r.name}`).join(", ")}`,
      `📅 ${l.checkIn}: ${when(s.checkInDate, s.checkInTime)}`,
      `📅 ${l.checkOut}: ${when(s.checkOutDate, s.checkOutTime)}`,
      s.policyCheckIn || s.policyCheckOut
        ? `   ${l.standard}: ${[s.policyCheckIn, s.policyCheckOut].filter(Boolean).join(" / ")}`
        : "",
      `🌙 ${l.nights}: ${s.nights}`,
      `👥 ${l.guests}: ${guestLine}`,
      serviceLines.length ? `➕ ${l.services}:\n${serviceLines.join("\n")}` : "",
      s.coupon ? `🏷 ${l.coupon}: ${s.coupon.code}${s.coupon.title ? ` — ${s.coupon.title}` : ""}` : "",
      "",
      ...priceLines.filter(Boolean),
      s.cancellationPolicy ? `\n${l.policy}: ${clip(s.cancellationPolicy, 220)}` : "",
    ]
      .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
      .join("\n");
  },

  summaryPrompt: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Shall I hold this booking? You can also say things like “apply coupon SAVE20” or “2 rooms”.",
        hi: "क्या मैं यह बुकिंग होल्ड कर दूँ? आप “coupon SAVE20 लगाओ” या “2 rooms” भी कह सकते हैं।",
        hinglish: "Kya main ye booking hold kar doon? Aap “coupon SAVE20 laga do” ya “2 rooms” bhi bol sakte hain.",
      },
      language,
    ),

  confirmButton: (language: ReplyLanguage): string =>
    pick({ en: "Confirm", hi: "कन्फर्म", hinglish: "Confirm" }, language),
  changeButton: (language: ReplyLanguage): string =>
    pick({ en: "Change", hi: "बदलें", hinglish: "Change" }, language),
  cancelButton: (language: ReplyLanguage): string =>
    pick({ en: "Cancel", hi: "रद्द", hinglish: "Cancel" }, language),

  changeMenuBody: (language: ReplyLanguage): string =>
    pick(
      {
        en: "What would you like to change?",
        hi: "आप क्या बदलना चाहेंगे?",
        hinglish: "Aap kya change karna chahenge?",
      },
      language,
    ),

  changeMenuRows: (
    language: ReplyLanguage,
  ): { id: string; title: string; description?: string }[] => [
    {
      id: "change:rooms",
      title: pick({ en: "Rooms", hi: "कमरे", hinglish: "Rooms" }, language),
      description: pick({ en: "Category or number of rooms", hi: "श्रेणी या संख्या", hinglish: "Category ya number" }, language),
    },
    {
      id: "change:guests",
      title: pick({ en: "Guests", hi: "मेहमान", hinglish: "Guests" }, language),
      description: pick({ en: "Adults and children", hi: "वयस्क और बच्चे", hinglish: "Adults aur bacche" }, language),
    },
    {
      id: "change:dates",
      title: pick({ en: "Dates", hi: "तारीखें", hinglish: "Dates" }, language),
      description: pick({ en: "Check-in / check-out", hi: "चेक-इन / चेक-आउट", hinglish: "Check-in / check-out" }, language),
    },
    {
      id: "change:services",
      title: pick({ en: "Add-ons", hi: "सेवाएँ", hinglish: "Add-ons" }, language),
      description: pick({ en: "Meals, prasad, parking…", hi: "भोजन, प्रसाद, पार्किंग…", hinglish: "Meals, prasad, parking…" }, language),
    },
    {
      id: "change:coupon",
      title: pick({ en: "Coupon", hi: "कूपन", hinglish: "Coupon" }, language),
      description: pick({ en: "Apply or remove a code", hi: "कोड लगाएँ या हटाएँ", hinglish: "Code lagayein ya hatayein" }, language),
    },
  ],

  askDates: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Tell me the new dates, e.g. “check-in 5 Oct, check-out 7 Oct”.",
        hi: "नई तारीखें बताइए, जैसे “5 अक्टूबर चेक-इन, 7 अक्टूबर चेक-आउट”।",
        hinglish: "Nayi dates bataiye, jaise “5 Oct check-in, 7 Oct check-out”.",
      },
      language,
    ),

  askGuestSplit: (language: ReplyLanguage): string =>
    pick(
      {
        en: "How many guests? e.g. “2 adults and 1 child”.",
        hi: "कितने मेहमान? जैसे “2 वयस्क और 1 बच्चा”।",
        hinglish: "Kitne guests? Jaise “2 adults aur 1 child”.",
      },
      language,
    ),

  askCoupon: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Send the coupon code, e.g. “SAVE20 coupon”. Say “remove coupon” to take it off.",
        hi: "कूपन कोड भेजें, जैसे “SAVE20 coupon”। हटाने के लिए “coupon हटाओ” लिखें।",
        hinglish: "Coupon code bhejein, jaise “SAVE20 coupon”. Hatane ke liye “coupon hata do” likhein.",
      },
      language,
    ),

  servicesList: (
    language: ReplyLanguage,
    addOns: { name: string; price: number; unitLabel?: string }[],
  ): string => {
    const flat = ["prasad", "meals", "parking", "locker"]
      .map((k) => pick(SERVICE_LABEL[k], language))
      .join(", ");
    const extra = addOns.length
      ? "\n" +
        addOns
          .map((a) => `• ${a.name} — ${money(a.price)}${a.unitLabel ? ` ${a.unitLabel}` : ""}`)
          .join("\n")
      : "";
    return pick(
      {
        en: `Services you can add: ${flat}.${extra}\nSay e.g. “parking chahiye” or “meals hata do”.`,
        hi: `जो सेवाएँ जोड़ सकते हैं: ${flat}।${extra}\nजैसे कहें “parking चाहिए” या “meals हटाओ”।`,
        hinglish: `Jo services add kar sakte hain: ${flat}.${extra}\nJaise bolein “parking chahiye” ya “meals hata do”.`,
      },
      language,
    );
  },

  servicesUpdated: (language: ReplyLanguage): string =>
    pick(
      { en: "Updated.", hi: "अपडेट हो गया।", hinglish: "Update ho gaya." },
      language,
    ),

  couponApplied: (
    language: ReplyLanguage,
    input: { code: string; discount: number; total: number },
  ): string =>
    pick(
      {
        en: `Coupon *${input.code}* applied — you save ${money(input.discount)}. New total: *${money(input.total)}*.`,
        hi: `कूपन *${input.code}* लग गया — आपकी बचत ${money(input.discount)}। नया कुल: *${money(input.total)}*।`,
        hinglish: `Coupon *${input.code}* lag gaya — aapki bachat ${money(input.discount)}. Naya total: *${money(input.total)}*.`,
      },
      language,
    ),

  couponRefused: (
    language: ReplyLanguage,
    input: { code: string; reason: string },
  ): string =>
    pick(
      {
        en: `Couldn't apply *${input.code}*: ${input.reason}`,
        hi: `*${input.code}* नहीं लग पाया: ${input.reason}`,
        hinglish: `*${input.code}* nahi lag paya: ${input.reason}`,
      },
      language,
    ),

  couponHeld: (language: ReplyLanguage, code: string): string =>
    pick(
      {
        en: `Noted coupon *${code}*. I'll apply it once you've chosen a room.`,
        hi: `कूपन *${code}* नोट कर लिया। कमरा चुनते ही मैं इसे लगा दूँगा।`,
        hinglish: `Coupon *${code}* note kar liya. Room chunte hi main ise laga dunga.`,
      },
      language,
    ),

  couponRemoved: (language: ReplyLanguage): string =>
    pick(
      { en: "Coupon removed.", hi: "कूपन हटा दिया।", hinglish: "Coupon hata diya." },
      language,
    ),

  noCouponToRemove: (language: ReplyLanguage): string =>
    pick(
      {
        en: "No coupon is applied right now.",
        hi: "अभी कोई कूपन लगा हुआ नहीं है।",
        hinglish: "Abhi koi coupon laga hua nahi hai.",
      },
      language,
    ),

  noOffers: (language: ReplyLanguage): string =>
    pick(
      {
        en: "There is no running offer for this stay right now. If you have a coupon code, send it and I'll check it.",
        hi: "इस ठहराव के लिए अभी कोई ऑफ़र नहीं चल रहा। आपके पास कूपन कोड हो तो भेजें, मैं जाँच लूँगा।",
        hinglish: "Is stay ke liye abhi koi offer nahi chal raha. Aapke paas coupon code ho to bhejein, main check kar lunga.",
      },
      language,
    ),

  offersHeader: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Offers for this stay — tap one to try it on your booking:",
        hi: "इस ठहराव के ऑफ़र — अपनी बुकिंग पर आज़माने के लिए एक चुनें:",
        hinglish: "Is stay ke offers — apni booking par try karne ke liye ek chunein:",
      },
      language,
    ),

  offerRow: (
    language: ReplyLanguage,
    o: {
      promoCode: string;
      discountType: string;
      discountValue: number;
      maximumDiscount: number;
      minimumBookingAmount: number;
      validTill: Date | string | null;
    },
  ): { title: string; description: string } => {
    const benefit =
      o.discountType === "Percentage"
        ? `${o.discountValue}% off${o.maximumDiscount ? ` (max ${money(o.maximumDiscount)})` : ""}`
        : o.discountType === "Flat Amount"
          ? `${money(o.discountValue)} off`
          : o.discountType;
    const rules = [
      o.minimumBookingAmount ? `min ${money(o.minimumBookingAmount)}` : "",
      o.validTill ? `till ${day(o.validTill)}` : "",
    ].filter(Boolean);
    return {
      title: o.promoCode,
      description: [benefit, ...rules].join(" · "),
    };
  },

  bookingDetail: (
    language: ReplyLanguage,
    b: {
      reference: string;
      property: string;
      rooms: string;
      checkIn: string;
      checkOut: string;
      guests: number;
      status: string;
      paymentStatus: string;
      total: number;
      checkInCode?: string;
      refund?: string;
    },
  ): string => {
    const t = DETAIL_LABELS[language] ?? DETAIL_LABELS.hinglish;
    return [
      `*${b.reference}* — ${b.property}`,
      b.rooms ? `${t.rooms}: ${b.rooms}` : "",
      `${t.checkIn}: ${b.checkIn}`,
      `${t.checkOut}: ${b.checkOut}`,
      `${t.guests}: ${b.guests}`,
      `${t.status}: ${b.status} · ${t.payment}: ${b.paymentStatus}`,
      `${t.total}: ${money(b.total)}`,
      b.checkInCode ? `${t.code}: *${b.checkInCode}*` : "",
      b.refund ? `${t.refund}: ${b.refund}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  },

  openBookingPrompt: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Pick a booking to see its details, pay or cancel.",
        hi: "विवरण देखने, भुगतान या रद्द करने के लिए बुकिंग चुनें।",
        hinglish: "Details dekhne, pay ya cancel karne ke liye booking chunein.",
      },
      language,
    ),

  bookingActionsPrompt: (language: ReplyLanguage): string =>
    pick(
      {
        en: "What would you like to do?",
        hi: "आप क्या करना चाहेंगे?",
        hinglish: "Aap kya karna chahenge?",
      },
      language,
    ),

  payNowButton: (language: ReplyLanguage): string =>
    pick({ en: "Pay now", hi: "अभी भुगतान", hinglish: "Pay now" }, language),
  cancelBookingButton: (language: ReplyLanguage): string =>
    pick({ en: "Cancel booking", hi: "बुकिंग रद्द", hinglish: "Cancel booking" }, language),

  refundStatus: (
    language: ReplyLanguage,
    items: {
      reference: string;
      decided: number | null;
      cancellationRefund: { amount: number; status: string } | null;
      request: { refundNumber: string; status: string; amount: number } | null;
    }[],
  ): string => {
    if (!items.length)
      return pick(
        {
          en: "You have no cancelled bookings with a refund on record.",
          hi: "आपकी कोई रद्द बुकिंग नहीं है जिसमें रिफ़ंड दर्ज हो।",
          hinglish: "Aapki koi cancelled booking nahi hai jisme refund darj ho.",
        },
        language,
      );
    const head = pick(
      { en: "*Refund status*", hi: "*रिफ़ंड की स्थिति*", hinglish: "*Refund status*" },
      language,
    );
    const lines = items.map((i) => {
      const parts = [`*${i.reference}*`];
      if (i.decided !== null) parts.push(`${money(i.decided)}`);
      if (i.cancellationRefund)
        parts.push(`${i.cancellationRefund.status}`);
      else if (i.decided === 0)
        parts.push(
          pick(
            { en: "no refund applies", hi: "कोई रिफ़ंड लागू नहीं", hinglish: "koi refund lagu nahi" },
            language,
          ),
        );
      if (i.request)
        parts.push(`${i.request.refundNumber}: ${i.request.status}`);
      return parts.join(" · ");
    });
    return [head, ...lines].join("\n");
  },
  // ---- paging, stale state and domain refusals ----------------------------

  /** The row that fetches the next page of a list from the database. */
  nextPageRow: (language: ReplyLanguage, page: number, totalPages: number) => ({
    title: pick({ en: "Next ▶", hi: "आगे ▶", hinglish: "Aage ▶" }, language),
    description: pick(
      {
        en: `Page ${page + 1} of ${totalPages}`,
        hi: `पेज ${page + 1} / ${totalPages}`,
        hinglish: `Page ${page + 1} / ${totalPages}`,
      },
      language,
    ),
  }),

  prevPageRow: (language: ReplyLanguage, page: number, totalPages: number) => ({
    title: pick({ en: "◀ Previous", hi: "◀ पीछे", hinglish: "◀ Peeche" }, language),
    description: pick(
      {
        en: `Page ${page - 1} of ${totalPages}`,
        hi: `पेज ${page - 1} / ${totalPages}`,
        hinglish: `Page ${page - 1} / ${totalPages}`,
      },
      language,
    ),
  }),

  noMorePages: (language: ReplyLanguage): string =>
    pick(
      {
        en: "There's nothing further in that list. Tell me a place, a date or what you're looking for and I'll search again.",
        hi: "उस सूची में और कुछ नहीं है। कोई जगह, तारीख या ज़रूरत बताइए, मैं फिर से खोज दूँगा।",
        hinglish: "Us list mein aur kuch nahi hai. Koi jagah, date ya zaroorat batayein, main phir se search kar dunga.",
      },
      language,
    ),

  /** The price moved between the summary and "confirm"; nothing was booked. */
  priceChanged: (
    language: ReplyLanguage,
    input: { before: number; after: number },
  ): string =>
    pick(
      {
        en: `The price for this stay has just changed from ${money(input.before)} to *${money(input.after)}* — nothing has been booked. Here is the updated summary; confirm again if you'd like to go ahead.`,
        hi: `इस ठहराव की कीमत अभी ${money(input.before)} से बदलकर *${money(input.after)}* हो गई है — अभी कुछ बुक नहीं हुआ है। नया सारांश नीचे है; आगे बढ़ना हो तो फिर से पुष्टि करें।`,
        hinglish: `Is stay ka price abhi ${money(input.before)} se badal kar *${money(input.after)}* ho gaya hai — abhi kuch book nahi hua. Naya summary neeche hai; aage badhna ho to dobara confirm karein.`,
      },
      language,
    ),

  /** A "confirm" arrived for a booking step that is no longer in progress. */
  bookingStepExpired: (language: ReplyLanguage): string =>
    pick(
      {
        en: "That booking step is no longer open — nothing new was booked. Send “my bookings” to see your bookings, or tell me where you'd like to stay.",
        hi: "वह बुकिंग चरण अब खुला नहीं है — कोई नई बुकिंग नहीं हुई। अपनी बुकिंग देखने के लिए “मेरी बुकिंग” भेजें, या बताइए कहाँ ठहरना है।",
        hinglish: "Wo booking step ab open nahi hai — koi nayi booking nahi hui. Apni bookings dekhne ke liye “meri booking” bhejein, ya batayein kahan rukna hai.",
      },
      language,
    ),

  /** The rooms went between the summary and the hold; offered again from live data. */
  roomsGoneAtBooking: (language: ReplyLanguage, reason: string): string =>
    pick(
      {
        en: `I couldn't hold those rooms: ${reason} Nothing was booked or charged. Here is what is open right now:`,
        hi: `ये कमरे होल्ड नहीं हो पाए: ${reason} कुछ बुक या चार्ज नहीं हुआ। अभी जो उपलब्ध है वह यह है:`,
        hinglish: `Ye rooms hold nahi ho paaye: ${reason} Kuch book ya charge nahi hua. Abhi jo available hai wo ye hai:`,
      },
      language,
    ),

  /** A booking action the domain refused, with the service's own reason. */
  actionRefused: (language: ReplyLanguage, reason: string): string =>
    pick(
      {
        en: `That couldn't be done: ${reason}`,
        hi: `यह नहीं हो सका: ${reason}`,
        hinglish: `Ye nahi ho paaya: ${reason}`,
      },
      language,
    ),
};
