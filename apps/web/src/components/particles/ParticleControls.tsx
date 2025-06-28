import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

interface ParticleControlsProps {
  noiseIntensity: number;
  setNoiseIntensity: (value: number) => void;
  pulseAmplitude: number;
  setPulseAmplitude: (value: number) => void;
  torusMode: boolean;
  setTorusMode: (value: boolean) => void;
  torusRadius: number;
  setTorusRadius: (value: number) => void;
  torusSpeed: number;
  setTorusSpeed: (value: number) => void;
  torusMinorRadius: number;
  setTorusMinorRadius: (value: number) => void;
  isAudioReactive: boolean;
  onTriggerLoading: (
    type: "processing" | "analyzing" | "generating" | "idle"
  ) => void;
}

export function ParticleControls({
  noiseIntensity,
  setNoiseIntensity,
  pulseAmplitude,
  setPulseAmplitude,
  torusMode,
  setTorusMode,
  torusRadius,
  setTorusRadius,
  torusSpeed,
  setTorusSpeed,
  torusMinorRadius,
  setTorusMinorRadius,
  isAudioReactive,
  onTriggerLoading,
}: ParticleControlsProps) {
  return (
    <Card className="bg-black/80 backdrop-blur-lg border-blue-500/30 text-white w-[320px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Particle Controls
          {isAudioReactive && (
            <Badge
              variant="secondary"
              className="bg-green-500/20 text-green-300"
            >
              Audio Reactive
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm">
            Noise Intensity: {noiseIntensity.toFixed(3)}
          </Label>
          <Slider
            value={[noiseIntensity]}
            onValueChange={([value]) => setNoiseIntensity(value)}
            min={0}
            max={0.1}
            step={0.001}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">
            Pulse Amplitude: {pulseAmplitude.toFixed(3)}
          </Label>
          <Slider
            value={[pulseAmplitude]}
            onValueChange={([value]) => setPulseAmplitude(value)}
            min={0}
            max={0.1}
            step={0.001}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="torus-mode"
            checked={torusMode}
            onCheckedChange={(checked) => setTorusMode(!!checked)}
          />
          <Label htmlFor="torus-mode" className="text-sm">
            Torus Mode
          </Label>
        </div>

        {torusMode && (
          <div className="space-y-4 pl-4 border-l-2 border-blue-500/30">
            <div className="space-y-2">
              <Label className="text-sm">
                Torus Radius: {torusRadius.toFixed(1)}
              </Label>
              <Slider
                value={[torusRadius]}
                onValueChange={([value]) => setTorusRadius(value)}
                min={0.5}
                max={2.0}
                step={0.1}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Torus Speed: {torusSpeed.toFixed(1)}
              </Label>
              <Slider
                value={[torusSpeed]}
                onValueChange={([value]) => setTorusSpeed(value)}
                min={0.1}
                max={3.0}
                step={0.1}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Minor Radius: {torusMinorRadius.toFixed(2)}
              </Label>
              <Slider
                value={[torusMinorRadius]}
                onValueChange={([value]) => setTorusMinorRadius(value)}
                min={0.1}
                max={0.8}
                step={0.05}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm">Test Loading States</Label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => onTriggerLoading("processing")}
              className="px-3 py-1 text-xs bg-blue-500/20 text-blue-300 rounded"
            >
              Processing
            </button>
            <button
              onClick={() => onTriggerLoading("analyzing")}
              className="px-3 py-1 text-xs bg-green-500/20 text-green-300 rounded"
            >
              Analyzing
            </button>
            <button
              onClick={() => onTriggerLoading("generating")}
              className="px-3 py-1 text-xs bg-purple-500/20 text-purple-300 rounded"
            >
              Generating
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
