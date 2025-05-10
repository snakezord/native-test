import React, { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

export interface WaveForm2Props {
  waveform: number[];
  isRecording: boolean;
  progress: number;
}

export function WaveForm2({ waveform, isRecording, progress }: WaveForm2Props) {
  const pulseAnimation = useSharedValue(1);

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

  // Normalize waveform data to range 0-1
  const normalizedWaveform = useMemo(() => {
    if (!waveform.length) return Array(50).fill(0.05);

    const max = Math.max(...waveform, 0.01);
    return waveform.map((value) => Math.max(value / max, 0.05));
  }, [waveform]);

  // Calculate active bars based on playback progress
  const activeBarCount = useMemo(() => {
    return Math.floor(normalizedWaveform.length * progress);
  }, [normalizedWaveform.length, progress]);

  return (
    <View className="flex-1 flex-row items-center justify-center px-2">
      {normalizedWaveform.map((value, index) => {
        const isActive = index < activeBarCount;
        const barHeight = Math.max(value * 100, 5);

        const pulseStyleForLastBar =
          isRecording && index === normalizedWaveform.length - 1
            ? useAnimatedStyle(() => ({
                transform: [{ scaleY: pulseAnimation.value }],
              }))
            : undefined;

        return (
          <Animated.View
            key={index}
            style={[
              {
                height: `${barHeight}%`,
              },
              pulseStyleForLastBar,
            ]}
            className={`mx-0.5 w-1 rounded-full ${
              isActive ? "bg-blue-500" : "bg-gray-400"
            }`}
          />
        );
      })}
    </View>
  );
}
