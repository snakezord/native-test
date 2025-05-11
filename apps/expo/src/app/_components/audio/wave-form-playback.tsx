import type { GestureResponderEvent, LayoutChangeEvent } from "react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

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
  onSeek?: (progress: number) => void; // New prop to handle seeking
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
  onSeek,
}: WaveFormPlaybackProps) {
  // Track container dimensions for touch calculation
  const [containerDimensions, setContainerDimensions] = useState({
    width: 0,
    x: 0,
  });
  // Track bars container dimensions
  const [barsContainerDimensions, setBarsContainerDimensions] = useState({
    width: 0,
    x: 0,
    left: 0,
  });
  // Animated position for the seek indicator
  const seekPosition = useSharedValue(0);

  // Update seek position when progress changes
  useEffect(() => {
    if (barsContainerDimensions.width > 0) {
      const position =
        barsContainerDimensions.left + progress * barsContainerDimensions.width;
      seekPosition.value = withTiming(position, { duration: 100 });
    }
  }, [progress, barsContainerDimensions, seekPosition]);

  // Handle layout changes
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, x } = event.nativeEvent.layout;
    console.log(`WaveFormPlayback container layout: width=${width}, x=${x}`);
    setContainerDimensions({ width, x });
  }, []);

  // Handle waveform layout changes
  const onWaveformLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, x } = event.nativeEvent.layout;
    // We'll calculate the left position as x relative to container
    console.log(`Waveform bars container layout: width=${width}, x=${x}`);
    setBarsContainerDimensions({ width, x, left: 8 }); // hardcode 8px padding
  }, []);

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
      `Rendering WaveFormPlayback with ${barCount} bars, maxBars=${maxBars}, progress=${progress}`,
    );
  }, [barCount, maxBars, progress]);

  // Handle touch events on the waveform - moved after enhancedWaveform is defined
  const handleTouch = useCallback(
    (event: GestureResponderEvent) => {
      if (!onSeek) return;

      // Get the total number of bars (our discrete time segments)
      const totalBars = enhancedWaveform.length;

      // Calculate touch position relative to the container's width
      const touchX = event.nativeEvent.pageX - containerDimensions.x;
      const containerWidth = containerDimensions.width;

      // CRITICAL FIX: For first bar detection - be much more aggressive
      // If clicking in the first 15% of the container width, always select the first bar
      const firstBarThreshold = containerWidth * 0.15; // 15% of container width

      // Use exact bar calculation only if we're not in the "first bar zone"
      if (touchX <= firstBarThreshold) {
        console.log(
          `Touch: pageX=${event.nativeEvent.pageX}, ` +
            `touchX=${touchX.toFixed(1)}, ` +
            `containerWidth=${containerWidth}, ` +
            `firstBarThreshold=${firstBarThreshold.toFixed(1)}, ` +
            `barIndex=0 (FIRST BAR ZONE), ` +
            `progress=0.0000`,
        );

        // Always seek to beginning (first bar) when in first bar zone
        onSeek(0);
        return;
      }

      // For other positions, calculate normally but adjust the scale
      // Adjust the remaining width (after first bar zone) to map to positions 1-120
      const remainingWidth = containerWidth - firstBarThreshold;
      // Adjust the touch position to be relative to the end of the first bar zone
      const adjustedTouchX = touchX - firstBarThreshold;

      // Calculate progress across remaining width (scaled to 1-119 out of 120 bars)
      const remainingBars = totalBars - 1;
      const rawProgress = Math.max(
        0,
        Math.min(adjustedTouchX / remainingWidth, 0.999),
      );

      // Map to discrete bar positions, but start from bar 1 (not 0)
      const barIndexInRemaining = Math.floor(rawProgress * remainingBars);
      const finalBarIndex = 1 + barIndexInRemaining; // +1 because we're starting from bar 1

      // Convert bar index to progress
      const discreteProgress = finalBarIndex / totalBars;

      console.log(
        `Touch: pageX=${event.nativeEvent.pageX}, ` +
          `touchX=${touchX.toFixed(1)}, ` +
          `adjustedTouchX=${adjustedTouchX.toFixed(1)}, ` +
          `containerWidth=${containerWidth}, ` +
          `remainingWidth=${remainingWidth.toFixed(1)}, ` +
          `barIndex=${finalBarIndex}, ` +
          `progress=${discreteProgress.toFixed(4)}`,
      );

      // Seek to the precise start of this discrete bar
      onSeek(discreteProgress);
    },
    [containerDimensions, enhancedWaveform.length, onSeek],
  );

  // Animated style for the seek indicator - adjust to align with bar center
  const seekIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: seekPosition.value }],
    left: -1, // Center the 2px line on the exact position
  }));

  // Animated style for the seek knob - adjust to align with bar center
  const seekKnobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: seekPosition.value }],
    left: -10, // Center the 20px knob
  }));

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* Touchable area - covers entire component */}
      <Pressable
        style={styles.touchArea}
        onPress={handleTouch}
        onPressIn={handleTouch}
        onTouchMove={handleTouch}
      >
        {/* Container for bars */}
        <View style={styles.barsContainer} onLayout={onWaveformLayout}>
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

        {/* Seek indicator line */}
        <Animated.View style={[styles.seekLine, seekIndicatorStyle]} />

        {/* Seek indicator knob */}
        <Animated.View style={[styles.seekKnob, seekKnobStyle]} />
      </Pressable>
    </View>
  );
}

// Move styles to StyleSheet for better performance and clearer structure
const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    position: "relative",
  },
  touchArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
  },
  barsContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    paddingHorizontal: 8, // Add horizontal padding to align with visual expectations
    zIndex: 10,
  },
  seekLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "white",
    zIndex: 20,
  },
  seekKnob: {
    position: "absolute",
    top: "50%",
    width: 20,
    height: 20,
    marginTop: -10,
    borderRadius: 10,
    backgroundColor: "white",
    zIndex: 30,
  },
});

export default WaveFormPlayback;
