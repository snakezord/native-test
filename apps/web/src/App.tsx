import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { VoiceRecorder } from "@/components/audio";
import { useAudioReactiveParticles } from "@/hooks/use-audio-reactive-particles";
import { SimulationMaterial } from "@/lib/particles/materials";
import {
  particleFragmentShader,
  particleVertexShader,
} from "@/lib/particles/shaders";
import { OrbitControls, useFBO } from "@react-three/drei";
import { Canvas, createPortal, extend, useFrame } from "@react-three/fiber";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Label,
  Slider,
} from "@vibespeak/ui";
import * as THREE from "three";

// Import types from the hook
interface AudioData {
  amplitude: number;
  frequency: number;
  frequencyData: Uint8Array;
  bassLevel: number;
  midLevel: number;
  trebleLevel: number;
  isRecording: boolean;
}

interface LoadingState {
  isLoading: boolean;
  progress: number;
  type: "processing" | "analyzing" | "generating" | "idle";
}

// Define specific uniform types for better type safety
interface SimulationUniforms
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

interface ParticleUniforms
  extends Record<string, THREE.IUniform<THREE.Texture | null>> {
  uPositions: THREE.IUniform<THREE.Texture | null>;
}

// Extended SimulationMaterial with proper uniform typing
interface TypedSimulationMaterial extends SimulationMaterial {
  uniforms: SimulationUniforms;
}

// Define interfaces for component props
interface FBOParticlesProps {
  noiseIntensity: number;
  pulseAmplitude: number;
  torusMode: boolean;
  torusRadius: number;
  torusSpeed: number;
  torusMinorRadius: number;
}

interface ControlsProps {
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

interface ThreeSceneProps {
  noiseIntensity: number;
  pulseAmplitude: number;
  torusMode: boolean;
  torusRadius: number;
  torusSpeed: number;
  torusMinorRadius: number;
}

// Define custom mesh types for proper TypeScript support
interface PointsWithShaderMaterial extends THREE.Points {
  material: THREE.ShaderMaterial & { uniforms: ParticleUniforms };
}

// Extend Three.js namespace to include SimulationMaterial (React 19 / R3F v9 style)
declare module "@react-three/fiber" {
  interface ThreeElements {
    simulationMaterial: {
      ref?: React.Ref<TypedSimulationMaterial>;
      args?: [number];
    };
  }
}

extend({ SimulationMaterial });

const FBOParticles = memo(
  ({
    noiseIntensity,
    pulseAmplitude,
    torusMode,
    torusRadius,
    torusSpeed,
    torusMinorRadius,
  }: FBOParticlesProps) => {
    const size = 128;

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
      [],
    );

    const positions = useMemo(
      () =>
        new Float32Array([
          -1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0,
        ]),
      [],
    );

    const uvs = useMemo(
      () => new Float32Array([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0]),
      [],
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
      () => ({
        uPositions: {
          value: null,
        },
      }),
      [],
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

    useFrame((state) => {
      const { gl, clock } = state;

      // React 19 fix: Check if refs are available before proceeding
      if (!simulationMaterialRef.current || !points.current) {
        return;
      }

      // Calculate delta time for rotation
      const deltaTime = clock.elapsedTime - lastFrameTime.current;
      lastFrameTime.current = clock.elapsedTime;

      // Smooth interpolation towards target values
      const lerpFactor = 0.05; // Adjust this for faster/slower transitions (0.01 = very slow, 0.1 = fast)

      currentNoiseIntensity.current = THREE.MathUtils.lerp(
        currentNoiseIntensity.current,
        noiseIntensity,
        lerpFactor,
      );

      currentPulseAmplitude.current = THREE.MathUtils.lerp(
        currentPulseAmplitude.current,
        pulseAmplitude,
        lerpFactor,
      );

      currentTorusMode.current = THREE.MathUtils.lerp(
        currentTorusMode.current,
        torusMode ? 1.0 : 0.0,
        lerpFactor,
      );

      currentTorusRadius.current = THREE.MathUtils.lerp(
        currentTorusRadius.current,
        torusRadius,
        lerpFactor,
      );

      currentTorusSpeed.current = THREE.MathUtils.lerp(
        currentTorusSpeed.current,
        torusSpeed,
        lerpFactor,
      );

      currentTorusMinorRadius.current = THREE.MathUtils.lerp(
        currentTorusMinorRadius.current,
        torusMinorRadius,
        lerpFactor,
      );

      // Update rotation angle based on current speed and delta time
      torusRotation.current += currentTorusSpeed.current * deltaTime;

      // Initialize on first frame - render initial positions to both targets
      if (!isInitialized.current) {
        // Set initial uniforms
        simulationMaterialRef.current.uniforms.uTime.value = clock.elapsedTime;
        simulationMaterialRef.current.uniforms.uNoiseIntensity.value =
          currentNoiseIntensity.current;
        simulationMaterialRef.current.uniforms.uPulseAmplitude.value =
          currentPulseAmplitude.current;
        simulationMaterialRef.current.uniforms.uTorusMode.value =
          currentTorusMode.current;
        simulationMaterialRef.current.uniforms.uTorusRadius.value =
          currentTorusRadius.current;
        simulationMaterialRef.current.uniforms.uTorusSpeed.value =
          currentTorusSpeed.current;
        simulationMaterialRef.current.uniforms.uTorusRotation.value =
          torusRotation.current;
        simulationMaterialRef.current.uniforms.uTorusMinorRadius.value =
          currentTorusMinorRadius.current;

        // Render initial positions to first target
        gl.setRenderTarget(renderTarget);
        gl.clear();
        gl.render(scene, camera);

        // Copy to second target as well for consistency
        gl.setRenderTarget(renderTarget2);
        gl.clear();
        gl.render(scene, camera);
        gl.setRenderTarget(null);

        // Set initial display texture
        points.current.material.uniforms.uPositions.value =
          renderTarget.texture;

        // Clear the initial positions texture reference to prevent accidental usage
        simulationMaterialRef.current.uniforms.positions.value =
          renderTarget2.texture;

        isInitialized.current = true;
        return; // Skip the rest of the first frame
      }

      // Swap render targets for double buffering
      const inputTexture =
        currentRenderTarget.current === renderTarget
          ? renderTarget2
          : renderTarget;
      const outputTarget =
        currentRenderTarget.current === renderTarget
          ? renderTarget
          : renderTarget2;

      // IMPORTANT: Update the simulation material uniforms BEFORE rendering
      simulationMaterialRef.current.uniforms.uTime.value = clock.elapsedTime;
      simulationMaterialRef.current.uniforms.uNoiseIntensity.value =
        currentNoiseIntensity.current;
      simulationMaterialRef.current.uniforms.uPulseAmplitude.value =
        currentPulseAmplitude.current;
      simulationMaterialRef.current.uniforms.uTorusMode.value =
        currentTorusMode.current;
      simulationMaterialRef.current.uniforms.uTorusRadius.value =
        currentTorusRadius.current;
      simulationMaterialRef.current.uniforms.uTorusSpeed.value =
        currentTorusSpeed.current;
      simulationMaterialRef.current.uniforms.uTorusRotation.value =
        torusRotation.current;
      simulationMaterialRef.current.uniforms.uTorusMinorRadius.value =
        currentTorusMinorRadius.current;
      simulationMaterialRef.current.uniforms.positions.value =
        inputTexture.texture;

      // Now render with updated uniforms
      gl.setRenderTarget(outputTarget);
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Update the points material to use the current frame's output
      points.current.material.uniforms.uPositions.value = outputTarget.texture;

      // Swap current render target for next frame
      currentRenderTarget.current = outputTarget;
    });

    const geometry = useMemo(() => {
      return new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-1, -1, 0),
        new THREE.Vector3(1, -1, 0),
        new THREE.Vector3(1, 1, 0),
        new THREE.Vector3(-1, -1, 0),
        new THREE.Vector3(1, 1, 0),
        new THREE.Vector3(-1, 1, 0),
      ]);
    }, []);

    return (
      <>
        {createPortal(
          <mesh>
            <simulationMaterial ref={simulationMaterialRef} args={[size]} />
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[positions, 3]}
              />
              <bufferAttribute attach="attributes-uv" args={[uvs, 2]} />
            </bufferGeometry>
          </mesh>,
          scene,
        )}
        <points ref={points}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[particlesPosition, 3]}
            />
          </bufferGeometry>
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
  },
);

