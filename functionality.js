/* ============================================
   Layer - Inbox View (Modern Card Layout)
   ============================================ */

// Track if dashboard AI greeting has been shown this session
let dashboardAIShown = false;

function renderInboxView() {
  const projects = loadProjects();
  const calendarEvents = loadCalendarEvents();
  const issues = loadIssues();
  const docs = loadDocs();

  // Normalize date helper (fixes comparison issues)
  function normalizeDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const oneWeekFromNow = new Date(today);
  oneWeekFromNow.setDate(today.getDate() + 7);

  const upcomingEvents = calendarEvents
    .filter(event => {
      if (!event.date) return false;
      const eventDate = normalizeDate(event.date);
      return eventDate >= today && eventDate <= oneWeekFromNow;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const todayTasks = calendarEvents.filter(e => e.date === todayStr);
  const recentActivity = getRecentActivity(projects);
  
  // Calculate stats
  const completedTasks = calendarEvents.filter(e => e.completed).length;
  const totalTasks = calendarEvents.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const openIssues = issues.filter(i => i.status !== 'done').length;
  const activeProjects = projects.length;
  
  // Generate AI greeting message
  const aiMessage = generateAIGreeting(todayTasks, upcomingEvents, projects);

  // Calculate daily productivity (last 7 days)
  const productivityData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const count = calendarEvents.filter(e => e.date === dateStr && e.completed).length;
    productivityData.push({ day: d.toLocaleDateString('en-US', { weekday: 'short' }), count });
  }
  const maxCount = Math.max(...productivityData.map(d => d.count), 1);

  let content = `
    <div class="dashboard-layout">
      <!-- Main Dashboard Content -->
      <div class="dashboard-main">
        <div class="inbox-container" style="padding: 32px 24px;">
          <h2 class="view-title" style="margin-bottom: 32px; font-size: 28px; font-weight: 700;">Dashboard</h2>
          
          <!-- Enhanced Dashboard Widgets Grid -->
          <div class="dashboard-widgets-grid">
            <!-- Stats Widget -->
            <div class="dashboard-widget">
              <div class="widget-header">
                <span class="widget-title">
                  <svg class="widget-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </svg>
                  Overview
                </span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                <div style="text-align: center;">
                  <div class="widget-stat-value">${activeProjects}</div>
                  <div class="widget-stat-label">Projects</div>
                </div>
                <div style="text-align: center;">
                  <div class="widget-stat-value">${openIssues}</div>
                  <div class="widget-stat-label">Open Issues</div>
                </div>
                <div style="text-align: center;">
                  <div class="widget-stat-value">${docs.length}</div>
                  <div class="widget-stat-label">Documents</div>
                </div>
              </div>
            </div>
            
            <!-- Progress Widget -->
            <div class="dashboard-widget">
              <div class="widget-header">
                <span class="widget-title">
                  <svg class="widget-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                  Task Completion
                </span>
                <span style="font-size: 24px; font-weight: 700; color: var(--foreground);">${completionRate}%</span>
              </div>
              <div class="widget-progress-bar">
                <div class="widget-progress-fill" style="width: ${completionRate}%;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: var(--muted-foreground);">
                <span>${completedTasks} completed</span>
                <span>${totalTasks - completedTasks} remaining</span>
              </div>
            </div>
            
            <!-- Quick Actions Widget -->
            <div class="dashboard-widget">
              <div class="widget-header">
                <span class="widget-title">
                  <svg class="widget-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  Quick Actions
                </span>
              </div>
              <div class="quick-actions-grid">
                <button class="quick-action-btn" onclick="openDocEditor()">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  New Doc
                </button>
                <button class="quick-action-btn" onclick="openCreateIssueModal()">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
                  New Issue
                </button>
                <button class="quick-action-btn" onclick="currentView = 'activity'; renderCurrentView();">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  Projects
                </button>
                <button class="quick-action-btn" onclick="currentView = 'schedule'; renderCurrentView();">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                  Calendar
                </button>
              </div>
            </div>
            
            <!-- Productivity Chart -->
            <div class="dashboard-widget">
              <div class="widget-header">
                <span class="widget-title">
                  <svg class="widget-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>
                  </svg>
                  Weekly Activity
                </span>
              </div>
              <div class="productivity-chart">
                ${productivityData.map(d => `
                  <div class="chart-bar ${d.count === 0 ? 'muted' : ''}" style="height: ${Math.max(10, (d.count / maxCount) * 100)}%;" title="${d.day}: ${d.count} tasks"></div>
                `).join('')}
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 10px; color: var(--muted-foreground);">
                ${productivityData.map(d => `<span>${d.day}</span>`).join('')}
              </div>
            </div>
            
            <!-- Streak Widget -->
            <div class="dashboard-widget">
              <div class="widget-header">
                <span class="widget-title">
                  <svg class="widget-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                  Your Streak
                </span>
              </div>
              <div class="streak-display">
                <span class="streak-flame">🔥</span>
                <div class="streak-info">
                  <div class="streak-count">${calculateStreak(calendarEvents)} days</div>
                  <div class="streak-label">Keep it up!</div>
                </div>
              </div>
            </div>
            
            <!-- Today's Focus Goals -->
            <div class="dashboard-widget">
              <div class="widget-header">
                <span class="widget-title">
                  <svg class="widget-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                  </svg>
                  Today's Focus
                </span>
              </div>
              <div class="goals-list">
                ${todayTasks.length > 0 ? todayTasks.slice(0, 3).map((task, i) => `
                  <div class="goal-item">
                    <div class="goal-checkbox ${task.completed ? 'completed' : ''}" onclick="toggleDashboardGoal(${task.id})"></div>
                    <span class="goal-text ${task.completed ? 'completed' : ''}">${task.title}</span>
                  </div>
                `).join('') : `
                  <div style="text-align: center; padding: 16px; color: var(--muted-foreground); font-size: 13px;">
                    No tasks for today. Add some from the Schedule!
                  </div>
                `}
              </div>
            </div>
          </div>
  `;

  // === Upcoming Tasks - Card Grid Layout ===
  if (upcomingEvents.length > 0) {
    content += `
      <div style="margin-bottom: 48px;">
        <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 20px; color: var(--foreground);">Upcoming This Week</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
          ${upcomingEvents.slice(0, 6).map(event => {
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

  content += `
        </div>
      </div>
      
      <!-- Summary of Today Sidebar (Right) -->
      <aside class="dashboard-ai-sidebar">
        <div class="ai-sidebar-header">
          <span class="ai-title">Summary of Today</span>
        </div>
        <div class="ai-message-container">
          <div class="ai-message" id="aiGreetingMessage" data-full-message="${aiMessage.replace(/"/g, '&quot;')}">
            <span class="ai-typing-text"></span>
            <span class="ai-cursor">|</span>
          </div>
        </div>
      </aside>
    </div>
  `;
  
  // Start typing animation after render
  setTimeout(() => {
    if (!dashboardAIShown) {
      startAITypingAnimation();
      dashboardAIShown = true;
    } else {
      // Show message immediately if already shown
      const msgEl = document.getElementById('aiGreetingMessage');
      if (msgEl) {
        const text = msgEl.dataset.fullMessage;
        const typingEl = msgEl.querySelector('.ai-typing-text');
        const cursorEl = msgEl.querySelector('.ai-cursor');
        if (typingEl) typingEl.textContent = text;
        if (cursorEl) cursorEl.style.display = 'none';
      }
    }
  }, 100);
  
  return content;
}

// Calculate streak days
function calculateStreak(events) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];
    const hasCompleted = events.some(e => e.date === dateStr && e.completed);
    
    if (i === 0 && !hasCompleted) {
      // Today doesn't count against streak if not completed yet
      continue;
    }
    
    if (hasCompleted) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  
  return streak;
}

// Toggle dashboard goal completion
function toggleDashboardGoal(taskId) {
  const events = loadCalendarEvents();
  const idx = events.findIndex(e => e.id === taskId);
  if (idx !== -1) {
    events[idx].completed = !events[idx].completed;
    saveCalendarEvents(events);
    renderCurrentView();
  }
}

function generateAIGreeting(todayTasks, upcomingEvents, projects) {
  const hour = new Date().getHours();
  let greeting = 'Hello!';
  if (hour < 12) greeting = 'Good morning!';
  else if (hour < 18) greeting = 'Good afternoon!';
  else greeting = 'Good evening!';
  
  let message = `${greeting} Here's your daily overview:\n\n`;
  
  // Today's Tasks
  message += `📋 Today's Tasks:\n`;
  if (todayTasks.length === 0) {
    message += `• No tasks scheduled for today — great time to plan ahead or tackle pending items.\n\n`;
  } else {
    todayTasks.slice(0, 4).forEach(task => {
      const timeStr = task.time ? ` at ${task.time}` : '';
      message += `• ${task.title}${timeStr}\n`;
    });
    if (todayTasks.length > 4) {
      message += `• ...and ${todayTasks.length - 4} more task${todayTasks.length - 4 > 1 ? 's' : ''}\n`;
    }
    message += `\n`;
  }
  
  // Upcoming This Week
  const futureTasks = upcomingEvents.filter(e => e.date !== new Date().toISOString().split('T')[0]);
  message += `📅 Upcoming This Week:\n`;
  if (futureTasks.length === 0) {
    message += `• No upcoming tasks scheduled — consider planning your week.\n\n`;
  } else {
    futureTasks.slice(0, 3).forEach(task => {
      const eventDate = new Date(task.date);
      const dayLabel = eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      message += `• ${task.title} — ${dayLabel}\n`;
    });
    if (futureTasks.length > 3) {
      message += `• ...and ${futureTasks.length - 3} more upcoming\n`;
    }
    message += `\n`;
  }
  
  // Projects Overview
  message += `🚀 Projects:\n`;
  if (projects.length === 0) {
    message += `• No active projects — create one to organize your work.\n\n`;
  } else {
    message += `• You have ${projects.length} active project${projects.length > 1 ? 's' : ''} to manage.\n\n`;
  }
  
  // Priority Tips
  message += `💡 Focus Tip:\n`;
  if (todayTasks.length > 3) {
    message += `• You have multiple tasks today. Consider prioritizing the most important ones first.`;
  } else if (todayTasks.length === 0 && futureTasks.length > 0) {
    message += `• Clear day today! Perfect for deep work or preparing for upcoming tasks.`;
  } else if (todayTasks.length > 0) {
    message += `• Stay focused and tackle your tasks one at a time. You've got this!`;
  } else {
    message += `• A quiet week ahead. Use this time to set new goals or reflect on progress.`;
  }
  
  return message;
}

