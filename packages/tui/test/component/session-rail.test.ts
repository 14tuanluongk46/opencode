import { describe, expect, test } from "bun:test"
import { groupLabel } from "../../src/component/session-rail"

describe("session rail", () => {
  test("groups sessions by recency", () => {
    const startOfToday = new Date().setHours(0, 0, 0, 0)
    const hour = 60 * 60 * 1000
    expect(groupLabel(startOfToday)).toBe("Today")
    expect(groupLabel(startOfToday - 12 * hour)).toBe("Yesterday")
    expect(groupLabel(startOfToday - 3 * 24 * hour)).toBe("7 days")
    expect(groupLabel(startOfToday - 30 * 24 * hour)).toBe("Older")
  })
})
