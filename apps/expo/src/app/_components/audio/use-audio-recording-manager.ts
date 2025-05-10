/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { RecordingOptions } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  RecordingPresets,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

export interface AudioRecordingData {
  uri: string;
  waveformData: number[];
}

export interface UseAudioRecordingManagerResult {
  // Recording states
  isRecording: boolean;
  isPaused: boolean;
  recordingDuration: number;
  recordingData: AudioRecordingData | null;
  waveformData: number[];

  // Playback states
  isPlaying: boolean;
  playbackPosition: number;
  playbackDuration: number;

  // Actions
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<void>;
  playRecording: () => Promise<void>;
  pausePlayback: () => void;
  stopPlayback: () => Promise<void>;
  resetRecording: () => void;
}

export function useAudioRecordingManager(
  options: RecordingOptions = {
    ...RecordingPresets.HIGH_QUALITY!,
    isMeteringEnabled: true, // Enable metering explicitly
  },
  updateInterval = 16, // ~60fps for smooth visualization
): UseAudioRecordingManagerResult {
  // State for recording data
  const [recordingData, setRecordingData] = useState<AudioRecordingData | null>(
    null,
  );

  // Additional state to track pause state (since we need to know if recording is paused)
  const [isPausedState, setIsPausedState] = useState(false);

  // Waveform data collection
  const [waveformData, setWaveformData] = useState<number[]>([]);

  // Manual duration tracking (in case native durationMillis isn't working)
  const [manualDuration, setManualDuration] = useState(0);
  const recordingStartTimeRef = useRef<number | null>(null);
  const pausedDurationRef = useRef(0);

  // Initialize recorder and player
  const recorder = useAudioRecorder(options);
  // Update more frequently (100ms) for smoother playback position updates
  const recorderState = useAudioRecorderState(recorder, updateInterval);
  const player = useAudioPlayer(recordingData?.uri);
  // We can't adjust the update interval here, but we'll poll more frequently below
  const playerStatus = useAudioPlayerStatus(player);

  // Manual polling for more frequent playback position updates
  const [manualPlaybackPosition, setManualPlaybackPosition] = useState(0);

  // Poll player position more frequently during playback
  useEffect(() => {
    if (player && playerStatus.playing) {
      const timer = setInterval(() => {
        // Get current time directly from player
        const currentTime = player.currentTime;
        setManualPlaybackPosition(currentTime * 1000); // Convert to ms
      }, 100); // Poll every 100ms

      return () => clearInterval(timer);
    }
  }, [player, playerStatus.playing]);

  // Generate waveform data during recording
  useEffect(() => {
    if (recorderState.isRecording) {
      const timer = setInterval(() => {
        // Update manual duration
        if (recordingStartTimeRef.current !== null && !isPausedState) {
          const elapsedTime = Date.now() - recordingStartTimeRef.current;
          setManualDuration(pausedDurationRef.current + elapsedTime);
        }

        // If metering is available, use it (convert from dB to 0-1 range)
        if (typeof recorderState.metering === "number") {
          const dbValue = recorderState.metering;
          // dB values are typically negative (-60 to 0), normalize to 0-1
          const normalizedValue = Math.max(0, 1.0 + dbValue / 60);
          setWaveformData((prev) => {
            const newData = [...prev, normalizedValue];
            return newData.slice(-100); // Keep max 100 points
          });
        } else {
          // If metering not available, generate synthetic waveform based on audio activity
          // Simple oscillating pattern to look like speech
          const baseValue = 0.3;
          const randomAmplitude = Math.random() * 0.5;
          setWaveformData((prev) => {
            const newData = [...prev, baseValue + randomAmplitude];
            return newData.slice(-100);
          });
        }
      }, 100); // Update 10 times per second for smoother visualization

      return () => clearInterval(timer);
    }
  }, [recorderState.isRecording, recorderState.metering, isPausedState]);

  // Derived states
  const isRecording = Boolean(recorderState.isRecording);
  const isPaused = isPausedState;
  const isPlaying = Boolean(playerStatus.playing);

  // Recording actions
  const startRecording = useCallback(async () => {
    try {
      // Reset states
      setRecordingData(null);
      setIsPausedState(false);
      setWaveformData([]);
      setManualDuration(0);
      recordingStartTimeRef.current = Date.now();
      pausedDurationRef.current = 0;

      // Using actual recorder methods from AudioModule.types.ts
      // First prepare to record with options
      await recorder.prepareToRecordAsync(options);
      // Then start recording
      recorder.record();
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  }, [recorder, options]);

  const pauseRecording = useCallback(() => {
    if (isRecording) {
      try {
        recorder.pause();
        setIsPausedState(true);
        // Store current duration for resuming later
        pausedDurationRef.current = manualDuration;
      } catch (error) {
        console.error("Failed to pause recording:", error);
      }
    }
  }, [recorder, isRecording, manualDuration]);

  const resumeRecording = useCallback(() => {
    if (isPaused) {
      try {
        recorder.record();
        setIsPausedState(false);
        // Reset start time for continuing duration count
        recordingStartTimeRef.current = Date.now();
      } catch (error) {
        console.error("Failed to resume recording:", error);
      }
    }
  }, [recorder, isPaused]);

  const stopRecording = useCallback(async () => {
    if (isRecording || isPaused) {
      try {
        await recorder.stop();
        const uri = recorder.uri;
        setIsPausedState(false);
        // Finalize the manual duration
        pausedDurationRef.current = manualDuration;
        recordingStartTimeRef.current = null;

        if (uri) {
          // Ensure we have at least some waveform data for playback visualization
          let finalWaveformData = [...waveformData];
          if (finalWaveformData.length < 50) {
            // Generate some waveform data if we don't have enough
            finalWaveformData = Array(50)
              .fill(0)
              .map(() => 0.3 + Math.random() * 0.5);
          }

          setRecordingData({
            uri,
            waveformData: finalWaveformData,
          });
        }
      } catch (error) {
        console.error("Failed to stop recording:", error);
      }
    }
  }, [recorder, waveformData, isRecording, isPaused, manualDuration]);

  // Playback actions
  const playRecording = useCallback(async () => {
    if (recordingData) {
      try {
        // If playback finished, seek back to start
        if (playerStatus.currentTime >= playerStatus.duration) {
          await player.seekTo(0);
        }
        player.play();
      } catch (error) {
        console.error("Failed to play recording:", error);
      }
    }
  }, [player, playerStatus, recordingData]);

  const pausePlayback = useCallback(() => {
    if (isPlaying) {
      try {
        player.pause();
      } catch (error) {
        console.error("Failed to pause playback:", error);
      }
    }
  }, [player, isPlaying]);

  const stopPlayback = useCallback(async () => {
    try {
      player.pause();
      await player.seekTo(0);
    } catch (error) {
      console.error("Failed to stop playback:", error);
    }
  }, [player]);

  const resetRecording = useCallback(() => {
    setRecordingData(null);
    setWaveformData([]);
    setManualDuration(0);
    pausedDurationRef.current = 0;
    recordingStartTimeRef.current = null;
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      void (async () => {
        if (isRecording || isPaused) {
          try {
            await recorder.stop();
          } catch (e) {
            console.error("Error cleaning up recorder:", e);
          }
        }
      })();
    };
  }, [recorder, player, isRecording, isPaused]);

  return {
    // Recording states
    isRecording,
    isPaused,
    recordingDuration: recorderState.durationMillis || manualDuration || 0,
    recordingData,
    waveformData,

    // Playback states
    isPlaying,
    playbackPosition:
      manualPlaybackPosition || playerStatus.currentTime * 1000 || 0,
    playbackDuration: playerStatus.duration * 1000 || 0, // Convert to ms

    // Actions
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    playRecording,
    pausePlayback,
    stopPlayback,
    resetRecording,
  };
}

export default useAudioRecordingManager;
