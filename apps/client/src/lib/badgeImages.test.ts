import { describe, expect, it } from "vitest";
import type { Badge } from "@/types";
import { getBadgeImagePath } from "./badgeImages";

const badge = (overrides: Partial<Badge> = {}): Badge => ({
  id: "badge-1",
  code: "first-book",
  title: "First Book",
  description: null,
  icon_url: null,
  icon_key: "book",
  category: "completion",
  tier: 1,
  rarity: "common",
  metric_key: "books_completed",
  target_value: 1,
  event_types: [],
  sort_order: 1,
  is_active: true,
  is_secret: false,
  created_at: "2026-08-11T00:00:00Z",
  ...overrides,
});

describe("badge image paths", () => {
  it("maps local badges to their single optimized image", () => {
    expect(getBadgeImagePath(badge())).toBe(
      "/achievement-badges/achievement_first_book.webp",
    );
  });

  it("keeps remote badge artwork as a safe source", () => {
    const source = getBadgeImagePath(badge({
      code: "remote-badge",
      title: "Remote badge",
      icon_url: "https://cdn.example.com/badge.png",
    }));

    expect(source).toBe("https://cdn.example.com/badge.png");
  });

  it("does not reveal secret badge art before it is earned", () => {
    expect(getBadgeImagePath(badge({ is_secret: true }))).toBeNull();
    expect(getBadgeImagePath(badge({
      is_secret: true,
      earned_at: "2026-08-11T12:00:00Z",
    }))).not.toBeNull();
  });
});
