/* oxlint-disable react/only-export-components -- this module intentionally exports the complete typed icon catalogue */
import React, { forwardRef } from "react";

export interface LucideProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
  fill?: string;
  width?: number | string;
  height?: number | string;
}

export type LucideIcon = React.ForwardRefExoticComponent<
  LucideProps & React.RefAttributes<HTMLSpanElement>
>;

const materialIcon = (symbol: string): LucideIcon => {
  const Icon = forwardRef<HTMLSpanElement, LucideProps>(
    (
      {
        size,
        color,
        strokeWidth: _strokeWidth,
        absoluteStrokeWidth: _absoluteStrokeWidth,
        fill,
        width,
        height,
        className = "",
        style,
        ...props
      },
      ref,
    ) => {
      const resolvedWidth = size ?? width;
      const resolvedHeight = size ?? height;
      const isFilled = Boolean(fill && fill !== "none" && fill !== "transparent");

      return (
        <span
          {...props}
          ref={ref}
          aria-hidden={
            props["aria-hidden"] ?? (props["aria-label"] ? undefined : true)
          }
          className={`material-symbols-rounded google-material-icon lucide ${className}`.trim()}
          style={{
            ...(resolvedWidth != null
              ? { width: resolvedWidth, fontSize: resolvedWidth }
              : {}),
            ...(resolvedHeight != null ? { height: resolvedHeight } : {}),
            ...(color ? { color } : {}),
            fontVariationSettings: `"FILL" ${isFilled ? 1 : 0}, "wght" 400, "GRAD" 0, "opsz" 24`,
            ...style,
          }}
        >
          {symbol}
        </span>
      );
    },
  );
  Icon.displayName = `MaterialIcon(${symbol})`;
  return Icon;
};

