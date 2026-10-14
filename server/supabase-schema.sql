CREATE TABLE IF NOT EXISTS public.frostbound_users (
  id text PRIMARY KEY, email text UNIQUE NOT NULL, name text NOT NULL,
  password text NOT NULL, role text NOT NULL CHECK (role IN ('teacher','student')),
  avatar integer NOT NULL DEFAULT 0 CHECK (avatar BETWEEN 0 AND 5)
);
CREATE TABLE IF NOT EXISTS public.frostbound_sessions (
  token text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.frostbound_users(id),
  expires bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS public.frostbound_quizzes (
  id text PRIMARY KEY,
  owner text NOT NULL REFERENCES public.frostbound_users(id),
  title text NOT NULL, questions text NOT NULL
);
CREATE TABLE IF NOT EXISTS public.frostbound_matches (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.frostbound_users(id),
  title text, played_at bigint, correct integer, attempts integer,
  survived integer, infections integer, cursed integer
);
CREATE INDEX IF NOT EXISTS frostbound_sessions_expiry_idx ON public.frostbound_sessions(expires);
CREATE INDEX IF NOT EXISTS frostbound_sessions_user_idx ON public.frostbound_sessions(user_id);
CREATE INDEX IF NOT EXISTS frostbound_quizzes_owner_idx ON public.frostbound_quizzes(owner);
CREATE INDEX IF NOT EXISTS frostbound_matches_user_date_idx ON public.frostbound_matches(user_id,played_at);
ALTER TABLE public.frostbound_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frostbound_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frostbound_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frostbound_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.frostbound_users,public.frostbound_sessions,public.frostbound_quizzes,public.frostbound_matches FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.frostbound_users,public.frostbound_sessions,public.frostbound_quizzes,public.frostbound_matches TO service_role;
NOTIFY pgrst, 'reload schema';
