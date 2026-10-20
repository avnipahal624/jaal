import type { ScamCategory, DetectionMode } from "./investigation";

export type AnimationIntensity = "subtle" | "standard" | "vivid";
export type Density = "compact" | "comfortable";

export interface Settings {
  appearance: {
    /** The dark cyber-forensics theme is the default and only theme. */
    theme: "dark";
    density: Density;
    /** Strength of pulses, sweeps and hover motion. */
    animationIntensity: AnimationIntensity;
    /** Honor the OS preference too; this toggle forces motion off. */
    reducedMotion: boolean;
  };
  investigation: {
    defaultCategory: ScamCategory;
    defaultDetectionMode: DetectionMode;
    autoExtract: boolean;
    autoHash: boolean;
    /** AI next-move suggestions in the investigation workspace. */
    aiSuggestions: boolean;
  };
  simulation: {
    /** Automated simulation messages / ambient activity */
    simulatedActivity: boolean;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  appearance: {
    theme: "dark",
    density: "comfortable",
    animationIntensity: "standard",
    reducedMotion: false,
  },
  investigation: {
    defaultCategory: "Digital arrest scam",
    defaultDetectionMode: "simulation",
    autoExtract: true,
    autoHash: true,
    aiSuggestions: true,
  },
  simulation: {
    simulatedActivity: true,
  },
};
