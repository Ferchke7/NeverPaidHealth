CREATE TABLE IF NOT EXISTS program_comments (
    id UUID PRIMARY KEY,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    author_name VARCHAR(100) NOT NULL DEFAULT 'Атлет',
    parent_id UUID NULL REFERENCES program_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    upvotes INT NOT NULL DEFAULT 0,
    upvoters UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_program_comments_prog_created ON program_comments(program_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_program_comments_parent ON program_comments(parent_id);

CREATE TABLE IF NOT EXISTS program_likes (
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (program_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_program_likes_prog ON program_likes(program_id);
CREATE INDEX IF NOT EXISTS idx_program_likes_user ON program_likes(user_id);
