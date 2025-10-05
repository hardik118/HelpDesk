/*
  Warnings:

  - You are about to drop the column `message` on the `Comment` table. All the data in the column will be lost.
  - You are about to drop the column `parentId` on the `Comment` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `Ticket` table. All the data in the column will be lost.
  - You are about to drop the column `slaDue` on the `Ticket` table. All the data in the column will be lost.
  - The `status` column on the `Ticket` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Timeline` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `content` to the `Comment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slaDeadline` to the `Ticket` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Status" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- DropForeignKey
ALTER TABLE "public"."Timeline" DROP CONSTRAINT "Timeline_actorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Timeline" DROP CONSTRAINT "Timeline_ticketId_fkey";

-- AlterTable
ALTER TABLE "Comment" DROP COLUMN "message",
DROP COLUMN "parentId",
ADD COLUMN     "content" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "priority",
DROP COLUMN "slaDue",
ADD COLUMN     "slaDeadline" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
DROP COLUMN "status",
ADD COLUMN     "status" "Status" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "public"."Timeline";
