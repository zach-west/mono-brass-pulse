# Mono Project Architecture (Post March 9th Lockdown)

### 1. The Two-Workshop System
* **UI Workshop (mono-brass-pulse)**: Managed in Replit. For Web/UI development, React logic, and Capgo updates.
* **Native Vault (mono-android-build)**: Managed in GitHub. A "Locked Vault" containing the Android project and AU Legacy Signing Key.

### 2. Workflow Rules
* **Features**: Design in Lovable -> Sync to Replit -> Push to mono-brass-pulse.
* **Live Updates**: Use 'npx capgo upload' from Replit for instant changes.
* **New APKs**: Trigger "Build & Release" in the mono-android-build GitHub Actions tab.
* **Note**: The local android/ folder is a 'Ghost Folder' and must be ignored.

### 3. Plugin Registry (The Handshake)
* **Status Bar**: @capacitor/status-bar (Native Support: Yes)
* **Splash Screen**: @capacitor/splash-screen (Native Support: Yes)
* **Capgo**: @capgo/capacitor-updater (Native Support: Yes)
* **Speech Recognition**: @capacitor-community/speech-recognition@^7.0.1 (Native Support: SYNCED — in mono-android-build + RECORD_AUDIO permission in manifest)
* **Rule**: Any new Capacitor plugin added to package.json MUST be manually added to the Native Vault's package.json before the next APK build.

### 4. Brain & Service Contract (The API Handshake)
* **Core Service**: Managed in 'Mono-core-service' (Replit).
* **Connection Rule**: All UI data requests go through the centralized Express API.
* **Security**: No API keys or secrets (Spotify/Sonos) are allowed in the UI Workshop. They stay in the Brain.
* **Discovery**: The UI discovers the Brain via the 'VITE_API_URL' environment variable.
* **Brain Endpoints (verified)**:
  - `POST /api/curate` — voice chain, returns `localCommands` block
  - `POST /api/sonos/control` — transport (play/pause/mute/unmute/volume), returns `{ localCommand }`
  - `/api/command` does NOT exist. `/api/vibe` does NOT return localCommand.

### 5. v1.0.2 — Full System Ignition
* **Brass Button**: Triggers voice recording (Capacitor native) → Web Speech API fallback
* **Voice Chain**: Transcription → POST /api/curate → executes localCommands SOAP directly to Sonos
* **Volume**: SpeakerCard slider POSTs to /api/sonos/control
* **SOAP Headers**: Content-Type enforced as `text/xml; charset="utf-8"` (quoted charset per Sonos spec)
* **Cleartext Fix (Android)**: AndroidManifest.xml has `android:usesCleartextTraffic="true"` + network_security_config.xml for 192.168.88.3

### 6. v1.0.3 — The Native Bridge (CRITICAL — DO NOT REVERT)

#### Why CapacitorHttp is mandatory
Android's WebView sandbox blocks all `fetch()` calls to local IP addresses (192.168.x.x) with
`TypeError: Failed to fetch` — even with cleartext config and network_security_config.xml.
The only fix is to bypass the WebView entirely using the OS network stack.

#### The Bridge
`CapacitorHttp` (from `@capacitor/core`, already installed) sends HTTP via the Android OS network
stack — no WebView, no CORS, no cleartext sandbox.

#### ⛔ DO NOT CHANGE THESE — THEY ARE INTENTIONAL AND REQUIRED FOR ANDROID
* **`src/services/sonosControl.ts`**: Uses `CapacitorHttp.request()` on native, falls back to `fetch()` on web. NEVER replace with plain `fetch()`. This is what allows the Pixel 6 to reach `192.168.88.3:1400`.
* **`src/services/vibeApi.ts`** `executeLocalCommand()`: Same pattern. NEVER replace with plain `fetch()`.
* **`src/pages/Index.tsx`**: SpeechRecognition imported as `CapSpeechRecognition` to avoid type collision with the Web Speech API global. Keep this alias.

#### Android Manifest permissions (in mono-android-build)
* `INTERNET` — general network
* `RECORD_AUDIO` + `MICROPHONE` — voice input
* `ACCESS_WIFI_STATE` — read WiFi network state for Sonos discovery
* `CHANGE_WIFI_MULTICAST_STATE` — enable multicast for Sonos mDNS/SSDP discovery
