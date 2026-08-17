import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { Camera, Loader2, RefreshCw, Smartphone } from "lucide-react";
import { sendIdentityPhoneLink, submitIdentityPhoto } from "@/lib/vet-account-api";

interface Props {
  /** One-time token when capturing from the emailed phone link. */
  token?: string;
  /** Offer the "continue on phone" fallback (requires a signed-in session). */
  allowPhoneHandoff?: boolean;
  onSubmitted?: () => void;
}

export function IdentityCapture({ token, allowPhoneHandoff = true, onSubmitted }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setCameraError(null);
    setReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch (err) {
      setCameraError(
        (err as Error)?.name === "NotAllowedError"
          ? "Camera access was blocked. Allow the camera in your browser settings, then try again."
          : "No camera is available on this device.",
      );
    }
  }, []);

  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 960;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setShot(canvas.toDataURL("image/jpeg", 0.85));
    stop();
    setReady(false);
  };

  const retake = () => {
    setShot(null);
    start();
  };

  const submit = async () => {
    if (!shot) return;
    setSubmitting(true);
    try {
      await submitIdentityPhoto(shot, token);
      toast.success("Photo submitted. Our team reviews accounts within 24–72 hours.");
      onSubmitted?.();
    } catch (err) {
      toast.error((err as Error).message || "Could not submit the photo");
    } finally {
      setSubmitting(false);
    }
  };

  const emailPhoneLink = async () => {
    setSendingLink(true);
    try {
      const res = await sendIdentityPhoneLink();
      toast.success(
        res.emailed
          ? "We emailed you a secure link — open it on your phone to take the photo."
          : "Secure link created. Open it on your phone to take the photo.",
      );
    } catch (err) {
      toast.error((err as Error).message || "Could not send the link");
    } finally {
      setSendingLink(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Camera className="h-5 w-5" /> Live identity photo
        </CardTitle>
        <CardDescription>
          Take a live photo of yourself now. Uploads from your photo library are not accepted — the
          camera must be used so we can confirm you are the licensed veterinarian.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative overflow-hidden rounded-lg bg-muted aspect-[4/3]">
          {shot ? (
            <img src={shot} alt="Captured identity photo preview" className="h-full w-full object-cover" />
          ) : (
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          )}
          {!shot && !ready && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {cameraError ?? "Starting camera…"}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {shot ? (
            <>
              <Button onClick={submit} disabled={submitting} className="flex-1">
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Submit for verification
              </Button>
              <Button variant="outline" onClick={retake} disabled={submitting}>
                <RefreshCw className="h-4 w-4 mr-2" /> Retake
              </Button>
            </>
          ) : (
            <>
              <Button onClick={capture} disabled={!ready} className="flex-1">
                <Camera className="h-4 w-4 mr-2" /> Take photo
              </Button>
              {cameraError && (
                <Button variant="outline" onClick={start}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Try camera again
                </Button>
              )}
            </>
          )}
        </div>

        {allowPhoneHandoff && !token && (
          <div className="rounded-lg border p-3 text-sm">
            <p className="font-medium flex items-center gap-2">
              <Smartphone className="h-4 w-4" /> No camera on this computer?
            </p>
            <p className="text-muted-foreground mt-1">
              We can email you a one-time link to finish this step on your phone.
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={emailPhoneLink} disabled={sendingLink}>
              {sendingLink ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Email me a phone link
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
