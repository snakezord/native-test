import React, { useEffect, useRef, useState } from "react";
import Scene from "@/App";
import { useAudioAnalyzer } from "@/components/audio/useAudioAnalyzer";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@acme/ui";

interface AudioVisualizerProps {
  className?: string;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ className }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Use the audio analyzer hook
  const audioData = useAudioAnalyzer(audioRef.current, {
    fftSize: 512,
    smoothingTimeConstant: 0.8,
  });

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Log audio data for debugging
  useEffect(() => {
    if (audioData.isPlaying) {
      console.log("Audio Data:", {
        amplitude: audioData.amplitude.toFixed(3),
        frequency: audioData.frequency.toFixed(0),
        isPlaying: audioData.isPlaying,
      });
    }
  }, [audioData]);

  return (
    <div className={`relative h-screen w-screen ${className || ""}`}>
      {/* Audio Controls */}
      <Card className="absolute right-5 top-5 z-[1000] min-w-[200px] border-blue-500/30 bg-black/70 text-white backdrop-blur-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-blue-400">
            Audio Visualizer
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Audio Data Display */}
          <div className="space-y-1 text-xs text-gray-300">
            <div>Amplitude: {audioData.amplitude.toFixed(3)}</div>
            <div>Frequency: {audioData.frequency.toFixed(0)} Hz</div>
            <div>Status: {audioData.isPlaying ? "Playing" : "Stopped"}</div>
          </div>

          <Button
            onClick={handlePlayPause}
            variant={isPlaying ? "destructive" : "primary"}
            size="sm"
            className="w-full"
          >
            {isPlaying ? "Pause" : "Play"}
          </Button>

          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && audioRef.current) {
                const url = URL.createObjectURL(file);
                audioRef.current.src = url;
              }
            }}
            className="block w-full cursor-pointer text-xs text-white file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-blue-600 file:px-2 file:py-1 file:text-xs file:text-white hover:file:bg-blue-700"
          />
        </CardContent>
      </Card>

      {/* Particle Visualization */}
      <Scene />

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        crossOrigin="anonymous"
      />
    </div>
  );
};

export default AudioVisualizer;
