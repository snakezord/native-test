import React, { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { cn } from "~/utils/cn";

export interface WaveFormPlaybackProps {
  waveform: number[];
  progress: number;
  barClassName?: string;
  activeBarClassName?: string;
  minBarHeight?: number;
  maxBarHeight?: number;
  minOpacity?: number;
  volumePower?: number;
  maxBars?: number;
}

/**
 * Waveform component specifically for playback visualization
 * Shows all audio at once with a progress indicator
 */
export function WaveFormPlayback({
  waveform,
  progress,
  barClassName = "bg-gray-700",
  activeBarClassName = "bg-primary",
  minBarHeight = 3,
  maxBarHeight = 75,
  minOpacity = 0.2,
  volumePower = 1.5,
  maxBars = 100,
}: WaveFormPlaybackProps) {
  // Sample data points to fit within maxBars
  const sampledWaveform = useMemo(() => {
    if (!waveform?.length) {
      return Array(maxBars).fill(0.2);
    }

    // If we have fewer data points than maxBars, use all of them
    if (waveform.length <= maxBars) {
      return waveform;
    }

    // Sample evenly across the full waveform to fit maxBars
    const result = [];
    const step = waveform.length / maxBars;

    for (let i = 0; i < maxBars; i++) {
      const index = Math.min(Math.floor(i * step), waveform.length - 1);
      result.push(waveform[index]);
    }

    return result;
  }, [waveform, maxBars]);

  // Normalize and enhance waveform data
  const enhancedWaveform = useMemo(() => {
    if (!sampledWaveform.length) return Array(maxBars).fill(0.2);

    // Find the maximum value for normalization
    const max = Math.max(...sampledWaveform, 0.01);

    return sampledWaveform.map((value) => {
      // Normalize to 0-1
      const normalized = Math.max(value / max, 0);

      // Apply power function for better visualization
      return Math.max(0.05, Math.pow(normalized, volumePower));
    });
  }, [sampledWaveform, volumePower, maxBars]);

  // Calculate which bars should be active based on playback progress
  const activeBarCount = useMemo(() => {
    return Math.floor(enhancedWaveform.length * progress);
  }, [enhancedWaveform.length, progress]);

  // Calculate the width of each bar based on container width
  const barWidth = useMemo(() => {
    // Calculate available width (assuming 100% width with 4px padding on each side)
    const totalBars = enhancedWaveform.length;
    // Leave minimal spacing between bars (0.5px)
    return totalBars > 0 ? Math.max(1, (100 - 8) / totalBars - 0.5) : 1;
  }, [enhancedWaveform.length]);

  return (
    <View className="flex-1 flex-row items-center justify-center px-2">
      {enhancedWaveform.map((value, index) => {
        const isActive = index < activeBarCount;

        // Calculate bar height
        const barHeight = Math.max(value * maxBarHeight, minBarHeight);

        // Calculate opacity based on amplitude
        const opacity = Math.max(minOpacity, value * 1.2);

        return (
          <Animated.View
            key={index}
            style={{
              height: `${barHeight}%`,
              opacity,
              width: `${barWidth}%`,
              marginHorizontal: 0.25,
            }}
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

export default WaveFormPlayback;
