import { describe, expect, it } from "vitest";
import { BRACK_WEB_ORIGIN } from "./platform";
import { deepLinkService } from "./deepLinkService";

describe("deepLinkService", () => {
  it("parses canonical web and custom-scheme content links", () => {
    expect(deepLinkService.parseDeepLink(`${BRACK_WEB_ORIGIN}/book/book-1`)).toEqual({
      type: "book",
      id: "book-1",
      conversationId: undefined,
    });
    expect(
      deepLinkService.parseDeepLink("brack://message/message-1?conversationId=thread-1"),
    ).toEqual({
      type: "message",
      id: "message-1",
      conversationId: "thread-1",
    });
  });

  it.each([
    "https://brack.app/book/book-1",
    "https://brack-app.com.evil.example/book/book-1",
    "https://brack-app.com@evil.example/book/book-1",
    "http://brack-app.com/book/book-1",
    "reader://book/book-1",
  ])("rejects an untrusted deep link: %s", (url) => {
    expect(deepLinkService.parseDeepLink(url)).toBeNull();
  });

  it("generates canonical share links", () => {
    expect(deepLinkService.generateWebDeepLink({ type: "club", id: "club-1" })).toBe(
      `${BRACK_WEB_ORIGIN}/club/club-1`,
    );
  });
});
