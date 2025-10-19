-- DropForeignKey
ALTER TABLE "public"."Chat" DROP CONSTRAINT "Chat_receiverId_fkey";

-- AlterTable
ALTER TABLE "Chat" ALTER COLUMN "receiverId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
