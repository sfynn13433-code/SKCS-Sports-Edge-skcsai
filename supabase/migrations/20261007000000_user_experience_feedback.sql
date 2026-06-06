-- Public user experience feedback (manual approval before homepage display)

CREATE TABLE IF NOT EXISTS public.user_experience_feedback (
    id bigserial PRIMARY KEY,
    user_id uuid NOT NULL,
    user_email text,
    display_name text NOT NULL,
    rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment text NOT NULL CHECK (char_length(trim(comment)) BETWEEN 10 AND 1000),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    moderated_by text,
    moderated_at timestamptz,
    moderation_note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_experience_feedback_status_created
    ON public.user_experience_feedback (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_experience_feedback_user_created
    ON public.user_experience_feedback (user_id, created_at DESC);

COMMENT ON TABLE public.user_experience_feedback IS
    'Homepage user experience feedback. Only approved rows are shown publicly.';
