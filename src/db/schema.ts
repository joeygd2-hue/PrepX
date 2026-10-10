/**
 * PrepX database schema (PostgreSQL, Drizzle ORM).
 *
 * Conventions:
 *  - Every user-owned row carries `user_id` with ON DELETE CASCADE so account deletion
 *    removes personal data in one statement. Rows that must outlive a user (audit log,
 *    billing events, chapter announcements) use ON DELETE SET NULL instead.
 *  - Content that changes per season (events, competitions, questions) lives in tables
 *    seeded from /content JSON so it can be edited without code changes.
 *  - Authorization is enforced in the server data-access layer (src/server/**), never
 *    in the client. See docs/ARCHITECTURE.md §Authorization.
 */
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  boolean,
  date,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,

  pgEnum,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const orgEnum = pgEnum("org", ["deca", "fbla", "hosa", "tsa"]);
export const userRoleEnum = pgEnum("user_role", ["student", "staff", "admin"]);
export const chapterRoleEnum = pgEnum("chapter_role", ["member", "officer", "advisor"]);
export const verificationEnum = pgEnum("verification_status", ["verified", "reference_observed", "unverified"]);
export const dateStatusEnum = pgEnum("date_status", ["confirmed", "tentative", "unconfirmed"]);
export const levelEnum = pgEnum("competition_level", ["international", "national", "state", "district", "regional"]);
export const questionSourceEnum = pgEnum("question_source", ["prepx_original", "ai_generated", "licensed"]);

/* ───────────────────────── Identity ───────────────────────── */

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  googleSub: text("google_sub"),
  role: userRoleEnum("role").notNull().default("student"),
  createdAt: createdAt(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("users_email_idx").on(sql`lower(${t.email})`),
  uniqueIndex("users_google_sub_idx").on(t.googleSub),
]);

/** Session token is never stored; only its SHA-256 hash. */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  userAgent: text("user_agent"),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

/** One-time email codes (sign-in) and other single-use tokens. Hash only. */
export const emailCodes = pgTable("email_codes", {
  id: id(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  purpose: text("purpose").notNull(), // "sign_in"
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("email_codes_email_idx").on(t.email)]);

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  displayName: text("display_name").notNull().default(""),
  /** Stored only to confirm 13+; never shown to other users. */
  birthDate: date("birth_date"),
  grade: integer("grade"),
  school: text("school"),
  orgInterests: jsonb("org_interests").$type<string[]>().notNull().default([]),
  onboardingStep: text("onboarding_step").notNull().default("welcome"),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  termsVersion: text("terms_version"),
  dailyStudyMinutes: integer("daily_study_minutes").notNull().default(20),
  focusOrg: orgEnum("focus_org"),
  accentColor: text("accent_color").notNull().default("ink"),
  timezone: text("timezone").notNull().default("America/Chicago"),
  // Privacy
  hideNameOnTrophies: boolean("hide_name_on_trophies").notNull().default(true),
  leaderboardVisibility: text("leaderboard_visibility").notNull().default("hidden"), // hidden | pseudonym | name
  /** Random leaderboard nickname, not derived from the student's name or id. Assigned on first use. */
  leaderboardAlias: text("leaderboard_alias"),
  /** Off until the student opts in (on joining a chapter or in Profile). */
  shareActivityWithChapter: boolean("share_activity_with_chapter").notNull().default(false),
  publicTrophyId: text("public_trophy_id").notNull().default(sql`substr(md5(random()::text), 1, 10)`),
  referralCode: text("referral_code").notNull().default(sql`upper(substr(md5(random()::text), 1, 8))`),
  referredBy: uuid("referred_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("profiles_trophy_idx").on(t.publicTrophyId),
  uniqueIndex("profiles_referral_idx").on(t.referralCode),
]);

