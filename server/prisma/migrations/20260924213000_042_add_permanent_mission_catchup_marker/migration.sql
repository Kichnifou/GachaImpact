ALTER TABLE "player_permanent_mission_states"
ADD COLUMN "standalone_catchup_completed_at" TIMESTAMPTZ(6);

ALTER TABLE "player_permanent_mission_states"
ADD CONSTRAINT "player_permanent_mission_states_catchup_check"
CHECK (
  "standalone_catchup_completed_at" IS NULL
  OR "standalone_catchup_completed_at" >= "initialized_at"
);
