# Mono — UI Workshop

Dark-themed React/Vite PWA for Sonos speaker voice control. Part of the Two-Workshop architecture.

## Architecture

- **This repo (mono-brass-pulse)**: UI Workshop only — React + Vite + TanStack Query
- **mono-android-build (GitHub)**: Native Vault — Capacitor Android project, Gradle, signing keys
- **mono-vibe-maker (Replit)**: Brain — Express API that talks to Spotify and generates Sonos SOAP commands

## Key Files

| File | Purpose |
|------|---------|
| `src/pages/Index.tsx` | Main screen: Brass button, speaker list, system console |
| `src/components/BrassButton.tsx` | Voice trigger button with recording state |
| `src/components/SpeakerCard.tsx` | Per-speaker transport + volume controls |
| `src/services/vibeApi.ts` | Brain API calls: vibe chain, volume control, search |
| `src/services/sonosControl.ts` | Direct SOAP commands to Sonos speakers |
| `CONTEXT.md` | Architecture decisions, plugin registry, vault sync rules |

## Voice Chain (v1.0.2)

1. Press Brass Button → triggers `SpeechRecognition` (native Capacitor or Web Speech API fallback)
2. Transcription text → POST `/api/vibe` to Brain
3. Brain returns `localCommand` (SOAP URL + headers + body)
4. App fires direct HTTP POST to Sonos at `192.168.88.3:1400`
5. SONOS HTTP STATUS logged to System Console

## Environment

- `VITE_API_URL` — Brain URL (`https://mono-vibe-maker.replit.app`), set as Replit secret

## Brain API Endpoints

| Endpoint | Purpose |
|----------|---------|
| POST `/api/vibe` | Voice query → track list + localCommand |
| POST `/api/command` | Direct action (play/pause/mute/unmute) → localCommand |
| POST `/api/sonos/control` | Volume control (routed through Brain) |

## Android Cleartext Fix (for mono-android-build vault)

Sonos speaks plain HTTP. Android blocks it by default. Two files need to be in the vault:

**`android/app/src/main/res/xml/network_security_config.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">192.168.88.3</domain>
    </domain-config>
</network-security-config>
```

**`android/app/src/main/AndroidManifest.xml`** — inside `<application>` tag:
```
android:usesCleartextTraffic="true"
android:networkSecurityConfig="@xml/network_security_config"
```

## Plugin Registry

Any plugin added here MUST be manually added to `mono-android-build/package.json` before next APK build.

| Plugin | Version | Vault Synced |
|--------|---------|--------------|
| `@capacitor/status-bar` | latest | Yes |
| `@capacitor/splash-screen` | latest | Yes |
| `capacitor-updater` | latest | Yes |
| `@capacitor-community/speech-recognition` | latest | Yes (commit dd84567) |

## Live Updates (Capgo)

```bash
npm run build && npx capgo upload
```

App ID: `app.lovable.f6dbc7a6d25e4bc9b63836040c1c8e31`, channel: `production`
