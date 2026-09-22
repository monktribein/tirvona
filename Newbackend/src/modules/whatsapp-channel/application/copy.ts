import type { ReplyLanguage } from "./language";
import { formatDateTime } from "./stay-slots";
import type { RequiredStaySlot } from "./stay-slots";

/**
 * Every line the conversation engine can say, in the three styles a guest
 * might write in.
 *
 * Copy lives here rather than inline so a reply can never accidentally ship
 * in one language only, and so the whole voice of the bot can be read in one
 * place. Each entry is a function of the values it needs, so a translation
 * can put them in a different order.
 *
 * These are conversational replies sent inside Meta's 24-hour customer
 * service window. They are not transactional notifications: booking
 * confirmations, cancellations and refund updates are sent by the existing
 * outbox pipeline and must never be duplicated here.
 */

type Phrase = Record<ReplyLanguage, string>;

const pick = (phrase: Phrase, language: ReplyLanguage): string =>
  phrase[language] ?? phrase.hinglish;

const money = (amount: number): string =>
  `₹${Number(amount ?? 0).toLocaleString("en-IN")}`;

const date = (value: Date | string): string =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

export const copy = {
  greeting: (language: ReplyLanguage, name?: string): string => {
    const who = name ? ` ${name}` : "";
    return pick(
      {
        en: `Namaste${who} 🙏\n\nWelcome to Tirvona. How can I help you today?`,
        hi: `नमस्ते${who} 🙏\n\nतिरवोना में आपका स्वागत है। मैं आपकी क्या मदद कर सकता हूँ?`,
        hinglish: `Namaste${who} 🙏\n\nTirvona mein aapka swagat hai. Main aapki kaise help kar sakta hoon?`,
      },
      language,
    );
  },

  menuTitle: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Choose a service",
        hi: "सेवा चुनें",
        hinglish: "Service chunein",
      },
      language,
    ),

  menuButton: (language: ReplyLanguage): string =>
    pick(
      { en: "View options", hi: "विकल्प देखें", hinglish: "Options dekhein" },
      language,
    ),

  menuItems: (
    language: ReplyLanguage,
  ): { id: string; title: string; description: string }[] => {
    const rows: Record<
      ReplyLanguage,
      { id: string; title: string; description: string }[]
    > = {
      en: [
        { id: "menu:stay", title: "🏠 Book a stay", description: "Ashram, dharamshala and homestay rooms" },
        { id: "menu:parking", title: "🅿️ Parking", description: "Reserve a parking slot" },
        { id: "menu:aarti", title: "🪔 Aarti", description: "Book an aarti pass" },
        { id: "menu:event", title: "🎫 Events", description: "Register for an event" },
        { id: "menu:prashad", title: "🙏 Prashad", description: "Browse prashad offerings" },
        { id: "menu:marketplace", title: "🛍️ Marketplace", description: "Shop on Tirvona" },
        { id: "menu:bookings", title: "📋 My bookings", description: "View, pay for or cancel a booking" },
        { id: "menu:help", title: "❓ Help", description: "Get support" },
      ],
      hi: [
        { id: "menu:stay", title: "🏠 कमरा बुक करें", description: "आश्रम, धर्मशाला और होमस्टे" },
        { id: "menu:parking", title: "🅿️ पार्किंग", description: "पार्किंग स्लॉट बुक करें" },
        { id: "menu:aarti", title: "🪔 आरती", description: "आरती पास बुक करें" },
        { id: "menu:event", title: "🎫 इवेंट्स", description: "इवेंट के लिए रजिस्टर करें" },
        { id: "menu:prashad", title: "🙏 प्रसाद", description: "प्रसाद देखें" },
        { id: "menu:marketplace", title: "🛍️ मार्केटप्लेस", description: "तिरवोना पर खरीदें" },
        { id: "menu:bookings", title: "📋 मेरी बुकिंग", description: "बुकिंग देखें, भुगतान या रद्द करें" },
        { id: "menu:help", title: "❓ सहायता", description: "मदद पाएं" },
      ],
      hinglish: [
        { id: "menu:stay", title: "🏠 Stay book karein", description: "Ashram, dharamshala aur homestay" },
        { id: "menu:parking", title: "🅿️ Parking", description: "Parking slot book karein" },
        { id: "menu:aarti", title: "🪔 Aarti", description: "Aarti pass book karein" },
        { id: "menu:event", title: "🎫 Events", description: "Event ke liye register karein" },
        { id: "menu:prashad", title: "🙏 Prashad", description: "Prashad dekhein" },
        { id: "menu:marketplace", title: "🛍️ Marketplace", description: "Tirvona par shopping" },
        { id: "menu:bookings", title: "📋 Meri bookings", description: "Booking dekhein, pay ya cancel karein" },
        { id: "menu:help", title: "❓ Help", description: "Support lein" },
      ],
    };
    return rows[language] ?? rows.hinglish;
  },

  wappIdIntro: (language: ReplyLanguage, wappId: string): string =>
    pick(
      {
        en: `Your Tirvona WhatsApp customer ID is *${wappId}*. Keep it handy — support can find all your bookings with it.`,
        hi: `आपकी तिरवोना व्हाट्सएप कस्टमर आईडी *${wappId}* है। इसे संभाल कर रखें — सपोर्ट इससे आपकी सभी बुकिंग देख सकता है।`,
        hinglish: `Aapki Tirvona WhatsApp customer ID *${wappId}* hai. Ise save rakhein — support isse aapki saari bookings dekh sakta hai.`,
      },
      language,
    ),

  askLocation: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Which place are you looking for a stay near? 🏠",
        hi: "आप किस जगह के पास कमरा ढूंढ रहे हैं? 🏠",
        hinglish: "Aap kis jagah ke paas room dhoond rahe hain? 🏠",
      },
      language,
    ),

  askCheckIn: (language: ReplyLanguage): string =>
    pick(
      {
        en: "When would you like to check in? You can say a date, or just “tomorrow”. 📅",
        hi: "आप कब चेक-इन करना चाहेंगे? तारीख बताएं या बस “कल” लिख दें। 📅",
        hinglish: "Aap kab check-in karna chahenge? Date bataiye ya bas “kal” likh dein. 📅",
      },
      language,
    ),

  askCheckOut: (language: ReplyLanguage): string =>
    pick(
      {
        en: "And when will you check out? 📅",
        hi: "और चेक-आउट कब होगा? 📅",
        hinglish: "Aur aapka checkout kab hoga? 📅",
      },
      language,
    ),

  askGuests: (language: ReplyLanguage): string =>
    pick(
      {
        en: "How many guests will be staying? 👥",
        hi: "कितने लोग रुकेंगे? 👥",
        hinglish: "Kitne guests ke liye room chahiye? 👥",
      },
      language,
    ),

  askCheckInTime: (language: ReplyLanguage): string =>
    pick(
      {
        en: "What time will you check in?",
        hi: "आप किस समय चेक-इन करेंगे?",
        hinglish: "Aap kis time check-in karenge?",
      },
      language,
    ),

  askCheckOutTime: (language: ReplyLanguage): string =>
    pick(
      {
        en: "And what time will you check out?",
        hi: "और चेक-आउट किस समय होगा?",
        hinglish: "Aur checkout kis time hoga?",
      },
      language,
    ),

  /**
   * Sent instead of the plain question when the same slot was just asked and
   * the last reply added nothing new — the loop-protection item 11 asks for.
   * Explicit examples rather than the bare question again, so a guest whose
   * phrasing the parser missed has a concrete pattern to copy.
   */
  clarifySlot: (language: ReplyLanguage, slot: RequiredStaySlot): string => {
    const examples: Record<RequiredStaySlot, Phrase> = {
      location: {
        en: "Sorry, I didn't catch the place — which city or ashram? e.g. \"Vrindavan\"",
        hi: "माफ़ कीजिए, जगह समझ नहीं आई — कौन सा शहर या आश्रम? जैसे \"वृंदावन\"",
        hinglish: "Sorry, jagah samajh nahi aayi — kaunsa shehar ya ashram? Jaise \"Vrindavan\"",
      },
      checkInDate: {
        en: "Sorry, which date will you check in? e.g. \"tomorrow\" or \"25 Sep\"",
        hi: "माफ़ कीजिए, चेक-इन किस तारीख को होगा? जैसे \"कल\" या \"25 सितंबर\"",
        hinglish: "Sorry, check-in kis date ko hoga? Jaise \"kal\" ya \"25 Sep\"",
      },
      checkOutDate: {
        en: "Sorry, which date will you check out? e.g. \"day after tomorrow\"",
        hi: "माफ़ कीजिए, चेक-आउट किस तारीख को होगा? जैसे \"परसों\"",
        hinglish: "Sorry, checkout kis date ko hoga? Jaise \"parso\"",
      },
      guests: {
        en: "Sorry, how many guests? e.g. \"2\"",
        hi: "माफ़ कीजिए, कितने मेहमान हैं? जैसे \"2\"",
        hinglish: "Sorry, kitne guests hain? Jaise \"2\"",
      },
    };
    return pick(examples[slot], language);
  },

  askName: (language: ReplyLanguage): string =>
    pick(
      {
        en: "What name should the booking be in? 🙏",
        hi: "बुकिंग किस नाम से करें? 🙏",
        hinglish: "Booking kis naam se karein? 🙏",
      },
      language,
    ),

  searching: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Let me check what's available… 🔎",
        hi: "मैं उपलब्धता देख रहा हूँ… 🔎",
        hinglish: "Main availability check kar raha hoon… 🔎",
      },
      language,
    ),

  noStaysFound: (language: ReplyLanguage, place: string): string =>
    pick(
      {
        en: `I couldn't find an available stay near ${place} for those dates. Would you like to try different dates or another place?`,
        hi: `उन तारीखों में ${place} के पास कोई कमरा उपलब्ध नहीं मिला। क्या आप दूसरी तारीख या जगह देखना चाहेंगे?`,
        hinglish: `Un dates mein ${place} ke paas koi room available nahi mila. Kya aap dusri dates ya jagah try karna chahenge?`,
      },
      language,
    ),

  pickStay: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Here's what's available. Tap one to see the price.",
        hi: "ये उपलब्ध हैं। कीमत देखने के लिए किसी एक को चुनें।",
        hinglish: "Ye available hain. Price dekhne ke liye koi ek chunein.",
      },
      language,
    ),

  /**
   * Heads a browse result list (item 9's DISCOVER step) — shown with no
   * date filter, so it never claims a specific date's availability the way
   * the dated-search list does.
   */
  discoveryResults: (language: ReplyLanguage, location?: string): string => {
    const where = location ? { en: ` near ${location}`, hi: ` ${location} के पास`, hinglish: ` ${location} ke paas` } : { en: "", hi: "", hinglish: "" };
    return pick(
      {
        en: `Here are the stays${where.en}:`,
        hi: `ये स्टेज़${where.hi} उपलब्ध हैं:`,
        hinglish: `Ye stays${where.hinglish} hain:`,
      },
      language,
    );
  },

  /** When "isme booking karni hai" can't be resolved to one specific result. */
  pickFromListAgain: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Please tap one from the list above so I know exactly which one you mean.",
        hi: "कृपया ऊपर दी गई लिस्ट में से एक चुनें ताकि मुझे पता चले आप कौन सा कह रहे हैं।",
        hinglish: "Please upar list mein se ek tap kar dijiye, taaki pata chale aap kaunsa keh rahe hain.",
      },
      language,
    ),

  /**
   * Real open dates from `AshramsService.publicCalendar` — never a guess.
   * `dates` are already the ones the domain service reported as open.
   */
  availabilitySummary: (language: ReplyLanguage, dates: string[]): string => {
    if (!dates.length)
      return pick(
        {
          en: "I couldn't find any open dates in the next month for this room. You could try another room or property.",
          hi: "अगले महीने में इस कमरे के लिए कोई उपलब्ध तारीख नहीं मिली। आप कोई और कमरा या property आज़मा सकते हैं।",
          hinglish: "Agle mahine mein is room ke liye koi available date nahi mili. Aap koi aur room ya property try kar sakte hain.",
        },
        language,
      );
    const formatted = dates
      .map((iso) => date(iso))
      .join(language === "hi" ? ", " : ", ");
    return pick(
      {
        en: `These dates are available: ${formatted}.`,
        hi: `ये तारीखें उपलब्ध हैं: ${formatted}।`,
        hinglish: `Ye dates available hain: ${formatted}.`,
      },
      language,
    );
  },

  /**
   * Item 16: explain what was actually searched rather than a bare "try
   * different dates?" with no context.
   */
  noAvailabilityDetailed: (
    language: ReplyLanguage,
    input: { location: string; checkInDate: string; checkOutDate: string },
  ): string => {
    const range = `${date(input.checkInDate)} – ${date(input.checkOutDate)}`;
    return pick(
      {
        en: `No availability found in ${input.location} for ${range}. You can try nearby dates or another location.`,
        hi: `${input.location} में ${range} के लिए कोई उपलब्धता नहीं मिली। आप आस-पास की तारीख या दूसरी जगह आज़मा सकते हैं।`,
        hinglish: `${input.location} mein ${range} ke liye availability nahi mili. Aap nearby dates ya doosri location try kar sakte hain.`,
      },
      language,
    );
  },

  pickRoom: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Which room would you like?",
        hi: "आप कौन सा कमरा लेना चाहेंगे?",
        hinglish: "Aap kaunsa room lena chahenge?",
      },
      language,
    ),

  quoteSummary: (
    language: ReplyLanguage,
    input: {
      property: string;
      room: string;
      checkInDate: string;
      checkInTime?: string;
      checkOutDate: string;
      checkOutTime?: string;
      nights: number;
      guests: number;
      total: number;
    },
  ): string => {
    const head = pick(
      { en: "*Booking summary*", hi: "*बुकिंग विवरण*", hinglish: "*Booking summary*" },
      language,
    );
    const labels: Record<ReplyLanguage, string[]> = {
      en: ["Stay", "Room", "Check-in", "Check-out", "Nights", "Guests", "Total"],
      hi: ["ठहराव", "कमरा", "चेक-इन", "चेक-आउट", "रातें", "मेहमान", "कुल"],
      hinglish: ["Stay", "Room", "Check-in", "Check-out", "Nights", "Guests", "Total"],
    };
    const l = labels[language] ?? labels.hinglish;
    const checkIn = input.checkInTime
      ? formatDateTime(input.checkInDate, input.checkInTime)
      : date(input.checkInDate);
    const checkOut = input.checkOutTime
      ? formatDateTime(input.checkOutDate, input.checkOutTime)
      : date(input.checkOutDate);
    return [
      head,
      `${l[0]}: ${input.property}`,
      `${l[1]}: ${input.room}`,
      `${l[2]}: ${checkIn}`,
      `${l[3]}: ${checkOut}`,
      `${l[4]}: ${input.nights}`,
      `${l[5]}: ${input.guests}`,
      `${l[6]}: *${money(input.total)}*`,
    ].join("\n");
  },

  confirmBooking: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Shall I hold this for you?",
        hi: "क्या मैं इसे आपके लिए होल्ड कर दूँ?",
        hinglish: "Kya main ise aapke liye hold kar doon?",
      },
      language,
    ),

  yes: (language: ReplyLanguage): string =>
    pick({ en: "Yes", hi: "हाँ", hinglish: "Haan" }, language),

  no: (language: ReplyLanguage): string =>
    pick({ en: "No", hi: "नहीं", hinglish: "Nahi" }, language),

  paymentLink: (
    language: ReplyLanguage,
    input: { reference: string; amount: number; url: string; minutes: number },
  ): string =>
    pick(
      {
        en: `Reserved 🙏\n\nBooking *${input.reference}*\nAmount: *${money(input.amount)}*\n\nPay here to confirm:\n${input.url}\n\nThis hold expires in about ${input.minutes} minutes. I'll confirm as soon as the payment is verified.`,
        hi: `रिज़र्व हो गया 🙏\n\nबुकिंग *${input.reference}*\nराशि: *${money(input.amount)}*\n\nकन्फर्म करने के लिए यहाँ भुगतान करें:\n${input.url}\n\nयह होल्ड लगभग ${input.minutes} मिनट में खत्म हो जाएगा। भुगतान वेरिफाई होते ही मैं कन्फर्म कर दूँगा।`,
        hinglish: `Reserve ho gaya 🙏\n\nBooking *${input.reference}*\nAmount: *${money(input.amount)}*\n\nConfirm karne ke liye yahan pay karein:\n${input.url}\n\nYe hold lagbhag ${input.minutes} minute mein expire ho jayega. Payment verify hote hi main confirm kar dunga.`,
      },
      language,
    ),

  paymentNotConfirmed: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Payment isn't confirmed yet. I only update a booking once the payment is verified by the bank — I'll message you the moment it is. 🙏",
        hi: "भुगतान अभी कन्फर्म नहीं हुआ है। मैं बुकिंग तभी अपडेट करता हूँ जब बैंक से भुगतान वेरिफाई हो जाए — होते ही मैं आपको बता दूँगा। 🙏",
        hinglish: "Payment abhi confirm nahi hua hai. Main booking tabhi update karta hoon jab bank se payment verify ho jaye — hote hi main aapko bata dunga. 🙏",
      },
      language,
    ),

  noBookings: (language: ReplyLanguage): string =>
    pick(
      {
        en: "You don't have any bookings with us yet. Shall I help you make one?",
        hi: "अभी आपकी कोई बुकिंग नहीं है। क्या मैं एक बुकिंग करने में मदद करूँ?",
        hinglish: "Abhi aapki koi booking nahi hai. Kya main ek booking karne mein help karoon?",
      },
      language,
    ),

  bookingsHeader: (language: ReplyLanguage): string =>
    pick(
      {
        en: "*Your bookings*",
        hi: "*आपकी बुकिंग*",
        hinglish: "*Aapki bookings*",
      },
      language,
    ),

  cancelWhich: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Which booking would you like to cancel?",
        hi: "आप कौन सी बुकिंग रद्द करना चाहते हैं?",
        hinglish: "Aap kaunsi booking cancel karna chahte hain?",
      },
      language,
    ),

  cancelConfirm: (
    language: ReplyLanguage,
    input: { reference: string; refund: number },
  ): string =>
    pick(
      {
        en: `Cancelling *${input.reference}*.\n\nRefund due under the applicable policy: *${money(input.refund)}*.\n\nThis cannot be undone. Shall I go ahead?`,
        hi: `*${input.reference}* रद्द की जा रही है।\n\nलागू नीति के अनुसार वापसी: *${money(input.refund)}*।\n\nयह वापस नहीं लिया जा सकता। क्या मैं आगे बढ़ूँ?`,
        hinglish: `*${input.reference}* cancel ki ja rahi hai.\n\nApplicable policy ke hisaab se refund: *${money(input.refund)}*.\n\nYe wapas nahi liya ja sakta. Kya main aage badhoon?`,
      },
      language,
    ),

  cancelled: (
    language: ReplyLanguage,
    input: { reference: string; refund: number },
  ): string =>
    pick(
      {
        en: `*${input.reference}* is cancelled.${input.refund > 0 ? ` A refund of ${money(input.refund)} has been raised and you'll see it in your account per the usual bank timelines.` : ""}`,
        hi: `*${input.reference}* रद्द कर दी गई है।${input.refund > 0 ? ` ${money(input.refund)} की वापसी दर्ज कर दी गई है, जो सामान्य बैंक समय के अनुसार आपके खाते में आ जाएगी।` : ""}`,
        hinglish: `*${input.reference}* cancel ho gayi hai.${input.refund > 0 ? ` ${money(input.refund)} ka refund raise kar diya gaya hai, jo normal bank timeline ke hisaab se aapke account mein aa jayega.` : ""}`,
      },
      language,
    ),

  cancelAborted: (language: ReplyLanguage): string =>
    pick(
      {
        en: "No problem — I've left the booking as it is. 🙏",
        hi: "कोई बात नहीं — बुकिंग जैसी थी वैसी ही है। 🙏",
        hinglish: "Koi baat nahi — booking jaisi thi waisi hi hai. 🙏",
      },
      language,
    ),

  notYourBooking: (language: ReplyLanguage): string =>
    pick(
      {
        en: "I couldn't find that booking under your number. Send “my bookings” to see the ones I can help with.",
        hi: "आपके नंबर पर वह बुकिंग नहीं मिली। जिन बुकिंग में मैं मदद कर सकता हूँ उनके लिए “मेरी बुकिंग” भेजें।",
        hinglish: "Aapke number par wo booking nahi mili. Jin bookings mein main help kar sakta hoon unke liye “meri booking” bhejein.",
      },
      language,
    ),

  soldOut: (language: ReplyLanguage): string =>
    pick(
      {
        en: "That room was just taken for those dates. Shall I look for something else?",
        hi: "वह कमरा अभी-अभी उन तारीखों के लिए बुक हो गया। क्या मैं कुछ और देखूँ?",
        hinglish: "Wo room abhi-abhi un dates ke liye book ho gaya. Kya main kuch aur dekhoon?",
      },
      language,
    ),

  holdExpired: (language: ReplyLanguage): string =>
    pick(
      {
        en: "That reservation has expired. Let me check availability again for you. 🙏",
        hi: "यह रिज़र्वेशन खत्म हो चुका है। मैं आपके लिए दोबारा उपलब्धता देखता हूँ। 🙏",
        hinglish: "Ye reservation expire ho chuki hai. Main aapke liye nayi availability check kar deta hoon. 🙏",
      },
      language,
    ),

  availabilityUnavailable: (language: ReplyLanguage): string =>
    pick(
      {
        en: "I'm having trouble checking availability right now. Please try again in a little while. 🙏",
        hi: "अभी उपलब्धता जाँचने में दिक्कत आ रही है। कृपया थोड़ी देर बाद दोबारा कोशिश करें। 🙏",
        hinglish: "Abhi availability check karne mein problem aa rahi hai. Thodi der baad dobara try karein. 🙏",
      },
      language,
    ),

  genericError: (language: ReplyLanguage): string =>
    pick(
      {
        en: "Something went wrong at my end — nothing was charged or changed. Please try again in a moment. 🙏",
        hi: "मेरी तरफ से कुछ गड़बड़ हुई — कोई शुल्क या बदलाव नहीं हुआ है। कृपया थोड़ी देर में दोबारा कोशिश करें। 🙏",
        hinglish: "Meri taraf se kuch gadbad hui — koi charge ya change nahi hua hai. Thodi der mein dobara try karein. 🙏",
      },
      language,
    ),

  notUnderstood: (language: ReplyLanguage): string =>
    pick(
      {
        en: "I didn't quite catch that. Here's what I can help with 👇",
        hi: "मैं ठीक से समझ नहीं पाया। मैं इनमें मदद कर सकता हूँ 👇",
        hinglish: "Main theek se samajh nahi paya. Main inmein help kar sakta hoon 👇",
      },
      language,
    ),

  sessionRestarted: (language: ReplyLanguage): string =>
    pick(
      {
        en: "We were idle for a while so I've started fresh — nothing was booked. Where would you like to begin?",
        hi: "काफी देर कोई बातचीत नहीं हुई इसलिए मैंने नई शुरुआत की है — कुछ बुक नहीं हुआ। कहाँ से शुरू करें?",
        hinglish: "Kaafi der koi baat nahi hui isliye maine nayi shuruaat ki hai — kuch book nahi hua. Kahan se shuru karein?",
      },
      language,
    ),

  comingSoon: (language: ReplyLanguage, what: string): string =>
    pick(
      {
        en: `${what} isn't available on WhatsApp yet — I'll let you know as soon as it is. Meanwhile I can help with stays and your bookings. 🙏`,
        hi: `${what} अभी व्हाट्सएप पर उपलब्ध नहीं है — जैसे ही होगा मैं बता दूँगा। तब तक मैं कमरे और आपकी बुकिंग में मदद कर सकता हूँ। 🙏`,
        hinglish: `${what} abhi WhatsApp par available nahi hai — jaise hi hoga main bata dunga. Tab tak main stays aur aapki bookings mein help kar sakta hoon. 🙏`,
      },
      language,
    ),

  openOnWeb: (language: ReplyLanguage, url: string): string =>
    pick(
      {
        en: `You can complete this on the Tirvona website:\n${url}`,
        hi: `आप इसे तिरवोना वेबसाइट पर पूरा कर सकते हैं:\n${url}`,
        hinglish: `Aap ise Tirvona website par complete kar sakte hain:\n${url}`,
      },
      language,
    ),

  help: (language: ReplyLanguage, wappId?: string | null): string => {
    // Present only for a WhatsApp-only guest. A sender matched to an existing
    // website account already has their own identity and needs no WAPP id.
    const idLine = wappId
      ? {
          en: `\n\nYour customer ID is *${wappId}*; quote it if you contact Tirvona support.`,
          hi: `\n\nआपकी कस्टमर आईडी *${wappId}* है; तिरवोना सपोर्ट से संपर्क करते समय यह बताएं।`,
          hinglish: `\n\nAapki customer ID *${wappId}* hai; Tirvona support se baat karte waqt ye bata dein.`,
        }
      : { en: "", hi: "", hinglish: "" };
    return pick(
      {
        en: `I can help you book a stay, check your bookings, make a payment or cancel a booking — just tell me what you need.${idLine.en}`,
        hi: `मैं कमरा बुक करने, आपकी बुकिंग देखने, भुगतान करने या बुकिंग रद्द करने में मदद कर सकता हूँ — बस बताइए क्या चाहिए।${idLine.hi}`,
        hinglish: `Main stay book karne, aapki bookings dekhne, payment karne ya booking cancel karne mein help kar sakta hoon — bas bataiye kya chahiye.${idLine.hinglish}`,
      },
      language,
    );
  },

  rateLimited: (language: ReplyLanguage): string =>
    pick(
      {
        en: "That's a lot of messages at once 🙏 Give me a moment and send it once more.",
        hi: "एक साथ बहुत सारे संदेश आ गए 🙏 एक पल दें और दोबारा भेजें।",
        hinglish: "Ek saath bahut saare messages aa gaye 🙏 Ek pal dein aur dobara bhejein.",
      },
      language,
    ),
} as const;

export const formatMoney = money;
export const formatDate = date;
