"use client";

import * as React from "react";
import QRCode from "react-qr-code";

export type BatchCardData = {
  batchNumber: string;
  cardId: string;
  supplier?: {
    id: string;
    name: string;
    code?: string | null;
  };
  origin: string;
  featherCondition: string;
  wetWeightGram: number;
  moisturePercent: number;
  pieceCount: number;
  createdAt: string | Date;
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
  return (
    <>
      <style>{`
@page {
  size: 72mm auto;
  margin: 0;
}
@media print {
  body { visibility: hidden; }
  #printable-content {
    visibility: visible;
    position: absolute;
    left: 0;
    top: 0;
    width: 72mm;
    padding: 2mm;
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
          <QRCode value={batch.cardId} size={128} />
        </div>
        <div className="mt-2 text-center text-[11px] font-semibold">{batch.cardId}</div>

        <div className="mt-2 border border-black/70 p-2 text-[12px]">
          <div className="grid grid-cols-2 gap-y-1">
            <div className="font-semibold">Batch No</div>
            <div className="text-right">{batch.batchNumber}</div>

            <div className="font-semibold">Tgl Masuk</div>
            <div className="text-right">{formatDateTime(batch.createdAt)}</div>

            <div className="font-semibold">Asal</div>
            <div className="text-right">{batch.origin}</div>

            <div className="font-semibold">Kondisi</div>
            <div className="text-right">{batch.featherCondition}</div>
          </div>
        </div>

        <div className="mt-2 border-2 border-black p-2 text-center">
          <div className="text-[18px] font-bold">
            WEIGHT: {formatNumber(batch.wetWeightGram, 2)} Gr
          </div>
          <div className="text-[18px] font-bold">
            MOIST: {formatNumber(batch.moisturePercent, 1)}%
          </div>
        </div>

        <div className="mt-2 text-center text-[11px]">
          Pieces: {batch.pieceCount}
        </div>

        <div className="mt-3 border-t border-dashed border-black" />
      </div>
    </>
  );
});
BatchCard.displayName = "BatchCard";

export default BatchCard;
