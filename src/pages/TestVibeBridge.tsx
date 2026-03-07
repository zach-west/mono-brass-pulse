import { SonosModule } from "./test-vibe-bridge/SonosModule";
import { SpotifyModule } from "./test-vibe-bridge/SpotifyModule";
import { PermissionAndNativeModule } from "./test-vibe-bridge/PermissionAndNativeModule";

const TestVibeBridge = () => (
  <main className="mx-auto min-h-[100dvh] max-w-lg space-y-6 bg-background px-4 py-8">
    <header className="space-y-1 text-center">
      <h1 className="font-mono text-sm uppercase tracking-[0.4em] text-muted-foreground">Vibe Bridge — Tech Spike</h1>
      <p className="font-mono text-[10px] text-muted-foreground/60">Advanced PWA experiments for distributed local control</p>
    </header>

    <SonosModule />
    <SpotifyModule />
    <PermissionAndNativeModule />
  </main>
);

export default TestVibeBridge;
