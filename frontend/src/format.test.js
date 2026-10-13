import { describe, expect, it } from "vitest";
import { fmtDate, fmtNum, fmtSize, initials } from "./format";

describe("format helpers", () => {
  it("formats ISO dates without timezone drift", () => {
    expect(fmtDate("2026-10-13")).toBe("13 Oct");
    expect(fmtDate("2026-11-06", true)).toBe("6 Nov 2026");
  });
  it("formats numbers and sizes", () => {
    expect(fmtNum(90.25)).toBe("90.3");
    expect(fmtNum(120)).toBe("120");
    expect(fmtSize(2048)).toBe("2 KB");
  });
  it("builds initials", () => expect(initials("Achieng Otieno")).toBe("AO"));
});