/** Which organisations' dates a user sees and where they compete (/calendar/region). */
export const orgPreferences = pgTable("org_preferences", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  org: orgEnum("org").notNull(),
  showDates: boolean("show_dates").notNull().default(true),
  state: text("state"),
  regionId: text("region_id"),
  updatedAt: updatedAt(),
}, (t) => [primaryKey({ columns: [t.userId, t.org] })]);

export const notificationPrefs = pgTable("notification_prefs", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  chapterAnnouncements: boolean("chapter_announcements").notNull().default(true),
  checkinOpen: boolean("checkin_open").notNull().default(true),
  streakReminder: boolean("streak_reminder").notNull().default(true),
  competitionCountdown: boolean("competition_countdown").notNull().default(true),
  weeklyRecapEmail: boolean("weekly_recap_email").notNull().default(true),
  competitionReminderEmails: boolean("competition_reminder_emails").notNull().default(true),
  productUpdatesEmail: boolean("product_updates_email").notNull().default(false),
  updatedAt: updatedAt(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("push_endpoint_idx").on(t.endpoint)]);

/* ───────────────────────── Catalog ───────────────────────── */

export const regions = pgTable("regions", {
  id: text("id").primaryKey(), // e.g. "deca-tx-d3"
  org: orgEnum("org").notNull(),
  state: text("state").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
});

/** An exam blueprint shared by several events (e.g. DECA Business Administration Core). */
export const examClusters = pgTable("exam_clusters", {
  id: text("id").primaryKey(), // "deca-bac"
  org: orgEnum("org").notNull(),
  code: text("code").notNull(), // "BAC"
  name: text("name").notNull(),
  questionCount: integer("question_count"),
  minutes: integer("minutes"),
  verification: verificationEnum("verification").notNull().default("unverified"),
});

