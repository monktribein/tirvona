import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Search, Users } from "lucide-react";
import { bookingService } from "../services";
import { getErrorMessage } from "../lib/api";
import { useNotifications } from "../contexts/NotificationContext";

interface RelatedRecord {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
}

interface BookingRecord {
  _id: string;
  customerId?: RelatedRecord | string;
  ashramId?: RelatedRecord | string;
  checkInDate?: string;
  checkOutDate?: string;
  guestsCount?: number;
  numberOfGuests?: number;
  status?: string;
}

interface GuestSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  bookingCount: number;
  guestCount: number;
  latestStay?: string;
  latestStatus: string;
  ashrams: Map<string, string>;
}

const readableStatus = (value: string) =>
  value.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());

export const OwnerGuestsPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedAshram, setSelectedAshram] = useState("all");

  useEffect(() => {
    const loadGuests = async () => {
      setLoading(true);
      try {
        const scopedBookings: BookingRecord[] = [];
        let page = 1;
        let batch: BookingRecord[] = [];
        do {
          const response = await bookingService.dashboard({
            limit: "100",
            page: String(page),
          });
          batch = response.data?.success ? response.data.data || [] : [];
          scopedBookings.push(...batch);
          page += 1;
        } while (batch.length === 100);
        setBookings(scopedBookings);
      } catch (error) {
        setBookings([]);
        addNotification(
          "Guests Unavailable",
          getErrorMessage(error, "Could not load your ashram guests."),
          "error",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadGuests();
  }, []);

  const ashramOptions = useMemo(() => {
    const options = new Map<string, string>();
    bookings.forEach((booking) => {
      if (typeof booking.ashramId === "object" && booking.ashramId?._id) {
        options.set(booking.ashramId._id, booking.ashramId.name || "Ashram");
      }
    });
    return [...options.entries()];
  }, [bookings]);

  const guests = useMemo(() => {
    const grouped = new Map<string, GuestSummary>();

    bookings.forEach((booking) => {
      const customer =
        typeof booking.customerId === "object" ? booking.customerId : undefined;
      if (!customer?._id) return;

      const ashram =
        typeof booking.ashramId === "object" ? booking.ashramId : undefined;
      if (selectedAshram !== "all" && ashram?._id !== selectedAshram) return;

      const current = grouped.get(customer._id) || {
        id: customer._id,
        name: customer.name || "Guest",
        email: customer.email || "",
        phone: customer.phone || "",
        bookingCount: 0,
        guestCount: 0,
        latestStatus: "pending",
        ashrams: new Map<string, string>(),
      };

      current.bookingCount += 1;
      current.guestCount += Number(
        booking.guestsCount ?? booking.numberOfGuests ?? 1,
      );
      if (ashram?._id) current.ashrams.set(ashram._id, ashram.name || "Ashram");

      const stayDate = booking.checkInDate || booking.checkOutDate;
      if (
        stayDate &&
        (!current.latestStay || new Date(stayDate) > new Date(current.latestStay))
      ) {
        current.latestStay = stayDate;
        current.latestStatus = booking.status || "pending";
      }
      grouped.set(customer._id, current);
    });

    const term = search.trim().toLowerCase();
    return [...grouped.values()].filter((guest) =>
      !term
        ? true
        : [guest.name, guest.email, guest.phone, ...guest.ashrams.values()].some(
            (value) => value.toLowerCase().includes(term),
          ),
    );
  }, [bookings, search, selectedAshram]);

  return (
    <div className="space-y-6 text-left w-full">
      <div className="flex flex-wrap justify-between items-start sm:items-center gap-4 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 sm:p-6 rounded-[24px] shadow-sm">
        <div>
          <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white flex items-center gap-2">
            <Users size={18} className="text-[#0A4DA6]" /> Users &amp; Guests
          </h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">
            Guests with bookings at your assigned ashrams only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <label className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search guest or contact"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-xs focus:outline-none focus:border-[#0A4DA6]"
            />
          </label>
          {ashramOptions.length > 1 && (
            <select
              value={selectedAshram}
              onChange={(event) => setSelectedAshram(event.target.value)}
              className="px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-xs font-semibold focus:outline-none"
            >
              <option value="all">All my ashrams</option>
              {ashramOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-40 bg-gray-50 border border-gray-100 rounded-[24px] animate-pulse" />
      ) : guests.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px]">
          <Users className="mx-auto text-gray-300" size={32} />
          <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white mt-3">No matching guests</h4>
          <p className="text-xs text-gray-400 mt-1">Guests appear here after they book one of your ashrams.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50 dark:bg-slate-900 text-gray-400 text-[10px] tracking-wider">
                <tr><th className="py-4 px-6">Guest</th><th className="py-4 px-6">Contact</th><th className="py-4 px-6">Ashram</th><th className="py-4 px-6">Reservations</th><th className="py-4 px-6">Latest Stay</th><th className="py-4 px-6">Status</th></tr>
              </thead>
              <tbody>
                {guests.map((guest) => (
                  <tr key={guest.id} className="border-t border-gray-50 dark:border-slate-800 hover:bg-gray-50/30">
                    <td className="py-4 px-6 font-bold text-[#0B192C] dark:text-white">{guest.name}</td>
                    <td className="py-4 px-6 text-gray-500"><div>{guest.email || "—"}</div><div className="text-[10px] text-gray-400">{guest.phone || "—"}</div></td>
                    <td className="py-4 px-6 text-gray-500">{[...guest.ashrams.values()].join(", ") || "—"}</td>
                    <td className="py-4 px-6"><span className="font-bold text-[#0A4DA6]">{guest.bookingCount}</span><span className="text-gray-400"> / {guest.guestCount} traveller(s)</span></td>
                    <td className="py-4 px-6 text-gray-500"><span className="inline-flex items-center gap-1"><CalendarDays size={13} />{guest.latestStay ? new Date(guest.latestStay).toLocaleDateString() : "—"}</span></td>
                    <td className="py-4 px-6"><span className="px-2.5 py-1 bg-[#0A4DA6]/10 text-[#0A4DA6] rounded-full text-[9px] font-bold">{readableStatus(guest.latestStatus)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerGuestsPage;
