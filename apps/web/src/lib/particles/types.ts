import * as THREE from "three";

// Audio data interfaces
export interface AudioData {
  amplitude: number;
  frequency: number;
  frequencyData: Uint8Array;
  bassLevel: number;
  midLevel: number;
  trebleLevel: number;
  isRecording: boolean;
}

export interface LoadingState {
  isLoading: boolean;
  progress: number;
  type: "processing" | "analyzing" | "generating" | "idle";
}

// Particle parameter interfaces
export interface ParticleParams {
  noiseIntensity: number;
  pulseAmplitude: number;
  torusMode: boolean;
  torusRadius: number;
  torusSpeed: number;
  torusMinorRadius: number;
}

// Shader uniform interfaces
export interface SimulationUniforms
  extends Record<string, THREE.IUniform<number | THREE.Texture>> {
  positions: THREE.IUniform<THREE.Texture>;
  uFrequency: THREE.IUniform<number>;
  uTime: THREE.IUniform<number>;
  uNoiseIntensity: THREE.IUniform<number>;
  uPulseAmplitude: THREE.IUniform<number>;
  uTorusMode: THREE.IUniform<number>;
  uTorusRadius: THREE.IUniform<number>;
  uTorusSpeed: THREE.IUniform<number>;
  uTorusRotation: THREE.IUniform<number>;
  uTorusMinorRadius: THREE.IUniform<number>;
}

export interface ParticleUniforms
  extends Record<string, THREE.IUniform<THREE.Texture | null>> {
  uPositions: THREE.IUniform<THREE.Texture | null>;
}

// Component prop interfaces
export interface ParticleSceneProps {
  noiseIntensity: number;
  pulseAmplitude: number;
  torusMode: boolean;
  torusRadius: number;
  torusSpeed: number;
  torusMinorRadius: number;
}

export interface ParticleControlsProps {
  noiseIntensity: number;
  setNoiseIntensity: (value: number) => void;
  pulseAmplitude: number;
  setPulseAmplitude: (value: number) => void;
  torusMode: boolean;
  setTorusMode: (value: boolean) => void;
  torusRadius: number;
  setTorusRadius: (value: number) => void;
  torusSpeed: number;
  setTorusSpeed: (value: number) => void;
  torusMinorRadius: number;
  setTorusMinorRadius: (value: number) => void;
  isAudioReactive: boolean;
  onTriggerLoading: (type: LoadingState["type"]) => void;
}

// Extended Three.js types
export interface PointsWithShaderMaterial extends THREE.Points {
  material: THREE.ShaderMaterial & { uniforms: ParticleUniforms };
}

// Simulation material type
export interface TypedSimulationMaterial {
  uniforms: SimulationUniforms;
  initialPositionsTexture: THREE.DataTexture;
}
