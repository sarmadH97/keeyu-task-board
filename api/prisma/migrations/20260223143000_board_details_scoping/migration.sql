-- Rename board ownership and display fields
ALTER TABLE "Board" RENAME COLUMN "userId" TO "ownerUserId";
ALTER TABLE "Board" RENAME COLUMN "title" TO "name";

-- Add board details metadata
ALTER TABLE "Board" ADD COLUMN "description" TEXT;
ALTER TABLE "Board" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Recreate indexes for board ownership lookups
DROP INDEX IF EXISTS "Board_userId_idx";
DROP INDEX IF EXISTS "Board_userId_position_idx";
CREATE INDEX "Board_ownerUserId_idx" ON "Board"("ownerUserId");
CREATE INDEX "Board_ownerUserId_position_idx" ON "Board"("ownerUserId", "position");

-- Recreate FK with explicit ownership naming
ALTER TABLE "Board" DROP CONSTRAINT IF EXISTS "Board_userId_fkey";
ALTER TABLE "Board" ADD CONSTRAINT "Board_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
