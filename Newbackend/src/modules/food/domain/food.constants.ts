/**
 * Domain constants for Tirvona Food / Tirvona Bhojan Marketplace
 * Adheres strictly to Tirvona_Food_Product_and_Technical_Blueprint_V3.docx
 */

export const FOOD_MEAL_FAMILIES = ["THALI", "BOWL", "COMBO"] as const;
export type FoodMealFamily = (typeof FOOD_MEAL_FAMILIES)[number];

export const FOOD_FULFILMENT_TYPES = [
  "pickup",
  "vendor_delivery",
  "stay_delivery",
] as const;
export type FoodFulfilmentType = (typeof FOOD_FULFILMENT_TYPES)[number];

export const FOOD_ORDER_STATUSES = [
  "DRAFT",
  "QUOTED",
  "PAYMENT_PENDING",
  "PAID_AWAITING_VENDOR",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
  "PAYMENT_FAILED",
  "PAYMENT_EXPIRED",
  "VENDOR_REJECTED",
  "VENDOR_TIMEOUT",
  "CANCEL_REQUESTED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUND_PROCESSING",
  "REFUNDED",
  "REFUND_FAILED",
] as const;
export type FoodOrderStatus = (typeof FOOD_ORDER_STATUSES)[number];

export const FOOD_PAYMENT_STATUSES = [
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
] as const;
export type FoodPaymentStatus = (typeof FOOD_PAYMENT_STATUSES)[number];

/**
 * Older records may hold a refund state in paymentStatus ("REFUND_FAILED"), which is not a payment status:
 * the payment itself was PAID. Anything leaving the API is mapped through this.
 */
export const canonicalPaymentStatus = (status: string) => (status === "REFUND_FAILED" ? "PAID" : status);

export const FOOD_DIETARY_TAGS = [
  "vegetarian",
  "satvik",
  "jain",
  "no_onion_garlic",
  "no_ginger_garlic",
  "spicy",
  "non_spicy",
] as const;
export type FoodDietaryTag = (typeof FOOD_DIETARY_TAGS)[number];

export const FOOD_VENDOR_STATUSES = [
  "pending_verification",
  "active",
  "suspended",
  "rejected",
] as const;
export type FoodVendorStatus = (typeof FOOD_VENDOR_STATUSES)[number];

export const FOOD_OUTLET_STATUSES = ["active", "paused", "closed"] as const;
export type FoodOutletStatus = (typeof FOOD_OUTLET_STATUSES)[number];

export const FOOD_REFUND_STATUSES = [
  "pending",
  "processing",
  "refunded",
  "failed",
] as const;
export type FoodRefundStatus = (typeof FOOD_REFUND_STATUSES)[number];

export const FOOD_SETTLEMENT_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "paid",
  "disputed",
] as const;
export type FoodSettlementStatus = (typeof FOOD_SETTLEMENT_STATUSES)[number];

/** How Tirvona handed a kitchen its money. Cash is the only method without a receipt. */
export const FOOD_PAYMENT_METHODS = ["bank_transfer", "upi", "cash"] as const;
export type FoodPaymentMethod = (typeof FOOD_PAYMENT_METHODS)[number];

/** A payment that was entered by mistake is voided, never deleted, so the history stays complete. */
export const FOOD_VENDOR_PAYMENT_STATUSES = ["recorded", "voided"] as const;
export type FoodVendorPaymentStatus = (typeof FOOD_VENDOR_PAYMENT_STATUSES)[number];

/** A kitchen has earned an order once it was handed over (and paid for): picked up, delivered or completed. */
export const FOOD_FULFILLED_ORDER_STATUSES = ["PICKED_UP", "DELIVERED", "COMPLETED"] as const;

export const FOOD_LEDGER_ENTRY_TYPES = [
  "order_payment",
  "vendor_credit",
  "platform_commission",
  "delivery_fee",
  "refund_debit",
  "adjustment",
] as const;
export type FoodLedgerEntryType = (typeof FOOD_LEDGER_ENTRY_TYPES)[number];

