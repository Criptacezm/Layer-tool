/* ============================================
   Layer - Data Store & Persistence
   ============================================ */

// Storage keys
const PROJECTS_KEY = 'layerProjectsData';
const BACKLOG_KEY = 'layerBacklogTasks';
const ISSUES_KEY = 'layerMyIssues';
const THEME_KEY = 'layerTheme';
const LEFT_PANEL_WIDTH_KEY = 'layerLeftPanelWidth';

// ============================================
// Left Panel Width Persistence
// ============================================
async function saveLeftPanelWidth(width) {
  try {
    localStorage.setItem(LEFT_PANEL_WIDTH_KEY, width.toString());

    // Sync to DB if authenticated
    if (window.LayerDB && window.LayerDB.isAuthenticated()) {
      await window.LayerDB.saveUserPreferences({ left_panel_width: width });
    }
  } catch (e) {
    console.error('Failed to save left panel width:', e);
  }
}

function loadLeftPanelWidth() {
  try {
    const width = localStorage.getItem(LEFT_PANEL_WIDTH_KEY);
    return width ? parseInt(width, 10) : null;
  } catch (e) {
    console.error('Failed to load left panel width:', e);
    return null;
  }
}

async function initLeftPanelResize() {
  // Load from DB if authenticated
  if (window.LayerDB && window.LayerDB.isAuthenticated()) {
    try {
      const prefs = await window.LayerDB.getUserPreferences();
      if (prefs && prefs.left_panel_width) {
        localStorage.setItem(LEFT_PANEL_WIDTH_KEY, prefs.left_panel_width.toString());
      }
    } catch (e) {
      console.error('Failed to load panel width from DB:', e);
    }
  }

  const savedWidth = loadLeftPanelWidth();
  if (savedWidth) {
    document.querySelectorAll('.tl-left-panel-clickup').forEach(panel => {
      panel.style.width = savedWidth + 'px';
    });
  }

  // Use ResizeObserver to detect manual resizing
  let resizeTimeout;
  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      if (entry.target.classList.contains('tl-left-panel-clickup')) {
        const width = Math.round(entry.contentRect.width);
        // Debounce the save to avoid too many DB calls
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          saveLeftPanelWidth(width);
        }, 500);
      }
    }
  });

  // Observe all left panels
  document.querySelectorAll('.tl-left-panel-clickup').forEach(panel => {
    observer.observe(panel);
  });
}


// ============================================
// ID Generation
// ============================================
function generateId(prefix = 'ID') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateIssueId() {
  return `LAYER-${Math.floor(1000 + Math.random() * 9000)}`;
}

// ============================================
// Projects - Supabase as Source of Truth
// ============================================

// In-memory cache for projects (backed by localStorage for sync access)
// localStorage is ONLY a read cache - never the source of truth

// Get projects from localStorage cache (for synchronous render calls)
function loadProjectsFromLocal() {
  try {
    const data = localStorage.getItem(PROJECTS_KEY);
    if (data) {
      const projects = JSON.parse(data);
      return projects.map(project => {
        project.columns = project.columns || [
          { title: 'To Do', tasks: [] },
          { title: 'In Progress', tasks: [] },
          { title: 'Done', tasks: [] },
        ];
        project.activity = project.activity || [];
        return project;
      });
    }
  } catch (e) {
    console.error('Failed to load projects from cache:', e);
  }
  return [];
}

// Main loadProjects function - reads from localStorage cache (synchronous)
function loadProjects() {
  return loadProjectsFromLocal();
}

// Update localStorage cache only (NO DB write)
function saveProjectsToCache(projects) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Failed to update projects cache:', e);
  }
}

// DEPRECATED: saveProjects now only updates cache, not DB
function saveProjects(projects) {
  saveProjectsToCache(projects);
}

// Refresh projects from DB and update localStorage cache
async function refreshProjects() {
  if (!window.LayerDB || !window.LayerDB.isAuthenticated()) {
    return loadProjects();
  }

  try {
    const projects = await window.LayerDB.loadProjects();
    saveProjectsToCache(projects);
    return projects;
  } catch (error) {
    console.error('Failed to refresh projects from DB:', error);
    return loadProjects();
  }
}

// Make refreshProjects globally available
window.refreshProjects = refreshProjects;