export const units = pgTable("units", {
  id: text("id").primaryKey(), // "deca-bac-u1"
  clusterId: text("cluster_id").notNull().references(() => examClusters.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  objective: text("objective").notNull().default(""),
  body: text("body").notNull().default(""),
  examples: jsonb("examples").$type<string[]>().notNull().default([]),
}, (t) => [index("units_cluster_idx").on(t.clusterId)]);

export type EventComponents = {
  exam?: { clusterId: string; label: string; questions?: number; minutes?: number };
  roleplay?: { prepMinutes?: number; performMinutes?: number; indicators?: number; count?: number };
  caseStudy?: { prepMinutes?: number; performMinutes?: number; team?: boolean };
  written?: { pages?: number; label: string };
  presentation?: { minutes?: number; label: string };
  interview?: { minutes?: number };
  production?: { label: string };
  spelldown?: boolean;
};

export type RubricCriterion = { id: string; label: string; description: string };

export const events = pgTable("events", {
  id: text("id").primaryKey(), // "deca-pbm"
  org: orgEnum("org").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  cluster: text("cluster"), // career cluster subtitle e.g. "Business Management and Administration"
  formatLabel: text("format_label").notNull(),
  division: text("division").notNull().default("High School"),
  team: text("team"), // "individual" | "team (2-3)" | ...
  components: jsonb("components").$type<EventComponents>().notNull().default({}),
  rubric: jsonb("rubric").$type<RubricCriterion[]>().notNull().default([]),
  rubricVerification: verificationEnum("rubric_verification").notNull().default("unverified"),
  levels: jsonb("levels").$type<string[]>().notNull().default([]),
  verification: verificationEnum("verification").notNull().default("unverified"),
  sourceUrl: text("source_url"),
  sourceCheckedAt: date("source_checked_at"),
  season: text("season").notNull().default("2026-2027"),
  active: boolean("active").notNull().default(true),
  position: integer("position").notNull().default(0),
  updatedAt: updatedAt(),
}, (t) => [index("events_org_idx").on(t.org)]);

export const competitions = pgTable("competitions", {
  id: text("id").primaryKey(), // "deca-icdc-2027"
  org: orgEnum("org").notNull(),
  level: levelEnum("level").notNull(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  regionId: text("region_id").references(() => regions.id, { onDelete: "set null" }),
  state: text("state"),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  timezone: text("timezone").notNull().default("America/Chicago"),
  location: text("location"),
  status: dateStatusEnum("status").notNull().default("unconfirmed"),
  statusNote: text("status_note"),
  sourceUrl: text("source_url"),
  sourceCheckedAt: date("source_checked_at"),
  previousStartsOn: date("previous_starts_on"),
  dateChangedAt: timestamp("date_changed_at", { withTimezone: true }),
  updatedAt: updatedAt(),
}, (t) => [index("competitions_org_idx").on(t.org, t.startsOn)]);

/* ───────────────────────── Study ───────────────────────── */

/** Event selection history: one active row per user; old rows keep progress context. */
export const eventSelections = pgTable("event_selections", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventId: text("event_id").notNull().references(() => events.id),
  org: orgEnum("org").notNull(),
  competitionId: text("competition_id").references(() => competitions.id, { onDelete: "set null" }),
  targetDate: date("target_date"),
  active: boolean("active").notNull().default(true),
  selectedAt: createdAt(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
}, (t) => [
  index("event_selections_user_idx").on(t.userId),
  uniqueIndex("event_selections_active_idx").on(t.userId, t.org).where(sql`${t.active}`),
]);

export const planTasks = pgTable("plan_tasks", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventId: text("event_id").notNull().references(() => events.id),
  day: date("day").notNull(),
  kind: text("kind").notNull(), // quick10 | judge | coach | lesson | flashcards | exam | rehearsal | mistakes | entry | presentation
  title: text("title").notNull(),
  minutes: integer("minutes").notNull(),
  description: text("description").notNull(),
  href: text("href").notNull(),
  position: integer("position").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [index("plan_tasks_user_day_idx").on(t.userId, t.day)]);

export const seasonGoals = pgTable("season_goals", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventId: text("event_id").notNull().references(() => events.id),
  targetReadiness: integer("target_readiness").notNull().default(80),
  weeklyQuestions: integer("weekly_questions").notNull().default(100),
  weeklyJudgeRuns: integer("weekly_judge_runs").notNull().default(1),
  updatedAt: updatedAt(),
}, (t) => [primaryKey({ columns: [t.userId, t.eventId] })]);

export const questions = pgTable("questions", {
  id: id(),
  clusterId: text("cluster_id").notNull().references(() => examClusters.id, { onDelete: "cascade" }),
  unitId: text("unit_id").references(() => units.id, { onDelete: "set null" }),
  stem: text("stem").notNull(),
  choices: jsonb("choices").$type<string[]>().notNull(),
  answerIndex: integer("answer_index").notNull(),
  explanation: text("explanation").notNull(),
  source: questionSourceEnum("source").notNull().default("prepx_original"),
  status: text("status").notNull().default("published"), // published | review | retired
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [index("questions_cluster_idx").on(t.clusterId, t.status), index("questions_unit_idx").on(t.unitId)]);

export const examAttempts = pgTable("exam_attempts", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clusterId: text("cluster_id").notNull().references(() => examClusters.id),
  eventId: text("event_id").references(() => events.id),
  mode: text("mode").notNull(), // quick10 | full | rehearsal | sprint | unit | mistakes | check
  unitId: text("unit_id"),
  questionIds: jsonb("question_ids").$type<string[]>().notNull(),
  timeLimitSec: integer("time_limit_sec"),
  allowPause: boolean("allow_pause").notNull().default(true),
  /** Active time used so far, for pausable timed modes. */
  elapsedSec: integer("elapsed_sec").notNull().default(0),
  startedAt: createdAt(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  correct: integer("correct"),
  total: integer("total"),
  /** Saved in-progress answers for resumable modes: { [questionId]: choiceIndex } */
  draft: jsonb("draft").$type<Record<string, number>>().notNull().default({}),
}, (t) => [index("exam_attempts_user_idx").on(t.userId, t.clusterId)]);

export const attemptAnswers = pgTable("attempt_answers", {
  attemptId: uuid("attempt_id").notNull().references(() => examAttempts.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  chosenIndex: integer("chosen_index"),
  correct: boolean("correct").notNull(),
  answeredAt: createdAt(),
}, (t) => [
  primaryKey({ columns: [t.attemptId, t.questionId] }),
  index("attempt_answers_user_idx").on(t.userId, t.answeredAt),
]);

/** Mistake notebook: a miss stays until answered correctly twice in a row. */
export const mistakes = pgTable("mistakes", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  misses: integer("misses").notNull().default(1),
  correctStreak: integer("correct_streak").notNull().default(0),
  lastMissedAt: createdAt(),
  clearedAt: timestamp("cleared_at", { withTimezone: true }),
}, (t) => [primaryKey({ columns: [t.userId, t.questionId] })]);

export const lessonProgress = pgTable("lesson_progress", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  unitId: text("unit_id").notNull().references(() => units.id, { onDelete: "cascade" }),
  startedAt: createdAt(),
  lessonCompletedAt: timestamp("lesson_completed_at", { withTimezone: true }),
  checkCorrect: integer("check_correct").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.userId, t.unitId] })]);

