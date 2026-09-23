import type { ReplyLanguage } from "./language";
import { formatDateTime } from "./stay-slots";
import type { RequiredParkingSlot } from "./parking-slots";

/**
 * Replies for the parking-booking flow. Every figure here is passed in from
 * `ParkingPricingService`/`ParkingDiscoveryService` — nothing is computed in
 * this file. Generic pieces the stay flow already phrases well (confirm/
 * change/cancel buttons, "pick a booking" prompts, pagination rows, a price
 * that changed, a booking step that is no longer open, a domain refusal) are
 * reused from `stayCopy` rather than restated here.
 */

type Phrase = Record<ReplyLanguage, string>;

const pick = (phrase: Phrase, language: ReplyLanguage): string =>
  phrase[language] ?? phrase.hinglish;

const money = (amount: number): string =>
  `₹${Number(amount ?? 0).toLocaleString("en-IN")}`;

const VEHICLE_LABEL: Record<string, string> = {
  bike: "Bike",
  scooter: "Scooter",
  car: "Car",
  suv: "SUV",
  luxury_car: "Luxury Car",
  tempo: "Tempo",
  mini_bus: "Mini Bus",
  bus: "Bus",
  ev: "EV",
};

export const vehicleLabel = (code: string): string => VEHICLE_LABEL[code] ?? code;

