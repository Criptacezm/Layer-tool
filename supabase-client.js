/* ============================================
   Layer - Supabase Client Configuration
   ============================================ */

const SUPABASE_URL = 'https://uqfnadlyrbprzxgjkvtc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxZm5hZGx5cmJwcnp4Z2prdnRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzkxNzAsImV4cCI6MjA4Mjk1NTE3MH0.12PfMd0vnsWvCXSNdkc3E02KDn46xi9XTyZ8rXNiVHs';

// Initialize Supabase client (use window.supabase from CDN)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Current user state
let currentUser = null;
let currentSession = null;

// ============================================
// Authentication Functions
// ============================================

async function initAuth() {
  // Get initial session first
  const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError) {
    console.error('Failed to get session:', sessionError);
  }

  currentSession = session;
  currentUser = session?.user ?? null;

  console.log('Initial auth state:', {
    hasSession: !!session,
    userEmail: currentUser?.email
  });

  // Set up auth state listener AFTER checking initial session
  supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event, session?.user?.email);
    currentSession = session;
    currentUser = session?.user ?? null;

    // Dispatch custom event for UI updates
    window.dispatchEvent(new CustomEvent('authStateChanged', {
      detail: { user: currentUser, session: currentSession, event }
    }));
  });

  return { user: currentUser, session: currentSession };
}

async function signUp(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin + '/layer.html'
    }
  });

  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  console.log('Attempting sign in for:', email);

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error('Sign in error:', error);
    throw error;
  }

  // Update local state immediately
  currentSession = data.session;
  currentUser = data.user;

  console.log('Sign in successful:', data.user?.email);
  return data;
}

async function signInWithGoogle() {
  console.log('Attempting Google sign in...');

  try {
    // Preserve current URL parameters (like project ID) after redirect
    const redirectTo = new URL(`${window.location.origin}${window.location.pathname}`);
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.forEach((value, key) => {
      redirectTo.searchParams.set(key, value);
    });

    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo.toString(),
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });

    if (error) {
      console.error('Google sign in error:', error);
      throw error;
    }

    console.log('Google OAuth redirect initiated to:', redirectTo.toString());
    return data;
  } catch (error) {
    console.error('Failed to initiate Google sign in:', error);
    throw error;
  }
}

// Auto-create profile for new users (especially Google OAuth users)
async function ensureUserProfile() {
  if (!currentUser) {
    console.log('No current user, skipping profile creation');
    return null;
  }

  try {
    // Check if profile already exists
    const { data: existingProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (existingProfile) {
      console.log('Profile already exists for user:', currentUser.email);
      return existingProfile;
    }

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error checking profile existence:', profileError);
      // Continue with creation attempt
    }

    // Create profile for the user
    console.log('Creating profile for user:', currentUser.email);

    const userProfileData = {
      id: currentUser.id,
      email: currentUser.email,
      name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'User',
      avatar_url: currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || null
    };

    const { data: newProfile, error: createError } = await supabaseClient
      .from('profiles')
      .insert(userProfileData)
      .select()
      .single();

    if (createError) {
      console.error('Failed to create profile:', createError);
      // Try one more time with minimal data
      const { data: retryProfile, error: retryError } = await supabaseClient
        .from('profiles')
        .insert({
          id: currentUser.id,
          email: currentUser.email
        })
        .select()
        .single();

      if (retryError) {
        console.error('Retry profile creation failed:', retryError);
        throw retryError;
      }

      console.log('Profile created successfully on retry');
      return retryProfile;
    }

    console.log('Profile created successfully:', newProfile);
    return newProfile;
  } catch (error) {
    console.error('Error ensuring user profile:', error);
    throw error;
  }
}

