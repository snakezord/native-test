import * as THREE from "three";
import {
  simulationVertexShader,
  simulationFragmentShader,
} from "../shaders/simulation";

const getRandomData = (width: number, height: number) => {
  // we need to create a vec4 since we're passing the positions to the fragment shader
  // data textures need to have 4 components, R, G, B, and A
  const length = width * height * 4;
  const data = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const stride = i * 4;

    const distance = Math.sqrt(Math.random()) * 2.0;
    const theta = THREE.MathUtils.randFloatSpread(360);
    const phi = THREE.MathUtils.randFloatSpread(360);

    data[stride] = distance * Math.sin(theta) * Math.cos(phi);
    data[stride + 1] = distance * Math.sin(theta) * Math.sin(phi);
    data[stride + 2] = distance * Math.cos(theta);
    data[stride + 3] = 1.0; // this value will not have any impact
  }

  return data;
};

export class SimulationMaterial extends THREE.ShaderMaterial {
  public initialPositionsTexture: THREE.DataTexture;

  constructor(size: number) {
    const positionsTexture = new THREE.DataTexture(
      getRandomData(size, size),
      size,
      size,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    positionsTexture.needsUpdate = true;

    const simulationUniforms = {
      positions: { value: positionsTexture }, // This will be overridden in the render loop
      uFrequency: { value: 0.25 },
      uTime: { value: 0 },
      uNoiseIntensity: { value: 0.3 },
      uPulseAmplitude: { value: 0.1 },
      uTorusMode: { value: 0.0 },
      uTorusRadius: { value: 1.0 },
      uTorusSpeed: { value: 1.0 },
      uTorusRotation: { value: 0.0 },
      uTorusMinorRadius: { value: 0.3 },
    };

    super({
      uniforms: simulationUniforms,
      vertexShader: simulationVertexShader,
      fragmentShader: simulationFragmentShader,
    });

    // Store the initial positions texture for first frame only
    this.initialPositionsTexture = positionsTexture;
  }
}