export const flashcards = pgTable("flashcards", {
  id: id(),
  clusterId: text("cluster_id").notNull().references(() => examClusters.id, { onDelete: "cascade" }),
  unitId: text("unit_id").references(() => units.id, { onDelete: "set null" }),
  term: text("term").notNull(),
  definition: text("definition").notNull(),
}, (t) => [index("flashcards_cluster_idx").on(t.clusterId)]);

/** Leitner-box spaced repetition. */
export const flashcardReviews = pgTable("flashcard_reviews", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cardId: uuid("card_id").notNull().references(() => flashcards.id, { onDelete: "cascade" }),
  box: integer("box").notNull().default(1),
  difficult: boolean("difficult").notNull().default(false),
  reviews: integer("reviews").notNull().default(0),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.cardId] })]);

export const sprintBests = pgTable("sprint_bests", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clusterId: text("cluster_id").notNull().references(() => examClusters.id, { onDelete: "cascade" }),
  best: integer("best").notNull(),
  achievedAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.userId, t.clusterId] })]);

/* ───────────────────────── AI ───────────────────────── */

export const aiSessions = pgTable("ai_sessions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // coach | judge | face_to_face | judge_questions | explain | entry_check | presentation_check
  eventId: text("event_id").references(() => events.id),
  title: text("title").notNull().default(""),
  scenario: jsonb("scenario").$type<Record<string, unknown>>(),
  status: text("status").notNull().default("open"), // open | scored | failed
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("ai_sessions_user_idx").on(t.userId, t.kind, t.createdAt)]);

export const aiMessages = pgTable("ai_messages", {
  id: id(),
  sessionId: uuid("session_id").notNull().references(() => aiSessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // user | assistant
  content: text("content").notNull(),
  createdAt: createdAt(),
}, (t) => [index("ai_messages_session_idx").on(t.sessionId, t.createdAt)]);

export type FeedbackCriterion = { id: string; label: string; rating: number; comment: string };

export const aiFeedback = pgTable("ai_feedback", {
  id: id(),
  sessionId: uuid("session_id").notNull().references(() => aiSessions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventId: text("event_id").references(() => events.id),
  score: integer("score").notNull(), // 0..100 simulated practice score
  criteria: jsonb("criteria").$type<FeedbackCriterion[]>().notNull(),
  summary: text("summary").notNull(),
  nextSteps: jsonb("next_steps").$type<string[]>().notNull(),
  rubricBasis: text("rubric_basis").notNull(), // "verified" | "general"
  createdAt: createdAt(),
}, (t) => [index("ai_feedback_user_idx").on(t.userId, t.createdAt)]);

/* ───────────────────────── Progress & motivation ───────────────────────── */

export const xpEvents = pgTable("xp_events", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  refId: text("ref_id").notNull(),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("xp_events_dedupe_idx").on(t.userId, t.reason, t.refId),
  index("xp_events_user_idx").on(t.userId, t.createdAt),
]);

/** One row per local day with at least one completed study activity. */
export const activityDays = pgTable("activity_days", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  day: date("day").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.day] })]);

