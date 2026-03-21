export interface DeliveryEstimateInput {
  processingDays: number;
  cutoffTime: string; // HH:mm
  timezone: string;
  skipWeekends: boolean;
  transitDaysMin: number;
  transitDaysMax: number;
  carrier: string;
  excludedDates: Array<{ date: string; recurring: boolean }>;
  now?: Date; // injectable for testing
}

export interface DeliveryEstimate {
  estimatedDate: string; // ISO date
  rangeStart: string;
  rangeEnd: string;
  carrier: string;
  confidence: "exact" | "range";
  processingDays: number;
  transitDaysMin: number;
  transitDaysMax: number;
}

export function calculateDeliveryEstimate(
  input: DeliveryEstimateInput
): DeliveryEstimate {
  const now = input.now ?? new Date();

  // Determine if order is before or after cutoff
  const shopNow = getTimeInTimezone(now, input.timezone);
  const [cutoffHour, cutoffMinute] = input.cutoffTime.split(":").map(Number);
  const isAfterCutoff =
    shopNow.hours > cutoffHour ||
    (shopNow.hours === cutoffHour && shopNow.minutes >= cutoffMinute);

  // Start date: today if before cutoff, tomorrow if after
  let currentDate = new Date(now);
  if (isAfterCutoff) {
    currentDate = addDays(currentDate, 1);
  }

  // Add processing days (skip weekends and excluded dates)
  currentDate = addBusinessDays(
    currentDate,
    input.processingDays,
    input.skipWeekends,
    input.excludedDates
  );

  // Calculate range start (min transit) and range end (max transit)
  const rangeStart = addBusinessDays(
    currentDate,
    input.transitDaysMin,
    input.skipWeekends,
    input.excludedDates
  );
  const rangeEnd = addBusinessDays(
    currentDate,
    input.transitDaysMax,
    input.skipWeekends,
    input.excludedDates
  );

  const isExact = input.transitDaysMin === input.transitDaysMax;

  return {
    estimatedDate: formatDate(isExact ? rangeStart : rangeEnd),
    rangeStart: formatDate(rangeStart),
    rangeEnd: formatDate(rangeEnd),
    carrier: input.carrier,
    confidence: isExact ? "exact" : "range",
    processingDays: input.processingDays,
    transitDaysMin: input.transitDaysMin,
    transitDaysMax: input.transitDaysMax,
  };
}

export function addBusinessDays(
  startDate: Date,
  days: number,
  skipWeekends: boolean,
  excludedDates: Array<{ date: string; recurring: boolean }>
): Date {
  let current = new Date(startDate);
  let remaining = days;

  while (remaining > 0) {
    current = addDays(current, 1);

    if (skipWeekends && isWeekend(current)) {
      continue;
    }

    if (isExcludedDate(current, excludedDates)) {
      continue;
    }

    remaining--;
  }

  return current;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isExcludedDate(
  date: Date,
  excludedDates: Array<{ date: string; recurring: boolean }>
): boolean {
  const dateStr = formatDate(date);

  return excludedDates.some((excluded) => {
    if (excluded.recurring) {
      // Compare month-day only for recurring dates
      return dateStr.slice(5) === excluded.date.slice(5);
    }
    return dateStr === excluded.date;
  });
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getTimeInTimezone(
  date: Date,
  timezone: string
): { hours: number; minutes: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hours = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minutes = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { hours, minutes };
}
