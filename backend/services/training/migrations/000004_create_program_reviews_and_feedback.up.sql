-- 1. Reset any old seeded fake metrics to 0
UPDATE programs SET likes_count = 0, installs_count = 0 WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- 2. Real Community Program Reviews and Ratings (1 to 5 stars)
CREATE TABLE IF NOT EXISTS program_reviews (
    id UUID PRIMARY KEY,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    author_name VARCHAR(100) NOT NULL DEFAULT 'Атлет',
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_program_user_review UNIQUE (program_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_program_reviews_prog ON program_reviews(program_id, created_at DESC);

-- 3. Feedback & Bug Reports
CREATE TABLE IF NOT EXISTS feedback_reports (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    author_name VARCHAR(100) NOT NULL DEFAULT 'Атлет',
    category VARCHAR(30) NOT NULL DEFAULT 'bug',
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    upvotes INT NOT NULL DEFAULT 0,
    upvoters UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_created ON feedback_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_cat ON feedback_reports(category);

-- 4. Per-User AI Coach Chat Messages
CREATE TABLE IF NOT EXISTS coach_messages (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    suggested_workout JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coach_messages_user_created ON coach_messages(user_id, created_at ASC);
