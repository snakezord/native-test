import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { RecordingPresets } from "expo-audio";

import { useAudioRecordingManager } from "./audio/use-audio-recording-manager";
import { WaveForm2 } from "./audio/wave-form-2";
import WaveFormPlayback from "./audio/wave-form-playback";

export default function AudioRecording() {
  const {
    isRecording,
    isPaused,
    isPlaying,
    recordingDuration,
    waveformData,
    playbackPosition,
    playbackDuration,
    recordingData,

    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    playRecording,
    pausePlayback,
    stopPlayback,
    resetRecording,
  } = useAudioRecordingManager(RecordingPresets.HIGH_QUALITY);

  // Format time in mm:ss format
  const formatTime = useCallback((milliseconds: number) => {
    // Ensure milliseconds is a number and not zero when displaying recording or playback time
    const ms = typeof milliseconds === "number" ? milliseconds : 0;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  // Store recording duration for use when stopped
  const [recordedDuration, setRecordedDuration] = React.useState(0);
  const prevRecordingStateRef = useRef({ isRecording, isPaused });

  // Update recorded duration when recording stops - with optimized dependencies
  useEffect(() => {
    const prevState = prevRecordingStateRef.current;

    // Only trigger when recording state changes from active to inactive
    if (
      (prevState.isRecording || prevState.isPaused) &&
      !isRecording &&
      !isPaused &&
      recordingData
    ) {
      // When we stop recording, store the final duration
      setRecordedDuration(recordingDuration);
    }

    // Update the ref for next comparison
    prevRecordingStateRef.current = { isRecording, isPaused };
  }, [isRecording, isPaused, recordingData]);

  // Log once when recording state changes for debugging
  useEffect(() => {
    if (isRecording) {
      console.log("Recording started");
    } else if (recordingData && !prevRecordingStateRef.current.isRecording) {
      console.log("Recording available:", {
        recordingDuration,
        recordedDuration,
      });
    }
  }, [isRecording]);

  // Log playback position for debugging
  useEffect(() => {
    if (isPlaying) {
      console.log(
        "Playback position:",
        playbackPosition,
        "Duration:",
        playbackDuration,
      );
    }
  }, [isPlaying, playbackPosition, playbackDuration]);

  // Determine status text
  const getStatusText = () => {
    if (isRecording) return "Recording in progress...";
    if (isPaused) return "Recording paused";
    if (isPlaying) return "Playing recording...";
    if (recordingData) return "Recording ready";
    return "Ready to record";
  };

  // Get the effective duration for display and timeline
  const effectiveDuration = useMemo(() => {
    if (isRecording || isPaused) {
      return recordingDuration;
    } else if (isPlaying) {
      return playbackDuration;
    } else if (recordingData) {
      // Use stored duration when we have recording data but not playing
      return recordedDuration;
    }
    return 0;
  }, [
    isRecording,
    isPaused,
    isPlaying,
    recordingData,
    recordingDuration,
    playbackDuration,
    recordedDuration,
  ]);

  // Simplified time display - ensure it updates during playback
  const currentTime = useMemo(() => {
    if (isRecording || isPaused) {
      return formatTime(recordingDuration);
    } else if (isPlaying) {
      return formatTime(playbackPosition);
    } else if (recordingData) {
      return formatTime(0);
    }
    return "00:00";
  }, [
    isRecording,
    isPaused,
    isPlaying,
    recordingDuration,
    playbackPosition,
    recordingData,
    formatTime,
  ]);

  const endTime = useMemo(() => {
    if (recordingData) {
      return formatTime(effectiveDuration);
    }
    return "";
  }, [recordingData, effectiveDuration, formatTime]);

  // We're no longer using timeline markers

  // Common waveform props shared between both waveform components
  const waveformBaseProps = {
    barClassName: "bg-gray-700",
    activeBarClassName: "bg-primary",
    minBarHeight: 5,
    maxBarHeight: 85,
    minOpacity: 0.25,
    volumePower: 1.5,
  };

  return (
    <View className="w-full items-center p-4">
      {/* Status indicator */}
      <View className="mb-2 w-full">
        <Text className="text-center font-medium text-gray-700">
          {getStatusText()}
        </Text>
      </View>

      {/* Two-part waveform visualization */}
      <View className="w-full">
        {/* Top part: Recording visualization (WaveForm2) - always visible */}
        <View className="mb-1 h-16 w-full overflow-hidden rounded-t-lg bg-gray-100">
          <WaveForm2
            waveform={waveformData}
            isRecording={isRecording}
            progress={0}
            barCount={25}
            barWidth={7}
            barSpacing={3}
            {...waveformBaseProps}
          />
        </View>

        {/* Bottom part: Playback visualization (WaveFormPlayback) - only visible when there's a recording */}
        {recordingData && (
          <View className="h-16 w-full overflow-hidden rounded-b-lg bg-gray-100">
            <WaveFormPlayback
              waveform={recordingData.waveformData}
              progress={
                isPlaying && playbackDuration > 0
                  ? playbackPosition / playbackDuration
                  : 0
              }
              maxBars={120}
              barSpacing={0.5}
              fixedBarWidth={1.75}
              {...waveformBaseProps}
              minOpacity={0.2}
              volumePower={3}
            />
          </View>
        )}
      </View>

      {/* Simplified time display - no timeline markers */}

      {/* Simplified time display */}
      <View className="my-2 w-full flex-row justify-between">
        <Text className="font-medium text-gray-700">
          {/* Current time: Using memoized value to ensure updates */}
          {currentTime}
        </Text>

        {/* End time: hide when playing, show otherwise if we have a recording */}
        {!isPlaying && recordingData && (
          <Text className="text-gray-700">{endTime}</Text>
        )}
      </View>

      {/* Control buttons */}
      <View className="my-2 w-full flex-row justify-center space-x-4">
        {!isRecording && !isPaused && !isPlaying && !recordingData ? (
          /* Start recording */
          <Pressable
            className="h-14 w-14 items-center justify-center rounded-full bg-red-500"
            onPress={startRecording}
          >
            <View className="h-6 w-6 rounded-full bg-white" />
          </Pressable>
        ) : isRecording ? (
          /* Recording in progress */
          <View className="flex-row space-x-4">
            <Pressable
              className="h-14 w-14 items-center justify-center rounded-full bg-gray-500"
              onPress={pauseRecording}
            >
              <View className="h-6 flex-row justify-center">
                <View className="mx-0.5 h-6 w-2 rounded-sm bg-white" />
                <View className="mx-0.5 h-6 w-2 rounded-sm bg-white" />
              </View>
            </Pressable>
            <Pressable
              className="h-14 w-14 items-center justify-center rounded-full bg-red-500"
              onPress={stopRecording}
            >
              <View className="h-6 w-6 rounded-sm bg-white" />
            </Pressable>
          </View>
        ) : isPaused ? (
          /* Recording paused */
          <View className="flex-row space-x-4">
            <Pressable
              className="h-14 w-14 items-center justify-center rounded-full bg-red-500"
              onPress={resumeRecording}
            >
              <View className="h-6 w-6 items-center justify-center">
                <View className="ml-1 h-0 w-0 border-b-[8px] border-l-[16px] border-r-0 border-t-[8px] border-transparent border-l-white" />
              </View>
            </Pressable>
            <Pressable
              className="h-14 w-14 items-center justify-center rounded-full bg-gray-500"
              onPress={stopRecording}
            >
              <View className="h-6 w-6 rounded-sm bg-white" />
            </Pressable>
          </View>
        ) : isPlaying ? (
          /* Playback in progress */
          <View className="flex-row space-x-4">
            <Pressable
              className="h-14 w-14 items-center justify-center rounded-full bg-gray-500"
              onPress={pausePlayback}
            >
              <View className="h-6 flex-row justify-center">
                <View className="mx-0.5 h-6 w-2 rounded-sm bg-white" />
                <View className="mx-0.5 h-6 w-2 rounded-sm bg-white" />
              </View>
            </Pressable>
            <Pressable
              className="h-14 w-14 items-center justify-center rounded-full bg-red-500"
              onPress={stopPlayback}
            >
              <View className="h-6 w-6 rounded-sm bg-white" />
            </Pressable>
          </View>
        ) : (
          /* Has recording but paused */
          <View className="flex-row space-x-4">
            <Pressable
              className="h-14 w-14 items-center justify-center rounded-full bg-green-500"
              onPress={playRecording}
            >
              <View className="h-6 w-6 items-center justify-center">
                <View className="ml-1 h-0 w-0 border-b-[8px] border-l-[16px] border-r-0 border-t-[8px] border-transparent border-l-white" />
              </View>
            </Pressable>
            <Pressable
              className="h-14 w-14 items-center justify-center rounded-full bg-gray-500"
              onPress={resetRecording}
            >
              <View className="h-6 w-6 items-center justify-center">
                <Text className="font-bold text-white">X</Text>
              </View>
            </Pressable>
          </View>
        )}
      </View>

      {/* Recording file info */}
      {recordingData && (
        <View className="mt-4 w-full rounded-md bg-gray-50 px-4 py-2">
          <Text className="text-xs text-gray-500">
            Recording saved at: {recordingData.uri}
          </Text>
          <Text className="text-xs text-gray-500">
            Waveform data points: {recordingData.waveformData.length}
          </Text>
        </View>
      )}
    </View>
  );
}