async function addProject(projectData) {
  // Require authentication - no localStorage fallback
  if (!window.LayerDB || !window.LayerDB.isAuthenticated()) {
    if (typeof showToast === 'function') {
      showToast('Please sign in to create projects', 'error');
    }
    return null;
  }

  try {
    // Add creator information to project data
    const currentUser = window.LayerDB.getCurrentUser();
    const projectWithCreator = {
      ...projectData,
      leader: currentUser?.user_metadata?.name || currentUser?.email?.split('@')[0] || 'Project Creator',
      userEmail: currentUser?.email,
      user_id: currentUser?.id,
      teamMembers: [currentUser?.user_metadata?.name || currentUser?.email?.split('@')[0] || 'You'] // Add creator as first team member
    };

    const newProject = await window.LayerDB.saveProject(projectWithCreator);
    // Refresh local cache from database
    const projects = await window.LayerDB.loadProjects();
    saveProjects(projects);
    console.log('Project created with leader:', projectWithCreator.leader, 'localStorage updated with', projects.length, 'projects');
    if (typeof showNotification === 'function') {
      showNotification('Project created successfully', 'success');
    }
    return newProject;
  } catch (error) {
    console.error('Failed to save project to database:', error);
    // Fallback to localStorage on error
    const projects = loadProjects();
    const currentUser = window.LayerDB?.getCurrentUser();
    const newProject = {
      ...projectData,
      id: generateId(),
      leader: currentUser?.user_metadata?.name || currentUser?.email?.split('@')[0] || 'Project Creator',
      userEmail: currentUser?.email,
      user_id: currentUser?.id,
      teamMembers: [currentUser?.user_metadata?.name || currentUser?.email?.split('@')[0] || 'You'], // Add creator as first team member
      columns: [
        { title: 'To Do', tasks: [] },
        { title: 'In Progress', tasks: [] },
        { title: 'Done', tasks: [] },
      ],
      flowchart: { nodes: [], edges: [] },
      createdAt: new Date().toISOString()
    };
    projects.push(newProject);
    saveProjects(projects);
    console.log('Project created locally with leader:', newProject.leader, 'localStorage updated with', projects.length, 'projects');
    if (typeof showNotification === 'function') {
      showNotification('Project saved locally (sync failed)', 'warning');
    }
    return newProject;
  }
}

async function updateProject(index, updates) {
  // Require authentication - no localStorage fallback
  if (!window.LayerDB || !window.LayerDB.isAuthenticated()) {
    showToast('Please sign in to update projects', 'error');
    return loadProjects();
  }

  const projects = loadProjects();

  if (projects[index]?.id) {
    try {
      await window.LayerDB.updateProject(projects[index].id, updates);
      const updatedProjects = await window.LayerDB.loadProjects();
      saveProjects(updatedProjects);
      return updatedProjects;
    } catch (error) {
      console.error('Failed to update project in database:', error);
      showToast('Failed to update project', 'error');
    }
  }

  return projects;
}

async function deleteProject(index) {
  // Require authentication - no localStorage fallback
  if (!window.LayerDB || !window.LayerDB.isAuthenticated()) {
    showToast('Please sign in to delete projects', 'error');
    return loadProjects();
  }

  const projects = loadProjects();

  if (projects[index]?.id) {
    try {
      await window.LayerDB.deleteProject(projects[index].id);
      const updatedProjects = await window.LayerDB.loadProjects();
      saveProjects(updatedProjects);
      console.log('Project deleted, localStorage updated with', updatedProjects.length, 'projects');
      if (typeof showNotification === 'function') {
        showNotification('Project deleted successfully', 'success');
      }
      return updatedProjects;
    } catch (error) {
      console.error('Failed to delete project from database:', error);
      showToast('Failed to delete project', 'error');
    }
  }

  return projects;
}

// ============================================
// Project Tasks - DB-first with task attribution
// ============================================
async function addTaskToColumn(projectIndex, columnIndex, title) {
  const projects = loadProjects();
  if (projects[projectIndex] && projects[projectIndex].columns[columnIndex]) {
    const currentUser = window.LayerDB?.getCurrentUser();
    const newTask = {
      id: generateId('TASK'),
      title: title,
      done: false,
      createdAt: new Date().toISOString(),
      created_by: currentUser?.id || null
    };
    projects[projectIndex].columns[columnIndex].tasks.push(newTask);

    // Optimistic update to cache
    saveProjectsToCache(projects);

    // Sync to DB
    if (window.LayerDB && window.LayerDB.isAuthenticated() && projects[projectIndex].id) {
      try {
        await window.LayerDB.updateProject(projects[projectIndex].id, {
          columns: projects[projectIndex].columns
        });
      } catch (error) {
        console.error('Failed to sync task to database:', error);
      }
    }
  }
  return projects;
}

