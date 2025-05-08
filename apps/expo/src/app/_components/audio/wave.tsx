import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { G, Line, Path, Rect, Text as SvgText } from "react-native-svg";

// Define props interface for AudioWaveformWithTimeline
interface AudioWaveformProps {
  audioData: number[];
  width?: number;
  height?: number;
  color?: string;
  progressColor?: string;
  lineWidth?: number;
  audioDuration?: number;
  currentTime?: number;
  onSeek?: (seekTime: number) => void;
  isPlaying?: boolean;
  onPlayPause?: () => void;
}

// Define props for the advanced waveform which extends the basic one
interface AdvancedAudioWaveformProps extends AudioWaveformProps {
  showZoomControls?: boolean;
}

/**
 * Format time in seconds to MM:SS format
 * @param {number} timeInSeconds
 * @returns {string} Formatted time string
 */
const formatTime = (timeInSeconds: number) => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes < 10 ? "0" : ""}${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

/**
 * AudioWaveform Component with Timeline
 *
 * @param {Object} props
 * @param {Array<number>} props.audioData - Array of audio amplitude values between 0 and 1
 * @param {number} props.width - Width of the SVG
 * @param {number} props.height - Height of the SVG
 * @param {string} props.color - Color of the waveform
 * @param {string} props.progressColor - Color of the played portion of waveform
 * @param {number} props.lineWidth - Width of the waveform line
 * @param {number} props.audioDuration - Total duration of audio in seconds
 * @param {number} props.currentTime - Current playback time in seconds
 * @param {Function} props.onSeek - Callback function when seeking to a new position
 * @param {boolean} props.isPlaying - Whether audio is currently playing
 * @param {Function} props.onPlayPause - Callback function for play/pause action
 */
const AudioWaveformWithTimeline = ({
  audioData = [],
  width = 300,
  height = 80,
  color = "#3b82f6",
  progressColor = "#ef4444",
  lineWidth = 2,
  audioDuration = 0,
  currentTime = 0,
  onSeek = (_seekTime: number) => {},
  isPlaying = false,
  onPlayPause = () => {},
}: AudioWaveformProps) => {
  // Calculate timeline metrics
  const timelineHeight = 20;
  const waveformHeight = height - timelineHeight;
  const pixelsPerSecond = width / audioDuration;
  const currentPosition = (currentTime / audioDuration) * width;

  // Generate SVG paths for waveform
  const pathData = useMemo(() => {
    if (!audioData.length) return "";

    const middleY = waveformHeight / 2;
    const stepWidth = width / (audioData.length - 1);

    let path = "";
    audioData.forEach((value, index) => {
      // Scale the amplitude (value between 0-1) to determine the waveform height
      const amplitude = Math.min(1, Math.max(0, value)); // Ensure value is between 0-1
      const yOffset = (waveformHeight / 2) * amplitude;
      const yPos = value < 0.5 ? middleY + yOffset : middleY - yOffset;
      const xPos = index * stepWidth;

      if (index === 0) {
        path += `M ${xPos} ${yPos}`;
      } else {
        path += ` L ${xPos} ${yPos}`;
      }
    });

    return path;
  }, [audioData, width, waveformHeight]);

  // Create timeline ticks (every 5 seconds)
  const timelineTicks = useMemo(() => {
    const ticks = [];
    const tickInterval = 5; // seconds
    const tickCount = Math.floor(audioDuration / tickInterval);

    for (let i = 0; i <= tickCount; i++) {
      const tickTime = i * tickInterval;
      const xPosition = (tickTime / audioDuration) * width;
      ticks.push({
        position: xPosition,
        time: tickTime,
        isMajor: i % 2 === 0, // Make every other tick a major tick
      });
    }

    return ticks;
  }, [audioDuration, width]);

  // PanResponder for seeking
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX } = evt.nativeEvent;
        const seekTime = (locationX / width) * audioDuration;
        onSeek(Math.max(0, Math.min(audioDuration, seekTime)));
      },
      onPanResponderMove: (evt) => {
        const { locationX } = evt.nativeEvent;
        const seekTime = (locationX / width) * audioDuration;
        onSeek(Math.max(0, Math.min(audioDuration, seekTime)));
      },
    });
  }, [width, audioDuration, onSeek]);

  return (
    <View className="items-center justify-center">
      <View className="overflow-hidden rounded-lg bg-gray-100">
        {/* Waveform */}
        <View {...panResponder.panHandlers}>
          <Svg width={width} height={waveformHeight}>
            {/* Background waveform */}
            <Path
              d={pathData}
              stroke={color}
              strokeWidth={lineWidth}
              fill="none"
            />

            {/* Progress waveform (clipped to current position) */}
            <Rect
              x={0}
              y={0}
              width={currentPosition}
              height={waveformHeight}
              fill="none"
              strokeWidth={0}
              clipPath="url(#clipProgress)"
            />
            <Path
              d={pathData}
              stroke={progressColor}
              strokeWidth={lineWidth}
              fill="none"
              clipPath="url(#clipProgress)"
            />

            {/* Clip path for progress */}
            <defs>
              <clipPath id="clipProgress">
                <Rect
                  x={0}
                  y={0}
                  width={currentPosition}
                  height={waveformHeight}
                />
              </clipPath>
            </defs>

            {/* Current position indicator */}
            <Line
              x1={currentPosition}
              y1={0}
              x2={currentPosition}
              y2={waveformHeight}
              stroke="#000"
              strokeWidth={1}
            />
          </Svg>
        </View>

        {/* Timeline */}
        <Svg width={width} height={timelineHeight}>
          {timelineTicks.map((tick, index) => (
            <G key={index}>
              <Line
                x1={tick.position}
                y1={0}
                x2={tick.position}
                y2={tick.isMajor ? 10 : 5}
                stroke="#666"
                strokeWidth={1}
              />
              {tick.isMajor && (
                <SvgText
                  x={tick.position}
                  y={timelineHeight - 2}
                  fontSize={8}
                  textAnchor="middle"
                  fill="#666"
                >
                  {formatTime(tick.time)}
                </SvgText>
              )}
            </G>
          ))}
        </Svg>
      </View>

      {/* Controls */}
      <View className="mt-2 w-full flex-row items-center justify-between px-2">
        <Text className="text-xs text-gray-600">{formatTime(currentTime)}</Text>

        <TouchableOpacity
          onPress={onPlayPause}
          className="rounded-full bg-blue-500 px-4 py-1"
        >
          <Text className="font-medium text-white">
            {isPlaying ? "Pause" : "Play"}
          </Text>
        </TouchableOpacity>

        <Text className="text-xs text-gray-600">
          {formatTime(audioDuration)}
        </Text>
      </View>
    </View>
  );
};