export const userAchievements = pgTable("user_achievements", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  achievementId: text("achievement_id").notNull(),
  unlockedAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.userId, t.achievementId] })]);

export const buddies = pgTable("buddies", {
  id: id(),
  requesterId: uuid("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  addresseeId: uuid("addressee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // pending | accepted
  createdAt: createdAt(),
  lastNudgeAt: timestamp("last_nudge_at", { withTimezone: true }),
}, (t) => [uniqueIndex("buddies_pair_idx").on(t.requesterId, t.addresseeId)]);

/* ───────────────────────── Chapters ───────────────────────── */

export const chapters = pgTable("chapters", {
  id: id(),
  org: orgEnum("org").notNull(),
  name: text("name").notNull(),
  school: text("school").notNull(),
  state: text("state"),
  regionId: text("region_id").references(() => regions.id, { onDelete: "set null" }),
  joinCode: text("join_code").notNull(),
  joinCodeExpiresAt: timestamp("join_code_expires_at", { withTimezone: true }),
  joinEnabled: boolean("join_enabled").notNull().default(true),
  coversPro: boolean("covers_pro").notNull().default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("chapters_join_code_idx").on(t.joinCode)]);

/** org is denormalised so "one chapter per competition" is a unique index. */
export const chapterMembers = pgTable("chapter_members", {
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  org: orgEnum("org").notNull(),
  role: chapterRoleEnum("role").notNull().default("member"),
  points: integer("points").notNull().default(0),
  joinedAt: createdAt(),
}, (t) => [
  primaryKey({ columns: [t.chapterId, t.userId] }),
  uniqueIndex("chapter_members_user_org_idx").on(t.userId, t.org),
]);

export const chapterAnnouncements = pgTable("chapter_announcements", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: createdAt(),
}, (t) => [index("chapter_announcements_idx").on(t.chapterId, t.createdAt)]);

export const checkins = pgTable("checkins", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  points: integer("points").notNull().default(10),
  openedBy: uuid("opened_by").references(() => users.id, { onDelete: "set null" }),
  opensAt: createdAt(),
  closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
}, (t) => [index("checkins_chapter_idx").on(t.chapterId, t.opensAt)]);

export const checkinRecords = pgTable("checkin_records", {
  checkinId: uuid("checkin_id").notNull().references(() => checkins.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.checkinId, t.userId] })]);

/** Quiz night: a live chapter game hosted by an officer/advisor. */
export const quizGames = pgTable("quiz_games", {
  id: id(),
  chapterId: uuid("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  hostId: uuid("host_id").references(() => users.id, { onDelete: "set null" }),
  clusterId: text("cluster_id").notNull().references(() => examClusters.id),
  questionIds: jsonb("question_ids").$type<string[]>().notNull(),
  currentIndex: integer("current_index").notNull().default(-1), // -1 lobby
  questionStartedAt: timestamp("question_started_at", { withTimezone: true }),
  secondsPerQuestion: integer("seconds_per_question").notNull().default(20),
  status: text("status").notNull().default("lobby"), // lobby | live | reveal | ended
  createdAt: createdAt(),
}, (t) => [index("quiz_games_chapter_idx").on(t.chapterId, t.createdAt)]);

export const quizAnswers = pgTable("quiz_answers", {
  gameId: uuid("game_id").notNull().references(() => quizGames.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  questionIndex: integer("question_index").notNull(),
  chosenIndex: integer("chosen_index").notNull(),
  correct: boolean("correct").notNull(),
  points: integer("points").notNull(),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.gameId, t.userId, t.questionIndex] })]);

