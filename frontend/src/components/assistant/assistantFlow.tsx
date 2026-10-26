/**
 * The assistant's conversation, as data. A module opens a menu of features,
 * a feature is either a page to open ("nav") or a live read-only result
 * ("data"). Who sees an option follows the route guards in `App.tsx`; the
 * pages and the API still enforce access on their own.
 */
import {
  BedDouble,
  Bell,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Compass,
  CreditCard,
  FileText,
  Flame,
  HandHeart,
  HelpCircle,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  LogIn,
  MapPin,
  Newspaper,
  ParkingCircle,
  Phone,
  Receipt,
  Route,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tag,
  Ticket,
  User,
  UserPlus,
  Utensils,
  Video,
  Wallet,
} from "lucide-react";
import { getRoleDefaultDashboard, hasRoleAccess, isParkingRole } from "../../utils/roleRedirect";
import { ashramService } from "../../services";
import type {
  Access,
  AssistantContext,
  AssistantNode,
  DataNode,
  FilterSpec,
  MenuNode,
  NavNode,
} from "./assistantTypes";
import * as L from "./assistantLoaders";

// ── Access rules (mirroring the ProtectedRoute role lists in App.tsx) ────────

const signedIn: Access = (c) => Boolean(c.user);
const roles =
  (...allowed: string[]): Access =>
  (c) =>
    Boolean(c.user) && hasRoleAccess(c.user!.role, allowed);

const STAY_OWNER = ["ashram_owner", "ashram_admin", "owner", "stay_admin"];
const STAY_OWNER_OR_MANAGER = [...STAY_OWNER, "manager"];

const stayOwner = roles(...STAY_OWNER);
const stayOwnerOrManager = roles(...STAY_OWNER_OR_MANAGER);
const isPandit: Access = (c) => c.role === "provider";
const reception = roles("reception", "front_desk_reception", "manager", "staff");
const housekeeping = roles("housekeeping", "housekeeping_head");
const parkingStaff: Access = (c) => Boolean(c.user) && isParkingRole(c.user!.parkingRoles, c.user!.role, c.user!.email);
const dashboardAdmins = roles("inspector", "district_officer", "state_admin", "govt_admin", "government_admin", "national_admin", "super_admin");
const usersAdmin = roles("govt_admin", "government_admin", "super_admin");
const refundsStaff = roles("super_admin", "national_admin", "finance_manager", "support");
const walletAdmin = roles("super_admin", "national_admin", "finance_manager");
const supportStaff = roles("super_admin", "support", "national_admin", "marketplace_manager", "finance_manager", "service_manager");
const marketAdmin = roles("marketplace_manager", "finance_manager", "super_admin");
const offersAdmin = roles("offer_manager", "content_manager", "super_admin", "national_admin");
const blogsAdmin = roles("blog_manager", "content_manager", "super_admin");
const localAdmin = roles("local_manager", "service_manager", "super_admin");
const superAdmin = roles("super_admin");
const providerReviewer = roles("verification_reviewer", "super_admin");
const templeOwner = roles("temple_owner", "super_admin");

/** Owner console prefix used by the stay owner's own role. */
const ownerBase = (c: AssistantContext) =>
  c.role === "ashram_admin" ? "/ashram-admin" : c.role === "ashram_owner" ? "/ashram-owner" : "/owner";

// ── Builders ─────────────────────────────────────────────────────────────────

type Common = Pick<MenuNode, "id" | "label" | "description" | "icon" | "access" | "needsLogin">;

const menu = (common: Common, children: AssistantNode[]): MenuNode => ({ kind: "menu", ...common, children });
const nav = (common: Common, to: NavNode["to"]): NavNode => ({ kind: "nav", ...common, to });
const data = (common: Common, load: DataNode["load"], extra: Partial<DataNode> = {}): DataNode => ({
  kind: "data",
  ...common,
  load,
  ...extra,
});

const q = (placeholder: string): FilterSpec => ({ key: "q", label: "Search", type: "text", placeholder });