async function toggleTaskDone(projectIndex, columnIndex, taskIndex) {
  const projects = loadProjects();
  const project = projects[projectIndex];
  const task = project?.columns[columnIndex]?.tasks[taskIndex];
  if (task) {
    const currentUser = window.LayerDB?.getCurrentUser();
    task.done = !task.done;

    // Add attribution
    if (task.done) {
      task.completed_by = currentUser?.id || null;
      task.completed_at = new Date().toISOString();
    } else {
      task.completed_by = null;
      task.completed_at = null;
    }

    // Add activity entry
    if (!project.activity) project.activity = [];
    project.activity.unshift({
      user_id: currentUser?.id || null,
      user_name: currentUser?.user_metadata?.name || currentUser?.email?.split('@')[0] || 'Unknown',
      action: task.done ? 'completed_task' : 'uncompleted_task',
      task_title: task.title,
      column_title: project.columns[columnIndex]?.title || '',
      timestamp: new Date().toISOString()
    });
    // Keep activity log to last 100 entries
    if (project.activity.length > 100) {
      project.activity = project.activity.slice(0, 100);
    }

    // Optimistic update to cache
    saveProjectsToCache(projects);

    // Sync to DB (don't await for snappy UX)
    if (window.LayerDB && window.LayerDB.isAuthenticated() && project.id) {
      window.LayerDB.updateProject(project.id, {
        columns: project.columns,
        activity: project.activity
      }).catch(error => {
        console.error('Failed to sync task toggle to database:', error);
      });
    }
  }
  return projects;
}

async function deleteTask(projectIndex, columnIndex, taskIndex) {
  const projects = loadProjects();
  const project = projects[projectIndex];
  if (project?.columns[columnIndex]?.tasks[taskIndex]) {
    const deletedTask = project.columns[columnIndex].tasks[taskIndex];
    project.columns[columnIndex].tasks.splice(taskIndex, 1);

    // Add activity entry
    const currentUser = window.LayerDB?.getCurrentUser();
    if (!project.activity) project.activity = [];
    project.activity.unshift({
      user_id: currentUser?.id || null,
      user_name: currentUser?.user_metadata?.name || currentUser?.email?.split('@')[0] || 'Unknown',
      action: 'deleted_task',
      task_title: deletedTask.title,
      timestamp: new Date().toISOString()
    });

    // Optimistic update to cache
    saveProjectsToCache(projects);

    // Sync to DB
    if (window.LayerDB && window.LayerDB.isAuthenticated() && project.id) {
      try {
        await window.LayerDB.updateProject(project.id, {
          columns: project.columns,
          activity: project.activity
        });
      } catch (error) {
        console.error('Failed to sync task deletion to database:', error);
      }
    }
  }
  return projects;
}

// ============================================
// Column Management - DB-first
// ============================================
async function addColumnToProject(projectIndex, title) {
  const projects = loadProjects();
  if (projects[projectIndex]) {
    projects[projectIndex].columns.push({ title: title, tasks: [] });
    saveProjectsToCache(projects);

    if (window.LayerDB && window.LayerDB.isAuthenticated() && projects[projectIndex].id) {
      try {
        await window.LayerDB.updateProject(projects[projectIndex].id, { columns: projects[projectIndex].columns });
      } catch (error) {
        console.error('Failed to sync column to database:', error);
      }
    }
  }
  return projects;
}

async function deleteColumnFromProject(projectIndex, columnIndex) {
  const projects = loadProjects();
  if (projects[projectIndex]?.columns[columnIndex]) {
    projects[projectIndex].columns.splice(columnIndex, 1);
    saveProjectsToCache(projects);

    if (window.LayerDB && window.LayerDB.isAuthenticated() && projects[projectIndex].id) {
      try {
        await window.LayerDB.updateProject(projects[projectIndex].id, { columns: projects[projectIndex].columns });
      } catch (error) {
        console.error('Failed to sync column deletion to database:', error);
      }
    }
  }
  return projects;
}

