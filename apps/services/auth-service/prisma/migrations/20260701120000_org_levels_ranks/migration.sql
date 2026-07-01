-- CreateEnum: in-department role ladder (ordinal by declaration order)
CREATE TYPE "DeptRank" AS ENUM ('IC', 'LEAD', 'MANAGER', 'SENIOR_MANAGER', 'DIRECTOR', 'VP');

-- AlterTable: company-wide seniority level (L3 = intern floor)
ALTER TABLE "User" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 3;

-- AlterTable: org-level floor per permission (Stage 1 of the combined gate)
ALTER TABLE "Permission" ADD COLUMN "minLevel" INTEGER NOT NULL DEFAULT 3;

-- AlterTable: replace the isManager boolean with the rank ladder.
-- Add the new column, backfill managers to MANAGER, then drop the old boolean.
ALTER TABLE "UserDepartment" ADD COLUMN "rank" "DeptRank" NOT NULL DEFAULT 'IC';
UPDATE "UserDepartment" SET "rank" = 'MANAGER' WHERE "isManager" = true;
ALTER TABLE "UserDepartment" DROP COLUMN "isManager";
