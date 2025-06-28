// Types and interfaces
export type * from "./types";

// Constants and configuration
export * from "./constants";

// Shader modules
export * from "./shaders";

// Materials
export * from "./materials";

// Re-export commonly used types for convenience
export type {
  AudioData,
  LoadingState,
  ParticleParams,
  ParticleSceneProps,
  ParticleControlsProps,
  SimulationUniforms,
  ParticleUniforms,
  TypedSimulationMaterial,
  PointsWithShaderMaterial,
} from "./types";
