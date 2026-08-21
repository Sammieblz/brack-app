const NORMALIZABLE_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type EncodableImageMimeType = "image/jpeg" | "image/png" | "image/webp";

const EXTENSION_BY_MIME_TYPE: Record<EncodableImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const DEFAULT_MAX_DIMENSION = 2560;
const DEFAULT_QUALITY = 0.82;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export interface ImageNormalizationAdapter {
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
  decodeImage: (url: string) => Promise<{
    source: CanvasImageSource;
    width: number;
    height: number;
  }>;
  encodeImage: (input: {
    source: CanvasImageSource;
    width: number;
    height: number;
    mimeType: EncodableImageMimeType;
    quality: number;
  }) => Promise<Blob>;
}

export interface NormalizeUploadMediaOptions {
  fileName?: string;
  maxDimension?: number;
  outputMimeType?: EncodableImageMimeType | "preserve";
  quality?: number;
}

export interface NormalizedUploadMedia {
  body: Blob;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  normalized: boolean;
}

const browserImageNormalizationAdapter: ImageNormalizationAdapter = {
  createObjectUrl: (blob) => URL.createObjectURL(blob),
  revokeObjectUrl: (url) => URL.revokeObjectURL(url),
  decodeImage: (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (!image.naturalWidth || !image.naturalHeight) {
          reject(new Error("The selected image has invalid dimensions"));
          return;
        }
        resolve({
          source: image,
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      };
      image.onerror = () => reject(new Error("The selected image could not be decoded"));
      image.src = url;
    }),
  encodeImage: ({ source, width, height, mimeType, quality }) =>
    new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Image processing is unavailable on this device"));
        return;
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(source, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("The selected image could not be encoded"));
            return;
          }
          resolve(blob);
        },
        mimeType,
        quality,
      );
    }),
};

const getBlobFileName = (blob: Blob, fallback: string): string => {
  if (typeof File !== "undefined" && blob instanceof File && blob.name.trim()) {
    return blob.name;
  }
  return fallback;
};

const readBlobAsArrayBuffer = (blob: Blob): Promise<ArrayBuffer> => {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new Error("The selected image could not be inspected"));
    };
    reader.onerror = () => reject(new Error("The selected image could not be inspected"));
    reader.readAsArrayBuffer(blob);
  });
};

const matchesBytes = (bytes: Uint8Array, offset: number, expected: number[]): boolean =>
  expected.every((value, index) => bytes[offset + index] === value);

const readFourCc = (bytes: Uint8Array, offset: number): string =>
  String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );

const isAnimatedPng = (bytes: Uint8Array): boolean => {
  if (bytes.length < PNG_SIGNATURE.length || !matchesBytes(bytes, 0, PNG_SIGNATURE)) {
    return false;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= bytes.length) {
    const chunkLength = view.getUint32(offset, false);
    const chunkType = readFourCc(bytes, offset + 4);
    if (chunkType === "acTL") return true;
    if (chunkType === "IDAT" || chunkType === "IEND") return false;

    const nextOffset = offset + 12 + chunkLength;
    if (nextOffset <= offset || nextOffset > bytes.length) return false;
    offset = nextOffset;
  }
  return false;
};

const isAnimatedWebp = (bytes: Uint8Array): boolean => {
  if (
    bytes.length < 12 ||
    readFourCc(bytes, 0) !== "RIFF" ||
    readFourCc(bytes, 8) !== "WEBP"
  ) {
    return false;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = readFourCc(bytes, offset);
    const chunkLength = view.getUint32(offset + 4, true);
    if (chunkType === "ANIM" || chunkType === "ANMF") return true;
    if (chunkType === "VP8X" && chunkLength > 0 && (bytes[offset + 8] & 0x02) !== 0) {
      return true;
    }

    const nextOffset = offset + 8 + chunkLength + (chunkLength % 2);
    if (nextOffset <= offset || nextOffset > bytes.length) return false;
    offset = nextOffset;
  }
  return false;
};

export const isAnimatedUploadImage = async (input: Blob): Promise<boolean> => {
  const mimeType = input.type.toLowerCase();
  if (mimeType !== "image/png" && mimeType !== "image/webp") return false;

  const bytes = new Uint8Array(await readBlobAsArrayBuffer(input));
  return mimeType === "image/png" ? isAnimatedPng(bytes) : isAnimatedWebp(bytes);
};

export const replaceFileExtension = (fileName: string, extension: string): string => {
  const slashIndex = Math.max(fileName.lastIndexOf("/"), fileName.lastIndexOf("\\"));
  const dotIndex = fileName.lastIndexOf(".");
  const hasExtension = dotIndex > slashIndex + 1;
  const stem = hasExtension ? fileName.slice(0, dotIndex) : fileName;
  return `${stem}.${extension}`;
};

export const calculateBoundedImageDimensions = (
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } => {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(maxDimension) ||
    width <= 0 ||
    height <= 0 ||
    maxDimension <= 0
  ) {
    throw new Error("The selected image has invalid dimensions");
  }

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

export const isNormalizableUploadImage = (value: Blob): boolean =>
  NORMALIZABLE_IMAGE_MIME_TYPES.has(value.type.toLowerCase());

export const normalizeUploadMedia = async (
  input: Blob,
  options: NormalizeUploadMediaOptions = {},
  adapter: ImageNormalizationAdapter = browserImageNormalizationAdapter,
): Promise<NormalizedUploadMedia> => {
  const sourceMimeType = input.type.toLowerCase();
  const sourceFileName = getBlobFileName(input, options.fileName || "upload");

  // GIFs, videos, and unknown formats intentionally remain byte-for-byte intact.
  if (!NORMALIZABLE_IMAGE_MIME_TYPES.has(sourceMimeType)) {
    return {
      body: input,
      fileName: sourceFileName,
      mimeType: input.type,
      sizeBytes: input.size,
      width: null,
      height: null,
      normalized: false,
    };
  }

  try {
    if (await isAnimatedUploadImage(input)) {
      return {
        body: input,
        fileName: sourceFileName,
        mimeType: input.type,
        sizeBytes: input.size,
        width: null,
        height: null,
        normalized: false,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown image inspection error";
    throw new Error(`Could not optimize ${sourceFileName}: ${message}`);
  }

  const outputMimeType =
    !options.outputMimeType || options.outputMimeType === "preserve"
      ? (sourceMimeType as EncodableImageMimeType)
      : options.outputMimeType;
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options.quality ?? DEFAULT_QUALITY;

  if (!Number.isFinite(quality) || quality <= 0 || quality > 1) {
    throw new Error("Image quality must be greater than 0 and no more than 1");
  }

  const objectUrl = adapter.createObjectUrl(input);
  try {
    const decoded = await adapter.decodeImage(objectUrl);
    const dimensions = calculateBoundedImageDimensions(
      decoded.width,
      decoded.height,
      maxDimension,
    );
    const encoded = await adapter.encodeImage({
      source: decoded.source,
      ...dimensions,
      mimeType: outputMimeType,
      quality,
    });

    if (encoded.type.toLowerCase() !== outputMimeType) {
      throw new Error(`This device could not encode ${outputMimeType} images`);
    }

    return {
      body: encoded,
      fileName: replaceFileExtension(
        sourceFileName,
        EXTENSION_BY_MIME_TYPE[outputMimeType],
      ),
      mimeType: outputMimeType,
      sizeBytes: encoded.size,
      width: dimensions.width,
      height: dimensions.height,
      normalized: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown image processing error";
    throw new Error(`Could not optimize ${sourceFileName}: ${message}`);
  } finally {
    adapter.revokeObjectUrl(objectUrl);
  }
};
