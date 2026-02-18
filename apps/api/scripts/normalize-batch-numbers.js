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

const apply = process.argv.includes("--apply");

function parseBatchNumber(value, createdAt) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return null;

  const fallbackYear = String(new Date(createdAt).getUTCFullYear()).slice(-2);
  let digits = null;
  let year = null;

  let match = raw.match(/^K(\d+)-TEI-(\d{2})$/);
  if (match) {
    digits = match[1];
    year = match[2];
  }

  if (!digits) {
    match = raw.match(/^K(\d+)-(\d{2})$/);
    if (match) {
      digits = match[1];
      year = match[2];
    }
  }

  if (!digits) {
    match = raw.match(/^K(\d+)$/);
    if (match) {
      digits = match[1];
      year = fallbackYear;
    }
  }

  if (!digits) {
    match = raw.match(/K\D*(\d{1,8})/);
    if (match) {
      digits = match[1];
      year = fallbackYear;
    }
  }

  if (!digits || !year) return null;

  const seq = Number.parseInt(digits, 10);
  if (!Number.isFinite(seq) || seq <= 0) return null;

  return `K${String(seq).padStart(4, "0")}-TEI-${year}`;
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const rows = await prisma.rawBatch.findMany({
      select: {
        id: true,
        batchNumber: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const keyToIds = new Map();
    for (const row of rows) {
      const key = row.batchNumber.toLowerCase();
      if (!keyToIds.has(key)) {
        keyToIds.set(key, new Set());
      }
      keyToIds.get(key).add(row.id);
    }

    const planned = [];
    const skipped = [];
    const conflicts = [];

    for (const row of rows) {
      const target = parseBatchNumber(row.batchNumber, row.createdAt);
      if (!target) {
        skipped.push({
          id: row.id,
          from: row.batchNumber,
          reason: "cannot-parse",
        });
        continue;
      }

      const current = row.batchNumber.toUpperCase();
      if (target === current) continue;

      const oldKey = row.batchNumber.toLowerCase();
      const targetKey = target.toLowerCase();
      const owners = keyToIds.get(targetKey) ?? new Set();
      const targetUsedByOther = owners.size > 0 && !owners.has(row.id);

      if (targetUsedByOther) {
        conflicts.push({
          id: row.id,
          from: row.batchNumber,
          to: target,
          reason: "duplicate-target",
        });
        continue;
      }

      planned.push({ id: row.id, from: row.batchNumber, to: target });

      const oldOwners = keyToIds.get(oldKey);
      if (oldOwners) {
        oldOwners.delete(row.id);
        if (oldOwners.size === 0) keyToIds.delete(oldKey);
      }

      if (!keyToIds.has(targetKey)) {
        keyToIds.set(targetKey, new Set());
      }
      keyToIds.get(targetKey).add(row.id);
    }

    console.log(`Raw batches: ${rows.length}`);
    console.log(`Planned updates: ${planned.length}`);
    console.log(`Skipped (cannot parse): ${skipped.length}`);
    console.log(`Conflicts: ${conflicts.length}`);

    if (planned.length > 0) {
      console.log("\nPlanned changes:");
      for (const item of planned) {
        console.log(`- ${item.from} -> ${item.to}`);
      }
    }

    if (conflicts.length > 0) {
      console.log("\nConflicts (manual fix needed):");
      for (const item of conflicts) {
        console.log(`- ${item.from} -> ${item.to} (${item.reason})`);
      }
    }

    if (!apply) {
      console.log("\nDry run only. Re-run with --apply to execute updates.");
      return;
    }

    for (const item of planned) {
      await prisma.rawBatch.update({
        where: { id: item.id },
        data: { batchNumber: item.to },
      });
    }

    console.log(`\nApplied updates: ${planned.length}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
