"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/* ── native BarcodeDetector (shape only; not in TS lib DOM) ─────────────── */
type DetectedBarcodeLike = { rawValue?: string };
type BarcodeDetectorLike = {
  detect: (source: unknown) => Promise<DetectedBarcodeLike[]>;
};
type BarcodeDetectorCtorLike = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

/**
 * Extract the LP id out of a scanned payload. Kartu pecah bon meng-encode
 * `pecahBonId` sebagai teks polos, tapi kita tetap toleran terhadap payload
 * JSON `{ pecahBonId | id | cardId }`.
 */
export function resolveScanLookupValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const candidates = [parsed.pecahBonId, parsed.id, parsed.cardId];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  } catch {
    // Bukan JSON — pakai teks mentah.
  }

  return trimmed;
}

/**
 * Dengarkan input scanner mesin (keyboard-wedge). Scanner mengetik cepat lalu
 * mengirim Enter; buffer di-reset bila jeda antar tombol > 300ms. Diabaikan
 * saat fokus ada di input/textarea/select supaya tidak menabrak ketikan manual.
 */
export function useHardwareScanner(
  onScan: (payload: string) => void,
  enabled = true,
) {
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const bufferRef = { current: "" };
    let lastAt = 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditable =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target?.isContentEditable;
      if (isEditable) return;

      const now = Date.now();
      if (now - lastAt > 300) {
        bufferRef.current = "";
      }
      lastAt = now;

      if (event.key === "Enter") {
        const payload = bufferRef.current.trim();
        bufferRef.current = "";
        if (payload) onScanRef.current(payload);
        return;
      }

      if (event.key.length === 1) {
        bufferRef.current += event.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}

export type QrScanModalProps = {
  open: boolean;
  onClose: () => void;
  /** Return true bila payload cocok (modal ditutup otomatis). */
  onDetected: (rawValue: string) => Promise<boolean> | boolean;
  title?: string;
  description?: string;
};

/**
 * Modal scan QR/barcode via kamera (native BarcodeDetector). Scanner mesin
 * tetap jalan lewat useHardwareScanner secara terpisah.
 */
export function QrScanModal({
  open,
  onClose,
  onDetected,
  title = "Scan QR",
  description = "Arahkan kamera ke QR pada kartu pecah bon. Scanner mesin tetap bisa dipakai.",
}: QrScanModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const detectingRef = useRef(false);
  const lastPayloadRef = useRef("");
  const lastAtRef = useRef(0);
  const onDetectedRef = useRef(onDetected);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const stop = () => {
      if (loopRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(loopRef.current);
        loopRef.current = null;
      }
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      detectorRef.current = null;
      detectingRef.current = false;
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Browser tidak mendukung akses kamera.");
        return;
      }

      const ctor = (
        window as Window & { BarcodeDetector?: BarcodeDetectorCtorLike }
      ).BarcodeDetector;
      const useFallback = !ctor;

      setStarting(true);
      setError(null);
      lastPayloadRef.current = "";
      lastAtRef.current = 0;

      const canvas =
        typeof document !== "undefined"
          ? document.createElement("canvas")
          : null;
      const ctx = canvas ? canvas.getContext("2d") : null;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error("Elemen preview kamera tidak tersedia.");

        video.srcObject = stream;
        await video.play();

        if (ctor) {
          try {
            detectorRef.current = new ctor({
              formats: ["qr_code", "code_128"],
            });
          } catch {
            detectorRef.current = new ctor();
          }
        }

        const scanLoop = async () => {
          if (cancelled) return;
          const detector = detectorRef.current;
          const currentVideo = videoRef.current;

          if (
            currentVideo &&
            currentVideo.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA &&
            !detectingRef.current
          ) {
            detectingRef.current = true;
            try {
              let rawValue = "";

              if (detector) {
                const detections = await detector.detect(currentVideo);
                rawValue =
                  detections.find(
                    (item) =>
                      typeof item.rawValue === "string" &&
                      item.rawValue.trim().length > 0,
                  )?.rawValue ?? "";
              } else if (useFallback && canvas && ctx) {
                canvas.width = currentVideo.videoWidth;
                canvas.height = currentVideo.videoHeight;
                ctx.drawImage(currentVideo, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
                const code = jsQR(
                  imageData.data,
                  imageData.width,
                  imageData.height,
                  {
                    inversionAttempts: "dontInvert",
                  },
                );
                if (code && code.data) {
                  rawValue = code.data;
                }
              }

              if (rawValue) {
                const now = Date.now();
                if (
                  rawValue !== lastPayloadRef.current ||
                  now - lastAtRef.current > 1200
                ) {
                  lastPayloadRef.current = rawValue;
                  lastAtRef.current = now;
                  const found = await onDetectedRef.current(rawValue);
                  if (found) {
                    onClose();
                    return;
                  }
                }
              }
            } catch {
              // Abaikan kegagalan deteksi sementara saat stream distabilkan.
            } finally {
              detectingRef.current = false;
            }
          }

          loopRef.current = window.requestAnimationFrame(() => void scanLoop());
        };

        loopRef.current = window.requestAnimationFrame(() => void scanLoop());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal membuka kamera.");
        stop();
      } finally {
        setStarting(false);
      }
    };

    void start();

    return () => {
      cancelled = true;
      stop();
    };
    // onClose sengaja tidak dimasukkan agar kamera tidak restart tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <p className="mt-0.5 text-sm text-gray-500">{description}</p>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-black">
          <video
            ref={videoRef}
            className="h-64 w-full object-cover"
            muted
            playsInline
            autoPlay
          />
        </div>

        {starting && (
          <p className="mt-3 text-sm text-gray-600">Meminta izin kamera...</p>
        )}
        {error && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
