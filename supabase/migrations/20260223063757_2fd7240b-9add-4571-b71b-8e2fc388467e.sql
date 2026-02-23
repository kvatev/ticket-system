ALTER TABLE public.profiles
ADD COLUMN sound_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN push_enabled boolean NOT NULL DEFAULT true;