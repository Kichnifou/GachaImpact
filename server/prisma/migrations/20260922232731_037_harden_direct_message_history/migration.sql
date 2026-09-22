ALTER TABLE "direct_conversation_participants" DROP CONSTRAINT "direct_conversation_participants_conversation_id_fkey";
ALTER TABLE "direct_conversation_requests" DROP CONSTRAINT "direct_conversation_requests_conversation_id_fkey";
ALTER TABLE "direct_messages" DROP CONSTRAINT "direct_messages_conversation_id_fkey";

ALTER TABLE "direct_conversation_participants" ADD CONSTRAINT "direct_conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "direct_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direct_conversation_requests" ADD CONSTRAINT "direct_conversation_requests_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "direct_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "direct_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
