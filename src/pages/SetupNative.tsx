import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NavLink } from "react-router-dom";
import { ArrowLeft, Shield, Wifi, Terminal, FileCode } from "lucide-react";

const CodeBlock = ({ children }: { children: string }) => (
  <pre className="rounded-md bg-muted p-4 overflow-x-auto text-xs font-mono text-foreground whitespace-pre">
    {children}
  </pre>
);

const SetupNative = () => {
  return (
    <div className="min-h-[100dvh] bg-background px-6 py-12 max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <NavLink to="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </NavLink>
        <h1 className="text-lg font-mono tracking-wider text-foreground">
          NATIVE BUILD SETUP
        </h1>
      </div>

      <p className="text-sm text-muted-foreground">
        After exporting to GitHub and running <code className="text-primary">npx cap add android</code>,
        apply these configurations in Android Studio.
      </p>

      {/* 1. Network Security Config */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-mono">
            <Shield className="w-4 h-4 text-primary" />
            1. Network Security Config
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Create <code className="text-primary">android/app/src/main/res/xml/network_security_config.xml</code>
          </p>
          <CodeBlock>{`<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">192.168.88.3</domain>
    <!-- Add more speaker IPs as needed -->
  </domain-config>
  <!-- Allow all local networks (optional, less secure) -->
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">192.168.0.0</domain>
    <domain includeSubdomains="true">10.0.0.0</domain>
  </domain-config>
</network-security-config>`}</CodeBlock>
        </CardContent>
      </Card>

      {/* 2. AndroidManifest.xml */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-mono">
            <FileCode className="w-4 h-4 text-primary" />
            2. AndroidManifest.xml Permissions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Add inside <code className="text-primary">&lt;manifest&gt;</code> in{" "}
            <code className="text-primary">android/app/src/main/AndroidManifest.xml</code>
          </p>
          <CodeBlock>{`<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.NEARBY_WIFI_DEVICES" />
<uses-permission android:name="android.permission.CHANGE_WIFI_MULTICAST_STATE" />`}</CodeBlock>
          <p className="text-xs text-muted-foreground">
            Add <code className="text-primary">android:networkSecurityConfig</code> to the{" "}
            <code className="text-primary">&lt;application&gt;</code> tag:
          </p>
          <CodeBlock>{`<application
  android:networkSecurityConfig="@xml/network_security_config"
  android:usesCleartextTraffic="true"
  ...>`}</CodeBlock>
        </CardContent>
      </Card>

      {/* 3. Capacitor Config */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-mono">
            <Wifi className="w-4 h-4 text-primary" />
            3. Capacitor Config (Already Set)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            <code className="text-primary">capacitor.config.ts</code> already includes:
          </p>
          <CodeBlock>{`server: {
  cleartext: true,
},
android: {
  allowMixedContent: true,
}`}</CodeBlock>
        </CardContent>
      </Card>

      {/* 4. CLI Commands */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-mono">
            <Terminal className="w-4 h-4 text-primary" />
            4. Build & Run Commands
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock>{`# 1. Export to GitHub & clone
git clone <your-repo-url>
cd <project-folder>

# 2. Install dependencies
npm install

# 3. Add Android platform
npx cap add android

# 4. Build the web app
npm run build

# 5. Sync to native project
npx cap sync

# 6. Open in Android Studio
npx cap open android

# 7. Or run directly on device
npx cap run android`}</CodeBlock>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupNative;
