-- Rename rather than drop+add: this column (compareAtPriceMinor) was only
-- just introduced and has no real sale data on it anywhere yet, so a plain
-- rename is safe and avoids a pointless drop.
ALTER TABLE "DocumentTemplate" RENAME COLUMN "compareAtPriceMinor" TO "discountedPriceMinor";
