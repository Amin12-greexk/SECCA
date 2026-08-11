"use client";

import * as React from "react";
import QRCode from "react-qr-code";

export type PecahBonCardData = {
  pecahBonId: string;
  batchNumber: string;
  orderedForName?: string;
  pecahBonDate: string | Date;
  gradeCode?: string;
  featherCondition: string;
  pieceCount: number;
  initialWeightGram: number;
  moisturePercent: number;
  dryWeightGram: number;
};

type PecahBonCardProps = {
  entry: PecahBonCardData;
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

const PecahBonCard = React.forwardRef<HTMLDivElement, PecahBonCardProps>(
  ({ entry }, ref) => {
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
    width: 72mm;
  }
  #printable-content {
    visibility: visible;
    position: absolute;
    left: 0mm;
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
          <div className="text-center text-[16px] font-bold">
            KARTU PECAH BON - TEI
          </div>
          <div className="mt-2 flex justify-center">
            <QRCode value={entry.pecahBonId || entry.batchNumber} size={120} />
          </div>

          <div className="mt-2 border border-black/70 p-2 text-[12px]">
            <div className="grid grid-cols-2 gap-y-1">
              <div className="font-semibold">ID Pecah</div>
              <div className="text-right">{entry.pecahBonId}</div>

              <div className="font-semibold">Batch No</div>
              <div className="text-right">{entry.batchNumber}</div>

              <div className="font-semibold">Nama Mitra</div>
              <div className="text-right">{entry.orderedForName || "-"}</div>

              <div className="font-semibold">Tgl Pecah</div>
              <div className="text-right">
                {formatDateTime(entry.pecahBonDate)}
              </div>

              <div className="font-semibold">Grade</div>
              <div className="text-right">{entry.gradeCode ?? "-"}</div>
            </div>
          </div>

          <div className="mt-2 border-2 border-black p-2 text-center">
            <div className="text-[16px] font-bold">
              BERAT: {formatNumber(entry.initialWeightGram, 2)} Gr
            </div>
            <div className="text-[16px] font-bold">
              KADAR AIR: {formatNumber(entry.moisturePercent, 1)}%
            </div>
            <div className="text-[16px] font-bold">
              KEPING: {entry.pieceCount ?? 0} Kpg
            </div>
          </div>

          <div className="mt-3 border-t border-dashed border-black" />
        </div>
      </>
    );
  },
);
PecahBonCard.displayName = "PecahBonCard";

export default PecahBonCard;
