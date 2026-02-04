-- ============================================
-- Layer App - SAFE Database Schema for Supabase
-- Version: 3.1 (Non-Destructive - Preserves User Data)
-- Safe to run multiple times!
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Enum Types (Safe Creation)
-- ============================================
DO $$ BEGIN
    CREATE TYPE project_status AS ENUM ('todo', 'in_progress', 'review', 'done', 'backlog');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- Profiles Table (linked to auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- User Preferences Table
-- ============================================
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'dark',
    left_panel_width INTEGER DEFAULT 280,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Add new columns to user_preferences if they don't exist
DO $$ BEGIN
    ALTER TABLE user_preferences ADD COLUMN widget_order JSONB DEFAULT '[]';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- ============================================
-- Projects Table
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    status project_status NOT NULL DEFAULT 'todo',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_date DATE,
    flowchart JSONB DEFAULT '{"nodes": [], "edges": []}',
    columns JSONB DEFAULT '[{"title": "To Do", "tasks": []}, {"title": "In Progress", "tasks": []}, {"title": "Done", "tasks": []}]',
    updates JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns to projects if they don't exist
DO $$ BEGIN
    ALTER TABLE projects ADD COLUMN milestones JSONB DEFAULT '{}';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE projects ADD COLUMN grip_diagram JSONB DEFAULT NULL;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE projects ADD COLUMN tasks JSONB DEFAULT '[]';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- ============================================
-- Backlog Tasks Table
-- ============================================
CREATE TABLE IF NOT EXISTS backlog_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    done BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Issues Table
-- ============================================
CREATE TABLE IF NOT EXISTS issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    issue_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status project_status NOT NULL DEFAULT 'todo',
    priority priority_level NOT NULL DEFAULT 'medium',
    assignee TEXT DEFAULT '',
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Calendar Events Table
-- ============================================
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    time TEXT,
    end_time TEXT,
    duration INTEGER,
    completed BOOLEAN DEFAULT FALSE,
    color TEXT,
    recurring_id TEXT,
    is_recurring_instance BOOLEAN DEFAULT FALSE,
    notes TEXT,
    priority priority_level DEFAULT 'medium',
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Docs Table
-- ============================================
CREATE TABLE IF NOT EXISTS docs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled',
    content TEXT DEFAULT '',
    space_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add is_favorite column if it doesn't exist
DO $$ BEGIN
    ALTER TABLE docs ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- ============================================
-- Excels/Sheets Table
-- ============================================
CREATE TABLE IF NOT EXISTS excels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled Sheet',
    data JSONB DEFAULT '[]',
    space_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add is_favorite column if it doesn't exist
DO $$ BEGIN
    ALTER TABLE excels ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- ============================================
-- Spaces Table
-- ============================================
CREATE TABLE IF NOT EXISTS spaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'New Space',
    icon TEXT DEFAULT 'folder',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns to spaces if they don't exist
DO $$ BEGIN
    ALTER TABLE spaces ADD COLUMN description TEXT DEFAULT '';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE spaces ADD COLUMN due_date DATE;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE spaces ADD COLUMN linked_project UUID REFERENCES projects(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE spaces ADD COLUMN color_tag TEXT DEFAULT 'none';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE spaces ADD COLUMN members JSONB DEFAULT '[]';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE spaces ADD COLUMN checklist JSONB DEFAULT '[]';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add team_members column to projects if it doesn't exist
DO $$ BEGIN
    ALTER TABLE projects ADD COLUMN team_members JSONB DEFAULT '[]';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- ============================================
-- Project Invitations Table
-- ============================================
CREATE TABLE IF NOT EXISTS project_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invitee_email TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- User Presence Table (for online/watching status)
-- ============================================
CREATE TABLE IF NOT EXISTS user_presence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_online BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    watching_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- ============================================
-- Recurring Tasks Table
-- ============================================
CREATE TABLE IF NOT EXISTS recurring_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    time TEXT,
    frequency TEXT DEFAULT 'daily',
    days_of_week JSONB,
    color TEXT,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Indexes (Safe Creation with IF NOT EXISTS)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_backlog_tasks_user_id ON backlog_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_issues_user_id ON issues(user_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_docs_user_id ON docs(user_id);
CREATE INDEX IF NOT EXISTS idx_docs_favorite ON docs(is_favorite);
CREATE INDEX IF NOT EXISTS idx_excels_user_id ON excels(user_id);
CREATE INDEX IF NOT EXISTS idx_excels_favorite ON excels(is_favorite);
CREATE INDEX IF NOT EXISTS idx_spaces_user_id ON spaces(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_user_id ON recurring_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_project_id ON project_invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_inviter_id ON project_invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_invitee_email ON project_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON user_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_watching_project ON user_presence(watching_project_id);

-- ============================================
-- Row Level Security (RLS) - Safe Enable
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlog_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE excels ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies (Drop and recreate for safety)
-- ============================================

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User Preferences policies
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
CREATE POLICY "Users can view own preferences" ON user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON user_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Projects policies
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

-- Backlog Tasks policies
DROP POLICY IF EXISTS "Users can view own backlog_tasks" ON backlog_tasks;
DROP POLICY IF EXISTS "Users can insert own backlog_tasks" ON backlog_tasks;
DROP POLICY IF EXISTS "Users can update own backlog_tasks" ON backlog_tasks;
DROP POLICY IF EXISTS "Users can delete own backlog_tasks" ON backlog_tasks;
CREATE POLICY "Users can view own backlog_tasks" ON backlog_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own backlog_tasks" ON backlog_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own backlog_tasks" ON backlog_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own backlog_tasks" ON backlog_tasks FOR DELETE USING (auth.uid() = user_id);

-- Issues policies
DROP POLICY IF EXISTS "Users can view own issues" ON issues;
DROP POLICY IF EXISTS "Users can insert own issues" ON issues;
DROP POLICY IF EXISTS "Users can update own issues" ON issues;
DROP POLICY IF EXISTS "Users can delete own issues" ON issues;
CREATE POLICY "Users can view own issues" ON issues FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own issues" ON issues FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own issues" ON issues FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own issues" ON issues FOR DELETE USING (auth.uid() = user_id);

-- Calendar Events policies
DROP POLICY IF EXISTS "Users can view own calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "Users can insert own calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "Users can update own calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "Users can delete own calendar_events" ON calendar_events;
CREATE POLICY "Users can view own calendar_events" ON calendar_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own calendar_events" ON calendar_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own calendar_events" ON calendar_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own calendar_events" ON calendar_events FOR DELETE USING (auth.uid() = user_id);

-- Docs policies
DROP POLICY IF EXISTS "Users can view own docs" ON docs;
DROP POLICY IF EXISTS "Users can insert own docs" ON docs;
DROP POLICY IF EXISTS "Users can update own docs" ON docs;
DROP POLICY IF EXISTS "Users can delete own docs" ON docs;
CREATE POLICY "Users can view own docs" ON docs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own docs" ON docs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own docs" ON docs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own docs" ON docs FOR DELETE USING (auth.uid() = user_id);

-- Excels policies
DROP POLICY IF EXISTS "Users can view own excels" ON excels;
DROP POLICY IF EXISTS "Users can insert own excels" ON excels;
DROP POLICY IF EXISTS "Users can update own excels" ON excels;
DROP POLICY IF EXISTS "Users can delete own excels" ON excels;
CREATE POLICY "Users can view own excels" ON excels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own excels" ON excels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own excels" ON excels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own excels" ON excels FOR DELETE USING (auth.uid() = user_id);

-- Spaces policies
DROP POLICY IF EXISTS "Users can view own spaces" ON spaces;
DROP POLICY IF EXISTS "Users can insert own spaces" ON spaces;
DROP POLICY IF EXISTS "Users can update own spaces" ON spaces;
DROP POLICY IF EXISTS "Users can delete own spaces" ON spaces;
CREATE POLICY "Users can view own spaces" ON spaces FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own spaces" ON spaces FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own spaces" ON spaces FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own spaces" ON spaces FOR DELETE USING (auth.uid() = user_id);

-- Recurring Tasks policies
DROP POLICY IF EXISTS "Users can view own recurring_tasks" ON recurring_tasks;
DROP POLICY IF EXISTS "Users can insert own recurring_tasks" ON recurring_tasks;
DROP POLICY IF EXISTS "Users can update own recurring_tasks" ON recurring_tasks;
DROP POLICY IF EXISTS "Users can delete own recurring_tasks" ON recurring_tasks;
CREATE POLICY "Users can view own recurring_tasks" ON recurring_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recurring_tasks" ON recurring_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring_tasks" ON recurring_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring_tasks" ON recurring_tasks FOR DELETE USING (auth.uid() = user_id);

-- Project Invitations policies
DROP POLICY IF EXISTS "Users can view project invitations" ON project_invitations;
DROP POLICY IF EXISTS "Users can insert project invitations" ON project_invitations;
DROP POLICY IF EXISTS "Users can update project invitations" ON project_invitations;
DROP POLICY IF EXISTS "Users can delete project invitations" ON project_invitations;
CREATE POLICY "Users can view project invitations" ON project_invitations FOR SELECT USING (
  auth.uid() = inviter_id OR 
  auth.email() = invitee_email
);
CREATE POLICY "Users can insert project invitations" ON project_invitations FOR INSERT WITH CHECK (
  auth.uid() = inviter_id
);
CREATE POLICY "Users can update project invitations" ON project_invitations FOR UPDATE USING (
  auth.uid() = inviter_id OR 
  auth.email() = invitee_email
);
CREATE POLICY "Users can delete project invitations" ON project_invitations FOR DELETE USING (
  auth.uid() = inviter_id
);

-- User Presence policies
DROP POLICY IF EXISTS "Users can view own presence" ON user_presence;
DROP POLICY IF EXISTS "Users can insert own presence" ON user_presence;
DROP POLICY IF EXISTS "Users can update own presence" ON user_presence;
DROP POLICY IF EXISTS "Users can delete own presence" ON user_presence;
DROP POLICY IF EXISTS "Users can view all presence" ON user_presence;
CREATE POLICY "Users can view all presence" ON user_presence FOR SELECT USING (true);
CREATE POLICY "Users can insert own presence" ON user_presence FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own presence" ON user_presence FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own presence" ON user_presence FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Trigger for auto-updating timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers (drop first to avoid duplicates)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS update_backlog_tasks_updated_at ON backlog_tasks;
DROP TRIGGER IF EXISTS update_issues_updated_at ON issues;
DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON calendar_events;
DROP TRIGGER IF EXISTS update_docs_updated_at ON docs;
DROP TRIGGER IF EXISTS update_excels_updated_at ON excels;
DROP TRIGGER IF EXISTS update_spaces_updated_at ON spaces;
DROP TRIGGER IF EXISTS update_recurring_tasks_updated_at ON recurring_tasks;
DROP TRIGGER IF EXISTS update_project_invitations_updated_at ON project_invitations;
DROP TRIGGER IF EXISTS update_user_presence_updated_at ON user_presence;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_backlog_tasks_updated_at BEFORE UPDATE ON backlog_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_issues_updated_at BEFORE UPDATE ON issues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_docs_updated_at BEFORE UPDATE ON docs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_excels_updated_at BEFORE UPDATE ON excels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_spaces_updated_at BEFORE UPDATE ON spaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recurring_tasks_updated_at BEFORE UPDATE ON recurring_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_project_invitations_updated_at BEFORE UPDATE ON project_invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_presence_updated_at BEFORE UPDATE ON user_presence FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Trigger for auto-creating profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (new.id, new.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- SAFE SCHEMA COMPLETE!
-- You can run this script multiple times without losing data.
-- ============================================