// Enhanced function to add team member directly to project
async function addTeamMemberToProject(projectId, memberEmail) {
  if (!currentUser) throw new Error('Not authenticated');

  try {
    console.log('Adding team member:', memberEmail, 'to project:', projectId);

    // First, ensure the user has a profile
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id')
      .ilike('email', memberEmail) // Case-insensitive email matching
      .maybeSingle();

    if (profileError) {
      console.error('Error checking user profile:', profileError);
    }

    // If user doesn't have a profile, we'll still proceed but log it
    if (!userProfile) {
      console.warn('User does not have a profile, but proceeding with team addition');
    }

    // Get current project team members
    const { data: project, error: projectError } = await supabaseClient
      .from('projects')
      .select('team_members')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project) throw new Error('Project not found');

    // Check if user is already a team member
    const currentTeamMembers = project.team_members || [];
    if (Array.isArray(currentTeamMembers) && currentTeamMembers.includes(memberEmail)) {
      throw new Error('User is already a team member');
    }

    // Add new member to team
    const updatedTeamMembers = [...currentTeamMembers, memberEmail];

    // Update project with new team members
    const { data: updatedProject, error: updateError } = await supabaseClient
      .from('projects')
      .update({
        team_members: updatedTeamMembers,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .select()
      .single();

    if (updateError) throw updateError;

    console.log('Team member added successfully:', memberEmail);
    return updatedProject;

  } catch (error) {
    console.error('Error adding team member:', error);
    throw error;
  }
}

// Remove team member from project
async function removeTeamMemberFromProject(projectId, userEmail) {
  if (!currentUser) throw new Error('Not authenticated');

  try {
    console.log('Removing team member:', userEmail, 'from project:', projectId);

    // Get current project team members
    const { data: project, error: projectError } = await supabaseClient
      .from('projects')
      .select('team_members, user_id')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project) throw new Error('Project not found');

    // Check if user is trying to remove themselves or is the project owner
    const isOwner = project.user_id === currentUser.id;
    const isRemovingSelf = currentUser.email === userEmail;

    if (!isOwner && !isRemovingSelf) {
      throw new Error('You can only remove yourself from the project');
    }

    // Remove member from team
    const currentTeamMembers = project.team_members || [];
    const updatedTeamMembers = currentTeamMembers.filter(member => member !== userEmail);

    // Update project with new team members
    const { data: updatedProject, error: updateError } = await supabaseClient
      .from('projects')
      .update({
        team_members: updatedTeamMembers,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .select()
      .single();

    if (updateError) throw updateError;

    console.log('Team member removed successfully:', userEmail);
    return updatedProject;

  } catch (error) {
    console.error('Error removing team member:', error);
    throw error;
  }
}

// Utility function to fix missing profiles for all existing users
async function fixMissingProfiles() {
  try {
    console.log('Checking for users without profiles...');

    // Get all auth users
    const { data: authUsers, error: authError } = await supabaseClient
      .from('users')
      .select('id, email, raw_user_meta_data');

    if (authError) {
      console.error('Failed to fetch auth users:', authError);
      return;
    }

    // Get all existing profiles
    const { data: existingProfiles, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id');

    if (profileError) {
      console.error('Failed to fetch existing profiles:', profileError);
      return;
    }

    const existingProfileIds = new Set(existingProfiles.map(p => p.id));
    const usersWithoutProfiles = authUsers.filter(user => !existingProfileIds.has(user.id));

    console.log(`Found ${usersWithoutProfiles.length} users without profiles`);

    // Create profiles for users without them
    for (const user of usersWithoutProfiles) {
      try {
        const profileData = {
          id: user.id,
          email: user.email,
          name: user.raw_user_meta_data?.full_name || user.raw_user_meta_data?.name || user.email?.split('@')[0] || 'User',
          avatar_url: user.raw_user_meta_data?.avatar_url || user.raw_user_meta_data?.picture || null
        };

        await supabaseClient
          .from('profiles')
          .insert(profileData);

        console.log(`Created profile for ${user.email}`);
      } catch (error) {
        console.error(`Failed to create profile for ${user.email}:`, error);
      }
    }

    console.log('Profile fix completed');
  } catch (error) {
    console.error('Error fixing missing profiles:', error);
  }
}

async function signOut() {
  console.log('Signing out...');
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error('Error signing out:', error);
    // Continue with local cleanup anyway
  }

  currentUser = null;
  currentSession = null;

  // Clear any local storage auth tokens if they exist effectively
  localStorage.removeItem('supabase.auth.token');

  console.log('Sign out complete, reloading...');
  window.location.reload();
}

function getCurrentUser() {
  // If currentUser is not set, try to get it from session
  if (!currentUser) {
    // Attempt to get session synchronously from storage
    const sessionStr = localStorage.getItem('supabase.auth.token');
    if (sessionStr) {
      try {
        const sessionData = JSON.parse(sessionStr);
        if (sessionData?.currentSession?.user) {
          currentUser = sessionData.currentSession.user;
        }
      } catch (e) {
        console.warn('Failed to parse stored session:', e);
      }
    }
  }
  return currentUser;
}

async function refreshUser() {
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error) {
    console.error('Failed to refresh user:', error);
    return null;
  }
  currentUser = user;
  return user;
}

function isAuthenticated() {
  return !!currentUser;
}

// ============================================
// User Profile Functions
// ============================================

async function getProfile() {
  if (!currentUser) return null;

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function updateProfile(updates) {
  if (!currentUser) throw new Error('Not authenticated');

  const { data, error } = await supabaseClient
    .from('profiles')
    .update(updates)
    .eq('id', currentUser.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// User Preferences Functions
// ============================================

async function getUserPreferences() {
  if (!currentUser) {
    // Fall back to localStorage for unauthenticated users
    return {
      theme: localStorage.getItem('layerTheme') || 'dark',
      left_panel_width: parseInt(localStorage.getItem('layerLeftPanelWidth')) || 280
    };
  }

  const { data, error } = await supabaseClient
    .from('user_preferences')
    .select('*')
    .eq('user_id', currentUser.id)
    .single();

  if (error && error.code === 'PGRST116') {
    // No preferences yet, create default
    const { data: newData, error: insertError } = await supabaseClient
      .from('user_preferences')
      .insert({ user_id: currentUser.id })
      .select()
      .single();

    if (insertError) throw insertError;
    return newData;
  }

  if (error) throw error;
  return data;
}

async function saveUserPreferences(prefs) {
  if (!currentUser) {
    // Fall back to localStorage for unauthenticated users
    if (prefs.theme) localStorage.setItem('layerTheme', prefs.theme);
    if (prefs.left_panel_width) localStorage.setItem('layerLeftPanelWidth', prefs.left_panel_width);
    return prefs;
  }

  const { data, error } = await supabaseClient
    .from('user_preferences')
    .upsert({
      user_id: currentUser.id,
      ...prefs
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// Projects Functions (with proper membership support)
// ============================================

// Global realtime subscription channels (deprecated - use LayerRealtime)
let projectsChannel = null;
let projectMembersChannel = null;

// Load realtime module if available
if (typeof window.LayerRealtime === 'undefined') {
  console.warn('LayerRealtime module not loaded. Realtime features will be limited.');
}

async function loadProjectsFromDB() {
  if (!currentUser) {
    // Fall back to localStorage
    return loadProjects();
  }

  try {
    // Get all projects user has access to via project_members table
    const { data, error } = await supabaseClient
      .from('projects')
      .select(`
        *,
        project_members!inner(user_id, role, accepted_at)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform to match existing format with isOwner flag
    return data.map(p => transformProject(p, currentUser.id));
  } catch (error) {
    console.error('Error loading projects with project_members:', error);

    // Fallback to old method if project_members doesn't exist yet
    const { data: fallbackData, error: fallbackError } = await supabaseClient
      .from('projects')
      .select('*')
      .or(`user_id.eq.${currentUser.id},team_members.cs.["${currentUser.email}"]`)
      .order('created_at', { ascending: false });

    if (fallbackError) throw fallbackError;

    return fallbackData.map(p => transformProject(p, currentUser.id));
  }
}

// Transform DB project to app format
function transformProject(p, userId) {
  const isOwner = p.user_id === userId;
  const userMembership = p.project_members?.find(m => m.user_id === userId);

  return {
    id: p.id,
    userId: p.user_id,
    user_id: p.user_id,
    name: p.name,
    description: p.description,
    status: p.status,
    startDate: p.start_date,
    targetDate: p.target_date,
    flowchart: p.flowchart,
    columns: p.columns,
    updates: p.updates,
    milestones: p.milestones || {},
    gripDiagram: p.grip_diagram || null,
    tasks: p.tasks || [],
    activity: p.activity || [],
    resources: p.resources || [],
    teamMembers: p.team_members || [],
    projectMembers: p.project_members || [],
    isOwner: isOwner,
    memberRole: userMembership?.role || (isOwner ? 'owner' : 'member'),
    leader: p.leader || null,
    userEmail: p.user_email || null
  };
}

// Get a single project by ID with full membership info
async function getProjectById(projectId) {
  if (!currentUser) return null;

  const { data, error } = await supabaseClient
    .from('projects')
    .select(`
      *,
      project_members(
        id,
        user_id,
        role,
        invited_at,
        accepted_at,
        profiles:user_id(id, email, name, avatar_url)
      )
    `)
    .eq('id', projectId)
    .single();

  if (error) {
    console.error('Error getting project:', error);
    throw error;
  }

  return transformProject(data, currentUser.id);
}

// Get project members with profile info
async function getProjectMembers(projectId) {
  if (!currentUser) return [];

  const { data, error } = await supabaseClient
    .from('project_members')
    .select(`
      id,
      user_id,
      role,
      invited_at,
      accepted_at,
      profiles:user_id(id, email, name, avatar_url)
    `)
    .eq('project_id', projectId)
    .order('role', { ascending: true }); // owner first

  if (error) {
    console.error('Error getting project members:', error);
    return [];
  }

  return data.map(m => ({
    id: m.id,
    memberId: m.user_id,
    role: m.role,
    invitedAt: m.invited_at,
    acceptedAt: m.accepted_at,
    email: m.profiles?.email,
    name: m.profiles?.name,
    avatarUrl: m.profiles?.avatar_url
  }));
}

// Add member to project (owner only - RLS enforced)
async function addProjectMemberByEmail(projectId, memberEmail) {
  if (!currentUser) throw new Error('Not authenticated');

  console.log('Adding project member:', memberEmail, 'to project:', projectId);

  // First find the user by email
  const { data: targetUser, error: userError } = await supabaseClient
    .from('profiles')
    .select('id, email, name')
    .ilike('email', memberEmail)
    .single();

  if (userError || !targetUser) {
    throw new Error(`User with email "${memberEmail}" not found. They need to sign up first.`);
  }

  // Check if already a member
  const { data: existingMember } = await supabaseClient
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', targetUser.id)
    .maybeSingle();

  if (existingMember) {
    throw new Error('User is already a member of this project');
  }

  // Add member
  const { data, error } = await supabaseClient
    .from('project_members')
    .insert({
      project_id: projectId,
      user_id: targetUser.id,
      role: 'member',
      accepted_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding project member:', error);
    throw error;
  }

  console.log('Project member added successfully:', memberEmail);
  return { ...data, email: targetUser.email, name: targetUser.name };
}

// Remove member from project (owner can kick anyone, members can leave)
async function removeProjectMember(projectId, userId) {
  if (!currentUser) throw new Error('Not authenticated');

  console.log('Removing project member:', userId, 'from project:', projectId);

  // Can't remove owner (they must delete the project instead)
  const { data: project } = await supabaseClient
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single();

  if (project && project.user_id === userId) {
    throw new Error('Cannot remove the project owner. Delete the project instead.');
  }

  const { error } = await supabaseClient
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error removing project member:', error);
    throw error;
  }

  console.log('Project member removed successfully');
  return true;
}

// Leave project (for non-owners) - Fixed with proper error handling
async function leaveProject(projectId) {
  if (!currentUser) throw new Error('Not authenticated');

  console.log('User attempting to leave project:', projectId);

  try {
    // First check if user is the owner
    const { data: project, error: projectError } = await supabaseClient
      .from('projects')
      .select('user_id, name')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error('Error checking project ownership:', projectError);
      throw new Error('Failed to check project ownership');
    }

    if (!project) {
      throw new Error('Project not found');
    }

    if (project.user_id === currentUser.id) {
      throw new Error('Project owners cannot leave their project. Transfer ownership or delete the project instead.');
    }

    console.log(`User ${currentUser.email} leaving project: ${project.name}`);

    // Remove user from project_members table
    const { error: leaveError } = await supabaseClient
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', currentUser.id);

    if (leaveError) {
      console.error('Error leaving project:', leaveError);
      throw new Error(`Failed to leave project: ${leaveError.message}`);
    }

    console.log('Successfully left project:', project.name);

    // Also remove from legacy team_members JSON array if it exists
    try {
      const { data: currentProject } = await supabaseClient
        .from('projects')
        .select('team_members')
        .eq('id', projectId)
        .single();

      if (currentProject?.team_members && Array.isArray(currentProject.team_members)) {
        const updatedTeamMembers = currentProject.team_members.filter(email => email !== currentUser.email);
        await supabaseClient
          .from('projects')
          .update({ team_members: updatedTeamMembers })
          .eq('id', projectId);
      }
    } catch (updateError) {
      console.warn('Failed to update legacy team_members array:', updateError);
      // Don't fail the operation if legacy update fails
    }

    return { success: true, projectName: project.name };

  } catch (error) {
    console.error('Leave project error:', error);
    throw error;
  }
}

// Transfer project ownership
async function transferProjectOwnership(projectId, newOwnerUserId) {
  if (!currentUser) throw new Error('Not authenticated');

  // Verify current user is owner
  const { data: project, error: projectError } = await supabaseClient
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single();

  if (projectError || !project) throw new Error('Project not found');
  if (project.user_id !== currentUser.id) throw new Error('Only the owner can transfer ownership');

  // Verify new owner is a member
  const { data: newOwnerMembership } = await supabaseClient
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', newOwnerUserId)
    .single();

  if (!newOwnerMembership) throw new Error('New owner must be a project member first');

  // Update project owner
  const { error: updateProjectError } = await supabaseClient
    .from('projects')
    .update({ user_id: newOwnerUserId })
    .eq('id', projectId);

  if (updateProjectError) throw updateProjectError;

  // Update membership roles
  await supabaseClient
    .from('project_members')
    .update({ role: 'member' })
    .eq('project_id', projectId)
    .eq('user_id', currentUser.id);

  await supabaseClient
    .from('project_members')
    .update({ role: 'owner' })
    .eq('project_id', projectId)
    .eq('user_id', newOwnerUserId);

  console.log('Ownership transferred successfully');
  return true;
}

// Delete project (owner only - RLS enforced)
async function deleteProjectFromDB(projectId) {
  if (!currentUser) throw new Error('Not authenticated');

  console.log('Deleting project:', projectId);

  const { error } = await supabaseClient
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', currentUser.id); // RLS ensures only owner can delete

  if (error) {
    console.error('Error deleting project:', error);
    throw error;
  }

  console.log('Project deleted successfully');
  return await loadProjectsFromDB();
}

// ============================================
// Realtime Subscriptions
// ============================================

// Subscribe to all project changes for current user (using new LayerRealtime)
function subscribeToUserProjects(callback) {
  if (!currentUser) return null;

  // Use new LayerRealtime module if available
  if (window.LayerRealtime) {
    return window.LayerRealtime.subscribeToAllUserProjects(callback);
  }

  // Fallback to legacy implementation
  console.warn('Using legacy realtime subscription. Consider loading realtime.js module.');

  // Unsubscribe from existing channels
  unsubscribeFromProjects();

  // Subscribe to projects table changes
  projectsChannel = supabaseClient
    .channel('user_projects_realtime')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'projects' },
      (payload) => {
        console.log('Project change detected:', payload.eventType);
        callback(payload);
      }
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'project_members' },
      (payload) => {
        console.log('Project member change detected:', payload.eventType);
        callback(payload);
      }
    )
    .subscribe((status) => {
      console.log('Project subscription status:', status);
    });

  return projectsChannel;
}

// Unsubscribe from project changes (using new LayerRealtime)
function unsubscribeFromProjects() {
  // Use new LayerRealtime module if available
  if (window.LayerRealtime) {
    return window.LayerRealtime.unsubscribeFromAllProjects();
  }

  // Fallback to legacy implementation
  if (projectsChannel) {
    supabaseClient.removeChannel(projectsChannel);
    projectsChannel = null;
  }
  if (projectMembersChannel) {
    supabaseClient.removeChannel(projectMembersChannel);
    projectMembersChannel = null;
  }
}

async function saveProjectToDB(projectData) {
  if (!currentUser) {
    // Fall back to localStorage
    return addProject(projectData);
  }

  const { data, error } = await supabaseClient
    .from('projects')
    .insert({
      user_id: currentUser.id,
      name: projectData.name,
      description: projectData.description || '',
      status: projectData.status || 'todo',
      start_date: projectData.startDate || new Date().toISOString().split('T')[0],
      target_date: projectData.targetDate,
      flowchart: projectData.flowchart || { nodes: [], edges: [] },
      columns: projectData.columns || [
        { title: 'To Do', tasks: [] },
        { title: 'In Progress', tasks: [] },
        { title: 'Done', tasks: [] }
      ],
      updates: [{ actor: 'You', action: 'Project created', time: 'just now' }],
      milestones: projectData.milestones || {},
      resources: projectData.resources || [],
      team_members: projectData.teamMembers || []
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateProjectInDB(projectId, updates) {
  if (!currentUser) {
    // Fall back to localStorage
    const projects = loadProjects();
    const index = projects.findIndex(p => p.id === projectId);
    if (index !== -1) {
      return updateProject(index, updates);
    }
    return projects;
  }

  const dbUpdates = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
  if (updates.targetDate !== undefined) dbUpdates.target_date = updates.targetDate;
  if (updates.flowchart !== undefined) dbUpdates.flowchart = updates.flowchart;
  if (updates.columns !== undefined) dbUpdates.columns = updates.columns;
  if (updates.updates !== undefined) dbUpdates.updates = updates.updates;
  if (updates.milestones !== undefined) dbUpdates.milestones = updates.milestones;
  if (updates.grip_diagram !== undefined) dbUpdates.grip_diagram = updates.grip_diagram;
  if (updates.tasks !== undefined) dbUpdates.tasks = updates.tasks;
  if (updates.activity !== undefined) dbUpdates.activity = updates.activity;
  if (updates.resources !== undefined) dbUpdates.resources = updates.resources;
  if (updates.teamMembers !== undefined) dbUpdates.team_members = updates.teamMembers;
  if (updates.leader !== undefined) dbUpdates.leader = updates.leader;

  // Don't filter by user_id - RLS policies handle permissions
  // This allows project members to update tasks/columns too
  const { data, error } = await supabaseClient
    .from('projects')
    .update(dbUpdates)
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function deleteProjectFromDB(projectId) {
  if (!currentUser) {
    const projects = loadProjects();
    const index = projects.findIndex(p => p.id === projectId);
    if (index !== -1) {
      return deleteProject(index);
    }
    return projects;
  }

  // RLS policy ensures only owner can delete
  const { error } = await supabaseClient
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) throw error;
  return await loadProjectsFromDB();
}

// Get profile by user ID (for displaying who completed tasks, etc.)
async function getProfileById(userId) {
  if (!userId) return null;

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, email, name, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error getting profile:', error);
    return null;
  }
  return data;
}

// ============================================
// Backlog Tasks Functions
// ============================================

async function loadBacklogTasksFromDB() {
  if (!currentUser) {
    return loadBacklogTasks();
  }

  const { data, error } = await supabaseClient
    .from('backlog_tasks')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map(t => ({
    id: t.id,
    title: t.title,
    done: t.done,
    createdAt: t.created_at
  }));
}

async function addBacklogTaskToDB(title) {
  if (!currentUser) {
    return addBacklogTask(title);
  }

  const { data, error } = await supabaseClient
    .from('backlog_tasks')
    .insert({
      user_id: currentUser.id,
      title: title
    })
    .select()
    .single();

  if (error) throw error;
  return await loadBacklogTasksFromDB();
}

async function toggleBacklogTaskInDB(taskId) {
  if (!currentUser) {
    const tasks = loadBacklogTasks();
    const index = tasks.findIndex(t => t.id === taskId);
    if (index !== -1) return toggleBacklogTask(index);
    return tasks;
  }

  // Get current state
  const { data: task } = await supabaseClient
    .from('backlog_tasks')
    .select('done')
    .eq('id', taskId)
    .single();

  const { error } = await supabaseClient
    .from('backlog_tasks')
    .update({ done: !task.done })
    .eq('id', taskId)
    .eq('user_id', currentUser.id);

  if (error) throw error;
  return await loadBacklogTasksFromDB();
}

async function updateBacklogTaskInDB(taskId, title) {
  if (!currentUser) {
    const tasks = loadBacklogTasks();
    const index = tasks.findIndex(t => t.id === taskId);
    if (index !== -1) return updateBacklogTask(index, title);
    return tasks;
  }

  const { error } = await supabaseClient
    .from('backlog_tasks')
    .update({ title })
    .eq('id', taskId)
    .eq('user_id', currentUser.id);

  if (error) throw error;
  return await loadBacklogTasksFromDB();
}

async function deleteBacklogTaskFromDB(taskId) {
  if (!currentUser) {
    const tasks = loadBacklogTasks();
    const index = tasks.findIndex(t => t.id === taskId);
    if (index !== -1) return deleteBacklogTask(index);
    return tasks;
  }

  const { error } = await supabaseClient
    .from('backlog_tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', currentUser.id);

  if (error) throw error;
  return await loadBacklogTasksFromDB();
}

// ============================================
// Issues Functions
// ============================================

async function loadIssuesFromDB() {
  if (!currentUser) {
    return loadIssues();
  }

  const { data, error } = await supabaseClient
    .from('issues')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map(i => ({
    id: i.issue_id,
    dbId: i.id,
    title: i.title,
    description: i.description,
    status: i.status,
    priority: i.priority,
    assignee: i.assignee,
    dueDate: i.due_date,
    updated: formatTimeAgo(i.updated_at)
  }));
}

async function addIssueToDB(issueData) {
  if (!currentUser) {
    return addIssue(issueData);
  }

  const { data, error } = await supabaseClient
    .from('issues')
    .insert({
      user_id: currentUser.id,
      issue_id: generateIssueId(),
      title: issueData.title,
      description: issueData.description || '',
      status: issueData.status || 'todo',
      priority: issueData.priority || 'medium',
      assignee: issueData.assignee || '',
      due_date: issueData.dueDate
    })
    .select()
    .single();

  if (error) throw error;
  return await loadIssuesFromDB();
}

async function updateIssueInDB(issueDbId, updates) {
  if (!currentUser) {
    const issues = loadIssues();
    const index = issues.findIndex(i => i.id === issueDbId);
    if (index !== -1) {
      issues[index] = { ...issues[index], ...updates };
      saveIssues(issues);
    }
    return issues;
  }

  const dbUpdates = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  if (updates.assignee !== undefined) dbUpdates.assignee = updates.assignee;
  if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;

  const { error } = await supabaseClient
    .from('issues')
    .update(dbUpdates)
    .eq('id', issueDbId)
    .eq('user_id', currentUser.id);

  if (error) throw error;
  return await loadIssuesFromDB();
}

async function deleteIssueFromDB(issueDbId) {
  if (!currentUser) {
    const issues = loadIssues();
    const index = issues.findIndex(i => i.id === issueDbId);
    if (index !== -1) {
      issues.splice(index, 1);
      saveIssues(issues);
    }
    return issues;
  }

  const { error } = await supabaseClient
    .from('issues')
    .delete()
    .eq('id', issueDbId)
    .eq('user_id', currentUser.id);

  if (error) throw error;
  return await loadIssuesFromDB();
}

// ============================================
// Calendar Events Functions
// ============================================

async function loadCalendarEventsFromDB() {
  if (!currentUser) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('calendar_events')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('date', { ascending: true });

  if (error) throw error;

  // Transform to match existing format
  return data.map(e => ({
    id: e.id,
    title: e.title,
    description: e.notes || '',
    date: e.date,
    endDate: e.date,
    time: e.time,
    endTime: e.end_time,
    isAllDay: !e.time,
    category: e.category || 'default',
    color: e.color || '#3b82f6',
    location: '',
    attendees: [],
    reminders: [30],
    recurrence: e.is_recurring_instance ? 'weekly' : 'none',
    recurrenceEnd: null,
    isRecurring: e.is_recurring_instance || false,
    recurringId: e.recurring_id,
    status: 'confirmed',
    visibility: 'default',
    notes: e.notes || '',
    attachments: [],
    created: e.created_at,
    updated: e.updated_at,
    conferenceLink: '',
    guestsCanModify: false,
    priority: e.priority || 'medium',
    duration: e.duration,
    projectId: e.project_id || null,
    spaceId: e.space_id || null,
    assignmentId: e.assignment_id || null,
    location: e.location || ''
  }));
}

async function saveCalendarEventToDB(eventData) {
  if (!currentUser) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from('calendar_events')
    .insert({
      user_id: currentUser.id,
      title: eventData.title,
      date: eventData.date,
      time: eventData.time || null,
      end_time: eventData.endTime || null,
      duration: eventData.duration || null,
      completed: eventData.completed || false,
      color: eventData.color || '#3b82f6',
      recurring_id: eventData.recurringId || null,
      is_recurring_instance: eventData.isRecurring || false,
      notes: eventData.notes || eventData.description || '',
      priority: eventData.priority || 'medium',
      notes: eventData.notes || eventData.description || '',
      priority: eventData.priority || 'medium',
      category: eventData.category || 'default',
      project_id: eventData.projectId || null,
      space_id: eventData.spaceId || null,
      assignment_id: eventData.assignmentId || null,
      location: eventData.location || null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateCalendarEventInDB(eventId, updates) {
  if (!currentUser) {
    return null;
  }

  const dbUpdates = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.date !== undefined) dbUpdates.date = updates.date;
  if (updates.time !== undefined) dbUpdates.time = updates.time;
  if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
  if (updates.duration !== undefined) dbUpdates.duration = updates.duration;
  if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  if (updates.recurringId !== undefined) dbUpdates.recurring_id = updates.recurringId;
  if (updates.isRecurring !== undefined) dbUpdates.is_recurring_instance = updates.isRecurring;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.description !== undefined) dbUpdates.notes = updates.description;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId;
  if (updates.spaceId !== undefined) dbUpdates.space_id = updates.spaceId;
  if (updates.assignmentId !== undefined) dbUpdates.assignment_id = updates.assignmentId;
  if (updates.location !== undefined) dbUpdates.location = updates.location;

  const { error } = await supabaseClient
    .from('calendar_events')
    .update(dbUpdates)
    .eq('id', eventId)
    .eq('user_id', currentUser.id);

  if (error) throw error;
  return await loadCalendarEventsFromDB();
}

async function deleteCalendarEventFromDB(eventId) {
  if (!currentUser) {
    return [];
  }

  const { error } = await supabaseClient
    .from('calendar_events')
    .delete()
    .eq('id', eventId)
    .eq('user_id', currentUser.id);

  if (error) throw error;
  return await loadCalendarEventsFromDB();
}

async function deleteRecurringEventsFromDB(recurringId) {
  if (!currentUser) {
    return [];
  }

  const { error } = await supabaseClient
    .from('calendar_events')
    .delete()
    .eq('recurring_id', recurringId)
    .eq('user_id', currentUser.id);

  if (error) throw error;
  return await loadCalendarEventsFromDB();
}

// ============================================
// Documents Functions
// ============================================

async function loadDocsFromDB() {
  if (!currentUser) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('docs')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return data.map(d => ({
    id: d.id,
    title: d.title,
    content: d.content,
    spaceId: d.space_id,
    isFavorite: d.is_favorite || false,
    sharedWith: d.shared_with || [],
    createdAt: d.created_at,
    updatedAt: d.updated_at
  }));
}

async function saveDocToDB(docData) {
  if (!currentUser) {
    console.error('❌ saveDocToDB: No current user');
    return null;
  }

  console.log('💾 saveDocToDB: Saving doc:', { 
    title: docData.title, 
    contentLength: docData.content?.length || 0,
    spaceId: docData.spaceId,
    userId: currentUser.id 
  });

  const insertData = {
    user_id: currentUser.id,
    title: docData.title || 'Untitled',
    content: docData.content || '',
    space_id: docData.spaceId || null
  };

  const { data, error } = await supabaseClient
    .from('docs')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('❌ saveDocToDB: Database error:', error);
    throw error;
  }

  console.log('✅ saveDocToDB: Doc saved successfully:', data.id);
  return {
    id: data.id,
    title: data.title,
    content: data.content,
    spaceId: data.space_id,
    isFavorite: data.is_favorite || false,
    sharedWith: data.shared_with || [],
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

async function updateDocInDB(docId, updates) {
  if (!currentUser) {
    console.error('❌ updateDocInDB: No current user');
    return null;
  }

  const dbUpdates = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.content !== undefined) dbUpdates.content = updates.content;
  if (updates.spaceId !== undefined) dbUpdates.space_id = updates.spaceId;
  if (updates.isFavorite !== undefined) dbUpdates.is_favorite = updates.isFavorite;
  if (updates.shared_with !== undefined) dbUpdates.shared_with = updates.shared_with;

  console.log('🔧 updateDocInDB: Updating doc:', { 
    docId, 
    updates: dbUpdates,
    userId: currentUser.id 
  });

  const { data, error } = await supabaseClient
    .from('docs')
    .update(dbUpdates)
    .eq('id', docId)
    .eq('user_id', currentUser.id)
    .select();

  if (error) {
    console.error('❌ updateDocInDB: Database error:', error);
    throw error;
  }
  
  console.log('✅ updateDocInDB: Doc updated successfully:', data?.length || 0, 'rows affected');
  return await loadDocsFromDB();
}

async function deleteDocFromDB(docId) {
  if (!currentUser) {
    return [];
  }

  const { error } = await supabaseClient
    .from('docs')
    .delete()
    .eq('id', docId)
    .eq('user_id', currentUser.id);

  if (error) throw error;
  return await loadDocsFromDB();
}

// ============================================
// Excels/Spreadsheets Functions
// ============================================

async function loadExcelsFromDB() {
  if (!currentUser) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('excels')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return data.map(e => ({
    id: e.id,
    title: e.title,
    data: e.data,
    spaceId: e.space_id,
    isFavorite: e.is_favorite || false,
    sharedWith: e.shared_with || [],
    createdAt: e.created_at,
    updatedAt: e.updated_at
  }));
}

async function saveExcelToDB(excelData) {
  if (!currentUser) {
    return null;
  }

  const insertData = {
    user_id: currentUser.id,
    title: excelData.title || 'Untitled Spreadsheet',
    data: excelData.data || [],
    space_id: excelData.spaceId || null
  };

  const { data, error } = await supabaseClient
    .from('excels')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    title: data.title,
    data: data.data,
    spaceId: data.space_id,
    isFavorite: data.is_favorite || false,
    sharedWith: data.shared_with || [],
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

async function updateExcelInDB(excelId, updates) {
  if (!currentUser) {
    return null;
  }

  const dbUpdates = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.data !== undefined) dbUpdates.data = updates.data;
  if (updates.spaceId !== undefined) dbUpdates.space_id = updates.spaceId;
  if (updates.isFavorite !== undefined) dbUpdates.is_favorite = updates.isFavorite;
  if (updates.shared_with !== undefined) dbUpdates.shared_with = updates.shared_with;

  console.log('🔧 Updating excel in DB:', { excelId, dbUpdates });

  const { data, error } = await supabaseClient
    .from('excels')
    .update(dbUpdates)
    .eq('id', excelId)
    .eq('user_id', currentUser.id)
    .select();

  if (error) {
    console.error('❌ Excel update error:', error);
    throw error;
  }
  
  console.log('🔧 Excel update result:', data);
  return await loadExcelsFromDB();
}

async function deleteExcelFromDB(excelId) {
  if (!currentUser) {
    return [];
  }

  const { error } = await supabaseClient
    .from('excels')
    .delete()
    .eq('id', excelId)
    .eq('user_id', currentUser.id);

  if (error) throw error;
  return await loadExcelsFromDB();
}

// ============================================
// Drafts Functions
// ============================================

async function loadDraftsFromDB() {
  if (!currentUser) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('drafts')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  
  return data.map(d => ({
    id: d.id,
    title: d.title,
    content: d.content,
    type: d.type || 'note',
    spaceId: d.space_id,
    tags: d.tags || [],
    metadata: d.metadata || {},
    sharedWith: d.shared_with || [],
    createdAt: d.created_at,
    updatedAt: d.updated_at
  }));
}

async function saveDraftToDB(draftData) {
  if (!currentUser) {
    console.error('❌ saveDraftToDB: No current user');
    return null;
  }

  console.log('💾 saveDraftToDB: Saving draft:', { 
    title: draftData.title, 
    type: draftData.type || 'note',
    contentLength: draftData.content?.length || 0,
    spaceId: draftData.spaceId,
    userId: currentUser.id 
  });

  const { data, error } = await supabaseClient
    .from('drafts')
    .insert({
      user_id: currentUser.id,
      title: draftData.title || 'Untitled Draft',
      content: draftData.content || '',
      type: draftData.type || 'note',
      space_id: draftData.spaceId || null,
      tags: draftData.tags || [],
      metadata: draftData.metadata || {},
      shared_with: draftData.sharedWith || []
    })
    .select()
    .single();

  if (error) {
    console.error('❌ saveDraftToDB: Database error:', error);
    throw error;
  }

  console.log('✅ saveDraftToDB: Draft saved successfully:', data.id);
  return {
    id: data.id,
    title: data.title,
    content: data.content,
    type: data.type || 'note',
    spaceId: data.space_id,
    isFavorite: data.is_favorite || false,
    tags: data.tags || [],
    metadata: data.metadata || {},
    sharedWith: data.shared_with || [],
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

async function updateDraftInDB(draftId, updates) {
  if (!currentUser) {
    return null;
  }

  const updateData = {
    updated_at: new Date().toISOString()
  };

  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.content !== undefined) updateData.content = updates.content;
  if (updates.type !== undefined) updateData.type = updates.type;
  if (updates.spaceId !== undefined) updateData.space_id = updates.spaceId;
  if (updates.tags !== undefined) updateData.tags = updates.tags;
  if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
  if (updates.sharedWith !== undefined) updateData.shared_with = updates.sharedWith;

  const { data, error } = await supabaseClient
    .from('drafts')
    .update(updateData)
    .eq('id', draftId)
    .eq('user_id', currentUser.id)
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    title: data.title,
    content: data.content,
    type: data.type || 'note',
    spaceId: data.space_id,
    isFavorite: data.is_favorite || false,
    tags: data.tags || [],
    metadata: data.metadata || {},
    sharedWith: data.shared_with || [],
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

async function deleteDraftFromDB(draftId) {
  if (!currentUser) {
    return false;
  }

  const { error } = await supabaseClient
    .from('drafts')
    .delete()
    .eq('id', draftId)
    .eq('user_id', currentUser.id);

  if (error) throw error;
  return true;
}

// ============================================
// Shared Content Functions
// ============================================

async function loadSharedDocsFromDB() {
  if (!currentUser) {
    return [];
  }

  console.log('🔍 Loading shared docs for user:', currentUser.email);

  // Query docs shared with the current user
  // Use raw filter to properly pass JSONB containment with escaped JSON
  const { data, error } = await supabaseClient
    .from('docs')
    .select('*')
    .neq('user_id', currentUser.id)
    .filter('shared_with', 'cs', `[{"email":"${currentUser.email}"}]`)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Failed to load shared docs:', error);
    // Try alternative: cast shared_with to text and use ilike
    const { data: fallbackData, error: fallbackError } = await supabaseClient
      .from('docs')
      .select('*')
      .filter('shared_with::text', 'like', `%${currentUser.email}%`);
    
    if (fallbackError) {
      console.error('Fallback query also failed:', fallbackError);
      return [];
    }
    
    console.log('🔄 Using fallback query, found docs:', fallbackData.length);
    return fallbackData.map(doc => ({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      spaceId: doc.space_id,
      isFavorite: doc.is_favorite,
      sharedWith: doc.shared_with,
      sharedBy: doc.user_id,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at
    }));
  }

  console.log('🔄 Found shared docs:', data.length);
  return data.map(doc => ({
    id: doc.id,
    title: doc.title,
    content: doc.content,
    spaceId: doc.space_id,
    isFavorite: doc.is_favorite,
    sharedWith: doc.shared_with,
    sharedBy: doc.user_id,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at
  }));
}

async function loadSharedExcelsFromDB() {
  if (!currentUser) {
    return [];
  }

  console.log('🔍 Loading shared excels for user:', currentUser.email);

  // Query excels shared with the current user
  const { data, error } = await supabaseClient
    .from('excels')
    .select('*')
    .neq('user_id', currentUser.id)
    .filter('shared_with', 'cs', `[{"email":"${currentUser.email}"}]`)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Failed to load shared excels:', error);
    // Try alternative: cast shared_with to text and use ilike
    const { data: fallbackData, error: fallbackError } = await supabaseClient
      .from('excels')
      .select('*')
      .filter('shared_with::text', 'like', `%${currentUser.email}%`);
    
    if (fallbackError) {
      console.error('Fallback query also failed:', fallbackError);
      return [];
    }
    
    console.log('🔄 Using fallback query for excels, found:', fallbackData.length);
    return fallbackData.map(excel => ({
      id: excel.id,
      title: excel.title,
      data: excel.data,
      spaceId: excel.space_id,
      isFavorite: excel.is_favorite,
      sharedWith: excel.shared_with,
      sharedBy: excel.user_id,
      createdAt: excel.created_at,
      updatedAt: excel.updated_at
    }));
  }

  console.log('🔄 Found shared excels:', data.length);
  return data.map(excel => ({
    id: excel.id,
    title: excel.title,
    data: excel.data,
    spaceId: excel.space_id,
    isFavorite: excel.is_favorite,
    sharedWith: excel.shared_with,
    sharedBy: excel.user_id,
    createdAt: excel.created_at,
    updatedAt: excel.updated_at
  }));
}

// ============================================
// Spaces Functions
// ============================================

async function loadSpacesFromDB() {
  if (!currentUser) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('spaces')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map(s => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
    description: s.description,
    dueDate: s.due_date,
    linkedProject: s.linked_project,
    colorTag: s.color_tag,
    members: s.members || [],
    checklist: s.checklist || [],
    createdAt: s.created_at,
    updatedAt: s.updated_at
  }));
}

async function saveSpaceToDB(spaceData) {
  if (!currentUser) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from('spaces')
    .insert({
      user_id: currentUser.id,
      name: spaceData.name,
      icon: spaceData.icon || 'folder',
      description: spaceData.description || '',
      due_date: spaceData.dueDate || null,
      linked_project: spaceData.linkedProject || null,
      color_tag: spaceData.colorTag || 'none',
      members: spaceData.members || [],
      checklist: spaceData.checklist || []
    })
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    icon: data.icon,
    description: data.description,
    dueDate: data.due_date,
    linkedProject: data.linked_project,
    colorTag: data.color_tag,
    members: data.members || [],
    checklist: data.checklist || [],
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

async function updateSpaceInDB(spaceId, updates) {
  if (!currentUser) {
    return null;
  }

  const dbUpdates = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
  if (updates.linkedProject !== undefined) dbUpdates.linked_project = updates.linkedProject;
  if (updates.colorTag !== undefined) dbUpdates.color_tag = updates.colorTag;
  if (updates.members !== undefined) dbUpdates.members = updates.members;
  if (updates.checklist !== undefined) dbUpdates.checklist = updates.checklist;

  const { error } = await supabaseClient
    .from('spaces')
    .update(dbUpdates)
    .eq('id', spaceId)
    .eq('user_id', currentUser.id);

  if (error) throw error;
  return await loadSpacesFromDB();
}

async function deleteSpaceFromDB(spaceId) {
  if (!currentUser) {
    return [];
  }

  const { error } = await supabaseClient
    .from('spaces')
    .delete()
    .eq('id', spaceId)
    .eq('user_id', currentUser.id);

  if (error) throw error;
  return await loadSpacesFromDB();
}

// ============================================
// Data Migration (localStorage to Supabase)
// ============================================

async function migrateLocalDataToSupabase() {
  if (!currentUser) {
    console.warn('Cannot migrate: user not authenticated');
    return;
  }

  try {
    // Migrate projects
    const localProjects = loadProjects();
    for (const project of localProjects) {
      await saveProjectToDB(project);
    }

    // Migrate backlog tasks
    const localBacklog = loadBacklogTasks();
    for (const task of localBacklog) {
      await addBacklogTaskToDB(task.title);
    }

    // Migrate issues
    const localIssues = loadIssues();
    for (const issue of localIssues) {
      await addIssueToDB(issue);
    }

    // Migrate calendar events
    const localEvents = JSON.parse(localStorage.getItem('layerCalendarEvents') || '[]');
    for (const event of localEvents) {
      await saveCalendarEventToDB(event);
    }

    // Migrate docs
    const localDocs = JSON.parse(localStorage.getItem('layerDocs') || '[]');
    for (const doc of localDocs) {
      await saveDocToDB(doc);
    }

    // Migrate excels
    const localExcels = JSON.parse(localStorage.getItem('layerExcels') || '[]');
    for (const excel of localExcels) {
      await saveExcelToDB(excel);
    }

    // Migrate drafts
    const localDrafts = JSON.parse(localStorage.getItem('layerDrafts') || '[]');
    for (const draft of localDrafts) {
      await saveDraftToDB(draft);
    }

    // Migrate spaces
    const localSpaces = JSON.parse(localStorage.getItem('layerSpaces') || '[]');
    for (const space of localSpaces) {
      await saveSpaceToDB(space);
    }

    // Migrate preferences
    const theme = localStorage.getItem('layerTheme');
    const panelWidth = localStorage.getItem('layerLeftPanelWidth');
    if (theme || panelWidth) {
      await saveUserPreferences({
        theme: theme || 'dark',
        left_panel_width: parseInt(panelWidth) || 280
      });
    }

    console.log('Migration complete!');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Export for use in other files
window.LayerDB = {
  // Auth
  initAuth,
  signUp,
  signIn,
  signInWithGoogle,
  signOut,
  getCurrentUser,
  refreshUser,
  isAuthenticated,

  // Profile
  getProfile,
  updateProfile,
  ensureUserProfile,
  addTeamMemberToProject, // Legacy - use addProjectMemberByEmail instead
  removeTeamMemberFromProject, // Legacy - use removeProjectMember instead
  fixMissingProfiles,

  // Preferences
  getUserPreferences,
  saveUserPreferences,

  // Projects (updated with membership support)
  loadProjects: loadProjectsFromDB,
  saveProject: saveProjectToDB,
  updateProject: updateProjectInDB,
  deleteProject: deleteProjectFromDB,
  getProjectById,
  getProfileById,

  // Project Members (NEW)
  getProjectMembers,
  addProjectMember: addProjectMemberByEmail,
  removeProjectMember,
  leaveProject,
  transferOwnership: transferProjectOwnership,

  // Realtime Subscriptions (NEW)
  subscribeToUserProjects,
  unsubscribeFromProjects,

  // Backlog
  loadBacklogTasks: loadBacklogTasksFromDB,
  addBacklogTask: addBacklogTaskToDB,
  toggleBacklogTask: toggleBacklogTaskInDB,
  updateBacklogTask: updateBacklogTaskInDB,
  deleteBacklogTask: deleteBacklogTaskFromDB,

  // Issues
  loadIssues: loadIssuesFromDB,
  addIssue: addIssueToDB,
  updateIssue: updateIssueInDB,
  deleteIssue: deleteIssueFromDB,

  // Calendar Events
  loadCalendarEvents: loadCalendarEventsFromDB,
  saveCalendarEvent: saveCalendarEventToDB,
  updateCalendarEvent: updateCalendarEventInDB,
  deleteCalendarEvent: deleteCalendarEventFromDB,
  deleteRecurringEvents: deleteRecurringEventsFromDB,

  // Documents
  loadDocs: loadDocsFromDB,
  saveDoc: saveDocToDB,
  updateDoc: updateDocInDB,
  deleteDoc: deleteDocFromDB,

  // Excels/Spreadsheets
  loadExcels: loadExcelsFromDB,
  saveExcel: saveExcelToDB,
  updateExcel: updateExcelInDB,
  deleteExcel: deleteExcelFromDB,

  // Drafts
  loadDrafts: loadDraftsFromDB,
  saveDraft: saveDraftToDB,
  updateDraft: updateDraftInDB,
  deleteDraft: deleteDraftFromDB,

  // Shared Content
  loadSharedDocs: loadSharedDocsFromDB,
  loadSharedExcels: loadSharedExcelsFromDB,

  // Spaces
  loadSpaces: loadSpacesFromDB,
  saveSpace: saveSpaceToDB,
  updateSpace: updateSpaceInDB,
  deleteSpace: deleteSpaceFromDB,

  // Migration
  migrateLocalDataToSupabase,

  // Presence tracking
  updatePresence: async (isOnline, watchingProjectId = null) => {
    if (!currentUser) return;
    const { error } = await supabaseClient
      .from('user_presence')
      .upsert({
        user_id: currentUser.id,
        is_online: isOnline,
        last_seen: new Date().toISOString(),
        watching_project_id: watchingProjectId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });
    if (error) throw error;
  },

  getProjectMembersPresence: async (projectId) => {
    if (!currentUser) return [];
    const { data, error } = await supabaseClient
      .from('user_presence')
      .select(`
        *,
        profiles!user_presence_user_id_fkey(email, name)
      `)
      .eq('watching_project_id', projectId)
      .eq('is_online', true);
    if (error) {
      // Fallback if join fails
      const { data: fallbackData, error: fallbackError } = await supabaseClient
        .from('user_presence')
        .select('*')
        .eq('watching_project_id', projectId)
        .eq('is_online', true);
      if (fallbackError) throw fallbackError;
      return fallbackData || [];
    }
    return data || [];
  },

  // Get presence for a list of user IDs
  getUsersPresence: async (userIds) => {
    if (!userIds || userIds.length === 0) return [];

    // De-duplicate
    const uniqueIds = [...new Set(userIds)];

    const { data, error } = await supabaseClient
      .from('user_presence')
      .select('*')
      .in('user_id', uniqueIds);

    if (error) {
      console.error('Error fetching user presence:', error);
      return [];
    }
    return data || [];
  },

  checkInvitationAndJoin: async (projectId) => {
    if (!currentUser) return { success: false, error: 'Not authenticated' };

    try {
      // 1. Check if user is already a member
      const { data: project, error: projectError } = await supabaseClient
        .from('projects')
        .select('id, team_members')
        .eq('id', projectId)
        .maybeSingle();

      if (projectError) throw projectError;
      if (!project) return { success: false, error: 'Project not found' };

      const teamMembers = project.team_members || [];
      if (Array.isArray(teamMembers) && teamMembers.includes(currentUser.email)) {
        return { success: true, message: 'Already a member' };
      }

      // 2. Check for pending invitation
      const { data: invitations, error: inviteError } = await supabaseClient
        .from('project_invitations')
        .select('*')
        .eq('project_id', projectId)
        .eq('invitee_email', currentUser.email)
        .in('status', ['sent', 'pending']); // Allow pending too in case email service is slow

      if (inviteError) throw inviteError;

      if (invitations && invitations.length > 0) {
        // 3. Join project: update team_members and invitation status
        const updatedMembers = Array.isArray(teamMembers) ? [...teamMembers, currentUser.email] : [currentUser.email];

        const { error: updateError } = await supabaseClient
          .from('projects')
          .update({ team_members: updatedMembers })
          .eq('id', projectId);

        if (updateError) throw updateError;

        // Update all pending/sent invitations for this user and project to 'accepted'
        await supabaseClient
          .from('project_invitations')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('project_id', projectId)
          .eq('invitee_email', currentUser.email);

        return { success: true, message: 'Joined project successfully' };
      }

      return { success: false, error: 'No valid invitation found for your email' };
    } catch (error) {
      console.error('Error joining project:', error);
      return { success: false, error: error.message };
    }
  },

  // Send welcome email to user
  sendWelcomeEmail: async (userEmail, userName) => {
    if (!userEmail) return;

    try {
      // Log for debugging
      console.log('Sending welcome email to:', userEmail);

      // Get the current user session token for authentication
      const { data: { session }, error } = await supabaseClient.auth.getSession();

      if (error || !session) {
        console.error('No active session found:', error?.message);
        return false;
      }

      const token = session.access_token;

      // Call the Supabase Edge Function to send welcome email
      const { data, error: invokeError } = await supabaseClient.functions.invoke('send-welcome-email', {
        body: {
          email: userEmail,
          name: userName || 'User'
        },
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });

      if (invokeError) {
        console.error('Failed to send welcome email:', invokeError);
        return false;
      }

      console.log('Welcome email sent successfully:', data);
      return true;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return false;
    }
  },

  // Followers/Following functions
  followUser: async (followingUserId) => {
    if (!currentUser) throw new Error('Not authenticated');

    const { data, error } = await supabaseClient
      .from('followers')
      .insert({
        follower_id: currentUser.id,
        following_id: followingUserId,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Follow user by email (for the Add People feature)
  followUserByEmail: async (followingEmail) => {
    if (!currentUser) throw new Error('Not authenticated');

    console.log('Following user by email:', followingEmail);
    console.log('Current user:', currentUser.email);

    // First, get the user ID from email (case-insensitive)
    let { data: userData, error: userError } = await supabaseClient
      .from('profiles')
      .select('id')
      .ilike('email', followingEmail)  // ilike for case-insensitive matching
      .single();

    // If user doesn't exist in profiles, we need to handle this
    if (userError || !userData) {
      console.log('User not found in profiles, checking if they exist in auth.users...');

      // Check if user exists in auth.users (case-insensitive)
      const { data: authUsers, error: authError } = await supabaseClient
        .from('users')
        .select('id, email')
        .ilike('email', followingEmail);  // ilike for case-insensitive matching

      if (authError || !authUsers || authUsers.length === 0) {
        console.error('User does not exist in the system:', followingEmail);
        // Provide more helpful error message
        throw new Error(`User with email ${followingEmail} does not have an account. Please ask them to sign up first or check if the email is spelled correctly.`);
      }

      const authUser = authUsers[0];
      console.log('Found auth user:', authUser);

      // Try to create profile for this user
      const { error: createProfileError } = await supabaseClient
        .from('profiles')
        .insert({
          id: authUser.id,
          email: authUser.email
        })
        .select()
        .single();

      if (createProfileError) {
        console.error('Failed to create profile:', createProfileError);
        // If we can't create profile, try to get existing profile one more time
        const { data: retryProfile, error: retryError } = await supabaseClient
          .from('profiles')
          .select('id')
          .eq('id', authUser.id)
          .single();

        if (retryError || !retryProfile) {
          throw new Error(`Could not create or find profile for user ${followingEmail}. Please contact support.`);
        }
        userData = retryProfile;
      } else {
        console.log('Created profile for user');
        userData = { id: authUser.id };
      }
    }

    console.log('Found user ID:', userData.id);

    // Check if already following
    const { data: existingFollow } = await supabaseClient
      .from('followers')
      .select('id')
      .match({
        follower_id: currentUser.id,
        following_id: userData.id
      })
      .maybeSingle();

    if (existingFollow) {
      throw new Error('You are already following this user');
    }

    // Create follow request
    const { data, error } = await supabaseClient
      .from('followers')
      .insert({
        follower_id: currentUser.id,
        following_id: userData.id,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  unfollowUser: async (followingUserId) => {
    if (!currentUser) throw new Error('Not authenticated');

    const { error } = await supabaseClient
      .from('followers')
      .delete()
      .match({
        follower_id: currentUser.id,
        following_id: followingUserId
      });

    if (error) throw error;
    return true;
  },

  acceptFollowRequest: async (followerUserId) => {
    if (!currentUser) throw new Error('Not authenticated');

    const { data, error } = await supabaseClient
      .from('followers')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .match({
        follower_id: followerUserId,
        following_id: currentUser.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  rejectFollowRequest: async (followerUserId) => {
    if (!currentUser) throw new Error('Not authenticated');

    const { error } = await supabaseClient
      .from('followers')
      .delete()
      .match({
        follower_id: followerUserId,
        following_id: currentUser.id,
        status: 'pending'
      });

    if (error) throw error;
    return true;
  },

  // Unfollow a user (remove accepted follower relationship)
  unfollowUser: async (userId) => {
    if (!currentUser) throw new Error('Not authenticated');

    console.log('🔍 Unfollowing user:', userId, 'Current user:', currentUser.id);

    // Delete the follower relationship where current user is either follower or following
    const { error } = await supabaseClient
      .from('followers')
      .delete()
      .or(`and(follower_id.eq.${currentUser.id},following_id.eq.${userId}),and(follower_id.eq.${userId},following_id.eq.${currentUser.id})`);

    if (error) {
      console.error('❌ Error unfollowing user:', error);
      throw error;
    }

    console.log('✅ Successfully unfollowed user');
    return true;
  },

  getFollowers: async () => {
    if (!currentUser) return [];

    console.log('🔍 Fetching followers for user:', currentUser.id, currentUser.email);

    // Try with profile joins first
    let { data, error } = await supabaseClient
      .from('followers')
      .select(`
        *,
        follower_profile:profiles!followers_follower_id_fkey(email, name, avatar_url),
        following_profile:profiles!followers_following_id_fkey(email, name, avatar_url)
      `)
      .or(`following_id.eq.${currentUser.id},follower_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: false });

    // If profile joins fail, try without them
    if (error) {
      console.warn('⚠️ Profile joins failed, trying without joins:', error.message);

      const fallback = await supabaseClient
        .from('followers')
        .select('*')
        .or(`following_id.eq.${currentUser.id},follower_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });

      if (fallback.error) {
        console.error('❌ Fallback query also failed:', fallback.error);
        throw fallback.error;
      }

      data = fallback.data;

      // Manually fetch profiles for each follower
      if (data && data.length > 0) {
        const userIds = new Set();
        data.forEach(f => {
          if (f.follower_id) userIds.add(f.follower_id);
          if (f.following_id) userIds.add(f.following_id);
        });

        const { data: profiles } = await supabaseClient
          .from('profiles')
          .select('id, email, name, avatar_url')
          .in('id', Array.from(userIds));

        // Attach profiles to followers
        if (profiles) {
          data = data.map(f => ({
            ...f,
            follower_profile: profiles.find(p => p.id === f.follower_id),
            following_profile: profiles.find(p => p.id === f.following_id)
          }));
        }
      }
    }

    console.log('✅ Fetched followers:', data);
    return data || [];
  },

  getPendingFollowRequests: async () => {
    if (!currentUser) return [];

    console.log('🔍 Fetching pending follow requests for user:', currentUser.id, currentUser.email);

    // Try with profile joins first
    let { data, error } = await supabaseClient
      .from('followers')
      .select(`
        *,
        follower_profile:profiles!followers_follower_id_fkey(email, name, avatar_url)
      `)
      .match({
        following_id: currentUser.id,
        status: 'pending'
      })
      .order('created_at', { ascending: false });

    // If profile joins fail, try without them
    if (error) {
      console.warn('⚠️ Profile joins failed for pending requests, trying without joins:', error.message);

      const fallback = await supabaseClient
        .from('followers')
        .select('*')
        .match({
          following_id: currentUser.id,
          status: 'pending'
        })
        .order('created_at', { ascending: false });

      if (fallback.error) {
        console.error('❌ Fallback query for pending requests failed:', fallback.error);
        throw fallback.error;
      }

      data = fallback.data;

      // Manually fetch profiles for each follower
      if (data && data.length > 0) {
        const followerIds = data.map(f => f.follower_id).filter(Boolean);

        if (followerIds.length > 0) {
          const { data: profiles } = await supabaseClient
            .from('profiles')
            .select('id, email, name, avatar_url')
            .in('id', followerIds);

          // Attach profiles to followers
          if (profiles) {
            data = data.map(f => ({
              ...f,
              follower_profile: profiles.find(p => p.id === f.follower_id)
            }));
          }
        }
      }
    }

    console.log('✅ Found pending follow requests:', data);
    return data || [];
  },

  // Team invitation functions
  sendTeamInvitation: async (inviteeEmail, teamName, message = '') => {
    if (!currentUser) throw new Error('Not authenticated');

    const { data, error } = await supabaseClient
      .from('team_invitations')
      .insert({
        inviter_id: currentUser.id,
        invitee_email: inviteeEmail,
        team_name: teamName,
        message: message,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getTeamInvitations: async () => {
    if (!currentUser) return [];

    const { data, error } = await supabaseClient
      .from('team_invitations')
      .select(`
        *,
        inviter_profile:profiles!team_invitations_inviter_id_fkey(email, name, avatar_url)
      `)
      .or(`inviter_id.eq.${currentUser.id},invitee_email.eq.${currentUser.email}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  acceptTeamInvitation: async (invitationId) => {
    if (!currentUser) throw new Error('Not authenticated');

    const { data, error } = await supabaseClient
      .from('team_invitations')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .match({ id: invitationId })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  rejectTeamInvitation: async (invitationId) => {
    if (!currentUser) throw new Error('Not authenticated');

    const { error } = await supabaseClient
      .from('team_invitations')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .match({ id: invitationId });

    if (error) throw error;
    return true;
  },

  // ============================================
  // Team Chat Functions
  // ============================================

  // Send a team chat message
  sendTeamMessage: async (channelId, channelType, message, recipientId = null, messageType = 'text') => {
    if (!currentUser) throw new Error('Not authenticated');

    const { data, error } = await supabaseClient
      .from('team_chat_messages')
      .insert({
        user_id: currentUser.id,
        channel_id: channelId,
        channel_type: channelType,
        recipient_id: recipientId,
        message: message,
        message_type: messageType
      })
      .select(`
        *,
        user_profile:profiles!team_chat_messages_user_id_fkey(email, name, avatar_url)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  // Get team chat messages for a channel
  getTeamMessages: async (channelId, channelType = 'channel') => {
    if (!currentUser) return [];

    let query = supabaseClient
      .from('team_chat_messages')
      .select(`
        *,
        user_profile:profiles!team_chat_messages_user_id_fkey(email, name, avatar_url)
      `)
      .eq('channel_id', channelId)
      .eq('channel_type', channelType)
      .order('created_at', { ascending: true });

    // For DMs, also include messages where current user is the recipient
    if (channelType === 'dm') {
      query = query.or(`channel_id.eq.${channelId},recipient_id.eq.${currentUser.id}`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  // Subscribe to team chat messages for realtime updates
  subscribeToTeamMessages: (channelId, callback) => {
    if (!currentUser) return null;

    const channel = supabaseClient
      .channel(`team_chat_${channelId}`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_chat_messages',
          filter: `channel_id=eq.${channelId}`
        },
        payload => {
          callback(payload);
        }
      )
      .subscribe();

    return channel;
  },

  // Subscribe to ALL messages where current user is recipient (for new DMs)
  subscribeToUserMessages: (callback) => {
    if (!currentUser) return null;

    const channel = supabaseClient
      .channel(`user_dm_${currentUser.id}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_chat_messages',
          filter: `recipient_id=eq.${currentUser.id}`
        },
        payload => {
          callback(payload);
        }
      )
      .subscribe();

    return channel;
  },

  // Unsubscribe from team chat messages
  unsubscribeFromTeamMessages: channel => {
    if (channel) {
      supabaseClient.removeChannel(channel);
    }
  },

  // Edit a team chat message
  editTeamMessage: async (messageId, newMessage) => {
    if (!currentUser) throw new Error('Not authenticated');

    const { data, error } = await supabaseClient
      .from('team_chat_messages')
      .update({
        message: newMessage,
        is_edited: true,
        edited_at: new Date().toISOString()
      })
      .match({
        id: messageId,
        user_id: currentUser.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete a team chat message
  deleteTeamMessage: async (messageId) => {
    if (!currentUser) throw new Error('Not authenticated');

    const { error } = await supabaseClient
      .from('team_chat_messages')
      .delete()
      .match({
        id: messageId,
        user_id: currentUser.id
      });

    if (error) throw error;
    return true;
  },

  // Clear all messages in a DM chat
  clearDMChat: async (channelId) => {
    if (!currentUser) throw new Error('Not authenticated');

    // We delete all messages in this channel
    // NOTE: This deletes them for BOTH users if RLS allows it.
    // Ideally we'd just hide them, but the request was "clear and delete all chat... completely"

    try {
      const { error } = await supabaseClient
        .from('team_chat_messages')
        .delete()
        .eq('channel_id', channelId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error clearing DM chat:', error);
      throw error;
    }
  },

  // ============================================
  // Realtime Subscriptions for other tables
  // ============================================

  // Subscribe to projects for realtime updates
  subscribeToProjects: (callback) => {
    if (!currentUser) return null;

    const channel = supabaseClient
      .channel('projects_changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects'
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();

    return channel;
  },

  // Subscribe to calendar events for realtime updates
  subscribeToCalendarEvents: (callback) => {
    if (!currentUser) return null;

    const channel = supabaseClient
      .channel('calendar_events_changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_events'
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();

    return channel;
  },

  // Subscribe to docs for realtime updates
  subscribeToDocs: (callback) => {
    if (!currentUser) return null;

    const channel = supabaseClient
      .channel('docs_changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'docs'
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();

    return channel;
  },

  // Subscribe to followers for realtime updates
  subscribeToFollowers: (callback) => {
    if (!currentUser) return null;

    const channel = supabaseClient
      .channel('followers_changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'followers',
          filter: `follower_id=eq.${currentUser.id}`
        },
        (payload) => {
          callback(payload);
        }
      )
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'followers',
          filter: `following_id=eq.${currentUser.id}`
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();

    return channel;
  },

  // Unsubscribe from followers
  unsubscribeFromFollowers: (channel) => {
    if (channel) {
      supabaseClient.removeChannel(channel);
    }
  },


  // Email notification function
  sendFollowerNotificationEmail: async (toEmail, followerName, action = 'follow') => {
    if (!toEmail) return;

    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession();

      if (error || !session) {
        console.error('No active session found:', error?.message);
        return false;
      }

      const token = session.access_token;

      const { data, error: invokeError } = await supabaseClient.functions.invoke('send-follower-notification', {
        body: {
          email: toEmail,
          follower_name: followerName,
          action: action
        },
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });

      if (invokeError) {
        console.error('Failed to send follower notification email:', invokeError);
        return false;
      }

      console.log('Follower notification email sent successfully:', data);
      return true;
    } catch (error) {
      console.error('Error sending follower notification email:', error);
      return false;
    }
  },

  // ============================================
  // Profile Cache & Batch Fetch (for team collaboration)
  // ============================================
  _profileCache: {},

  fetchProfiles: async function (userIds) {
    const cache = window.LayerDB._profileCache;
    const uniqueIds = [...new Set(userIds.filter(id => id && !cache[id]))];
    if (uniqueIds.length > 0) {
      try {
        const { data, error } = await supabaseClient
          .from('profiles')
          .select('id, email, name, avatar_url')
          .in('id', uniqueIds);
        if (!error && data) {
          data.forEach(p => { cache[p.id] = p; });
        }
      } catch (e) {
        console.error('Failed to fetch profiles:', e);
      }
    }
    return userIds.map(id => cache[id] || null);
  },

  getCachedProfile: function (userId) {
    return window.LayerDB._profileCache[userId] || null;
  },

  // Direct Supabase access
  supabase: supabaseClient,

  // ============================================
  // Team Chat Functions
  // ============================================

  // Get recent DMs for current user
  // Get direct messages (conversations)
  getDirectMessages: async function () {
    if (!currentUser) return [];

    try {
      // 1. Get raw messages where user is sender or recipient (NO JOIN to avoid schema errors)
      const { data: messages, error } = await supabaseClient
        .from('team_chat_messages')
        .select('*')
        .eq('channel_type', 'dm')
        .or(`user_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const conversations = new Map();

      // 2. Process messages to find unique partners
      for (const msg of messages) {
        // Determine partner ID (the other person)
        const partnerId = msg.user_id === currentUser.id ? msg.recipient_id : msg.user_id;

        // Skip if self-chat or missing partner
        if (!partnerId) continue;

        if (!conversations.has(partnerId)) {
          conversations.set(partnerId, {
            id: msg.channel_id,
            type: 'dm', // Crucial for selectTeamChannel
            partnerId: partnerId,
            lastMessage: msg,
            partnerId: partnerId,
            lastMessage: msg,
            unread: 0
          });
        }

        // Count unread (if recipient is current user and not read)
        // Checking explicitly for false in case is_read is null/missing
        if (msg.recipient_id === currentUser.id && msg.is_read === false) {
          const convo = conversations.get(partnerId);
          convo.unread++;
        }
      }

      const dmList = Array.from(conversations.values());
      const partnerIds = dmList.map(d => d.partnerId);

      // 3. Fetch profiles for all partners (Application-side Join)
      if (partnerIds.length > 0) {
        const { data: profiles } = await supabaseClient
          .from('profiles')
          .select('id, name, avatar_url, email')
          .in('id', partnerIds);

        if (profiles) {
          dmList.forEach(dm => {
            const profile = profiles.find(p => p.id === dm.partnerId);
            if (profile) {
              dm.name = profile.name || profile.email;
              dm.avatar = profile.avatar_url;
              dm.email = profile.email;
              dm.status = 'offline'; // Status will be updated by realtime separately
            } else {
              dm.name = 'Unknown User';
              dm.avatar = null;
              dm.email = '';
            }
          });
        }
      }

      return dmList;

    } catch (error) {
      console.error('Error fetching DMs:', error);
      return [];
    }
  },

  // Get messages for a specific channel
  getChatMessages: async function (channelId) {
    if (!currentUser) return [];

    try {
      // 1. Fetch raw messages (NO JOIN)
      let query = supabaseClient
        .from('team_chat_messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (channelId.startsWith('dm-')) {
        query = query.eq('channel_id', channelId);
      } else {
        query = query.eq('channel_id', channelId);
      }

      const { data: messages, error } = await query;
      if (error) throw error;

      // 2. Fetch profiles for senders (Application-side Join)
      // Extract unique user IDs from messages
      const userIds = [...new Set(messages.map(m => m.user_id))];

      if (userIds.length > 0) {
        const { data: profiles } = await supabaseClient
          .from('profiles')
          .select('id, name, avatar_url, email')
          .in('id', userIds);

        if (profiles) {
          // Create a map for fast lookup
          const profileMap = new Map(profiles.map(p => [p.id, p]));

          // Attach profile data to messages manually
          messages.forEach(msg => {
            const profile = profileMap.get(msg.user_id);
            if (profile) {
              msg.user_profile = {
                name: profile.name,
                avatar_url: profile.avatar_url
              };
            }
          });
        }
      }

      return messages;

    } catch (error) {
      console.error('Error fetching chat messages:', error);
      return [];
    }
  },

  // Send a chat message
  sendTeamMessage: async function (channelId, channelType, message, recipientId) {
    if (!currentUser) throw new Error('Not authenticated');

    console.log('📤 Supabase: Sending message...', {
      channelId,
      channelType,
      messageLength: message?.length,
      recipientId,
      userId: currentUser.id
    });

    try {
      const messageData = {
        channel_id: channelId,
        channel_type: channelType,
        message: message,
        recipient_id: recipientId
        // is_read removed to prevent schema cache errors if column is missing
      };

      console.log('📤 Supabase: Inserting message data:', messageData);

      const { data, error } = await supabaseClient
        .from('team_chat_messages')
        .insert({
          ...messageData,
          user_id: currentUser.id, // Current user is always the sender
          created_at: new Date().toISOString()
        })
        .select() // Select ALL raw columns, but NO joins
        .single();

      if (error) {
        console.error('❌ Supabase: Insert error:', error);
        throw error;
      }

      console.log('✅ Supabase: Message inserted successfully:', data);

      // Manually attach user profile for immediate UI update (optimistic-like)
      // This avoids needing the DB join to return it
      if (data) {
        data.user_profile = {
          name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email,
          avatar_url: currentUser.user_metadata?.avatar_url
        };
      }

      return data;
    } catch (error) {
      console.error('❌ Supabase: Error sending message:', error);
      console.error('❌ Supabase: Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
  },

  // Mark channel messages as read
  markChatAsRead: async function (channelId) {
    if (!currentUser) return;

    try {
      const { error } = await supabaseClient
        .from('team_chat_messages')
        .update({ is_read: true })
        .eq('channel_id', channelId)
        .eq('recipient_id', currentUser.id)
        .eq('is_read', false);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking chat read:', error);
    }
  },

  // Mark a specific message as read
  markMessageAsRead: async function (messageId) {
    if (!currentUser) return;

    try {
      const { error } = await supabaseClient
        .from('team_chat_messages')
        .update({ is_read: true })
        .eq('id', messageId)
        .eq('recipient_id', currentUser.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  },

  // Folder functions
  loadFolders: loadFoldersFromDB,
  saveFolder: saveFolderToDB,
  deleteFolder: deleteFolderFromDB
};

// ============================================
// Folder Functions
// ============================================

async function saveFolderToDB(folderData) {
  console.log('Saving folder to DB, currentUser:', currentUser);
  
  if (!currentUser) {
    console.warn('No user logged in, saving to localStorage only');
    // Even if no user, still save to localStorage as fallback
    return saveFolderToLocalStorage(folderData);
  }

  try {
    console.log('Inserting folder data:', {
      user_id: currentUser.id,
      id: folderData.id,
      name: folderData.name,
      description: folderData.description || '',
      color: folderData.color || '#6366f1',
      icon: folderData.icon || 'folder',
      space_id: folderData.space_id || null,
      is_favorite: folderData.is_favorite || false,
      created_at: folderData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const { data, error } = await supabaseClient
      .from('folders')
      .upsert({
        user_id: currentUser.id,
        id: folderData.id,
        name: folderData.name,
        description: folderData.description || '',
        color: folderData.color || '#6366f1',
        icon: folderData.icon || 'folder',
        space_id: folderData.space_id || null,
        is_favorite: folderData.is_favorite || false,
        created_at: folderData.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    console.log('Folder saved to DB successfully:', data);
    return data;
  } catch (error) {
    console.error('Error saving folder to DB:', error);
    console.error('Error details:', error.message, error.details);
    // Fallback to localStorage
    return saveFolderToLocalStorage(folderData);
  }
}

async function loadFoldersFromDB() {
  console.log('Loading folders from DB, currentUser:', currentUser);
  
  if (!currentUser) {
    console.warn('No user logged in, loading from localStorage');
    return loadFoldersFromLocalStorage();
  }

  try {
    const { data, error } = await supabaseClient
      .from('folders')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error loading folders:', error);
      throw error;
    }
    
    console.log('Folders loaded from DB:', data);
    return data || [];
  } catch (error) {
    console.error('Error loading folders from DB:', error);
    console.error('Error details:', error.message, error.details);
    // Fallback to localStorage
    return loadFoldersFromLocalStorage();
  }
}

async function deleteFolderFromDB(folderId) {
  if (!currentUser) {
    console.warn('No user logged in, deleting from localStorage only');
    return deleteFolderFromLocalStorage(folderId);
  }

  try {
    const { error } = await supabaseClient
      .from('folders')
      .delete()
      .eq('id', folderId)
      .eq('user_id', currentUser.id);

    if (error) throw error;
    
    console.log('Folder deleted from DB:', folderId);
    return true;
  } catch (error) {
    console.error('Error deleting folder from DB:', error);
    // Fallback to localStorage
    return deleteFolderFromLocalStorage(folderId);
  }
}

// LocalStorage fallback functions
function saveFolderToLocalStorage(folderData) {
  let folders = JSON.parse(localStorage.getItem('folders') || '[]');
  const existingIndex = folders.findIndex(f => f.id === folderData.id);
  
  if (existingIndex >= 0) {
    folders[existingIndex] = { ...folders[existingIndex], ...folderData };
  } else {
    folders.push(folderData);
  }
  
  localStorage.setItem('folders', JSON.stringify(folders));
  return folderData;
}

function loadFoldersFromLocalStorage() {
  return JSON.parse(localStorage.getItem('folders') || '[]');
}

function deleteFolderFromLocalStorage(folderId) {
  let folders = JSON.parse(localStorage.getItem('folders') || '[]');
  folders = folders.filter(f => f.id !== folderId);
  localStorage.setItem('folders', JSON.stringify(folders));
  return true;
}

// Export functions for use in other files
window.saveFolderToDB = saveFolderToDB;
window.loadFoldersFromDB = loadFoldersFromDB;
window.deleteFolderFromDB = deleteFolderFromDB;

// ============================================
// Bookmark Functions (Database Storage)
// ============================================

// Save bookmark to database
async function saveBookmarkToDB(bookmarkData) {
  if (!currentUser || !currentUser.id) {
    console.error('User not authenticated for bookmark save');
    return null;
  }

  try {
    const { data, error } = await supabaseClient
      .from('bookmarks')
      .insert({
        ...bookmarkData,
        user_id: currentUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    
    console.log('Bookmark saved to DB:', data.id);
    return data;
  } catch (error) {
    console.error('Error saving bookmark to DB:', error);
    return null;
  }
}

// Load bookmarks from database
async function loadBookmarksFromDB() {
  if (!currentUser || !currentUser.id) {
    console.log('User not authenticated for bookmark load');
    return [];
  }

  try {
    const { data, error } = await supabaseClient
      .from('bookmarks')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    console.log('Bookmarks loaded from DB:', data.length, 'items');
    return data || [];
  } catch (error) {
    console.error('Error loading bookmarks from DB:', error);
    return [];
  }
}

// Update bookmark in database
async function updateBookmarkInDB(bookmarkId, updates) {
  if (!currentUser || !currentUser.id) {
    console.error('User not authenticated for bookmark update');
    return null;
  }

  try {
    const { data, error } = await supabaseClient
      .from('bookmarks')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookmarkId)
      .eq('user_id', currentUser.id)
      .select()
      .single();

    if (error) throw error;
    
    console.log('Bookmark updated in DB:', bookmarkId);
    return data;
  } catch (error) {
    console.error('Error updating bookmark in DB:', error);
    return null;
  }
}

// Delete bookmark from database
async function deleteBookmarkFromDB(bookmarkId) {
  if (!currentUser || !currentUser.id) {
    console.error('User not authenticated for bookmark deletion');
    return false;
  }

  try {
    const { error } = await supabaseClient
      .from('bookmarks')
      .delete()
      .eq('id', bookmarkId)
      .eq('user_id', currentUser.id);

    if (error) throw error;
    
    console.log('Bookmark deleted from DB:', bookmarkId);
    return true;
  } catch (error) {
    console.error('Error deleting bookmark from DB:', error);
    return false;
  }
}

// Export bookmark functions for use in other files
window.saveBookmarkToDB = saveBookmarkToDB;
window.loadBookmarksFromDB = loadBookmarksFromDB;
window.updateBookmarkInDB = updateBookmarkInDB;
window.deleteBookmarkFromDB = deleteBookmarkFromDB;
