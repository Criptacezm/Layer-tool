-- ============================================
-- Layer App - Fixed Database Schema for Supabase
-- Version: 2.0
-- Run this in Supabase SQL Editor
-- ============================================

-- IMPORTANT: This script drops and recreates all tables
-- Make sure to backup any existing data first!

-- Drop existing tables (in reverse dependency order)
DROP TABLE IF EXISTS recurring_tasks CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS spaces CASCADE;
DROP TABLE IF EXISTS excels CASCADE;
DROP TABLE IF EXISTS docs CASCADE;
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS issues CASCADE;
DROP TABLE IF EXISTS backlog_tasks CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop existing types
DROP TYPE IF EXISTS project_status CASCADE;
DROP TYPE IF EXISTS task_status CASCADE;
DROP TYPE IF EXISTS priority_level CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Enum Types
-- ============================================
CREATE TYPE project_status AS ENUM ('todo', 'in_progress', 'review', 'done', 'backlog');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'urgent');

-- ============================================
-- Profiles Table (linked to auth.users)
-- ============================================
CREATE TABLE profiles (
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
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'dark',
    left_panel_width INTEGER DEFAULT 280,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- ============================================
-- Projects Table (matches supabase-client.js)
-- ============================================
CREATE TABLE projects (
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

-- ============================================
-- Backlog Tasks Table
-- ============================================
CREATE TABLE backlog_tasks (
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
CREATE TABLE issues (
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
CREATE TABLE calendar_events (
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
CREATE TABLE docs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled',
    content TEXT DEFAULT '',
    space_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Excels/Sheets Table
-- ============================================
CREATE TABLE excels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled Sheet',
    data JSONB DEFAULT '[]',
    space_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Spaces Table
-- ============================================
CREATE TABLE spaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'New Space',
    color TEXT DEFAULT '#3b82f6',
    icon TEXT DEFAULT 'folder',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Recurring Tasks Table
-- ============================================
CREATE TABLE recurring_tasks (
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
-- Indexes for Performance
-- ============================================
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_backlog_tasks_user_id ON backlog_tasks(user_id);
CREATE INDEX idx_issues_user_id ON issues(user_id);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_date ON calendar_events(date);
CREATE INDEX idx_docs_user_id ON docs(user_id);
CREATE INDEX idx_excels_user_id ON excels(user_id);
CREATE INDEX idx_spaces_user_id ON spaces(user_id);
CREATE INDEX idx_recurring_tasks_user_id ON recurring_tasks(user_id);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
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

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User Preferences policies
CREATE POLICY "Users can view own preferences" ON user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON user_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Projects policies
CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

-- Backlog Tasks policies
CREATE POLICY "Users can view own backlog_tasks" ON backlog_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own backlog_tasks" ON backlog_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own backlog_tasks" ON backlog_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own backlog_tasks" ON backlog_tasks FOR DELETE USING (auth.uid() = user_id);

-- Issues policies
CREATE POLICY "Users can view own issues" ON issues FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own issues" ON issues FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own issues" ON issues FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own issues" ON issues FOR DELETE USING (auth.uid() = user_id);

-- Calendar Events policies
CREATE POLICY "Users can view own calendar_events" ON calendar_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own calendar_events" ON calendar_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own calendar_events" ON calendar_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own calendar_events" ON calendar_events FOR DELETE USING (auth.uid() = user_id);

-- Docs policies
CREATE POLICY "Users can view own docs" ON docs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own docs" ON docs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own docs" ON docs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own docs" ON docs FOR DELETE USING (auth.uid() = user_id);

-- Excels policies
CREATE POLICY "Users can view own excels" ON excels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own excels" ON excels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own excels" ON excels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own excels" ON excels FOR DELETE USING (auth.uid() = user_id);

-- Spaces policies
CREATE POLICY "Users can view own spaces" ON spaces FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own spaces" ON spaces FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own spaces" ON spaces FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own spaces" ON spaces FOR DELETE USING (auth.uid() = user_id);

-- Recurring Tasks policies
CREATE POLICY "Users can view own recurring_tasks" ON recurring_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recurring_tasks" ON recurring_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring_tasks" ON recurring_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring_tasks" ON recurring_tasks FOR DELETE USING (auth.uid() = user_id);

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

-- Apply triggers to all tables
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

-- ============================================
-- Trigger for auto-creating profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (new.id, new.email);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Done! Your schema is ready.
-- ============================================
