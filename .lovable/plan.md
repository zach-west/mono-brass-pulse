

# Implementation Plan: Native Architecture Buildout

## Overview
Four deliverables: Replit backend integration, expanded Sonos controls, native Capacitor permissions, and a setup-native documentation page.

---

## 1. Replit Backend Integration

**New file: `src/services/vibeApi.ts`**
- Export `REPLIT_API_URL = "https://mono-vibe-maker.replit.app"`
- Create `searchVibes(query: string)` — fetches `GET /api/search?q={query}` from Replit
- Create `getVibeMetadata(id: string)` — fetches `GET /api/vibe/{id}` from Replit
- Normalize response to `{ name, artist, album, image }` shape used by existing UI

**Refactor: `src/pages/test-vibe-bridge/SpotifyModule.tsx`**
- Rename module title to "VIBE DISCOVERY (Replit Brain)"
- Primary search calls `vibeApi.searchVibes()` instead of Spotify API
- Remove Spotify OAuth login requirement — Replit backend is the source of truth
- Keep Spotify login as optional secondary "enrich" path if user wants it
- Track results display a "Play on Speaker" button per track (wired to Sonos in step 2)

---

## 2. Expanded Sonos Controls

**New file: `src/services/sonosControl.ts`**
- Centralized SOAP command builder with helpers:
  - `setMute(ip, mute: boolean)` — existing logic extracted
  - `play(ip)` — SOAP `Play` action to `AVTransport` endpoint
  - `pause(ip)` — SOAP `Pause` action
  - `setVolume(ip, volume: number)` — SOAP `SetVolume` action
  - `setAVTransportURI(ip, uri: string)` — SOAP `SetAVTransportURI` to inject a track
- All use `fetch` with `mode: "no-cors"` (native Capacitor path)

**Refactor: `src/components/SpeakerCard.tsx`**
- Import controls from `sonosControl.ts`
- Add Play/Pause toggle button
- Add volume slider (using existing `@radix-ui/react-slider`)
- Add `playTrack(uri)` method exposed via props or callback — so the Vibe module can send a track URI to the speaker
- Keep existing mute toggle

---

## 3. Native Permissions via Capacitor

**Install: `@capacitor/geolocation`** (already have `@capacitor/core`)

**New file: `src/services/permissions.ts`**
- Detect Capacitor runtime via `import { Capacitor } from '@capacitor/core'` and `Capacitor.isNativePlatform()`
- If native: use `@capacitor/geolocation` → `Geolocation.requestPermissions()` for `ACCESS_FINE_LOCATION`
- If web: fall back to existing `navigator.geolocation` probe
- Export `requestLocalNetworkAccess()` that triggers both Location and Bluetooth prompts
- Document that `NEARBY_WIFI_DEVICES` and `ACCESS_FINE_LOCATION` must be declared in `AndroidManifest.xml` (covered in step 4)

**Refactor: `src/pages/Index.tsx`**
- Replace inline `requestPermissions` with import from `permissions.ts`

---

## 4. Setup Native Documentation Page

**New file: `src/pages/SetupNative.tsx`**
- In-app guide page at route `/setup-native`
- Sections with copy-paste code blocks:
  1. **Network Security Config** — `res/xml/network_security_config.xml` allowing cleartext to `192.168.*` and `10.*`
  2. **AndroidManifest.xml** additions — `ACCESS_FINE_LOCATION`, `NEARBY_WIFI_DEVICES`, `ACCESS_NETWORK_STATE`, `INTERNET`, `usesCleartextTraffic`
  3. **Capacitor CLI commands** — `npx cap add android`, `npx cap sync`, `npx cap run android`
  4. **Reference to `capacitor.config.ts`** — confirm `cleartext: true` and `allowMixedContent: true` are set

**Update: `src/App.tsx`**
- Add route `/setup-native` → `SetupNative`

---

## File Change Summary

| Action | File |
|--------|------|
| Create | `src/services/vibeApi.ts` |
| Create | `src/services/sonosControl.ts` |
| Create | `src/services/permissions.ts` |
| Create | `src/pages/SetupNative.tsx` |
| Edit | `src/pages/test-vibe-bridge/SpotifyModule.tsx` |
| Edit | `src/components/SpeakerCard.tsx` |
| Edit | `src/pages/Index.tsx` |
| Edit | `src/App.tsx` |
| Install | `@capacitor/geolocation` |

