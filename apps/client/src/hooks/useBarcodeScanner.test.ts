import { describe, expect, it } from "vitest";
import { getPreferredDeviceId } from "./useBarcodeScanner";

describe("web barcode camera selection", () => {
  it("lets the scanner request the environment camera when labels are hidden", () => {
    expect(
      getPreferredDeviceId([
        { deviceId: "front-camera", label: "" },
        { deviceId: "rear-camera", label: "" },
      ])
    ).toBeNull();
  });

  it("uses an explicitly labeled rear camera when one is available", () => {
    expect(
      getPreferredDeviceId([
        { deviceId: "front-camera", label: "Front camera" },
        { deviceId: "rear-camera", label: "Back camera" },
      ])
    ).toBe("rear-camera");
  });
});
