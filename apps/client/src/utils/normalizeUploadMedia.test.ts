import { describe, expect, it, vi } from "vitest";
import {
  calculateBoundedImageDimensions,
  normalizeUploadMedia,
  replaceFileExtension,
  type ImageNormalizationAdapter,
} from "./normalizeUploadMedia";

const createAdapter = (
  overrides: Partial<ImageNormalizationAdapter> = {},
): ImageNormalizationAdapter => ({
  createObjectUrl: vi.fn(() => "blob:upload-test"),
  revokeObjectUrl: vi.fn(),
  decodeImage: vi.fn(async () => ({
    source: {} as CanvasImageSource,
    width: 4000,
    height: 2000,
  })),
  encodeImage: vi.fn(async ({ mimeType }) =>
    new Blob(["optimized-image-without-source-metadata"], { type: mimeType })
  ),
  ...overrides,
});

const fourCc = (value: string): number[] => [...value].map((character) => character.charCodeAt(0));

const animatedPngBytes = () => new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 8,
  ...fourCc("acTL"),
  0, 0, 0, 2,
  0, 0, 0, 0,
  0, 0, 0, 0,
]);

const animatedWebpBytes = () => new Uint8Array([
  ...fourCc("RIFF"),
  4, 0, 0, 0,
  ...fourCc("WEBP"),
  ...fourCc("ANIM"),
  0, 0, 0, 0,
]);

describe("calculateBoundedImageDimensions", () => {
  it("bounds the long edge without changing the aspect ratio", () => {
    expect(calculateBoundedImageDimensions(4000, 2000, 2560)).toEqual({
      width: 2560,
      height: 1280,
    });
  });

  it("does not enlarge smaller images", () => {
    expect(calculateBoundedImageDimensions(640, 480, 2560)).toEqual({
      width: 640,
      height: 480,
    });
  });
});

describe("replaceFileExtension", () => {
  it("replaces only the final file extension", () => {
    expect(replaceFileExtension("reader.photos/cover.final.png", "webp")).toBe(
      "reader.photos/cover.final.webp",
    );
  });
});

describe("normalizeUploadMedia", () => {
  it.each([
    ["animated.gif", "image/gif"],
    ["clip.mp4", "video/mp4"],
    ["photo.heic", "image/heic"],
  ])("preserves %s byte-for-byte", async (name, mimeType) => {
    const input = new File(["original"], name, { type: mimeType });
    const adapter = createAdapter();

    const result = await normalizeUploadMedia(
      input,
      { outputMimeType: "image/webp" },
      adapter,
    );

    expect(result.body).toBe(input);
    expect(result.fileName).toBe(name);
    expect(result.mimeType).toBe(mimeType);
    expect(result.normalized).toBe(false);
    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
    expect(adapter.createObjectUrl).not.toHaveBeenCalled();
    expect(adapter.encodeImage).not.toHaveBeenCalled();
  });

  it.each([
    ["animated.png", "image/png", animatedPngBytes],
    ["animated.webp", "image/webp", animatedWebpBytes],
  ])("preserves container-level animation in %s", async (name, mimeType, bytes) => {
    const input = new File([bytes()], name, { type: mimeType });
    const adapter = createAdapter();

    const result = await normalizeUploadMedia(
      input,
      { outputMimeType: "image/webp" },
      adapter,
    );

    expect(result.body).toBe(input);
    expect(result.normalized).toBe(false);
    expect(adapter.createObjectUrl).not.toHaveBeenCalled();
    expect(adapter.encodeImage).not.toHaveBeenCalled();
  });

  it("bounds and re-encodes a still image with matching MIME, extension, and metadata", async () => {
    const input = new File(["jpeg-with-exif-and-gps"], "holiday.JPG", {
      type: "image/jpeg",
    });
    const adapter = createAdapter();

    const result = await normalizeUploadMedia(
      input,
      { maxDimension: 2560, outputMimeType: "image/webp", quality: 0.8 },
      adapter,
    );

    expect(result.body).not.toBe(input);
    expect(result.body.size).toBe("optimized-image-without-source-metadata".length);
    expect(result).toMatchObject({
      fileName: "holiday.webp",
      mimeType: "image/webp",
      sizeBytes: result.body.size,
      width: 2560,
      height: 1280,
      normalized: true,
    });
    expect(adapter.encodeImage).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 2560,
        height: 1280,
        mimeType: "image/webp",
        quality: 0.8,
      }),
    );
    expect(adapter.revokeObjectUrl).toHaveBeenCalledWith("blob:upload-test");
  });

  it("can strip metadata while preserving a legacy PNG contract", async () => {
    const input = new File(["png-with-metadata"], "journal.png", {
      type: "image/png",
    });
    const adapter = createAdapter({
      decodeImage: vi.fn(async () => ({
        source: {} as CanvasImageSource,
        width: 800,
        height: 1200,
      })),
    });

    const result = await normalizeUploadMedia(
      input,
      { outputMimeType: "preserve" },
      adapter,
    );

    expect(result).toMatchObject({
      fileName: "journal.png",
      mimeType: "image/png",
      width: 800,
      height: 1200,
      normalized: true,
    });
  });

  it("fails clearly and revokes the object URL when a device returns the wrong encoding", async () => {
    const input = new File(["source"], "avatar.png", { type: "image/png" });
    const adapter = createAdapter({
      encodeImage: vi.fn(async () => new Blob(["fallback"], { type: "image/png" })),
    });

    await expect(
      normalizeUploadMedia(
        input,
        { outputMimeType: "image/webp" },
        adapter,
      ),
    ).rejects.toThrow(
      "Could not optimize avatar.png: This device could not encode image/webp images",
    );
    expect(adapter.revokeObjectUrl).toHaveBeenCalledWith("blob:upload-test");
  });

  it("revokes the object URL when decoding fails", async () => {
    const input = new File(["source"], "broken.jpg", { type: "image/jpeg" });
    const adapter = createAdapter({
      decodeImage: vi.fn(async () => {
        throw new Error("decode failed");
      }),
    });

    await expect(normalizeUploadMedia(input, {}, adapter)).rejects.toThrow(
      "Could not optimize broken.jpg: decode failed",
    );
    expect(adapter.revokeObjectUrl).toHaveBeenCalledWith("blob:upload-test");
  });
});