const Controls = memo(
  ({
    noiseIntensity,
    setNoiseIntensity,
    pulseAmplitude,
    setPulseAmplitude,
    torusMode,
    setTorusMode,
    torusRadius,
    setTorusRadius,
    torusSpeed,
    setTorusSpeed,
    torusMinorRadius,
    setTorusMinorRadius,
    isAudioReactive,
    onTriggerLoading,
  }: ControlsProps) => {
    const handleNoiseChange = useCallback(
      (value: number[]) => {
        setNoiseIntensity(value[0]);
      },
      [setNoiseIntensity],
    );

    const handlePulseChange = useCallback(
      (value: number[]) => {
        setPulseAmplitude(value[0]);
      },
      [setPulseAmplitude],
    );

    const handleTorusModeChange = useCallback(
      (checked: boolean) => {
        setTorusMode(checked);
      },
      [setTorusMode],
    );

    const handleTorusRadiusChange = useCallback(
      (value: number[]) => {
        setTorusRadius(value[0]);
      },
      [setTorusRadius],
    );

    const handleTorusSpeedChange = useCallback(
      (value: number[]) => {
        setTorusSpeed(value[0]);
      },
      [setTorusSpeed],
    );

    const handleTorusMinorRadiusChange = useCallback(
      (value: number[]) => {
        setTorusMinorRadius(value[0]);
      },
      [setTorusMinorRadius],
    );

    return (
      <Card className="w-[320px] border-blue-500/30 bg-black/80 text-white backdrop-blur-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between text-lg font-bold text-blue-400">
            <span>Particle Controls</span>
            <div className="flex h-5 items-center">
              {isAudioReactive && (
                <Badge className="border-green-500 bg-green-500/20 text-xs text-green-400">
                  🎵 AUDIO REACTIVE
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-sm text-gray-300">
              Noise Intensity: {noiseIntensity.toFixed(2)}
            </Label>
            <Slider
              value={[noiseIntensity]}
              onValueChange={handleNoiseChange}
              max={1}
              min={0}
              step={0.01}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-gray-300">
              Sphere Pulse: {pulseAmplitude.toFixed(2)}
            </Label>
            <Slider
              value={[pulseAmplitude]}
              onValueChange={handlePulseChange}
              max={0.3}
              min={0}
              step={0.01}
              className="w-full"
            />
          </div>

          <div className="space-y-4 border-t border-blue-500/30 pt-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="torus-mode"
                checked={torusMode}
                onCheckedChange={handleTorusModeChange}
              />
              <Label htmlFor="torus-mode" className="cursor-pointer text-sm">
                Torus Mode
              </Label>
            </div>

            <div
              className={`space-y-4 border-l-2 border-blue-500/20 pl-6 transition-opacity duration-200 ${
                torusMode ? "opacity-100" : "pointer-events-none opacity-30"
              }`}
            >
              <div className="space-y-2">
                <Label className="text-sm text-gray-300">
                  Major Radius: {torusRadius.toFixed(2)}
                </Label>
                <Slider
                  value={[torusRadius]}
                  onValueChange={handleTorusRadiusChange}
                  max={2.0}
                  min={0.5}
                  step={0.01}
                  className="w-full"
                  disabled={!torusMode}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-gray-300">
                  Minor Radius (Thickness): {torusMinorRadius.toFixed(2)}
                </Label>
                <Slider
                  value={[torusMinorRadius]}
                  onValueChange={handleTorusMinorRadiusChange}
                  max={0.8}
                  min={0.1}
                  step={0.01}
                  className="w-full"
                  disabled={!torusMode}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-gray-300">
                  Rotation Speed: {torusSpeed.toFixed(2)}
                </Label>
                <Slider
                  value={[torusSpeed]}
                  onValueChange={handleTorusSpeedChange}
                  max={2}
                  min={0}
                  step={0.01}
                  className="w-full"
                  disabled={!torusMode}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  },
);

const ThreeScene = memo(
  ({
    noiseIntensity,
    pulseAmplitude,
    torusMode,
    torusRadius,
    torusSpeed,
    torusMinorRadius,
  }: ThreeSceneProps) => {
    return (
      <div className="fixed inset-0 bg-black">
        <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <FBOParticles
            noiseIntensity={noiseIntensity}
            pulseAmplitude={pulseAmplitude}
            torusMode={torusMode}
            torusRadius={torusRadius}
            torusSpeed={torusSpeed}
            torusMinorRadius={torusMinorRadius}
          />
          <OrbitControls makeDefault />
        </Canvas>
      </div>
    );
  },
);

const Scene = () => {
  // Use the audio-reactive particles hook
  const {
    particleParams,
    baseParams,
    setNoiseIntensity,
    setPulseAmplitude,
    setTorusMode,
    setTorusRadius,
    setTorusSpeed,
    setTorusMinorRadius,
    processAudioData,
    loadingState,
    triggerLoading,
  } = useAudioReactiveParticles();

  // Audio data callback from VoiceRecorder
  const handleAudioData = useCallback(
    (audioData: AudioData) => {
      processAudioData(audioData);
    },
    [processAudioData],
  );

  // Debug particle params changes (commented out to prevent spam)
  // useEffect(() => {
  //   console.log('🔄 Particle params updated:', particleParams);
  // }, [particleParams]);

  return (
    <>
      <div className="absolute left-5 top-5 z-[1000] flex flex-col gap-5">
        <Controls
          noiseIntensity={baseParams.noiseIntensity}
          setNoiseIntensity={setNoiseIntensity}
          pulseAmplitude={baseParams.pulseAmplitude}
          setPulseAmplitude={setPulseAmplitude}
          torusMode={baseParams.torusMode}
          setTorusMode={setTorusMode}
          torusRadius={baseParams.torusRadius}
          setTorusRadius={setTorusRadius}
          torusSpeed={baseParams.torusSpeed}
          setTorusSpeed={setTorusSpeed}
          torusMinorRadius={baseParams.torusMinorRadius}
          setTorusMinorRadius={setTorusMinorRadius}
          isAudioReactive={
            particleParams.noiseIntensity !== baseParams.noiseIntensity ||
            particleParams.pulseAmplitude !== baseParams.pulseAmplitude
          }
          onTriggerLoading={triggerLoading}
        />
        <VoiceRecorder onAudioData={handleAudioData} />
      </div>
      <ThreeScene
        noiseIntensity={particleParams.noiseIntensity}
        pulseAmplitude={particleParams.pulseAmplitude}
        torusMode={particleParams.torusMode}
        torusRadius={particleParams.torusRadius}
        torusSpeed={particleParams.torusSpeed}
        torusMinorRadius={particleParams.torusMinorRadius}
      />
    </>
  );
};

export default Scene;
