import type { ScamCategory, DetectionMode } from "./investigation";

export type AccentIntensity = "subtle" | "standard" | "vivid";
export type Density = "compact" | "comfortable";

export interface Settings {
  appearance: {
    /** The dark cyber-forensics theme is the default and only theme. */
    theme: "dark";
    accentIntensity: AccentIntensity;
    density: Density;
    animations: boolean;
  };
  investigation: {
    defaultCategory: ScamCategory;
    defaultDetectionMode: DetectionMode;
    autoExtract: boolean;
    autoHash: boolean;
  };
  simulation: {
    /** Ambient simulated activity (typing, feed ticks) */
    simulatedActivity: boolean;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  appearance: {
    theme: "dark",
    accentIntensity: "standard",
    density: "comfortable",
    animations: true,
  },
  investigation: {
    defaultCategory: "Digital arrest scam",
    defaultDetectionMode: "simulation",
    autoExtract: true,
    autoHash: true,
  },
  simulation: {
    simulatedActivity: true,
  },
};
