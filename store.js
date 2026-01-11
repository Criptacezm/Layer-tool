/* ============================================
   Layer - Data Store & Persistence
   With Supabase Integration
   ============================================ */

// ============================================
// Supabase Configuration
// ============================================
const SUPABASE_URL = 'https://uqfnadlyrbprzxgjkvtc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxZm5hZGx5cmJwcnp4Z2prdnRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzkxNzAsImV4cCI6MjA4Mjk1NTE3MH0.12PfMd0vnsWvCXSNdkc3E02KDn46xi9XTyZ8rXNiVHs';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Current user state
let currentUser = null;

// ============================================
// Auth Functions
// ============================================
async function supabaseSignUp(email, password, username) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          username: username
        }
      }
    });
    
    if (error) throw error;
    
    return { success: true, data: data, needsConfirmation: !data.session };
  } catch (error) {
    console.error('Sign up error:', error);
    return { success: false, error: error.message };
  }
}

async function supabaseSignIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (error) throw error;
    
    currentUser = data.user;
    return { success: true, data: data };
  } catch (error) {
    console.error('Sign in error:', error);
    return { success: false, error: error.message };
  }
}

async function supabaseSignOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    currentUser = null;
    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    return { success: false, error: error.message };
  }
}

async function supabaseGetSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    
    if (session) {
      currentUser = session.user;
    }
    return { success: true, session: session };
  } catch (error) {
    console.error('Get session error:', error);
    return { success: false, error: error.message };
  }
}

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event);
  if (session) {
    currentUser = session.user;
    // Update UI when user signs in
    if (typeof updateUserDisplay === 'function') {
      updateUserDisplay({
        username: session.user.user_metadata?.username || session.user.email.split('@')[0],
        email: session.user.email
      });
    }
  } else {
    currentUser = null;
  }
});

function getCurrentUser() {
  return currentUser;
}

function isLoggedIn() {
  return currentUser !== null;
}

