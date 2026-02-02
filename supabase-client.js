/* ============================================
   Layer - Supabase Client Configuration
   ============================================ */

const SUPABASE_URL = 'https://uqfnadlyrbprzxgjkvtc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxZm5hZGx5cmJwcnp4Z2prdnRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzkxNzAsImV4cCI6MjA4Mjk1NTE3MH0.12PfMd0vnsWvCXSNdkc3E02KDn46xi9XTyZ8rXNiVHs';

// Initialize Supabase client from the global supabase object (UMD build)
let supabaseClient = null;

(function initSupabaseClient() {
  try {
    // The UMD build exposes 'supabase' as a global with createClient
    if (typeof supabase !== 'undefined' && supabase.createClient) {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('Supabase client initialized successfully');
    } else {
      console.error('Supabase library not found. Make sure the Supabase CDN script is loaded before this file.');
    }
  } catch (e) {
    console.error('Failed to initialize Supabase client:', e);
  }
})();

// Current user state
let currentUser = null;
let currentSession = null;

// ============================================
// Authentication Functions
// ============================================

async function initAuth() {
  if (!supabaseClient) {
    console.error('Supabase client not initialized');
    return { user: null, session: null };
  }
  
  // Set up auth state listener
  supabaseClient.auth.onAuthStateChange((event, session) => {
    currentSession = session;
    currentUser = session?.user ?? null;
    
    // Dispatch custom event for UI updates
    window.dispatchEvent(new CustomEvent('authStateChanged', { 
      detail: { user: currentUser, session: currentSession, event } 
    }));
  });

  // Get initial session
  const { data: { session } } = await supabaseClient.auth.getSession();
  currentSession = session;
  currentUser = session?.user ?? null;
  
  return { user: currentUser, session: currentSession };
}

async function signUp(email, password, username) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin + '/layer.html',
      data: {
        username: username
      }
    }
  });
  
  if (error) throw error;
  
  // Update profile with username if signup succeeded
  if (data.user) {
    currentUser = data.user;
    currentSession = data.session;
    
    // Update the profile with username
    if (data.session) {
      await supabaseClient
        .from('profiles')
        .update({ username: username })
        .eq('id', data.user.id);
    }
  }
  
  return data;
}

async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) throw error;
  return data;
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
  currentUser = null;
  currentSession = null;
}

function getCurrentUser() {
  return currentUser;
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
// Projects Functions
// ============================================

async function loadProjectsFromDB() {
  if (!currentUser) {
    // Fall back to localStorage
    return loadProjects();
  }
  
  const { data, error } = await supabaseClient
    .from('projects')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  // Transform to match existing format
  return data.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    startDate: p.start_date,
    targetDate: p.target_date,
    flowchart: p.flowchart,
    columns: p.columns,
    updates: p.updates
  }));
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
      updates: [{ actor: 'You', action: 'Project created', time: 'just now' }]
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
  
  const { data, error } = await supabaseClient
    .from('projects')
    .update(dbUpdates)
    .eq('id', projectId)
    .eq('user_id', currentUser.id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

async function deleteProjectFromDB(projectId) {
  if (!currentUser) {
    // Fall back to localStorage
    const projects = loadProjects();
    const index = projects.findIndex(p => p.id === projectId);
    if (index !== -1) {
      return deleteProject(index);
    }
    return projects;
  }
  
  const { error } = await supabaseClient
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', currentUser.id);
  
  if (error) throw error;
  return await loadProjectsFromDB();
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
  signOut,
  getCurrentUser,
  isAuthenticated,
  
  // Profile
  getProfile,
  updateProfile,
  
  // Preferences
  getUserPreferences,
  saveUserPreferences,
  
  // Projects
  loadProjects: loadProjectsFromDB,
  saveProject: saveProjectToDB,
  updateProject: updateProjectInDB,
  deleteProject: deleteProjectFromDB,
  
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
  
  // Migration
  migrateLocalDataToSupabase,
  
  // Direct Supabase access
  supabase: supabaseClient
};
