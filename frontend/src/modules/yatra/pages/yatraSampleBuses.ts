/**
 * Sample buses for the Yatra search page, shown only while Yatra has no real departure at all, so the page
 * is not bare at launch. They live in the page and never in the database: nobody can book them, no payment
 * or ledger row can come from them, and they disappear the moment the first real partner opens a departure.
 *
 * They deliberately carry no ratings, no "years in business" and no verified wording, because none of that
 * is true for a sample. The page labels every one of them "Sample" and "Not available".
 */
export const SAMPLE_ORIGINS = ["Delhi"];
export const SAMPLE_DESTINATIONS = ["Ayodhya", "Vrindavan"];

const IST_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

const ROUTES = [
  { destination: "Ayodhya", fare: 899, drops: ["Ayodhya Dham Bus Stand", "Saket Degree College", "Ram Path"] },
  { destination: "Vrindavan", fare: 649, drops: ["Vrindavan Bus Stand", "Mathura Junction"] },
];

const BOARDING = ["Kashmere Gate ISBT", "Sarai Kale Khan", "Anand Vihar ISBT"];

interface SampleOperator {
  name: string;
  make: string;
  model: string;
  isAc: boolean;
  seatKinds: Array<"sleeper" | "seater">;
  decks: 1 | 2;
  amenities: string[];
  multiplier: number;
  wholeBus: boolean;
  /** [days from today, hour, minute, route index] of each departure, in Indian time. */
  departures: Array<[number, number, number, number]>;
}

const OPERATORS: SampleOperator[] = [
  { name: "Sample Travels", make: "Volvo", model: "9600 Sleeper", isAc: true, seatKinds: ["sleeper"], decks: 2, amenities: ["Charging point", "Blanket", "Water bottle", "Reading light"], multiplier: 1.45, wholeBus: true, departures: [[0, 21, 30, 0], [1, 22, 0, 0], [2, 20, 45, 1]] },
  { name: "Sample Tours", make: "Bharat Benz", model: "Executive", isAc: true, seatKinds: ["seater"], decks: 1, amenities: ["Toilet", "Charging point", "WiFi", "Water bottle"], multiplier: 1.1, wholeBus: false, departures: [[0, 22, 30, 0], [1, 6, 0, 1], [1, 23, 0, 0]] },
  { name: "Sample Holidays", make: "Ashok Leyland", model: "Non-AC Seater", isAc: false, seatKinds: ["seater"], decks: 1, amenities: ["Water bottle"], multiplier: 0.8, wholeBus: true, departures: [[0, 5, 30, 0], [0, 19, 0, 1], [2, 5, 30, 0]] },
  { name: "Sample Express", make: "Scania", model: "Metrolink Sleeper", isAc: true, seatKinds: ["sleeper"], decks: 1, amenities: ["Blanket", "Charging point", "CCTV", "Toilet"], multiplier: 1.3, wholeBus: false, departures: [[0, 23, 15, 0], [1, 21, 0, 1], [2, 22, 30, 0]] },
  { name: "Sample Yatra Co", make: "Mercedes", model: "Semi-sleeper", isAc: true, seatKinds: ["seater"], decks: 1, amenities: ["Charging point", "Water bottle", "Lounge"], multiplier: 1.2, wholeBus: true, departures: [[0, 20, 0, 0], [1, 20, 30, 1]] },
];

/** Sample departures shaped like the search results, dated from tomorrow on. Never sent to or read from the server. */
export const sampleBuses = (now = Date.now()): any[] => {
  const midnight = Math.floor((now + IST_MS) / DAY_MS) * DAY_MS - IST_MS;
  const rows: any[] = [];
  OPERATORS.forEach((op, operatorIndex) => {
    op.departures.forEach(([day, hour, minute, routeIndex], i) => {
      const route = ROUTES[routeIndex];
      const departAt = new Date(midnight + (day + 1) * DAY_MS + hour * 3_600_000 + minute * 60_000);
      const fare = Math.round((route.fare * op.multiplier) / 10) * 10;
      rows.push({
        departureCode: `SAMPLE-${operatorIndex + 1}-${i + 1}`,
        sample: true,
        departAt: departAt.toISOString(),
        returnAt: new Date(departAt.getTime() + 40 * 3_600_000).toISOString(),
        fare,
        fromFare: fare,
        tour: { originCity: "Delhi", destinationCity: route.destination, durationDays: 2 },
        operator: { name: op.name },
        vehicle: { make: op.make, model: op.model, isAc: op.isAc, seatKinds: op.seatKinds, decks: op.decks, amenities: op.amenities, vehicleType: "bus" },
        boardingPoints: BOARDING.map((name) => ({ name })),
        droppingPoints: route.drops.map((name) => ({ name })),
        charterEnabled: op.wholeBus,
        restStopCount: 1,
      });
    });
  });
  return rows;
};
