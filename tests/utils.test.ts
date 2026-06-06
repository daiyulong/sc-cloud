import { describe, expect, it } from "vitest"
import { compareDateOnly, toDateString } from "@/lib/utils"

describe("date utilities", () => {
  it("formats local date without UTC truncation", () => {
    expect(toDateString(new Date(2026, 4, 9, 14, 58))).toBe("2026-05-09")
  })

  it("compares by natural day", () => {
    expect(
      compareDateOnly(
        new Date(2026, 4, 9, 23, 59),
        new Date(2026, 4, 9, 0, 1)
      )
    ).toBe(0)
  })
})
