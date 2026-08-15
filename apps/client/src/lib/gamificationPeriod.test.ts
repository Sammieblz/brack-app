import { describe, expect, it } from "vitest";
import { getInclusivePeriodEndMs } from "./gamificationPeriod";

describe("inclusive gamification period boundaries", () => {
  it("keeps a date-only daily quest active through the user's local day", () => {
    expect(getInclusivePeriodEndMs("2026-08-11", "America/New_York"))
      .toBe(Date.parse("2026-08-12T04:00:00.000Z"));
  });

  it("uses the offset in effect at the following midnight across DST", () => {
    expect(getInclusivePeriodEndMs("2026-03-08", "America/New_York"))
      .toBe(Date.parse("2026-03-09T04:00:00.000Z"));
    expect(getInclusivePeriodEndMs("2026-11-01", "America/New_York"))
      .toBe(Date.parse("2026-11-02T05:00:00.000Z"));
  });

  it("preserves timestamp-shaped period boundaries", () => {
    expect(getInclusivePeriodEndMs("2026-08-11T18:30:00.000Z", "America/New_York"))
      .toBe(Date.parse("2026-08-11T18:30:00.000Z"));
  });

  it("rejects invalid dates and timezones", () => {
    expect(getInclusivePeriodEndMs("2026-02-30", "America/New_York")).toBeNaN();
    expect(getInclusivePeriodEndMs("2026-08-11", "Not/AZone")).toBeNaN();
  });
});
