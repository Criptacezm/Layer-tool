-- ============================================
-- Layer — Team hub: feed posts + group chats
-- Run once in the Supabase SQL editor (idempotent).
-- Requires the base schema (profiles, team_chat_messages) from layer-schema.sql.
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------
-- Feed
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS team_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_post_likes (
    post_id UUID NOT NULL REFERENCES team_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES team_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_team_posts_created_at ON team_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_post_comments_post_id ON team_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_team_post_likes_post_id ON team_post_likes(post_id);

ALTER TABLE team_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view posts" ON team_posts;
DROP POLICY IF EXISTS "Users can create own posts" ON team_posts;
DROP POLICY IF EXISTS "Users can update own posts" ON team_posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON team_posts;
CREATE POLICY "Authenticated users can view posts" ON team_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create own posts" ON team_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON team_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON team_posts FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view likes" ON team_post_likes;
DROP POLICY IF EXISTS "Users can like" ON team_post_likes;
DROP POLICY IF EXISTS "Users can unlike" ON team_post_likes;
CREATE POLICY "Authenticated users can view likes" ON team_post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can like" ON team_post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike" ON team_post_likes FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view comments" ON team_post_comments;
DROP POLICY IF EXISTS "Users can comment" ON team_post_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON team_post_comments;
CREATE POLICY "Authenticated users can view comments" ON team_post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can comment" ON team_post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON team_post_comments FOR DELETE USING (auth.uid() = user_id);

-- --------------------------------------------
-- Groups (messages live in team_chat_messages with channel_type = 'group',
-- channel_id = group id)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS team_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3b82f6',
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_group_members (
    group_id UUID NOT NULL REFERENCES team_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member', -- 'admin' | 'member'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_group_members_user_id ON team_group_members(user_id);

ALTER TABLE team_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_group_members ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helpers avoid RLS recursion between team_groups and team_group_members
CREATE OR REPLACE FUNCTION is_team_group_member(gid UUID, uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM team_group_members WHERE group_id = gid AND user_id = uid);
$$;

CREATE OR REPLACE FUNCTION is_team_group_admin(gid UUID, uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM team_group_members WHERE group_id = gid AND user_id = uid AND role = 'admin'
    ) OR EXISTS (
        SELECT 1 FROM team_groups WHERE id = gid AND created_by = uid
    );
$$;

DROP POLICY IF EXISTS "Members can view groups" ON team_groups;
DROP POLICY IF EXISTS "Users can create groups" ON team_groups;
DROP POLICY IF EXISTS "Admins can update groups" ON team_groups;
DROP POLICY IF EXISTS "Admins can delete groups" ON team_groups;
CREATE POLICY "Members can view groups" ON team_groups FOR SELECT USING (
    created_by = auth.uid() OR is_team_group_member(id, auth.uid())
);
CREATE POLICY "Users can create groups" ON team_groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can update groups" ON team_groups FOR UPDATE USING (is_team_group_admin(id, auth.uid()));
CREATE POLICY "Admins can delete groups" ON team_groups FOR DELETE USING (is_team_group_admin(id, auth.uid()));

DROP POLICY IF EXISTS "Members can view group members" ON team_group_members;
DROP POLICY IF EXISTS "Admins can add members" ON team_group_members;
DROP POLICY IF EXISTS "Members can leave or admins can remove" ON team_group_members;
CREATE POLICY "Members can view group members" ON team_group_members FOR SELECT USING (
    user_id = auth.uid() OR is_team_group_member(group_id, auth.uid())
);
CREATE POLICY "Admins can add members" ON team_group_members FOR INSERT WITH CHECK (
    is_team_group_admin(group_id, auth.uid())
);
CREATE POLICY "Members can leave or admins can remove" ON team_group_members FOR DELETE USING (
    user_id = auth.uid() OR is_team_group_admin(group_id, auth.uid())
);

-- Let group members read group messages (existing policy only covers own/dm/channel rows)
DROP POLICY IF EXISTS "Group members can view group messages" ON team_chat_messages;
CREATE POLICY "Group members can view group messages" ON team_chat_messages FOR SELECT USING (
    channel_type = 'group'
    AND channel_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND is_team_group_member(channel_id::uuid, auth.uid())
);

-- --------------------------------------------
-- updated_at triggers
-- --------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_team_posts_updated_at ON team_posts;
CREATE TRIGGER update_team_posts_updated_at BEFORE UPDATE ON team_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_team_groups_updated_at ON team_groups;
CREATE TRIGGER update_team_groups_updated_at BEFORE UPDATE ON team_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------
-- Realtime
-- --------------------------------------------
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE team_posts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE team_post_likes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE team_post_comments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE team_groups;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE team_group_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE team_chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE team_posts REPLICA IDENTITY FULL;
ALTER TABLE team_post_likes REPLICA IDENTITY FULL;
ALTER TABLE team_post_comments REPLICA IDENTITY FULL;
ALTER TABLE team_group_members REPLICA IDENTITY FULL;
