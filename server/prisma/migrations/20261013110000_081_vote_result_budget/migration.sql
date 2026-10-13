-- The complete standalone vote catalog is bounded to200 cards by the public
-- protocol. Keep16KiB for every other result and all existing provenance guards.
-- No historical JSON, grants, RLS policy or economic data is changed.
ALTER TABLE "global_chat_messages"
  DROP CONSTRAINT "global_chat_messages_result_presentation_check",
  ADD CONSTRAINT "global_chat_messages_result_presentation_check" CHECK (
    "result_presentation" IS NULL OR (
      "message_type" = 'GAME_RESULT' AND "source_channel" = 'SYSTEM' AND "author_player_id" IS NULL
      AND jsonb_typeof("result_presentation") = 'object'
      AND octet_length("result_presentation"::text) <= CASE
        WHEN "result_presentation"->>'command' = 'vote'
          AND jsonb_typeof("result_presentation"->'characters') = 'array'
          AND jsonb_array_length("result_presentation"->'characters') <= 200 THEN 262144
        ELSE 16384
      END
    )
  );
