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
// Projects - Use Supabase when authenticated
// ============================================

// Get projects from localStorage (internal use only)
function loadProjectsFromLocal() {
  try {
    const data = localStorage.getItem(PROJECTS_KEY);
    if (data) {
      const projects = JSON.parse(data);
      return projects.map(project => {
        // Migration: ensure flowchart exists
        if (!project.flowchart) {
          project.flowchart = { nodes: [], edges: [] };
          if (project.description && project.description.trim()) {
            project.flowchart.nodes.push({
              id: 'migrated-text',
              type: 'flowNode',
              position: { x: 50, y: 50 },
              data: { label: project.description.trim(), headerColor: '#89b4fa' }
            });
          }
        }
        project.columns = project.columns || [
          { title: 'To Do', tasks: [] },
          { title: 'In Progress', tasks: [] },
          { title: 'Done', tasks: [] },
        ];
        return project;
      });
    }
  } catch (e) {
    console.error('Failed to load projects:', e);
  }
  return [];
}

// Main loadProjects function - uses cached data from localStorage
// Data is synced to localStorage after DB operations
function loadProjects() {
  // When authenticated, we use the cached localStorage data that was
  // populated from the database during login/data load
  return loadProjectsFromLocal();
}

function saveProjects(projects) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Failed to save projects:', e);
  }
}

