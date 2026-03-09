# Mono Project Architecture (Post March 9th Lockdown)

### 1. The Two-Workshop System
* **UI Workshop (mono-brass-pulse)**: Managed in Replit. For Web/UI development, React logic, and Capgo updates.
* **Native Vault (mono-android-build)**: Managed in GitHub. A "Locked Vault" containing the Android project and AU Legacy Signing Key.

### 2. Workflow Rules
* **Features**: Design in Lovable -> Sync to Replit -> Push to mono-brass-pulse.
* **Live Updates**: Use 'npx capgo upload' from Replit for instant changes.
* **New APKs**: Trigger "Build & Release" in the mono-android-build GitHub Actions tab.
* **Note**: The local android/ folder is a 'Ghost Folder' and must be ignored.