async function renameColumn(projectIndex, columnIndex, newTitle) {
  const projects = loadProjects();
  if (projects[projectIndex]?.columns[columnIndex]) {
    projects[projectIndex].columns[columnIndex].title = newTitle;
    saveProjectsToCache(projects);

    if (window.LayerDB && window.LayerDB.isAuthenticated() && projects[projectIndex].id) {
      try {
        await window.LayerDB.updateProject(projects[projectIndex].id, { columns: projects[projectIndex].columns });
      } catch (error) {
        console.error('Failed to sync column rename to database:', error);
      }
    }
  }
  return projects;
}

// ============================================
// Backlog Tasks - Use Supabase when authenticated
// ============================================

// Get backlog tasks from localStorage (internal use only)
function loadBacklogTasksFromLocal() {
  try {
    const data = localStorage.getItem(BACKLOG_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load backlog tasks:', e);
  }
  return [];
}

// Main loadBacklogTasks - uses cached localStorage data
function loadBacklogTasks() {
  return loadBacklogTasksFromLocal();
}

function saveBacklogTasks(tasks) {
  try {
    localStorage.setItem(BACKLOG_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save backlog tasks:', e);
  }
}

async function addBacklogTask(title) {
  // Require authentication - no localStorage fallback
  if (!window.LayerDB || !window.LayerDB.isAuthenticated()) {
    showToast('Please sign in to add tasks', 'error');
    return loadBacklogTasks();
  }

  try {
    const tasks = await window.LayerDB.addBacklogTask(title);
    saveBacklogTasks(tasks);
    return tasks;
  } catch (error) {
    console.error('Failed to add backlog task to database:', error);
    showToast('Failed to add task', 'error');
    return loadBacklogTasks();
  }
}

async function toggleBacklogTask(index) {
  // Require authentication - no localStorage fallback
  if (!window.LayerDB || !window.LayerDB.isAuthenticated()) {
    showToast('Please sign in to update tasks', 'error');
    return loadBacklogTasks();
  }

  const tasks = loadBacklogTasks();

  if (tasks[index]?.id) {
    try {
      // Optimistic update
      tasks[index].done = !tasks[index].done;
      saveBacklogTasks(tasks);

      // Sync to DB in background
      window.LayerDB.toggleBacklogTask(tasks[index].id)
        .catch(error => {
          console.error('Failed to toggle backlog task in database:', error);
          showToast('Failed to sync task update', 'error');
        });

      return tasks;
    } catch (error) {
      console.error('Failed to toggle backlog task:', error);
    }
  }

  return tasks;
}

async function updateBacklogTask(index, title) {
  // Require authentication - no localStorage fallback
  if (!window.LayerDB || !window.LayerDB.isAuthenticated()) {
    showToast('Please sign in to update tasks', 'error');
    return loadBacklogTasks();
  }

  const tasks = loadBacklogTasks();

  if (tasks[index]?.id) {
    try {
      const updatedTasks = await window.LayerDB.updateBacklogTask(tasks[index].id, title);
      saveBacklogTasks(updatedTasks);
      return updatedTasks;
    } catch (error) {
      console.error('Failed to update backlog task in database:', error);
      showToast('Failed to update task', 'error');
    }
  }

  return tasks;
}

async function deleteBacklogTask(index) {
  // Require authentication - no localStorage fallback
  if (!window.LayerDB || !window.LayerDB.isAuthenticated()) {
    showToast('Please sign in to delete tasks', 'error');
    return loadBacklogTasks();
  }

  const tasks = loadBacklogTasks();

  if (tasks[index]?.id) {
    try {
      const updatedTasks = await window.LayerDB.deleteBacklogTask(tasks[index].id);
      saveBacklogTasks(updatedTasks);
      return updatedTasks;
    } catch (error) {
      console.error('Failed to delete backlog task from database:', error);
      showToast('Failed to delete task', 'error');
    }
  }

  return tasks;
}

// ============================================
// Issues - Use Supabase when authenticated
// ============================================

// Get issues from localStorage (internal use only)
function loadIssuesFromLocal() {
  try {
    const data = localStorage.getItem(ISSUES_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load issues:', e);
  }
  return [];
}

// Main loadIssues - uses cached localStorage data
function loadIssues() {
  return loadIssuesFromLocal();
}

function saveIssues(issues) {
  try {
    localStorage.setItem(ISSUES_KEY, JSON.stringify(issues));
  } catch (e) {
    console.error('Failed to save issues:', e);
  }
}

async function addIssue(issueData) {
  // Require authentication - no localStorage fallback
  if (!window.LayerDB || !window.LayerDB.isAuthenticated()) {
    showToast('Please sign in to create issues', 'error');
    return loadIssues();
  }

  try {
    const issues = await window.LayerDB.addIssue(issueData);
    saveIssues(issues);
    return issues;
  } catch (error) {
    console.error('Failed to add issue to database:', error);
    showToast('Failed to create issue', 'error');
    return loadIssues();
  }
}

async function deleteIssue(index) {
  // Require authentication - no localStorage fallback
  if (!window.LayerDB || !window.LayerDB.isAuthenticated()) {
    showToast('Please sign in to delete issues', 'error');
    return loadIssues();
  }

  const issues = loadIssues();

  const issue = issues[index];
  if (issue) {
    try {
      // Use dbId (the actual database UUID) if available, otherwise fallback to id
      const deleteId = issue.dbId || issue.id;
      const updatedIssues = await window.LayerDB.deleteIssue(deleteId);
      saveIssues(updatedIssues);
      return updatedIssues;
    } catch (error) {
      console.error('Failed to delete issue from database:', error);
      showToast('Failed to delete issue', 'error');
    }
  }

  return issues;
}

// ============================================
// Theme
// ============================================
function loadTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

// ============================================
// Activity
// ============================================
function getRecentActivity(projects) {
  const activity = [];

  projects.slice().reverse().forEach(project => {
    activity.push({
      type: 'project',
      message: `Created project "${project.name}"`,
      time: project.startDate || new Date().toISOString(),
    });
  });

  return activity
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 15);
}

// ============================================
// Formatters
// ============================================
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return 'just now';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'invalid time';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(dateStr);
}

function capitalizeStatus(status) {
  if (!status) return 'Unknown';
  return status
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getProgressColor(percentage) {
  if (percentage >= 90) return 'hsl(142, 71%, 45%)';
  if (percentage >= 60) return 'hsl(217, 91%, 60%)';
  if (percentage >= 30) return 'hsl(48, 96%, 53%)';
  return 'hsl(0, 84%, 60%)';
}

function getStatusColor(status) {
  const colors = {
    'todo': 'hsl(215, 16%, 47%)',
    'in-progress': 'hsl(217, 91%, 60%)',
    'review': 'hsl(271, 91%, 65%)',
    'done': 'hsl(142, 71%, 45%)',
    'backlog': 'hsl(215, 14%, 45%)',
  };
  return colors[status?.toLowerCase()] || colors.todo;
}

function calculateProgress(columns) {
  let total = 0;
  let completed = 0;

  columns.forEach(col => {
    total += col.tasks.length;
    completed += col.tasks.filter(t => t.done).length;
  });

  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, percentage };
}

// ============================================
// Message Reactions Storage
// ============================================

// Save message reactions to localStorage
function saveMessageReactions(messageId, reactions) {
  try {
    const key = `layer_message_reactions_${messageId}`;
    localStorage.setItem(key, JSON.stringify(reactions));
  } catch (e) {
    console.error('Failed to save message reactions:', e);
  }
}

// Load message reactions from localStorage
function loadMessageReactions(messageId) {
  try {
    const key = `layer_message_reactions_${messageId}`;
    const reactions = localStorage.getItem(key);
    return reactions ? JSON.parse(reactions) : {};
  } catch (e) {
    console.error('Failed to load message reactions:', e);
    return {};
  }
}

// Clear message reactions from localStorage
function clearMessageReactions(messageId) {
  try {
    const key = `layer_message_reactions_${messageId}`;
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Failed to clear message reactions:', e);
  }
}

// Get all message reactions for a channel
function getChannelMessageReactions(channelId) {
  try {
    const key = `layer_channel_reactions_${channelId}`;
    const reactions = localStorage.getItem(key);
    return reactions ? JSON.parse(reactions) : {};
  } catch (e) {
    console.error('Failed to load channel message reactions:', e);
    return {};
  }
}

// Save all message reactions for a channel
function saveChannelMessageReactions(channelId, reactions) {
  try {
    const key = `layer_channel_reactions_${channelId}`;
    localStorage.setItem(key, JSON.stringify(reactions));
  } catch (e) {
    console.error('Failed to save channel message reactions:', e);
  }
}
