import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { getCroppedImage } from "@/lib/crop-utils";
import { ZoomIn, Square, RectangleHorizontal, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const ASPECT_OPTIONS = [
  { label: "1:1", value: 1, icon: Square },
  { label: "4:3", value: 4 / 3, icon: RectangleHorizontal },
  { label: "16:9", value: 16 / 9, icon: Monitor },
] as const;

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

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const croppedFile = await getCroppedImage(imageSrc, croppedAreaPixels);
      const previewUrl = URL.createObjectURL(croppedFile);
      onConfirm(croppedFile, previewUrl);
    } catch {
      // fallback: pass original
    } finally {
      setProcessing(false);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  };

  const handleCancel = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setActiveAspect(aspectRatio);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Crop Image</DialogTitle>
        </DialogHeader>
        <div className="relative w-full h-72 sm:h-80 bg-muted">
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
        <div className="px-4 py-3 flex items-center gap-3">
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
        <DialogFooter className="p-4 pt-0 gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={processing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={processing}>
            {processing ? "Cropping…" : "Apply Crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
