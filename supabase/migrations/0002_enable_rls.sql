-- Enable RLS on all tables. No policies are defined, so the anon and
-- authenticated roles are denied by default. All app DB access goes
-- through the server using SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
ALTER TABLE public.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;
