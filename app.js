/* ============================================
   Layer - Main Application Logic
   With Supabase Authentication
   ============================================ */

// ============================================
// State
// ============================================
let currentView = 'my-issues';
let currentFilter = 'all';
let searchQuery = '';
let selectedProjectIndex = null;

// ============================================
// DOM Elements
// ============================================
const viewsContainer = document.getElementById('viewsContainer');
const breadcrumbText = document.getElementById('breadcrumbText');
const searchInput = document.getElementById('searchInput');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalContent = document.getElementById('modalContent');
const modalClose = document.getElementById('modalClose');
const themeToggle = document.getElementById('themeToggle');

// ============================================
// Initialization
// ============================================
function init() {
  // Show loading screen for 3 seconds then reveal app
  const loadingScreen = document.getElementById('loadingScreen');
  const appContainer = document.getElementById('app');
  
  setTimeout(() => {
    loadingScreen.classList.add('fade-out');
    appContainer.style.opacity = '1';
    appContainer.style.transition = 'opacity 0.5s ease';
    
    // Remove loading screen from DOM after animation
    setTimeout(() => {
      loadingScreen.remove();
    }, 500);
    
    // Show beta notification popup after 1 second
    setTimeout(() => {
      showBetaNotification();
    }, 1000);
  }, 3000);

  // Load theme with mode support
  initTheme();

  // Set up navigation
  setupNavigation();
  
  // Set up mobile navigation
  setupMobileNavigation();

  // Set up sidebar collapse
  setupSidebarCollapse();

  // Set up search
  setupSearch();
  
  // Set up mobile search
  setupMobileSearch();

  // Set up modal
  setupModal();

  // Set up theme toggle
  setupThemeToggle();

  // Check for existing user session (Supabase)
  checkExistingSession();

  // Render initial view
  renderCurrentView();
}

