DROP INDEX "event_selections_active_idx";--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "focus_org" "org";--> statement-breakpoint
CREATE UNIQUE INDEX "event_selections_active_idx" ON "event_selections" USING btree ("user_id","org") WHERE "event_selections"."active";