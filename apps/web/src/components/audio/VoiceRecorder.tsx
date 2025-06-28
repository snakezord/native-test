import React, { useEffect } from "react";
import { useVoice } from "@/hooks/use-voice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VoiceRecorderProps {
  className?: string;
  onAudioData?: (audioData: {
    amplitude: number;
    frequency: number;
    frequencyData: Uint8Array;
    bassLevel: number;
    midLevel: number;
    trebleLevel: number;
    isRecording: boolean;
  }) => void;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  className,
  onAudioData,
}) => {
  const {
    isRecording,
    isPlaying,
    hasPermission,
    recordedAudio,
    error,
    currentVolume,
    isVoiceDetected,
    audioData,
    startRecording,
    stopRecording,
    playRecording,
    stopPlayback,
    clearRecording,
    getRecordedAudioAsWav,
    audioProcessingMode,
    setAudioProcessingMode,
  } = useVoice();

  // Pass audio data to parent component
  useEffect(() => {
    if (onAudioData) {
      const dataToSend = {
        ...audioData,
        isRecording,
      };
      console.log("🎤 VoiceRecorder sending audio data:", dataToSend);
      onAudioData(dataToSend);
    }
  }, [audioData, isRecording, onAudioData]);

  const getVolumeColor = (volume: number) => {
    if (volume < 20) return "bg-green-500"; // Green
    if (volume < 60) return "bg-yellow-500"; // Yellow
    return "bg-red-500"; // Red
  };

  const getPermissionMessage = () => {
    if (hasPermission === null) return "Permission not requested";
    if (hasPermission === false) return "Microphone permission denied";
    return "Microphone access granted";
  };

  const handleDownload = async () => {
    if (!recordedAudio) return;

    const wavBlob = await getRecordedAudioAsWav();
    if (!wavBlob) {
      // The error will be displayed in the UI via the 'error' state in the hook
      return;
    }

    const url = URL.createObjectURL(wavBlob);
    const link = document.createElement("a");
    link.href = url;

    // Create a unique filename with the correct .wav extension
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.download = `recording-${timestamp}.wav`;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card
      className={`bg-black/80 backdrop-blur-lg border-blue-500/30 text-white min-w-[280px] ${
        className || ""
      }`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-blue-400 text-sm font-bold">
          Voice Recorder
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Permission Status */}
        <div
          className={`text-[10px] p-1.5 rounded border ${
            hasPermission === false
              ? "text-red-400 bg-red-500/10 border-red-500/30"
              : "text-green-400 bg-green-500/10 border-green-500/30"
          }`}
        >
          {getPermissionMessage()}
        </div>

        {/* Error Display */}
        {error && (
          <div className="text-[10px] p-2 rounded text-red-400 bg-red-500/20 border border-red-500">
            Error: {error}
          </div>
        )}

        {/* Audio Visualization Data */}
        {isRecording && (
          <div className="text-[10px] p-1.5 rounded text-gray-400 bg-blue-500/10 border border-blue-500/30 space-y-0.5">
            <div className="text-blue-400">🎵 Audio Analysis:</div>
            <div>Amp: {(audioData.amplitude * 100).toFixed(1)}%</div>
            <div>
              B: {(audioData.bassLevel * 100).toFixed(0)}% | M:{" "}
              {(audioData.midLevel * 100).toFixed(0)}% | T:{" "}
              {(audioData.trebleLevel * 100).toFixed(0)}%
            </div>
            <div>Freq: {audioData.frequency.toFixed(0)} Hz</div>
          </div>
        )}

        {/* Volume Meter */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] text-gray-300">
            <span>Volume: {currentVolume}%</span>
            <Badge
              className={`text-[10px] px-1.5 py-0.5 ${
                isVoiceDetected
                  ? "bg-green-500/20 text-green-400 border-green-500"
                  : "bg-gray-500/20 text-gray-400 border-gray-500"
              }`}
            >
              {isVoiceDetected ? "🎤" : "🔇"}
            </Badge>
          </div>

          {/* Volume Bar */}
          <div className="w-full h-1.5 bg-white/20 rounded overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ${getVolumeColor(
                currentVolume
              )}`}
              style={{ width: `${currentVolume}%` }}
            />
          </div>
        </div>

        {/* Recording Controls */}
        <div className="flex flex-wrap gap-1.5">
          <Button
            onClick={() => {
              console.log("🖱️ Button clicked - Current state:", {
                isRecording,
                hasPermission,
              });
              if (isRecording) {
                console.log("🛑 Calling stopRecording...");
                stopRecording();
              } else {
                console.log("🎙️ Calling startRecording...");
                startRecording();
              }
            }}
            disabled={hasPermission === false}
            variant={isRecording ? "destructive" : "default"}
            size="sm"
            className="flex items-center gap-1.5 text-xs px-2 py-1"
          >
            {isRecording ? "⏹️ Stop" : "🎙️ Record"}
          </Button>

          {recordedAudio && (
            <>
              <Button
                onClick={isPlaying ? stopPlayback : playRecording}
                variant={isPlaying ? "secondary" : "outline"}
                size="sm"
                className="flex items-center gap-1.5 text-xs px-2 py-1"
              >
                {isPlaying ? "⏸️" : "▶️"}
              </Button>

              <Button
                onClick={handleDownload}
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 text-blue-400 border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-300 text-xs px-2 py-1"
              >
                📥
              </Button>

              <Button
                onClick={clearRecording}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white text-xs px-2 py-1"
              >
                🗑️
              </Button>
            </>
          )}
        </div>

        {/* Audio Processing Mode Controls */}
        <div className="pt-2 border-t border-white/20 space-y-2">
          <h4 className="text-purple-400 text-xs font-medium">
            Processing Mode
          </h4>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => setAudioProcessingMode("native")}
              variant={audioProcessingMode === "native" ? "default" : "outline"}
              size="sm"
              className={`justify-center text-[10px] py-1 px-2 ${
                audioProcessingMode === "native"
                  ? "bg-orange-600 hover:bg-orange-700 text-white"
                  : "border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
              }`}
              disabled={isRecording}
            >
              🌐 Native
            </Button>

            <Button
              onClick={() => setAudioProcessingMode("raw")}
              variant={audioProcessingMode === "raw" ? "default" : "outline"}
              size="sm"
              className={`justify-center text-[10px] py-1 px-2 ${
                audioProcessingMode === "raw"
                  ? "bg-gray-600 hover:bg-gray-700 text-white"
                  : "border-gray-500/50 text-gray-400 hover:bg-gray-500/10"
              }`}
              disabled={isRecording}
            >
              🎤 Raw
            </Button>
          </div>
        </div>

        {/* Status */}
        <div className="text-center text-[10px] text-gray-400 pt-1">
          {isRecording && "🔴 Recording..."}
          {isPlaying && "🔊 Playing..."}
          {!isRecording && !isPlaying && recordedAudio && "✅ Ready"}
          {!isRecording && !isPlaying && !recordedAudio && "⚪ Ready"}
        </div>
      </CardContent>
    </Card>
  );
};

export default VoiceRecorder;
