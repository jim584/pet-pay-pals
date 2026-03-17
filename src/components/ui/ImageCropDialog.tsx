import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { getCroppedImage, DEFAULT_FILTERS, ImageFilters } from "@/lib/crop-utils";
import { ZoomIn, Square, RectangleHorizontal, Monitor, Sun, Contrast, Palette, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const ASPECT_OPTIONS = [
  { label: "1:1", value: 1, icon: Square },
  { label: "4:3", value: 4 / 3, icon: RectangleHorizontal },
  { label: "16:9", value: 16 / 9, icon: Monitor },
] as const;

const FILTER_PRESETS: { label: string; filters: ImageFilters }[] = [
  { label: "Original", filters: { brightness: 100, contrast: 100, saturation: 100 } },
  { label: "Vivid", filters: { brightness: 105, contrast: 115, saturation: 140 } },
  { label: "Warm", filters: { brightness: 108, contrast: 105, saturation: 120 } },
  { label: "Cool", filters: { brightness: 100, contrast: 110, saturation: 80 } },
  { label: "B&W", filters: { brightness: 105, contrast: 120, saturation: 0 } },
];

const FILTER_CONTROLS = [
  { key: "brightness" as const, label: "Brightness", icon: Sun },
  { key: "contrast" as const, label: "Contrast", icon: Contrast },
  { key: "saturation" as const, label: "Saturation", icon: Palette },
];

interface ImageCropDialogProps {
  open: boolean;
  imageSrc: string;
  aspectRatio?: number;
  showAspectOptions?: boolean;
  onConfirm: (croppedFile: File, previewUrl: string) => void;
  onCancel: () => void;
}

export function ImageCropDialog({
  open,
  imageSrc,
  aspectRatio = 4 / 3,
  showAspectOptions = true,
  onConfirm,
  onCancel,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [activeAspect, setActiveAspect] = useState(aspectRatio);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [filters, setFilters] = useState<ImageFilters>({ ...DEFAULT_FILTERS });
  const [activePreset, setActivePreset] = useState("Original");

  const filtersChanged =
    filters.brightness !== 100 || filters.contrast !== 100 || filters.saturation !== 100;

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const croppedFile = await getCroppedImage(imageSrc, croppedAreaPixels, "cropped.jpg", filters);
      const previewUrl = URL.createObjectURL(croppedFile);
      onConfirm(croppedFile, previewUrl);
    } catch {
      // fallback
    } finally {
      setProcessing(false);
      resetState();
    }
  };

  const resetState = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setActiveAspect(aspectRatio);
    setFilters({ ...DEFAULT_FILTERS });
  };

  const handleCancel = () => {
    resetState();
    onCancel();
  };

  const filterStyle = {
    filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%)`,
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Edit Image</DialogTitle>
        </DialogHeader>

        {/* Crop area with live filter preview */}
        <div className="relative w-full h-64 sm:h-72 bg-muted" style={filterStyle}>
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={activeAspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        {/* Aspect ratio pills */}
        {showAspectOptions && (
          <div className="px-4 pt-3 flex items-center justify-center gap-1.5">
            {ASPECT_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setActiveAspect(opt.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  activeAspect === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                <opt.icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Zoom */}
        <div className="px-4 pt-3 flex items-center gap-3">
          <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.05}
            onValueChange={(v) => setZoom(v[0])}
            className="flex-1"
          />
        </div>

        {/* Filters */}
        <div className="px-4 pt-2 pb-1 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Adjustments</span>
            {filtersChanged && (
              <button
                type="button"
                onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
          </div>
          {FILTER_CONTROLS.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center gap-3">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <Slider
                value={[filters[key]]}
                min={0}
                max={200}
                step={1}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, [key]: v[0] }))}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
                {filters[key]}
              </span>
            </div>
          ))}
        </div>

        <DialogFooter className="p-4 pt-2 gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={processing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={processing}>
            {processing ? "Applying…" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
