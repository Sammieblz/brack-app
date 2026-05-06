import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const BRAND_ORANGE = "#F97316";
const APP_ICON_SOURCE = path.join(
  ROOT,
  "ios",
  "App",
  "App",
  "Assets.xcassets",
  "AppIcon.appiconset",
  "AppIcon-512@2x.png"
);

const ANDROID_MIPMAPS = {
  ldpi: { legacy: 36, adaptive: 81 },
  mdpi: { legacy: 48, adaptive: 108 },
  hdpi: { legacy: 72, adaptive: 162 },
  xhdpi: { legacy: 96, adaptive: 216 },
  xxhdpi: { legacy: 144, adaptive: 324 },
  xxxhdpi: { legacy: 192, adaptive: 432 },
};

const WEBP_ICON_SIZES = [48, 72, 96, 128, 192, 256, 512];
const LINUX_ICON_SIZES = [16, 32, 48, 64, 128, 256, 512, 1024];

const ensureParentDir = async (filePath) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

const writeFile = async (filePath, contents) => {
  await ensureParentDir(filePath);
  await fs.writeFile(filePath, await contents);
};

const resizePng = (input, size) =>
  sharp(input)
    .resize(size, size, { fit: "cover", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

const solidPng = (size, color = BRAND_ORANGE) =>
  sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: color,
    },
  })
    .png()
    .toBuffer();

const isOrangeBackground = (red, green, blue) =>
  red >= 220 && green >= 70 && green <= 140 && blue <= 70;

const makeTransparentMark = async (input) => {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);

  for (let index = 0; index < pixels.length; index += 4) {
    if (isOrangeBackground(pixels[index], pixels[index + 1], pixels[index + 2])) {
      pixels[index + 3] = 0;
    }
  }

  return sharp(pixels, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
};

const makeIco = async (input) => {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const images = await Promise.all(sizes.map((size) => resizePng(input, size)));
  const headerSize = 6;
  const directorySize = 16 * images.length;
  let offset = headerSize + directorySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = images.map((image, index) => {
    const size = sizes[index];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += image.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images]);
};

const makeIcns = async (input) => {
  const entries = [
    ["icp4", 16],
    ["icp5", 32],
    ["icp6", 64],
    ["ic07", 128],
    ["ic08", 256],
    ["ic09", 512],
    ["ic10", 1024],
  ];
  const images = await Promise.all(
    entries.map(async ([type, size]) => ({
      type,
      image: await resizePng(input, size),
    }))
  );
  const totalSize = 8 + images.reduce((sum, item) => sum + 8 + item.image.length, 0);
  const header = Buffer.alloc(8);
  header.write("icns", 0, "ascii");
  header.writeUInt32BE(totalSize, 4);

  const chunks = images.flatMap(({ type, image }) => {
    const entryHeader = Buffer.alloc(8);
    entryHeader.write(type, 0, "ascii");
    entryHeader.writeUInt32BE(8 + image.length, 4);
    return [entryHeader, image];
  });

  return Buffer.concat([header, ...chunks]);
};

const main = async () => {
  const source = await fs.readFile(APP_ICON_SOURCE);
  const transparentMark = await makeTransparentMark(source);

  await writeFile(path.join(ROOT, "resources", "icon.png"), await resizePng(source, 1024));
  await writeFile(path.join(ROOT, "resources", "icon.ico"), await makeIco(source));
  await writeFile(path.join(ROOT, "resources", "icon.icns"), await makeIcns(source));

  await Promise.all(
    LINUX_ICON_SIZES.map(async (size) => {
      await writeFile(
        path.join(ROOT, "resources", "linux-icons", `${size}x${size}.png`),
        await resizePng(source, size)
      );
    })
  );

  await writeFile(path.join(ROOT, "assets", "icon-only.png"), await resizePng(source, 1024));
  await writeFile(path.join(ROOT, "assets", "icon-foreground.png"), await resizePng(transparentMark, 1024));
  await writeFile(path.join(ROOT, "assets", "icon-background.png"), await solidPng(1024));

  await Promise.all(
    WEBP_ICON_SIZES.map(async (size) => {
      await writeFile(
        path.join(ROOT, "icons", `icon-${size}.webp`),
        await sharp(source)
          .resize(size, size, { fit: "cover", kernel: sharp.kernel.lanczos3 })
          .webp({ quality: 92 })
          .toBuffer()
      );
    })
  );

  await Promise.all(
    Object.entries(ANDROID_MIPMAPS).flatMap(([density, sizes]) => {
      const base = path.join(ROOT, "android", "app", "src", "main", "res", `mipmap-${density}`);

      return [
        writeFile(path.join(base, "ic_launcher.png"), resizePng(source, sizes.legacy)),
        writeFile(path.join(base, "ic_launcher_round.png"), resizePng(source, sizes.legacy)),
        writeFile(path.join(base, "ic_launcher_background.png"), solidPng(sizes.adaptive)),
        writeFile(path.join(base, "ic_launcher_foreground.png"), resizePng(transparentMark, sizes.adaptive)),
      ];
    })
  );

  console.log("Generated Brack Electron and Capacitor icon assets.");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
