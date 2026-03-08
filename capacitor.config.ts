import type { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.lovable.f6dbc7a6d25e4bc9b63836040c1c8e31',
  appName: 'mono-brass-pulse',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: true,
    },
  },
};

export default config;