/**
 * Enhanced AudioWaveform Component with Zooming and Scrolling
 *
 * @param {Object} props
 * @param {Array<number>} props.audioData - Array of 0s and 1s representing audio data
 * @param {number} props.width - Width of the SVG container
 * @param {number} props.height - Height of the SVG container
 * @param {string} props.color - Color of the waveform
 * @param {string} props.progressColor - Color of the played portion of waveform
 * @param {number} props.lineWidth - Width of the waveform line
 * @param {number} props.audioDuration - Total duration of audio in seconds
 * @param {number} props.currentTime - Current playback time in seconds
 * @param {Function} props.onSeek - Callback function when seeking to a new position
 * @param {boolean} props.isPlaying - Whether audio is currently playing
 * @param {Function} props.onPlayPause - Callback function for play/pause action
 * @param {boolean} props.showZoomControls - Whether to show zoom controls
 */
const AdvancedAudioWaveform = ({
  audioData = [],
  width = 300,
  height = 100,
  color = "#3b82f6",
  progressColor = "#ef4444",
  lineWidth = 2,
  audioDuration = 0,
  currentTime = 0,
  onSeek = (_seekTime: number) => {},
  isPlaying = false,
  onPlayPause = () => {},
  showZoomControls = true,
}: AdvancedAudioWaveformProps) => {
  // Zoom level and scroll position
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = no zoom
  const [scrollPosition, setScrollPosition] = useState(0); // 0 = start

  // Calculate dimensions and metrics
  const timelineHeight = 20;
  const controlsHeight = 30;
  const waveformHeight =
    height - timelineHeight - (showZoomControls ? controlsHeight : 0);

  // The actual width of the waveform at current zoom
  const zoomedWidth = width * zoomLevel;

  // The visible portion of the waveform
  const visibleStartPixel = scrollPosition * zoomedWidth;
  const visibleEndPixel = visibleStartPixel + width;

  // Convert time to pixel position and vice versa
  const pixelsPerSecond = zoomedWidth / audioDuration;
  const currentPixelPosition = currentTime * pixelsPerSecond;
  const visibleCurrentPosition = currentPixelPosition - visibleStartPixel;

  // Ensure current position is visible
  useEffect(() => {
    if (currentPixelPosition < visibleStartPixel) {
      // Current position is before visible area
      setScrollPosition(currentPixelPosition / zoomedWidth);
    } else if (currentPixelPosition > visibleEndPixel) {
      // Current position is after visible area
      setScrollPosition((currentPixelPosition - width) / zoomedWidth);
    }
  }, [currentTime, zoomedWidth, visibleStartPixel, visibleEndPixel, width]);

  // Generate SVG paths for waveform
  const pathData = useMemo(() => {
    if (!audioData.length) return "";

    const middleY = waveformHeight / 2;
    const stepWidth = zoomedWidth / (audioData.length - 1);

    let path = "";
    audioData.forEach((value, index) => {
      // Scale the amplitude (value between 0-1) to determine the waveform height
      const amplitude = Math.min(1, Math.max(0, value)); // Ensure value is between 0-1
      const yOffset = (waveformHeight / 2) * amplitude;
      const yPos = value < 0.5 ? middleY + yOffset : middleY - yOffset;
      const xPos = index * stepWidth;

      if (index === 0) {
        path += `M ${xPos} ${yPos}`;
      } else {
        path += ` L ${xPos} ${yPos}`;
      }
    });

    return path;
  }, [audioData, zoomedWidth, waveformHeight]);

  // Create timeline ticks based on zoom level
  const timelineTicks = useMemo(() => {
    const ticks = [];
    // Adjust tick interval based on zoom level
    const baseTickInterval = 5; // seconds
    const tickInterval =
      baseTickInterval / Math.max(1, Math.log2(zoomLevel) + 1);
    const visibleDuration = audioDuration / zoomLevel;
    const visibleStartTime = scrollPosition * audioDuration;
    const visibleEndTime = visibleStartTime + visibleDuration;

    // Start with the first visible tick
    const firstTickTime =
      Math.ceil(visibleStartTime / tickInterval) * tickInterval;

    for (
      let time = firstTickTime;
      time <= visibleEndTime;
      time += tickInterval
    ) {
      const pixelPosition = time * pixelsPerSecond - visibleStartPixel;
      ticks.push({
        position: pixelPosition,
        time,
        isMajor: Math.round(time / tickInterval) % 2 === 0,
      });
    }

    return ticks;
  }, [
    audioDuration,
    zoomLevel,
    scrollPosition,
    pixelsPerSecond,
    visibleStartPixel,
  ]);

  // PanResponder for seeking
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX } = evt.nativeEvent;
        const seekPixel = locationX + visibleStartPixel;
        const seekTime = seekPixel / pixelsPerSecond;
        onSeek(Math.max(0, Math.min(audioDuration, seekTime)));
      },
      onPanResponderMove: (evt) => {
        const { locationX } = evt.nativeEvent;
        const seekPixel = locationX + visibleStartPixel;
        const seekTime = seekPixel / pixelsPerSecond;
        onSeek(Math.max(0, Math.min(audioDuration, seekTime)));
      },
    });
  }, [visibleStartPixel, pixelsPerSecond, audioDuration, onSeek]);

  // Handle zoom in/out
  const handleZoomIn = () => {
    setZoomLevel((prev) => {
      const newZoom = Math.min(prev * 1.5, 10); // Limit max zoom

      // Adjust scroll position to keep current time in view
      const currentTimePosition = currentTime / audioDuration;
      const viewportWidth = 1 / newZoom;

      // If current position would be outside view, center it
      if (
        currentTimePosition < scrollPosition ||
        currentTimePosition > scrollPosition + viewportWidth
      ) {
        setScrollPosition(
          Math.max(
            0,
            Math.min(
              1 - viewportWidth,
              currentTimePosition - viewportWidth / 2,
            ),
          ),
        );
      }

      return newZoom;
    });
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev / 1.5, 1)); // Limit min zoom to 1

    // Reset scroll position if we're at lowest zoom
    if (zoomLevel <= 1.5) {
      setScrollPosition(0);
    }
  };

  // Handle scrolling
  const handleScroll = (direction: "left" | "right") => {
    const scrollStep = 0.1; // Scroll by 10% of view
    if (direction === "left") {
      setScrollPosition((prev) => Math.max(0, prev - scrollStep));
    } else {
      setScrollPosition((prev) =>
        Math.min(1 - 1 / zoomLevel, prev + scrollStep),
      );
    }
  };

  return (
    <View className="items-center justify-center">
      <View className="overflow-hidden rounded-lg bg-gray-100">
        {/* Waveform with clipping to show only the visible part */}
        <View {...panResponder.panHandlers}>
          <Svg width={width} height={waveformHeight}>
            <G transform={`translate(${-visibleStartPixel}, 0)`}>
              {/* Background waveform */}
              <Path
                d={pathData}
                stroke={color}
                strokeWidth={lineWidth}
                fill="none"
              />

              {/* Progress waveform */}
              <Path
                d={pathData}
                stroke={progressColor}
                strokeWidth={lineWidth}
                fill="none"
                clipPath="url(#clipProgress)"
              />

              {/* Clip path for progress */}
              <defs>
                <clipPath id="clipProgress">
                  <Rect
                    x={0}
                    y={0}
                    width={currentPixelPosition}
                    height={waveformHeight}
                  />
                </clipPath>
              </defs>
            </G>

            {/* Current position indicator (always visible) */}
            <Line
              x1={visibleCurrentPosition}
              y1={0}
              x2={visibleCurrentPosition}
              y2={waveformHeight}
              stroke="#000"
              strokeWidth={1}
            />
          </Svg>
        </View>

        {/* Timeline */}
        <Svg width={width} height={timelineHeight}>
          {timelineTicks.map((tick, index) => (
            <G key={index}>
              <Line
                x1={tick.position}
                y1={0}
                x2={tick.position}
                y2={tick.isMajor ? 10 : 5}
                stroke="#666"
                strokeWidth={1}
              />
              {tick.isMajor && (
                <SvgText
                  x={tick.position}
                  y={timelineHeight - 2}
                  fontSize={8}
                  textAnchor="middle"
                  fill="#666"
                >
                  {formatTime(tick.time)}
                </SvgText>
              )}
            </G>
          ))}
        </Svg>

        {/* Zoom and navigation controls */}
        {showZoomControls && (
          <View className="h-8 flex-row items-center justify-between px-2">
            <View className="flex-row">
              <TouchableOpacity
                onPress={() => handleScroll("left")}
                disabled={scrollPosition <= 0}
                className={`rounded px-2 py-1 ${scrollPosition <= 0 ? "opacity-50" : ""}`}
              >
                <Text className="text-blue-500">←</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleScroll("right")}
                disabled={scrollPosition >= 1 - 1 / zoomLevel}
                className={`rounded px-2 py-1 ${scrollPosition >= 1 - 1 / zoomLevel ? "opacity-50" : ""}`}
              >
                <Text className="text-blue-500">→</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row">
              <TouchableOpacity
                onPress={handleZoomOut}
                disabled={zoomLevel <= 1}
                className={`rounded px-2 py-1 ${zoomLevel <= 1 ? "opacity-50" : ""}`}
              >
                <Text className="text-blue-500">-</Text>
              </TouchableOpacity>
              <Text className="mx-1 text-xs text-gray-600">
                {zoomLevel.toFixed(1)}x
              </Text>
              <TouchableOpacity
                onPress={handleZoomIn}
                disabled={zoomLevel >= 10}
                className={`rounded px-2 py-1 ${zoomLevel >= 10 ? "opacity-50" : ""}`}
              >
                <Text className="text-blue-500">+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Playback controls */}
      <View className="mt-2 w-full flex-row items-center justify-between px-2">
        <Text className="text-xs text-gray-600">{formatTime(currentTime)}</Text>

        <TouchableOpacity
          onPress={onPlayPause}
          className="rounded-full bg-blue-500 px-4 py-1"
        >
          <Text className="font-medium text-white">
            {isPlaying ? "Pause" : "Play"}
          </Text>
        </TouchableOpacity>

        <Text className="text-xs text-gray-600">
          {formatTime(audioDuration)}
        </Text>
      </View>
    </View>
  );
};

