CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "study_resources" (
	"id" text PRIMARY KEY NOT NULL,
	"cluster_id" text NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"publisher" text NOT NULL,
	"kind" text NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exam_clusters" ALTER COLUMN "org" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_clusters" ADD COLUMN "kind" text DEFAULT 'exam' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_resources" ADD CONSTRAINT "study_resources_cluster_id_exam_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."exam_clusters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "study_resources_cluster_idx" ON "study_resources" USING btree ("cluster_id","position");--> statement-breakpoint
-- Free launch period: everyone gets Pro for the first four weeks after this runs. Admins can change or end it in /admin/limits.
INSERT INTO "app_settings" ("key", "value") VALUES ('launch_access', jsonb_build_object('endsOn', to_char(current_date + 28, 'YYYY-MM-DD'))) ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "plan_limits" ("feature", "label", "free_limit", "pro_limit", "period") VALUES ('ask_ai', 'Ask AI explanations', 20, 300, 'day') ON CONFLICT ("feature") DO NOTHING;
