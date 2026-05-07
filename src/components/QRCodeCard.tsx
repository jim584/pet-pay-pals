import { QRCodeCanvas } from "qrcode.react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Copy } from "lucide-react";
import { toast } from "sonner";

export function QRCodeCard({ value, size = 240, label }: { value: string; size?: number; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const download = () => {
    const canvas = ref.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `referral-qr.png`;
    a.click();
  };

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    toast.success("Link copied");
  };

  return (
    <div className="flex flex-col items-center gap-3 p-4 rounded-lg border bg-card">
      <div ref={ref} className="bg-white p-3 rounded-md">
        <QRCodeCanvas value={value} size={size} includeMargin={false} />
      </div>
      {label && <p className="text-sm text-muted-foreground break-all text-center">{label}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={copy}><Copy className="w-4 h-4 mr-1" />Copy link</Button>
        <Button size="sm" onClick={download}><Download className="w-4 h-4 mr-1" />Download PNG</Button>
      </div>
    </div>
  );
}