function startAITypingAnimation() {
  const msgEl = document.getElementById('aiGreetingMessage');
  if (!msgEl) return;
  
  const fullText = msgEl.dataset.fullMessage;
  const typingEl = msgEl.querySelector('.ai-typing-text');
  const cursorEl = msgEl.querySelector('.ai-cursor');
  
  if (!typingEl || !fullText) return;
  
  let charIndex = 0;
  const typingSpeed = 30; // ms per character
  
  function typeChar() {
    if (charIndex < fullText.length) {
      typingEl.textContent = fullText.substring(0, charIndex + 1);
      charIndex++;
      setTimeout(typeChar, typingSpeed);
    } else {
      // Done typing, hide cursor after a moment
      setTimeout(() => {
        if (cursorEl) cursorEl.style.display = 'none';
      }, 1000);
    }
  }
  
  typeChar();
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
                 onclick="event.stopPropagation(); setExpandedTask(${ev.id})"
                 oncontextmenu="event.preventDefault(); event.stopPropagation(); showTaskContextMenu(event, ${ev.id})"
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
                  <div class="task-actions-row">
                    <button class="task-action-btn duplicate-btn" 
                            onclick="event.stopPropagation(); duplicateCalendarTask(${ev.id})"
                            title="Duplicate">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    </button>
                    <button class="task-action-btn edit-btn" 
                            onclick="event.stopPropagation(); openEditTaskModal(${ev.id})"
                            title="Edit">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button class="task-action-btn delete-btn" 
                            onclick="event.stopPropagation(); deleteTask(${ev.id})"
                            title="Delete">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m5 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      </svg>
                    </button>
                  </div>
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
        <!-- All Tasks Section (NEW) - Unique tasks only -->
        <div class="sidebar-section">
          <div class="sidebar-section-header">
            <h3>All Tasks</h3>
            <span class="task-count-badge">${getUniqueTasksByTitle(events).length}</span>
          </div>
          ${events.length === 0 ? `
            <div class="recurring-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 40px; height: 40px; opacity: 0.4;">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              <p>No tasks scheduled</p>
              <span>Click a day to add a task</span>
            </div>
          ` : `
            <div class="sidebar-tasks-list">
              ${getUniqueTasksByTitle(events).slice(0, 15).map(ev => {
                const colorVar = '--event-' + (ev.color || 'blue');
                const eventDate = new Date(ev.date);
                const dateLabel = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return `
                  <div class="sidebar-task-item"
                       draggable="true"
                       ondragstart="handleSidebarDragStart(event, ${ev.id})"
                       style="border-left: 3px solid var(${colorVar});">
                    <div class="sidebar-task-main" onclick="openEditTaskModal(${ev.id})">
                      <div class="sidebar-task-title">${ev.title}</div>
                      <div class="sidebar-task-meta">
                        <span>${dateLabel}</span>
                        ${ev.time ? ' • ' + ev.time : ''}
                        ${ev.isRecurring ? ' <span class="recurring-mini-badge">↻</span>' : ''}
                      </div>
                    </div>
                    <div class="sidebar-task-actions">
                      <button class="sidebar-task-btn" onclick="event.stopPropagation(); duplicateCalendarTask(${ev.id})" title="Duplicate to another day">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
                          <rect x="9" y="9" width="13" height="13" rx="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      </button>
                      <button class="sidebar-task-btn edit" onclick="event.stopPropagation(); openEditTaskModal(${ev.id})" title="Edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
              ${getUniqueTasksByTitle(events).length > 15 ? '<div class="sidebar-more-hint">+ ' + (getUniqueTasksByTitle(events).length - 15) + ' more tasks</div>' : ''}
            </div>
          `}
        </div>

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
            <strong>Pro tip:</strong> Drag tasks from sidebar to a day to duplicate. Right-click to edit.
          </div>
        </div>
      </div>
    </div>
  `;
}

// Helper: Get unique tasks by title (show each name only once)
function getUniqueTasksByTitle(events) {
  const seen = new Set();
  return events.filter(ev => {
    if (seen.has(ev.title)) return false;
    seen.add(ev.title);
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));
}

// Context menu for schedule tasks
function showTaskContextMenu(event, eventId) {
  // Remove any existing context menu
  const existingMenu = document.getElementById('taskContextMenu');
  if (existingMenu) existingMenu.remove();
  
  const menu = document.createElement('div');
  menu.id = 'taskContextMenu';
  menu.className = 'task-context-menu';
  menu.innerHTML = `
    <button class="context-menu-item" onclick="duplicateCalendarTask(${eventId}); hideTaskContextMenu();">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
        <rect x="9" y="9" width="13" height="13" rx="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
      Duplicate
    </button>
    <button class="context-menu-item" onclick="openEditTaskModal(${eventId}); hideTaskContextMenu();">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      Edit
    </button>
    <button class="context-menu-item delete" onclick="deleteTask(${eventId}); hideTaskContextMenu();">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m5 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
      </svg>
      Delete
    </button>
  `;
  
  menu.style.left = event.clientX + 'px';
  menu.style.top = event.clientY + 'px';
  
  document.body.appendChild(menu);
  
  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', hideTaskContextMenu, { once: true });
  }, 10);
}

function hideTaskContextMenu() {
  const menu = document.getElementById('taskContextMenu');
  if (menu) menu.remove();
}

// Drag handlers
function handleDragStart(event, eventId, currentDate) {
  event.dataTransfer.setData('text/plain', JSON.stringify({ id: eventId, fromDate: currentDate, type: 'move' }));
  event.currentTarget.classList.add('dragging');
}

// Sidebar drag handler - for duplicating
function handleSidebarDragStart(event, eventId) {
  event.dataTransfer.setData('text/plain', JSON.stringify({ id: eventId, type: 'duplicate' }));
  event.currentTarget.classList.add('dragging');
}

