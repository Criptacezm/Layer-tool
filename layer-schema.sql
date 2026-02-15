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
        project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
        space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
        assignment_id UUID REFERENCES issues(id) ON DELETE SET NULL,
        location TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Add new columns to calendar_events if they don't exist (Migration)
    DO $$ BEGIN
        ALTER TABLE calendar_events ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END $$;

    DO $$ BEGIN
        ALTER TABLE calendar_events ADD COLUMN space_id UUID REFERENCES spaces(id) ON DELETE SET NULL;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END $$;

    DO $$ BEGIN
        ALTER TABLE calendar_events ADD COLUMN assignment_id UUID REFERENCES issues(id) ON DELETE SET NULL;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END $$;

    DO $$ BEGIN
        ALTER TABLE calendar_events ADD COLUMN location TEXT;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END $$;

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

    -- Add shared_with JSONB column for document sharing
    DO $$ BEGIN
        ALTER TABLE docs ADD COLUMN shared_with JSONB DEFAULT '[]';
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

    -- Add shared_with JSONB column for spreadsheet sharing
    DO $$ BEGIN
        ALTER TABLE excels ADD COLUMN shared_with JSONB DEFAULT '[]';
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
    -- Followers/Following Table
    -- ============================================
    CREATE TABLE IF NOT EXISTS followers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, following_id)
    );

    -- ============================================
    -- Team Invitations Table (enhanced)
    -- ============================================
    CREATE TABLE IF NOT EXISTS team_invitations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        invitee_email TEXT NOT NULL,
        team_name TEXT NOT NULL,
        message TEXT,
        status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

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
    -- Team Chat Messages Table
    -- ============================================
    CREATE TABLE IF NOT EXISTS team_chat_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        channel_id TEXT NOT NULL DEFAULT 'general',
        channel_type TEXT NOT NULL DEFAULT 'channel', -- 'channel', 'dm', 'group'
        recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- For DMs
        message TEXT NOT NULL,
        message_type TEXT DEFAULT 'text', -- 'text', 'file', 'image', 'system'
        file_url TEXT,
        file_name TEXT,
        file_size INTEGER,
        is_edited BOOLEAN DEFAULT FALSE,
        edited_at TIMESTAMP WITH TIME ZONE,
        reply_to UUID REFERENCES team_chat_messages(id) ON DELETE SET NULL,
        reactions JSONB DEFAULT '[]',
        mentions JSONB DEFAULT '[]',
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- ============================================
    -- Migration: Fix team_chat_messages FKs to point to profiles
    -- ============================================
    DO $$ BEGIN
        -- Drop old constraints pointing to auth.users if they exist
        ALTER TABLE team_chat_messages DROP CONSTRAINT IF EXISTS team_chat_messages_user_id_fkey;
        ALTER TABLE team_chat_messages DROP CONSTRAINT IF EXISTS team_chat_messages_recipient_id_fkey;
        
        -- Add new constraints pointing to profiles
        ALTER TABLE team_chat_messages ADD CONSTRAINT team_chat_messages_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
            
        ALTER TABLE team_chat_messages ADD CONSTRAINT team_chat_messages_recipient_id_fkey 
            FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE CASCADE;
    EXCEPTION
        WHEN OTHERS THEN 
            RAISE NOTICE 'Error updating constraints (possible data violation or race condition): %', SQLERRM;
    END $$;

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
    CREATE INDEX IF NOT EXISTS idx_team_chat_messages_user_id ON team_chat_messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_team_chat_messages_channel_id ON team_chat_messages(channel_id);
    CREATE INDEX IF NOT EXISTS idx_team_chat_messages_channel_type ON team_chat_messages(channel_type);
    CREATE INDEX IF NOT EXISTS idx_team_chat_messages_recipient_id ON team_chat_messages(recipient_id);
    CREATE INDEX IF NOT EXISTS idx_team_chat_messages_created_at ON team_chat_messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_recurring_tasks_user_id ON recurring_tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_project_invitations_project_id ON project_invitations(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_invitations_inviter_id ON project_invitations(inviter_id);
    CREATE INDEX IF NOT EXISTS idx_project_invitations_invitee_email ON project_invitations(invitee_email);
    CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON user_presence(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_presence_watching_project ON user_presence(watching_project_id);
    CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON followers(follower_id);
    CREATE INDEX IF NOT EXISTS idx_followers_following_id ON followers(following_id);
    CREATE INDEX IF NOT EXISTS idx_followers_status ON followers(status);
    CREATE INDEX IF NOT EXISTS idx_team_invitations_inviter_id ON team_invitations(inviter_id);
    CREATE INDEX IF NOT EXISTS idx_team_invitations_invitee_email ON team_invitations(invitee_email);
    CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);

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
    ALTER TABLE team_chat_messages ENABLE ROW LEVEL SECURITY;
    ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

    -- ============================================
    -- RLS Policies (Drop and recreate for safety)
    -- ============================================

    -- Profiles policies
    DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
    DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
    -- Allow all authenticated users to view profiles (needed for team collaboration - names/avatars)
    CREATE POLICY "Authenticated users can view all profiles" ON profiles FOR SELECT TO authenticated USING (true);
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
    DROP POLICY IF EXISTS "Team members can view projects" ON projects;
    DROP POLICY IF EXISTS "Team members can update projects" ON projects;

    CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (
        auth.uid() = user_id OR 
        (team_members IS NOT NULL AND team_members @> jsonb_build_array(auth.email()))
    );
    CREATE POLICY "Users can insert own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (
        auth.uid() = user_id OR 
        (team_members IS NOT NULL AND team_members @> jsonb_build_array(auth.email()))
    );
    DROP POLICY IF EXISTS "Only owner can delete projects" ON projects;
    CREATE POLICY "Only owner can delete projects" ON projects FOR DELETE USING (auth.uid() = user_id);

    -- Enhanced policies for team member management
    CREATE POLICY "Team members can view projects" ON projects FOR SELECT USING (
        auth.uid() = user_id OR 
        (team_members IS NOT NULL AND team_members @> jsonb_build_array(auth.email()))
    );
    CREATE POLICY "Team members can update projects" ON projects FOR UPDATE USING (
        auth.uid() = user_id OR 
        (team_members IS NOT NULL AND team_members @> jsonb_build_array(auth.email()))
    );

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

    -- Docs policies (shared_with uses JSONB containment with jwt email)
    DROP POLICY IF EXISTS "Users can view own docs" ON docs;
    DROP POLICY IF EXISTS "Users can insert own docs" ON docs;
    DROP POLICY IF EXISTS "Users can update own docs" ON docs;
    DROP POLICY IF EXISTS "Users can delete own docs" ON docs;
    CREATE POLICY "Users can view own docs" ON docs FOR SELECT USING (
        auth.uid() = user_id OR 
        (shared_with IS NOT NULL AND shared_with::jsonb @> ('[{"email":"' || (auth.jwt() ->> 'email') || '"}]')::jsonb)
    );
    CREATE POLICY "Users can insert own docs" ON docs FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users can update own docs" ON docs FOR UPDATE USING (
        auth.uid() = user_id OR 
        (shared_with IS NOT NULL AND shared_with::jsonb @> ('[{"email":"' || (auth.jwt() ->> 'email') || '"}]')::jsonb)
    );
    CREATE POLICY "Users can delete own docs" ON docs FOR DELETE USING (auth.uid() = user_id);

    -- Excels policies (shared_with uses JSONB containment with jwt email)
    DROP POLICY IF EXISTS "Users can view own excels" ON excels;
    DROP POLICY IF EXISTS "Users can insert own excels" ON excels;
    DROP POLICY IF EXISTS "Users can update own excels" ON excels;
    DROP POLICY IF EXISTS "Users can delete own excels" ON excels;
    CREATE POLICY "Users can view own excels" ON excels FOR SELECT USING (
        auth.uid() = user_id OR 
        (shared_with IS NOT NULL AND shared_with::jsonb @> ('[{"email":"' || (auth.jwt() ->> 'email') || '"}]')::jsonb)
    );
    CREATE POLICY "Users can insert own excels" ON excels FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users can update own excels" ON excels FOR UPDATE USING (
        auth.uid() = user_id OR 
        (shared_with IS NOT NULL AND shared_with::jsonb @> ('[{"email":"' || (auth.jwt() ->> 'email') || '"}]')::jsonb)
    );
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

    -- Team Chat Messages policies
    DROP POLICY IF EXISTS "Users can view team chat messages" ON team_chat_messages;
    DROP POLICY IF EXISTS "Users can insert team chat messages" ON team_chat_messages;
    DROP POLICY IF EXISTS "Users can update own team chat messages" ON team_chat_messages;
    DROP POLICY IF EXISTS "Users can delete own team chat messages" ON team_chat_messages;
    CREATE POLICY "Users can view team chat messages" ON team_chat_messages FOR SELECT USING (
        auth.uid() = user_id OR 
        auth.uid() = recipient_id OR
        channel_type = 'channel'
    );
    CREATE POLICY "Users can insert team chat messages" ON team_chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users can update own team chat messages" ON team_chat_messages FOR UPDATE USING (auth.uid() = user_id);
    CREATE POLICY "Users can delete own team chat messages" ON team_chat_messages FOR DELETE USING (auth.uid() = user_id);

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

    -- Followers policies
    DROP POLICY IF EXISTS "Users can view followers" ON followers;
    DROP POLICY IF EXISTS "Users can insert followers" ON followers;
    DROP POLICY IF EXISTS "Users can update followers" ON followers;
    DROP POLICY IF EXISTS "Users can delete followers" ON followers;
    CREATE POLICY "Users can view followers" ON followers FOR SELECT USING (
        auth.uid() = follower_id OR 
        auth.uid() = following_id OR
        status = 'accepted'
    );
    CREATE POLICY "Users can insert followers" ON followers FOR INSERT WITH CHECK (auth.uid() = follower_id);
    CREATE POLICY "Users can update followers" ON followers FOR UPDATE USING (
        auth.uid() = follower_id OR 
        auth.uid() = following_id
    );
    CREATE POLICY "Users can delete followers" ON followers FOR DELETE USING (
        auth.uid() = follower_id OR 
        auth.uid() = following_id
    );

    -- Team Invitations policies
    DROP POLICY IF EXISTS "Users can view team invitations" ON team_invitations;
    DROP POLICY IF EXISTS "Users can insert team invitations" ON team_invitations;
    DROP POLICY IF EXISTS "Users can update team invitations" ON team_invitations;
    DROP POLICY IF EXISTS "Users can delete team invitations" ON team_invitations;
    CREATE POLICY "Users can view team invitations" ON team_invitations FOR SELECT USING (
        auth.uid() = inviter_id OR 
        auth.email() = invitee_email
    );
    CREATE POLICY "Users can insert team invitations" ON team_invitations FOR INSERT WITH CHECK (auth.uid() = inviter_id);
    CREATE POLICY "Users can update team invitations" ON team_invitations FOR UPDATE USING (
        auth.uid() = inviter_id OR 
        auth.email() = invitee_email
    );
    CREATE POLICY "Users can delete team invitations" ON team_invitations FOR DELETE USING (auth.uid() = inviter_id);

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
    DROP TRIGGER IF EXISTS update_team_chat_messages_updated_at ON team_chat_messages;
    DROP TRIGGER IF EXISTS update_project_invitations_updated_at ON project_invitations;
    DROP TRIGGER IF EXISTS update_user_presence_updated_at ON user_presence;
    DROP TRIGGER IF EXISTS update_followers_updated_at ON followers;
    DROP TRIGGER IF EXISTS update_team_invitations_updated_at ON team_invitations;

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
    CREATE TRIGGER update_team_chat_messages_updated_at BEFORE UPDATE ON team_chat_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    CREATE TRIGGER update_project_invitations_updated_at BEFORE UPDATE ON project_invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    CREATE TRIGGER update_user_presence_updated_at BEFORE UPDATE ON user_presence FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    CREATE TRIGGER update_followers_updated_at BEFORE UPDATE ON followers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    CREATE TRIGGER update_team_invitations_updated_at BEFORE UPDATE ON team_invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    -- ============================================
    -- Trigger for auto-creating profile on signup
    -- ============================================
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $$
    BEGIN
        -- Insert profile with additional user metadata if available
        INSERT INTO public.profiles (id, email, name, avatar_url)
        VALUES (
            NEW.id, 
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
            NEW.raw_user_meta_data->>'avatar_url'
        )
        ON CONFLICT (id) DO NOTHING;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

    -- ============================================
    -- Enable Realtime for shared content tables
    -- ============================================
    
    -- Enable realtime for docs and excels so shared content updates are pushed live
    ALTER PUBLICATION supabase_realtime ADD TABLE docs;
    ALTER PUBLICATION supabase_realtime ADD TABLE excels;

    -- Set replica identity to FULL so realtime sends old + new record data
    ALTER TABLE docs REPLICA IDENTITY FULL;
    ALTER TABLE excels REPLICA IDENTITY FULL;

    -- ============================================
    -- SAFE SCHEMA COMPLETE!
    -- You can run this script multiple times without losing data.
    -- ============================================
