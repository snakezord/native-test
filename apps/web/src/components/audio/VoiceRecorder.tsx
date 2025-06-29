import React, { useEffect } from "react";
import { useVoice } from "@/hooks/use-voice";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@vibespeak/ui";

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
      className={`min-w-[280px] border-blue-500/30 bg-black/80 text-white backdrop-blur-lg ${
        className || ""
      }`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-blue-400">
          Voice Recorder
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Permission Status */}
        <div
          className={`rounded border p-1.5 text-[10px] ${
            hasPermission === false
              ? "border-red-500/30 bg-red-500/10 text-red-400"
              : "border-green-500/30 bg-green-500/10 text-green-400"
          }`}
        >
          {getPermissionMessage()}
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded border border-red-500 bg-red-500/20 p-2 text-[10px] text-red-400">
            Error: {error}
          </div>
        )}

        {/* Audio Visualization Data */}
        {isRecording && (
          <div className="space-y-0.5 rounded border border-blue-500/30 bg-blue-500/10 p-1.5 text-[10px] text-gray-400">
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
          <div className="flex items-center justify-between text-[10px] text-gray-300">
            <span>Volume: {currentVolume}%</span>
            <Badge
              className={`px-1.5 py-0.5 text-[10px] ${
                isVoiceDetected
                  ? "border-green-500 bg-green-500/20 text-green-400"
                  : "border-gray-500 bg-gray-500/20 text-gray-400"
              }`}
            >
              {isVoiceDetected ? "🎤" : "🔇"}
            </Badge>
          </div>

          {/* Volume Bar */}
          <div className="h-1.5 w-full overflow-hidden rounded bg-white/20">
            <div
              className={`h-full transition-all duration-100 ${getVolumeColor(
                currentVolume,
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
            variant={isRecording ? "destructive" : "primary"}
            size="sm"
            className="flex items-center gap-1.5 px-2 py-1 text-xs"
          >
            {isRecording ? "⏹️ Stop" : "🎙️ Record"}
          </Button>

          {recordedAudio && (
            <>
              <Button
                onClick={isPlaying ? stopPlayback : playRecording}
                variant={isPlaying ? "secondary" : "outline"}
                size="sm"
                className="flex items-center gap-1.5 px-2 py-1 text-xs"
              >
                {isPlaying ? "⏸️" : "▶️"}
              </Button>

              <Button
                onClick={handleDownload}
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 border-blue-500/50 px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
              >
                📥
              </Button>

              <Button
                onClick={clearRecording}
                variant="ghost"
                size="sm"
                className="px-2 py-1 text-xs text-gray-400 hover:text-white"
              >
                🗑️
              </Button>
            </>
          )}
        </div>

        {/* Audio Processing Mode Controls */}
        <div className="space-y-2 border-t border-white/20 pt-2">
          <h4 className="text-xs font-medium text-purple-400">
            Processing Mode
          </h4>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => setAudioProcessingMode("native")}
              variant={audioProcessingMode === "native" ? "primary" : "outline"}
              size="sm"
              className={`justify-center px-2 py-1 text-[10px] ${
                audioProcessingMode === "native"
                  ? "bg-orange-600 text-white hover:bg-orange-700"
                  : "border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
              }`}
              disabled={isRecording}
            >
              🌐 Native
            </Button>

            <Button
              onClick={() => setAudioProcessingMode("raw")}
              variant={audioProcessingMode === "raw" ? "primary" : "outline"}
              size="sm"
              className={`justify-center px-2 py-1 text-[10px] ${
                audioProcessingMode === "raw"
                  ? "bg-gray-600 text-white hover:bg-gray-700"
                  : "border-gray-500/50 text-gray-400 hover:bg-gray-500/10"
              }`}
              disabled={isRecording}
            >
              🎤 Raw
            </Button>
          </div>
        </div>

        {/* Status */}
        <div className="pt-1 text-center text-[10px] text-gray-400">
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