// ============================================
// Beta Notification Popup
// ============================================
function showBetaNotification() {
  // Check if user has opted out
  if (localStorage.getItem('hideBetaNotification') === 'true') {
    return;
  }
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'beta-notification-overlay';
  overlay.id = 'betaNotificationOverlay';
  
  overlay.innerHTML = `
    <div class="beta-notification">
      <div class="beta-notification-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:32px;height:32px;color:var(--primary);">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div class="beta-notification-title">Notes</div>
      <p class="beta-notification-message">
        This website is currently in beta. Some features may not work as expected. Thank you for your patience.
      </p>
      <label class="beta-notification-checkbox">
        <input type="checkbox" id="dontShowAgainCheckbox">
        <span>Don't show this again</span>
      </label>
      <button class="beta-notification-close" onclick="closeBetaNotification()">Got it</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Trigger animation
  requestAnimationFrame(() => {
    overlay.classList.add('show');
  });
  
  // Close when clicking outside
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeBetaNotification();
    }
  });
}

function closeBetaNotification() {
  // Save preference if checkbox is checked
  const checkbox = document.getElementById('dontShowAgainCheckbox');
  if (checkbox && checkbox.checked) {
    localStorage.setItem('hideBetaNotification', 'true');
  }
  
  const overlay = document.getElementById('betaNotificationOverlay');
  if (overlay) {
    overlay.classList.remove('show');
    setTimeout(() => {
      overlay.remove();
    }, 300);
  }
}

// ============================================
// Sidebar Collapse
// ============================================
function setupSidebarCollapse() {
  const sidebar = document.getElementById('sidebar');
  const collapseBtn = document.getElementById('sidebarCollapseBtn');
  
  // Load saved state
  const isCollapsed = localStorage.getItem('layerSidebarCollapsed') === 'true';
  if (isCollapsed) {
    sidebar.classList.add('collapsed');
  }
  
  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      const collapsed = sidebar.classList.contains('collapsed');
      localStorage.setItem('layerSidebarCollapsed', collapsed);
    });
  }
}

// ============================================
// Navigation
// ============================================
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (view) {
        setActiveNav(view);
        currentView = view;
        selectedProjectIndex = null;
        currentFilter = 'all';
        searchQuery = '';
        searchInput.value = '';
        // Reset currentSpaceId when navigating away from space views
        if (typeof currentSpaceId !== 'undefined') {
          currentSpaceId = null;
        }
        renderCurrentView();
      }
    });
  });
}

function setActiveNav(view) {
  // Desktop sidebar nav
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    if (item.dataset.view === view) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // Mobile bottom nav
  const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
  mobileNavItems.forEach(item => {
    if (item.dataset.view === view) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

// Mobile Bottom Navigation
function setupMobileNavigation() {
  const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
  
  mobileNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (view) {
        setActiveNav(view);
        currentView = view;
        selectedProjectIndex = null;
        currentFilter = 'all';
        searchQuery = '';
        searchInput.value = '';
        renderCurrentView();
      }
    });
  });
}

function updateBreadcrumb(text) {
  breadcrumbText.textContent = text;
}

// ============================================
// Search
// ============================================
function setupSearch() {
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderCurrentView();
  });
}

// ============================================
// Theme System with Mode Support
// ============================================
function initTheme() {
  const savedTheme = loadTheme();
  const savedMode = localStorage.getItem('layerThemeMode') || 'dark';
  
  if (savedTheme === 'light') {
    document.body.classList.add('light');
  } else if (savedTheme === 'dark') {
    document.body.classList.remove('light');
  } else {
    // Custom theme with mode
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.documentElement.setAttribute('data-mode', savedMode);
  }
}

function setupThemeToggle() {
  // Desktop theme toggle
  const desktopToggle = document.getElementById('themeToggle');
  if (desktopToggle) {
    desktopToggle.addEventListener('click', toggleThemeMode);
  }
  
  // Mobile theme toggle
  const mobileToggle = document.getElementById('mobileThemeToggle');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', toggleThemeMode);
  }
}

function toggleThemeMode() {
  const currentTheme = loadTheme();
  const currentMode = localStorage.getItem('layerThemeMode') || 'dark';
  
  if (currentTheme === 'dark' || currentTheme === 'light') {
    // Toggle between built-in dark and light
    if (document.body.classList.contains('light')) {
      document.body.classList.remove('light');
      saveTheme('dark');
      localStorage.setItem('layerThemeMode', 'dark');
    } else {
      document.body.classList.add('light');
      saveTheme('light');
      localStorage.setItem('layerThemeMode', 'light');
    }
  } else {
    // Custom theme: toggle between dark and light mode
    const newMode = currentMode === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-mode', newMode);
    localStorage.setItem('layerThemeMode', newMode);
  }
}

// Mobile Search
function setupMobileSearch() {
  const searchBtn = document.getElementById('mobileSearchBtn');
  const searchOverlay = document.getElementById('mobileSearchOverlay');
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  
  if (searchBtn && searchOverlay) {
    searchBtn.addEventListener('click', () => {
      searchOverlay.classList.add('active');
      if (mobileSearchInput) {
        setTimeout(() => mobileSearchInput.focus(), 300);
      }
    });
    
    searchOverlay.addEventListener('click', (e) => {
      if (e.target === searchOverlay) {
        searchOverlay.classList.remove('active');
      }
    });
    
    if (mobileSearchInput) {
      mobileSearchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderCurrentView();
      });
      
      mobileSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchOverlay.classList.remove('active');
        }
      });
    }
  }
}

// ============================================
// Modal
// ============================================
function setupModal() {
  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
}

function openModal(title, content) {
  modalTitle.textContent = title;
  modalContent.innerHTML = content;
  modalOverlay.classList.add('active');
}

function closeModal() {
  modalOverlay.classList.remove('active');
}

// ============================================
// Authentication Modal (Supabase)
// ============================================
let authMode = 'signin'; // 'signin' or 'signup'
let authLoading = false;

function openAuthModal() {
  authMode = 'signin';
  renderAuthModal();
}

function renderAuthModal() {
  const isSignIn = authMode === 'signin';
  const title = isSignIn ? 'Sign In' : 'Create Account';
  
  const content = `
    <div class="auth-form">
      <div class="auth-tabs">
        <button class="auth-tab ${isSignIn ? 'active' : ''}" onclick="switchAuthMode('signin')">Sign In</button>
        <button class="auth-tab ${!isSignIn ? 'active' : ''}" onclick="switchAuthMode('signup')">Sign Up</button>
      </div>
      
      <form id="authForm" onsubmit="handleAuthSubmit(event)">
        <div class="form-group">
          <label class="form-label">Email <span class="required">*</span></label>
          <input type="email" class="form-input" id="authEmail" placeholder="Enter your email" required />
        </div>
        
        ${!isSignIn ? `
        <div class="form-group">
          <label class="form-label">Username <span class="required">*</span></label>
          <input type="text" class="form-input" id="authUsername" placeholder="Choose a username" required />
        </div>
        ` : ''}
        
        <div class="form-group">
          <label class="form-label">Password <span class="required">*</span></label>
          <input type="password" class="form-input" id="authPassword" placeholder="Enter your password" required minlength="6" />
        </div>
        
        ${!isSignIn ? `
        <div class="form-group">
          <label class="form-label">Confirm Password <span class="required">*</span></label>
          <input type="password" class="form-input" id="authConfirmPassword" placeholder="Confirm your password" required minlength="6" />
        </div>
        ` : ''}
        
        <div id="authError" class="auth-error" style="display: none;"></div>
        <div id="authSuccess" class="auth-success" style="display: none; color: #22c55e; padding: 12px; background: rgba(34, 197, 94, 0.1); border-radius: 8px; margin-bottom: 16px;"></div>
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="authSubmitBtn">${isSignIn ? 'Sign In' : 'Create Account'}</button>
        </div>
      </form>
      
      <div class="auth-footer">
        ${isSignIn ? 
          '<p>Don\'t have an account? <a href="#" onclick="switchAuthMode(\'signup\'); return false;">Sign up</a></p>' :
          '<p>Already have an account? <a href="#" onclick="switchAuthMode(\'signin\'); return false;">Sign in</a></p>'
        }
      </div>
    </div>
  `;
  
  modalTitle.textContent = title;
  modalContent.innerHTML = content;
  modalOverlay.classList.add('active');
}

function switchAuthMode(mode) {
  authMode = mode;
  renderAuthModal();
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  
  if (authLoading) return;
  
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errorEl = document.getElementById('authError');
  const successEl = document.getElementById('authSuccess');
  const submitBtn = document.getElementById('authSubmitBtn');
  
  // Clear previous messages
  errorEl.style.display = 'none';
  successEl.style.display = 'none';
  
  // Set loading state
  authLoading = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Loading...';
  
  if (authMode === 'signup') {
    const username = document.getElementById('authUsername').value.trim();
    const confirmPassword = document.getElementById('authConfirmPassword').value;
    
    // Validation
    if (!email || !username || !password || !confirmPassword) {
      showAuthError('Please fill in all fields');
      resetAuthButton();
      return;
    }
    
    if (password !== confirmPassword) {
      showAuthError('Passwords do not match');
      resetAuthButton();
      return;
    }
    
    if (password.length < 6) {
      showAuthError('Password must be at least 6 characters');
      resetAuthButton();
      return;
    }
    
    // Sign up with Supabase
    const result = await supabaseSignUp(email, password, username);
    
    if (result.success) {
      if (result.needsConfirmation) {
        successEl.textContent = 'Account created! Please check your email to confirm your account.';
        successEl.style.display = 'block';
        resetAuthButton();
      } else {
        closeModal();
        updateUserDisplay({
          username: username,
          email: email
        });
      }
    } else {
      showAuthError(result.error || 'Failed to create account');
      resetAuthButton();
    }
    
  } else {
    // Sign In
    if (!email || !password) {
      showAuthError('Please enter your email and password');
      resetAuthButton();
      return;
    }
    
    const result = await supabaseSignIn(email, password);
    
    if (result.success) {
      closeModal();
      const user = result.data.user;
      updateUserDisplay({
        username: user.user_metadata?.username || user.email.split('@')[0],
        email: user.email
      });
    } else {
      showAuthError(result.error || 'Invalid email or password');
      resetAuthButton();
    }
  }
}

function resetAuthButton() {
  authLoading = false;
  const submitBtn = document.getElementById('authSubmitBtn');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = authMode === 'signin' ? 'Sign In' : 'Create Account';
  }
}

function showAuthError(message) {
  const errorEl = document.getElementById('authError');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function updateUserDisplay(user) {
  const signInBtn = document.getElementById('signInBtn');
  if (signInBtn && user) {
    const initials = (user.username || user.email || 'U').slice(0, 2).toUpperCase();
    signInBtn.outerHTML = `
      <div class="user-info" id="userInfo">
        <div class="user-avatar">${initials}</div>
        <span class="user-name">${user.username || user.email}</span>
        <button class="sign-out-btn" onclick="signOut()" title="Sign Out">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    `;
  }
}

async function signOut() {
  const result = await supabaseSignOut();
  
  if (result.success) {
    const userInfo = document.getElementById('userInfo');
    if (userInfo) {
      userInfo.outerHTML = `
        <button class="sign-in-btn" id="signInBtn" onclick="openAuthModal()">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
            <polyline points="10 17 15 12 10 7"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
          <span>Sign In</span>
        </button>
      `;
    }
  }
}

async function checkExistingSession() {
  const result = await supabaseGetSession();
  
  if (result.success && result.session) {
    const user = result.session.user;
    updateUserDisplay({
      username: user.user_metadata?.username || user.email.split('@')[0],
      email: user.email
    });
  }
}


// ============================================
// View Rendering
// ============================================
function renderCurrentView() {
  if (selectedProjectIndex !== null) {
    viewsContainer.innerHTML = renderProjectDetailView(selectedProjectIndex);
    updateBreadcrumb('Project Details');
    return;
  }

  switch (currentView) {
    case 'inbox':
      viewsContainer.innerHTML = renderInboxView();
      updateBreadcrumb('Inbox');
      break;
    case 'my-issues':
      viewsContainer.innerHTML = renderMyIssuesView(currentFilter, searchQuery);
      updateBreadcrumb('My issues');
      setupIssueFilterListeners();
      break;
    case 'settings':
      viewsContainer.innerHTML = renderSettingsView();
      updateBreadcrumb('Settings');
      initThemeSelector();   // ← ADD THIS LINE
      break;
    case 'backlog':
      viewsContainer.innerHTML = renderBacklogView();
      updateBreadcrumb('Backlog');
      break;
    case 'schedule':                          // ← Add this case
      viewsContainer.innerHTML = renderScheduleView();
      updateBreadcrumb('Schedule');
      break;
    case 'activity':
      viewsContainer.innerHTML = renderActivityView(searchQuery);
      updateBreadcrumb('Activity');
      break;
    case 'team':
      viewsContainer.innerHTML = renderTeamView();
      updateBreadcrumb('Team');
      break;
    default:
      viewsContainer.innerHTML = renderMyIssuesView();
      updateBreadcrumb('My issues');
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

// ============================================
// Issue Handlers
// ============================================
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
      assignee: getCurrentUser()?.user_metadata?.username || 'User'
    });
    closeModal();
    renderCurrentView();
  }
}

// ============================================
// Backlog Handlers
// ============================================
function promptAddBacklogTask() {
  const title = prompt('New backlog task:', '');
  if (title?.trim()) {
    addBacklogTask(title.trim());
    renderCurrentView();
  }
}

function handleToggleBacklogTask(index) {
  toggleBacklogTask(index);
  renderCurrentView();
}

function handleUpdateBacklogTask(index, title) {
  updateBacklogTask(index, title || 'New task');
}

function handleDeleteBacklogTask(index) {
  if (confirm('Delete this task?')) {
    deleteBacklogTask(index);
    renderCurrentView();
  }
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

// ============================================
// Project Handlers
// ============================================
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

// ============================================
// Project Task Handlers
// ============================================
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

// ============================================
// Start the app
// ============================================
document.addEventListener('DOMContentLoaded', init);


/* ============================================
   Layer - UI Rendering Functions
   ============================================ */

// ============================================
// View Renderers
// ============================================

function renderInboxView() {
  const projects = loadProjects();
  const activity = getRecentActivity(projects);

  if (activity.length === 0) {
    return `
      <div class="inbox-container">
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--muted-foreground);">
              <path d="M22 12h-6l-2 3h-4l-2-3H2"/>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
            </svg>
          </div>
          <h3 class="empty-state-title">No recent activity</h3>
          <p class="empty-state-text">Activity from your projects will appear here</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="inbox-container">
      <h2 class="view-title" style="margin-bottom: 24px;">Recent Activity</h2>
      <div class="activity-list">
        ${activity.map(item => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="fa fa-cube"></i>
            </div>
            <div class="activity-content">
                <div class="activity-message">${item.message}</div>
                <div class="activity-time">${formatTimeAgo(item.time)}</div>
            </div>
        </div>
        `).join('')}
      </div>
    </div>
  `;
}

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
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--muted-foreground);">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <path d="M9 14l2 2 4-4"/>
            </svg>
          </div>
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
            <div>Updated</div>
          </div>
          ${issues.map(issue => `
            <div class="table-row issues-grid">
              <div class="issue-id">${issue.id}</div>
              <div>
                <div class="issue-title">${issue.title}</div>
                ${issue.description ? `<div class="issue-description">${issue.description}</div>` : ''}
              </div>
              <div>
                <span class="badge ${getStatusBadgeClass(issue.status)}">${capitalizeStatus(issue.status)}</span>
              </div>
              <div>
                <span class="badge badge-sm ${getPriorityBadgeClass(issue.priority)}">${issue.priority ? issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1) : '—'}</span>
              </div>
              <div class="issue-updated">${issue.updated}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderBacklogView() {
  const tasks = loadBacklogTasks();
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.done).length;
  const progress = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

  if (tasks.length === 0) {
    return `
      <div class="backlog-container">
        <div class="view-header" style="border: none; padding: 0; margin-bottom: 32px;">
          <h1 class="view-title">Backlog</h1>
        </div>
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--muted-foreground);">
              <path d="M22 12h-6l-2 3h-4l-2-3H2"/>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
            </svg>
          </div>
          <h3 class="empty-state-title">No tasks in backlog yet</h3>
          <p class="empty-state-text">Tasks added here will wait until you move them to a project.</p>
          <button class="btn btn-primary" onclick="promptAddBacklogTask()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Add your first task
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="backlog-container">
      <div class="view-header" style="border: none; padding: 0; margin-bottom: 32px;">
        <h1 class="view-title">Backlog</h1>
      </div>
      
      <div class="backlog-progress">
        <div class="backlog-progress-info">
          <p class="backlog-progress-text">${doneTasks} of ${totalTasks} completed</p>
          <div class="progress-bar backlog-progress-bar">
            <div class="progress-bar-fill" style="width: ${progress}%; background-color: ${getProgressColor(progress)};"></div>
          </div>
        </div>
        <button class="btn btn-primary" onclick="promptAddBacklogTask()">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Add task
        </button>
      </div>
      
      <div class="backlog-tasks">
        ${tasks.map((task, index) => `
          <div class="backlog-task ${task.done ? 'done' : ''}">
            <label class="checkbox-container">
              <input type="checkbox" ${task.done ? 'checked' : ''} onchange="handleToggleBacklogTask(${index})">
              <div class="checkbox-custom">
                <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
            </label>
            <div class="backlog-task-title" contenteditable="true" onblur="handleUpdateBacklogTask(${index}, this.textContent)">${task.title}</div>
            <button class="backlog-task-delete" onclick="handleDeleteBacklogTask(${index})">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        `).join('')}
      </div>
      
      <div class="quick-add">
        <input type="text" id="quickAddInput" placeholder="+ Quick add task (press Enter)" onkeypress="handleQuickAddKeypress(event)">
      </div>
    </div>
  `;
}

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
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--muted-foreground);">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
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
    <div class="projects-container">
      <div class="view-header" style="border: none; padding: 0; margin-bottom: 24px;">
        <h2 class="view-title">Projects</h2>
        <button class="btn btn-primary" onclick="openCreateProjectModal()">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Create project
        </button>
      </div>
      
      ${projects.map((project, index) => {
        const { total, completed, percentage } = calculateProgress(project.columns);
        const statusColor = getStatusColor(project.status);
        
        return `
          <div class="project-card card-hover" onclick="openProjectDetail(${index})">
            <div class="project-card-header">
              <h3 class="project-card-title">${project.name}</h3>
              <div class="project-card-actions">
                <span class="badge" style="background-color: ${statusColor}20; color: ${statusColor};">${capitalizeStatus(project.status)}</span>
                <button class="project-delete-btn" onclick="event.stopPropagation(); handleDeleteProject(${index})">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
            ${project.description ? `<p class="project-description">${project.description}</p>` : ''}
            <div class="project-progress">
              <div class="project-progress-header">
                <span class="project-progress-label">Progress</span>
                <span class="project-progress-value">${percentage}%</span>
              </div>
              <div class="progress-bar progress-bar-sm">
                <div class="progress-bar-fill" style="width: ${percentage}%; background-color: ${getProgressColor(percentage)};"></div>
              </div>
              <p class="project-progress-stats">${completed}/${total} tasks completed</p>
            </div>
            <div class="project-meta">Target: ${formatDate(project.targetDate)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderTeamView() {
  return `
    <div class="team-container">
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--muted-foreground);">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <h3 class="empty-state-title">Team collaboration coming soon</h3>
        <p class="empty-state-text">Invite team members and collaborate on projects together</p>
      </div>
    </div>
  `;
}

function renderProjectDetailView(projectIndex) {
  const projects = loadProjects();
  const project = projects[projectIndex];
  
  if (!project) return '';

  const { total, completed, percentage } = calculateProgress(project.columns);
  const statusColor = getStatusColor(project.status);
  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (percentage / 100) * circumference;

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
                  <span class="badge" style="background-color: ${statusColor}20; color: ${statusColor};">${capitalizeStatus(project.status)}</span>
                  <span class="badge badge-sm" style="background-color: var(--muted); color: var(--muted-foreground);">No priority</span>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <!-- NEW GRIP DIAGRAM BUTTON -->
                <button class="btn btn-primary" onclick="openGripDiagram(${projectIndex})" title="Open Grip Diagram (Flowchart)">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8" cy="8" r="1.5"/>
                    <circle cx="16" cy="8" r="1.5"/>
                    <circle cx="12" cy="16" r="1.5"/>
                    <path d="M8 8v6m4-6v8m4-6v6"/>
                  </svg>
                  Grip Diagram
                </button>

                <button class="project-detail-delete" onclick="handleDeleteProjectFromDetail(${projectIndex})">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="project-update-card">
          <div class="project-update-badge">
            <svg class="icon" style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
            On track
          </div>
          <p class="project-update-meta">${project.updates?.[0]?.actor || 'You'} · ${project.updates?.[0]?.time || 'just now'}</p>
          <p class="project-update-text">${project.updates?.[0]?.action || 'Project created'}</p>
        </div>

        <div class="project-description-section">
          <h3 class="section-title">Description</h3>
          <p class="project-description-text" contenteditable="true" onblur="handleUpdateProjectDescription(${projectIndex}, this.textContent)">${project.description || 'Add description...'}</p>
        </div>

        <div>
          <h3 class="section-title" style="margin-bottom: 16px;">Tasks</h3>
          <div class="kanban-board">
            ${project.columns.map((column, colIndex) => `
              <div class="kanban-column">
                <div class="kanban-column-header">
                  <h4 class="kanban-column-title">${column.title}</h4>
                  <span class="kanban-column-count">${column.tasks.filter(t => t.done).length}/${column.tasks.length}</span>
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
            <span class="badge badge-sm" style="background-color: ${statusColor}20; color: ${statusColor};">${capitalizeStatus(project.status)}</span>
          </div>
          <div class="property-item">
            <span class="property-label">Priority</span>
            <span class="property-value" style="color: var(--muted-foreground);">No priority</span>
          </div>
          <div class="property-item">
            <span class="property-label">Lead</span>
            <span class="property-value property-link">Add lead</span>
          </div>
          <div class="property-item">
            <span class="property-label">Target date</span>
            <span class="property-value">
              <svg class="icon" style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              ${formatDate(project.targetDate)}
            </span>
          </div>
          <div class="property-item">
            <span class="property-label">Teams</span>
            <span class="property-value" style="color: var(--muted-foreground);">—</span>
          </div>
          <div class="property-item">
            <span class="property-label">Labels</span>
            <span class="property-value property-link">Add label</span>
          </div>
        </div>
      </aside>
    </div>
  `;
}

// ============================================
// Modal Content Renderers
// ============================================

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
        <label class="form-label">Description (optional)</label>
        <textarea name="description" class="form-textarea" placeholder="Brief overview..."></textarea>
      </div>
      
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create project</button>
      </div>
    </form>
  `;
}
