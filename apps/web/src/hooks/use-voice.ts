import { useState, useRef, useCallback, useEffect } from "react";

type AudioProcessingMode = "native" | "raw";

interface UseVoiceReturn {
  // State
  isRecording: boolean;
  isPlaying: boolean;
  hasPermission: boolean | null;
  recordedAudio: Blob | null;
  error: string | null;

  // Audio analysis
  currentVolume: number; // 0-100 for UI feedback
  isVoiceDetected: boolean; // voice activity detection

  // Real-time audio data for visualization
  audioData: {
    amplitude: number; // 0-1 normalized amplitude
    frequency: number; // dominant frequency in Hz
    frequencyData: Uint8Array; // raw frequency spectrum data
    bassLevel: number; // 0-1 bass frequencies
    midLevel: number; // 0-1 mid frequencies
    trebleLevel: number; // 0-1 treble frequencies
  };

  // Controls
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  playRecording: () => void;
  stopPlayback: () => void;
  clearRecording: () => void;
  getRecordedAudioAsWav: () => Promise<Blob | null>;

  // Audio Processing Mode
  audioProcessingMode: AudioProcessingMode;
  setAudioProcessingMode: (mode: AudioProcessingMode) => void;
}

interface AudioNodes {
  sourceNode: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  destinationNode: MediaStreamAudioDestinationNode;
}

/**
 * Encodes an AudioBuffer into a WAV file Blob.
 * @param audioBuffer The raw audio data.
 * @returns A Blob representing the WAV file.
 */
