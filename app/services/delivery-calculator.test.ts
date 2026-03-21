import { describe, it, expect } from "vitest";
import {
  calculateDeliveryEstimate,
  addBusinessDays,
  isWeekend,
  isExcludedDate,
  type DeliveryEstimateInput,
} from "./delivery-calculator";

function makeInput(overrides: Partial<DeliveryEstimateInput> = {}): DeliveryEstimateInput {
  return {
    processingDays: 1,
    cutoffTime: "14:00",
    timezone: "UTC",
    skipWeekends: true,
    transitDaysMin: 2,
    transitDaysMax: 4,
    carrier: "usps_priority",
    excludedDates: [],
    now: new Date("2026-03-16T10:00:00Z"), // Monday 10am UTC
    ...overrides,
  };
}

describe("isWeekend", () => {
  it("returns true for Saturday", () => {
    expect(isWeekend(new Date("2026-03-21"))).toBe(true); // Saturday
  });

  it("returns true for Sunday", () => {
    expect(isWeekend(new Date("2026-03-22"))).toBe(true); // Sunday
  });

  it("returns false for weekdays", () => {
    expect(isWeekend(new Date("2026-03-16"))).toBe(false); // Monday
    expect(isWeekend(new Date("2026-03-18"))).toBe(false); // Wednesday
    expect(isWeekend(new Date("2026-03-20"))).toBe(false); // Friday
  });
});

describe("isExcludedDate", () => {
  it("matches exact date", () => {
    expect(
      isExcludedDate(new Date("2026-12-25"), [
        { date: "2026-12-25", recurring: false },
      ])
    ).toBe(true);
  });

  it("matches recurring date across years", () => {
    expect(
      isExcludedDate(new Date("2027-12-25"), [
        { date: "2026-12-25", recurring: true },
      ])
    ).toBe(true);
  });

  it("does not match non-recurring date in different year", () => {
    expect(
      isExcludedDate(new Date("2027-12-25"), [
        { date: "2026-12-25", recurring: false },
      ])
    ).toBe(false);
  });
});

describe("addBusinessDays", () => {
  it("skips weekends when configured", () => {
    // Monday March 16 + 5 business days = Monday March 23
    const result = addBusinessDays(new Date("2026-03-16"), 5, true, []);
    expect(result.toISOString().split("T")[0]).toBe("2026-03-23");
  });

  it("does not skip weekends when not configured", () => {
    // Monday March 16 + 5 calendar days = Saturday March 21
    const result = addBusinessDays(new Date("2026-03-16"), 5, false, []);
    expect(result.toISOString().split("T")[0]).toBe("2026-03-21");
  });

  it("skips excluded dates", () => {
    // Monday March 16 + 1 day, but March 17 is excluded = March 18
    const result = addBusinessDays(new Date("2026-03-16"), 1, true, [
      { date: "2026-03-17", recurring: false },
    ]);
    expect(result.toISOString().split("T")[0]).toBe("2026-03-18");
  });
});

describe("calculateDeliveryEstimate", () => {
  it("calculates exact estimate when min === max transit", () => {
    const input = makeInput({ transitDaysMin: 3, transitDaysMax: 3 });
    const result = calculateDeliveryEstimate(input);

    expect(result.confidence).toBe("exact");
    expect(result.rangeStart).toBe(result.rangeEnd);
    expect(result.carrier).toBe("usps_priority");
  });

  it("calculates range estimate when min !== max transit", () => {
    const input = makeInput({ transitDaysMin: 2, transitDaysMax: 5 });
    const result = calculateDeliveryEstimate(input);

    expect(result.confidence).toBe("range");
    expect(result.rangeStart).not.toBe(result.rangeEnd);
  });

  it("adds extra day when order is after cutoff", () => {
    const beforeCutoff = calculateDeliveryEstimate(
      makeInput({ now: new Date("2026-03-16T10:00:00Z") })
    );
    const afterCutoff = calculateDeliveryEstimate(
      makeInput({ now: new Date("2026-03-16T15:00:00Z") })
    );

    // After cutoff should result in a later delivery date
    expect(new Date(afterCutoff.rangeStart).getTime()).toBeGreaterThan(
      new Date(beforeCutoff.rangeStart).getTime()
    );
  });

  it("handles zero processing days", () => {
    const input = makeInput({ processingDays: 0, transitDaysMin: 1, transitDaysMax: 1 });
    const result = calculateDeliveryEstimate(input);

    // With 0 processing + 1 transit from Monday = Tuesday March 17
    expect(result.estimatedDate).toBe("2026-03-17");
  });

  it("respects excluded dates in calculation", () => {
    const withoutExclusion = calculateDeliveryEstimate(makeInput());
    const withExclusion = calculateDeliveryEstimate(
      makeInput({
        excludedDates: [{ date: "2026-03-17", recurring: false }],
      })
    );

    // Excluded date should push estimate later
    expect(new Date(withExclusion.rangeStart).getTime()).toBeGreaterThan(
      new Date(withoutExclusion.rangeStart).getTime()
    );
  });
});
