import { createPersistentStore } from "./store";

export interface AppSettings {
  sound: boolean;
  haptics: boolean;
  onboarded: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  sound: true,
  haptics: true,
  onboarded: false,
};

export const settingsStore = createPersistentStore<AppSettings>(
  "monomon.settings.v1",
  DEFAULT_SETTINGS,
);

export function useSettings() {
  return settingsStore.useValue();
}

export function updateSettings(patch: Partial<AppSettings>) {
  settingsStore.set((prev) => ({ ...prev, ...patch }));
}
