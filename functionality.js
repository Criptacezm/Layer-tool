/* ============================================
   Layer - Inbox View (Modern Card Layout)
   ============================================ */

function renderInboxView() {
  const projects = loadProjects();
  const calendarEvents = loadCalendarEvents();

  // Normalize date helper (fixes comparison issues)
  function normalizeDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const oneWeekFromNow = new Date(today);
  oneWeekFromNow.setDate(today.getDate() + 7);

  const upcomingEvents = calendarEvents
    .filter(event => {
      if (!event.date) return false;
      const eventDate = normalizeDate(event.date);
      return eventDate >= today && eventDate <= oneWeekFromNow;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const recentActivity = getRecentActivity(projects);

  let content = `
    <div class="inbox-container" style="padding: 32px 24px;">
      <h2 class="view-title" style="margin-bottom: 32px; font-size: 28px; font-weight: 700;">Dashboard</h2>
  `;

  // === Upcoming Tasks - Card Grid Layout ===
  if (upcomingEvents.length > 0) {
    content += `
      <div style="margin-bottom: 48px;">
        <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 20px; color: var(--foreground);">Upcoming This Week</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
          ${upcomingEvents.map(event => {
            const eventDate = normalizeDate(event.date);
            const isToday = eventDate.getTime() === today.getTime();
            const isTomorrow = eventDate.getTime() === new Date(today.getTime() + 86400000).getTime();
            const dayLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : eventDate.toLocaleDateString('en-US', { weekday: 'long' });
            const dateLabel = formatDate(event.date);
            const timeStr = event.time ? `<span style="color: var(--muted-foreground); margin-left: 8px;">• ${event.time}</span>` : '';
            const color = getEventColor(event.color || 'blue');

            return `
              <div class="card" style="padding: 20px; cursor: pointer; transition: all 0.2s; border: 1px solid var(--border);"
                   onclick="currentView = 'schedule'; setExpandedTask(${event.id}); renderCurrentView();">
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                  <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${color}; margin-right: 12px; flex-shrink: 0;"></div>
                  <span style="font-size: 13px; font-weight: 500; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.5px;">
                    ${dayLabel} • ${dateLabel}
                  </span>
                </div>
                <h4 style="font-size: 16px; font-weight: 600; margin: 0 0 8px; color: var(--foreground);">
                  ${event.title}
                </h4>
                <div style="font-size: 14px; color: var(--muted-foreground);">
                  ${timeStr}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } else {
    content += `
      <div class="empty-state" style="text-align: center; padding: 60px 20px;">
        <div class="empty-state-icon" style="font-size: 64px; margin-bottom: 24px;">📅</div>
        <h3 class="empty-state-title">Nothing scheduled this week</h3>
        <p class="empty-state-text" style="max-width: 400px; margin: 0 auto 24px;">
          Your upcoming tasks and events will appear here as cards when added to the schedule.
        </p>
        <button class="btn btn-primary" onclick="currentView = 'schedule'; renderCurrentView();">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Add Task to Schedule
        </button>
      </div>
    `;
  }

  // === Recent Project Activity - Simple Timeline ===
  if (recentActivity.length > 0) {
    content += `
      <div>
        <h3 style="font-size: 18px; font-weight: 600; margin: 48px 0 20px; color: var(--foreground);">Recent Activity</h3>
        <div style="border-left: 2px solid var(--border); padding-left: 24px;">
          ${recentActivity.slice(0, 8).map(item => `
            <div style="position: relative; padding-bottom: 20px;">
              <div style="position: absolute; left: -32px; top: 6px; width: 12px; height: 12px; border-radius: 50%; background: var(--primary); border: 3px solid var(--background);"></div>
              <div style="font-size: 14px; color: var(--foreground); margin-bottom: 4px;">${item.message}</div>
              <div style="font-size: 13px; color: var(--muted-foreground);">${formatTimeAgo(item.time)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  content += `</div>`;
  return content;
}

function getEventColor(color) {
  const colors = {
    blue: 'hsl(217, 91%, 60%)',
    green: 'hsl(142, 71%, 45%)',
    purple: 'hsl(271, 91%, 65%)',
    orange: 'hsl(24, 90%, 60%)',
    red: 'hsl(0, 84%, 60%)'
  };
  return colors[color] || colors.blue;
}



/* ============================================
   Layer - My Issues View (with Delete Support)
   ============================================ */

function renderMyIssuesView(filter = 'all', searchQuery = '') {
  let issues = loadIssues();

  // Apply filter
  if (filter === 'open') {
    issues = issues.filter(issue => issue.status === 'todo');
  } else if (filter === 'in-progress') {
    issues = issues.filter(issue => issue.status === 'in-progress');
  } else if (filter === 'done') {
    issues = issues.filter(issue => issue.status === 'done');
  }

  // Apply search
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    issues = issues.filter(issue =>
      issue.title.toLowerCase().includes(query) ||
      (issue.description && issue.description.toLowerCase().includes(query))
    );
  }

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Open' },
    { id: 'in-progress', label: 'In Progress' },
    { id: 'done', label: 'Done' },
  ];

  const getStatusBadgeClass = (status) => {
    const classes = {
      'todo': 'badge-todo',
      'in-progress': 'badge-in-progress',
      'review': 'badge-review',
      'done': 'badge-done',
    };
    return classes[status] || 'badge-todo';
  };

  const getPriorityBadgeClass = (priority) => {
    const classes = {
      'high': 'badge-priority-high',
      'medium': 'badge-priority-medium',
      'low': 'badge-priority-low',
    };
    return classes[priority] || '';
  };

  if (issues.length === 0) {
    // ... (empty state unchanged - keep as-is)
    return `
      <div class="issues-container">
        <div class="view-header">
          <div class="filter-tabs">
            ${filters.map(f => `
              <button class="filter-tab ${filter === f.id ? 'active' : ''}" data-filter="${f.id}">${f.label}</button>
            `).join('')}
          </div>
          <button class="btn btn-primary" onclick="openCreateIssueModal()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            New Issue
          </button>
        </div>
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <h3 class="empty-state-title">No issues yet</h3>
          <p class="empty-state-text">Create your first issue to get started</p>
          <button class="btn btn-primary" onclick="openCreateIssueModal()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Create New Issue
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="issues-container">
      <div class="view-header">
        <div class="filter-tabs">
          ${filters.map(f => `
            <button class="filter-tab ${filter === f.id ? 'active' : ''}" data-filter="${f.id}">${f.label}</button>
          `).join('')}
        </div>
        <button class="btn btn-primary" onclick="openCreateIssueModal()">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          New Issue
        </button>
      </div>
      <div style="padding: 16px;">
        <div class="card">
          <div class="table-header issues-grid">
            <div></div>
            <div>Issue</div>
            <div>Status</div>
            <div>Priority</div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span>Updated</span>
              <span style="width: 32px;"></span> <!-- Spacer for delete button -->
            </div>
          </div>
          ${issues.map((issue, index) => `
            <div class="table-row issues-grid" style="align-items: center;">
              <div class="issue-id">${issue.id}</div>
              <div>
                <div class="issue-title">${issue.title}</div>
                ${issue.description ? `<div class="issue-description">${issue.description}</div>` : ''}
              </div>
              <div>
                <span class="badge ${getStatusBadgeClass(issue.status)}">${capitalizeStatus(issue.status)}</span>
              </div>
              <div>
                <span class="badge badge-sm ${getPriorityBadgeClass(issue.priority)}">
                  ${issue.priority ? issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1) : '—'}
                </span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <div class="issue-updated">${issue.updated}</div>
                <button class="project-delete-btn" style="opacity: 0.7; padding: 6px; margin-left: 12px;"
                        onclick="event.stopPropagation(); handleDeleteIssue(${index})"
                        title="Delete issue">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ========================
// Delete Issue Handler
// ========================
function handleDeleteIssue(index) {
  const issues = loadIssues();
  const issue = issues[index];

  if (!issue) return;

  const confirmHTML = `
    <div style="padding: 24px; text-align: center;">
      <h3 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: var(--foreground);">Delete Issue?</h3>
      <p style="margin: 0 0 24px; color: var(--muted-foreground); font-size: 14px; line-height: 1.5;">
        Are you sure you want to permanently delete this issue?<br><br>
        <strong>${issue.title}</strong><br>
        <code style="font-size: 13px; background: var(--surface); padding: 4px 8px; border-radius: 4px;">${issue.id}</code>
      </p>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-destructive" onclick="confirmDeleteIssue(${index})">Delete Issue</button>
      </div>
    </div>
  `;

  openModal('Delete Issue', confirmHTML);
}

function confirmDeleteIssue(index) {
  let issues = loadIssues();
  issues.splice(index, 1);
  saveIssues(issues);
  closeModal();
  renderCurrentView();
}

// ========================
// Existing Functions (unchanged)
// ========================
function renderCreateIssueModalContent() {
  return `
    <form id="createIssueForm" onsubmit="handleCreateIssueSubmit(event)">
      <div class="form-group">
        <label class="form-label">Title <span class="required">*</span></label>
        <input type="text" name="title" class="form-input" placeholder="e.g. Add user profile picture upload" required>
      </div>
      
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea name="description" class="form-textarea" placeholder="Describe the issue, steps to reproduce, expected behavior..."></textarea>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="form-group">
          <label class="form-label">Priority</label>
          <select name="priority" class="form-select">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">Status</label>
          <select name="status" class="form-select">
            <option value="todo" selected>To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>
      
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Issue</button>
      </div>
    </form>
  `;
}

function openCreateIssueModal() {
  openModal('Create New Issue', renderCreateIssueModalContent());
}

function handleCreateIssueSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  
  const title = formData.get('title');
  const description = formData.get('description');
  const priority = formData.get('priority');
  const status = formData.get('status');
  
  if (title.trim()) {
    addIssue({
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      assignee: 'Zeyad Maher'
    });
    closeModal();
    renderCurrentView();
  }
}

function setupIssueFilterListeners() {
  const filterTabs = document.querySelectorAll('.filter-tab');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      currentFilter = tab.dataset.filter;
      renderCurrentView();
    });
  });
}



/* ============================================
   Layer - Backlog View (Professional Layout with Features)
   ============================================ */

// Backlog filter state
let backlogFilterState = 'all'; // 'all', 'active', 'completed'
let backlogSortState = 'newest'; // 'newest', 'oldest', 'alphabetical'

function setBacklogFilter(filter) {
  backlogFilterState = filter;
  renderCurrentView();
}

function setBacklogSort(sort) {
  backlogSortState = sort;
  renderCurrentView();
}

function moveToProject(taskIndex) {
  const projects = loadProjects();
  if (projects.length === 0) {
    openModal('No Projects', `
      <div style="padding: 24px; text-align: center;">
        <p style="color: var(--muted-foreground); margin-bottom: 20px;">You need to create a project first before moving tasks.</p>
        <button class="btn btn-primary" onclick="closeModal(); currentView = 'activity'; renderCurrentView();">
          Go to Projects
        </button>
      </div>
    `);
    return;
  }
  
  const content = `
    <div style="padding: 16px;">
      <p style="color: var(--muted-foreground); margin-bottom: 20px;">Select a project to move this task to:</p>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${projects.map((p, i) => `
          <button class="project-select-btn" onclick="confirmMoveToProject(${taskIndex}, ${i})" style="
            display: flex; align-items: center; gap: 12px; padding: 14px 16px;
            background: var(--surface); border: 1px solid var(--border);
            border-radius: 10px; cursor: pointer; transition: all 0.2s;
            text-align: left; width: 100%;
          " onmouseover="this.style.borderColor='var(--primary)'; this.style.background='var(--surface-hover)'"
             onmouseout="this.style.borderColor='var(--border)'; this.style.background='var(--surface)'">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--primary);"></div>
            <span style="font-weight: 500; color: var(--foreground);">${p.name}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  openModal('Move to Project', content);
}

function confirmMoveToProject(taskIndex, projectIndex) {
  const tasks = loadBacklogTasks();
  const task = tasks[taskIndex];
  if (!task) return;
  
  // Add to project's To Do column
  addTaskToColumn(projectIndex, 0, task.title);
  
  // Remove from backlog
  deleteBacklogTask(taskIndex);
  
  closeModal();
  renderCurrentView();
}

