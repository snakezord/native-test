/*
  AudioWave – smooth & jank‑free
  ----------------------------------------------------------------
  • ONE native‑driven Animated.Value (progress 0‑1) animates on the UI thread.
  • No per‑frame JS colour interpolation – bars keep a static colour.
  • Knob + progress line use a `translateX` transform (supported by native driver).
  • Tap or drag anywhere on the waveform to seek; animation restarts at new spot.
*/
import type { GestureResponderEvent, LayoutChangeEvent } from "react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  Text,
  View,
} from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

interface AudioWaveProps {
  uri?: string | null;
  meterValues?: number[];
  width?: number;
  height?: number;
  barCount?: number;
  duration?: number;
  currentTime?: number;
  color?: string;
  isRecording?: boolean;
  onSeek?: (sec: number) => void;
  showTimeline?: boolean;
}

export default function AudioWave({
  uri,
  meterValues = [],
  width = 300,
  height = 60,
  barCount = 50,
  duration = 0,
  currentTime = 0,
  color = "#6366f1",
  isRecording = false,
  onSeek,
  showTimeline = true,
}: AudioWaveProps) {
  /* ───────── player & duration */
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const total = Math.max(0.1, duration || status.duration || 0);

  /* ───────── layout */
  const [widthPx, setWidthPx] = useState(width);
  const [containerX, setContainerX] = useState(0);
  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    setWidthPx(nativeEvent.layout.width || width);
    setContainerX(nativeEvent.layout.x);
  };

  /* ───────── progress value (UI‑thread) */
  const progress = useRef(new Animated.Value(0)).current; // 0‑1
  const running = useRef<Animated.CompositeAnimation | null>(null);

  function stop() {
    running.current?.stop();
    running.current = null;
  }
  const start = useCallback(
    (fromNorm: number) => {
      const ms = (1 - fromNorm) * total * 1000;
      running.current = Animated.timing(progress, {
        toValue: 1,
        duration: ms,
        easing: Easing.linear,
        useNativeDriver: true, // UI‑thread animation
      });
      running.current.start(
        ({ finished }) => finished && (running.current = null),
      );
    },
    [progress, total],
  );

  const seek = useCallback(
    (norm: number) => {
      progress.setValue(norm);
      onSeek?.(norm * total);
    },
    [onSeek, progress, total],
  );

  /* ───────── watch playback state */
  useEffect(() => {
    const norm = (status.currentTime || 0) / total;
    if (status.playing && !isRecording) {
      stop();
      seek(norm);
      start(norm);
    } else {
      stop();
      seek(norm);
    }
  }, [
    status.playing,
    status.duration,
    uri,
    status.currentTime,
    total,
    isRecording,
    seek,
    start,
  ]);

  /* external currentTime (e.g. controlled) */
  useEffect(() => {
    if (!status.playing) {
      progress.setValue((currentTime || 0) / total);
    }
  }, [currentTime, progress, status.playing, total]);

  /* ───────── tap / drag */
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isRecording && !!uri && !!onSeek,
      onPanResponderGrant: () => stop(),
      onPanResponderMove: (e) => {
        const norm = (e.nativeEvent.pageX - containerX) / widthPx;
        seek(Math.max(0, Math.min(norm, 1)));
      },
      onPanResponderRelease: (e) => {
        const norm = (e.nativeEvent.pageX - containerX) / widthPx;
        const bounded = Math.max(0, Math.min(norm, 1));
        seek(bounded);
        if (status.playing && !isRecording) start(bounded);
      },
    }),
  ).current;

  /* quick tap */
  function handlePress(e: GestureResponderEvent) {
    if (!uri || isRecording || !onSeek) return;
    const norm = (e.nativeEvent.pageX - containerX) / widthPx;
    const bounded = Math.max(0, Math.min(norm, 1));
    stop();
    seek(bounded);
    if (status.playing) start(bounded);
  }

  /* ───────── bars */
  const barW = widthPx / barCount;
  const gap = barW * 0.4;
  const thick = barW - gap;
  const bars = Array.from({ length: barCount }).map((_, i) => {
    const amp = meterValues.length
      ? (meterValues[Math.floor((i / barCount) * meterValues.length)] ?? 0)
      : 0;
    const h = meterValues.length
      ? Math.max(2, Math.min(amp * height * 3, height * 0.95))
      : 2;
    return (
      <View
        key={i}
        style={{
          position: "absolute",
          left: i * barW + gap / 2,
          bottom: height / 2 - h / 2,
          width: thick,
          height: h,
          backgroundColor: color,
          borderRadius: 2,
        }}
      />
    );
  });

  /* progress transform (UI‑thread) */
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, widthPx],
  });

  /* mm:ss helper */
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60)
      .toString()
      .padStart(2, "0")}`;

  /* ───────── render */
  return (
    <View className="w-full">
      <Pressable
        style={{ width, height, position: "relative" }}
        onLayout={onLayout}
        onPress={handlePress}
        {...pan.panHandlers}
      >
        {bars}

        {/* progress line */}
        {!isRecording && uri && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              transform: [{ translateX }],
              top: 0,
              bottom: 0,
              width: 2,
              backgroundColor: "white",
            }}
          />
        )}

        {/* knob */}
        {!isRecording && uri && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              transform: [{ translateX }, { translateY: height / 2 - 12 }],
              marginLeft: -12,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.9)",
            }}
          />
        )}
      </Pressable>

      {showTimeline && (
        <View className="mt-1 w-full flex-row justify-between">
          <Text className="text-xs text-muted-foreground">
            {fmt(status.currentTime || 0)}
          </Text>
          <Text className="text-xs text-muted-foreground">{fmt(total)}</Text>
        </View>
      )}
    </View>
  );
}
