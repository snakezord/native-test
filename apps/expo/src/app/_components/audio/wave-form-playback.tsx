import React, { useEffect, useMemo } from "react";
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
  fixedBarWidth?: number; // Width in pixels (if provided, overrides percentage-based width)
  barSpacing?: number; // Spacing between bars in pixels
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
  fixedBarWidth,
  barSpacing = 0.25,
}: WaveFormPlaybackProps) {
  // Debug the input parameters
  useEffect(() => {
    console.log(
      `WaveFormPlayback props - maxBars: ${maxBars}, waveform length: ${waveform.length || 0}`,
    );
  }, [maxBars, waveform]);

  // Sample data points to fit within maxBars
  const sampledWaveform = useMemo(() => {
    if (!waveform.length) {
      console.log(
        `No waveform data, creating empty array with ${maxBars} bars`,
      );
      return Array(maxBars).fill(0.2) as number[];
    }

    // Ensure maxBars is a positive number
    const targetBars = Math.max(1, maxBars);

    console.log(
      `WaveFormPlayback: Original waveform length: ${waveform.length}, targeting ${targetBars} bars`,
    );

    // Always interpolate data to fill the entire targetBars array
    // This ensures we always use ALL available audio data spread evenly
    const result: number[] = new Array(targetBars) as number[];

    // Simple interpolation algorithm to spread the data evenly
    if (waveform.length === 1) {
      // Special case: if we have only one data point, use it for all bars
      return Array(targetBars).fill(waveform[0]) as number[];
    }

    // Use all of the waveform data, stretched or compressed to fit exactly targetBars
    for (let i = 0; i < targetBars; i++) {
      // Calculate a position in the original waveform array, scaled to the target size
      const position = (i / (targetBars - 1)) * (waveform.length - 1);
      const lowerIndex = Math.floor(position);
      const upperIndex = Math.min(lowerIndex + 1, waveform.length - 1);
      const weight = position - lowerIndex;

      // Linear interpolation between the two closest points
      if (lowerIndex === upperIndex) {
        result[i] = waveform[lowerIndex]!;
      } else {
        result[i] =
          (waveform[lowerIndex] ?? 0) * (1 - weight) +
          (waveform[upperIndex] ?? 0) * weight;
      }
    }

    console.log(`Sampled waveform created with ${result.length} bars`);

    return result;
  }, [waveform, maxBars]);

  // Normalize and enhance waveform data
  const enhancedWaveform = useMemo(() => {
    if (!sampledWaveform.length) return Array(maxBars).fill(0.2) as number[];

    // Find the maximum value for normalization
    const max = Math.max(...sampledWaveform, 0.01);
    console.log(`Normalizing with max value: ${max}`);

    // Apply transformation to enhance differences between loud and quiet parts
    const result = sampledWaveform.map((value) => {
      // Normalize to 0-1
      const normalized = Math.max(value / max, 0);

      // Apply power function for better visualization
      return Math.max(0.05, Math.pow(normalized, volumePower));
    });

    console.log("Enhanced waveform processing complete");

    return result;
  }, [sampledWaveform, volumePower, maxBars]);

  // Calculate which bars should be active based on playback progress
  const activeBarCount = useMemo(() => {
    return Math.floor(enhancedWaveform.length * progress);
  }, [enhancedWaveform.length, progress]);

  // Calculate the width of each bar based on container width if fixed width is not provided
  const calculatedBarWidth = useMemo(() => {
    if (fixedBarWidth) {
      return fixedBarWidth;
    }

    // Calculate percentage width - ensure all bars fit within the container
    const totalBars = enhancedWaveform.length || maxBars;
    const totalSpacing = barSpacing * 2 * totalBars;

    // Calculate percentage width: (100% - total spacing) / number of bars
    const widthPerBar =
      totalBars > 0 ? Math.max(0.5, (100 - totalSpacing) / totalBars) : 1;
    console.log(`Calculated bar width: ${widthPerBar}% for ${totalBars} bars`);

    return widthPerBar;
  }, [enhancedWaveform.length, fixedBarWidth, barSpacing, maxBars]);

  // No separate displayWaveform - use enhancedWaveform directly since it should already be exactly maxBars in length
  const barCount = enhancedWaveform.length;

  useEffect(() => {
    console.log(
      `Rendering WaveFormPlayback with ${barCount} bars, maxBars=${maxBars}`,
    );
  }, [barCount, maxBars]);

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
              // Use fixed width in pixels or percentage based on what's provided
              ...(fixedBarWidth
                ? { width: fixedBarWidth }
                : { width: `${calculatedBarWidth}%` }),
              marginHorizontal: barSpacing,
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
