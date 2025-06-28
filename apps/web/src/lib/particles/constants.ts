import type { ParticleParams } from "./types";

// Default particle parameters
export const DEFAULT_PARTICLE_PARAMS: ParticleParams = {
  noiseIntensity: 0.03,
  pulseAmplitude: 0.02,
  torusMode: false,
  torusRadius: 1.0,
  torusSpeed: 1.0,
  torusMinorRadius: 0.3,
};

// Particle system configuration
export const PARTICLE_CONFIG = {
  // FBO texture size (particles = size * size)
  TEXTURE_SIZE: 128,

  // Animation parameters
  SMOOTHING_FACTOR: 0.08,
  INTERPOLATION_THRESHOLD: 0.001,

  // Loading simulation durations (ms)
  LOADING_DURATIONS: {
    processing: 3000,
    analyzing: 2500,
    generating: 3500,
  },

  // Three.js render target settings
  RENDER_TARGET_CONFIG: {
    minFilter: "NearestFilter" as const,
    magFilter: "NearestFilter" as const,
    format: "RGBAFormat" as const,
    type: "FloatType" as const,
    stencilBuffer: false,
  },

  // Particle rendering settings
  POINT_SIZE: 3.0,
  PARTICLE_COLOR: [0.34, 0.53, 0.96] as const,
} as const;

// Control UI settings
export const CONTROL_RANGES = {
  noiseIntensity: { min: 0, max: 0.1, step: 0.001 },
  pulseAmplitude: { min: 0, max: 0.1, step: 0.001 },
  torusRadius: { min: 0.5, max: 2.0, step: 0.1 },
  torusSpeed: { min: 0.1, max: 3.0, step: 0.1 },
  torusMinorRadius: { min: 0.1, max: 0.8, step: 0.05 },
} as const;
