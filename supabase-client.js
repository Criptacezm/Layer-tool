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
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/layer.html`,
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
    
    console.log('Google OAuth redirect initiated');
    return data;
  } catch (error) {
    console.error('Failed to initiate Google sign in:', error);
    throw error;
  }
}

async function signOut() {
  console.log('Signing out...');
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
  currentUser = null;
  currentSession = null;
  console.log('Sign out complete');
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
    .or(`user_id.eq.${currentUser.id},team_members.cs.["${currentUser.email}"]`)
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
    updates: p.updates,
    milestones: p.milestones || {},
    gripDiagram: p.grip_diagram || null,
    tasks: p.tasks || [],
    teamMembers: p.team_members || []
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
      updates: [{ actor: 'You', action: 'Project created', time: 'just now' }],
      milestones: projectData.milestones || {}
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
    guestsCanSeeOtherGuests: true,
    projectId: null,
    spaceId: null,
    completed: e.completed || false,
    priority: e.priority || 'medium',
    duration: e.duration
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
      category: eventData.category || 'default'
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
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  
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
    createdAt: d.created_at,
    updatedAt: d.updated_at
  }));
}

async function saveDocToDB(docData) {
  if (!currentUser) {
    return null;
  }
  
  const { data, error } = await supabaseClient
    .from('docs')
    .insert({
      user_id: currentUser.id,
      title: docData.title || 'Untitled',
      content: docData.content || '',
      space_id: docData.spaceId || null,
      is_favorite: docData.isFavorite || false
    })
    .select()
    .single();
  
  if (error) throw error;
  return {
    id: data.id,
    title: data.title,
    content: data.content,
    spaceId: data.space_id,
    isFavorite: data.is_favorite || false,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

async function updateDocInDB(docId, updates) {
  if (!currentUser) {
    return null;
  }
  
  const dbUpdates = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.content !== undefined) dbUpdates.content = updates.content;
  if (updates.spaceId !== undefined) dbUpdates.space_id = updates.spaceId;
  if (updates.isFavorite !== undefined) dbUpdates.is_favorite = updates.isFavorite;
  
  const { error } = await supabaseClient
    .from('docs')
    .update(dbUpdates)
    .eq('id', docId)
    .eq('user_id', currentUser.id);
  
  if (error) throw error;
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

async function toggleDocFavoriteInDB(docId, isFavorite) {
  if (!currentUser) {
    return null;
  }
  
  const { error } = await supabaseClient
    .from('docs')
    .update({ is_favorite: isFavorite, updated_at: new Date().toISOString() })
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
    createdAt: e.created_at,
    updatedAt: e.updated_at
  }));
}

async function saveExcelToDB(excelData) {
  if (!currentUser) {
    return null;
  }
  
  const { data, error } = await supabaseClient
    .from('excels')
    .insert({
      user_id: currentUser.id,
      title: excelData.title || 'Untitled Spreadsheet',
      data: excelData.data || [],
      space_id: excelData.spaceId || null,
      is_favorite: excelData.isFavorite || false
    })
    .select()
    .single();
  
  if (error) throw error;
  return {
    id: data.id,
    title: data.title,
    data: data.data,
    spaceId: data.space_id,
    isFavorite: data.is_favorite || false,
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
  
  const { error } = await supabaseClient
    .from('excels')
    .update(dbUpdates)
    .eq('id', excelId)
    .eq('user_id', currentUser.id);
  
  if (error) throw error;
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

async function toggleExcelFavoriteInDB(excelId, isFavorite) {
  if (!currentUser) {
    return null;
  }
  
  const { error } = await supabaseClient
    .from('excels')
    .update({ is_favorite: isFavorite, updated_at: new Date().toISOString() })
    .eq('id', excelId)
    .eq('user_id', currentUser.id);
  
  if (error) throw error;
  return await loadExcelsFromDB();
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
  toggleDocFavorite: toggleDocFavoriteInDB,
  
  // Excels/Spreadsheets
  loadExcels: loadExcelsFromDB,
  saveExcel: saveExcelToDB,
  updateExcel: updateExcelInDB,
  deleteExcel: deleteExcelFromDB,
  toggleExcelFavorite: toggleExcelFavoriteInDB,
  
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

  checkInvitationAndJoin: async (projectId) => {
    if (!currentUser) return { success: false, error: 'Not authenticated' };

    try {
      // 1. Check if user is already a member
      const { data: project, error: projectError } = await supabaseClient
        .from('projects')
        .select('id, team_members')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      const teamMembers = project.team_members || [];
      if (teamMembers.includes(currentUser.email)) {
        return { success: true, message: 'Already a member' };
      }

      // 2. Check for pending invitation
      const { data: invitations, error: inviteError } = await supabaseClient
        .from('project_invitations')
        .select('*')
        .eq('project_id', projectId)
        .eq('invitee_email', currentUser.email)
        .eq('status', 'sent');

      if (inviteError) throw inviteError;

      if (invitations && invitations.length > 0) {
        // 3. Join project: update team_members and invitation status
        const updatedMembers = [...teamMembers, currentUser.email];
        
        const { error: updateError } = await supabaseClient
          .from('projects')
          .update({ team_members: updatedMembers })
          .eq('id', projectId);

        if (updateError) throw updateError;

        // Update all pending invitations for this user and project to 'accepted'
        await supabaseClient
          .from('project_invitations')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('project_id', projectId)
          .eq('invitee_email', currentUser.email);

        return { success: true, message: 'Joined project successfully' };
      }

      return { success: false, error: 'No invitation found' };
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
      const response = await fetch('/supabase/functions/send-welcome-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          email: userEmail,
          name: userName || 'User'
        })
      });
      
      if (!response.ok) {
        console.error('Failed to send welcome email:', await response.text());
        return false;
      }
      
      console.log('Welcome email sent successfully');
      return true;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return false;
    }
  },
  
  // Direct Supabase access
  supabase: supabaseClient
};