function handleDrop(event, targetDate) {
  event.preventDefault();
  const data = JSON.parse(event.dataTransfer.getData('text/plain'));
  const { id, fromDate, type } = data;

  let events = loadCalendarEvents();
  const task = events.find(e => e.id === id);
  if (!task) return;

  if (type === 'duplicate') {
    // Create a duplicate on the target date
    const newTask = {
      id: Date.now() + Math.floor(Math.random() * 10000),
      title: task.title,
      date: targetDate,
      time: task.time || null,
      color: task.color || 'blue',
      isRecurring: false,
      recurringId: null
    };
    events.push(newTask);
    saveCalendarEvents(events);
    showToast(`Task duplicated to ${targetDate}`);
  } else {
    // Move task to new date
    if (fromDate === targetDate) return;
    const taskIndex = events.findIndex(e => e.id === id);
    if (taskIndex === -1) return;
    events[taskIndex].date = targetDate;
    saveCalendarEvents(events);
  }

  saveExpandedTaskId(null);
  renderCurrentView();
}

// Duplicate a calendar task - opens modal to select date
function duplicateCalendarTask(eventId) {
  const events = loadCalendarEvents();
  const task = events.find(e => e.id === eventId);
  if (!task) return;

  const today = new Date().toISOString().split('T')[0];
  
  const content = `
    <form id="duplicateTaskForm" onsubmit="handleDuplicateTaskSubmit(event, ${eventId})">
      <div class="form-group">
        <label class="form-label">Duplicate Task</label>
        <p style="color: var(--muted-foreground); font-size: 14px; margin-bottom: 16px;">
          Creating a copy of "<strong>${task.title}</strong>"
        </p>
      </div>
      <div class="form-group">
        <label class="form-label">Select new date <span class="required">*</span></label>
        <input type="date" name="date" class="form-input" value="${today}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Time (optional)</label>
        <input type="time" name="time" class="form-input" value="${task.time || ''}">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Duplicate Task</button>
      </div>
    </form>
  `;
  openModal('Duplicate Task', content);
}

function handleDuplicateTaskSubmit(e, originalEventId) {
  e.preventDefault();
  const form = e.target;
  const data = new FormData(form);
  
  const date = data.get('date');
  const time = data.get('time');
  
  if (!date) return;
  
  const events = loadCalendarEvents();
  const originalTask = events.find(ev => ev.id === originalEventId);
  if (!originalTask) return;
  
  const newTask = {
    id: Date.now() + Math.floor(Math.random() * 10000),
    title: originalTask.title,
    date: date,
    time: time || originalTask.time || null,
    color: originalTask.color || 'blue',
    isRecurring: false,
    recurringId: null
  };
  
  events.push(newTask);
  saveCalendarEvents(events);
  
  closeModal();
  showToast('Task duplicated successfully!');
  renderCurrentView();
}

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
/* ============================================
   Layer - Create Features (Doc, Excel, Space)
   ============================================ */

// Storage keys
const DOCS_KEY = 'layerDocs';
const EXCELS_KEY = 'layerExcels';
const SPACES_KEY = 'layerSpaces';

// State
let currentDocId = null;
let currentExcelId = null;
let currentSpaceId = null; // Track which space we're in for saving docs/excels

// ============================================
// Create Dropdown (legacy - moved to sidebar)
// ============================================
function toggleCreateDropdown() {
  const container = document.getElementById('createDropdownContainer');
  if (container) {
    container.classList.toggle('open');
  }
}

// Sidebar Create Dropdown
function toggleSidebarCreateDropdown() {
  const dropdown = document.getElementById('sidebarCreateDropdown');
  const btn = document.getElementById('sidebarCreateBtn');
  if (dropdown && btn) {
    dropdown.classList.toggle('show');
    btn.classList.toggle('active');
  }
}

function closeSidebarCreateDropdown() {
  const dropdown = document.getElementById('sidebarCreateDropdown');
  const btn = document.getElementById('sidebarCreateBtn');
  if (dropdown) dropdown.classList.remove('show');
  if (btn) btn.classList.remove('active');
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  const container = document.getElementById('createDropdownContainer');
  if (container && !container.contains(e.target)) {
    container.classList.remove('open');
  }
  
  // Sidebar create dropdown
  const sidebarDropdown = document.getElementById('sidebarCreateDropdown');
  const sidebarBtn = document.getElementById('sidebarCreateBtn');
  if (sidebarDropdown && sidebarBtn && !sidebarDropdown.contains(e.target) && !sidebarBtn.contains(e.target)) {
    sidebarDropdown.classList.remove('show');
    sidebarBtn.classList.remove('active');
  }
});

