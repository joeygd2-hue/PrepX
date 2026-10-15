ALTER TABLE "profiles" ALTER COLUMN "share_activity_with_chapter" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "leaderboard_alias" text;--> statement-breakpoint
-- Sharing used to default to on without asking. Reset everyone to off; students opt in from Profile or when joining a chapter.
UPDATE "profiles" SET "share_activity_with_chapter" = false;