function renderBacklogView() {
  let tasks = loadBacklogTasks();
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.done).length;
  const activeTasks = totalTasks - doneTasks;
  const progress = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

  // Apply filters
  let filteredTasks = [...tasks];
  if (backlogFilterState === 'active') {
    filteredTasks = filteredTasks.filter(t => !t.done);
  } else if (backlogFilterState === 'completed') {
    filteredTasks = filteredTasks.filter(t => t.done);
  }

  // Apply sorting
  if (backlogSortState === 'oldest') {
    filteredTasks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else if (backlogSortState === 'alphabetical') {
    filteredTasks.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    filteredTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // Empty State
  if (tasks.length === 0) {
    return `
      <div class="backlog-container backlog-modern">
        <div class="backlog-empty-state">
          <div class="empty-illustration">
            <svg viewBox="0 0 120 120" fill="none" style="width: 120px; height: 120px;">
              <rect x="20" y="30" width="80" height="60" rx="8" fill="var(--surface)" stroke="var(--border)" stroke-width="2"/>
              <rect x="30" y="45" width="40" height="6" rx="3" fill="var(--muted)"/>
              <rect x="30" y="55" width="60" height="6" rx="3" fill="var(--muted)"/>
              <rect x="30" y="65" width="25" height="6" rx="3" fill="var(--muted)"/>
              <circle cx="90" cy="85" r="18" fill="var(--primary)" opacity="0.15"/>
              <path d="M90 79v12M84 85h12" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
          </div>
          <h1 class="empty-title">Start your backlog</h1>
          <p class="empty-description">
            Capture ideas and tasks here. When you're ready, move them to a project.
          </p>
          <div class="backlog-quick-add-wrapper">
            <input 
              type="text" 
              id="quickAddInput" 
              class="backlog-quick-input"
              placeholder="What needs to be done?" 
              onkeypress="handleQuickAddKeypress(event)"
            />
            <button class="quick-add-btn" onclick="handleQuickAddClick()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Main View with Tasks
  return `
    <div class="backlog-container backlog-modern">
      <div class="backlog-header">
        <div class="backlog-title-section">
          <h1 class="view-title">Backlog</h1>
          <div class="backlog-stats-row">
            <span class="stat-chip">${totalTasks} total</span>
            <span class="stat-chip active">${activeTasks} active</span>
            <span class="stat-chip done">${doneTasks} done</span>
          </div>
        </div>
        <div class="backlog-progress-ring">
          <svg viewBox="0 0 80 80" class="progress-ring-svg">
            <circle cx="40" cy="40" r="32" fill="none" stroke="var(--border)" stroke-width="6"/>
            <circle cx="40" cy="40" r="32" fill="none" stroke="var(--primary)" stroke-width="6"
              stroke-dasharray="${2 * Math.PI * 32}"
              stroke-dashoffset="${2 * Math.PI * 32 * (1 - progress/100)}"
              stroke-linecap="round"
              transform="rotate(-90 40 40)"/>
          </svg>
          <span class="progress-value">${progress}%</span>
        </div>
      </div>

      <div class="backlog-toolbar">
        <div class="backlog-filters">
          <button class="filter-chip ${backlogFilterState === 'all' ? 'active' : ''}" onclick="setBacklogFilter('all')">All</button>
          <button class="filter-chip ${backlogFilterState === 'active' ? 'active' : ''}" onclick="setBacklogFilter('active')">Active</button>
          <button class="filter-chip ${backlogFilterState === 'completed' ? 'active' : ''}" onclick="setBacklogFilter('completed')">Completed</button>
        </div>
        <div class="backlog-sort">
          <select class="sort-select" onchange="setBacklogSort(this.value)" value="${backlogSortState}">
            <option value="newest" ${backlogSortState === 'newest' ? 'selected' : ''}>Newest first</option>
            <option value="oldest" ${backlogSortState === 'oldest' ? 'selected' : ''}>Oldest first</option>
            <option value="alphabetical" ${backlogSortState === 'alphabetical' ? 'selected' : ''}>A-Z</option>
          </select>
        </div>
      </div>

      <div class="backlog-tasks-grid">
        ${filteredTasks.map((task, displayIndex) => {
          const originalIndex = tasks.findIndex(t => t.id === task.id);
          return `
          <div class="backlog-task-card ${task.done ? 'done' : ''}">
            <div class="task-card-main">
              <button class="task-checkbox" onclick="handleToggleBacklogTask(${originalIndex})">
                ${task.done ? 
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" fill="var(--primary)" stroke="var(--primary)"/><path d="M8 12l3 3 5-6" stroke="white"/></svg>' : 
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'
                }
              </button>
              <div class="task-content" ondblclick="handleUpdateBacklogTask(${originalIndex}, prompt('Edit task:', '${task.title.replace(/'/g, "\\'")}'))">
                <span class="task-title">${task.title}</span>
                <span class="task-date">${formatRelativeDate(task.createdAt)}</span>
              </div>
            </div>
            <div class="task-actions">
              <button class="task-action-btn" onclick="moveToProject(${originalIndex})" title="Move to project">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                </svg>
              </button>
              <button class="task-action-btn delete" onclick="handleDeleteBacklogTask(${originalIndex})" title="Delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        `}).join('')}
      </div>

      ${filteredTasks.length === 0 ? `
        <div class="backlog-no-results">
          <p>No ${backlogFilterState} tasks found</p>
        </div>
      ` : ''}

      <div class="backlog-add-section">
        <input 
          type="text" 
          id="quickAddInput" 
          class="backlog-quick-input"
          placeholder="+ Add new task" 
          onkeypress="handleQuickAddKeypress(event)"
        />
      </div>

      ${doneTasks > 0 ? `
        <div class="backlog-clear-section">
          <button class="clear-completed-btn" onclick="clearCompletedBacklog()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m5 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
            Clear completed (${doneTasks})
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

function clearCompletedBacklog() {
  const tasks = loadBacklogTasks();
  const activeTasks = tasks.filter(t => !t.done);
  saveBacklogTasks(activeTasks);
  renderCurrentView();
}

// Handlers (unchanged from your version)
function handleToggleBacklogTask(index) {
  toggleBacklogTask(index);
  renderCurrentView();
}

function handleUpdateBacklogTask(index, title) {
  if (title !== null) {
    updateBacklogTask(index, title.trim() || 'New task');
    renderCurrentView();
  }
}

function handleDeleteBacklogTask(index) {
  const confirmHTML = `
    <div style="padding: 32px; text-align: center;">
      <h3 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: var(--foreground);">Delete Task?</h3>
      <p style="margin: 0 0 32px; color: var(--muted-foreground); font-size: 15px; line-height: 1.6;">
        This action is permanent and cannot be undone.
      </p>
      <div style="display: flex; gap: 16px; justify-content: center;">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-destructive" onclick="confirmDeleteBacklogTask(${index})">Delete Task</button>
      </div>
    </div>
  `;
  openModal('Confirm Delete', confirmHTML);
}

function confirmDeleteBacklogTask(index) {
  deleteBacklogTask(index);
  closeModal();
  renderCurrentView();
}

function handleQuickAddKeypress(event) {
  if (event.key === 'Enter') {
    const input = event.target;
    const title = input.value.trim();
    if (title) {
      addBacklogTask(title);
      input.value = '';
      renderCurrentView();
    }
  }
}

// Handle quick add button click
function handleQuickAddClick() {
  const input = document.getElementById('quickAddInput');
  if (!input) return;
  
  const title = input.value.trim();
  if (title) {
    addBacklogTask(title);
    input.value = '';
    renderCurrentView();
  } else {
    // If empty, focus the input
    input.focus();
  }
}



/* ============================================
   Layer - Schedule / Calendar View - Single Expanded Task Only
   ============================================ */

let currentCalendarMonth = new Date();
const EVENTS_KEY = 'layerCalendarEvents';
const EXPANDED_KEY = 'layerCalendarExpandedTask';

function loadCalendarEvents() {
  try { return JSON.parse(localStorage.getItem(EVENTS_KEY)) || []; }
  catch { return []; }
}

function saveCalendarEvents(events) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

function loadExpandedTaskId() {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY);
    if (!raw) return null;
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

function saveExpandedTaskId(id) {
  if (id === null) {
    localStorage.removeItem(EXPANDED_KEY);
  } else {
    localStorage.setItem(EXPANDED_KEY, id.toString());
  }
}

function setExpandedTask(eventId) {
  const current = loadExpandedTaskId();
  const newId = (current === eventId) ? null : eventId;
  saveExpandedTaskId(newId);
  renderCurrentView();
}

function deleteTask(eventId) {
  openDeleteTaskModal(eventId);
}

function openDeleteTaskModal(eventId) {
  const events = loadCalendarEvents();
  const task = events.find(e => e.id === eventId);
  if (!task) return;

  // Non-recurring: keep the simple confirm flow
  if (!task.isRecurring || !task.recurringId) {
    if (!confirm('Delete this task permanently?')) return;
    deleteSingleCalendarEvent(eventId);
    renderCurrentView();
    return;
  }

  const content = `
    <div style="padding: 20px; text-align: center;">
      <h3 style="margin: 0 0 10px; font-size: 18px; font-weight: 600; color: var(--foreground);">Delete recurring task?</h3>
      <p style="margin: 0 0 18px; color: var(--muted-foreground); font-size: 14px; line-height: 1.5;">
        <strong>${task.title}</strong><br/>
        This task repeats weekly. What do you want to delete?
      </p>
      <div class="form-actions" style="justify-content: center;">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-secondary" onclick="confirmDeleteTaskOccurrence(${eventId})">Only this date</button>
        <button class="btn btn-destructive" onclick="confirmDeleteTaskSeries(${task.recurringId})">All weekly repeats</button>
      </div>
    </div>
  `;

  openModal('Delete task', content);
}

function deleteSingleCalendarEvent(eventId) {
  let events = loadCalendarEvents();
  events = events.filter(e => e.id !== eventId);
  saveCalendarEvents(events);

  if (loadExpandedTaskId() === eventId) {
    saveExpandedTaskId(null);
  }
}

function confirmDeleteTaskOccurrence(eventId) {
  deleteSingleCalendarEvent(eventId);
  closeModal();
  renderCurrentView();
}

function confirmDeleteTaskSeries(recurringId) {
  // Remove the recurring rule
  let rules = loadRecurringTasks();
  rules = rules.filter(r => r.id !== recurringId);
  saveRecurringTasks(rules);

  // Remove all generated instances
  let events = loadCalendarEvents();
  events = events.filter(e => e.recurringId !== recurringId);
  saveCalendarEvents(events);

  // Collapse any expanded task (safe + simple)
  saveExpandedTaskId(null);

  closeModal();
  renderCurrentView();
}

// NEW: Edit task modal
function openEditTaskModal(eventId) {
  const events = loadCalendarEvents();
  const task = events.find(e => e.id === eventId);
  if (!task) return;

  const content = `
    <form id="editEventForm" onsubmit="handleEditEventSubmit(event, ${eventId})">
      <div class="form-group">
        <label>Title <span class="required">*</span></label>
        <input type="text" name="title" class="form-input" value="${task.title}" required>
      </div>
      <div class="form-group">
        <label>Time (optional)</label>
        <input type="time" name="time" class="form-input" value="${task.time || ''}">
      </div>
      <div class="form-group">
        <label>Color</label>
        <select name="color" class="form-select">
          <option value="blue" ${task.color === 'blue' ? 'selected' : ''}>Blue</option>
          <option value="green" ${task.color === 'green' ? 'selected' : ''}>Green</option>
          <option value="purple" ${task.color === 'purple' ? 'selected' : ''}>Purple</option>
          <option value="orange" ${task.color === 'orange' ? 'selected' : ''}>Orange</option>
          <option value="red" ${task.color === 'red' ? 'selected' : ''}>Red</option>
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </div>
    </form>
  `;
  openModal('Edit Task', content);
}

function handleEditEventSubmit(e, eventId) {
  e.preventDefault();
  const form = e.target;
  const data = new FormData(form);

  const title = data.get('title')?.trim();
  const time = data.get('time');
  const color = data.get('color') || 'blue';

  if (!title) return;

  let events = loadCalendarEvents();
  const index = events.findIndex(e => e.id === eventId);
  if (index === -1) return;

  events[index] = {
    ...events[index],
    title,
    time: time || null,
    color
  };

  saveCalendarEvents(events);
  closeModal();
  renderCurrentView();
}

// Recurring Tasks Storage
const RECURRING_KEY = 'layerRecurringTasks';

function loadRecurringTasks() {
  try { return JSON.parse(localStorage.getItem(RECURRING_KEY)) || []; }
  catch { return []; }
}

function saveRecurringTasks(tasks) {
  localStorage.setItem(RECURRING_KEY, JSON.stringify(tasks));
}

function addRecurringTask(taskData) {
  const tasks = loadRecurringTasks();
  tasks.push({ id: Date.now(), ...taskData });
  saveRecurringTasks(tasks);
  applyRecurringTasks();
  renderCurrentView();
}

function deleteRecurringTask(id) {
  let tasks = loadRecurringTasks();
  tasks = tasks.filter(t => t.id !== id);
  saveRecurringTasks(tasks);

  // Also purge generated instances from the calendar
  let events = loadCalendarEvents();
  events = events.filter(e => e.recurringId !== id);
  saveCalendarEvents(events);

  // If an instance was expanded, collapse it
  saveExpandedTaskId(null);

  renderCurrentView();
}

function applyRecurringTasks() {
  const recurring = loadRecurringTasks();
  const events = loadCalendarEvents();
  const today = new Date();
  
  // Generate events for next 60 days
  for (let i = 0; i < 60; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().split('T')[0];
    
    recurring.forEach(task => {
      if (task.days && task.days.includes(dayOfWeek)) {
        // Check if event already exists
        const exists = events.some(e => 
          e.recurringId === task.id &&
          e.date === dateStr &&
          e.isRecurring === true
        );
        if (!exists) {
          events.push({
            id: Date.now() + i + Math.floor(Math.random() * 1000000),
            title: task.title,
            date: dateStr,
            time: task.time || null,
            color: task.color || 'blue',
            isRecurring: true,
            recurringId: task.id
          });
        }
      }
    });
  }
  saveCalendarEvents(events);
}

function openAddRecurringModal() {
  const content = `
    <form id="recurringForm" onsubmit="handleAddRecurringSubmit(event)">
      <div class="form-group">
        <label class="form-label">Task Title <span class="required">*</span></label>
        <input type="text" name="title" class="form-input" required placeholder="Daily standup, Weekly review...">
      </div>
      <div class="form-group">
        <label class="form-label">Time (optional)</label>
        <input type="time" name="time" class="form-input">
      </div>
      <div class="form-group">
        <label class="form-label">Repeat on</label>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
          ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day, i) => `
            <label class="recurring-day-label" style="
              display: flex; align-items: center; gap: 6px; padding: 8px 12px;
              background: var(--surface); border: 1px solid var(--border);
              border-radius: 8px; cursor: pointer; transition: all 0.2s;
            ">
              <input type="checkbox" name="days" value="${i}" style="accent-color: var(--primary);">
              <span style="font-size: 13px; font-weight: 500;">${day}</span>
            </label>
          `).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Color</label>
        <select name="color" class="form-select">
          <option value="blue">Blue</option>
          <option value="green">Green</option>
          <option value="purple">Purple</option>
          <option value="orange">Orange</option>
          <option value="red">Red</option>
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Recurring Task</button>
      </div>
    </form>
  `;
  openModal('Add Recurring Task', content);
}

function handleAddRecurringSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const data = new FormData(form);
  const title = data.get('title')?.trim();
  const time = data.get('time');
  const color = data.get('color');
  const days = data.getAll('days').map(d => parseInt(d));
  
  if (!title || days.length === 0) {
    alert('Please enter a title and select at least one day');
    return;
  }
  
  addRecurringTask({ title, time: time || null, color, days });
  closeModal();
}

function renderScheduleView() {
  const year = currentCalendarMonth.getFullYear();
  const month = currentCalendarMonth.getMonth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const events = loadCalendarEvents();
  const expandedId = loadExpandedTaskId();
  const recurringTasks = loadRecurringTasks();

  let daysHtml = '';

  // Previous month padding
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    daysHtml += `<div class="calendar-day other-month"><span class="day-number">${prevMonthDays - i}</span></div>`;
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dateStr = date.toISOString().split('T')[0];
    const isToday = date.toDateString() === today.toDateString();
    const dayName = weekdays[date.getDay()];

    const dayEvents = events
      .filter(e => e.date === dateStr)
      .sort((a,b) => (a.time || '00:00').localeCompare(b.time || '00:00'));

    let tasksHtml = dayEvents.length === 0 
      ? ''
      : dayEvents.map(ev => {
          const isExpanded = (expandedId === ev.id);
          const timeStr = ev.time ? ev.time : '';
          const colorVar = `--event-${ev.color || 'blue'}`;

          return `
            <div class="calendar-task ${isExpanded ? 'expanded' : 'compact'} ${ev.isRecurring ? 'is-recurring' : ''}"
                 draggable="true"
                 data-event-id="${ev.id}"
                 data-current-date="${dateStr}"
                 ${ev.isRecurring ? `data-recurring-id="${ev.recurringId}"` : ''}
                 ondragstart="handleDragStart(event, ${ev.id}, '${dateStr}')"
                 oncontextmenu="event.preventDefault(); openEditTaskModal(${ev.id})"
                 onclick="event.stopPropagation(); setExpandedTask(${ev.id})"
                 style="border-left: 3px solid var(${colorVar});">
              <div class="task-mini">
                <div class="task-left">
                  <div class="task-color-dot" style="background:var(${colorVar});"></div>
                  <span class="task-title-mini">${ev.title.length > 18 ? ev.title.substring(0,16)+'…' : ev.title}</span>
                  ${ev.isRecurring ? '<span class="recurring-badge" title="Weekly recurring">↻</span>' : ''}
                </div>
                <div class="task-right">
                  ${timeStr ? `<span class="task-time-mini">${timeStr}</span>` : ''}
                </div>
              </div>
              <div class="task-expanded-details">
                <div class="task-header">
                  <div class="task-info">
                    <div class="task-title-full">${ev.title}</div>
                    <div class="task-meta-row">
                      ${timeStr ? `<span class="task-time-full">${timeStr}</span>` : ''}
                      ${ev.isRecurring ? '<span class="task-recurring-label">Repeats weekly</span>' : ''}
                    </div>
                  </div>
                  <button class="task-delete-btn" 
                          onclick="event.stopPropagation(); deleteTask(${ev.id})"
                          title="Delete">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m5 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('');

    daysHtml += `
      <div class="calendar-day ${isToday ? 'today' : ''}" 
           data-date="${dateStr}"
           ondragover="event.preventDefault()"
           ondrop="handleDrop(event, '${dateStr}')"
           onclick="if (!event.target.closest('.calendar-task')) openCreateEventModal('${dateStr}')">
        <div class="day-header">
          <span class="day-number">${d}</span>
          <span class="day-name">${dayName}</span>
        </div>
        <div class="day-tasks-container">
          ${tasksHtml}
        </div>
        ${dayEvents.length === 0 ? '<div class="add-task-hint">+ Add</div>' : ''}
      </div>
    `;
  }

  // Next month padding
  const remaining = 42 - (startDay + daysInMonth);
  for (let i = 1; i <= remaining; i++) {
    daysHtml += `<div class="calendar-day other-month"><span class="day-number">${i}</span></div>`;
  }

  // Recurring tasks sidebar
  const recurringHtml = recurringTasks.map(task => {
    const dayNames = ['S','M','T','W','T','F','S'];
    const activeDays = task.days.map(d => dayNames[d]).join(', ');
    return `
      <div class="recurring-task-item" style="border-left: 3px solid var(--event-${task.color || 'blue'});">
        <div class="recurring-task-info">
          <div class="recurring-task-title">${task.title}</div>
          <div class="recurring-task-meta">
            ${task.time ? `<span>${task.time}</span> • ` : ''}
            <span>${activeDays}</span>
          </div>
        </div>
        <button class="recurring-delete-btn" onclick="deleteRecurringTask(${task.id})" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');

  return `
    <div class="schedule-view-wrapper">
      <div class="schedule-view">
        <div class="schedule-header">
          <div class="schedule-title-section">
            <h1 class="view-title">Schedule</h1>
            <span class="schedule-subtitle">${monthNames[month]} ${year}</span>
          </div>
          <div class="calendar-controls">
            <div class="calendar-nav-btns">
              <button class="calendar-nav-btn" onclick="prevMonth()" title="Previous month">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
              <button class="calendar-nav-btn" onclick="nextMonth()" title="Next month">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>
            <button class="btn btn-primary btn-sm" onclick="goToToday()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
              Today
            </button>
          </div>
        </div>

        <div class="calendar-grid">
          ${weekdays.map(w => `<div class="weekday-header">${w}</div>`).join('')}
          ${daysHtml}
        </div>
      </div>

      <div class="schedule-sidebar">
        <div class="sidebar-section">
          <div class="sidebar-section-header">
            <h3>Recurring Tasks</h3>
            <button class="add-recurring-btn" onclick="openAddRecurringModal()" title="Add recurring task">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
          </div>
          ${recurringTasks.length === 0 ? `
            <div class="recurring-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 40px; height: 40px; opacity: 0.4;">
                <path d="M17 2l4 4-4 4"/>
                <path d="M3 11V9a4 4 0 014-4h14"/>
                <path d="M7 22l-4-4 4-4"/>
                <path d="M21 13v2a4 4 0 01-4 4H3"/>
              </svg>
              <p>No recurring tasks yet</p>
              <span>Add tasks that repeat weekly</span>
            </div>
          ` : `
            <div class="recurring-tasks-list">
              ${recurringHtml}
            </div>
          `}
        </div>

        <div class="sidebar-section">
          <div class="sidebar-section-header">
            <h3>Quick Stats</h3>
          </div>
          <div class="schedule-stats">
            <div class="stat-item">
              <span class="stat-value">${events.filter(e => e.date >= today.toISOString().split('T')[0]).length}</span>
              <span class="stat-label">Upcoming</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${events.filter(e => e.date === today.toISOString().split('T')[0]).length}</span>
              <span class="stat-label">Today</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${recurringTasks.length}</span>
              <span class="stat-label">Recurring</span>
            </div>
          </div>
        </div>

        <div class="sidebar-section sidebar-tips">
          <div class="tip-icon">💡</div>
          <div class="tip-content">
            <strong>Pro tip:</strong> Drag tasks between days to reschedule. Right-click to edit.
          </div>
        </div>
      </div>
    </div>
  `;
}

// Drag handlers (unchanged)
function handleDragStart(event, eventId, currentDate) {
  event.dataTransfer.setData('text/plain', JSON.stringify({ id: eventId, fromDate: currentDate }));
  event.currentTarget.classList.add('dragging');
}

function handleDrop(event, targetDate) {
  event.preventDefault();
  const data = JSON.parse(event.dataTransfer.getData('text/plain'));
  const { id, fromDate } = data;

  if (fromDate === targetDate) return;

  let events = loadCalendarEvents();
  const taskIndex = events.findIndex(e => e.id === id);
  if (taskIndex === -1) return;

  events[taskIndex].date = targetDate;
  saveCalendarEvents(events);

  saveExpandedTaskId(null);
  renderCurrentView();
}

// NEW: Drag and Drop handlers
function handleDragStart(event, eventId, currentDate) {
  event.dataTransfer.setData('text/plain', JSON.stringify({ id: eventId, fromDate: currentDate }));
  event.currentTarget.classList.add('dragging');
}

function handleDrop(event, targetDate) {
  event.preventDefault();
  const data = JSON.parse(event.dataTransfer.getData('text/plain'));
  const { id, fromDate } = data;

  if (fromDate === targetDate) return; // same day, no change

  let events = loadCalendarEvents();
  const taskIndex = events.findIndex(e => e.id === id);
  if (taskIndex === -1) return;

  events[taskIndex].date = targetDate;
  saveCalendarEvents(events);

  // Optional: collapse after move
  saveExpandedTaskId(null);

  renderCurrentView();
}

// Add this to clean up dragging style
document.addEventListener('dragend', (event) => {
  if (event.target.classList.contains('calendar-task')) {
    event.target.classList.remove('dragging');
  }
});

// Navigation
window.prevMonth = () => { currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() - 1); renderCurrentView(); };
window.nextMonth = () => { currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + 1); renderCurrentView(); };
window.goToToday = () => { currentCalendarMonth = new Date(); renderCurrentView(); };

// Create modal (unchanged)
function openCreateEventModal(defaultDate = null) {
  const todayStr = new Date().toISOString().split('T')[0];
  const dateValue = defaultDate || todayStr;

  const content = `
    <form id="createEventForm" onsubmit="handleCreateEventSubmit(event, '${dateValue}')">
      <div class="form-group">
        <label>Title <span class="required">*</span></label>
        <input type="text" name="title" class="form-input" required placeholder="Meeting / Deadline / Task...">
      </div>
      <div class="form-group">
        <label>Time (optional)</label>
        <input type="time" name="time" class="form-input">
      </div>
      <div class="form-group">
        <label>Color</label>
        <select name="color" class="form-select">
          <option value="blue">Blue</option>
          <option value="green">Green</option>
          <option value="purple">Purple</option>
          <option value="orange">Orange</option>
          <option value="red">Red</option>
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create</button>
      </div>
    </form>
  `;
  openModal('New Task / Event', content);
}

function handleCreateEventSubmit(e, date) {
  e.preventDefault();
  const form = e.target;
  const data = new FormData(form);

  const title = data.get('title')?.trim();
  const time = data.get('time');
  const color = data.get('color') || 'blue';

  if (!title) return;

  const events = loadCalendarEvents();
  const newEvent = { id: Date.now(), title, date, time: time || null, color };
  
  events.push(newEvent);
  saveCalendarEvents(events);

  // Auto-expand new task (and collapse any other)
  saveExpandedTaskId(newEvent.id);

  closeModal();
  renderCurrentView();
}



/* ============================================
   Layer - Activities/Projects View
   ============================================ */

function renderActivityView(searchQuery = '') {
  let projects = loadProjects();

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    projects = projects.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query))
    );
  }

  if (projects.length === 0) {
    return `
      <div class="projects-container">
        <div class="view-header" style="border: none; padding: 0; margin-bottom: 24px;">
          <h2 class="view-title">Projects</h2>
          <button class="btn btn-primary" onclick="openCreateProjectModal()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Create project
          </button>
        </div>
        <div class="empty-state">
          <div class="empty-state-icon">📂</div>
          <h3 class="empty-state-title">No projects yet</h3>
          <p class="empty-state-text">Get started by creating your first project</p>
          <button class="btn btn-primary" onclick="openCreateProjectModal()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Create Project
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="projects-container" style="padding: 24px;">
      <div class="view-header" style="border: none; padding: 0; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
        <h2 class="view-title" style="font-size: 24px; font-weight: 600; margin: 0;">Workspace</h2>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="btn btn-ghost workspace-action-btn" onclick="exportAllProjects()" title="Export Projects">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </button>
          <button class="btn btn-ghost workspace-action-btn" onclick="importProjects()" title="Import Projects">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button class="btn btn-primary" onclick="openCreateProjectModal()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            New Project
          </button>
        </div>
      </div>
      <input type="file" id="projectImportInput" accept=".json" style="display: none;" onchange="handleProjectImport(event)" />
      
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
        ${projects.map((project, index) => {
          const { total, completed, percentage } = calculateProgress(project.columns);
          const statusColor = getStatusColor(project.status);
          const isStarted = project.status !== 'todo' || percentage > 0;
          const teamMembers = project.teamMembers || ['You'];
          const onlineMembers = teamMembers.filter(() => Math.random() > 0.5); // Simulate online status
          
          return `
            <div class="project-card" style="
              background: var(--card);
              border: 1px solid var(--border);
              border-radius: 12px;
              padding: 20px;
              cursor: pointer;
              transition: all 0.15s ease;
            " onclick="openProjectDetail(${index})"
               onmouseenter="this.style.borderColor='var(--primary)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'"
               onmouseleave="this.style.borderColor='var(--border)'; this.style.boxShadow='none'">
              
              <!-- Header -->
              <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px;">
                <div style="flex: 1;">
                  <h3 style="font-size: 16px; font-weight: 600; color: var(--foreground); margin: 0 0 6px 0;">${project.name}</h3>
                  <span class="badge" style="
                    font-size: 10px;
                    padding: 2px 8px;
                    border-radius: 4px;
                    background-color: ${statusColor}15;
                    color: ${statusColor};
                    font-weight: 500;
                  ">${capitalizeStatus(project.status)}</span>
                </div>
                <div style="display: flex; gap: 4px;">
                  ${!isStarted ? `
                    <button class="btn btn-sm" onclick="event.stopPropagation(); startProject(${index})" style="
                      padding: 6px 12px;
                      font-size: 11px;
                      background: var(--primary);
                      color: var(--primary-foreground);
                      border: none;
                      border-radius: 6px;
                      cursor: pointer;
                    " title="Start Project">
                      <svg style="width: 12px; height: 12px; margin-right: 4px;" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                      Start
                    </button>
                  ` : ''}
                  <button class="project-delete-btn" onclick="event.stopPropagation(); handleDeleteProject(${index})" style="
                    opacity: 0;
                    transition: opacity 0.15s;
                    background: transparent;
                    border: none;
                    padding: 6px;
                    border-radius: 6px;
                    cursor: pointer;
                    color: var(--muted-foreground);
                  ">
                    <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
              
              ${project.description ? `<p style="font-size: 13px; color: var(--muted-foreground); margin: 0 0 16px 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${project.description}</p>` : '<div style="margin-bottom: 16px;"></div>'}
              
              <!-- Progress -->
              <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <span style="font-size: 11px; color: var(--muted-foreground);">${completed}/${total} tasks</span>
                  <span style="font-size: 11px; font-weight: 500; color: var(--foreground);">${percentage}%</span>
                </div>
                <div style="height: 4px; background: var(--border); border-radius: 2px; overflow: hidden;">
                  <div style="width: ${percentage}%; height: 100%; background: ${getProgressColor(percentage)}; border-radius: 2px; transition: width 0.3s;"></div>
                </div>
              </div>
              
              <!-- Footer -->
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 11px; color: var(--muted-foreground);">
                  <svg style="width: 12px; height: 12px; vertical-align: -2px; margin-right: 4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                  ${formatDate(project.targetDate)}
                </span>
                
                <!-- Online Team Members -->
                <div style="display: flex; align-items: center;">
                  ${onlineMembers.slice(0, 3).map((member, i) => {
                    const initials = member.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                    return `
                      <div style="
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        background: ${getTeamColor(i)};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 9px;
                        font-weight: 600;
                        margin-left: ${i > 0 ? '-6px' : '0'};
                        border: 2px solid var(--card);
                        position: relative;
                      " title="${member}">
                        ${initials}
                        <div style="
                          position: absolute;
                          bottom: -1px;
                          right: -1px;
                          width: 8px;
                          height: 8px;
                          background: #22c55e;
                          border-radius: 50%;
                          border: 2px solid var(--card);
                        "></div>
                      </div>
                    `;
                  }).join('')}
                  ${onlineMembers.length > 3 ? `
                    <div style="
                      width: 24px;
                      height: 24px;
                      border-radius: 50%;
                      background: var(--muted);
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 9px;
                      font-weight: 600;
                      color: var(--muted-foreground);
                      margin-left: -6px;
                      border: 2px solid var(--card);
                    ">+${onlineMembers.length - 3}</div>
                  ` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderProjectDetailView(projectIndex) {
  const projects = loadProjects();
  const project = projects[projectIndex];
  
  if (!project) return '';

  const { total, completed, percentage } = calculateProgress(project.columns);
  
  // Dynamic status based on progress
  let dynamicStatus = 'todo';
  if (percentage === 0) {
    dynamicStatus = 'todo';
  } else if (percentage > 0 && percentage < 100) {
    dynamicStatus = 'in-progress';
  } else if (percentage === 100) {
    dynamicStatus = 'done';
  }
  
  const statusColor = getStatusColor(dynamicStatus);
  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (percentage / 100) * circumference;
  
  const teamMembers = project.teamMembers || ['You'];
  const projectPriority = project.priority || 'medium';
  const projectComments = project.comments || [];

  // Generate progress history data for the chart (past 4 weeks)
  const progressHistory = project.progressHistory || generateMockProgressHistory();

  return `
    <div class="project-detail">
      <div class="project-detail-main">
        <div class="project-detail-header">
          <button class="back-btn" onclick="closeProjectDetail()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div class="project-detail-info">
            <div class="project-detail-title-row">
              <div>
                <h1 class="project-detail-title" contenteditable="true" onblur="handleUpdateProjectName(${projectIndex}, this.textContent)">${project.name}</h1>
                <div class="project-detail-badges">
                  <span class="badge" style="background-color: ${statusColor}20; color: ${statusColor};">${capitalizeStatus(dynamicStatus)}</span>
                </div>
              </div>
              <button class="project-detail-delete" onclick="handleDeleteProjectFromDetail(${projectIndex})">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>

        <div class="project-update-card">
          <div class="project-update-badge">
            <svg class="icon" style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
            ${percentage === 100 ? 'Completed!' : percentage >= 50 ? 'On track' : 'In progress'}
          </div>
          <p class="project-update-meta">${project.updates?.[0]?.actor || 'You'} · ${project.updates?.[0]?.time || 'just now'}</p>
          <p class="project-update-text">${project.updates?.[0]?.action || 'Project created'}</p>
        </div>

        <div class="project-description-section">
          <h3 class="section-title">Notes</h3>
          <textarea class="form-textarea note-input" placeholder="Add notes..." onblur="handleUpdateProjectDescription(${projectIndex}, this.value)">${project.description || ''}</textarea>
        </div>

        <!-- Grip Diagram Button -->
        <div style="margin-bottom: 24px;">
          <button class="btn btn-primary" onclick="openGripDiagram(${projectIndex})" style="display: inline-flex; align-items: center; gap: 8px;">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <path d="M10 6.5h4M10 17.5h4M6.5 10v4M17.5 10v4"/>
            </svg>
            Open Grip Diagram
          </button>
        </div>

        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
            <h3 class="section-title" style="margin: 0;">Tasks</h3>
            <button class="btn btn-secondary btn-sm" onclick="handleAddColumn(${projectIndex})" style="display: inline-flex; align-items: center; gap: 6px;">
              <svg class="icon" style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              Add Column
            </button>
          </div>
          <div class="kanban-board">
            ${project.columns.map((column, colIndex) => `
              <div class="kanban-column">
                <div class="kanban-column-header">
                  <h4 class="kanban-column-title" contenteditable="true" onblur="handleRenameColumn(${projectIndex}, ${colIndex}, this.textContent)">${column.title}</h4>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="kanban-column-count">${column.tasks.filter(t => t.done).length}/${column.tasks.length}</span>
                    <button class="kanban-column-delete" onclick="handleDeleteColumn(${projectIndex}, ${colIndex})" title="Delete column" style="background: transparent; border: none; padding: 4px; cursor: pointer; color: var(--muted-foreground); opacity: 0.6; transition: all 0.15s;">
                      <svg class="icon" style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>
                <div class="kanban-tasks">
                  ${column.tasks.map((task, taskIndex) => `
                    <div class="kanban-task ${task.done ? 'done' : ''}">
                      <label class="checkbox-container" style="width: 16px; height: 16px;">
                        <input type="checkbox" ${task.done ? 'checked' : ''} onchange="handleToggleProjectTask(${projectIndex}, ${colIndex}, ${taskIndex})">
                        <div class="checkbox-custom" style="width: 16px; height: 16px; border-radius: 3px;">
                          <svg class="check-icon" style="width: 10px; height: 10px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
                        </div>
                      </label>
                      <span class="kanban-task-title">${task.title}</span>
                      <button class="kanban-task-delete" onclick="handleDeleteProjectTask(${projectIndex}, ${colIndex}, ${taskIndex})">
                        <svg class="icon" style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  `).join('')}
                </div>
                <div class="kanban-add-task">
                  <input type="text" class="kanban-add-input" placeholder="+ Add a task..." data-column="${colIndex}" onkeypress="handleAddProjectTaskKeypress(event, ${projectIndex}, ${colIndex})">
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <!-- Progress Chart Section -->
        <div style="margin-top: 40px;">
          <h3 class="section-title" style="margin-bottom: 20px;">Progress Over Time</h3>
          <div class="progress-chart-container" style="background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 24px;">
            <div class="progress-chart" id="progressChart-${projectIndex}" style="position: relative; height: 200px;">
              ${renderProgressChart(progressHistory, projectIndex)}
            </div>
          </div>
        </div>
      </div>

      <aside class="project-detail-sidebar">
        <h3 class="project-sidebar-title">Properties</h3>
        
        <div class="progress-circle-container">
          <div class="progress-circle">
            <svg viewBox="0 0 140 140">
              <circle class="progress-circle-bg" cx="70" cy="70" r="60"/>
              <circle class="progress-circle-fill" cx="70" cy="70" r="60" 
                style="stroke: ${getProgressColor(percentage)}; stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};"/>
            </svg>
            <div class="progress-circle-value">${percentage}</div>
          </div>
          <p class="progress-circle-label">Project Progress</p>
        </div>

        <div class="properties-list">
          <div class="property-item">
            <span class="property-label">Status</span>
            <span class="badge badge-sm" style="background-color: ${statusColor}20; color: ${statusColor};">${capitalizeStatus(dynamicStatus)}</span>
          </div>
          <div class="property-item">
            <span class="property-label">Priority</span>
            <div class="priority-selector" onclick="openPrioritySelector(${projectIndex}, event)">
              <span class="badge badge-sm badge-priority-${projectPriority}" style="cursor: pointer;">
                ${projectPriority.charAt(0).toUpperCase() + projectPriority.slice(1)}
              </span>
            </div>
          </div>
          <div class="property-item">
            <span class="property-label">Lead</span>
            <span class="property-value property-link" onclick="showComingSoonToast()">Choose leader</span>
          </div>
          <div class="property-item">
            <span class="property-label">Target date</span>
            <span class="property-value" style="cursor: pointer;" onclick="openEditTargetDateModal(${projectIndex})">
              <svg class="icon" style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              ${formatDate(project.targetDate)}
              <svg class="icon" style="width: 12px; height: 12px; margin-left: 4px; opacity: 0.5;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </span>
          </div>
          <div class="property-item">
            <span class="property-label">Team Members</span>
            <div style="display: flex; align-items: center;">
              <div style="display: flex;">
                ${teamMembers.slice(0, 5).map((member, i) => {
                  const initials = member.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                  const isOnline = Math.random() > 0.4; // Simulate online status
                  return `
                    <div style="
                      width: 28px;
                      height: 28px;
                      border-radius: 50%;
                      background: ${getTeamColor(i)};
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      color: white;
                      font-size: 10px;
                      font-weight: 600;
                      margin-left: ${i > 0 ? '-8px' : '0'};
                      border: 2px solid var(--card);
                      position: relative;
                      z-index: ${5 - i};
                    " title="${member}${isOnline ? ' (Online)' : ' (Offline)'}">
                      ${initials}
                      ${isOnline ? `
                        <div style="
                          position: absolute;
                          bottom: -2px;
                          right: -2px;
                          width: 10px;
                          height: 10px;
                          background: #22c55e;
                          border-radius: 50%;
                          border: 2px solid var(--card);
                        "></div>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
                ${teamMembers.length > 5 ? `
                  <div style="
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background: var(--muted);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--muted-foreground);
                    font-size: 9px;
                    font-weight: 600;
                    margin-left: -8px;
                    border: 2px solid var(--card);
                  ">+${teamMembers.length - 5}</div>
                ` : ''}
              </div>
              <button class="btn btn-ghost btn-sm" onclick="openInviteMemberModal(${projectIndex})" style="padding: 4px; margin-left: 8px;">
                <svg class="icon" style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>
          </div>
        </div>
        
        <!-- Document Upload Section -->
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border);">
          <h4 style="font-size: 13px; font-weight: 500; color: var(--muted-foreground); margin-bottom: 12px;">Share Document</h4>
          <div class="document-upload-area" onclick="document.getElementById('projectDocUpload-${projectIndex}').click()" style="
            border: 2px dashed var(--border);
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.borderColor='var(--primary)'; this.style.background='var(--surface-hover)'" onmouseout="this.style.borderColor='var(--border)'; this.style.background='transparent'">
            <svg style="width: 24px; height: 24px; color: var(--muted-foreground); margin-bottom: 8px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <path d="M14 2v6h6M12 18v-6M9 15l3-3 3 3"/>
            </svg>
            <p style="font-size: 12px; color: var(--muted-foreground); margin: 0;">Upload PDF to share with team</p>
          </div>
          <input type="file" id="projectDocUpload-${projectIndex}" accept=".pdf,.doc,.docx" style="display: none;" onchange="handleProjectDocUpload(event, ${projectIndex})">
          ${project.sharedDocuments && project.sharedDocuments.length > 0 ? `
            <div style="margin-top: 12px;">
              ${project.sharedDocuments.map((doc, docIndex) => `
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--surface); border-radius: 6px; margin-bottom: 6px;">
                  <svg style="width: 16px; height: 16px; color: var(--muted-foreground);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <path d="M14 2v6h6"/>
                  </svg>
                  <span style="font-size: 12px; color: var(--foreground); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${doc.name}</span>
                  <button onclick="removeProjectDoc(${projectIndex}, ${docIndex})" style="background: transparent; border: none; cursor: pointer; color: var(--muted-foreground); padding: 2px;">
                    <svg style="width: 12px; height: 12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
        
        <!-- Team Comments & Updates Section -->
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border);">
          <h4 style="font-size: 13px; font-weight: 500; color: var(--muted-foreground); margin-bottom: 12px;">Team Comments & Updates</h4>
          
          <!-- Add Comment Form - Simplified -->
          <div style="margin-bottom: 16px;">
            <div style="display: flex; gap: 8px;">
              <input type="text" id="projectComment-${projectIndex}" placeholder="Add update..." style="
                flex: 1;
                padding: 8px 12px;
                border: 1px solid var(--border);
                border-radius: 6px;
                background: var(--surface);
                color: var(--foreground);
                font-size: 12px;
              " onkeypress="if(event.key==='Enter') addProjectComment(${projectIndex})">
              <button onclick="addProjectComment(${projectIndex})" style="
                padding: 8px 12px;
                border: none;
                border-radius: 6px;
                background: var(--primary);
                color: var(--primary-foreground);
                cursor: pointer;
                font-size: 12px;
              ">Post</button>
            </div>
          </div>
          
          <!-- Comments List -->
          <div class="comments-list" style="max-height: 300px; overflow-y: auto;">
            ${projectComments.length === 0 ? `
              <p style="font-size: 12px; color: var(--muted-foreground); text-align: center; padding: 16px 0;">No comments yet</p>
            ` : projectComments.map((comment, cIdx) => `
              <div class="project-comment" style="
                padding: 10px;
                background: ${comment.isImportant ? 'rgba(239, 68, 68, 0.1)' : 'var(--surface)'};
                border: 1px solid ${comment.isImportant ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)'};
                border-radius: 8px;
                margin-bottom: 8px;
                position: relative;
              " onmouseenter="this.querySelector('.comment-actions').style.opacity='1'" onmouseleave="this.querySelector('.comment-actions').style.opacity='0'">
                <!-- Delete and Type Toggle buttons on hover -->
                <div class="comment-actions" style="
                  position: absolute;
                  top: 8px;
                  right: 8px;
                  display: flex;
                  gap: 4px;
                  opacity: 0;
                  transition: opacity 0.15s;
                ">
                  <button onclick="event.stopPropagation(); toggleCommentImportant(${projectIndex}, ${cIdx})" title="${comment.isImportant ? 'Mark as normal' : 'Mark as important'}" style="
                    width: 24px;
                    height: 24px;
                    border-radius: 4px;
                    border: none;
                    background: ${comment.isImportant ? '#ef4444' : 'var(--surface-hover)'};
                    color: ${comment.isImportant ? 'white' : 'var(--muted-foreground)'};
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                  ">⚠</button>
                  <button onclick="event.stopPropagation(); deleteProjectComment(${projectIndex}, ${cIdx})" title="Delete comment" style="
                    width: 24px;
                    height: 24px;
                    border-radius: 4px;
                    border: none;
                    background: var(--surface-hover);
                    color: var(--destructive);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  ">
                    <svg style="width: 12px; height: 12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                  <div style="
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: ${getTeamColor(0)};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 8px;
                    font-weight: 600;
                  ">${(comment.author || 'You').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}</div>
                  <span style="font-size: 11px; font-weight: 500; color: var(--foreground);">${comment.author || 'You'}</span>
                  ${comment.isImportant ? '<span style="font-size: 9px; background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px;">Important</span>' : ''}
                  <span style="font-size: 10px; color: var(--muted-foreground); margin-left: auto; margin-right: 56px;">${formatTimeAgo(comment.time)}</span>
                </div>
                <p style="font-size: 12px; color: var(--foreground); margin: 0 0 8px 0; line-height: 1.4;">${comment.message}</p>
                <div style="display: flex; gap: 8px;">
                  <button onclick="replyToComment(${projectIndex}, ${cIdx})" style="
                    font-size: 10px;
                    color: var(--muted-foreground);
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    padding: 2px 6px;
                    border-radius: 4px;
                  " onmouseover="this.style.background='var(--surface-hover)'" onmouseout="this.style.background='transparent'">↩ Reply</button>
                  <button onclick="reactToComment(${projectIndex}, ${cIdx})" style="
                    font-size: 10px;
                    color: var(--muted-foreground);
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    padding: 2px 6px;
                    border-radius: 4px;
                  " onmouseover="this.style.background='var(--surface-hover)'" onmouseout="this.style.background='transparent'">👍 ${comment.reactions || 0}</button>
                </div>
                ${comment.replies && comment.replies.length > 0 ? `
                  <div style="margin-top: 8px; padding-left: 12px; border-left: 2px solid var(--border);">
                    ${comment.replies.map(reply => `
                      <div style="padding: 6px 0;">
                        <span style="font-size: 10px; font-weight: 500; color: var(--foreground);">${reply.author}</span>
                        <span style="font-size: 10px; color: var(--muted-foreground);"> · ${formatTimeAgo(reply.time)}</span>
                        <p style="font-size: 11px; color: var(--foreground); margin: 4px 0 0 0;">${reply.message}</p>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </aside>
      
      ${typeof renderProjectDetailAiChat === 'function' ? renderProjectDetailAiChat() : ''}
    </div>
  `;
}

// Progress chart rendering - Modern Bar Chart Style
function renderProgressChart(progressHistory, projectIndex) {
  const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  const maxTasks = Math.max(...progressHistory.map(w => w.completed), 10);
  const chartHeight = 160;
  const barColors = ['#6366f1', '#8b5cf6', '#a855f7', '#22c55e'];
  
  return `
    <div class="progress-chart-modern">
      <!-- Chart Header -->
      <div class="chart-header">
        <div class="chart-legend">
          <span class="legend-dot" style="background: linear-gradient(135deg, #6366f1, #8b5cf6);"></span>
          <span>Tasks Completed</span>
        </div>
        <div class="chart-total">
          <span class="total-label">Total</span>
          <span class="total-value">${progressHistory.reduce((sum, w) => sum + w.completed, 0)}</span>
        </div>
      </div>
      
      <!-- Bar Chart Container -->
      <div class="bar-chart-container" style="height: ${chartHeight}px; position: relative; display: flex; align-items: flex-end; gap: 16px; padding: 0 8px;">
        <!-- Y-axis labels -->
        <div class="y-axis" style="position: absolute; left: 0; top: 0; height: 100%; display: flex; flex-direction: column; justify-content: space-between; padding: 4px 0;">
          <span class="y-label" style="font-size: 10px; color: var(--muted-foreground);">${maxTasks}</span>
          <span class="y-label" style="font-size: 10px; color: var(--muted-foreground);">${Math.round(maxTasks / 2)}</span>
          <span class="y-label" style="font-size: 10px; color: var(--muted-foreground);">0</span>
        </div>
        
        <!-- Grid lines -->
        <div class="chart-grid" style="position: absolute; left: 30px; right: 0; top: 0; height: 100%; pointer-events: none;">
          <div style="position: absolute; left: 0; right: 0; top: 0; border-top: 1px dashed var(--border);"></div>
          <div style="position: absolute; left: 0; right: 0; top: 50%; border-top: 1px dashed var(--border);"></div>
          <div style="position: absolute; left: 0; right: 0; bottom: 0; border-top: 1px solid var(--border);"></div>
        </div>
        
        <!-- Bars -->
        <div class="bars-wrapper" style="display: flex; flex: 1; align-items: flex-end; gap: 20px; margin-left: 40px; height: 100%;">
          ${progressHistory.map((week, i) => {
            const barHeight = Math.max((week.completed / maxTasks) * chartHeight, 8);
            const percentage = maxTasks > 0 ? Math.round((week.completed / maxTasks) * 100) : 0;
            return `
              <div class="bar-item" style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end;">
                <div class="bar-value" style="font-size: 12px; font-weight: 600; color: ${barColors[i]}; margin-bottom: 6px; opacity: 0; transition: opacity 0.3s;">
                  ${week.completed}
                </div>
                <div class="bar" 
                     style="width: 100%; max-width: 60px; height: ${barHeight}px; 
                            background: linear-gradient(180deg, ${barColors[i]}, ${barColors[i]}99);
                            border-radius: 8px 8px 0 0;
                            position: relative;
                            cursor: pointer;
                            transition: all 0.3s ease;
                            box-shadow: 0 -4px 20px ${barColors[i]}30;"
                     onmouseover="this.style.transform='scaleY(1.02)'; this.previousElementSibling.style.opacity='1';"
                     onmouseout="this.style.transform='scaleY(1)'; this.previousElementSibling.style.opacity='0';">
                  <div class="bar-glow" style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 50%); border-radius: 8px 8px 0 0;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      
      <!-- X-axis labels -->
      <div class="x-axis" style="display: flex; margin-top: 12px; margin-left: 40px; gap: 20px;">
        ${weeks.map((w, i) => `
          <div style="flex: 1; text-align: center;">
            <span style="font-size: 12px; font-weight: 500; color: var(--muted-foreground);">${w}</span>
          </div>
        `).join('')}
      </div>
      
      <!-- Stats Row -->
      <div class="chart-stats" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border);">
        ${progressHistory.map((week, i) => `
          <div class="stat-card" style="background: var(--surface); border-radius: 10px; padding: 14px; text-align: center; transition: all 0.2s;">
            <div style="font-size: 22px; font-weight: 700; color: ${barColors[i]}; margin-bottom: 4px;">${week.completed}</div>
            <div style="font-size: 11px; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.5px;">Week ${i + 1}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function generateMockProgressHistory() {
  return [
    { week: 1, completed: Math.floor(Math.random() * 5) + 2 },
    { week: 2, completed: Math.floor(Math.random() * 8) + 5 },
    { week: 3, completed: Math.floor(Math.random() * 10) + 8 },
    { week: 4, completed: Math.floor(Math.random() * 12) + 10 }
  ];
}

function showChartTooltip(event, tasksCompleted, weekLabel) {
  // Legacy tooltip - no longer needed with new design
}

function hideChartTooltip() {
  // Legacy tooltip - no longer needed with new design
}

// Priority selector
function openPrioritySelector(projectIndex, event) {
  event.stopPropagation();
  const content = `
    <div style="padding: 16px;">
      <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 600;">Select Priority</h3>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button onclick="setProjectPriority(${projectIndex}, 'high')" class="btn" style="justify-content: flex-start; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444; margin-right: 8px;"></span>
          High Priority
        </button>
        <button onclick="setProjectPriority(${projectIndex}, 'medium')" class="btn" style="justify-content: flex-start; background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); color: #fbbf24;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #fbbf24; margin-right: 8px;"></span>
          Medium Priority
        </button>
        <button onclick="setProjectPriority(${projectIndex}, 'low')" class="btn" style="justify-content: flex-start; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); color: #22c55e;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e; margin-right: 8px;"></span>
          Low Priority
        </button>
      </div>
    </div>
  `;
  openModal('Set Priority', content);
}

function setProjectPriority(projectIndex, priority) {
  const projects = loadProjects();
  if (projects[projectIndex]) {
    projects[projectIndex].priority = priority;
    saveProjects(projects);
  }
  closeModal();
  renderCurrentView();
}

// Target date editing
function openEditTargetDateModal(projectIndex) {
  const projects = loadProjects();
  const project = projects[projectIndex];
  const currentDate = project.targetDate || new Date().toISOString().split('T')[0];
  
  const content = `
    <form onsubmit="handleUpdateTargetDate(event, ${projectIndex})">
      <div class="form-group">
        <label class="form-label">Target Date</label>
        <input type="date" name="targetDate" class="form-input" value="${currentDate}" required>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Update Date</button>
      </div>
    </form>
  `;
  openModal('Edit Target Date', content);
}

function handleUpdateTargetDate(event, projectIndex) {
  event.preventDefault();
  const form = event.target;
  const newDate = form.targetDate.value;
  
  const projects = loadProjects();
  if (projects[projectIndex]) {
    projects[projectIndex].targetDate = newDate;
    saveProjects(projects);
  }
  closeModal();
  renderCurrentView();
}

// Document upload
function handleProjectDocUpload(event, projectIndex) {
  const file = event.target.files[0];
  if (!file) return;
  
  const projects = loadProjects();
  if (!projects[projectIndex]) return;
  
  if (!projects[projectIndex].sharedDocuments) {
    projects[projectIndex].sharedDocuments = [];
  }
  
  projects[projectIndex].sharedDocuments.push({
    name: file.name,
    type: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString()
  });
  
  saveProjects(projects);
  renderCurrentView();
  
  // Show toast
  const toast = document.createElement('div');
  toast.textContent = `"${file.name}" uploaded successfully!`;
  toast.style.cssText = 'position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; background: var(--card); color: var(--foreground); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999;';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function removeProjectDoc(projectIndex, docIndex) {
  const projects = loadProjects();
  if (projects[projectIndex] && projects[projectIndex].sharedDocuments) {
    projects[projectIndex].sharedDocuments.splice(docIndex, 1);
    saveProjects(projects);
    renderCurrentView();
  }
}

// Comments functions
window.isImportantComment = false;

function addProjectComment(projectIndex) {
  const input = document.getElementById(`projectComment-${projectIndex}`);
  if (!input || !input.value.trim()) return;
  
  const projects = loadProjects();
  if (!projects[projectIndex]) return;
  
  if (!projects[projectIndex].comments) {
    projects[projectIndex].comments = [];
  }
  
  projects[projectIndex].comments.unshift({
    author: 'You',
    message: input.value.trim(),
    isImportant: window.isImportantComment,
    time: new Date().toISOString(),
    reactions: 0,
    replies: []
  });
  
  saveProjects(projects);
  window.isImportantComment = false;
  renderCurrentView();
}

function replyToComment(projectIndex, commentIndex) {
  const reply = prompt('Your reply:');
  if (!reply || !reply.trim()) return;
  
  const projects = loadProjects();
  if (!projects[projectIndex] || !projects[projectIndex].comments[commentIndex]) return;
  
  if (!projects[projectIndex].comments[commentIndex].replies) {
    projects[projectIndex].comments[commentIndex].replies = [];
  }
  
  projects[projectIndex].comments[commentIndex].replies.push({
    author: 'You',
    message: reply.trim(),
    time: new Date().toISOString()
  });
  
  saveProjects(projects);
  renderCurrentView();
}

function reactToComment(projectIndex, commentIndex) {
  const projects = loadProjects();
  if (!projects[projectIndex] || !projects[projectIndex].comments[commentIndex]) return;
  
  projects[projectIndex].comments[commentIndex].reactions = 
    (projects[projectIndex].comments[commentIndex].reactions || 0) + 1;
  
  saveProjects(projects);
  renderCurrentView();
}

function deleteProjectComment(projectIndex, commentIndex) {
  const projects = loadProjects();
  if (!projects[projectIndex] || !projects[projectIndex].comments) return;
  
  projects[projectIndex].comments.splice(commentIndex, 1);
  saveProjects(projects);
  renderCurrentView();
}

function toggleCommentImportant(projectIndex, commentIndex) {
  const projects = loadProjects();
  if (!projects[projectIndex] || !projects[projectIndex].comments[commentIndex]) return;
  
  projects[projectIndex].comments[commentIndex].isImportant = 
    !projects[projectIndex].comments[commentIndex].isImportant;
  
  saveProjects(projects);
  renderCurrentView();
}

// Start project function
function startProject(projectIndex) {
  const projects = loadProjects();
  if (!projects[projectIndex]) return;
  
  projects[projectIndex].status = 'in-progress';
  projects[projectIndex].startedAt = new Date().toISOString();
  
  // Add an update to track the start
  if (!projects[projectIndex].updates) {
    projects[projectIndex].updates = [];
  }
  projects[projectIndex].updates.unshift({
    actor: 'You',
    action: 'Started the project',
    time: 'just now'
  });
  
  saveProjects(projects);
  renderCurrentView();
}

// Team invite modal
function openInviteMemberModal(projectIndex) {
  const content = `
    <form id="inviteMemberForm" onsubmit="handleInviteMember(event, ${projectIndex})">
      <div class="form-group">
        <label class="form-label">Email Address <span class="required">*</span></label>
        <input type="email" name="email" class="form-input" required placeholder="colleague@example.com">
      </div>
      <p style="font-size: 13px; color: var(--muted-foreground); margin-bottom: 16px;">
        An invitation email will be sent to join this project.
      </p>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Send Invitation</button>
      </div>
    </form>
  `;
  openModal('Invite Team Member', content);
}

function handleInviteMember(event, projectIndex) {
  event.preventDefault();
  const form = event.target;
  const email = form.email.value.trim();
  
  if (!email) return;
  
  // Add member to project (using email prefix as name for now)
  const projects = loadProjects();
  if (projects[projectIndex]) {
    if (!projects[projectIndex].teamMembers) {
      projects[projectIndex].teamMembers = ['You'];
    }
    const memberName = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    projects[projectIndex].teamMembers.push(memberName);
    saveProjects(projects);
  }
  
  closeModal();
  alert('Invitation sent to ' + email + '!');
  renderCurrentView();
}

// Team chart helper functions
function getTeamColor(index) {
  const colors = [
    '#6366f1', // Indigo
    '#10b981', // Emerald  
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#84cc16', // Lime
  ];
  return colors[index % colors.length];
}

function generateTeamChartData(project, teamMembers) {
  // Generate simulated performance data based on project tasks
  const data = [];
  const numWeeks = 5;
  
  teamMembers.forEach((member, memberIndex) => {
    const memberData = [];
    let baseValue = 20 + Math.random() * 30;
    
    for (let week = 0; week < numWeeks; week++) {
      // Add some variation and upward trend
      const variation = (Math.random() - 0.3) * 25;
      const trend = week * 8;
      const value = Math.min(100, Math.max(5, baseValue + variation + trend));
      memberData.push(Math.round(value));
      baseValue = value;
    }
    data.push(memberData);
  });
  
  return data;
}

// Column management handlers
function handleAddColumn(projectIndex) {
  const columnName = prompt('Enter column name:', 'New Column');
  if (columnName && columnName.trim()) {
    addColumnToProject(projectIndex, columnName.trim());
    renderCurrentView();
  }
}

function handleDeleteColumn(projectIndex, columnIndex) {
  const projects = loadProjects();
  const column = projects[projectIndex]?.columns[columnIndex];
  
  if (!column) return;
  
  if (column.tasks.length > 0) {
    if (!confirm(`Delete "${column.title}" column? It contains ${column.tasks.length} task(s) that will also be deleted.`)) {
      return;
    }
  }
  
  deleteColumnFromProject(projectIndex, columnIndex);
  renderCurrentView();
}

function handleRenameColumn(projectIndex, columnIndex, newTitle) {
  if (newTitle && newTitle.trim()) {
    renameColumn(projectIndex, columnIndex, newTitle.trim());
  }
}

function renderCreateProjectModalContent() {
  const today = new Date().toISOString().split('T')[0];
  
  return `
    <form id="createProjectForm" onsubmit="handleCreateProjectSubmit(event)">
      <div class="form-group">
        <label class="form-label">Project name</label>
        <input type="text" name="name" class="form-input" placeholder="e.g. Layer v2 - New UI & Realtime" required>
      </div>
      
      <div class="form-group">
        <label class="form-label">Target due date</label>
        <input type="date" name="targetDate" class="form-input" value="${today}" required>
      </div>
      
      <div class="form-group">
        <label class="form-label">Notes (optional)</label>
        <textarea name="description" class="form-textarea" placeholder="Add notes..."></textarea>
      </div>
      
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create project</button>
      </div>
    </form>
  `;
}

function openCreateProjectModal() {
  openModal('Create new project', renderCreateProjectModalContent());
}

function handleCreateProjectSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  
  const name = formData.get('name');
  const targetDate = formData.get('targetDate');
  const description = formData.get('description');
  
  if (name.trim() && targetDate) {
    addProject({
      name: name.trim(),
      status: 'todo',
      startDate: new Date().toISOString().split('T')[0],
      targetDate,
      description: description.trim()
    });
    closeModal();
    renderCurrentView();
  }
}

function openProjectDetail(index) {
  selectedProjectIndex = index;
  renderCurrentView();
}

function closeProjectDetail() {
  selectedProjectIndex = null;
  currentView = 'activity';
  setActiveNav('activity');
  renderCurrentView();
}

function handleDeleteProject(index) {
  if (confirm('Delete this project permanently?')) {
    deleteProject(index);
    renderCurrentView();
  }
}

function handleDeleteProjectFromDetail(index) {
  if (confirm('Delete this project permanently?')) {
    deleteProject(index);
    closeProjectDetail();
  }
}

function handleUpdateProjectName(index, name) {
  updateProject(index, { name: name || 'Untitled' });
}

function handleUpdateProjectDescription(index, description) {
  updateProject(index, { description: description || '' });
}

function handleToggleProjectTask(projectIndex, columnIndex, taskIndex) {
  toggleTaskDone(projectIndex, columnIndex, taskIndex);
  renderCurrentView();
}

function handleDeleteProjectTask(projectIndex, columnIndex, taskIndex) {
  deleteTask(projectIndex, columnIndex, taskIndex);
  renderCurrentView();
}

function handleAddProjectTaskKeypress(event, projectIndex, columnIndex) {
  if (event.key === 'Enter') {
    const input = event.target;
    const title = input.value.trim();
    if (title) {
      addTaskToColumn(projectIndex, columnIndex, title);
      input.value = '';
      renderCurrentView();
    }
  }
}

function showComingSoonToast() {
  // Create toast element
  const toast = document.createElement('div');
  toast.textContent = 'Sorryyy this feature is not available at the moment. Coming soon...❤';
  toast.style.position = 'fixed';
  toast.style.bottom = '24px';
  toast.style.right = '24px';
  toast.style.padding = '12px 20px';
  toast.style.backgroundColor = 'var(--card)';
  toast.style.color = 'var(--foreground)';
  toast.style.border = '1px solid var(--border)';
  toast.style.borderRadius = '12px';
  toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
  toast.style.fontSize = '14px';
  toast.style.zIndex = '1000';
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  toast.style.transform = 'translateY(20px)';

  document.body.appendChild(toast);

  // Fade in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 100);

  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}



/* ============================================
   Layer - Teams View
   ============================================ */

function renderTeamView() {
  return `
    <div class="team-container">
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <h3 class="empty-state-title">Team collaboration coming soon</h3>
        <p class="empty-state-text">Invite team members and collaborate on projects together</p>
      </div>
    </div>
  `;
}



/* ============================================
   Layer - Settings View (Professional Layout)
   ============================================ */

function renderSettingsView() {
  const currentTheme = localStorage.getItem('layerTheme') || 'dark';
  const appVersion = '0.1.0';
  const lastSync = new Date().toLocaleString();
  
  // Load notification settings
  const notifyDeadlines = localStorage.getItem('layerNotifyDeadlines') !== 'false';
  const notifyReminders = localStorage.getItem('layerNotifyReminders') !== 'false';
  const notifySounds = localStorage.getItem('layerNotifySounds') !== 'false';
  const notifyEmail = localStorage.getItem('layerNotifyEmail') === 'true';

  // Full list of all available themes
  const themes = [
    { value: 'dark', label: 'Dark (Default)' },
    { value: 'light', label: 'Light' },
    { value: 'liquid-glass', label: 'Liquid Glass' },
    { value: 'coffee', label: 'Coffee' },
    { value: 'pink', label: 'Pink' },
    { value: 'purple', label: 'Purple' },
    { value: 'ocean', label: 'Ocean' },
    { value: 'forest', label: 'Forest' },
    { value: 'sunset', label: 'Sunset' },
    { value: 'midnight', label: 'Midnight Blue' },
    { value: 'dracula', label: 'Dracula' },
    { value: 'nord', label: 'Nord' },
    { value: 'gruvbox', label: 'Gruvbox Dark' },
    { value: 'catppuccin', label: 'Catppuccin Mocha' },
    { value: 'rosepine', label: 'Rosé Pine' },
  ];

  return `
    <div class="settings-container">
      <!-- Header -->
      <div class="view-header">
        <h1 class="view-title">Settings</h1>
        <p class="view-subtitle">Customize your experience and manage your data</p>
      </div>

      <!-- Appearance Section -->
      <div class="settings-section card">
        <h3 class="section-title">Appearance</h3>
        <div class="settings-item">
          <div class="settings-label">
            <span>Theme</span>
            <p class="settings-description">Choose your preferred color scheme</p>
          </div>
          <select id="themeSelect" class="form-select">
            ${themes.map(theme => `
              <option value="${theme.value}" ${currentTheme === theme.value ? 'selected' : ''}>
                ${theme.label}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="settings-item" id="themeModeToggleContainer" style="${currentTheme === 'dark' || currentTheme === 'light' ? 'display: none;' : ''}">
          <div class="settings-label">
            <span>Theme Mode</span>
            <p class="settings-description">Toggle between light and dark variants of your theme</p>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 13px; color: var(--muted-foreground);">Dark</span>
            <label class="toggle-switch">
              <input type="checkbox" id="themeModeToggle" ${localStorage.getItem('layerThemeMode') === 'light' ? 'checked' : ''} onchange="toggleThemeModeFromSettings(this.checked)">
              <span class="toggle-slider"></span>
            </label>
            <span style="font-size: 13px; color: var(--muted-foreground);">Light</span>
          </div>
        </div>
      </div>

      <!-- Notifications Section -->
      <div class="settings-section card">
        <h3 class="section-title">Notifications</h3>
        
        <div class="settings-item">
          <div class="settings-label">
            <span>Deadline Reminders</span>
            <p class="settings-description">Get notified when project deadlines are approaching</p>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="notifyDeadlines" ${notifyDeadlines ? 'checked' : ''} onchange="updateNotificationSetting('layerNotifyDeadlines', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="settings-item">
          <div class="settings-label">
            <span>Task Reminders</span>
            <p class="settings-description">Receive reminders for upcoming tasks</p>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="notifyReminders" ${notifyReminders ? 'checked' : ''} onchange="updateNotificationSetting('layerNotifyReminders', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="settings-item">
          <div class="settings-label">
            <span>Sound Effects</span>
            <p class="settings-description">Play sounds for notifications and actions</p>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="notifySounds" ${notifySounds ? 'checked' : ''} onchange="updateNotificationSetting('layerNotifySounds', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="settings-item">
          <div class="settings-label">
            <span>Email Notifications</span>
            <p class="settings-description">Receive important updates via email</p>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="notifyEmail" ${notifyEmail ? 'checked' : ''} onchange="updateNotificationSetting('layerNotifyEmail', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- Data Management Section -->
      <div class="settings-section card">
        <h3 class="section-title">Data Management</h3>
        
        <div class="settings-item">
          <div class="settings-label">
            <span>Export Data</span>
            <p class="settings-description">Download a full backup of your projects, tasks, issues, and settings</p>
          </div>
          <button class="btn btn-secondary" onclick="exportData()">
            Export All Data (JSON)
          </button>
        </div>

        <div class="settings-item">
          <div class="settings-label">
            <span>Import Data</span>
            <p class="settings-description">Restore from a previously exported Layer backup file</p>
          </div>
          <button class="btn btn-secondary" onclick="document.getElementById('importFileInput').click()">
            Choose File to Import
          </button>
          <input type="file" id="importFileInput" accept=".json,application/json" style="display:none" onchange="handleImportFile(event)">
        </div>

        <div class="settings-item danger-zone">
          <div class="settings-label">
            <span>Reset All Data</span>
            <p class="settings-description">Permanently delete everything — use with caution</p>
          </div>
          <button class="btn btn-destructive" onclick="resetAllData()">
            Reset Everything
          </button>
        </div>
      </div>

      <!-- About & Info Section -->
      <div class="settings-section card">
        <h3 class="section-title">About & Info</h3>
        <div class="settings-item">
          <div class="settings-label">
            <span>Created by</span>
            <p class="settings-description">Lead developer and designer</p>
          </div>
          <div class="settings-value creator-badge">
            <span class="creator-avatar">ZM</span>
            <span class="creator-name">Zeyad Maher Mohamed</span>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-label">
            <span>Version</span>
            <p class="settings-description">Current app version</p>
          </div>
          <span class="settings-value">${appVersion}</span>
        </div>
        <div class="settings-item">
          <div class="settings-label">
            <span>Last Sync</span>
            <p class="settings-description">When your data was last updated</p>
          </div>
          <span class="settings-value">${lastSync}</span>
        </div>
        <div class="settings-item">
          <div class="settings-label">
            <span>Feedback</span>
            <p class="settings-description">Help us improve Layer</p>
          </div>
          <a href="mailto:feedback@layer.app" class="btn btn-ghost">Send Feedback</a>
        </div>
      </div>
    </div>
  `;
}

// Notification Settings Handler
function updateNotificationSetting(key, value) {
  localStorage.setItem(key, value);
}

// ========================
// Export Data
// ========================
function exportData() {
  const data = {
    projects: localStorage.getItem('layerProjectsData'),
    backlog: localStorage.getItem('layerBacklogTasks'),
    issues: localStorage.getItem('layerMyIssues'),
    calendar: localStorage.getItem('layerCalendarEvents'),
    expanded: localStorage.getItem('layerCalendarExpandedTask'),
    theme: localStorage.getItem('layerTheme')
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `layer-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ========================
// Import Data
// ========================
function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.name.endsWith('.json')) {
    alert('Please select a valid JSON file.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);

      const confirmHTML = `
        <div style="padding: 24px; text-align: center;">
          <h3 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: var(--foreground);">Import Data?</h3>
          <p style="margin: 0 0 24px; color: var(--muted-foreground); font-size: 14px; line-height: 1.5;">
            This will <strong>replace all current data</strong> with the contents of the backup file.<br><br>
            File: <strong>${file.name}</strong><br>
            Are you sure you want to continue?
          </p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="performImport()">Yes, Import Data</button>
          </div>
        </div>
      `;

      window.pendingImportData = imported;
      openModal('Confirm Import', confirmHTML);
    } catch (err) {
      alert('Invalid backup file: Could not parse JSON.');
      console.error(err);
    }
  };

  reader.readAsText(file);
}

function performImport() {
  const data = window.pendingImportData;
  if (!data) return;

  if (data.projects) localStorage.setItem('layerProjectsData', data.projects);
  if (data.backlog) localStorage.setItem('layerBacklogTasks', data.backlog);
  if (data.issues) localStorage.setItem('layerMyIssues', data.issues);
  if (data.calendar) localStorage.setItem('layerCalendarEvents', data.calendar);
  if (data.expanded) localStorage.setItem('layerCalendarExpandedTask', data.expanded);
  if (data.theme) {
    localStorage.setItem('layerTheme', data.theme);
    applyTheme(data.theme);
  }

  delete window.pendingImportData;
  closeModal();
  alert('Data imported successfully! The app will now reload.');
  location.reload();
}

// ========================
// Reset All Data
// ========================
function resetAllData() {
  const confirmHTML = `
    <div style="padding: 24px; text-align: center;">
      <h3 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: var(--foreground);">Are you sure?</h3>
      <p style="margin: 0 0 32px; color: var(--muted-foreground); font-size: 14px; line-height: 1.5;">
        This will <strong>permanently delete ALL</strong> your data:<br>
        projects, tasks, issues, calendar events, and settings.<br><br>
        <strong>This action cannot be undone.</strong>
      </p>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button class="btn btn-secondary" onclick="closeModal()">No, Cancel</button>
        <button class="btn btn-destructive" onclick="confirmResetAllData()">Yes, Delete Everything</button>
      </div>
    </div>
  `;

  openModal('Reset All Data', confirmHTML);
}

function confirmResetAllData() {
  localStorage.clear();
  closeModal();
  location.reload();
}

// ========================
// Theme Application with Mode Support
// ========================
function applyTheme(theme) {
  document.body.classList.remove('light');
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-mode');

  if (theme === 'light') {
    document.body.classList.add('light');
  } else if (theme === 'dark') {
    // Default dark, no special attributes needed
  } else {
    // Custom theme - apply with current mode
    const currentMode = localStorage.getItem('layerThemeMode') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-mode', currentMode);
  }

  localStorage.setItem('layerTheme', theme);
}

function toggleThemeModeFromSettings(isLight) {
  const newMode = isLight ? 'light' : 'dark';
  localStorage.setItem('layerThemeMode', newMode);
  document.documentElement.setAttribute('data-mode', newMode);
}

function initThemeSelector() {
  const themeSelect = document.getElementById('themeSelect');
  const modeContainer = document.getElementById('themeModeToggleContainer');
  
  if (!themeSelect) return;

  const current = localStorage.getItem('layerTheme') || 'dark';
  themeSelect.value = current;

  themeSelect.addEventListener('change', (e) => {
    const newTheme = e.target.value;
    applyTheme(newTheme);
    
    // Show/hide mode toggle based on theme
    if (modeContainer) {
      if (newTheme === 'dark' || newTheme === 'light') {
        modeContainer.style.display = 'none';
      } else {
        modeContainer.style.display = '';
        // Reset mode to dark when switching themes
        localStorage.setItem('layerThemeMode', 'dark');
        document.documentElement.setAttribute('data-mode', 'dark');
        const modeToggle = document.getElementById('themeModeToggle');
        if (modeToggle) modeToggle.checked = false;
      }
    }
  });
}

// Apply saved theme on load
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('layerTheme') || 'dark';
  applyTheme(saved);
  initThemeSelector();
  
  // Check if focus mode was active
  const focusState = loadFocusModeState();
  if (focusState && focusState.active) {
    restoreFocusMode(focusState);
  }
});


/* ============================================
   Layer - Focus Mode Feature
   ============================================ */

const FOCUS_MODE_KEY = 'layerFocusModeState';
let focusTimerInterval = null;
let focusStartTime = null;
let focusPausedTime = 0;
let focusPaused = false;
let focusProjectIndex = null;
let focusTasks = [];

function loadFocusModeState() {
  try {
    return JSON.parse(localStorage.getItem(FOCUS_MODE_KEY));
  } catch {
    return null;
  }
}

function saveFocusModeState(state) {
  localStorage.setItem(FOCUS_MODE_KEY, JSON.stringify(state));
}

function clearFocusModeState() {
  localStorage.removeItem(FOCUS_MODE_KEY);
}

function openFocusModeModal() {
  const projects = loadProjects();
  
  if (projects.length === 0) {
    openModal('Focus Mode', `
      <div style="padding: 24px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">🎯</div>
        <h3 style="margin: 0 0 12px; font-size: 18px; font-weight: 600;">No Projects Yet</h3>
        <p style="color: var(--muted-foreground); margin-bottom: 24px;">
          Create a project first to start focus mode.
        </p>
        <button class="btn btn-primary" onclick="closeModal(); currentView = 'activity'; renderCurrentView();">
          Create Project
        </button>
      </div>
    `);
    return;
  }
  
  const content = `
    <div style="padding: 8px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 48px; margin-bottom: 12px;">🎯</div>
        <p style="color: var(--muted-foreground); font-size: 14px;">
          Select a project to focus on and track your time
        </p>
      </div>
      
      <div class="form-group">
        <label class="form-label">Choose Project</label>
        <select id="focusProjectSelect" class="form-select" style="font-size: 15px; padding: 12px;">
          ${projects.map((p, i) => `<option value="${i}">${p.name}</option>`).join('')}
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Focus Duration (optional)</label>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="focus-duration-btn" data-duration="25" onclick="selectFocusDuration(this)">25 min</button>
          <button type="button" class="focus-duration-btn" data-duration="45" onclick="selectFocusDuration(this)">45 min</button>
          <button type="button" class="focus-duration-btn" data-duration="60" onclick="selectFocusDuration(this)">1 hour</button>
          <button type="button" class="focus-duration-btn selected" data-duration="0" onclick="selectFocusDuration(this)">No limit</button>
        </div>
      </div>
      
      <div class="form-actions" style="margin-top: 28px;">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="startFocusMode()" style="background: linear-gradient(135deg, hsl(217, 91%, 60%), hsl(271, 91%, 65%)); border: none;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Start Focus
        </button>
      </div>
    </div>
  `;
  
  openModal('Focus Mode', content);
  
  // Add styles for duration buttons
  setTimeout(() => {
    const style = document.createElement('style');
    style.textContent = `
      .focus-duration-btn {
        flex: 1;
        padding: 10px 8px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        color: var(--muted-foreground);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
      }
      .focus-duration-btn:hover {
        border-color: var(--primary);
        color: var(--foreground);
      }
      .focus-duration-btn.selected {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--primary-foreground);
      }
    `;
    document.head.appendChild(style);
  }, 0);
}

function selectFocusDuration(btn) {
  document.querySelectorAll('.focus-duration-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function startFocusMode() {
  const select = document.getElementById('focusProjectSelect');
  const projectIndex = parseInt(select.value);
  const projects = loadProjects();
  const project = projects[projectIndex];
  
  if (!project) return;
  
  const durationBtn = document.querySelector('.focus-duration-btn.selected');
  const duration = durationBtn ? parseInt(durationBtn.dataset.duration) : 0;
  
  // Get tasks from the project's To Do and In Progress columns
  focusTasks = [];
  project.columns.forEach((col, colIndex) => {
    if (colIndex < 2) { // To Do and In Progress
      col.tasks.forEach((task, taskIndex) => {
        if (!task.done) {
          focusTasks.push({
            title: task.title,
            done: false,
            colIndex,
            taskIndex,
            id: task.id
          });
        }
      });
    }
  });
  
  focusProjectIndex = projectIndex;
  focusStartTime = Date.now();
  focusPausedTime = 0;
  focusPaused = false;
  
  // Save state
  saveFocusModeState({
    active: true,
    projectIndex,
    projectName: project.name,
    startTime: focusStartTime,
    pausedTime: 0,
    paused: false,
    duration: duration,
    tasks: focusTasks
  });
  
  closeModal();
  showFocusTimer(project.name);
}

function restoreFocusMode(state) {
  focusProjectIndex = state.projectIndex;
  focusStartTime = state.startTime;
  focusPausedTime = state.pausedTime || 0;
  focusPaused = state.paused || false;
  focusTasks = state.tasks || [];
  
  showFocusTimer(state.projectName);
  
  if (focusPaused) {
    updatePauseButton(true);
  }
}

function showFocusTimer(projectName) {
  const floatEl = document.getElementById('focusTimerFloat');
  const projectNameEl = document.getElementById('timerProjectName');
  
  if (floatEl) {
    floatEl.style.display = 'flex';
    projectNameEl.textContent = projectName;
    renderFocusTasks();
    
    if (!focusPaused) {
      startTimerInterval();
    } else {
      updateTimerDisplay();
    }
  }
}

function startTimerInterval() {
  if (focusTimerInterval) {
    clearInterval(focusTimerInterval);
  }
  
  focusTimerInterval = setInterval(() => {
    if (!focusPaused) {
      updateTimerDisplay();
    }
  }, 1000);
  
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const displayEl = document.getElementById('timerDisplay');
  if (!displayEl) return;
  
  let elapsed;
  if (focusPaused) {
    elapsed = focusPausedTime;
  } else {
    elapsed = Math.floor((Date.now() - focusStartTime) / 1000) + focusPausedTime;
  }
  
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  
  if (hours > 0) {
    displayEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    displayEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}

function toggleTimerExpand() {
  const widget = document.getElementById('focusTimerWidget');
  const isExpanded = widget.classList.contains('expanded');
  
  if (isExpanded) {
    widget.classList.remove('expanded', 'tasks-visible');
  } else {
    widget.classList.add('expanded');
    // Show tasks after a short delay
    setTimeout(() => {
      widget.classList.add('tasks-visible');
    }, 150);
  }
}

function toggleTimerPause() {
  focusPaused = !focusPaused;
  
  if (focusPaused) {
    // Save elapsed time when pausing
    focusPausedTime = Math.floor((Date.now() - focusStartTime) / 1000) + focusPausedTime;
    clearInterval(focusTimerInterval);
    focusTimerInterval = null;
  } else {
    // Resume from paused time
    focusStartTime = Date.now();
    startTimerInterval();
  }
  
  updatePauseButton(focusPaused);
  
  // Update saved state
  const state = loadFocusModeState();
  if (state) {
    state.paused = focusPaused;
    state.pausedTime = focusPausedTime;
    if (!focusPaused) {
      state.startTime = focusStartTime;
    }
    saveFocusModeState(state);
  }
}

function updatePauseButton(isPaused) {
  const btn = document.getElementById('timerPauseBtn');
  const text = document.getElementById('pauseBtnText');
  const icon1 = document.getElementById('pauseIcon1');
  const icon2 = document.getElementById('pauseIcon2');
  
  if (isPaused) {
    text.textContent = 'Resume';
    // Change to play icon
    if (icon1 && icon2) {
      icon1.setAttribute('d', 'M5 3l14 9-14 9V3z');
      icon1.removeAttribute('x');
      icon1.removeAttribute('y');
      icon1.removeAttribute('width');
      icon1.removeAttribute('height');
      icon2.style.display = 'none';
    }
  } else {
    text.textContent = 'Pause';
    if (icon2) icon2.style.display = '';
  }
}

function stopFocusMode() {
  if (focusTimerInterval) {
    clearInterval(focusTimerInterval);
    focusTimerInterval = null;
  }
  
  const floatEl = document.getElementById('focusTimerFloat');
  if (floatEl) {
    floatEl.style.display = 'none';
  }
  
  // Reset state
  focusStartTime = null;
  focusPausedTime = 0;
  focusPaused = false;
  focusProjectIndex = null;
  focusTasks = [];
  
  clearFocusModeState();
  
  // Reset widget state
  const widget = document.getElementById('focusTimerWidget');
  if (widget) {
    widget.classList.remove('expanded', 'tasks-visible');
  }
}

function renderFocusTasks() {
  const listEl = document.getElementById('timerTasksList');
  const progressEl = document.getElementById('tasksProgress');
  
  if (!listEl) return;
  
  const completedCount = focusTasks.filter(t => t.done).length;
  progressEl.textContent = `${completedCount}/${focusTasks.length}`;
  
  if (focusTasks.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 16px; color: var(--muted-foreground); font-size: 13px;">
        No tasks in this project
      </div>
    `;
    return;
  }
  
  listEl.innerHTML = focusTasks.map((task, i) => `
    <div class="timer-task-item ${task.done ? 'done' : ''}" onclick="toggleFocusTask(${i})">
      <div class="timer-task-checkbox"></div>
      <span>${task.title}</span>
    </div>
  `).join('');
}

function toggleFocusTask(index) {
  if (!focusTasks[index]) return;
  
  focusTasks[index].done = !focusTasks[index].done;
  
  // Update the actual project task
  const task = focusTasks[index];
  if (focusProjectIndex !== null) {
    toggleTaskDone(focusProjectIndex, task.colIndex, task.taskIndex);
  }
  
  // Update saved state
  const state = loadFocusModeState();
  if (state) {
    state.tasks = focusTasks;
    saveFocusModeState(state);
  }
  
  renderFocusTasks();
}

// ============================================
// Project Export/Import Functions
// ============================================

function exportAllProjects() {
  const projects = loadProjects();
  if (projects.length === 0) {
    alert('No projects to export!');
    return;
  }
  
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    projects: projects
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `layer-projects-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  // Show success toast
  showToast('Projects exported successfully!');
}

function importProjects() {
  const input = document.getElementById('projectImportInput');
  if (input) {
    input.click();
  }
}

function handleProjectImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importData = JSON.parse(e.target.result);
      
      // Validate import data
      if (!importData.projects || !Array.isArray(importData.projects)) {
        alert('Invalid file format. Please select a valid Layer projects export file.');
        return;
      }
      
      // Ask user how to handle import
      const existingProjects = loadProjects();
      const importCount = importData.projects.length;
      
      if (existingProjects.length > 0) {
        const choice = confirm(
          `Found ${importCount} project(s) to import.\n\n` +
          `You currently have ${existingProjects.length} project(s).\n\n` +
          `Click OK to MERGE (add to existing)\n` +
          `Click Cancel to REPLACE all existing projects`
        );
        
        if (choice) {
          // Merge - add imported projects with new IDs to avoid conflicts
          const mergedProjects = [...existingProjects];
          importData.projects.forEach(project => {
            // Generate new ID to avoid conflicts
            project.id = generateId('PROJ');
            mergedProjects.push(project);
          });
          saveProjects(mergedProjects);
        } else {
          // Replace all
          saveProjects(importData.projects);
        }
      } else {
        // No existing projects, just import
        saveProjects(importData.projects);
      }
      
      // Reset the input
      event.target.value = '';
      
      // Refresh view
      renderCurrentView();
      
      showToast(`${importCount} project(s) imported successfully!`);
      
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import projects. Please check the file format.');
    }
  };
  reader.readAsText(file);
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 14px 24px;
    background: var(--card);
    color: var(--foreground);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    z-index: 9999;
    font-size: 14px;
    font-weight: 500;
    animation: toastSlideIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Make functions globally accessible
window.openFocusModeModal = openFocusModeModal;
window.selectFocusDuration = selectFocusDuration;
window.startFocusMode = startFocusMode;
window.toggleTimerExpand = toggleTimerExpand;
window.toggleTimerPause = toggleTimerPause;
window.stopFocusMode = stopFocusMode;
window.toggleFocusTask = toggleFocusTask;
window.openAddRecurringModal = openAddRecurringModal;
window.handleAddRecurringSubmit = handleAddRecurringSubmit;
window.deleteRecurringTask = deleteRecurringTask;
window.setBacklogFilter = setBacklogFilter;
window.setBacklogSort = setBacklogSort;
window.moveToProject = moveToProject;
window.confirmMoveToProject = confirmMoveToProject;
window.clearCompletedBacklog = clearCompletedBacklog;