// ============================================
// Doc Storage
// ============================================
function loadDocs() {
  try {
    return JSON.parse(localStorage.getItem(DOCS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveDocs(docs) {
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
}

function addDoc(doc) {
  const docs = loadDocs();
  docs.unshift(doc);
  saveDocs(docs);
  return doc;
}

function updateDoc(id, updates) {
  const docs = loadDocs();
  const index = docs.findIndex(d => d.id === id);
  if (index !== -1) {
    docs[index] = { ...docs[index], ...updates, updatedAt: new Date().toISOString() };
    saveDocs(docs);
  }
}

function deleteDoc(id) {
  let docs = loadDocs();
  docs = docs.filter(d => d.id !== id);
  saveDocs(docs);
}

// ============================================
// Doc Editor - Professional Word-like UI
// ============================================
function openDocEditor(docId = null) {
  toggleCreateDropdown();
  
  let doc = null;
  if (docId) {
    const docs = loadDocs();
    doc = docs.find(d => d.id === docId);
  }
  
  currentDocId = doc ? doc.id : Date.now();
  const isFavorited = doc ? isDocFavorited(doc.id) : false;
  
  const overlay = document.createElement('div');
  overlay.className = 'doc-editor-overlay';
  overlay.id = 'docEditorOverlay';
  
  overlay.innerHTML = `
    <div class="doc-editor-container word-style">
      <!-- Professional Header Bar -->
      <div class="doc-editor-header word-header">
        <div class="doc-header-left">
          <button class="doc-back-btn" onclick="closeDocEditor()" title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div class="doc-title-container">
            <input type="text" class="doc-title-input" id="docTitleInput" 
                   placeholder="Untitled Document" value="${doc ? doc.title : ''}" />
            <span class="doc-saved-indicator" id="docSavedIndicator" style="display:none;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:hsl(142, 71%, 45%);">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              Saved
            </span>
          </div>
        </div>
        <div class="doc-header-right">
          <button class="doc-favorite-btn ${isFavorited ? 'is-favorite' : ''}" data-favorite-doc="${currentDocId}" onclick="toggleDocFavorite(${currentDocId})" title="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}">
            <svg viewBox="0 0 24 24" fill="${isFavorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
          <button class="doc-export-btn" onclick="exportDocAsPDF()" title="Export as PDF">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button class="doc-print-btn" onclick="printDoc()" title="Print">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
          </button>
          <button class="doc-save-btn btn-themed-primary" onclick="saveCurrentDoc()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            Save
          </button>
        </div>
      </div>
      
      <!-- Professional Toolbar - Word-like -->
      <div class="doc-toolbar word-toolbar">
        <!-- File operations -->
        <div class="toolbar-section">
          <div class="toolbar-group">
            <select class="toolbar-select font-family-select" id="docFontSelect" onchange="execDocCommand('fontName', this.value)">
              <option value="inherit">Default Font</option>
              <option value="Arial, sans-serif">Arial</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="Times New Roman, serif">Times New Roman</option>
              <option value="Courier New, monospace">Courier New</option>
              <option value="Verdana, sans-serif">Verdana</option>
            </select>
          </div>
          
          <div class="toolbar-group">
            <select class="toolbar-select font-size-select" id="docFontSizeSelect" onchange="setFontSize(this.value)">
              <option value="1">8pt</option>
              <option value="2">10pt</option>
              <option value="3" selected>12pt</option>
              <option value="4">14pt</option>
              <option value="5">18pt</option>
              <option value="6">24pt</option>
              <option value="7">36pt</option>
            </select>
          </div>
          
          <div class="toolbar-group">
            <select class="toolbar-select heading-select" id="docHeadingSelect" onchange="execDocCommand('formatBlock', this.value)">
              <option value="p">Paragraph</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="h4">Heading 4</option>
              <option value="blockquote">Quote</option>
              <option value="pre">Code Block</option>
            </select>
          </div>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <!-- Text formatting -->
        <div class="toolbar-section">
          <div class="toolbar-group">
            <button class="toolbar-btn" id="btnBold" onclick="execDocCommand('bold')" title="Bold (Ctrl+B)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;">
                <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
                <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
              </svg>
            </button>
            <button class="toolbar-btn" id="btnItalic" onclick="execDocCommand('italic')" title="Italic (Ctrl+I)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <line x1="19" y1="4" x2="10" y2="4"/>
                <line x1="14" y1="20" x2="5" y2="20"/>
                <line x1="15" y1="4" x2="9" y2="20"/>
              </svg>
            </button>
            <button class="toolbar-btn" id="btnUnderline" onclick="execDocCommand('underline')" title="Underline (Ctrl+U)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/>
                <line x1="4" y1="21" x2="20" y2="21"/>
              </svg>
            </button>
            <button class="toolbar-btn" id="btnStrike" onclick="execDocCommand('strikeThrough')" title="Strikethrough">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <line x1="4" y1="12" x2="20" y2="12"/>
                <path d="M17.5 7.5c-.8-1.5-2.8-2.5-5.5-2.5-3 0-5.5 1.3-5.5 4 0 2.1 1.7 3.2 3.5 3.7"/>
                <path d="M9.5 14.5c.8 1.5 2.8 2.5 5.5 2.5 3 0 5.5-1.3 5.5-4"/>
              </svg>
            </button>
          </div>
          
          <div class="toolbar-group">
            <button class="toolbar-btn" onclick="execDocCommand('subscript')" title="Subscript">
              <span style="font-size:12px;font-weight:600;">X<sub style="font-size:8px;">2</sub></span>
            </button>
            <button class="toolbar-btn" onclick="execDocCommand('superscript')" title="Superscript">
              <span style="font-size:12px;font-weight:600;">X<sup style="font-size:8px;">2</sup></span>
            </button>
          </div>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <!-- Colors -->
        <div class="toolbar-section">
          <div class="toolbar-group">
            <div class="color-picker-container" title="Text Color">
              <span class="color-picker-icon">A</span>
              <input type="color" class="color-picker-input" id="textColorPicker" value="#ffffff" 
                     onchange="execDocCommand('foreColor', this.value)" />
            </div>
            <div class="color-picker-container highlight" title="Highlight">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <path d="M9 11l-6 6v3h9l3-3"/>
                <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
              </svg>
              <input type="color" class="color-picker-input" id="bgColorPicker" value="#facc15" 
                     onchange="execDocCommand('hiliteColor', this.value)" />
            </div>
          </div>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <!-- Lists -->
        <div class="toolbar-section">
          <div class="toolbar-group">
            <button class="toolbar-btn" onclick="execDocCommand('insertUnorderedList')" title="Bullet List">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <line x1="9" y1="6" x2="20" y2="6"/>
                <line x1="9" y1="12" x2="20" y2="12"/>
                <line x1="9" y1="18" x2="20" y2="18"/>
                <circle cx="5" cy="6" r="1" fill="currentColor"/>
                <circle cx="5" cy="12" r="1" fill="currentColor"/>
                <circle cx="5" cy="18" r="1" fill="currentColor"/>
              </svg>
            </button>
            <button class="toolbar-btn" onclick="execDocCommand('insertOrderedList')" title="Numbered List">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <line x1="10" y1="6" x2="21" y2="6"/>
                <line x1="10" y1="12" x2="21" y2="12"/>
                <line x1="10" y1="18" x2="21" y2="18"/>
                <path d="M4 6h1v4"/>
                <path d="M4 10h2"/>
                <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <!-- Alignment -->
        <div class="toolbar-section">
          <div class="toolbar-group">
            <button class="toolbar-btn" onclick="execDocCommand('justifyLeft')" title="Align Left">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="15" y2="12"/>
                <line x1="3" y1="18" x2="18" y2="18"/>
              </svg>
            </button>
            <button class="toolbar-btn" onclick="execDocCommand('justifyCenter')" title="Align Center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="6" y1="12" x2="18" y2="12"/>
                <line x1="4" y1="18" x2="20" y2="18"/>
              </svg>
            </button>
            <button class="toolbar-btn" onclick="execDocCommand('justifyRight')" title="Align Right">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="9" y1="12" x2="21" y2="12"/>
                <line x1="6" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <button class="toolbar-btn" onclick="execDocCommand('justifyFull')" title="Justify">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <!-- Indent -->
        <div class="toolbar-section">
          <div class="toolbar-group">
            <button class="toolbar-btn" onclick="execDocCommand('outdent')" title="Decrease Indent">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <polyline points="7 8 3 12 7 16"/>
                <line x1="21" y1="12" x2="11" y2="12"/>
                <line x1="21" y1="6" x2="11" y2="6"/>
                <line x1="21" y1="18" x2="11" y2="18"/>
              </svg>
            </button>
            <button class="toolbar-btn" onclick="execDocCommand('indent')" title="Increase Indent">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <polyline points="3 8 7 12 3 16"/>
                <line x1="21" y1="12" x2="11" y2="12"/>
                <line x1="21" y1="6" x2="11" y2="6"/>
                <line x1="21" y1="18" x2="11" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <!-- Insert -->
        <div class="toolbar-section">
          <div class="toolbar-group">
            <button class="toolbar-btn" onclick="insertLink()" title="Insert Link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            </button>
            <button class="toolbar-btn" onclick="insertImage()" title="Insert Image">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </button>
            <button class="toolbar-btn" onclick="insertTable()" title="Insert Table">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="3" y1="15" x2="21" y2="15"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
                <line x1="15" y1="3" x2="15" y2="21"/>
              </svg>
            </button>
            <button class="toolbar-btn" onclick="insertHorizontalRule()" title="Horizontal Line">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <line x1="3" y1="12" x2="21" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <!-- Undo/Redo -->
        <div class="toolbar-section">
          <div class="toolbar-group">
            <button class="toolbar-btn" onclick="execDocCommand('undo')" title="Undo (Ctrl+Z)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <path d="M3 7v6h6"/>
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
              </svg>
            </button>
            <button class="toolbar-btn" onclick="execDocCommand('redo')" title="Redo (Ctrl+Y)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <path d="M21 7v6h-6"/>
                <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <!-- Clear formatting -->
        <div class="toolbar-section">
          <div class="toolbar-group">
            <button class="toolbar-btn" onclick="execDocCommand('removeFormat')" title="Clear Formatting">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <path d="M17 17H7a5 5 0 0 1-5-5 5 5 0 0 1 5-5h14"/>
                <path d="m18 11-3 3-3-3"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Document Content Area - Paper Style -->
      <div class="doc-content-area word-content-area">
        <div class="doc-paper-container">
          <div class="doc-editor-content word-editor-content" id="docEditorContent" contenteditable="true" spellcheck="true">${doc ? doc.content : '<p></p>'}</div>
        </div>
      </div>
      
      <!-- Status Bar -->
      <div class="doc-status-bar">
        <div class="status-left">
          <span id="wordCount">Words: 0</span>
          <span class="status-divider">|</span>
          <span id="charCount">Characters: 0</span>
        </div>
        <div class="status-right">
          <span id="lastSaved">${doc ? 'Last saved: ' + formatTimeAgo(doc.updatedAt) : 'Not saved'}</span>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  
  // Set up word count updates
  setupWordCount();
  
  // Focus on content if new doc, title if editing
  if (!doc) {
    setTimeout(() => {
      document.getElementById('docTitleInput')?.focus();
    }, 100);
  }
}

function closeDocEditor() {
  const overlay = document.getElementById('docEditorOverlay');
  if (overlay) {
    overlay.remove();
    document.body.style.overflow = '';
  }
  currentDocId = null;
}

function execDocCommand(command, value = null) {
  document.execCommand(command, false, value);
  document.getElementById('docEditorContent')?.focus();
}

function setFontSize(size) {
  document.execCommand('fontSize', false, size);
  document.getElementById('docEditorContent')?.focus();
}

function setupWordCount() {
  const contentDiv = document.getElementById('docEditorContent');
  if (!contentDiv) return;
  
  const updateCount = () => {
    const text = contentDiv.innerText || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    
    const wordCountEl = document.getElementById('wordCount');
    const charCountEl = document.getElementById('charCount');
    
    if (wordCountEl) wordCountEl.textContent = `Words: ${words}`;
    if (charCountEl) charCountEl.textContent = `Characters: ${chars}`;
  };
  
  contentDiv.addEventListener('input', updateCount);
  updateCount();
}

function insertLink() {
  const url = prompt('Enter URL:', 'https://');
  if (url) {
    document.execCommand('createLink', false, url);
    document.getElementById('docEditorContent')?.focus();
  }
}

function insertImage() {
  const url = prompt('Enter image URL:', 'https://');
  if (url) {
    document.execCommand('insertImage', false, url);
    document.getElementById('docEditorContent')?.focus();
  }
}

function insertTable() {
  const rows = prompt('Number of rows:', '3') || '3';
  const cols = prompt('Number of columns:', '3') || '3';
  
  let tableHtml = '<table style="border-collapse: collapse; width: 100%; margin: 16px 0;">';
  for (let r = 0; r < parseInt(rows); r++) {
    tableHtml += '<tr>';
    for (let c = 0; c < parseInt(cols); c++) {
      tableHtml += '<td style="border: 1px solid var(--border); padding: 8px; min-width: 80px;">&nbsp;</td>';
    }
    tableHtml += '</tr>';
  }
  tableHtml += '</table>';
  
  document.execCommand('insertHTML', false, tableHtml);
  document.getElementById('docEditorContent')?.focus();
}

function insertHorizontalRule() {
  document.execCommand('insertHorizontalRule', false, null);
  document.getElementById('docEditorContent')?.focus();
}

function exportDocAsPDF() {
  showToast('PDF export feature coming soon!');
}

function printDoc() {
  const content = document.getElementById('docEditorContent');
  const title = document.getElementById('docTitleInput')?.value || 'Document';
  
  if (!content) return;
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Georgia, serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.7; }
        h1 { font-size: 24px; font-weight: bold; margin-bottom: 24px; }
        h2 { font-size: 20px; font-weight: bold; margin: 20px 0 16px; }
        h3 { font-size: 18px; font-weight: bold; margin: 16px 0 12px; }
        p { margin: 12px 0; }
        ul, ol { margin: 12px 0; padding-left: 24px; }
        table { border-collapse: collapse; width: 100%; margin: 16px 0; }
        td, th { border: 1px solid #ddd; padding: 8px; }
        blockquote { margin: 16px 0; padding-left: 16px; border-left: 4px solid #3b82f6; color: #666; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      ${content.innerHTML}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

function saveCurrentDoc() {
  const titleInput = document.getElementById('docTitleInput');
  const contentDiv = document.getElementById('docEditorContent');
  
  if (!titleInput || !contentDiv) return;
  
  const title = titleInput.value.trim() || 'Untitled Document';
  const content = contentDiv.innerHTML;
  
  const docs = loadDocs();
  const existingIndex = docs.findIndex(d => d.id === currentDocId);
  
  if (existingIndex !== -1) {
    docs[existingIndex] = {
      ...docs[existingIndex],
      title,
      content,
      updatedAt: new Date().toISOString()
    };
  } else {
    docs.unshift({
      id: currentDocId,
      title,
      content,
      spaceId: currentSpaceId, // Associate with current space
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  saveDocs(docs);
  
  // Show saved indicator
  const indicator = document.getElementById('docSavedIndicator');
  if (indicator) {
    indicator.style.display = 'flex';
    setTimeout(() => indicator.style.display = 'none', 2000);
  }
  
  // Update last saved
  const lastSaved = document.getElementById('lastSaved');
  if (lastSaved) {
    lastSaved.textContent = 'Saved just now';
  }
  
  // Refresh favorites sidebar
  renderFavoritesInSidebar();
  
  // Show success notification
  showToast('Document saved successfully!');
}

// ============================================
// Excel Storage
// ============================================
function loadExcels() {
  try {
    return JSON.parse(localStorage.getItem(EXCELS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveExcels(excels) {
  localStorage.setItem(EXCELS_KEY, JSON.stringify(excels));
}

// ============================================
// Excel Editor
// ============================================
const DEFAULT_ROWS = 20;
const DEFAULT_COLS = 10;
const COLUMN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function openExcelEditor(excelId = null) {
  toggleCreateDropdown();
  
  let excel = null;
  if (excelId) {
    const excels = loadExcels();
    excel = excels.find(e => e.id === excelId);
  }
  
  currentExcelId = excel ? excel.id : Date.now();
  const data = excel ? excel.data : createEmptyGrid(DEFAULT_ROWS, DEFAULT_COLS);
  const isFavorited = excel ? isExcelFavorited(excel.id) : false;
  
  const overlay = document.createElement('div');
  overlay.className = 'excel-editor-overlay';
  overlay.id = 'excelEditorOverlay';
  
  overlay.innerHTML = `
    <div class="excel-editor-container">
      <div class="excel-header">
        <div class="excel-header-left">
          <button class="doc-back-btn" onclick="closeExcelEditor()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <input type="text" class="excel-title-input" id="excelTitleInput" 
                 placeholder="Untitled Spreadsheet" value="${excel ? excel.title : ''}" />
        </div>
        <div class="doc-header-right">
          <button class="excel-favorite-btn ${isFavorited ? 'is-favorite' : ''}" data-favorite-excel="${currentExcelId}" onclick="toggleExcelFavorite(${currentExcelId})" title="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}">
            <svg viewBox="0 0 24 24" fill="${isFavorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
          <button class="doc-save-btn" onclick="saveCurrentExcel()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            Save
          </button>
        </div>
      </div>
      
      <div class="excel-toolbar">
        <button class="excel-toolbar-btn" onclick="addExcelRow()">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add Row
        </button>
        <button class="excel-toolbar-btn" onclick="addExcelColumn()">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add Column
        </button>
      </div>
      
      <div class="excel-content-area">
        <div class="excel-grid" id="excelGrid" style="grid-template-columns: 50px repeat(${data[0]?.length || DEFAULT_COLS}, 120px);">
          ${renderExcelGrid(data)}
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

function createEmptyGrid(rows, cols) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push('');
    }
    grid.push(row);
  }
  return grid;
}

function renderExcelGrid(data) {
  const cols = data[0]?.length || DEFAULT_COLS;
  let html = '';
  
  // Header row
  html += '<div class="excel-header-row">';
  html += '<div class="excel-header-cell"></div>';
  for (let c = 0; c < cols; c++) {
    html += `<div class="excel-header-cell">${COLUMN_LETTERS[c] || c + 1}</div>`;
  }
  html += '</div>';
  
  // Data rows
  data.forEach((row, rowIndex) => {
    html += `<div class="excel-row-header">${rowIndex + 1}</div>`;
    row.forEach((cell, colIndex) => {
      html += `<div class="excel-cell">
        <input type="text" value="${cell}" data-row="${rowIndex}" data-col="${colIndex}" 
               onchange="updateExcelCell(${rowIndex}, ${colIndex}, this.value)" />
      </div>`;
    });
  });
  
  return html;
}

function updateExcelCell(row, col, value) {
  // Update happens on save
}

function getExcelData() {
  const inputs = document.querySelectorAll('#excelGrid .excel-cell input');
  const data = [];
  let maxRow = 0;
  let maxCol = 0;
  
  inputs.forEach(input => {
    const row = parseInt(input.dataset.row);
    const col = parseInt(input.dataset.col);
    if (row > maxRow) maxRow = row;
    if (col > maxCol) maxCol = col;
  });
  
  for (let r = 0; r <= maxRow; r++) {
    data.push([]);
    for (let c = 0; c <= maxCol; c++) {
      data[r].push('');
    }
  }
  
  inputs.forEach(input => {
    const row = parseInt(input.dataset.row);
    const col = parseInt(input.dataset.col);
    data[row][col] = input.value;
  });
  
  return data;
}

function addExcelRow() {
  const data = getExcelData();
  const cols = data[0]?.length || DEFAULT_COLS;
  data.push(new Array(cols).fill(''));
  refreshExcelGrid(data);
}

function addExcelColumn() {
  const data = getExcelData();
  data.forEach(row => row.push(''));
  refreshExcelGrid(data);
}

function refreshExcelGrid(data) {
  const grid = document.getElementById('excelGrid');
  if (grid) {
    grid.style.gridTemplateColumns = `50px repeat(${data[0]?.length}, 120px)`;
    grid.innerHTML = renderExcelGrid(data);
  }
}

function closeExcelEditor() {
  const overlay = document.getElementById('excelEditorOverlay');
  if (overlay) {
    overlay.remove();
    document.body.style.overflow = '';
  }
  currentExcelId = null;
}

function saveCurrentExcel() {
  const titleInput = document.getElementById('excelTitleInput');
  if (!titleInput) return;
  
  const title = titleInput.value.trim() || 'Untitled Spreadsheet';
  const data = getExcelData();
  
  const excels = loadExcels();
  const existingIndex = excels.findIndex(e => e.id === currentExcelId);
  
  if (existingIndex !== -1) {
    excels[existingIndex] = {
      ...excels[existingIndex],
      title,
      data,
      updatedAt: new Date().toISOString()
    };
  } else {
    excels.unshift({
      id: currentExcelId,
      title,
      data,
      spaceId: currentSpaceId, // Associate with current space
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  saveExcels(excels);
  showToast('Spreadsheet saved successfully!');
  closeExcelEditor();
  
  // Refresh favorites sidebar
  renderFavoritesInSidebar();
}

// ============================================
// Spaces
// ============================================
function loadSpaces() {
  try {
    return JSON.parse(localStorage.getItem(SPACES_KEY)) || [];
  } catch {
    return [];
  }
}

function saveSpaces(spaces) {
  localStorage.setItem(SPACES_KEY, JSON.stringify(spaces));
}

// Minimalistic SVG icons for spaces (instead of emojis)
const SPACE_ICON_SVGS = [
  { id: 'folder', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' },
  { id: 'home', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
  { id: 'briefcase', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>' },
  { id: 'target', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>' },
  { id: 'rocket', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>' },
  { id: 'lightbulb', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>' },
  { id: 'bar-chart', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>' },
  { id: 'palette', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/></svg>' },
  { id: 'edit', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' },
  { id: 'star', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' },
  { id: 'zap', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' },
  { id: 'layers', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>' },
  { id: 'users', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
  { id: 'code', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' },
  { id: 'globe', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' },
  { id: 'book', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' }
];

function openNewSpaceModal() {
  toggleCreateDropdown();
  
  const projects = loadProjects();
  
  const content = `
    <form id="newSpaceForm" onsubmit="handleCreateSpace(event)" class="new-space-form">
      <div class="form-group">
        <label class="form-label">Space Name <span class="required">*</span></label>
        <input type="text" name="name" class="form-input" required placeholder="e.g. Marketing, Development..." />
      </div>
      
      <div class="form-group">
        <label class="form-label">Choose an Icon</label>
        <div class="space-icon-grid-svg" id="spaceIconGrid">
          ${SPACE_ICON_SVGS.map((icon, index) => `
            <button type="button" class="space-icon-svg-option ${index === 0 ? 'selected' : ''}" 
                    data-icon="${icon.id}" onclick="selectSpaceIcon(this)">
              ${icon.svg}
            </button>
          `).join('')}
        </div>
        <input type="hidden" name="icon" id="selectedSpaceIcon" value="${SPACE_ICON_SVGS[0].id}" />
      </div>
      
      <div class="form-group">
        <label class="form-label">Description <span style="color: var(--muted-foreground); font-weight: normal;">(optional)</span></label>
        <textarea name="description" class="form-textarea" placeholder="What is this space for?" rows="2"></textarea>
      </div>
      
      <div class="optional-fields-toggle" onclick="toggleOptionalFields()">
        <svg class="icon optional-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <span>Add more details</span>
      </div>
      
      <div class="optional-fields" id="optionalFields" style="display: none;">
        <div class="form-group">
          <label class="form-label">Due Date <span style="color: var(--muted-foreground); font-weight: normal;">(optional)</span></label>
          <input type="date" name="dueDate" class="form-input" />
        </div>
        
        <div class="form-group">
          <label class="form-label">Link with Project <span style="color: var(--muted-foreground); font-weight: normal;">(optional)</span></label>
          <select name="linkedProject" class="form-select">
            <option value="">No linked project</option>
            ${projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">Invite Team Members <span style="color: var(--muted-foreground); font-weight: normal;">(optional)</span></label>
          <div class="team-invite-input-container">
            <input type="email" id="teamMemberEmail" class="form-input" placeholder="Enter email address" />
            <button type="button" class="btn btn-secondary btn-sm" onclick="addTeamMemberToSpace()">Add</button>
          </div>
          <div id="invitedMembersList" class="invited-members-list"></div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Color Tag <span style="color: var(--muted-foreground); font-weight: normal;">(optional)</span></label>
          <div class="color-tag-options">
            <button type="button" class="color-tag-option selected" data-color="none" onclick="selectColorTag(this)" style="background: var(--surface); border: 2px dashed var(--border);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;opacity:0.5;"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <button type="button" class="color-tag-option" data-color="blue" onclick="selectColorTag(this)" style="background: hsl(217, 91%, 60%);"></button>
            <button type="button" class="color-tag-option" data-color="green" onclick="selectColorTag(this)" style="background: hsl(142, 71%, 45%);"></button>
            <button type="button" class="color-tag-option" data-color="purple" onclick="selectColorTag(this)" style="background: hsl(271, 91%, 65%);"></button>
            <button type="button" class="color-tag-option" data-color="orange" onclick="selectColorTag(this)" style="background: hsl(24, 90%, 60%);"></button>
            <button type="button" class="color-tag-option" data-color="red" onclick="selectColorTag(this)" style="background: hsl(0, 84%, 60%);"></button>
          </div>
          <input type="hidden" name="colorTag" id="selectedColorTag" value="none" />
        </div>
      </div>
      
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-themed-primary">Create Space</button>
      </div>
    </form>
  `;
  
  openModal('Create New Space', content);
}

// Store invited team members temporarily
let pendingInvitedMembers = [];

function addTeamMemberToSpace() {
  const emailInput = document.getElementById('teamMemberEmail');
  const email = emailInput.value.trim();
  
  if (!email || !email.includes('@')) {
    emailInput.style.borderColor = 'hsl(0, 84%, 60%)';
    setTimeout(() => emailInput.style.borderColor = '', 2000);
    return;
  }
  
  if (pendingInvitedMembers.includes(email)) return;
  
  pendingInvitedMembers.push(email);
  emailInput.value = '';
  renderInvitedMembers();
}

function removeInvitedMember(email) {
  pendingInvitedMembers = pendingInvitedMembers.filter(e => e !== email);
  renderInvitedMembers();
}

function renderInvitedMembers() {
  const container = document.getElementById('invitedMembersList');
  if (!container) return;
  
  container.innerHTML = pendingInvitedMembers.map(email => `
    <div class="invited-member-chip">
      <span>${email}</span>
      <button type="button" onclick="removeInvitedMember('${email}')" class="remove-member-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
  `).join('');
}

function toggleOptionalFields() {
  const container = document.getElementById('optionalFields');
  const toggle = document.querySelector('.optional-fields-toggle');
  
  if (container.style.display === 'none') {
    container.style.display = 'block';
    toggle.classList.add('expanded');
  } else {
    container.style.display = 'none';
    toggle.classList.remove('expanded');
  }
}

function selectColorTag(button) {
  document.querySelectorAll('.color-tag-option').forEach(btn => btn.classList.remove('selected'));
  button.classList.add('selected');
  document.getElementById('selectedColorTag').value = button.dataset.color;
}

function selectSpaceIcon(button) {
  document.querySelectorAll('.space-icon-svg-option').forEach(btn => btn.classList.remove('selected'));
  button.classList.add('selected');
  document.getElementById('selectedSpaceIcon').value = button.dataset.icon;
}

function handleCreateSpace(event) {
  event.preventDefault();
  
  const form = event.target;
  const name = form.name.value.trim();
  const icon = document.getElementById('selectedSpaceIcon').value;
  const description = form.description?.value?.trim() || '';
  const dueDate = form.dueDate?.value || null;
  const linkedProject = form.linkedProject?.value || null;
  const colorTag = document.getElementById('selectedColorTag')?.value || 'none';
  
  if (!name) return;
  
  const spaces = loadSpaces();
  const newSpace = {
    id: Date.now(),
    name,
    icon,
    description,
    dueDate,
    linkedProject,
    colorTag,
    teamMembers: [...pendingInvitedMembers],
    createdAt: new Date().toISOString()
  };
  
  // Reset pending members
  pendingInvitedMembers = [];
  
  spaces.push(newSpace);
  saveSpaces(spaces);
  
  closeModal();
  renderSpacesInSidebar();
  showToast(`Space "${name}" created!`);
}

function renderSpacesInSidebar() {
  const spaces = loadSpaces();
  const sidebar = document.querySelector('.sidebar-nav');
  
  // Remove existing spaces section
  const existingSection = document.getElementById('spacesSection');
  if (existingSection) {
    existingSection.remove();
  }
  
  if (spaces.length === 0) return;
  
  // Helper function to get SVG icon by id
  function getSpaceIconSVG(iconId) {
    const iconData = SPACE_ICON_SVGS.find(i => i.id === iconId);
    if (iconData) return iconData.svg;
    // Fallback for old emoji-based icons
    return `<span style="font-size:16px;">${iconId}</span>`;
  }
  
  // Create spaces section
  const spacesSection = document.createElement('div');
  spacesSection.id = 'spacesSection';
  spacesSection.innerHTML = `
    <div class="spaces-divider"></div>
    <div class="spaces-section-label">Spaces</div>
    ${spaces.map(space => `
      <div class="custom-space-item-wrapper" ${space.colorTag && space.colorTag !== 'none' ? `style="--space-accent: var(--event-${space.colorTag});"` : ''}>
        <button class="custom-space-item ${space.colorTag && space.colorTag !== 'none' ? 'has-color' : ''}" data-space-id="${space.id}" onclick="openSpaceView(${space.id})">
          <span class="space-icon-svg">${getSpaceIconSVG(space.icon)}</span>
          <span class="space-name-text">${space.name}</span>
        </button>
        <button class="delete-item-btn" onclick="confirmDeleteSpace(${space.id}, '${space.name.replace(/'/g, "\\'")}')" title="Delete space">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    `).join('')}
  `;
  
  sidebar.appendChild(spacesSection);
  
  // Also render favorites section
  renderFavoritesInSidebar();
}

// ============================================
// Favorites System for Documents
// ============================================
const FAVORITES_KEY = 'layerFavorites';
const EXCEL_FAVORITES_KEY = 'layerExcelFavorites';

function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
  } catch {
    return [];
  }
}

function saveFavorites(favorites) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

function loadExcelFavorites() {
  try {
    return JSON.parse(localStorage.getItem(EXCEL_FAVORITES_KEY)) || [];
  } catch {
    return [];
  }
}

function saveExcelFavorites(favorites) {
  localStorage.setItem(EXCEL_FAVORITES_KEY, JSON.stringify(favorites));
}

function toggleDocFavorite(docId) {
  const favorites = loadFavorites();
  const index = favorites.indexOf(docId);
  
  if (index === -1) {
    favorites.push(docId);
    showToast('Added to favorites!');
  } else {
    favorites.splice(index, 1);
    showToast('Removed from favorites');
  }
  
  saveFavorites(favorites);
  renderFavoritesInSidebar();
  
  // Update star icon if visible
  const starBtn = document.querySelector(`[data-favorite-doc="${docId}"]`);
  if (starBtn) {
    starBtn.classList.toggle('is-favorite', index === -1);
  }
}

function toggleExcelFavorite(excelId) {
  const favorites = loadExcelFavorites();
  const index = favorites.indexOf(excelId);
  
  if (index === -1) {
    favorites.push(excelId);
    showToast('Added to favorites!');
  } else {
    favorites.splice(index, 1);
    showToast('Removed from favorites');
  }
  
  saveExcelFavorites(favorites);
  renderFavoritesInSidebar();
  
  // Update star icon if visible
  const starBtn = document.querySelector(`[data-favorite-excel="${excelId}"]`);
  if (starBtn) {
    starBtn.classList.toggle('is-favorite', index === -1);
  }
}

function isDocFavorited(docId) {
  return loadFavorites().includes(docId);
}

function isExcelFavorited(excelId) {
  return loadExcelFavorites().includes(excelId);
}

function renderFavoritesInSidebar() {
  const docFavorites = loadFavorites();
  const excelFavorites = loadExcelFavorites();
  const docs = loadDocs();
  const excels = loadExcels();
  const sidebar = document.querySelector('.sidebar-nav');
  
  // Remove existing favorites section
  const existingSection = document.getElementById('favoritesSection');
  if (existingSection) {
    existingSection.remove();
  }
  
  // Get favorited docs and excels
  const favoriteDocs = docs.filter(doc => docFavorites.includes(doc.id));
  const favoriteExcels = excels.filter(excel => excelFavorites.includes(excel.id));
  
  if (favoriteDocs.length === 0 && favoriteExcels.length === 0) return;
  
  // Helper to truncate title
  function truncateTitle(title, maxLen = 12) {
    if (title.length <= maxLen) return title;
    return title.substring(0, maxLen) + '...';
  }
  
  // Create favorites section
  const favoritesSection = document.createElement('div');
  favoritesSection.id = 'favoritesSection';
  favoritesSection.innerHTML = `
    <div class="spaces-divider"></div>
    <div class="spaces-section-label">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;margin-right:4px;vertical-align:-1px;">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
      Favorites
    </div>
    ${favoriteDocs.map(doc => `
      <div class="custom-space-item-wrapper favorite-doc-item favorite-item-row">
        <button class="custom-space-item favorite-with-icon-left" onclick="openDocEditor(${doc.id})">
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" class="favorite-star-left">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span class="space-name-text favorite-text-truncate" title="${doc.title}">${truncateTitle(doc.title)}</span>
        </button>
      </div>
    `).join('')}
    ${favoriteExcels.map(excel => `
      <div class="custom-space-item-wrapper favorite-excel-item favorite-item-row">
        <button class="custom-space-item favorite-with-icon-left" onclick="openExcelEditor(${excel.id})">
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" class="favorite-star-left">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span class="space-name-text favorite-text-truncate" title="${excel.title}">${truncateTitle(excel.title)}</span>
        </button>
      </div>
    `).join('')}
  `;
  
  sidebar.appendChild(favoritesSection);
}

function confirmDeleteSpace(spaceId, spaceName) {
  const content = `
    <div style="text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px;">🗑️</div>
      <p style="color: var(--muted-foreground); margin-bottom: 24px;">
        Are you sure you want to delete the space "<strong>${spaceName}</strong>"? This action cannot be undone.
      </p>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="button" class="btn btn-danger" onclick="deleteSpace(${spaceId})">Delete Space</button>
      </div>
    </div>
  `;
  openModal('Delete Space', content);
}

function deleteSpace(spaceId) {
  let spaces = loadSpaces();
  spaces = spaces.filter(s => s.id !== spaceId);
  saveSpaces(spaces);
  closeModal();
  renderSpacesInSidebar();
  showToast('Space deleted successfully!');
  
  // Navigate to home if viewing deleted space
  const activeSpace = document.querySelector(`[data-space-id="${spaceId}"]`);
  if (activeSpace && activeSpace.classList.contains('active')) {
    document.querySelector('.nav-item')?.click();
  }
}

function openSpaceView(spaceId) {
  const spaces = loadSpaces();
  const space = spaces.find(s => s.id === spaceId);
  
  if (!space) return;
  
  // Set current space for doc/excel saving
  currentSpaceId = spaceId;
  
  // Update active nav
  document.querySelectorAll('.nav-item, .custom-space-item').forEach(item => {
    item.classList.remove('active');
  });
  
  const spaceBtn = document.querySelector(`[data-space-id="${spaceId}"]`);
  if (spaceBtn) spaceBtn.classList.add('active');
  
  // Render space view
  const viewsContainer = document.getElementById('viewsContainer');
  if (viewsContainer) {
    viewsContainer.innerHTML = renderSpaceDetailView(space);
  }
  
  updateBreadcrumb(space.name);
}

function renderSpaceDetailView(space) {
  const allDocs = loadDocs();
  const allExcels = loadExcels();
  const excelFavorites = loadExcelFavorites();
  
  // Filter docs and excels by space
  const docs = allDocs.filter(d => d.spaceId === space.id);
  const excels = allExcels.filter(e => e.spaceId === space.id);
  
  // Recent docs (last 5)
  const recentDocs = [...docs].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);
  
  return `
    <div class="clickup-docs-container">
      <!-- Docs Sidebar -->
      <div class="docs-sidebar">
        <div class="docs-sidebar-header">
          <div class="docs-sidebar-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            ${space.name}
          </div>
          <div class="docs-search-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input type="text" class="docs-search-input" placeholder="Search docs..." id="docsSearchInput" oninput="filterSpaceDocs(${space.id})" />
          </div>
        </div>
        
        <div class="docs-tree" id="docsTreeContainer">
          <!-- Recent Section -->
          <div class="docs-tree-section">
            <div class="docs-tree-label">
              <span>Recent</span>
            </div>
            ${recentDocs.length > 0 ? recentDocs.map(doc => `
              <div class="docs-tree-item" onclick="openDocEditor(${doc.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span class="docs-tree-item-text">${doc.title}</span>
                <span class="docs-tree-item-date">${formatTimeAgo(doc.updatedAt)}</span>
              </div>
            `).join('') : `
              <div style="padding: 12px; font-size: 12px; color: var(--muted-foreground); text-align: center;">
                No recent docs
              </div>
            `}
          </div>
          
          <!-- All Documents -->
          <div class="docs-tree-section">
            <div class="docs-tree-label">
              <span>All Documents</span>
              <button class="docs-tree-add-btn" onclick="openDocEditor()" title="Create new doc">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>
            </div>
            ${docs.length > 0 ? docs.map(doc => `
              <div class="docs-tree-item" onclick="openDocEditor(${doc.id})" data-doc-id="${doc.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span class="docs-tree-item-text">${doc.title}</span>
              </div>
            `).join('') : ''}
          </div>
          
          <!-- Spreadsheets -->
          <div class="docs-tree-section">
            <div class="docs-tree-label">
              <span>Spreadsheets</span>
              <button class="docs-tree-add-btn" onclick="openExcelEditor()" title="Create new spreadsheet">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>
            </div>
            ${excels.length > 0 ? excels.map(excel => `
              <div class="docs-tree-item" onclick="openExcelEditor(${excel.id})" data-excel-id="${excel.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
                <span class="docs-tree-item-text">${excel.title}</span>
              </div>
            `).join('') : ''}
          </div>
        </div>
      </div>
      
      <!-- Main Content Area -->
      <div class="docs-main-area">
        ${docs.length > 0 || excels.length > 0 ? `
          <!-- Docs Header -->
          <div class="docs-header">
            <div class="docs-header-left">
              <div class="docs-breadcrumb">
                <span class="docs-breadcrumb-item" onclick="currentView = 'activity'; renderCurrentView();">Spaces</span>
                <span class="docs-breadcrumb-separator">›</span>
                <span class="docs-breadcrumb-item">${space.name}</span>
              </div>
            </div>
            <div class="docs-header-actions">
              <button class="docs-action-btn" onclick="openExcelEditor()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
                New Spreadsheet
              </button>
              <button class="docs-action-btn primary" onclick="openDocEditor()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                New Doc
              </button>
            </div>
          </div>
          
          <!-- Documents Grid -->
          <div class="docs-editor-wrapper" style="padding: 24px;">
            <div style="width: 100%; max-width: 1200px;">
              <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 20px; color: var(--foreground);">
                📄 Documents (${docs.length})
              </h3>
              
              ${docs.length > 0 ? `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-bottom: 40px;">
                  ${docs.map(doc => `
                    <div class="card doc-card" style="padding: 20px; cursor: pointer; position: relative; transition: all 0.2s;">
                      <button class="delete-card-btn" onclick="event.stopPropagation(); confirmDeleteDoc(${doc.id}, '${doc.title.replace(/'/g, "\\'")}')" title="Delete document">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                      <div onclick="openDocEditor(${doc.id})">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                          <div style="width: 40px; height: 40px; background: linear-gradient(135deg, hsl(217, 91%, 60%), hsl(271, 91%, 65%)); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="width:20px;height:20px;">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                            </svg>
                          </div>
                          <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--foreground); margin-bottom: 2px;">${doc.title}</div>
                            <div style="font-size: 12px; color: var(--muted-foreground);">Updated ${formatTimeAgo(doc.updatedAt)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              
              ${excels.length > 0 ? `
                <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 20px; color: var(--foreground);">
                  📊 Spreadsheets (${excels.length})
                </h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
                  ${excels.map(excel => {
                    const isFavorited = isExcelFavorited(excel.id);
                    return `
                    <div class="card excel-card" style="padding: 20px; cursor: pointer; position: relative; transition: all 0.2s;">
                      <button class="delete-card-btn" onclick="event.stopPropagation(); confirmDeleteExcel(${excel.id}, '${excel.title.replace(/'/g, "\\'")}')" title="Delete spreadsheet">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                      <div onclick="openExcelEditor(${excel.id})">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                          <div style="width: 40px; height: 40px; background: linear-gradient(135deg, hsl(142, 71%, 45%), hsl(142, 71%, 35%)); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="width:20px;height:20px;">
                              <rect x="3" y="3" width="18" height="18" rx="2"/>
                              <line x1="3" y1="9" x2="21" y2="9"/>
                              <line x1="9" y1="3" x2="9" y2="21"/>
                            </svg>
                          </div>
                          <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--foreground); margin-bottom: 2px;">${excel.title}</div>
                            <div style="font-size: 12px; color: var(--muted-foreground);">Updated ${formatTimeAgo(excel.updatedAt)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  `}).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        ` : `
          <!-- Empty State with ClickUp Style -->
          <div class="docs-empty-state">
            <div class="docs-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            </div>
            <h3 class="docs-empty-title">Create your first document</h3>
            <p class="docs-empty-text">
              Documents help you organize information, collaborate with your team, and keep everything in one place.
            </p>
            <div style="display: flex; gap: 12px;">
              <button class="docs-create-btn" onclick="openDocEditor()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Create Doc
              </button>
              <button class="docs-action-btn" onclick="openExcelEditor()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
                Create Spreadsheet
              </button>
            </div>
          </div>
        `}
      </div>
      
      <!-- Comments Panel (Hidden on smaller screens) -->
      <div class="docs-comments-panel">
        <div class="docs-comments-header">
          <span class="docs-comments-title">💬 Comments</span>
        </div>
        <div class="docs-comments-list">
          <div style="text-align: center; padding: 32px 16px; color: var(--muted-foreground);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:32px;height:32px;margin-bottom:12px;opacity:0.5;">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p style="font-size: 13px;">No comments yet.<br>Open a document to start discussing.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Filter docs in space sidebar
function filterSpaceDocs(spaceId) {
  const searchInput = document.getElementById('docsSearchInput');
  const query = searchInput ? searchInput.value.toLowerCase() : '';
  const allDocs = loadDocs();
  const docs = allDocs.filter(d => d.spaceId === spaceId);
  
  const container = document.getElementById('docsTreeContainer');
  if (!container) return;
  
  const treeItems = container.querySelectorAll('.docs-tree-item[data-doc-id]');
  treeItems.forEach(item => {
    const text = item.querySelector('.docs-tree-item-text');
    if (text) {
      const title = text.textContent.toLowerCase();
      if (query && !title.includes(query)) {
        item.style.display = 'none';
      } else {
        item.style.display = '';
      }
    }
  });
}

// ============================================
// Delete Confirmations for Docs and Excels
// ============================================
function confirmDeleteDoc(docId, docTitle) {
  const content = `
    <div style="text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
      <p style="color: var(--muted-foreground); margin-bottom: 24px;">
        Are you sure you want to delete "<strong>${docTitle}</strong>"? This action cannot be undone.
      </p>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="button" class="btn btn-danger" onclick="deleteDocConfirmed(${docId})">Delete Document</button>
      </div>
    </div>
  `;
  openModal('Delete Document', content);
}

function deleteDocConfirmed(docId) {
  deleteDoc(docId);
  closeModal();
  showToast('Document deleted successfully!');
  
  // Refresh current view
  const activeSpace = document.querySelector('.custom-space-item.active');
  if (activeSpace) {
    const spaceId = parseInt(activeSpace.dataset.spaceId);
    openSpaceView(spaceId);
  }
}

function confirmDeleteExcel(excelId, excelTitle) {
  const content = `
    <div style="text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
      <p style="color: var(--muted-foreground); margin-bottom: 24px;">
        Are you sure you want to delete "<strong>${excelTitle}</strong>"? This action cannot be undone.
      </p>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="button" class="btn btn-danger" onclick="deleteExcelConfirmed(${excelId})">Delete Spreadsheet</button>
      </div>
    </div>
  `;
  openModal('Delete Spreadsheet', content);
}

function deleteExcelConfirmed(excelId) {
  let excels = loadExcels();
  excels = excels.filter(e => e.id !== excelId);
  saveExcels(excels);
  closeModal();
  showToast('Spreadsheet deleted successfully!');
  
  // Refresh current view
  const activeSpace = document.querySelector('.custom-space-item.active');
  if (activeSpace) {
    const spaceId = parseInt(activeSpace.dataset.spaceId);
    openSpaceView(spaceId);
  }
}

// ============================================
// Toast Notification
// ============================================
function showToast(message) {
  const existing = document.querySelector('.layer-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'layer-toast';
  toast.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:hsl(142, 71%, 45%);">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
    <span>${message}</span>
  `;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 24px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    color: var(--foreground);
    font-size: 14px;
    font-weight: 500;
    z-index: 9999;
    animation: toastSlideIn 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Initialize spaces on load
document.addEventListener('DOMContentLoaded', () => {
  renderSpacesInSidebar();
});


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
