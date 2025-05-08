import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  RecordingPresets,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import { AudioWaveformWithTimeline } from "./audio/wave";

// Define a type to store both the audio URI and its waveform data
interface AudioRecordingData {
  uri: string;
  waveformData: number[];
}

export default function AudioRecording() {
  // Recorder
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY!);
  const recorderState = useAudioRecorderState(recorder, 50); // Update every 50ms for smoother visualization
  const [recordingData, setRecordingData] = useState<AudioRecordingData | null>(
    null,
  );
  const [isPaused, setIsPaused] = useState(false);
  const [meterValues, setMeterValues] = useState<number[]>([]);

  // Playback
  const player = useAudioPlayer(recordingData?.uri);
  const playerStatus = useAudioPlayerStatus(player);

  // Update meter values during recording
  useEffect(() => {
    if (recorderState.isRecording && recorderState.metering !== undefined) {
      // Normalize meter value (typically logarithmic dB scale) to 0-1 range
      // Values typically range from -160 (silence) to 0 (max volume)
      const normalizedValue = Math.max(0, (recorderState.metering + 60) / 60);
      setMeterValues((prev) => [...prev.slice(-199), normalizedValue]); // Keep more values for better visualization
    }
  }, [recorderState]);

  // Handlers
  const start = async () => {
    // Clear previous recording data
    setMeterValues([]);
    setRecordingData(null);

    try {
      // Enable metering for visualization
      await recorder.prepareToRecordAsync({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      recorder.record();
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  };

  const pause = () => {
    recorder.pause();
    setIsPaused(true);
  };

  const resume = () => {
    recorder.record();
    setIsPaused(false);
  };

  const stop = async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;

      if (uri) {
        // Save both the URI and waveform data together
        setRecordingData({
          uri,
          waveformData: [...meterValues], // Make a copy of the meter values
        });
      }

      setIsPaused(false);
    } catch (err) {
      console.error("Failed to stop recording:", err);
    }
  };

  // Timeline for recording
  const recordingDuration = recorderState.durationMillis / 1000 || 0;

  // Timeline for playback
  const playbackTime = playerStatus.currentTime || 0;
  const playbackDuration = playerStatus.duration || 0;

  // Handle seeking
  const handleSeek = (position: number) => {
    player.seekTo(position);
  };

  // Determine which waveform data to use
  const waveformData =
    recorderState.isRecording || isPaused
      ? meterValues // Active recording: use live data
      : recordingData?.waveformData || []; // Playback: use saved data

  // Determine current mode - recording or playback
  const isRecording = recorderState.isRecording || isPaused;
  const isPlayback = !isRecording && recordingData !== null;

  return (
    <View className="w-full items-center p-4">
      {/* Controls */}
      <View className="mb-4 flex-row space-x-2">
        {!recorderState.isRecording && !isPaused && (
          <Pressable className="rounded bg-primary px-4 py-2" onPress={start}>
            <Text className="text-white">Start</Text>
          </Pressable>
        )}
        {recorderState.isRecording && (
          <Pressable
            className="rounded bg-yellow-500 px-4 py-2"
            onPress={pause}
          >
            <Text className="text-white">Pause</Text>
          </Pressable>
        )}
        {isPaused && (
          <Pressable
            className="rounded bg-green-600 px-4 py-2"
            onPress={resume}
          >
            <Text className="text-white">Resume</Text>
          </Pressable>
        )}
        {(recorderState.isRecording || isPaused) && (
          <Pressable className="rounded bg-red-600 px-4 py-2" onPress={stop}>
            <Text className="text-white">Stop</Text>
          </Pressable>
        )}
      </View>

      {/* Current status text */}
      <Text className="mb-2 text-center text-sm text-muted-foreground">
        {isRecording
          ? `Recording${isPaused ? " (Paused)" : ""}`
          : isPlayback
            ? playerStatus.playing
              ? "Playing"
              : "Ready to play"
            : "Not recording"}
      </Text>

      {/* Interactive waveform with timeline */}
      <View className="my-4 w-full items-center">
        <AudioWaveformWithTimeline
          audioData={waveformData}
          width={320}
          height={60}
          color="#6366f1"
          progressColor="#ef4444"
          audioDuration={
            isRecording ? recordingDuration : playbackDuration || 0.01
          }
          currentTime={isRecording ? recordingDuration : playbackTime}
          onSeek={handleSeek}
          isPlaying={!isRecording && playerStatus.playing}
          onPlayPause={() =>
            playerStatus.playing ? player.pause() : player.play()
          }
        />
      </View>

      {/* Playback controls */}
      {recordingData && !isRecording && (
        <View className="w-full items-center">
          <Pressable
            className="rounded bg-primary px-4 py-2"
            onPress={() =>
              playerStatus.playing ? player.pause() : player.play()
            }
          >
            <Text className="text-white">
              {playerStatus.playing ? "Pause" : "Play"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