export const FOOD_LEDGER_ACCOUNTS = [
  "customer_receivable",
  "vendor_payable",
  "platform_revenue",
  "delivery_payable",
  "refund_payable",
] as const;
export type FoodLedgerAccount = (typeof FOOD_LEDGER_ACCOUNTS)[number];

/**
 * Standard 4 Thali Variant definitions from Blueprint Section 2.1
 */
export const THALI_VARIANTS = [
  {
    sku: "THALI-GG-SPICY",
    label: "Tirvona Special Thali (With Ginger & Garlic - Spicy)",
    gingerGarlic: true,
    spicy: true,
    dietaryDeclaration: "Ginger and garlic included + spicy",
    tags: ["vegetarian", "spicy"],
  },
  {
    sku: "THALI-GG-NONSPICY",
    label: "Tirvona Special Thali (With Ginger & Garlic - Non-spicy)",
    gingerGarlic: true,
    spicy: false,
    dietaryDeclaration: "Ginger and garlic included + non-spicy",
    tags: ["vegetarian", "non_spicy"],
  },
  {
    sku: "THALI-NOGG-SPICY",
    label: "Tirvona Satvik Thali (No Ginger No Garlic - Spicy)",
    gingerGarlic: false,
    spicy: true,
    dietaryDeclaration: "Without ginger and garlic + spicy (Satvik)",
    tags: ["vegetarian", "satvik", "no_onion_garlic", "no_ginger_garlic", "spicy"],
  },
  {
    sku: "THALI-NOGG-NONSPICY",
    label: "Tirvona Satvik Thali (No Ginger No Garlic - Non-spicy)",
    gingerGarlic: false,
    spicy: false,
    dietaryDeclaration: "Without ginger and garlic + non-spicy (Satvik)",
    tags: ["vegetarian", "satvik", "no_onion_garlic", "no_ginger_garlic", "non_spicy"],
  },
] as const;

/**
 * 6 Launch Bowls from Blueprint Section 2.2
 */
export const LAUNCH_BOWLS = [
  {
    sku: "BWL-RAJMA-RICE",
    canonicalName: "Rajma Chawal",
    label: "Punjabi Rajma Chawal Bowl",
    contents: "Slow-cooked Kashmiri Rajma in thick tomato gravy, premium Basmati jeera rice, fresh coriander",
    prepMinutes: 15,
    portion: "450g (Serves 1)",
    defaultPricePaise: 14900, // ₹149
    tags: ["vegetarian"],
  },
  {
    sku: "BWL-KADHI-RICE",
    canonicalName: "Kadhi Chawal",
    label: "Dahi Kadhi Pakoda Rice Bowl",
    contents: "Tangy curd-based kadhi with soft methi pakodas, spiced tempering with mustard & curry leaves, steamed Basmati rice",
    prepMinutes: 15,
    portion: "450g (Serves 1)",
    defaultPricePaise: 13900, // ₹139
    tags: ["vegetarian"],
  },
  {
    sku: "BWL-CHHOLE-RICE",
    canonicalName: "Chhole Chawal",
    label: "Amritsari Chhole Chawal Bowl",
    contents: "Rich black chhole simmered in anardana & whole spices, aromatic Basmati rice, pickled green chilli",
    prepMinutes: 15,
    portion: "450g (Serves 1)",
    defaultPricePaise: 14900, // ₹149
    tags: ["vegetarian"],
  },
  {
    sku: "BWL-DAAL-RICE",
    canonicalName: "Daal Chawal",
    label: "Desi Ghee Daal Tadka Rice Bowl",
    contents: "Yellow Arhar daal with double hing-jeera desi ghee tadka, steamed long-grain Basmati rice",
    prepMinutes: 12,
    portion: "450g (Serves 1)",
    defaultPricePaise: 12900, // ₹129
    tags: ["vegetarian", "satvik", "no_onion_garlic"],
  },
  {
    sku: "BWL-PANEER-RICE",
    canonicalName: "Paneer Chawal",
    label: "Matar Paneer Chawal Bowl",
    contents: "Fresh cottage cheese cubes & green peas in aromatic cashew-tomato gravy with jeera Basmati rice",
    prepMinutes: 18,
    portion: "450g (Serves 1)",
    defaultPricePaise: 17900, // ₹179
    tags: ["vegetarian"],
  },
  {
    sku: "BWL-KHICHDI",
    canonicalName: "Khichdi",
    label: "Satvik Moong Daal Khichdi Bowl",
    contents: "Light, comforting yellow moong daal & rice tempered with pure cow desi ghee, jeera and mild rock salt",
    prepMinutes: 15,
    portion: "450g (Serves 1)",
    defaultPricePaise: 11900, // ₹119
    tags: ["vegetarian", "satvik", "no_onion_garlic", "no_ginger_garlic", "non_spicy"],
  },
] as const;

