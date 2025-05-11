/* eslint-disable react-hooks/react-compiler */
import React, { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { cn } from "~/utils/cn";

export interface WaveForm2Props {
  waveform: number[];
  isRecording: boolean;
  progress: number;
  // Configurable parameters
  barCount?: number; // Number of bars to display
  barWidth?: number; // Width of each bar in px
  barSpacing?: number; // Space between bars in px
  barClassName?: string; // CSS class for inactive bars
  activeBarClassName?: string; // CSS class for active bars during playback
  minBarHeight?: number; // Minimum height of bars in %
  maxBarHeight?: number; // Maximum height of bars in %
  minOpacity?: number; // Minimum opacity for quiet sounds
  volumePower?: number; // Power value for volume transformation
}

export function WaveForm2({
  waveform,
  isRecording,
  progress,
  barCount = 20,
  barWidth = 5,
  barSpacing = 2.5,
  barClassName = "bg-black",
  activeBarClassName = "bg-black",
  minBarHeight = 3,
  maxBarHeight = 75,
  minOpacity = 0.2,
  volumePower = 1.5,
}: WaveForm2Props) {
  const pulseAnimation = useSharedValue(1);
  // Always create the animated style hook, but only use it conditionally
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: pulseAnimation.value }],
  }));

  // Debug: Log when the waveform changes
  useEffect(() => {
    console.log("WaveForm2 received waveform data:", waveform.length, "points");
    // Sample first few values to avoid overwhelming the console
    if (waveform.length > 0) {
      console.log("Sample values:", waveform.slice(0, 5));
    }
  }, [waveform]);

  // Create a pulsing animation for recording indicator
  useEffect(() => {
    if (isRecording) {
      pulseAnimation.value = withRepeat(
        withTiming(1.2, { duration: 1000 }),
        -1,
        true,
      );
    } else {
      pulseAnimation.value = withTiming(1);
    }
  }, [isRecording, pulseAnimation]);

  // Create a sliding window of visible waveform data
  const visibleWaveform = useMemo(() => {
    // If we have no waveform data, return flat line default data
    if (!waveform.length) return Array(barCount).fill(0.2) as number[];

    // If we have less data than our window, use all available data
    // but pad with empty bars at the beginning so it grows from right to left
    if (waveform.length <= barCount) {
      // Create padding at the start to align data to the right
      const padding = Array(barCount - waveform.length).fill(0.2) as number[];
      return [...padding, ...waveform];
    }

    // If we're recording, show the most recent window of data
    if (isRecording) {
      return waveform.slice(-barCount);
    }

    // During playback, center the window around the current playback position
    const totalDataPoints = waveform.length;
    const playheadIndex = Math.floor(progress * totalDataPoints);
    const halfWindow = Math.floor(barCount / 2);

    // Calculate start and end indices of the window
    let startIndex = Math.max(0, playheadIndex - halfWindow);
    let endIndex = startIndex + barCount;

    // Handle edge cases
    if (endIndex > totalDataPoints) {
      endIndex = totalDataPoints;
      startIndex = Math.max(0, endIndex - barCount);
    }

    return waveform.slice(startIndex, endIndex);
  }, [waveform, barCount, progress, isRecording]);

  // Normalize and enhance waveform data to range 0-1 with more visual differentiation
  const enhancedWaveform = useMemo(() => {
    // When there's no real data, keep the flat line
    if (!waveform.length) return Array(barCount).fill(0.2) as number[];

    if (!visibleWaveform.length) return Array(barCount).fill(0.2) as number[];

    // Find the maximum value for normalization - only consider actual data points, not padding
    const realDataPoints = visibleWaveform.filter((v) => v !== 0.2);
    const max =
      realDataPoints.length > 0 ? Math.max(...realDataPoints, 0.01) : 0.01;

    // Apply transformation to enhance differences between loud and quiet parts
    // Preserve baseline values (0.2) to show as flat line
    return visibleWaveform.map((value) => {
      // Skip normalization for baseline values
      if (value === 0.2) return value;

      // Normalize to 0-1
      const normalized = Math.max(value / max, 0);

      // Use power function to enhance differences -
      // this will make quiet sounds more quiet and loud sounds more distinct
      // Use a much lower minimum (0.05) for truly quiet sounds
      return Math.max(0.05, Math.pow(normalized, volumePower));
    });
  }, [visibleWaveform, barCount, volumePower, waveform.length]);

  // Calculate active bars based on visible window and playback progress
  const activeBarCount = useMemo(() => {
    if (isRecording) return enhancedWaveform.length; // All bars active when recording

    if (!waveform.length) return 0;

    const totalDataPoints = waveform.length;
    const windowStartIndex = Math.max(
      0,
      Math.floor(waveform.length - visibleWaveform.length),
    );
    const playheadIndexInFullData = Math.floor(progress * totalDataPoints);

    // Calculate how many bars in our visible window are before the playhead
    const activeCount = Math.max(0, playheadIndexInFullData - windowStartIndex);
    return Math.min(activeCount, enhancedWaveform.length);
  }, [
    enhancedWaveform.length,
    waveform.length,
    visibleWaveform.length,
    progress,
    isRecording,
  ]);

  return (
    <View className="flex-1 flex-row items-center justify-center px-2">
      {enhancedWaveform.map((value, index) => {
        const isActive = index < activeBarCount;

        // Determine if this is a baseline bar (flat line) or audio data
        const isBaseline = value === 0.2;

        // Calculate bar height - ensure flat line for baseline bars
        const barHeight = isBaseline
          ? 10 // Fixed height for baseline state
          : Math.max(value * maxBarHeight, minBarHeight);

        const shouldPulse =
          isRecording && index === enhancedWaveform.length - 1;

        // Calculate opacity based on amplitude with greater range
        const opacity = isBaseline
          ? 0.3 // Fixed opacity for baseline state
          : Math.max(minOpacity, value * 1.2);

        return (
          <Animated.View
            key={index}
            style={[
              {
                height: `${barHeight}%`,
                opacity,
                width: barWidth,
                marginHorizontal: barSpacing,
              },
              shouldPulse ? pulseStyle : undefined,
            ]}
            className={cn(
              "rounded-full",
              isActive ? activeBarClassName : barClassName,
            )}
          />
        );
      })}
    </View>
  );
}

// Add default export
export default WaveForm2;
