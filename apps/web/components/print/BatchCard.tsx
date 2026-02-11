"use client";

import * as React from "react";
import QRCode from "react-qr-code";

export type BatchCardData = {
  batchNumber: string;
  cardId?: string;
  supplier?: {
    id: string;
    name: string;
    code?: string | null;
  };
  featherCondition: string;
  wetWeightGram: number;
  originalWetWeightGram?: number;
  moisturePercent: number;
  notes?: string | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
};

type BatchCardProps = {
  batch: BatchCardData;
};

const formatDateTime = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const formatNumber = (value: number, fractionDigits = 2) =>
  new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);

const BatchCard = React.forwardRef<HTMLDivElement, BatchCardProps>(({ batch }, ref) => {
  const displayWeightGram = batch.originalWetWeightGram ?? batch.wetWeightGram;
  const qrPayload = batch.cardId ?? batch.batchNumber;

  return (
      <>
        <style>{`
@page {
  size: 72mm 200mm;
  margin: 0;
}
html, body {
  margin: 0;
  padding: 0;
}
@media print {
  html, body {
    margin: 0;
    padding: 0;
    width: 72mm;
  }
  body {
    visibility: hidden;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  #printable-content {
    visibility: visible;
    position: absolute;
    left: -50mm;
    top: 0;
    width: 72mm;
    padding: 2mm;
    box-sizing: border-box;
  }
}
      `}</style>
      <div
        id="printable-content"
        ref={ref}
        className="bg-white text-black"
        style={{
          width: "72mm",
          padding: "2mm",
          fontFamily: "Arial, Roboto, sans-serif",
        }}
      >
        <div className="text-center text-[16px] font-bold">KARTU BAKU - TEI</div>
        <div className="mt-2 flex justify-center">
          <QRCode value={qrPayload} size={128} />
        </div>

        <div className="mt-2 border border-black/70 p-2 text-[12px]">
          <div className="grid grid-cols-2 gap-y-1">
            <div className="font-semibold">Batch No</div>
            <div className="text-right">{batch.batchNumber}</div>

            <div className="font-semibold">Tgl Masuk</div>
            <div className="text-right">{formatDateTime(batch.createdAt)}</div>

            <div className="font-semibold">Supplier</div>
            <div className="text-right">{batch.supplier?.name ?? "-"}</div>

            <div className="font-semibold">Grading</div>
            <div className="text-right">{batch.featherCondition}</div>
          </div>
        </div>

        <div className="mt-2 border-2 border-black p-2 text-center">
          <div className="text-[18px] font-bold">
            BERAT: {formatNumber(displayWeightGram, 2)} Gr
          </div>
          <div className="text-[18px] font-bold">
            KADAR AIR: {formatNumber(batch.moisturePercent, 1)}%
          </div>
        </div>

        <div className="mt-3 border-t border-dashed border-black" />
      </div>
    </>
  );
});
BatchCard.displayName = "BatchCard";

export default BatchCard;
