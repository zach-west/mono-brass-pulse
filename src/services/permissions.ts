import { Capacitor } from "@capacitor/core";

export async function requestLocalNetworkAccess(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      await Geolocation.requestPermissions();
    } catch {
      // Permission denied or plugin unavailable
    }
  } else {
    // Web fallback — probe geolocation to trigger permission
    try {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(),
          () => resolve(),
          { timeout: 3000 },
        );
      });
    } catch {
      // Unavailable
    }
  }

  // Probe Bluetooth for Nearby Devices permission
  if ("bluetooth" in navigator) {
    try {
      // @ts-expect-error experimental API
      await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["generic_access"],
      });
    } catch {
      // User cancelled or unsupported — expected
    }
  }
}
