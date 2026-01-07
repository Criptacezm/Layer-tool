/* ============================================
   Layer - Data Store & Persistence
   ============================================ */

// Storage keys
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
          // Clear old description if desired
          // project.description = '';
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
        actor: 'You',
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
    assignee: issueData.assignee || 'Zeyad Maher',
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

function deleteAssignment(index) {
  if (confirm('Delete this assignment permanently?')) {
    deleteAssignment(index);
    renderCurrentView();
  }
}

// Optional: Simple PDF preview in modal
function openPdfPreview(dataUrl) {
  const content = `<iframe src="${dataUrl}" style="width:100%; height:80vh; border:none;"></iframe>`;
  openModal('PDF Preview', content);
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
    actor: 'Zeyad Maher',  // Hardcoded for single-user; extend later for multi-user
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
