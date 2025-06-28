import { useEffect, useRef, useState, useCallback } from "react";

export interface AudioData {
  frequency: number;
  amplitude: number;
  frequencyData: Uint8Array;
  isPlaying: boolean;
}

export interface UseAudioAnalyzerOptions {
  fftSize?: number;
  smoothingTimeConstant?: number;
}

export const useAudioAnalyzer = (
  audioElement: HTMLAudioElement | null,
  options: UseAudioAnalyzerOptions = {}
) => {
  const { fftSize = 256, smoothingTimeConstant = 0.8 } = options;

  const [audioData, setAudioData] = useState<AudioData>({
    frequency: 0,
    amplitude: 0,
    frequencyData: new Uint8Array(fftSize / 2),
    isPlaying: false,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const initializeAudioContext = useCallback(() => {
    if (!audioElement || audioContextRef.current) return;

    try {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      analyzerRef.current = audioContextRef.current.createAnalyser();

      analyzerRef.current.fftSize = fftSize;
      analyzerRef.current.smoothingTimeConstant = smoothingTimeConstant;

      sourceRef.current =
        audioContextRef.current.createMediaElementSource(audioElement);
      sourceRef.current.connect(analyzerRef.current);
      analyzerRef.current.connect(audioContextRef.current.destination);
    } catch (error) {
      console.error("Failed to initialize audio context:", error);
    }
  }, [audioElement, fftSize, smoothingTimeConstant]);

  const analyzeAudio = useCallback(() => {
    if (!analyzerRef.current) return;

    const frequencyData = new Uint8Array(analyzerRef.current.frequencyBinCount);
    analyzerRef.current.getByteFrequencyData(frequencyData);

    // Calculate average amplitude
    const amplitude =
      frequencyData.reduce((sum, value) => sum + value, 0) /
      frequencyData.length /
      255;

    // Calculate dominant frequency
    let maxValue = 0;
    let maxIndex = 0;
    frequencyData.forEach((value, index) => {
      if (value > maxValue) {
        maxValue = value;
        maxIndex = index;
      }
    });

    const frequency =
      (maxIndex * (audioContextRef.current?.sampleRate || 44100)) /
      (fftSize * 2);

    setAudioData({
      frequency,
      amplitude,
      frequencyData,
      isPlaying: !audioElement?.paused || false,
    });

    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, [audioElement, fftSize]);

  const startAnalysis = useCallback(() => {
    if (audioContextRef.current?.state === "suspended") {
      audioContextRef.current.resume();
    }
    analyzeAudio();
  }, [analyzeAudio]);

  const stopAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  useEffect(() => {
    if (!audioElement) return;

    const handlePlay = () => {
      initializeAudioContext();
      startAnalysis();
    };

    const handlePause = () => {
      stopAnalysis();
    };

    audioElement.addEventListener("play", handlePlay);
    audioElement.addEventListener("pause", handlePause);
    audioElement.addEventListener("ended", handlePause);

    return () => {
      audioElement.removeEventListener("play", handlePlay);
      audioElement.removeEventListener("pause", handlePause);
      audioElement.removeEventListener("ended", handlePause);
      stopAnalysis();
    };
  }, [audioElement, initializeAudioContext, startAnalysis, stopAnalysis]);

  useEffect(() => {
    return () => {
      stopAnalysis();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopAnalysis]);

  return audioData;
};