/**
 * 11 Launch Combos from Blueprint Section 2.3
 */
export const LAUNCH_COMBOS = [
  {
    sku: "CMB-RAJMA-RICE",
    canonicalName: "Rajma Chawal",
    label: "Rajma Chawal Special Combo",
    contents: "Generous bowl of Punjabi Rajma, fragrant Basmati rice, roasted papad, cucumber-onion salad, and creamy sweet curd",
    prepMinutes: 20,
    portion: "Combo (Serves 1-2)",
    defaultPricePaise: 19900, // ₹199
    tags: ["vegetarian"],
  },
  {
    sku: "CMB-KADHI-RICE",
    canonicalName: "Kadhi Chawal",
    label: "Kadhi Pakoda Shahi Combo",
    contents: "Tangy Kadhi with 3 pakodas, steamed Basmati rice, dry aloo jeera subji, roasted papad, mixed pickle",
    prepMinutes: 20,
    portion: "Combo (Serves 1-2)",
    defaultPricePaise: 18900, // ₹189
    tags: ["vegetarian"],
  },
  {
    sku: "CMB-CHHOLE-RICE",
    canonicalName: "Chhole Chawal",
    label: "Pindi Chhole Chawal Feast Combo",
    contents: "Spicy dark Pindi Chhole, jeera rice, 1 crisp tawa paratha, boondi raita, vinegar onion & mint chutney",
    prepMinutes: 20,
    portion: "Combo (Serves 1-2)",
    defaultPricePaise: 20900, // ₹209
    tags: ["vegetarian"],
  },
  {
    sku: "CMB-DAAL-RICE",
    canonicalName: "Daal Chawal",
    label: "Panchmel Daal Baati / Chawal Desi Combo",
    contents: "5-lentil Rajasthani Panchmel daal, desi ghee tadka, Basmati rice, seasonal dry vegetable, 2 phulkas, papad",
    prepMinutes: 18,
    portion: "Combo (Serves 1-2)",
    defaultPricePaise: 17900, // ₹179
    tags: ["vegetarian", "satvik"],
  },
  {
    sku: "CMB-PANEER-RICE",
    canonicalName: "Paneer Chawal",
    label: "Shahi Paneer Deluxe Combo",
    contents: "Rich creamy Shahi Paneer, saffron infused jeera rice, 2 butter tawa rotis, cucumber raita, gulab jamun",
    prepMinutes: 22,
    portion: "Combo (Serves 1-2)",
    defaultPricePaise: 24900, // ₹249
    tags: ["vegetarian"],
  },
  {
    sku: "CMB-CHHOLE-BHATURE",
    canonicalName: "Chhole Bhature",
    label: "Delhi-Style Chhole Bhature Combo",
    contents: "2 freshly fried fluffy paneer-stuffed bhature, rich spiced chhole, aloo masala, amla pickle, green chilli",
    prepMinutes: 20,
    portion: "2 Bhature + Sides (Serves 1)",
    defaultPricePaise: 16900, // ₹169
    tags: ["vegetarian"],
  },
  {
    sku: "CMB-POORI-SABJI",
    canonicalName: "Poori Sabji",
    label: "Mathura Bedmi Poori Aloo Sabji Combo",
    contents: "4 crisp urad-daal stuffed bedmi pooris, authentic spicy Mathura hing aloo jhol sabji, sweet kaddu launji, pickle",
    prepMinutes: 18,
    portion: "4 Pooris + 2 Sabjis (Serves 1)",
    defaultPricePaise: 14900, // ₹149
    tags: ["vegetarian", "satvik", "no_onion_garlic"],
  },
  {
    sku: "CMB-IDLI-SAMBHAR",
    canonicalName: "Idli Sambhar",
    label: "Steamed Idli Sambhar Combo",
    contents: "4 fluffy steamed rice idlis, hot drumstick & vegetable sambhar, freshly ground coconut chutney, tomato-onion chutney",
    prepMinutes: 15,
    portion: "4 Idlis + Sambhar + 2 Chutneys",
    defaultPricePaise: 12900, // ₹129
    tags: ["vegetarian", "satvik", "no_onion_garlic"],
  },
  {
    sku: "CMB-DOSA-SAMBHAR",
    canonicalName: "Dosa Sambhar",
    label: "Crispy Masala Dosa Sambhar Combo",
    contents: "Cook-to-order golden crispy butter masala dosa stuffed with spiced potato filling, piping hot sambhar, fresh coconut chutney",
    prepMinutes: 20,
    portion: "1 Large Dosa + Sambhar + 2 Chutneys",
    defaultPricePaise: 15900, // ₹159
    tags: ["vegetarian"],
  },
  {
    sku: "CMB-VADA-SAMBHAR",
    canonicalName: "Vada Sambhar",
    label: "Crispy Medu Vada Sambhar Combo",
    contents: "3 crispy golden medu vadas prepared with whole black pepper & ginger, authentic aromatic sambhar, coconut chutney",
    prepMinutes: 16,
    portion: "3 Vadas + Sambhar + Chutney",
    defaultPricePaise: 13900, // ₹139
    tags: ["vegetarian"],
  },
  {
    sku: "CMB-KHICHDI",
    canonicalName: "Khichdi",
    label: "Vrindavan Mahaprasad Khichdi Combo",
    contents: "Wholesome Satvik Moong Daal khichdi with vegetables, cow desi ghee katori, fresh curd, roasted cumin papad, mango pickle",
    prepMinutes: 15,
    portion: "Combo (Serves 1-2)",
    defaultPricePaise: 16900, // ₹169
    tags: ["vegetarian", "satvik", "no_onion_garlic", "no_ginger_garlic", "non_spicy"],
  },
] as const;