/* ───────────────────────── Communication ───────────────────────── */

export const announcements = pgTable("announcements", {
  id: id(),
  org: orgEnum("org"),
  competitionId: text("competition_id").references(() => competitions.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  kind: text("kind").notNull().default("info"), // info | date_change
  sourceUrl: text("source_url"),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
});

export const announcementDismissals = pgTable("announcement_dismissals", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  announcementId: uuid("announcement_id").notNull().references(() => announcements.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.userId, t.announcementId] })]);

export const notifications = pgTable("notifications", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  href: text("href"),
  dedupeKey: text("dedupe_key"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  index("notifications_user_idx").on(t.userId, t.createdAt),
  uniqueIndex("notifications_dedupe_idx").on(t.userId, t.dedupeKey),
]);

/** Dev/test mailbox and delivery log. Bodies are kept only when EMAIL_PROVIDER=console. */
export const emailLog = pgTable("email_log", {
  id: id(),
  to: text("to").notNull(),
  template: text("template").notNull(),
  subject: text("subject").notNull(),
  body: text("body"),
  status: text("status").notNull(), // sent | logged | failed
  createdAt: createdAt(),
}, (t) => [index("email_log_to_idx").on(t.to, t.createdAt)]);

/** Monthly parent email. Parent must confirm via emailed link before any report is sent. */
export const familyLinks = pgTable("family_links", {
  id: id(),
  studentId: uuid("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentEmail: text("parent_email").notNull(),
  tokenHash: text("token_hash").notNull(),
  status: text("status").notNull().default("pending"), // pending | confirmed
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  lastReportAt: timestamp("last_report_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("family_links_student_idx").on(t.studentId)]);

/* ───────────────────────── Billing & entitlements ───────────────────────── */

/** Admin-editable plan limits. period: day | month | season | lifetime */
export const planLimits = pgTable("plan_limits", {
  feature: text("feature").primaryKey(),
  label: text("label").notNull(),
  freeLimit: integer("free_limit").notNull(),
  proLimit: integer("pro_limit").notNull(), // -1 = unlimited
  period: text("period").notNull(),
  updatedAt: updatedAt(),
});

export const usageRecords = pgTable("usage_records", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  feature: text("feature").notNull(),
  periodKey: text("period_key").notNull(),
  status: text("status").notNull().default("consumed"), // reserved | consumed | refunded
  refId: text("ref_id"),
  createdAt: createdAt(),
}, (t) => [index("usage_user_feature_idx").on(t.userId, t.feature, t.periodKey)]);

export const subscriptions = pgTable("subscriptions", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("stripe"),
  customerId: text("customer_id"),
  subscriptionId: text("subscription_id"),
  kind: text("kind").notNull(), // subscription | season_boost
  status: text("status").notNull(), // active | trialing | past_due | canceled | incomplete
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  updatedAt: updatedAt(),
});

export const billingEvents = pgTable("billing_events", {
  id: text("id").primaryKey(), // provider event id (idempotency)
  type: text("type").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  receivedAt: createdAt(),
});

/* ───────────────────────── Operations ───────────────────────── */

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: id(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  target: text("target"),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
}, (t) => [index("audit_log_created_idx").on(t.createdAt)]);

export const feedback = pgTable("feedback", {
  id: id(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  kind: text("kind").notNull(), // bug | idea | content_report | ambassador | advisor
  body: text("body").notNull(),
  context: jsonb("context").$type<Record<string, unknown>>().notNull().default({}),
  status: text("status").notNull().default("open"),
  createdAt: createdAt(),
});

export const errorLog = pgTable("error_log", {
  id: id(),
  scope: text("scope").notNull(),
  message: text("message").notNull(),
  createdAt: createdAt(),
}, (t) => [index("error_log_created_idx").on(t.createdAt)]);


export type EventComponentsT = EventComponents;
export type RubricCriterionT = RubricCriterion;