export { AudioWaveformWithTimeline, AdvancedAudioWaveform };

// Example usage:
//
// import { AudioWaveformWithTimeline, AdvancedAudioWaveform } from './AudioWaveform';
// import { Audio } from 'expo-av';
//
// export default function App() {
//   const [sound, setSound] = useState(null);
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [duration, setDuration] = useState(0);
//   const [position, setPosition] = useState(0);
//   // Example binary audio data (1s and 0s)
//   const sampleAudioData = Array(100).fill(0).map(() => Math.round(Math.random()));
//
//   // Load audio file
//   useEffect(() => {
//     async function loadAudio() {
//       const { sound } = await Audio.Sound.createAsync(require('./assets/sample.mp3'));
//       const status = await sound.getStatusAsync();
//       setSound(sound);
//       setDuration(status.durationMillis / 1000); // Convert to seconds
//
//       // Set up position updates
//       sound.setOnPlaybackStatusUpdate(status => {
//         if (status.isLoaded) {
//           setPosition(status.positionMillis / 1000); // Convert to seconds
//           setIsPlaying(status.isPlaying);
//         }
//       });
//     }
//
//     loadAudio();
//     return () => {
//       if (sound) {
//         sound.unloadAsync();
//       }
//     };
//   }, []);
//
//   // Handle play/pause
//   const handlePlayPause = async () => {
//     if (!sound) return;
//
//     if (isPlaying) {
//       await sound.pauseAsync();
//     } else {
//       await sound.playAsync();
//     }
//   };
//
//   // Handle seeking
//   const handleSeek = async (seekTime) => {
//     if (!sound) return;
//     await sound.setPositionAsync(seekTime * 1000); // Convert to milliseconds
//   };
//
//   return (
//     <View className="flex-1 items-center justify-center p-4 gap-8">
//       <Text className="text-lg font-bold text-gray-800">Basic Waveform Timeline</Text>
//       <AudioWaveformWithTimeline
//         audioData={sampleAudioData}
//         width={300}
//         height={100}
//         audioDuration={duration}
//         currentTime={position}
//         onSeek={handleSeek}
//         isPlaying={isPlaying}
//         onPlayPause={handlePlayPause}
//       />
//
//       <Text className="text-lg font-bold text-gray-800">Advanced Waveform</Text>
//       <AdvancedAudioWaveform
//         audioData={sampleAudioData}
//         width={300}
//         height={150}
//         audioDuration={duration}
//         currentTime={position}
//         onSeek={handleSeek}
//         isPlaying={isPlaying}
//         onPlayPause={handlePlayPause}
//         showZoomControls={true}
//       />
//     </View>
//   );
// }
