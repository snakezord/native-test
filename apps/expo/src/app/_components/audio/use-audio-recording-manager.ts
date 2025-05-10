/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { RecordingOptions } from "expo-audio";
import { useCallback, useEffect, useState } from "react";
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
  options: RecordingOptions = RecordingPresets.HIGH_QUALITY!,
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

  // Initialize recorder and player
  const recorder = useAudioRecorder(options);
  const recorderState = useAudioRecorderState(recorder, updateInterval);
  const player = useAudioPlayer(recordingData?.uri);
  const playerStatus = useAudioPlayerStatus(player);

  // Update waveform data when metering changes
  useEffect(() => {
    if (
      recorderState.isRecording &&
      typeof recorderState.metering === "number"
    ) {
      setWaveformData((prev) => {
        // Keep a maximum of 100 data points
        const newData = [...prev, recorderState.metering ?? 0];
        return newData.slice(-100);
      });
    }
  }, [recorderState.metering, recorderState.isRecording]);

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
      } catch (error) {
        console.error("Failed to pause recording:", error);
      }
    }
  }, [recorder, isRecording]);

  const resumeRecording = useCallback(() => {
    if (isPaused) {
      try {
        recorder.record();
        setIsPausedState(false);
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
        if (uri) {
          setRecordingData({
            uri,
            waveformData: [...waveformData],
          });
        }
      } catch (error) {
        console.error("Failed to stop recording:", error);
      }
    }
  }, [recorder, waveformData, isRecording, isPaused]);

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

        try {
          player.remove();
        } catch (e) {
          console.error("Error cleaning up player:", e);
        }
      })();
    };
  }, [recorder, player, isRecording, isPaused]);

  return {
    // Recording states
    isRecording,
    isPaused,
    recordingDuration: recorderState.durationMillis || 0,
    recordingData,
    waveformData,

    // Playback states
    isPlaying,
    playbackPosition: playerStatus.currentTime || 0,
    playbackDuration: playerStatus.duration || 0,

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