export const parkingCopy = {
  askLocation: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Where would you like to park — which city or place?",
        hi: "आप कहाँ पार्किंग करना चाहेंगे — कौन सा शहर या जगह?",
        hinglish: "Aap kahan parking karna chahenge — kaunsa city ya jagah?",
      },
      language,
    ),

  askEntryDate: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Which date will you enter? e.g. \"tomorrow\" or \"25 Sep\"",
        hi: "किस तारीख को प्रवेश करेंगे? जैसे \"कल\" या \"25 सितंबर\"",
        hinglish: "Kis date ko entry karenge? Jaise \"kal\" ya \"25 Sep\"",
      },
      language,
    ),

  askEntryTime: (language: ReplyLanguage): string =>
    pick(
      {
        en: "What time will you enter? e.g. \"4 PM\"",
        hi: "किस समय प्रवेश करेंगे? जैसे \"शाम 4 बजे\"",
        hinglish: "Kis time entry karenge? Jaise \"shaam 4 baje\"",
      },
      language,
    ),

  askExitDate: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Which date will you leave?",
        hi: "किस तारीख को निकलेंगे?",
        hinglish: "Kis date ko nikalenge?",
      },
      language,
    ),

  askExitTime: (language: ReplyLanguage): string =>
    pick(
      {
        en: "What time will you leave? e.g. \"11 AM\"",
        hi: "किस समय निकलेंगे? जैसे \"सुबह 11 बजे\"",
        hinglish: "Kis time niklenge? Jaise \"subah 11 baje\"",
      },
      language,
    ),

  askVehicleType: (language: ReplyLanguage): string =>
    pick(
      {
        en: "What kind of vehicle — car, bike, SUV...?",
        hi: "किस तरह का वाहन है — कार, बाइक, SUV...?",
        hinglish: "Kis tarah ka vehicle hai — car, bike, SUV...?",
      },
      language,
    ),

  askVehicleNumber: (language: ReplyLanguage): string =>
    pick(
      {
        en: "What's the vehicle number? e.g. \"UP32AB1234\"",
        hi: "वाहन नंबर क्या है? जैसे \"UP32AB1234\"",
        hinglish: "Vehicle number kya hai? Jaise \"UP32AB1234\"",
      },
      language,
    ),

  clarifySlot: (language: ReplyLanguage, slot: RequiredParkingSlot): string => {
    const examples: Record<RequiredParkingSlot, Phrase> = {
      location: {
        en: "Sorry, I didn't catch the place — which city? e.g. \"Vrindavan\"",
        hi: "माफ़ कीजिए, जगह समझ नहीं आई — कौन सा शहर? जैसे \"वृंदावन\"",
        hinglish: "Sorry, jagah samajh nahi aayi — kaunsa shehar? Jaise \"Vrindavan\"",
      },
      entryDate: {
        en: "Sorry, which date will you enter? e.g. \"tomorrow\"",
        hi: "माफ़ कीजिए, किस तारीख को प्रवेश करेंगे? जैसे \"कल\"",
        hinglish: "Sorry, kis date entry karenge? Jaise \"kal\"",
      },
      entryTime: {
        en: "Sorry, what time will you enter? e.g. \"4 PM\"",
        hi: "माफ़ कीजिए, किस समय प्रवेश करेंगे? जैसे \"शाम 4 बजे\"",
        hinglish: "Sorry, kis time entry karenge? Jaise \"shaam 4 baje\"",
      },
      exitDate: {
        en: "Sorry, which date will you leave?",
        hi: "माफ़ कीजिए, किस तारीख को निकलेंगे?",
        hinglish: "Sorry, kis date niklenge?",
      },
      exitTime: {
        en: "Sorry, what time will you leave? e.g. \"11 AM\"",
        hi: "माफ़ कीजिए, किस समय निकलेंगे? जैसे \"सुबह 11 बजे\"",
        hinglish: "Sorry, kis time niklenge? Jaise \"subah 11 baje\"",
      },
      vehicleType: {
        en: "Sorry, what kind of vehicle — car, bike, SUV...?",
        hi: "माफ़ कीजिए, किस तरह का वाहन है — कार, बाइक, SUV...?",
        hinglish: "Sorry, kis tarah ka vehicle hai — car, bike, SUV...?",
      },
    };
    return pick(examples[slot], language);
  },

  noParkingFound: (language: ReplyLanguage, place: string): string =>
    pick(
      {
        en: place
          ? `I couldn't find any Tirvona parking near "${place}". Try another place?`
          : "I couldn't find any Tirvona parking for that. Try another place?",
        hi: place
          ? `"${place}" के पास कोई Tirvona पार्किंग नहीं मिली। कोई और जगह बताएं?`
          : "इसके लिए कोई Tirvona पार्किंग नहीं मिली। कोई और जगह बताएं?",
        hinglish: place
          ? `"${place}" ke paas koi Tirvona parking nahi mili. Koi aur jagah batayein?`
          : "Iske liye koi Tirvona parking nahi mili. Koi aur jagah batayein?",
      },
      language,
    ),

  pickLocation: (language: ReplyLanguage): string =>
    pick(
      { en: "Pick a parking location:", hi: "एक पार्किंग जगह चुनें:", hinglish: "Ek parking location chunein:" },
      language,
    ),

  locationRowDescription: (
    language: ReplyLanguage,
    l: { city?: string; availableCount?: number },
  ): string =>
    [
      l.city,
      l.availableCount !== undefined
        ? pick(
            {
              en: `${l.availableCount} bay${l.availableCount === 1 ? "" : "s"} open`,
              hi: `${l.availableCount} बे उपलब्ध`,
              hinglish: `${l.availableCount} bay open`,
            },
            language,
          )
        : "",
    ]
      .filter(Boolean)
      .join(" · "),

  noBaysForWindow: (language: ReplyLanguage): string =>
    pick(
      {
        en: "No bay is open for that vehicle in that window. Try different times or another location — just tell me.",
        hi: "उस समय और वाहन के लिए कोई बे उपलब्ध नहीं है। दूसरा समय या जगह बताएं।",
        hinglish: "Us time aur vehicle ke liye koi bay available nahi hai. Doosra time ya jagah batayein.",
      },
      language,
    ),

  pickBay: (language: ReplyLanguage): string =>
    pick(
      { en: "Pick a bay category:", hi: "एक बे कैटेगरी चुनें:", hinglish: "Ek bay category chunein:" },
      language,
    ),

  bayRowDescription: (
    language: ReplyLanguage,
    b: { isCovered?: boolean; totalAmount?: number; availableCount?: number },
  ): string =>
    [
      b.isCovered
        ? pick({ en: "Covered", hi: "ढका हुआ", hinglish: "Covered" }, language)
        : "",
      b.totalAmount ? money(b.totalAmount) : "",
      b.availableCount !== undefined
        ? pick(
            { en: `${b.availableCount} left`, hi: `${b.availableCount} बचे`, hinglish: `${b.availableCount} bacche` },
            language,
          )
        : "",
    ]
      .filter(Boolean)
      .join(" · "),

  summary: (
    language: ReplyLanguage,
    s: {
      location: string;
      city?: string;
      bay: string;
      entryDate: string;
      entryTime: string;
      exitDate: string;
      exitTime: string;
      vehicleType: string;
      vehicleNumber: string;
      pricing: {
        baseFee: number;
        durationAmount: number;
        subtotal: number;
        taxAmount: number;
        totalAmount: number;
      };
    },
  ): string => {
    const lines = [
      pick(
        { en: "*Parking summary*", hi: "*पार्किंग सारांश*", hinglish: "*Parking summary*" },
        language,
      ),
      `${s.location}${s.city ? `, ${s.city}` : ""} — ${s.bay}`,
      pick(
        {
          en: `Entry: ${formatDateTime(s.entryDate, s.entryTime)}`,
          hi: `प्रवेश: ${formatDateTime(s.entryDate, s.entryTime)}`,
          hinglish: `Entry: ${formatDateTime(s.entryDate, s.entryTime)}`,
        },
        language,
      ),
      pick(
        {
          en: `Exit: ${formatDateTime(s.exitDate, s.exitTime)}`,
          hi: `निकास: ${formatDateTime(s.exitDate, s.exitTime)}`,
          hinglish: `Exit: ${formatDateTime(s.exitDate, s.exitTime)}`,
        },
        language,
      ),
      `${vehicleLabel(s.vehicleType)} — ${s.vehicleNumber}`,
      "",
      pick(
        { en: `Fee: ${money(s.pricing.subtotal)}`, hi: `शुल्क: ${money(s.pricing.subtotal)}`, hinglish: `Fee: ${money(s.pricing.subtotal)}` },
        language,
      ),
      s.pricing.taxAmount
        ? pick(
            { en: `Tax: ${money(s.pricing.taxAmount)}`, hi: `कर: ${money(s.pricing.taxAmount)}`, hinglish: `Tax: ${money(s.pricing.taxAmount)}` },
            language,
          )
        : "",
      pick(
        {
          en: `*Total: ${money(s.pricing.totalAmount)}*`,
          hi: `*कुल: ${money(s.pricing.totalAmount)}*`,
          hinglish: `*Total: ${money(s.pricing.totalAmount)}*`,
        },
        language,
      ),
    ];
    return lines.filter(Boolean).join("\n");
  },

  summaryPrompt: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Shall I hold this bay?",
        hi: "क्या मैं यह बे होल्ड कर दूँ?",
        hinglish: "Kya main ye bay hold kar doon?",
      },
      language,
    ),

  bookingDetail: (
    language: ReplyLanguage,
    b: {
      reference: string;
      location: string;
      bay?: string;
      vehicleNumber: string;
      entryAt: string;
      exitAt: string;
      status: string;
      paymentStatus: string;
      total: number;
      displayCode?: string;
    },
  ): string => {
    const lines = [
      `*${b.reference}*`,
      [b.location, b.bay].filter(Boolean).join(" · "),
      b.vehicleNumber,
      `${new Date(b.entryAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} → ${new Date(b.exitAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`,
      `${b.status} · ${b.paymentStatus}`,
      money(b.total),
      b.displayCode
        ? pick(
            { en: `Gate code: *${b.displayCode}*`, hi: `गेट कोड: *${b.displayCode}*`, hinglish: `Gate code: *${b.displayCode}*` },
            language,
          )
        : "",
    ];
    return lines.filter(Boolean).join("\n");
  },
};