function encodeWav(audioBuffer: AudioBuffer): Blob {
  const numOfChan = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // Helper function to write strings
  function writeString(str: string) {
    for (i = 0; i < str.length; i++) {
      view.setUint8(pos++, str.charCodeAt(i));
    }
  }

  // RIFF header
  writeString("RIFF");
  view.setUint32(pos, 36 + audioBuffer.length * numOfChan * 2, true);
  pos += 4;
  writeString("WAVE");

  // fmt sub-chunk
  writeString("fmt ");
  view.setUint32(pos, 16, true);
  pos += 4; // Sub-chunk size
  view.setUint16(pos, 1, true);
  pos += 2; // PCM format
  view.setUint16(pos, numOfChan, true);
  pos += 2;
  view.setUint32(pos, audioBuffer.sampleRate, true);
  pos += 4;
  view.setUint32(pos, audioBuffer.sampleRate * 2 * numOfChan, true);
  pos += 4; // Byte rate
  view.setUint16(pos, numOfChan * 2, true);
  pos += 2; // Block align
  view.setUint16(pos, 16, true);
  pos += 2; // 16-bit

  // data sub-chunk
  writeString("data");
  view.setUint32(pos, audioBuffer.length * numOfChan * 2, true);
  pos += 4;

  // Write interleaved 16-bit PCM data
  for (i = 0; i < audioBuffer.numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  offset = 0;
  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // Clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // Scale to 16-bit
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([view], { type: "audio/wav" });
}

export function useVoice(): UseVoiceReturn {
  // Core state
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Audio analysis state
  const [currentVolume, setCurrentVolume] = useState(0);
  const [isVoiceDetected, setIsVoiceDetected] = useState(false);

  // Audio Processing Mode state
  const [audioProcessingMode, setAudioProcessingModeState] =
    useState<AudioProcessingMode>("native");

  // Refs for audio components
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioNodesRef = useRef<AudioNodes | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Voice activity detection parameters
  const volumeHistoryRef = useRef<number[]>([]);
  const voiceThreshold = 30; // Volume threshold for voice detection
  const historyLength = 10; // Number of volume samples to consider

  // Real-time audio data for visualization
  const [audioData, setAudioData] = useState({
    amplitude: 0,
    frequency: 0,
    frequencyData: new Uint8Array(512), // Match analyser.frequencyBinCount
    bassLevel: 0,
    midLevel: 0,
    trebleLevel: 0,
  });

  // Check browser compatibility
  const checkBrowserSupport = useCallback((): string | null => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return "MediaDevices API not supported";
    }

    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      return "Web Audio API not supported";
    }

    if (!window.MediaRecorder) {
      return "MediaRecorder API not supported";
    }

    return null;
  }, []);

  // Create audio processing chain
  const createAudioProcessingChain = useCallback(
    (
      audioContext: AudioContext,
      mediaStream: MediaStream,
      processingMode: AudioProcessingMode
    ): AudioNodes => {
      console.log(
        "🔧 Creating audio processing chain with mode:",
        processingMode
      );

      // Debug: Check audio context state
      console.log("🎵 Audio context state:", {
        state: audioContext.state,
        sampleRate: audioContext.sampleRate,
        currentTime: audioContext.currentTime,
      });

      // Force audio context to resume if suspended
      if (audioContext.state === "suspended") {
        console.log("⚡ Resuming suspended audio context...");
        audioContext
          .resume()
          .then(() => {
            console.log("✅ Audio context resumed successfully");
          })
          .catch((err) => {
            console.error("❌ Failed to resume audio context:", err);
          });
      }

      // Debug: Check media stream
      const audioTracks = mediaStream.getAudioTracks();
      const trackDetails = audioTracks.map((track) => ({
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        label: track.label,
        kind: track.kind,
        id: track.id,
      }));

      console.log("🎤 Media stream info:", {
        active: mediaStream.active,
        audioTracks: audioTracks.length,
        trackStates: trackDetails,
      });

      // Expand the first track details
      if (audioTracks.length > 0) {
        const track = audioTracks[0];
        console.log("🎤 First audio track details:", {
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          label: track.label,
          constraints: track.getConstraints(),
          settings: track.getSettings(),
        });
      }

      // Create source node
      const sourceNode = audioContext.createMediaStreamSource(mediaStream);
      console.log("📡 Source node created:", sourceNode);

      // Create analyser for all modes (needed for visualization)
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.05;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;

      console.log("🔍 Analyser created:", {
        fftSize: analyser.fftSize,
        frequencyBinCount: analyser.frequencyBinCount,
        smoothingTimeConstant: analyser.smoothingTimeConstant,
        minDecibels: analyser.minDecibels,
        maxDecibels: analyser.maxDecibels,
      });

      // Always connect analyser to source for visualization
      sourceNode.connect(analyser);
      console.log("🔗 Analyser connected directly to source node");

      // Create destination for processed audio
      const destinationNode = audioContext.createMediaStreamDestination();

      if (processingMode === "raw") {
        console.log("🎤 RAW MODE: Direct source → destination (no processing)");
        sourceNode.connect(destinationNode);
      } else {
        console.log("🌐 NATIVE MODE: Using browser built-ins only");
        // For native mode, we still connect directly but the browser's
        // built-in processing (if enabled in constraints) will handle everything
        sourceNode.connect(destinationNode);
      }

      console.log("✅ Audio processing chain created successfully");

      return {
        sourceNode,
        analyser,
        destinationNode,
      };
    },
    []
  );

  // Analyze audio volume and implement noise gate
  const analyzeAudio = useCallback(() => {
    const audioNodes = audioNodesRef.current;
    const audioContext = audioContextRef.current;

    if (!audioNodes || !audioContext) {
      console.log("🚫 analyzeAudio early return: missing nodes or context");
      return;
    }

    // Check audio context state
    if (audioContext.state !== "running") {
      console.log("⚠️ Audio context not running:", audioContext.state);
      if (audioContext.state === "suspended") {
        audioContext.resume().then(() => {
          console.log("✅ Audio context resumed in analyzeAudio");
        });
      }
    }

    const bufferLength = audioNodes.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeDomainArray = new Uint8Array(bufferLength);

    // Get both frequency and time domain data
    audioNodes.analyser.getByteFrequencyData(dataArray);
    audioNodes.analyser.getByteTimeDomainData(timeDomainArray);

    // Debug: Check if we're getting real audio data
    const hasAudioData = dataArray.some((value) => value > 0);
    const hasTimeDomainData = timeDomainArray.some((value) => value !== 128); // 128 is silence in time domain
    const maxDataValue = Math.max(...dataArray);
    const maxTimeDomainValue = Math.max(...timeDomainArray);
    const minTimeDomainValue = Math.min(...timeDomainArray);

    // Calculate time domain variance (better indicator of audio activity)
    let timeDomainSum = 0;
    for (let i = 0; i < timeDomainArray.length; i++) {
      const deviation = timeDomainArray[i] - 128;
      timeDomainSum += deviation * deviation;
    }
    const timeDomainVariance = timeDomainSum / timeDomainArray.length;

    // Log less frequently to avoid spam
    const shouldLog = Math.random() < 0.1; // Log ~10% of the time
    if (shouldLog) {
      console.log("🎵 Audio analysis debug:", {
        bufferLength,
        hasAudioData,
        hasTimeDomainData,
        maxDataValue,
        maxTimeDomainValue,
        minTimeDomainValue,
        timeDomainVariance: timeDomainVariance.toFixed(2),
        audioContextState: audioContext.state,
        analyserFftSize: audioNodes.analyser.fftSize,
        firstFewFreqValues: Array.from(dataArray.slice(0, 5)),
        firstFewTimeValues: Array.from(timeDomainArray.slice(0, 5)),
      });
    }

    // Use time domain data for volume calculation (more reliable)
    let sum = 0;
    for (let i = 0; i < timeDomainArray.length; i++) {
      const deviation = (timeDomainArray[i] - 128) / 128;
      sum += deviation * deviation;
    }
    const rms = Math.sqrt(sum / timeDomainArray.length);
    const volume = Math.round(rms * 100);
    const amplitude = rms; // Already normalized 0-1

    if (shouldLog) {
      console.log("📊 Volume calculation:", {
        rms: rms.toFixed(3),
        volume,
        amplitude: amplitude.toFixed(3),
      });
    }

    setCurrentVolume(volume);

    // Update volume history for voice activity detection
    volumeHistoryRef.current.push(volume);
    if (volumeHistoryRef.current.length > historyLength) {
      volumeHistoryRef.current.shift();
    }

    // Voice activity detection
    const averageVolume =
      volumeHistoryRef.current.reduce((sum, vol) => sum + vol, 0) /
      volumeHistoryRef.current.length;
    const isVoiceActive = averageVolume > voiceThreshold;
    setIsVoiceDetected(isVoiceActive);

    // Calculate dominant frequency
    let maxValue = 0;
    let maxIndex = 0;
    dataArray.forEach((value, index) => {
      if (value > maxValue) {
        maxValue = value;
        maxIndex = index;
      }
    });
    const sampleRate = audioContext.sampleRate;
    const frequency = (maxIndex * sampleRate) / audioNodes.analyser.fftSize;

    // Calculate frequency band levels
    const bassEnd = Math.floor((250 * bufferLength) / (sampleRate / 2)); // 0-250Hz
    const midEnd = Math.floor((4000 * bufferLength) / (sampleRate / 2)); // 250-4000Hz
    // Treble is everything above 4000Hz

    let bassSum = 0,
      midSum = 0,
      trebleSum = 0;
    let bassCount = 0,
      midCount = 0,
      trebleCount = 0;

    for (let i = 0; i < bufferLength; i++) {
      if (i <= bassEnd) {
        bassSum += dataArray[i];
        bassCount++;
      } else if (i <= midEnd) {
        midSum += dataArray[i];
        midCount++;
      } else {
        trebleSum += dataArray[i];
        trebleCount++;
      }
    }

    const bassLevel = bassCount > 0 ? bassSum / bassCount / 255 : 0;
    const midLevel = midCount > 0 ? midSum / midCount / 255 : 0;
    const trebleLevel = trebleCount > 0 ? trebleSum / trebleCount / 255 : 0;

    // Debug frequency analysis (less frequent logging)
    if (shouldLog && (hasAudioData || timeDomainVariance > 1)) {
      console.log("🎛️ Frequency analysis:", {
        bassLevel: bassLevel.toFixed(3),
        midLevel: midLevel.toFixed(3),
        trebleLevel: trebleLevel.toFixed(3),
        amplitude: amplitude.toFixed(3),
        dominantFreq: frequency.toFixed(0) + "Hz",
        timeDomainVariance: timeDomainVariance.toFixed(2),
      });
    }

    // Update audio data for visualization
    setAudioData({
      amplitude,
      frequency,
      frequencyData: new Uint8Array(dataArray),
      bassLevel,
      midLevel,
      trebleLevel,
    });

    // Continue analyzing as long as we have audio nodes
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, []);

  // Initialize audio context
  const initializeAudioContext =
    useCallback(async (): Promise<AudioContext> => {
      console.log("🎵 Initializing audio context...");
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();

      console.log("🎵 Audio context created:", {
        state: audioContext.state,
        sampleRate: audioContext.sampleRate,
        baseLatency: audioContext.baseLatency,
        outputLatency: audioContext.outputLatency,
      });

      // Handle user gesture requirement
      if (audioContext.state === "suspended") {
        console.log("⚡ Audio context suspended, attempting to resume...");
        await audioContext.resume();
        console.log("✅ Audio context resumed, new state:", audioContext.state);
      }

      // Double-check the state
      if (audioContext.state !== "running") {
        console.warn(
          "⚠️ Audio context not running after resume attempt:",
          audioContext.state
        );
        // Try one more time
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (audioContext.state === "suspended") {
          await audioContext.resume();
          console.log("🔄 Second resume attempt, state:", audioContext.state);
        }
      }

      return audioContext;
    }, []);

  // Request microphone permission and setup
  const requestMicrophoneAccess = useCallback(
    async (processingMode: AudioProcessingMode): Promise<MediaStream> => {
      try {
        let constraints: MediaStreamConstraints;

        if (processingMode === "native") {
          console.log(
            "🌐 Using NATIVE constraints (browser built-ins enabled)"
          );
          constraints = {
            audio: {
              channelCount: { ideal: 1, max: 1 },
              sampleRate: { ideal: 48_000 },
              // Enable browser's built-in processing for native mode
              echoCancellation: { ideal: true },
              noiseSuppression: { ideal: true },
              autoGainControl: { ideal: true },
            },
          };
        } else {
          console.log(
            `🔧 Using ${processingMode.toUpperCase()} constraints (browser built-ins disabled)`
          );
          constraints = {
            audio: {
              // keep mono/48 kHz for Web-RTC and RNNoise compatibility
              channelCount: { ideal: 1, max: 1 },
              sampleRate: { ideal: 48_000 },

              /* 🔑  Disable the browser's built-ins because
               we are adding our own DSP chain (gate + limiter + NR). */
              echoCancellation: { ideal: true },
              noiseSuppression: { ideal: false },
              autoGainControl: { ideal: false },
            },
          };
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia(
          constraints
        );
        setHasPermission(true);
        return mediaStream;
      } catch (err) {
        setHasPermission(false);
        if (err instanceof Error) {
          if (err.name === "NotAllowedError") {
            throw new Error("Microphone permission denied");
          } else if (err.name === "NotFoundError") {
            throw new Error("No microphone found");
          } else {
            throw new Error(`Microphone access failed: ${err.message}`);
          }
        }
        throw new Error("Unknown microphone access error");
      }
    },
    []
  );

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      console.log("🎙️ Starting recording process...");
      setError(null);

      // Check browser support
      console.log("🔍 Checking browser support...");
      const supportError = checkBrowserSupport();
      if (supportError) {
        throw new Error(supportError);
      }
      console.log("✅ Browser support confirmed");

      // Initialize audio context
      console.log("🎵 Initializing audio context...");
      const audioContext = await initializeAudioContext();
      audioContextRef.current = audioContext;
      console.log("✅ Audio context initialized");

      // Get microphone access
      console.log("🎤 Requesting microphone access...");
      const mediaStream = await requestMicrophoneAccess(audioProcessingMode);
      mediaStreamRef.current = mediaStream;
      console.log("✅ Microphone access granted");

      // Create audio processing chain
      console.log("🔧 Creating audio processing chain...");
      const audioNodes = createAudioProcessingChain(
        audioContext,
        mediaStream,
        audioProcessingMode
      );
      audioNodesRef.current = audioNodes;
      console.log("✅ Audio processing chain created");

      // Setup MediaRecorder with processed audio
      console.log("📹 Setting up MediaRecorder...");
      const processedStream = audioNodes.destinationNode.stream;
      console.log("📡 Processed stream info:", {
        active: processedStream.active,
        audioTracks: processedStream.getAudioTracks().length,
        id: processedStream.id,
      });

      // Determine best supported mimeType, prioritizing lossless
      const supportedMimeTypes = [
        "audio/wav", // Lossless WAV
        "audio/webm;codecs=opus", // High-quality lossy
        "audio/webm", // Default WebM
        "audio/ogg;codecs=opus", // Alternative
      ];

      const mimeType =
        supportedMimeTypes.find((type) =>
          MediaRecorder.isTypeSupported(type)
        ) || "";

      if (!mimeType) {
        console.warn(
          "⚠️ No preferred mimeType supported, using browser default."
        );
      }

      console.log(
        "🎬 Creating MediaRecorder with mimeType:",
        mimeType || "default"
      );

      const mediaRecorderOptions: MediaRecorderOptions = {
        mimeType,
      };

      // Opus is the only codec that really benefits from a specific bitrate
      if (mimeType.includes("opus")) {
        mediaRecorderOptions.audioBitsPerSecond = 160_000;
      }

      const mediaRecorder = new MediaRecorder(
        processedStream,
        mediaRecorderOptions
      );

      console.log("📹 MediaRecorder created:", {
        state: mediaRecorder.state,
        mimeType: mediaRecorder.mimeType,
        audioBitsPerSecond: mediaRecorder.audioBitsPerSecond,
      });

      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log("📊 Data available:", event.data.size, "bytes");
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log(
          "⏹️ MediaRecorder stopped, chunks:",
          recordedChunksRef.current.length
        );
        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, {
            type: mediaRecorder.mimeType,
          });
          console.log("💾 Recording blob created:", blob.size, "bytes");
          setRecordedAudio(blob);
        } else {
          console.warn("⚠️ No audio chunks recorded");
          setError("No audio data was recorded");
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("❌ MediaRecorder error:", event);
        setError("Recording failed: " + (event as any).error?.message);
      };

      mediaRecorder.onstart = () => {
        console.log("▶️ MediaRecorder started successfully");
      };

      mediaRecorder.onpause = () => {
        console.log("⏸️ MediaRecorder paused");
      };

      mediaRecorder.onresume = () => {
        console.log("▶️ MediaRecorder resumed");
      };

      mediaRecorderRef.current = mediaRecorder;
      console.log("📹 MediaRecorder reference set");

      // Start recording and analysis
      console.log("🎬 Starting MediaRecorder...");
      mediaRecorder.start(100); // Collect data every 100ms
      console.log("📹 MediaRecorder.start() called");

      // Set recording state
      setIsRecording(true);
      console.log("✅ Recording state set to true");

      // Start audio analysis - this will continue running for visualization
      console.log("🔍 Starting audio analysis...");
      analyzeAudio();
      console.log("✅ Audio analysis started");

      console.log("🎉 Recording setup completed successfully!");
    } catch (err) {
      console.error("❌ Error in startRecording:", err);
      setError(
        err instanceof Error ? err.message : "Failed to start recording"
      );
      cleanup();
    }
  }, [
    checkBrowserSupport,
    initializeAudioContext,
    requestMicrophoneAccess,
    createAudioProcessingChain,
    analyzeAudio,
  ]);

  // Stop recording
  const stopRecording = useCallback(() => {
    console.log("🛑 Stopping recording...");
    console.log("🔍 Current state:", {
      isRecording,
      hasMediaRecorder: !!mediaRecorderRef.current,
      mediaRecorderState: mediaRecorderRef.current?.state,
      hasAudioNodes: !!audioNodesRef.current,
      hasAudioContext: !!audioContextRef.current,
      hasMediaStream: !!mediaStreamRef.current,
    });

    // First, set recording state to false to update UI immediately
    setIsRecording(false);

    const recorder = mediaRecorderRef.current;
    if (recorder) {
      console.log("📹 MediaRecorder state:", recorder.state);

      if (recorder.state === "recording") {
        console.log("⏹️ Stopping MediaRecorder...");
        recorder.stop();
      } else if (recorder.state === "paused") {
        console.log("⏹️ Resuming and stopping paused MediaRecorder...");
        recorder.resume();
        recorder.stop();
      } else {
        console.log("⚠️ MediaRecorder not in recording state:", recorder.state);
      }
    } else {
      console.log("⚠️ No MediaRecorder found");
    }

    // Stop audio analysis immediately
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      console.log("🔇 Audio analysis stopped");
    }

    // Reset audio analysis state
    setCurrentVolume(0);
    setIsVoiceDetected(false);
    volumeHistoryRef.current = [];

    // Reset audio visualization data
    setAudioData({
      amplitude: 0,
      frequency: 0,
      frequencyData: new Uint8Array(512), // Match the new fftSize
      bassLevel: 0,
      midLevel: 0,
      trebleLevel: 0,
    });

    // Clean up audio nodes and context
    if (audioNodesRef.current) {
      const nodes = audioNodesRef.current;
      try {
        console.log("🔌 Disconnecting audio nodes...");
        nodes.sourceNode.disconnect();
        nodes.analyser.disconnect();
        nodes.destinationNode.disconnect();
        console.log("✅ Audio nodes disconnected");
      } catch (err) {
        console.warn("⚠️ Error disconnecting audio nodes:", err);
      }
      audioNodesRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      console.log("🔇 Closing audio context...");
      audioContextRef.current
        .close()
        .then(() => {
          console.log("✅ Audio context closed");
        })
        .catch((err) => {
          console.warn("⚠️ Error closing audio context:", err);
        });
      audioContextRef.current = null;
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      console.log("🎤 Stopping media stream tracks...");
      mediaStreamRef.current.getTracks().forEach((track) => {
        console.log(`🛑 Stopping track: ${track.kind} - ${track.label}`);
        track.stop();
      });
      mediaStreamRef.current = null;
      console.log("✅ Media stream stopped");
    }

    // Clear MediaRecorder reference
    mediaRecorderRef.current = null;

    console.log("✅ Recording stopped and cleaned up");
  }, []);

  // Play recorded audio
  const playRecording = useCallback(() => {
    if (recordedAudio && !isPlaying) {
      const audioUrl = URL.createObjectURL(recordedAudio);
      const audio = new Audio(audioUrl);

      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setError("Failed to play recording");
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      playbackAudioRef.current = audio;
      audio.play().catch((err) => {
        setError("Playback failed: " + err.message);
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      });
    }
  }, [recordedAudio, isPlaying]);

  // Stop playback
  const stopPlayback = useCallback(() => {
    if (playbackAudioRef.current && isPlaying) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, [isPlaying]);

  // Clear recording
  const clearRecording = useCallback(() => {
    setRecordedAudio(null);
    recordedChunksRef.current = [];
    if (isPlaying) {
      stopPlayback();
    }
  }, [isPlaying, stopPlayback]);

  const getRecordedAudioAsWav = useCallback(async (): Promise<Blob | null> => {
    if (!recordedAudio) {
      setError("No audio recorded to convert to WAV.");
      console.error("getRecordedAudioAsWav called with no recordedAudio blob.");
      return null;
    }

    // Use a temporary AudioContext to decode the audio data.
    // This is safer than relying on the main context, which might be closed.
    const tempAudioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();

    try {
      const arrayBuffer = await recordedAudio.arrayBuffer();
      const audioBuffer = await tempAudioContext.decodeAudioData(arrayBuffer);
      const wavBlob = encodeWav(audioBuffer);
      return wavBlob;
    } catch (err) {
      console.error("Failed to convert audio to WAV:", err);
      setError(
        "Failed to convert to WAV format. The recording might be too short or corrupted."
      );
      return null;
    } finally {
      // Clean up the temporary context
      tempAudioContext.close();
    }
  }, [recordedAudio]);

  // Set Audio Processing Mode
  const setAudioProcessingMode = useCallback((mode: AudioProcessingMode) => {
    setAudioProcessingModeState(mode);
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log("🧹 Starting cleanup...");

    // Stop audio analysis
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      console.log("🔇 Audio analysis stopped in cleanup");
    }

    // Stop MediaRecorder if active
    if (mediaRecorderRef.current) {
      const recorder = mediaRecorderRef.current;
      if (recorder.state === "recording" || recorder.state === "paused") {
        console.log("⏹️ Stopping MediaRecorder in cleanup");
        recorder.stop();
      }
      mediaRecorderRef.current = null;
    }

    // Stop playback if active
    if (playbackAudioRef.current && isPlaying) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current.currentTime = 0;
      setIsPlaying(false);
      console.log("⏸️ Playback stopped in cleanup");
    }

    // Disconnect audio nodes
    if (audioNodesRef.current) {
      const nodes = audioNodesRef.current;
      try {
        nodes.sourceNode.disconnect();
        nodes.analyser.disconnect();
        nodes.destinationNode.disconnect();
        console.log("🔌 Audio nodes disconnected in cleanup");
      } catch (err) {
        console.warn("⚠️ Error disconnecting audio nodes in cleanup:", err);
      }
      audioNodesRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close().catch((err) => {
        console.warn("⚠️ Error closing audio context in cleanup:", err);
      });
      audioContextRef.current = null;
      console.log("🔇 Audio context closed in cleanup");
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      console.log("🎤 Media stream stopped in cleanup");
    }

    // Reset state
    setIsRecording(false);
    setCurrentVolume(0);
    setIsVoiceDetected(false);
    volumeHistoryRef.current = [];

    // Reset audio visualization data
    setAudioData({
      amplitude: 0,
      frequency: 0,
      frequencyData: new Uint8Array(512), // Match the new fftSize
      bassLevel: 0,
      midLevel: 0,
      trebleLevel: 0,
    });

    console.log("✅ Cleanup completed");
  }, [isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    // State
    isRecording,
    isPlaying,
    hasPermission,
    recordedAudio,
    error,

    // Audio analysis
    currentVolume,
    isVoiceDetected,

    // Real-time audio data for visualization
    audioData,

    // Controls
    startRecording,
    stopRecording,
    playRecording,
    stopPlayback,
    clearRecording,

    // Settings
    getRecordedAudioAsWav,

    // Audio Processing Mode
    audioProcessingMode,
    setAudioProcessingMode,
  };
}
