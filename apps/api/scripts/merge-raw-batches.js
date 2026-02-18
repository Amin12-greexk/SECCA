/* eslint-disable no-console */
require("dotenv/config");

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function printUsage() {
  console.log(`
Usage:
  node scripts/merge-raw-batches.js --target <id|batchNumber> --source <id|batchNumber> [--apply] [--force]

Examples:
  # Dry-run
  pnpm --filter api db:batch:merge:dry -- --target K0001-TEI-26 --source K0002-TEI-26

  # Apply
  pnpm --filter api db:batch:merge -- --target K0001-TEI-26 --source K0002-TEI-26

Notes:
  - Default mode is dry-run (no DB changes).
  - Use --apply to execute merge.
  - Use --force only if supplier/kondisi berbeda dan kamu yakin merge tetap benar.
`);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

async function resolveRawBatch(prisma, input) {
  if (!input) return null;
  const normalized = String(input).trim();
  if (!normalized) return null;

  if (isUuid(normalized)) {
    const byId = await prisma.rawBatch.findUnique({
      where: { id: normalized },
    });
    if (byId) return byId;
  }

  return prisma.rawBatch.findFirst({
    where: { batchNumber: { equals: normalized, mode: "insensitive" } },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceInput = args.source;
  const targetInput = args.target;
  const apply = Boolean(args.apply);
  const force = Boolean(args.force);

  if (!sourceInput || !targetInput) {
    printUsage();
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const [source, target] = await Promise.all([
      resolveRawBatch(prisma, sourceInput),
      resolveRawBatch(prisma, targetInput),
    ]);

    if (!source) {
      throw new Error(`Source batch not found: ${sourceInput}`);
    }
    if (!target) {
      throw new Error(`Target batch not found: ${targetInput}`);
    }
    if (source.id === target.id) {
      throw new Error("Source and target must be different batches.");
    }

    const [sourcePecahCount, targetPecahCount, sourceStocks, targetStocks] =
      await Promise.all([
        prisma.pecahBonEntry.count({ where: { rawBatchId: source.id } }),
        prisma.pecahBonEntry.count({ where: { rawBatchId: target.id } }),
        prisma.rawBatchGradeStock.findMany({
          where: { rawBatchId: source.id },
          select: {
            id: true,
            gradeId: true,
            wetWeightGram: true,
            remainingWetWeightGram: true,
          },
        }),
        prisma.rawBatchGradeStock.findMany({
          where: { rawBatchId: target.id },
          select: {
            id: true,
            gradeId: true,
            wetWeightGram: true,
            remainingWetWeightGram: true,
          },
        }),
      ]);

    const targetByGrade = new Map(targetStocks.map((stock) => [stock.gradeId, stock]));
    const plan = sourceStocks.map((stock) => {
      const targetStock = targetByGrade.get(stock.gradeId) ?? null;
      return {
        sourceStock: stock,
        targetStock,
        mode: targetStock ? "MERGE_STOCK" : "MOVE_STOCK",
      };
    });

    const mismatches = [];
    if (source.supplierId !== target.supplierId) {
      mismatches.push("supplier berbeda");
    }
    if (source.featherCondition !== target.featherCondition) {
      mismatches.push("kondisi baku berbeda");
    }

    const totalWetAfter = round2(target.wetWeightGram + source.wetWeightGram);
    const mergedMoisture =
      totalWetAfter > 0
        ? round2(
            (target.moisturePercent * target.wetWeightGram +
              source.moisturePercent * source.wetWeightGram) /
              totalWetAfter,
          )
        : round2(target.moisturePercent);

    console.log("=== Raw Batch Merge Plan ===");
    console.log(`Target: ${target.batchNumber} (${target.id})`);
    console.log(`Source: ${source.batchNumber} (${source.id})`);
    console.log(`Apply mode: ${apply ? "YES" : "NO (dry-run)"}`);
    console.log(`Force mode: ${force ? "YES" : "NO"}`);
    console.log("");
    console.log(`Pecah Bon entries: target=${targetPecahCount}, source=${sourcePecahCount}`);
    console.log(`Grade stocks: target=${targetStocks.length}, source=${sourceStocks.length}`);
    console.log(
      `Projected target wetWeightGram: ${round2(target.wetWeightGram)} + ${round2(source.wetWeightGram)} = ${totalWetAfter}`,
    );
    console.log(
      `Projected target invoiceWeightGram: ${round2(target.invoiceWeightGram)} + ${round2(source.invoiceWeightGram)} = ${round2(target.invoiceWeightGram + source.invoiceWeightGram)}`,
    );
    console.log(
      `Projected target moisturePercent (weighted): ${round2(target.moisturePercent)} & ${round2(source.moisturePercent)} => ${mergedMoisture}`,
    );
    console.log("");

    const mergeCount = plan.filter((item) => item.mode === "MERGE_STOCK").length;
    const moveCount = plan.filter((item) => item.mode === "MOVE_STOCK").length;
    console.log(`Stock actions: merge=${mergeCount}, move=${moveCount}`);

    if (mismatches.length > 0) {
      console.log(`\nPre-check warning: ${mismatches.join(", ")}`);
      if (!force) {
        console.log("Abort. Re-run with --force if this merge is still intended.");
        return;
      }
    }

    if (!apply) {
      console.log("\nDry-run complete. No changes were written.");
      return;
    }

    const mergeNoteParts = [
      target.notes?.trim() || null,
      `[MERGED RAW BATCH] source=${source.batchNumber} (${source.id}) at ${new Date().toISOString()}`,
      source.notes?.trim() ? `source-notes: ${source.notes.trim()}` : null,
    ].filter(Boolean);

    await prisma.$transaction(async (tx) => {
      // Move all pecah bon records to target raw batch.
      await tx.pecahBonEntry.updateMany({
        where: { rawBatchId: source.id },
        data: { rawBatchId: target.id },
      });

      for (const action of plan) {
        if (action.mode === "MERGE_STOCK") {
          await tx.lotSource.updateMany({
            where: { gradedStockId: action.sourceStock.id },
            data: { gradedStockId: action.targetStock.id },
          });

          await tx.rawBatchGradeStock.update({
            where: { id: action.targetStock.id },
            data: {
              wetWeightGram:
                action.targetStock.wetWeightGram + action.sourceStock.wetWeightGram,
              remainingWetWeightGram:
                action.targetStock.remainingWetWeightGram +
                action.sourceStock.remainingWetWeightGram,
            },
          });

          await tx.rawBatchGradeStock.delete({
            where: { id: action.sourceStock.id },
          });
        } else {
          await tx.rawBatchGradeStock.update({
            where: { id: action.sourceStock.id },
            data: { rawBatchId: target.id },
          });
        }
      }

      await tx.rawBatch.update({
        where: { id: target.id },
        data: {
          wetWeightGram: totalWetAfter,
          invoiceWeightGram: round2(target.invoiceWeightGram + source.invoiceWeightGram),
          moisturePercent: mergedMoisture,
          notes: mergeNoteParts.join(" | "),
        },
      });

      await tx.rawBatch.delete({
        where: { id: source.id },
      });
    });

    console.log("\nMerge applied successfully.");
    console.log(`Deleted source batch: ${source.batchNumber}`);
    console.log(`Target batch updated: ${target.batchNumber}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
