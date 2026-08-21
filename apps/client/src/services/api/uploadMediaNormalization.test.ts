import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentAuthUser: vi.fn(),
  getPublicUrl: vi.fn(),
  isNormalizableUploadImage: vi.fn(),
  normalizeUploadMedia: vi.fn(),
  storageFrom: vi.fn(),
  storageUpload: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: mocks.storageFrom,
    },
  },
}));

vi.mock("./auth", () => ({
  getCurrentAuthUser: mocks.getCurrentAuthUser,
}));

vi.mock("@/utils/normalizeUploadMedia", () => ({
  isNormalizableUploadImage: mocks.isNormalizableUploadImage,
  normalizeUploadMedia: mocks.normalizeUploadMedia,
}));

import { uploadClubDiscussionMediaFiles } from "./clubs";
import { uploadMessageMediaFiles } from "./messaging";
import { uploadPostMediaFiles } from "./social";
import { uploadPublicStorageFile } from "./storage";

const optimizedBody = new Blob(["optimized"], { type: "image/webp" });

const normalizedWebp = {
  body: optimizedBody,
  fileName: "reading-photo.webp",
  mimeType: "image/webp",
  sizeBytes: optimizedBody.size,
  width: 1600,
  height: 1200,
  normalized: true,
};

describe("normalized media upload integration", () => {
  beforeEach(() => {
    mocks.getCurrentAuthUser.mockReset().mockResolvedValue({ id: "reader-1" });
    mocks.getPublicUrl.mockReset().mockImplementation((path: string) => ({
      data: { publicUrl: `https://cdn.example/${path}` },
    }));
    mocks.isNormalizableUploadImage.mockReset().mockReturnValue(true);
    mocks.normalizeUploadMedia.mockReset().mockResolvedValue(normalizedWebp);
    mocks.storageUpload.mockReset().mockResolvedValue({ error: null });
    mocks.storageFrom.mockReset().mockImplementation(() => ({
      upload: mocks.storageUpload,
      getPublicUrl: mocks.getPublicUrl,
    }));
  });

  it("uploads social stills with the normalized body, extension, MIME, size, and dimensions", async () => {
    const source = new File(["source"], "reading-photo.jpg", { type: "image/jpeg" });

    const result = await uploadPostMediaFiles([source]);

    expect(mocks.storageFrom).toHaveBeenCalledWith("post-media");
    expect(mocks.storageUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^reader-1\/.+-reading-photo\.webp$/),
      optimizedBody,
      expect.objectContaining({ contentType: "image/webp" }),
    );
    expect(result[0]).toMatchObject({
      mime_type: "image/webp",
      size_bytes: optimizedBody.size,
      width: 1600,
      height: 1200,
    });
  });

  it("keeps club discussion metadata aligned with the normalized object", async () => {
    const source = new File(["source"], "reading-photo.png", { type: "image/png" });

    const result = await uploadClubDiscussionMediaFiles([source], "club-1");

    expect(mocks.storageFrom).toHaveBeenCalledWith("club-media");
    expect(mocks.storageUpload).toHaveBeenCalledWith(
      expect.stringMatching(
        /^reader-1\/clubs\/club-1\/discussions\/.+-reading-photo\.webp$/,
      ),
      optimizedBody,
      expect.objectContaining({ contentType: "image/webp" }),
    );
    expect(result[0]).toMatchObject({
      mime_type: "image/webp",
      size_bytes: optimizedBody.size,
      width: 1600,
      height: 1200,
    });
  });

  it("keeps message metadata aligned with the normalized object", async () => {
    const source = new File(["source"], "reading-photo.jpeg", { type: "image/jpeg" });

    const result = await uploadMessageMediaFiles([source]);

    expect(mocks.storageFrom).toHaveBeenCalledWith("message-media");
    expect(mocks.storageUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^reader-1\/.+-reading-photo\.webp$/),
      optimizedBody,
      expect.objectContaining({ contentType: "image/webp" }),
    );
    expect(result[0]).toMatchObject({
      media_type: "image",
      mime_type: "image/webp",
      size_bytes: optimizedBody.size,
      width: 1600,
      height: 1200,
    });
  });

  it("normalizes public stills without changing their legacy storage path", async () => {
    const source = new File(["source"], "avatar.png", { type: "image/png" });
    const preservedPng = {
      ...normalizedWebp,
      body: new Blob(["optimized-png"], { type: "image/png" }),
      fileName: "avatar.png",
      mimeType: "image/png",
    };
    mocks.normalizeUploadMedia.mockResolvedValueOnce(preservedPng);

    const result = await uploadPublicStorageFile(
      "avatars",
      "reader-1/avatar.png",
      source,
      { contentType: "image/png" },
    );

    expect(mocks.normalizeUploadMedia).toHaveBeenCalledWith(
      source,
      expect.objectContaining({
        maxDimension: 1024,
        outputMimeType: "preserve",
      }),
    );
    expect(mocks.storageUpload).toHaveBeenCalledWith(
      "reader-1/avatar.png",
      preservedPng.body,
      expect.objectContaining({ contentType: "image/png" }),
    );
    expect(result).toBe("https://cdn.example/reader-1/avatar.png");
  });

  it.each([
    [
      "social",
      10 * 1024 * 1024 + 1,
      () => uploadPostMediaFiles([
        new File(["source"], "photo.jpg", { type: "image/jpeg" }),
      ]),
      "below 10 MB",
    ],
    [
      "club",
      10 * 1024 * 1024 + 1,
      () => uploadClubDiscussionMediaFiles([
        new File(["source"], "photo.png", { type: "image/png" }),
      ], "club-1"),
      "below 10 MB",
    ],
    [
      "messaging",
      8 * 1024 * 1024 + 1,
      () => uploadMessageMediaFiles([
        new File(["source"], "photo.jpg", { type: "image/jpeg" }),
      ]),
      "below 8 MB",
    ],
  ])("rejects an oversized normalized %s object before upload", async (_name, sizeBytes, upload, message) => {
    mocks.normalizeUploadMedia.mockResolvedValueOnce({
      ...normalizedWebp,
      sizeBytes,
    });

    await expect(upload()).rejects.toThrow(message);
    expect(mocks.storageUpload).not.toHaveBeenCalled();
  });
});
