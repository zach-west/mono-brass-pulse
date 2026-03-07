import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Bluetooth, Cable, Smartphone } from "lucide-react";

export function PermissionAndNativeModule() {
  const [showNativePlan, setShowNativePlan] = useState(false);

  const requestBluetooth = async () => {
    if (!("bluetooth" in navigator)) {
      toast({ title: "Web Bluetooth Unsupported", description: "This browser/runtime does not expose navigator.bluetooth.", variant: "destructive" });
      return;
    }

    try {
      // Skeleton probe for local-device permission surface.
      // @ts-expect-error experimental web API is not fully typed in all TS lib versions
      await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ["generic_access"] });
      toast({ title: "Bluetooth Permission Prompted", description: "Permission request flow was triggered successfully." });
    } catch (error) {
      toast({ title: "Bluetooth Request Closed", description: String(error), variant: "destructive" });
    }
  };

  const requestUsb = async () => {
    const navWithUsb = navigator as Navigator & {
      usb?: {
        requestDevice: (options: { filters: Array<Record<string, never>> }) => Promise<unknown>;
      };
    };

    if (!navWithUsb.usb) {
      toast({ title: "Web USB Unsupported", description: "This browser/runtime does not expose navigator.usb.", variant: "destructive" });
      return;
    }

    try {
      await navWithUsb.usb.requestDevice({ filters: [] });
      toast({ title: "USB Permission Prompted", description: "Permission request flow was triggered successfully." });
    } catch (error) {
      toast({ title: "USB Request Closed", description: String(error), variant: "destructive" });
    }
  };

  return (
    <Card className="border-primary/20 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-mono tracking-wider">
          <Bluetooth className="h-5 w-5 text-primary" />
          MODULE C — LOCAL TRUST + NATIVE FALLBACK
        </CardTitle>
        <CardDescription className="font-mono text-xs">
          Probe device permission APIs, then expose a Capacitor-ready fallback plan for Android packaging.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button variant="outline" className="gap-2 font-mono text-xs" onClick={requestBluetooth}>
            <Bluetooth className="h-4 w-4" />
            REQUEST WEB BLUETOOTH
          </Button>
          <Button variant="outline" className="gap-2 font-mono text-xs" onClick={requestUsb}>
            <Cable className="h-4 w-4" />
            REQUEST WEB USB
          </Button>
        </div>

        <Button className="w-full gap-2 font-mono text-xs" onClick={() => setShowNativePlan((state) => !state)}>
          <Smartphone className="h-4 w-4" />
          {showNativePlan ? "HIDE" : "SHOW"} NATIVE BUILD BUTTON
        </Button>

        {showNativePlan && (
          <div className="space-y-2 rounded border border-border bg-muted/30 p-3 font-mono text-xs text-muted-foreground">
            <p className="text-foreground">Native Build (Capacitor) Quick Export Plan:</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Click "Export to GitHub" in Lovable.</li>
              <li>Pull locally, run: npm install && npm run build.</li>
              <li>Install Capacitor deps, then run npx cap init.</li>
              <li>Run npx cap add android && npx cap sync.</li>
              <li>Build APK with npx cap run android.</li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
