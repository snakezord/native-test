import { useState, useEffect, useRef, useCallback } from "react";

interface AudioData {
  amplitude: number;
  frequency: number;
  frequencyData: Uint8Array;
  bassLevel: number;
  midLevel: number;
  trebleLevel: number;
  isRecording: boolean;
}

interface ParticleParams {
  noiseIntensity: number;
  pulseAmplitude: number;
  torusMode: boolean;
  torusRadius: number;
  torusSpeed: number;
  torusMinorRadius: number;
}

interface LoadingState {
  isLoading: boolean;
  progress: number;
  type: "processing" | "analyzing" | "generating" | "idle";
}

// Smooth interpolation utility
const lerp = (start: number, end: number, factor: number) => {
  return start + (end - start) * factor;
};

export const useAudioReactiveParticles = () => {
  // Base particle parameters
  const [baseParams, setBaseParams] = useState<ParticleParams>({
    noiseIntensity: 0.03,
    pulseAmplitude: 0.02,
    torusMode: false,
    torusRadius: 1.0,
    torusSpeed: 1.0,
    torusMinorRadius: 0.3,
  });

  // Audio-driven particle parameters
  const [audioParams, setAudioParams] = useState<ParticleParams>({
    noiseIntensity: 0.03,
    pulseAmplitude: 0.02,
    torusMode: false,
    torusRadius: 1.0,
    torusSpeed: 1.0,
    torusMinorRadius: 0.3,
  });

  // Loading simulation state
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    progress: 0,
    type: "idle",
  });

  // Recording flow state
  const [recordingPhase, setRecordingPhase] = useState<
    "idle" | "pre-recording-loading" | "recording" | "post-recording-loading"
  >("idle");

  // Animation frames for smooth interpolation
  const animationFrameRef = useRef<number | null>(null);

  // Target parameters for smooth transitions
  const targetParamsRef = useRef<ParticleParams>(audioParams);
  const currentParamsRef = useRef<ParticleParams>(audioParams);

  // Track recording state to detect transitions
  const wasRecordingRef = useRef<boolean>(false);
  const hasTriggeredStartRef = useRef<boolean>(false);

  // Track if we're waiting for actual recording to start
  const shouldStartRecordingRef = useRef<boolean>(false);
  const shouldStopRecordingRef = useRef<boolean>(false);

  // Smooth parameter interpolation
  const updateSmoothParams = useCallback(() => {
    const smoothingFactor = 0.08; // Adjust for faster/slower transitions

    const newParams = {
      noiseIntensity: lerp(
        currentParamsRef.current.noiseIntensity,
        targetParamsRef.current.noiseIntensity,
        smoothingFactor
      ),
      pulseAmplitude: lerp(
        currentParamsRef.current.pulseAmplitude,
        targetParamsRef.current.pulseAmplitude,
        smoothingFactor
      ),
      torusMode: targetParamsRef.current.torusMode, // Boolean, no interpolation
      torusRadius: lerp(
        currentParamsRef.current.torusRadius,
        targetParamsRef.current.torusRadius,
        smoothingFactor
      ),
      torusSpeed: lerp(
        currentParamsRef.current.torusSpeed,
        targetParamsRef.current.torusSpeed,
        smoothingFactor
      ),
      torusMinorRadius: lerp(
        currentParamsRef.current.torusMinorRadius,
        targetParamsRef.current.torusMinorRadius,
        smoothingFactor
      ),
    };

    // Only update state if values have actually changed (prevent infinite loops)
    const threshold = 0.001;
    const hasChanged =
      Math.abs(
        newParams.noiseIntensity - currentParamsRef.current.noiseIntensity
      ) > threshold ||
      Math.abs(
        newParams.pulseAmplitude - currentParamsRef.current.pulseAmplitude
      ) > threshold ||
      newParams.torusMode !== currentParamsRef.current.torusMode ||
      Math.abs(newParams.torusRadius - currentParamsRef.current.torusRadius) >
        threshold ||
      Math.abs(newParams.torusSpeed - currentParamsRef.current.torusSpeed) >
        threshold ||
      Math.abs(
        newParams.torusMinorRadius - currentParamsRef.current.torusMinorRadius
      ) > threshold;

    currentParamsRef.current = newParams;

    // Only trigger state update if there's a meaningful change
    if (hasChanged) {
      setAudioParams(newParams);
    }

    // Continue animation
    animationFrameRef.current = requestAnimationFrame(updateSmoothParams);
  }, []);

  // Start smooth animation loop
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(updateSmoothParams);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updateSmoothParams]);

  // Simulate loading states for realism
  const simulateLoading = useCallback(
    (
      type: LoadingState["type"],
      duration: number = 3000,
      onComplete?: () => void
    ) => {
      console.log(`🔄 Starting ${type} loading simulation for ${duration}ms`);

      // Enable torus mode during loading
      setBaseParams((prev) => ({ ...prev, torusMode: true }));

      setLoadingState({
        isLoading: true,
        progress: 0,
        type,
      });

      const startTime = Date.now();

      const updateProgress = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        setLoadingState((prev) => ({
          ...prev,
          progress: progress * 100,
        }));

        if (progress < 1) {
          setTimeout(updateProgress, 50);
        } else {
          console.log(`✅ ${type} loading completed`);
          setLoadingState({
            isLoading: false,
            progress: 100,
            type: "idle",
          });

          // Disable torus mode after loading completes
          setTimeout(() => {
            setBaseParams((prev) => ({ ...prev, torusMode: false }));
            // Execute completion callback if provided
            if (onComplete) {
              onComplete();
            }
          }, 500); // Small delay for smooth transition
        }
      };

      updateProgress();
    },
    []
  );

  // Test loading on component mount (for debugging)
  useEffect(() => {
    console.log("🚀 useAudioReactiveParticles initialized");
    // Removed automatic loading test
  }, []);

  // Process audio data and update particle parameters
  const processAudioData = useCallback(
    (audioData: AudioData) => {
      const shouldLog = Math.random() < 0.1; // Log ~10% of calls

      // Handle the recording flow state machine
      const currentlyRecording = audioData.isRecording;
      const wasRecording = wasRecordingRef.current;

      if (shouldLog) {
        console.log("🎵 Processing audio data:", {
          recordingPhase,
          currentlyRecording,
          wasRecording,
          isLoading: loadingState.isLoading,
          amplitude: audioData.amplitude.toFixed(3),
        });
      }

      // State machine for recording flow
      if (!wasRecording && currentlyRecording) {
        // START RECORDING: User clicked record button
        if (recordingPhase === "idle") {
          console.log(
            "🎬 START: Clicked Record -> Starting pre-recording loading"
          );
          setRecordingPhase("pre-recording-loading");
          shouldStartRecordingRef.current = true;

          // Trigger pre-recording loading simulation
          simulateLoading("analyzing", 1500, () => {
            console.log(
              "✅ Pre-recording loading complete -> Starting actual recording"
            );
            setRecordingPhase("recording");
            shouldStartRecordingRef.current = false;
          });

          wasRecordingRef.current = true;
          return;
        }
      } else if (wasRecording && !currentlyRecording) {
        // STOP RECORDING: User clicked stop button
        if (recordingPhase === "recording") {
          console.log(
            "🛑 STOP: Clicked Stop -> Starting post-recording loading"
          );
          setRecordingPhase("post-recording-loading");
          shouldStopRecordingRef.current = true;

          // Trigger post-recording loading simulation
          simulateLoading("processing", 2000, () => {
            console.log("✅ Post-recording loading complete -> Back to idle");
            setRecordingPhase("idle");
            shouldStopRecordingRef.current = false;
            wasRecordingRef.current = false;
          });

          return;
        }
      }

      // Skip audio processing during loading phases
      if (
        recordingPhase === "pre-recording-loading" ||
        recordingPhase === "post-recording-loading" ||
        loadingState.isLoading
      ) {
        if (shouldLog) {
          console.log(
            `⏸️ Skipping audio processing during ${recordingPhase} phase`
          );
        }
        targetParamsRef.current = baseParams;
        return;
      }

      // Only process audio during actual recording phase
      if (recordingPhase !== "recording" || !currentlyRecording) {
        targetParamsRef.current = baseParams;
        return;
      }

      // ACTUAL RECORDING: Process audio data
      const {
        amplitude,
        bassLevel,
        midLevel,
        trebleLevel,
        frequency,
        frequencyData,
      } = audioData;

      // Advanced frequency analysis for more nuanced control
      const frequencyBins = frequencyData.length;

      // Calculate sub-bass (20-60Hz), bass (60-250Hz), mid (250-2kHz), treble (2kHz+)
      const subBassRange = Math.floor(frequencyBins * 0.02); // ~2% of spectrum
      const bassRange = Math.floor(frequencyBins * 0.12); // ~12% of spectrum
      const midRange = Math.floor(frequencyBins * 0.4); // ~40% of spectrum

      let subBassLevel = 0;
      for (let i = 0; i < subBassRange; i++) {
        subBassLevel += frequencyData[i] / 255;
      }
      subBassLevel /= subBassRange;

      // Use existing levels but enhance with sub-bass
      const enhancedBass = Math.max(bassLevel, subBassLevel * 1.2);

      // Enhanced mapping with more nuanced audio response
      // Noise intensity driven by overall amplitude and mid frequencies
      const noiseIntensity = Math.min(
        1.0,
        baseParams.noiseIntensity + amplitude * 0.7 + midLevel * 0.5
      );

      // Pulse amplitude driven by enhanced bass frequencies with sub-bass response
      const pulseAmplitude = Math.min(
        0.6,
        baseParams.pulseAmplitude + enhancedBass * 0.6 + amplitude * 0.2
      );

      // Torus mode is ONLY controlled by loading state, not audio
      const torusMode = baseParams.torusMode;

      // Torus parameters still driven by frequency content for when loading is active
      const torusRadius = Math.max(
        0.5,
        Math.min(
          2.5,
          baseParams.torusRadius + trebleLevel * 1.0 + amplitude * 0.3
        )
      );
      const torusSpeed = Math.max(
        0.1,
        Math.min(
          4.0,
          baseParams.torusSpeed + amplitude * 2.5 + enhancedBass * 0.8
        )
      );
      const torusMinorRadius = Math.max(
        0.1,
        Math.min(
          0.9,
          baseParams.torusMinorRadius + midLevel * 0.4 + trebleLevel * 0.2
        )
      );

      const newAudioParams = {
        noiseIntensity,
        pulseAmplitude,
        torusMode,
        torusRadius,
        torusSpeed,
        torusMinorRadius,
      };

      if (shouldLog) {
        console.log("🎛️ New audio params (target):", newAudioParams);
      }

      // Set target for smooth interpolation instead of direct update
      targetParamsRef.current = newAudioParams;
    },
    [baseParams, loadingState.isLoading, simulateLoading, recordingPhase]
  );

  // Manual control functions for base parameters
  const setNoiseIntensity = useCallback((value: number) => {
    setBaseParams((prev) => ({ ...prev, noiseIntensity: value }));
  }, []);

  const setPulseAmplitude = useCallback((value: number) => {
    setBaseParams((prev) => ({ ...prev, pulseAmplitude: value }));
  }, []);

  const setTorusMode = useCallback((value: boolean) => {
    setBaseParams((prev) => ({ ...prev, torusMode: value }));
  }, []);

  const setTorusRadius = useCallback((value: number) => {
    setBaseParams((prev) => ({ ...prev, torusRadius: value }));
  }, []);

  const setTorusSpeed = useCallback((value: number) => {
    setBaseParams((prev) => ({ ...prev, torusSpeed: value }));
  }, []);

  const setTorusMinorRadius = useCallback((value: number) => {
    setBaseParams((prev) => ({ ...prev, torusMinorRadius: value }));
  }, []);

  // Manual loading triggers
  const triggerLoading = useCallback(
    (type: LoadingState["type"]) => {
      if (!loadingState.isLoading) {
        simulateLoading(type);
      }
    },
    [loadingState.isLoading, simulateLoading]
  );

  return {
    // Current particle parameters (audio-reactive)
    particleParams: audioParams,

    // Base parameter controls
    baseParams,
    setNoiseIntensity,
    setPulseAmplitude,
    setTorusMode,
    setTorusRadius,
    setTorusSpeed,
    setTorusMinorRadius,

    // Audio processing
    processAudioData,

    // Loading simulation
    loadingState,
    triggerLoading,

    // Recording flow state
    recordingPhase,

    // Manual overrides
    simulateLoading,
  };
};
