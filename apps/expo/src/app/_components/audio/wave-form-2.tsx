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
  // New configurable parameters
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
  maxBarHeight = 80,
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

  // Normalize and enhance waveform data to range 0-1 with more visual differentiation
  const enhancedWaveform = useMemo(() => {
    // Generate default bars for empty waveforms
    if (!waveform.length) return Array(barCount).fill(0.05) as number[];

    // Find the maximum value for normalization
    const max = Math.max(...waveform, 0.01);

    // Sample fewer points from the waveform data when we have a lot
    let sampledWaveform = [...waveform];
    if (sampledWaveform.length > barCount) {
      // Sample points evenly from the full data set to reduce to specified bar count
      const step = Math.floor(sampledWaveform.length / barCount);
      sampledWaveform = sampledWaveform
        .filter((_, index) => index % step === 0)
        .slice(0, barCount);
    }

    // Apply transformation to enhance differences between loud and quiet parts
    return sampledWaveform.map((value) => {
      // Normalize to 0-1
      const normalized = Math.max(value / max, 0);

      // Use power function to enhance differences -
      // this will make quiet sounds more quiet and loud sounds more distinct
      // Use a much lower minimum (0.05) for truly quiet sounds
      return Math.max(0.05, Math.pow(normalized, volumePower));
    });
  }, [waveform, barCount, volumePower]);

  // Calculate active bars based on playback progress
  const activeBarCount = useMemo(() => {
    return Math.floor(enhancedWaveform.length * progress);
  }, [enhancedWaveform.length, progress]);

  return (
    <View className="flex-1 flex-row items-center justify-center px-2">
      {enhancedWaveform.map((value, index) => {
        const isActive = index < activeBarCount;
        // Calculate bar height based on value and min/max settings
        const barHeight = Math.max(value * maxBarHeight, minBarHeight);
        const shouldPulse =
          isRecording && index === enhancedWaveform.length - 1;

        // Calculate opacity based on amplitude with greater range
        const opacity = Math.max(minOpacity, value * 1.2);

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