// ============================================
// Storage keys (for offline/fallback)
// ============================================
const PROJECTS_KEY = 'layerProjectsData';
const BACKLOG_KEY = 'layerBacklogTasks';
const ISSUES_KEY = 'layerMyIssues';
const THEME_KEY = 'layerTheme';
const ASSIGNMENTS_KEY = 'layerAssignments';

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
// Projects
// ============================================
function loadProjects() {
  try {
    const data = localStorage.getItem(PROJECTS_KEY);
    if (data) {
      const projects = JSON.parse(data);
      return projects.map(project => {
        // Migration: ensure flowchart exists
        if (!project.flowchart) {
          project.flowchart = { nodes: [], edges: [] };
          // Optional: migrate old description to a text node
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

function saveProjects(projects) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Failed to save projects:', e);
  }
}

function addProject(projectData) {
  const projects = loadProjects();
  const newProject = {
    id: generateId('PROJ'),
    name: projectData.name,
    status: projectData.status || 'todo',
    startDate: projectData.startDate || new Date().toISOString().split('T')[0],
    targetDate: projectData.targetDate,
    description: projectData.description || '',
    columns: [
      { title: 'To Do', tasks: [] },
      { title: 'In Progress', tasks: [] },
      { title: 'Done', tasks: [] },
    ],
    updates: [
      {
        actor: currentUser?.user_metadata?.username || 'You',
        action: 'Project created',
        time: 'just now'
      }
    ]
  };
  projects.push(newProject);
  saveProjects(projects);
  return newProject;
}

function updateProject(index, updates) {
  const projects = loadProjects();
  if (projects[index]) {
    projects[index] = { ...projects[index], ...updates };
    saveProjects(projects);
  }
  return projects;
}

function deleteProject(index) {
  const projects = loadProjects();
  projects.splice(index, 1);
  saveProjects(projects);
  return projects;
}

// ============================================
// Project Tasks
// ============================================
function addTaskToColumn(projectIndex, columnIndex, title) {
  const projects = loadProjects();
  if (projects[projectIndex] && projects[projectIndex].columns[columnIndex]) {
    projects[projectIndex].columns[columnIndex].tasks.push({
      id: generateId('TASK'),
      title: title,
      done: false,
      createdAt: new Date().toISOString()
    });
    saveProjects(projects);
  }
  return projects;
}

function toggleTaskDone(projectIndex, columnIndex, taskIndex) {
  const projects = loadProjects();
  const task = projects[projectIndex]?.columns[columnIndex]?.tasks[taskIndex];
  if (task) {
    task.done = !task.done;
    saveProjects(projects);
  }
  return projects;
}

function deleteTask(projectIndex, columnIndex, taskIndex) {
  const projects = loadProjects();
  if (projects[projectIndex]?.columns[columnIndex]?.tasks[taskIndex]) {
    projects[projectIndex].columns[columnIndex].tasks.splice(taskIndex, 1);
    saveProjects(projects);
  }
  return projects;
}

// ============================================
// Column Management
// ============================================
function addColumnToProject(projectIndex, title) {
  const projects = loadProjects();
  if (projects[projectIndex]) {
    projects[projectIndex].columns.push({
      title: title,
      tasks: []
    });
    saveProjects(projects);
  }
  return projects;
}

function deleteColumnFromProject(projectIndex, columnIndex) {
  const projects = loadProjects();
  if (projects[projectIndex]?.columns[columnIndex]) {
    projects[projectIndex].columns.splice(columnIndex, 1);
    saveProjects(projects);
  }
  return projects;
}

function renameColumn(projectIndex, columnIndex, newTitle) {
  const projects = loadProjects();
  if (projects[projectIndex]?.columns[columnIndex]) {
    projects[projectIndex].columns[columnIndex].title = newTitle;
    saveProjects(projects);
  }
  return projects;
}

// ============================================
// Backlog Tasks
// ============================================
function loadBacklogTasks() {
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

function saveBacklogTasks(tasks) {
  try {
    localStorage.setItem(BACKLOG_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save backlog tasks:', e);
  }
}

function addBacklogTask(title) {
  const tasks = loadBacklogTasks();
  tasks.push({
    id: generateId('BACKLOG'),
    title: title,
    done: false,
    createdAt: new Date().toISOString()
  });
  saveBacklogTasks(tasks);
  return tasks;
}

function toggleBacklogTask(index) {
  const tasks = loadBacklogTasks();
  if (tasks[index]) {
    tasks[index].done = !tasks[index].done;
    saveBacklogTasks(tasks);
  }
  return tasks;
}

function updateBacklogTask(index, title) {
  const tasks = loadBacklogTasks();
  if (tasks[index]) {
    tasks[index].title = title;
    saveBacklogTasks(tasks);
  }
  return tasks;
}

function deleteBacklogTask(index) {
  const tasks = loadBacklogTasks();
  tasks.splice(index, 1);
  saveBacklogTasks(tasks);
  return tasks;
}

// ============================================
// Issues
// ============================================
function loadIssues() {
  try {
    const data = localStorage.getItem(ISSUES_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load issues:', e);
  }
  // Return empty array for fresh start
  return [];
}

function saveIssues(issues) {
  try {
    localStorage.setItem(ISSUES_KEY, JSON.stringify(issues));
  } catch (e) {
    console.error('Failed to save issues:', e);
  }
}

function addIssue(issueData) {
  const issues = loadIssues();
  const newIssue = {
    id: generateIssueId(),
    title: issueData.title,
    description: issueData.description || '',
    status: issueData.status || 'todo',
    priority: issueData.priority || 'medium',
    assignee: currentUser?.user_metadata?.username || issueData.assignee || 'User',
    dueDate: issueData.dueDate,
    updated: 'just now'
  };
  issues.unshift(newIssue);
  saveIssues(issues);
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

function loadAssignments() {
  try {
    const data = localStorage.getItem(ASSIGNMENTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load assignments:', e);
    return [];
  }
}

function saveAssignments(assignments) {
  try {
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
  } catch (e) {
    console.error('Failed to save assignments:', e);
    alert('Storage full or error saving assignment. Try removing some files.');
  }
}

function addAssignment(assignment) {
  const assignments = loadAssignments();
  assignments.unshift(assignment); // newest first
  saveAssignments(assignments);
}

function deleteAssignment(index) {
  const assignments = loadAssignments();
  assignments.splice(index, 1);
  saveAssignments(assignments);
}

function openCreateAssignmentModal() {
  const content = `
    <form id="createAssignmentForm" onsubmit="handleCreateAssignmentSubmit(event)">
      <div class="form-group">
        <label class="form-label">Title <span class="required">*</span></label>
        <input type="text" name="title" class="form-input" required placeholder="e.g. Math Homework Week 5">
      </div>
      
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea name="notes" class="form-textarea" rows="6" placeholder="Add your notes, summaries, answers..."></textarea>
      </div>
      
      <div class="form-group">
        <label class="form-label">Attach files (PDFs, docs, images...)</label>
        <input type="file" id="assignmentFiles" multiple accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png">
        <p style="font-size: 13px; color: var(--muted-foreground); margin-top: 8px;">
          Files will be saved locally. Large files may fill up browser storage.
        </p>
      </div>
      
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Assignment</button>
      </div>
    </form>
  `;
  openModal('Create Assignment', content);
}

async function handleCreateAssignmentSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const title = form.title.value.trim();
  const notes = form.notes.value.trim();

  if (!title) return;

  const fileInput = document.getElementById('assignmentFiles');
  const files = [];

  for (const file of fileInput.files) {
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    files.push({
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      dataUrl
    });
  }

  addAssignment({
    id: generateId('ASSIGN'),
    title,
    notes,
    files,
    created: new Date().toISOString()
  });

  closeModal();
  renderCurrentView();
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
function loadProjectUpdates(projectIndex) {
  const projects = loadProjects();
  if (!projects[projectIndex]) return [];
  return projects[projectIndex].updates || [];
}

function addProjectUpdate(projectIndex, message) {
  const projects = loadProjects();
  if (!projects[projectIndex]) return;

  const newUpdate = {
    actor: currentUser?.user_metadata?.username || 'User',
    message: message.trim(),
    time: new Date().toISOString()
  };

  if (!projects[projectIndex].updates) {
    projects[projectIndex].updates = [];
  }
  projects[projectIndex].updates.unshift(newUpdate);  // Newest first
  saveProjects(projects);
}

function getProjectStatus(projectIndex) {
  const projects = loadProjects();
  return projects[projectIndex]?.status || 'todo';
}