export const Accessibility = materialIcon("accessibility_new");
export const Activity = materialIcon("ecg_heart");
export const AlertCircle = materialIcon("error");
export const AlertTriangle = materialIcon("warning");
export const Ambulance = materialIcon("ambulance");
export const Archive = materialIcon("archive");
export const ArrowDownRight = materialIcon("south_east");
export const ArrowLeft = materialIcon("arrow_back");
export const ArrowLeftRight = materialIcon("sync_alt");
export const ArrowRight = materialIcon("arrow_forward");
export const ArrowUp = materialIcon("arrow_upward");
export const ArrowUpDown = materialIcon("swap_vert");
export const ArrowUpRight = materialIcon("north_east");
export const Award = materialIcon("workspace_premium");
export const BadgeCheck = materialIcon("verified");
export const BadgeIndianRupee = materialIcon("paid");
export const Ban = materialIcon("block");
export const BarChart3 = materialIcon("bar_chart");
export const Bed = materialIcon("bed");
export const BedDouble = materialIcon("king_bed");
export const Bell = materialIcon("notifications");
export const Bike = materialIcon("directions_bike");
export const BookOpen = materialIcon("menu_book");
export const Bookmark = materialIcon("bookmark");
export const Briefcase = materialIcon("business_center");
export const BriefcaseBusiness = materialIcon("business_center");
export const Building = materialIcon("apartment");
export const Building2 = materialIcon("domain");
export const Bus = materialIcon("directions_bus");
export const Calculator = materialIcon("calculate");
export const Calendar = materialIcon("calendar_month");
export const CalendarCheck = materialIcon("event_available");
export const CalendarClock = materialIcon("event_upcoming");
export const CalendarDays = materialIcon("date_range");
export const Camera = materialIcon("photo_camera");
export const Car = materialIcon("directions_car");
export const CarFront = materialIcon("directions_car");
export const Check = materialIcon("check");
export const CheckCheck = materialIcon("done_all");
export const CheckCircle = materialIcon("check_circle");
export const CheckCircle2 = materialIcon("check_circle");
export const ChevronDown = materialIcon("expand_more");
export const ChevronLeft = materialIcon("chevron_left");
export const ChevronRight = materialIcon("chevron_right");
export const ChevronUp = materialIcon("expand_less");
export const CircleCheck = materialIcon("check_circle");
export const CircleParking = materialIcon("local_parking");
export const ClipboardCheck = materialIcon("assignment_turned_in");
export const ClipboardList = materialIcon("assignment");
export const Clock = materialIcon("schedule");
export const Clock3 = materialIcon("schedule");
export const Compass = materialIcon("explore");
export const ContactRound = materialIcon("contacts");
export const Copy = materialIcon("content_copy");
export const CornerDownLeft = materialIcon("keyboard_return");
export const Cpu = materialIcon("memory");
export const CreditCard = materialIcon("credit_card");
export const Crosshair = materialIcon("my_location");
export const DollarSign = materialIcon("attach_money");
export const Download = materialIcon("download");
export const Droplets = materialIcon("water_drop");
export const Edit = materialIcon("edit");
export const Edit2 = materialIcon("edit");
export const Edit3 = materialIcon("edit_note");
export const ExternalLink = materialIcon("open_in_new");
export const Eye = materialIcon("visibility");
export const EyeOff = materialIcon("visibility_off");
export const FileCheck = materialIcon("task");
export const FileText = materialIcon("description");
export const Filter = materialIcon("filter_alt");
export const Flame = materialIcon("local_fire_department");
export const Gauge = materialIcon("speed");
export const Gift = materialIcon("redeem");
export const GlassWater = materialIcon("local_drink");
export const Globe = materialIcon("language");
export const GripVertical = materialIcon("drag_indicator");
export const HandHeart = materialIcon("volunteer_activism");
export const Headphones = materialIcon("headset_mic");
export const Heart = materialIcon("favorite");
export const HeartHandshake = materialIcon("handshake");
export const HeartPulse = materialIcon("cardiology");
export const HelpCircle = materialIcon("help");
export const History = materialIcon("history");
export const Home = materialIcon("home");
export const Image = materialIcon("image");
export const ImagePlus = materialIcon("add_photo_alternate");
export const Inbox = materialIcon("inbox");
export const IndianRupee = materialIcon("currency_rupee");
export const Info = materialIcon("info");
export const Key = materialIcon("key");
export const KeyRound = materialIcon("key");
export const Landmark = materialIcon("account_balance");
export const Layers = materialIcon("layers");
export const LayoutDashboard = materialIcon("dashboard");
export const LayoutGrid = materialIcon("grid_view");
export const LifeBuoy = materialIcon("support");
export const Link = materialIcon("link");
export const Loader2 = materialIcon("progress_activity");
export const Lock = materialIcon("lock");
export const LogIn = materialIcon("login");
export const LogOut = materialIcon("logout");
export const Mail = materialIcon("mail");
export const Map = materialIcon("map");
export const MapPin = materialIcon("location_on");
export const MapPinned = materialIcon("pin_drop");
export const Mountain = materialIcon("landscape");
export const Maximize2 = materialIcon("open_in_full");
export const Menu = materialIcon("menu");
export const MessageSquare = materialIcon("chat");
export const MessageSquareQuote = materialIcon("format_quote");
export const Minus = materialIcon("remove");
export const Moon = materialIcon("dark_mode");
export const Music = materialIcon("music_note");
export const Navigation = materialIcon("navigation");
export const Newspaper = materialIcon("newspaper");
export const Package = materialIcon("package_2");
export const PartyPopper = materialIcon("celebration");
export const PackageSearch = materialIcon("inventory_2");
export const ParkingCircle = materialIcon("local_parking");
export const PauseCircle = materialIcon("pause_circle");
export const Pencil = materialIcon("edit");
export const Percent = materialIcon("percent");
export const Phone = materialIcon("phone");
export const PhoneCall = materialIcon("call");
export const Play = materialIcon("play_arrow");
export const Plus = materialIcon("add");
export const Power = materialIcon("power_settings_new");
export const Printer = materialIcon("print");
export const QrCode = materialIcon("qr_code_2");
export const Radio = materialIcon("sensors");
export const Route = materialIcon("route");
export const RefreshCw = materialIcon("refresh");
export const RotateCcw = materialIcon("restart_alt");
export const Save = materialIcon("save");
export const ScanLine = materialIcon("document_scanner");
export const ScrollText = materialIcon("receipt_long");
export const Search = materialIcon("search");
export const Send = materialIcon("send");
export const Settings = materialIcon("settings");
export const Share2 = materialIcon("share");
export const Shield = materialIcon("shield");
export const ShieldAlert = materialIcon("gpp_maybe");
export const ShieldCheck = materialIcon("verified_user");
export const Shirt = materialIcon("checkroom");
export const ShoppingBag = materialIcon("shopping_bag");
export const Sliders = materialIcon("tune");
export const SlidersHorizontal = materialIcon("tune");
export const Smartphone = materialIcon("smartphone");
export const Sofa = materialIcon("chair");
export const Sparkles = materialIcon("auto_awesome");
export const Star = materialIcon("star");
export const Sun = materialIcon("light_mode");
export const Table2 = materialIcon("table");
export const Tag = materialIcon("sell");
export const Target = materialIcon("target");
export const ThumbsUp = materialIcon("thumb_up");
export const Ticket = materialIcon("confirmation_number");
export const ToggleLeft = materialIcon("toggle_off");
export const ToggleRight = materialIcon("toggle_on");
export const Trash2 = materialIcon("delete");
export const TrendingUp = materialIcon("trending_up");
export const TriangleAlert = materialIcon("warning");
export const Truck = materialIcon("local_shipping");
export const Umbrella = materialIcon("umbrella");
export const Undo2 = materialIcon("undo");
export const Upload = materialIcon("upload");
export const UploadCloud = materialIcon("cloud_upload");
export const User = materialIcon("person");
export const UserCheck = materialIcon("how_to_reg");
export const UserPlus = materialIcon("person_add");
export const UserX = materialIcon("person_remove");
export const Users = materialIcon("group");
export const Utensils = materialIcon("restaurant");
export const UtensilsCrossed = materialIcon("restaurant_menu");
export const Video = materialIcon("videocam");
export const Volume2 = materialIcon("volume_up");
export const Wallet = materialIcon("account_balance_wallet");
export const WalletCards = materialIcon("wallet");
export const Wifi = materialIcon("wifi");
export const Wrench = materialIcon("build");
export const X = materialIcon("close");
export const XCircle = materialIcon("cancel");
export const Zap = materialIcon("bolt");
