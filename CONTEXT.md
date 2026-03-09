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
* **Capgo**: capacitor-updater (Native Support: Yes)
* **Speech Recognition**: @capacitor-community/speech-recognition (Native Support: **SYNCED** — in mono-android-build package.json + RECORD_AUDIO permission in manifest)
* **Rule**: Any new Capacitor plugin added to package.json MUST be manually added to the Native Vault's package.json before the next APK build.

### 5. v1.0.2 — Full System Ignition
* **Brass Button**: Now triggers voice recording (Capacitor native) → Web Speech API fallback
* **Voice Chain**: Transcription → POST /api/vibe → executes localCommand SOAP directly to Sonos
* **Volume**: SpeakerCard slider POSTs to /api/sonos/control (Brain-routed)
* **Transport (Play/Pause/Mute)**: Uses Brain's /api/command → executeLocalCommand with proper SOAP headers
* **SOAP Headers**: Content-Type enforced as `text/xml; charset="utf-8"` (quoted charset per Sonos spec)
* **Cleartext Fix (Android)**: Verify in mono-android-build:
  - `android/app/src/main/AndroidManifest.xml`: `android:usesCleartextTraffic="true"` and `android:networkSecurityConfig="@xml/network_security_config"`
  - `android/app/src/main/res/xml/network_security_config.xml`: domain-config for 192.168.88.3
  - Reference patch: `.local/android-vault-patch/` in this repo

### 4. Brain & Service Contract (The API Handshake)
* **Core Service**: Managed in 'mono-core-service'.
* **Connection Rule**: All UI data requests must go through the centralized Express API.
* **Security**: No API keys or secrets (Spotify/Sonos) are allowed in the UI Workshop. They must stay in the Brain.
* **Discovery**: The UI discovers the Brain via the 'VITE_API_URL' environment variable.
