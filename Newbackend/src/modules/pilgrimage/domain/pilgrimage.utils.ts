const randomSuffix = (): string =>
  Math.random().toString(36).replace(/[^a-z0-9]/g, "").slice(0, 4).padEnd(4, "0");

export const circuitSlug = (name: string, startCity = ""): string =>
  `${
    [name, startCity]
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "circuit"
  }-${randomSuffix()}`;

export const addDays = (date: Date | string, days: number): Date =>
  new Date(new Date(date).getTime() + days * 86_400_000);

/**
 * Groups a circuit's stops into the day buckets the author assigned, filling in
 * any day that has no stops so a 7-day circuit always renders 7 days rather
 * than silently collapsing to the days that happen to be populated.
 */
export const groupStopsByDay = <T extends { dayNumber?: number; order?: number }>(
  stops: T[],
  durationDays: number,
): { dayNumber: number; stops: T[] }[] => {
  const days: { dayNumber: number; stops: T[] }[] = [];
  for (let day = 1; day <= Math.max(1, durationDays); day += 1) {
    days.push({
      dayNumber: day,
      stops: stops
        .filter((stop) => Number(stop.dayNumber ?? 1) === day)
        .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0)),
    });
  }
  return days;
};

export const totalDistance = (
  stops: { distanceFromPreviousKm?: number }[],
): number =>
  Math.round(
    stops.reduce((sum, stop) => sum + Number(stop.distanceFromPreviousKm ?? 0), 0),
  );
