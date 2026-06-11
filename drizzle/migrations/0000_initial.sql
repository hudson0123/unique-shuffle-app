CREATE TABLE "rate_limits" (
	"ip" "inet" NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "rate_limits_ip_window_start_pk" PRIMARY KEY("ip","window_start")
);
--> statement-breakpoint
CREATE TABLE "shuffles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"sequence" smallint[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shuffles_hash_unique" UNIQUE("hash"),
	CONSTRAINT "sequence_length_52" CHECK (array_length("shuffles"."sequence", 1) = 52)
);
