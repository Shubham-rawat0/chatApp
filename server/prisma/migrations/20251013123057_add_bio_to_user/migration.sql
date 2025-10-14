/*
  Warnings:

  - Added the required column `roomName` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "roomName" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "Bio" TEXT NOT NULL DEFAULT 'Hey! Drop a message';
