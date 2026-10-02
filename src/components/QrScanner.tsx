"use client";

import { useEffect, useRef, useState } from "react";

type Detector = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> };

/**
 * Camera QR scanner. Uses the browser's BarcodeDetector where it exists (Chrome/Android, fast),
 * otherwise falls back to jsQR on downscaled frames. Calls `onCode` for every decode — the
 * parent decides how to debounce repeats.
 */
export function QrScanner({ onCode, onClose }: { onCode: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onCodeRef.current = onCode;
  });

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't open the camera. Use the search box instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch {
        setError("Camera permission was denied. Allow camera access for this site, or use the search box.");
        return;
      }
      if (stopped || !video.current) return stream.getTracks().forEach((t) => t.stop());
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});

      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      const native = BD ? new BD({ formats: ["qr_code"] }) : null;
      const jsQR = native ? null : (await import("jsqr")).default;

      let last = 0;
      const tick = async (now: number) => {
        if (stopped) return;
        const v = video.current;
        if (v && v.readyState >= 2 && now - last > 120) {
          last = now;
          try {
            if (native) {
              const hit = (await native.detect(v))[0];
              if (hit) onCodeRef.current(hit.rawValue);
            } else if (jsQR && ctx) {
              const scale = Math.min(1, 480 / v.videoWidth);
              canvas.width = Math.round(v.videoWidth * scale);
              canvas.height = Math.round(v.videoHeight * scale);
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
              if (hit) onCodeRef.current(hit.data);
            }
          } catch {
            /* a bad frame is fine — try the next one */
          }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="card space-y-3 !p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Scan a ticket QR</h3>
        <button type="button" className="btn !py-1" onClick={onClose}>Close camera</button>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : (
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl bg-black">
          <video ref={video} playsInline muted className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/80" />
        </div>
      )}
    </div>
  );
}