const destinationFilter: FilterSpec = {
  key: "destination",
  label: "Destination",
  type: "select",
  loadOptions: () =>
    L.freshOptions("stay-destinations", async () => {
      const res = await ashramService.destinations();
      const rows: Array<{ city: string }> = res.data?.data ?? [];
      return rows.map((d) => ({ value: d.city, label: d.city }));
    }),
};

const stayTypes: FilterSpec = {
  key: "type",
  label: "Type of stay",
  type: "select",
  options: [
    { value: "ashram", label: "Ashram" },
    { value: "dharamshala", label: "Dharamshala" },
    { value: "homestay", label: "Homestay" },
  ],
};

const guestsFilter: FilterSpec = {
  key: "guests",
  label: "Guests",
  type: "select",
  options: Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} guest${i ? "s" : ""}` })),
};

const today = () => new Date().toISOString().slice(0, 10);

const validateDates = (v: Record<string, string>): string | null => {
  if (!v.checkIn || !v.checkOut) return "Choose both a check-in and a check-out date.";
  if (v.checkIn < today()) return "Check-in cannot be in the past.";
  if (v.checkOut <= v.checkIn) return "Check-out must be after check-in.";
  return null;
};

// ── Modules ──────────────────────────────────────────────────────────────────

const stays = menu(
  { id: "stays", label: "Stays & Ashrams", description: "Find a stay, check rooms, manage reservations", icon: BedDouble },
  [
    data(
      { id: "find", label: "Find a stay", description: "Ashrams, dharamshalas and homestays", icon: MapPin },
      L.findStays,
      { filters: [destinationFilter, stayTypes, guestsFilter] },
    ),
    data(
      { id: "availability", label: "Room availability", description: "Stays with rooms free on your dates", icon: CalendarCheck },
      L.findStays,
      {
        filters: [
          destinationFilter,
          { key: "checkIn", label: "Check-in", type: "date", required: true },
          { key: "checkOut", label: "Check-out", type: "date", required: true },
          guestsFilter,
        ],
        validate: validateDates,
        submitLabel: "Check availability",
      },
    ),
    data({ id: "destinations", label: "Destinations", description: "Pilgrim towns with stays", icon: Compass }, L.stayDestinations),
    nav({ id: "dayrest", label: "Day rest & freshen-up", description: "Short stays by the hour", icon: BedDouble }, "/stays?mode=daystay"),
    data({ id: "mine", label: "My stay reservations", icon: CalendarCheck, needsLogin: true }, L.myStayBookings),
    menu(
      { id: "manage", label: "Manage properties", description: "Rooms, rates, calendar, guests", icon: Store, access: stayOwnerOrManager },
      [
        data({ id: "properties", label: "My properties", icon: Store, access: stayOwner }, L.ownerProperties),
        nav({ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }, (c) => `${ownerBase(c)}/dashboard`),
        nav({ id: "rooms", label: "Rooms", icon: BedDouble }, (c) => `${ownerBase(c)}/rooms`),
        nav({ id: "calendar", label: "Inventory calendar", icon: CalendarCheck }, (c) => `${ownerBase(c)}/calendar`),
        nav({ id: "checkin", label: "Check-in / check-out", icon: Ticket }, (c) => `${ownerBase(c)}/check-in-out`),
        nav({ id: "rates", label: "Room rates", icon: Tag, access: stayOwner }, (c) => `${ownerBase(c)}/rates`),
        nav({ id: "bookings", label: "Bookings", icon: CalendarCheck, access: stayOwner }, (c) => `${ownerBase(c)}/bookings`),
        nav({ id: "payments", label: "Payments", icon: CreditCard, access: stayOwner }, (c) => `${ownerBase(c)}/payments`),
        nav({ id: "walkin", label: "Walk-in booking", icon: UserPlus, access: stayOwner }, (c) => `${ownerBase(c)}/walk-in-booking`),
        nav({ id: "guests", label: "Guests", icon: User, access: stayOwner }, (c) => `${ownerBase(c)}/users`),
        nav({ id: "staff", label: "Staff", icon: User, access: stayOwner }, (c) => `${ownerBase(c)}/staff`),
        nav({ id: "payouts", label: "Payouts", icon: Wallet, access: stayOwner }, (c) => `${ownerBase(c)}/payouts`),
      ],
    ),
    menu(
      { id: "desk", label: "Front desk", description: "Arrivals, departures, housekeeping", icon: Ticket, access: (c) => reception(c) || housekeeping(c) },
      [
        nav({ id: "reception", label: "Reception desk", icon: Ticket, access: reception }, "/staff/reception"),
        nav({ id: "arrivals", label: "Arrivals", icon: CalendarCheck, access: reception }, "/staff/arrivals"),
        nav({ id: "departures", label: "Departures", icon: CalendarCheck, access: reception }, "/staff/departures"),
        nav({ id: "inhouse", label: "In-house guests", icon: User, access: reception }, "/staff/in-house"),
        nav({ id: "housekeeping", label: "Housekeeping board", icon: ClipboardList, access: housekeeping }, "/staff/housekeeping"),
      ],
    ),
  ],
);

const pandit = menu(
  { id: "pandit", label: "Pandit & Puja", description: "Find a pandit, puja services, consultations", icon: Flame },
  [
    data(
      { id: "find", label: "Find a pandit", description: "By puja, city or name", icon: User },
      L.findPandits,
      {
        filters: [
          { key: "ritual", label: "Puja / ritual", type: "select", loadOptions: async () => L.ritualOptions() },
          { key: "city", label: "City", type: "text", placeholder: "e.g. Vrindavan" },
          q("Pandit name"),
        ],
      },
    ),
    data({ id: "services", label: "Puja services", description: "Rituals you can book", icon: Flame }, L.pujaServices, { filters: [q("Search puja")] }),
    data({ id: "mine", label: "My puja bookings", icon: CalendarCheck, needsLogin: true }, L.myPujaBookings),
    data({ id: "consult", label: "My consultations", icon: Video, needsLogin: true }, L.myConsultations),
    menu(
      { id: "console", label: "Pandit console", description: "Your bookings, profile, availability", icon: LayoutDashboard, access: isPandit },
      [
        data({ id: "bookings", label: "Puja requests for me", icon: CalendarCheck }, L.providerBookings),
        nav({ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }, "/provider/dashboard"),
        nav({ id: "profile", label: "Profile", icon: User }, "/provider/profile"),
        nav({ id: "offerings", label: "Offerings & fees", icon: Tag }, "/provider/offerings"),
        nav({ id: "availability", label: "Schedule & availability", icon: CalendarCheck }, "/provider/availability"),
        nav({ id: "verification", label: "Verification", icon: ShieldCheck }, "/provider/verification"),
        nav({ id: "wallet", label: "Earnings wallet", icon: Wallet }, "/provider/wallet"),
      ],
    ),
    nav(
      { id: "register", label: "Register as a pandit", description: "Create your pandit profile", icon: UserPlus, needsLogin: true, access: (c) => !isPandit(c) },
      "/provider/profile/new",
    ),
  ],
);

const marketplace = menu(
  { id: "market", label: "Marketplace", description: "Sacred products, cart, orders, seller tools", icon: ShoppingBag },
  [
    data(
      { id: "browse", label: "Browse products", description: "By category and sub-category", icon: ShoppingBag },
      L.browseProducts,
      {
        filters: [
          { key: "category", label: "Category", type: "select", loadOptions: async () => L.marketCategoryOptions() },
          { key: "subCategory", label: "Sub-category", type: "select", dependsOn: "category", loadOptions: L.marketSubCategoryOptions },
          q("Search products"),
        ],
      },
    ),
    data({ id: "categories", label: "Categories", icon: Tag }, L.marketCategories),
    data({ id: "cart", label: "My cart", icon: ShoppingBag }, L.cartContents),
    data({ id: "orders", label: "My orders", icon: Receipt, needsLogin: true }, L.myMarketOrders),
    nav({ id: "wishlist", label: "Wishlist", icon: BookOpen, needsLogin: true }, "/profile/wishlist"),
    menu(
      { id: "seller", label: "My store (seller)", description: "Products, orders, earnings", icon: Store, needsLogin: true },
      [
        data({ id: "summary", label: "Store summary", icon: LayoutDashboard }, L.sellerSummary),
        data({ id: "products", label: "My products", icon: ShoppingBag }, L.sellerProducts),
        data({ id: "orders", label: "Store orders", icon: Receipt }, L.sellerOrders),
        nav({ id: "add", label: "Add a product", icon: UserPlus }, "/vendor/products/new"),
        nav({ id: "inventory", label: "Inventory", icon: ClipboardList }, "/vendor/inventory"),
        nav({ id: "earnings", label: "Earnings", icon: Wallet }, "/vendor/earnings"),
        nav({ id: "payouts", label: "Payouts", icon: CreditCard }, "/vendor/payouts"),
        nav({ id: "reviews", label: "Reviews", icon: Ticket }, "/vendor/reviews"),
        nav({ id: "settings", label: "Store settings", icon: Settings }, "/vendor/store"),
        nav({ id: "onboard", label: "Become a seller", icon: UserPlus }, "/vendor/onboarding"),
      ],
    ),
    menu(
      { id: "admin", label: "Marketplace administration", icon: ShieldCheck, access: marketAdmin },
      [
        data({ id: "overview", label: "Overview", icon: LayoutDashboard }, L.marketplaceOverview),
        nav({ id: "vendors", label: "Vendors", icon: Store }, "/admin/manage/marketplace/vendors"),
        nav({ id: "approvals", label: "Product approvals", icon: ClipboardList }, "/admin/manage/marketplace/approvals"),
        nav({ id: "orders", label: "Orders", icon: Receipt }, "/admin/manage/marketplace/orders"),
        nav({ id: "payouts", label: "Payouts", icon: Wallet }, "/admin/manage/marketplace/payouts"),
      ],
    ),
  ],
);

const zoneFilter: FilterSpec = { key: "zone", label: "Area", type: "select", loadOptions: async () => L.foodZoneOptions() };

const food = menu(
  { id: "food", label: "Food", description: "Restaurants, menus and food orders", icon: Utensils },
  [
    data({ id: "outlets", label: "Explore restaurants", icon: Utensils }, L.foodOutlets, { filters: [zoneFilter, q("Restaurant or dish")] }),
    data(
      { id: "menu", label: "Menu", description: "Thalis, bowls and combos", icon: BookOpen },
      L.foodMenu,
      {
        filters: [
          zoneFilter,
          {
            key: "family",
            label: "Meal type",
            type: "select",
            options: [
              { value: "THALI", label: "Thali" },
              { value: "BOWL", label: "Bowl" },
              { value: "COMBO", label: "Combo" },
            ],
          },
          q("Search meals"),
        ],
      },
    ),
    data({ id: "orders", label: "My food orders", icon: Receipt, needsLogin: true }, L.myFoodOrders),
    menu(
      { id: "restaurant", label: "My restaurant", description: "Orders, menu, wallet", icon: Store, needsLogin: true },
      [
        data({ id: "summary", label: "Restaurant summary", icon: LayoutDashboard }, L.restaurantSummary),
        nav({ id: "orders", label: "Incoming orders", icon: Receipt }, "/restaurant/orders"),
        nav({ id: "menu", label: "Manage menu", icon: BookOpen }, "/restaurant/menu"),
        nav({ id: "wallet", label: "Restaurant wallet", icon: Wallet }, "/restaurant/wallet"),
        nav({ id: "profile", label: "Restaurant profile", icon: Settings }, "/restaurant/profile"),
      ],
    ),
    menu(
      { id: "admin", label: "Food administration", icon: ShieldCheck, access: superAdmin },
      [
        nav({ id: "ops", label: "Operations", icon: LayoutDashboard }, "/admin/food"),
        nav({ id: "vendors", label: "Restaurants", icon: Store }, "/admin/food/vendors"),
        nav({ id: "wallets", label: "Restaurant wallets", icon: Wallet }, "/admin/food/wallets"),
      ],
    ),
  ],
);

const sacred = menu(
  { id: "sacred", label: "Temples & Pilgrimage", description: "Temples, aarti, events, circuits, parking", icon: Landmark },
  [
    data({ id: "temples", label: "Temples", icon: Landmark }, L.templeList, { filters: [q("Temple name")] }),
    data(
      { id: "events", label: "Festivals & events", description: "Spiritual events with passes", icon: Ticket },
      L.eventList,
      {
        filters: [
          { key: "city", label: "City", type: "select", loadOptions: async () => L.eventCityOptions() },
          { key: "date", label: "On or after", type: "date" },
          q("Event name"),
        ],
      },
    ),
    data(
      { id: "aarti", label: "Aarti sessions", icon: Flame },
      L.aartiList,
      { filters: [{ key: "city", label: "City", type: "select", loadOptions: async () => L.aartiCityOptions() }, q("Aarti or temple")] },
    ),
    data({ id: "live", label: "Live pooja", icon: Video }, L.livePoojaList),
    data({ id: "circuits", label: "Pilgrimage circuits", icon: Route }, L.circuitList, { filters: [q("Circuit name")] }),
    nav({ id: "planner", label: "Itinerary planner", icon: Compass }, "/destinations/planner"),
    data({ id: "parking", label: "Parking", icon: ParkingCircle }, L.parkingList, { filters: [destinationFilter] }),
    data({ id: "volunteer", label: "Volunteer roles", icon: HandHeart }, L.volunteerJobs, { filters: [q("Role or ashram"), { key: "city", label: "City", type: "text" }] }),
    menu(
      { id: "guides", label: "Guides & local directories", icon: MapPin },
      [
        nav({ id: "travel", label: "Travel guides", icon: Compass }, "/travel-guides"),
        nav({ id: "local", label: "Local guides", icon: MapPin }, "/local-guides"),
        nav({ id: "services", label: "Local services", icon: MapPin }, "/local"),
        nav({ id: "transport", label: "Transport", icon: Route }, "/transport"),
        nav({ id: "shops", label: "Shops", icon: Store }, "/shops"),
        nav({ id: "puja", label: "Puja items", icon: Flame }, "/puja-items"),
        nav({ id: "books", label: "Books", icon: BookOpen }, "/books"),
        nav({ id: "handicrafts", label: "Handicrafts", icon: Tag }, "/handicrafts"),
      ],
    ),
    menu(
      { id: "manage", label: "Manage temples & parking", icon: Store, access: (c) => templeOwner(c) || parkingStaff(c) },
      [
        nav({ id: "temple", label: "Temple dashboard", icon: LayoutDashboard, access: templeOwner }, "/temple-owner/dashboard"),
        nav({ id: "temples", label: "All temples", icon: Landmark, access: superAdmin }, "/admin/temples"),
        nav({ id: "parking", label: "Parking dashboard", icon: ParkingCircle, access: parkingStaff }, "/parking/dashboard"),
      ],
    ),
  ],
);


const records = menu(
  { id: "records", label: "Bookings & Payments", description: "Everything you booked, paid and ordered", icon: CalendarCheck },
  [
    data({ id: "stays", label: "Stay reservations", icon: BedDouble, needsLogin: true }, L.myStayBookings),
    data({ id: "puja", label: "Puja bookings", icon: Flame, needsLogin: true }, L.myPujaBookings),
    data({ id: "parking", label: "Parking bookings", icon: ParkingCircle, needsLogin: true }, L.myParkingBookings),
    data({ id: "aarti", label: "Aarti bookings", icon: Flame, needsLogin: true }, L.myAartiBookings),
    data({ id: "events", label: "Event passes", icon: Ticket, needsLogin: true }, L.myEventPasses),
    data({ id: "food", label: "Food orders", icon: Utensils, needsLogin: true }, L.myFoodOrders),
    data({ id: "orders", label: "Marketplace orders", icon: ShoppingBag, needsLogin: true }, L.myMarketOrders),
    data({ id: "volunteer", label: "Volunteer applications", icon: HandHeart, needsLogin: true }, L.myVolunteerApplications),
    data({ id: "wallet", label: "Wallet & refunds", description: "Balance and recent transactions", icon: Wallet, needsLogin: true }, L.walletOverview),
    nav({ id: "payments", label: "Payment history", icon: CreditCard, needsLogin: true }, "/profile/payments"),
    nav({ id: "refund-policy", label: "Refund policy", icon: FileText }, "/refund-policy"),
    nav({ id: "cancel-policy", label: "Cancellation policy", icon: FileText }, "/cancellation-policy"),
    menu(
      { id: "finance", label: "Finance administration", icon: ShieldCheck, access: (c) => refundsStaff(c) || walletAdmin(c) || superAdmin(c) },
      [
        nav({ id: "refunds", label: "Refund requests", icon: Receipt, access: refundsStaff }, "/admin/refunds"),
        nav({ id: "wallets", label: "Customer wallets", icon: Wallet, access: walletAdmin }, "/admin/wallets"),
        nav({ id: "payouts", label: "Payouts", icon: CreditCard, access: superAdmin }, "/admin/payouts"),
      ],
    ),
  ],
);

const offers = menu(
  { id: "offers", label: "Offers & Coupons", description: "Active promotions and promo codes", icon: Tag },
  [
    data({ id: "active", label: "Active offers", icon: Tag }, L.publicOffers),
    nav({ id: "all", label: "All offers", icon: Tag }, "/offers"),
    nav({ id: "owner", label: "My property offers", icon: Store, access: stayOwner }, (c) => `${ownerBase(c)}/offers`),
    nav({ id: "admin", label: "Manage offers", icon: ShieldCheck, access: offersAdmin }, "/admin/manage/offers"),
  ],
);

const content = menu(
  { id: "content", label: "Blogs & Articles", description: "Stories and guides from the community", icon: Newspaper },
  [
    data({ id: "blog", label: "Latest articles", icon: Newspaper }, L.blogPosts, { filters: [q("Search articles")] }),
    nav({ id: "all", label: "Open the blog", icon: BookOpen }, "/blog"),
    nav({ id: "mine", label: "My articles", icon: FileText, needsLogin: true }, "/profile/articles"),
    nav({ id: "manage-blog", label: "Manage blogs", icon: ShieldCheck, access: blogsAdmin }, "/admin/manage/blogs/all"),
    nav({ id: "manage-local", label: "Manage local content", icon: ShieldCheck, access: localAdmin }, "/admin/manage/local/all"),
  ],
);

const support = menu(
  { id: "support", label: "Help & Support", description: "FAQs, tickets, contact", icon: LifeBuoy },
  [
    nav({ id: "faq", label: "FAQs", icon: HelpCircle }, "/faq"),
    nav({ id: "help", label: "Help centre", icon: LifeBuoy }, "/help"),
    data(
      { id: "tickets", label: "My support tickets", icon: Ticket, needsLogin: true },
      L.myTickets,
      {
        filters: [
          {
            key: "status",
            label: "Status",
            type: "select",
            options: ["OPEN", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED"].map((s) => ({
              value: s,
              label: s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (ch) => ch.toUpperCase()),
            })),
          },
        ],
      },
    ),
    nav({ id: "new", label: "Raise a ticket", icon: Ticket, needsLogin: true }, "/profile/support/new"),
    nav({ id: "contact", label: "Contact us", icon: Phone }, "/contact"),
    menu(
      { id: "policies", label: "Policies", icon: FileText },
      [
        nav({ id: "terms", label: "Terms of use", icon: FileText }, "/terms"),
        nav({ id: "privacy", label: "Privacy policy", icon: FileText }, "/privacy"),
        nav({ id: "refund", label: "Refund policy", icon: FileText }, "/refund-policy"),
        nav({ id: "cancel", label: "Cancellation policy", icon: FileText }, "/cancellation-policy"),
        nav({ id: "stay", label: "Stay policies", icon: FileText }, "/stay-policies"),
      ],
    ),
    menu(
      { id: "console", label: "Support console", icon: ShieldCheck, access: supportStaff },
      [
        data({ id: "overview", label: "Ticket summary", icon: LayoutDashboard }, L.supportOverview),
        nav({ id: "tickets", label: "All tickets", icon: Ticket }, "/admin/support/tickets"),
      ],
    ),
  ],
);

const account = menu(
  { id: "account", label: "My Account", description: "Sign in, profile, notifications, partners", icon: User },
  [
    nav({ id: "login", label: "Sign in", icon: LogIn, access: (c) => !c.user }, "/login"),
    nav({ id: "register", label: "Create an account", icon: UserPlus, access: (c) => !c.user }, "/register"),
    nav({ id: "profile", label: "My profile", icon: User, access: signedIn }, "/profile"),
    nav({ id: "settings", label: "Account settings", icon: Settings, access: signedIn }, "/profile/settings"),
    nav({ id: "notifications", label: "Notifications", icon: Bell, access: signedIn }, "/profile/notifications"),
    nav(
      { id: "dashboard", label: "My dashboard", icon: LayoutDashboard, access: (c) => Boolean(c.user) && getRoleDefaultDashboard(c.user!.role, c.user!.parkingRoles, c.user!.email) !== "/profile" },
      (c) => getRoleDefaultDashboard(c.user?.role, c.user?.parkingRoles, c.user?.email),
    ),
    nav({ id: "partner", label: "Partner with Tirvona", description: "List a property or service", icon: Store }, "/partner"),
    nav({ id: "about", label: "About Tirvona", icon: BookOpen }, "/about"),
  ],
);

const platform = menu(
  { id: "platform", label: "Platform administration", description: "Dashboards, users, reviews, audits", icon: ShieldCheck, access: (c) => Boolean(c.user) && c.role !== "customer" },
  [
    nav({ id: "dashboard", label: "Admin dashboard", icon: LayoutDashboard, access: dashboardAdmins }, "/admin/dashboard"),
    nav({ id: "verifications", label: "Verification queue", icon: ShieldCheck, access: dashboardAdmins }, "/admin/verifications"),
    nav({ id: "providers", label: "Pandit verification review", icon: Flame, access: providerReviewer }, "/admin/verifications/providers"),
    nav({ id: "users", label: "Users & roles", icon: User, access: usersAdmin }, "/admin/users"),
    nav({ id: "pandits", label: "Pandit administration", icon: Flame, access: superAdmin }, "/admin/pandits"),
    nav({ id: "parking", label: "Parking control", icon: ParkingCircle, access: superAdmin }, "/admin/parking/control"),
    nav({ id: "audit", label: "Audit logs", icon: FileText, access: superAdmin }, "/admin/audit-logs"),
    nav({ id: "hr", label: "HR & my work", description: "Shown by your HR permissions", icon: User, access: signedIn }, "/admin/hr/my-work"),
  ],
);


export const ASSISTANT_ROOT: MenuNode = {
  kind: "menu",
  id: "root",
  label: "Main menu",
  children: [stays, pandit, marketplace, food, sacred, records, offers, content, support, account, platform],
};

// ── Stable ids ───────────────────────────────────────────────────────────────

/** Gives every node its path id once; the Assistant Management configuration refers to these. */
const assignPaths = (node: AssistantNode, parent: string) => {
  node.pid = parent ? `${parent}/${node.id}` : node.id;
  if (node.kind === "menu") node.children.forEach((child) => assignPaths(child, node.pid as string));
};
ASSISTANT_ROOT.children.forEach((module) => assignPaths(module, ""));

// ── Walking the tree ─────────────────────────────────────────────────────────

const entryOf = (node: AssistantNode, ctx: AssistantContext) => (node.pid ? ctx.config?.byId.get(node.pid) : undefined);

/** Hidden by Assistant Management: gone from the menu. This never touches the feature itself. */
const isHidden = (node: AssistantNode, ctx: AssistantContext) => entryOf(node, ctx)?.visible === false;

/** Switched off by Assistant Management: still listed, but cannot be opened. */
export const isDisabled = (node: AssistantNode, ctx: AssistantContext) => entryOf(node, ctx)?.enabled === false;

/** A module's display name can be overridden; options keep the name the code gives them. */
export const labelOf = (node: AssistantNode, ctx: AssistantContext) =>
  node.pid && !node.pid.includes("/") ? entryOf(node, ctx)?.label ?? node.label : node.label;

/** An option is shown when its own rule passes, it is not hidden, and (for a menu) something inside it is reachable. */
export const isVisible = (node: AssistantNode, ctx: AssistantContext): boolean => {
  if (node.access && !node.access(ctx)) return false;
  if (isHidden(node, ctx)) return false;
  if (node.kind === "menu") return node.children.some((child) => isVisible(child, ctx));
  return true;
};

/** Configured options first, in the configured order; options the configuration does not know follow in code order. */
export const visibleChildren = (node: MenuNode, ctx: AssistantContext): AssistantNode[] =>
  node.children
    .map((child, index) => ({ child, index, order: entryOf(child, ctx)?.order }))
    .filter(({ child }) => isVisible(child, ctx))
    .sort((a, b) => {
      if (a.order === undefined && b.order === undefined) return a.index - b.index;
      if (a.order === undefined) return 1;
      if (b.order === undefined) return -1;
      return a.order - b.order || a.index - b.index;
    })
    .map(({ child }) => child);

/** Resolves a path of ids to nodes; stops (returns what it found) when an id is no longer reachable or is switched off. */
export const resolvePath = (path: string[], ctx: AssistantContext): AssistantNode[] => {
  const trail: AssistantNode[] = [];
  let current: AssistantNode = ASSISTANT_ROOT;
  for (const id of path) {
    if (current.kind !== "menu") break;
    const next: AssistantNode | undefined = visibleChildren(current, ctx).find((child) => child.id === id);
    if (!next || isDisabled(next, ctx)) break;
    trail.push(next);
    current = next;
  }
  return trail;
};

// ── What Assistant Management can manage ─────────────────────────────────────

export type Integration = "live" | "partial" | "navigation";

const leaves = (node: AssistantNode): Array<"data" | "nav"> =>
  node.kind === "menu" ? node.children.flatMap(leaves) : [node.kind];

/** live = every option reads live data; navigation = every option only opens an existing page; otherwise partial. */
const integrationOf = (node: AssistantNode): Integration => {
  const kinds = leaves(node);
  if (kinds.every((k) => k === "data")) return "live";
  if (kinds.every((k) => k === "nav")) return "navigation";
  return "partial";
};

export interface RegistryEntry {
  pid: string;
  label: string;
  description?: string;
  kind: AssistantNode["kind"];
  integration: Integration;
  /** Roles/conditions that gate it are code; shown only as a hint that it is not for everyone. */
  restricted: boolean;
  children: RegistryEntry[];
}

const describe = (node: AssistantNode): RegistryEntry => ({
  pid: node.pid as string,
  label: node.label,
  description: node.description,
  kind: node.kind,
  integration: integrationOf(node),
  restricted: Boolean(node.access),
  children: node.kind === "menu" ? node.children.map(describe) : [],
});

/** Every module and option registered in code, whoever may see it. Unregistered ids can never appear. */
export const ASSISTANT_REGISTRY: RegistryEntry[] = ASSISTANT_ROOT.children.map(describe);