// Enhanced save that always syncs to DB when authenticated
async function saveProjectsWithSync(projects) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    
    // Always sync all projects to DB if authenticated
    if (window.LayerDB && window.LayerDB.isAuthenticated()) {
      // Sync each project that has an ID (exists in DB)
      for (const project of projects) {
        if (project.id) {
          try {
            await window.LayerDB.updateProject(project.id, {
              name: project.name,
              description: project.description,
              status: project.status,
              startDate: project.startDate,
              targetDate: project.targetDate,
              flowchart: project.flowchart,
              columns: project.columns,
              updates: project.updates,
              milestones: project.milestones,
              grip_diagram: project.gripDiagram,
              tasks: project.tasks
            });
          } catch (error) {
            console.error('Failed to sync project to DB:', project.id, error);
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to save projects:', e);
  }
}

async function addProject(projectData) {
  // Require authentication - no localStorage fallback
  if (!window.LayerDB || !window.LayerDB.isAuthenticated()) {
    showToast('Please sign in to create projects', 'error');
    return null;
  }
  
  try {
    const newProject = await window.LayerDB.saveProject(projectData);
    // Refresh local cache
    const projects = await window.LayerDB.loadProjects();
    saveProjects(projects);
    return newProject;
  } catch (error) {
    console.error('Failed to save project to database:', error);
    showToast('Failed to save project', 'error');
    return null;
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
      return updatedProjects;
    } catch (error) {
      console.error('Failed to delete project from database:', error);
      showToast('Failed to delete project', 'error');
    }
  }
  
  return projects;
}

// ============================================
// Project Tasks
// ============================================
async function addTaskToColumn(projectIndex, columnIndex, title) {
  const projects = loadProjects();
  if (projects[projectIndex] && projects[projectIndex].columns[columnIndex]) {
    projects[projectIndex].columns[columnIndex].tasks.push({
      id: generateId('TASK'),
      title: title,
      done: false,
      createdAt: new Date().toISOString()
    });
    saveProjects(projects);
    
    // Sync to DB if authenticated
    if (window.LayerDB && window.LayerDB.isAuthenticated() && projects[projectIndex].id) {
      try {
        await window.LayerDB.updateProject(projects[projectIndex].id, { columns: projects[projectIndex].columns });
      } catch (error) {
        console.error('Failed to sync task to database:', error);
      }
    }
  }
  return projects;
}

async function toggleTaskDone(projectIndex, columnIndex, taskIndex) {
  const projects = loadProjects();
  const task = projects[projectIndex]?.columns[columnIndex]?.tasks[taskIndex];
  if (task) {
    task.done = !task.done;
    saveProjects(projects);
    
    // Sync to DB if authenticated
    if (window.LayerDB && window.LayerDB.isAuthenticated() && projects[projectIndex].id) {
      try {
        await window.LayerDB.updateProject(projects[projectIndex].id, { columns: projects[projectIndex].columns });
      } catch (error) {
        console.error('Failed to sync task toggle to database:', error);
      }
    }
  }
  return projects;
}

async function deleteTask(projectIndex, columnIndex, taskIndex) {
  const projects = loadProjects();
  if (projects[projectIndex]?.columns[columnIndex]?.tasks[taskIndex]) {
    projects[projectIndex].columns[columnIndex].tasks.splice(taskIndex, 1);
    saveProjects(projects);
    
    // Sync to DB if authenticated
    if (window.LayerDB && window.LayerDB.isAuthenticated() && projects[projectIndex].id) {
      try {
        await window.LayerDB.updateProject(projects[projectIndex].id, { columns: projects[projectIndex].columns });
      } catch (error) {
        console.error('Failed to sync task deletion to database:', error);
      }
    }
  }
  return projects;
}

// ============================================
// Column Management
// ============================================
async function addColumnToProject(projectIndex, title) {
  const projects = loadProjects();
  if (projects[projectIndex]) {
    projects[projectIndex].columns.push({
      title: title,
      tasks: []
    });
    saveProjects(projects);
    
    // Sync to DB if authenticated
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
    saveProjects(projects);
    
    // Sync to DB if authenticated
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
    saveProjects(projects);
    
    // Sync to DB if authenticated
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
      const updatedTasks = await window.LayerDB.toggleBacklogTask(tasks[index].id);
      saveBacklogTasks(updatedTasks);
      return updatedTasks;
    } catch (error) {
      console.error('Failed to toggle backlog task in database:', error);
      showToast('Failed to update task', 'error');
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
// PDF Viewer Functions
// ============================================
let currentPdfData = null;
let currentPdfName = '';

function openPdfViewer(dataUrl, fileName) {
  currentPdfData = dataUrl;
  currentPdfName = fileName || 'document.pdf';
  
  const overlay = document.getElementById('pdfViewerOverlay');
  const frame = document.getElementById('pdfViewerFrame');
  const title = document.getElementById('pdfViewerTitle');
  
  if (overlay && frame) {
    title.textContent = currentPdfName;
    frame.src = dataUrl;
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closePdfViewer() {
  const overlay = document.getElementById('pdfViewerOverlay');
  const frame = document.getElementById('pdfViewerFrame');
  
  if (overlay) {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  }
  if (frame) {
    frame.src = '';
  }
  currentPdfData = null;
  currentPdfName = '';
}

function downloadCurrentPdf() {
  if (!currentPdfData) return;
  downloadFile(currentPdfData, currentPdfName);
}

function downloadFile(dataUrl, fileName) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Legacy function for backwards compatibility
function openPdfPreview(dataUrl, fileName) {
  openPdfViewer(dataUrl, fileName || 'document.pdf');
}

// Render file item with view and download buttons
function renderFileItem(file, fileIndex, assignmentIndex) {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage = file.type.startsWith('image/');
  const fileSize = formatFileSize(file.size);
  
  let previewHtml = '';
  let actionsHtml = '';
  
  if (isPdf) {
    previewHtml = `
      <div class="file-icon pdf-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px; color: #ef4444;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <path d="M10 12h4"/>
          <path d="M10 16h4"/>
        </svg>
      </div>
    `;
    actionsHtml = `
      <button class="btn btn-sm btn-secondary" onclick="openPdfViewer('${file.dataUrl}', '${file.name.replace(/'/g, "\\'")}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        View
      </button>
      <button class="btn btn-sm btn-primary" onclick="downloadFile('${file.dataUrl}', '${file.name.replace(/'/g, "\\'")}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download
      </button>
    `;
  } else if (isImage) {
    previewHtml = `
      <div class="file-thumbnail" style="background-image: url('${file.dataUrl}')"></div>
    `;
    actionsHtml = `
      <button class="btn btn-sm btn-secondary" onclick="openImagePreview('${file.dataUrl}', '${file.name.replace(/'/g, "\\'")}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        View
      </button>
      <button class="btn btn-sm btn-primary" onclick="downloadFile('${file.dataUrl}', '${file.name.replace(/'/g, "\\'")}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download
      </button>
    `;
  } else {
    previewHtml = `
      <div class="file-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
    `;
    actionsHtml = `
      <button class="btn btn-sm btn-primary" onclick="downloadFile('${file.dataUrl}', '${file.name.replace(/'/g, "\\'")}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download
      </button>
    `;
  }
  
  return `
    <div class="file-item">
      ${previewHtml}
      <div class="file-info">
        <span class="file-name">${file.name}</span>
        <span class="file-size">${fileSize}</span>
      </div>
      <div class="file-actions">
        ${actionsHtml}
      </div>
    </div>
  `;
}

function openImagePreview(dataUrl, fileName) {
  const content = `
    <div style="text-align: center;">
      <img src="${dataUrl}" alt="${fileName}" style="max-width: 100%; max-height: 70vh; border-radius: 8px;">
      <div style="margin-top: 16px;">
        <button class="btn btn-primary" onclick="downloadFile('${dataUrl}', '${fileName.replace(/'/g, "\\'")}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download
        </button>
      </div>
    </div>
  `;
  openModal(fileName, content);
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ============================================
// Project Updates (Comments)
// ============================================
