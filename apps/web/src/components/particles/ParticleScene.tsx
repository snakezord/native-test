import { OrbitControls, useFBO } from "@react-three/drei";
import { useFrame, extend, createPortal } from "@react-three/fiber";
import { useMemo, useRef, memo, useEffect } from "react";
import * as THREE from "three";

import { SimulationMaterial } from "@/lib/particles/materials";
import {
  particleVertexShader,
  particleFragmentShader,
} from "@/lib/particles/shaders";
import type {
  ParticleSceneProps,
  TypedSimulationMaterial,
  PointsWithShaderMaterial,
} from "@/lib/particles";
import { PARTICLE_CONFIG } from "@/lib/particles";

extend({ SimulationMaterial: SimulationMaterial });

const FBOParticles = memo(
  ({
    noiseIntensity,
    pulseAmplitude,
    torusMode,
    torusRadius,
    torusSpeed,
    torusMinorRadius,
  }: ParticleSceneProps) => {
    const size = PARTICLE_CONFIG.TEXTURE_SIZE;

    const points = useRef<PointsWithShaderMaterial>(null);
    const simulationMaterialRef = useRef<TypedSimulationMaterial>(null);

    // Smooth interpolation for parameters - ONLY initialize once, don't reset on re-renders
    const currentNoiseIntensity = useRef(noiseIntensity);
    const currentPulseAmplitude = useRef(pulseAmplitude);
    const currentTorusMode = useRef(torusMode ? 1.0 : 0.0);
    const currentTorusRadius = useRef(torusRadius);
    const currentTorusSpeed = useRef(torusSpeed);
    const currentTorusMinorRadius = useRef(torusMinorRadius);

    // Track rotation angle separately to prevent jumps
    const torusRotation = useRef(0);
    const lastFrameTime = useRef(0);

    // Memoize Three.js objects to prevent recreation on every render
    const scene = useMemo(() => new THREE.Scene(), []);
    const camera = useMemo(
      () => new THREE.OrthographicCamera(-1, 1, 1, -1, 1 / Math.pow(2, 53), 1),
      []
    );

    const positions = useMemo(
      () =>
        new Float32Array([
          -1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0,
        ]),
      []
    );

    const uvs = useMemo(
      () => new Float32Array([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0]),
      []
    );

    // Create two render targets for double buffering
    const renderTarget = useFBO(size, size, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      stencilBuffer: false,
      type: THREE.FloatType,
    });

    const renderTarget2 = useFBO(size, size, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      stencilBuffer: false,
      type: THREE.FloatType,
    });

    // Keep track of which render target is current
    const currentRenderTarget = useRef(renderTarget);
    const isInitialized = useRef(false);

    const particlesPosition = useMemo(() => {
      const length = size * size;
      const particles = new Float32Array(length * 3);
      for (let i = 0; i < length; i++) {
        let i3 = i * 3;
        particles[i3 + 0] = (i % size) / size;
        particles[i3 + 1] = i / size / size;
      }
      return particles;
    }, [size]);

    const uniforms = useMemo(
      (): { uPositions: THREE.IUniform<THREE.Texture | null> } => ({
        uPositions: {
          value: null,
        },
      }),
      []
    );

    // Initialize interpolation refs only on mount, not on every re-render
    useEffect(() => {
      // Only initialize if refs haven't been set yet (first mount)
      if (currentNoiseIntensity.current === undefined) {
        currentNoiseIntensity.current = noiseIntensity;
        currentPulseAmplitude.current = pulseAmplitude;
        currentTorusMode.current = torusMode ? 1.0 : 0.0;
        currentTorusRadius.current = torusRadius;
        currentTorusSpeed.current = torusSpeed;
        currentTorusMinorRadius.current = torusMinorRadius;
      }
    }, []);

    // Create simulation geometry
    const simulationGeometry = useMemo(() => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );
      geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      return geometry;
    }, [positions, uvs]);

    // Create particle geometry
    const particleGeometry = useMemo(() => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(particlesPosition, 3)
      );
      return geometry;
    }, [particlesPosition]);

    useFrame((state) => {
      const { gl, clock } = state;

      if (!simulationMaterialRef.current || !points.current) return;

      const currentTime = clock.elapsedTime;
      const deltaTime = currentTime - lastFrameTime.current;
      lastFrameTime.current = currentTime;

      // Smooth interpolation towards target values
      const lerpFactor = 0.05;

      currentNoiseIntensity.current = THREE.MathUtils.lerp(
        currentNoiseIntensity.current,
        noiseIntensity,
        lerpFactor
      );
      currentPulseAmplitude.current = THREE.MathUtils.lerp(
        currentPulseAmplitude.current,
        pulseAmplitude,
        lerpFactor
      );
      currentTorusMode.current = THREE.MathUtils.lerp(
        currentTorusMode.current,
        torusMode ? 1.0 : 0.0,
        lerpFactor
      );
      currentTorusRadius.current = THREE.MathUtils.lerp(
        currentTorusRadius.current,
        torusRadius,
        lerpFactor
      );
      currentTorusSpeed.current = THREE.MathUtils.lerp(
        currentTorusSpeed.current,
        torusSpeed,
        lerpFactor
      );
      currentTorusMinorRadius.current = THREE.MathUtils.lerp(
        currentTorusMinorRadius.current,
        torusMinorRadius,
        lerpFactor
      );

      // Update rotation based on speed
      torusRotation.current += deltaTime * currentTorusSpeed.current;

      // Update simulation material uniforms
      const simulationMaterial = simulationMaterialRef.current;
      simulationMaterial.uniforms.uTime.value = currentTime;
      simulationMaterial.uniforms.uNoiseIntensity.value =
        currentNoiseIntensity.current;
      simulationMaterial.uniforms.uPulseAmplitude.value =
        currentPulseAmplitude.current;
      simulationMaterial.uniforms.uTorusMode.value = currentTorusMode.current;
      simulationMaterial.uniforms.uTorusRadius.value =
        currentTorusRadius.current;
      simulationMaterial.uniforms.uTorusSpeed.value = currentTorusSpeed.current;
      simulationMaterial.uniforms.uTorusRotation.value = torusRotation.current;
      simulationMaterial.uniforms.uTorusMinorRadius.value =
        currentTorusMinorRadius.current;

      // Initialize with the initial positions texture only on first frame
      if (
        !isInitialized.current &&
        simulationMaterial.initialPositionsTexture
      ) {
        simulationMaterial.uniforms.positions.value =
          simulationMaterial.initialPositionsTexture;
        isInitialized.current = true;
      } else {
        // Use the previous frame's output as the current frame's input
        simulationMaterial.uniforms.positions.value =
          currentRenderTarget.current.texture;
      }

      // Render the simulation
      gl.setRenderTarget(
        currentRenderTarget.current === renderTarget
          ? renderTarget2
          : renderTarget
      );
      gl.clear();
      gl.render(scene, camera);

      // Swap render targets
      currentRenderTarget.current =
        currentRenderTarget.current === renderTarget
          ? renderTarget2
          : renderTarget;

      // Update particles with the new positions
      points.current.material.uniforms.uPositions.value =
        currentRenderTarget.current.texture;

      // Restore default render target
      gl.setRenderTarget(null);
    });

    return (
      <>
        {/* Simulation Scene */}
        {createPortal(
          <mesh>
            <bufferGeometry attach="geometry" {...simulationGeometry} />
            <primitive
              object={new (SimulationMaterial as any)(size)}
              ref={simulationMaterialRef}
            />
          </mesh>,
          scene
        )}

        {/* Particle System */}
        <points ref={points}>
          <bufferGeometry attach="geometry" {...particleGeometry} />
          <shaderMaterial
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            fragmentShader={particleFragmentShader}
            vertexShader={particleVertexShader}
            uniforms={uniforms}
          />
        </points>
      </>
    );
  }
);

FBOParticles.displayName = "FBOParticles";

export function ParticleScene(props: ParticleSceneProps) {
  return (
    <>
      <FBOParticles {...props} />
      <OrbitControls />
    </>
  );
}