/**
 * Launch pilot service zones in Vrindavan and Mathura
 */
export const PILOT_SERVICE_ZONES = [
  {
    zoneCode: "VRINDAVAN_CORE",
    name: "Vrindavan Core & Temples",
    description: "Bankey Bihari, Raman Reti, ISKCON, Prem Mandir, Parikrama Marg",
    active: true,
    deliveryFeePaise: 3500, // ₹35
    minOrderPaise: 9900,    // ₹99
  },
  {
    zoneCode: "MATHURA_CITY",
    name: "Mathura City & Ghats",
    description: "Krishna Janmabhoomi, Vishram Ghat, Holi Gate, Station Area",
    active: true,
    deliveryFeePaise: 4000, // ₹40
    minOrderPaise: 9900,    // ₹99
  },
  {
    zoneCode: "CHATIKARA",
    name: "Chatikara & NH19 Corridor",
    description: "Chatikara Road, Vaishno Devi Mandir, Highway Resorts & Stays",
    active: true,
    deliveryFeePaise: 4500, // ₹45
    minOrderPaise: 12900,   // ₹129
  },
  {
    zoneCode: "GOVARDHAN",
    name: "Govardhan & Radhakund",
    description: "Govardhan Parikrama, Daan Ghati, Radhakund, Manasi Ganga",
    active: true,
    deliveryFeePaise: 5000, // ₹50
    minOrderPaise: 14900,   // ₹149
  },
] as const;
