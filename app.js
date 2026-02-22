/* ============================================
   Layer - Main Application Logic
   ============================================ */

// ============================================
// State
// ============================================
// Available themes for first-time setup
const AVAILABLE_THEMES = [
  { id: 'dark', name: 'Dark', mode: 'dark' },
  { id: 'light', name: 'Light', mode: 'light' },
  { id: 'pink', name: 'Pink', mode: 'dark' },
  { id: 'purple', name: 'Purple', mode: 'dark' },
  { id: 'ocean', name: 'Ocean', mode: 'dark' },
  { id: 'forest', name: 'Forest', mode: 'dark' },
  { id: 'midnight', name: 'Midnight', mode: 'dark' },
  { id: 'dracula', name: 'Dracula', mode: 'dark' },
  { id: 'gruvbox', name: 'Gruvbox', mode: 'dark' },
  { id: 'rosepine', name: 'Rosé Pine', mode: 'dark' },
  { id: 'claude', name: 'Claude', mode: 'dark' }
];

// Track if we're in first-time setup
let isFirstTimeSetup = false;

let currentView = 'inbox';
let currentFilter = 'all';
let searchQuery = '';
let selectedProjectIndex = null;
let currentProjectTab = 'overview'; // Track the current tab within project detail view
let lastRenderTime = 0; // Track last render time to prevent rapid renders
let lastRenderContext = null; // Track render context to prevent redundant renders
const RENDER_DEBOUNCE = 100; // Minimum time between renders in ms

// ============================================
// Notification System
// ============================================
function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existing = document.querySelector('.notification-toast');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = `notification-toast notification-${type}`;
  notification.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:inherit;cursor:pointer;padding:4px;margin-left:8px;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>
  `;

  // Add styles inline if not already present
  notification.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 12px 16px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 10000;
    animation: slideIn 0.3s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-size: 14px;
    max-width: 350px;
  `;

  // Type-specific colors
  const colors = {
    success: { bg: '#10b981', color: '#fff' },
    error: { bg: '#ef4444', color: '#fff' },
    info: { bg: '#3b82f6', color: '#fff' },
    warning: { bg: '#f59e0b', color: '#fff' }
  };

  const colorScheme = colors[type] || colors.info;
  notification.style.backgroundColor = colorScheme.bg;
  notification.style.color = colorScheme.color;

  document.body.appendChild(notification);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

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
// Realtime Subscriptions
// ============================================

let realtimeChannel = null;
let projectDetailChannel = null;

function setupRealtimeSubscription() {
  if (!window.LayerDB?.isAuthenticated()) {
    console.log('User not authenticated, skipping realtime subscription');
    return;
  }

  // Clean up existing subscription
  if (realtimeChannel) {
    window.LayerDB.unsubscribeFromProjects();
    realtimeChannel = null;
  }

  console.log('Setting up realtime subscription for projects...');

  // Subscribe to all user projects with proper handling
  realtimeChannel = window.LayerDB.subscribeToUserProjects(async (payload) => {
    console.log('Realtime change received:', payload.table, payload.eventType);

    try {
      // Refresh projects from database
      const freshProjects = await window.LayerDB.loadProjects();
      saveProjectsToCache(freshProjects);

      // Handle project_members changes
      if (payload.table === 'project_members') {
        await handleMemberRealtimeUpdate(payload, freshProjects);
        return;
      }

      // Handle projects table changes
      if (payload.table === 'projects') {
        await handleProjectRealtimeUpdate(payload, freshProjects);
        return;
      }

      // Fallback: re-render current view
      renderCurrentView();

    } catch (error) {
      console.error('Error handling realtime update:', error);
      renderCurrentView();
    }
  });

  console.log('Realtime subscription established');
}

// Handle member add/remove/leave realtime events
async function handleMemberRealtimeUpdate(payload, freshProjects) {
  const currentUser = window.LayerDB?.getCurrentUser();
  const { eventType, new: newRecord, old: oldRecord } = payload;
  const record = newRecord || oldRecord;

  if (!record) return;

  // Check if this affects the current user
  const affectsCurrentUser = record.user_id === currentUser?.id;

  if (eventType === 'INSERT') {
    // New member added
    if (affectsCurrentUser) {
      showNotification('You were added to a project!', 'success');
    } else {
      showNotification('A new member joined the project', 'success');
    }
  } else if (eventType === 'DELETE') {
    // Member removed or left
    if (affectsCurrentUser) {
      // Current user was removed - navigate away from project
      showNotification('You have been removed from the project', 'warning');
      if (currentView === 'project-detail') {
        currentView = 'activity';
        selectedProjectIndex = null;
      }
    } else {
      showNotification('A member left the project', 'info');
    }
  }

  // Refresh the current view
  if (currentView === 'project-detail' && selectedProjectIndex !== null) {
    // Try to find the project by ID after refresh
    const currentProject = loadProjects()[selectedProjectIndex];
    if (currentProject && record.project_id === currentProject.id) {
      if (typeof refreshTeamMembersDisplay === 'function') {
        refreshTeamMembersDisplay(selectedProjectIndex);
      } else {
        renderCurrentView();
      }
    } else {
      renderCurrentView();
    }
  } else {
    renderCurrentView();
  }
}

// Handle project update/delete realtime events
async function handleProjectRealtimeUpdate(payload, freshProjects) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  if (eventType === 'UPDATE') {
    // Check if team members changed (legacy support)
    const oldMembers = oldRecord?.team_members || [];
    const newMembers = newRecord?.team_members || [];

    if (JSON.stringify(oldMembers.sort()) !== JSON.stringify(newMembers.sort())) {
      const addedMembers = newMembers.filter(m => !oldMembers.includes(m));
      const removedMembers = oldMembers.filter(m => !newMembers.includes(m));

      if (addedMembers.length > 0) {
        showNotification(`${addedMembers.join(', ')} joined the project`, 'success');
      }
      if (removedMembers.length > 0) {
        showNotification(`${removedMembers.join(', ')} left the project`, 'info');
      }
    } else {
      // General project update (no notification needed for every update)
    }
  } else if (eventType === 'INSERT') {
    showNotification('New project added', 'success');
  } else if (eventType === 'DELETE') {
    // If we're viewing the deleted project, go back to list
    if (currentView === 'project-detail' && selectedProjectIndex !== null) {
      const currentProject = loadProjects()[selectedProjectIndex];
      if (!currentProject || currentProject.id === oldRecord?.id) {
        selectedProjectIndex = null;
        currentView = 'activity';
        showNotification('Project deleted', 'warning');
      }
    } else {
      showNotification('Project deleted', 'warning');
    }
  }

  // Refresh current view
  renderCurrentView();
}

// Setup realtime for specific project detail view
function setupProjectDetailRealtime(projectId) {
  if (!window.LayerRealtime || !projectId) return;

  console.log('Setting up project detail realtime for:', projectId);

  // Subscribe with specific callbacks
  projectDetailChannel = window.LayerRealtime.subscribeToProjectDetail(projectId, {
    onProjectUpdate: async (payload) => {
      console.log('Project detail updated:', payload);
      await refreshProjects();
      if (currentView === 'project-detail') {
        renderCurrentView();
      }
    },
    onMemberAdded: async (payload) => {
      console.log('Member added to project:', payload);
      await refreshProjects();
      if (currentView === 'project-detail' && typeof refreshTeamMembersDisplay === 'function') {
        refreshTeamMembersDisplay(selectedProjectIndex);
      }
      showNotification('New member added to the project', 'success');
    },
    onMemberRemoved: async (payload) => {
      console.log('Member removed from project:', payload);
      const currentUser = window.LayerDB?.getCurrentUser();

      // Check if current user was removed
      if (payload.old?.user_id === currentUser?.id) {
        showNotification('You have been removed from this project', 'warning');
        currentView = 'activity';
        selectedProjectIndex = null;
        await refreshProjects();
        renderCurrentView();
        return;
      }

      await refreshProjects();
      if (currentView === 'project-detail' && typeof refreshTeamMembersDisplay === 'function') {
        refreshTeamMembersDisplay(selectedProjectIndex);
      }
      showNotification('A member left the project', 'info');
    },
    onProjectDeleted: async (payload) => {
      console.log('Project deleted:', payload);
      showNotification('This project has been deleted', 'warning');
      currentView = 'activity';
      selectedProjectIndex = null;
      await refreshProjects();
      renderCurrentView();
    }
  });
}

// Cleanup project detail realtime
function cleanupProjectDetailRealtime() {
  if (window.LayerRealtime) {
    window.LayerRealtime.unsubscribeFromProjectDetail();
  }
  projectDetailChannel = null;
}

// ============================================
// Initialization
// ============================================
function init() {
  // Professional loading sequence - refined timing for smooth animation
  const loadingScreen = document.getElementById('loadingScreen');
  const appContainer = document.getElementById('app');

  setTimeout(() => {
    loadingScreen.classList.add('fade-out');
    appContainer.style.opacity = '1';
    appContainer.style.transition = 'opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1)';

    // Remove loading screen from DOM after fade
    setTimeout(() => {
      if (loadingScreen) {
        loadingScreen.style.display = 'none';
      }
    }, 1200);

    // Show beta notification popup after short delay
    setTimeout(() => {
      showBetaNotification();
    }, 800);
  }, 2200); // Increased delay to allow the beautiful reveal animation to play out

  // Load theme with mode support
  initTheme();

  // Set up navigation
  setupNavigation();

  // Set up mobile navigation
  setupMobileNavigation();

  // Set up sidebar collapse
  setupSidebarCollapse();

  // Initialize sidebar sections (collapsible)
  initSidebarSections();
  // Set up search
  setupSearch();

  // Set up mobile search
  setupMobileSearch();

  // Set up modal
  setupModal();

  // Set up theme toggle
  setupThemeToggle();

  // Set up first-time setup form
  const setupForm = document.getElementById('firstTimeSetupForm');
  if (setupForm) {
    setupForm.addEventListener('submit', handleFirstTimeSetupSubmit);
  }

  // Check for existing user session
  checkExistingSession();

  // Render initial view
  renderCurrentView();

  // Initialize AI icon morphing animation
  initAIIconMorph();
}

function showLoadingScreen() {
  const loadingScreen = document.getElementById('loadingScreen');
  if (!loadingScreen) return;
  loadingScreen.style.display = 'flex';
  loadingScreen.classList.remove('fade-out');
}

function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loadingScreen');
  if (!loadingScreen) return;
  loadingScreen.classList.add('fade-out');
  setTimeout(() => {
    const el = document.getElementById('loadingScreen');
    if (el) el.style.display = 'none';
  }, 1000);
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
// AI Icon Animation (Glasses with gradient)
// ============================================
function initAIIconMorph() {
  // Gradient animation is handled via SVG animate elements
  // No JavaScript needed - the gradient loops automatically
}

// ============================================
// Sidebar Section Toggle (Collapsible Sections)
// ============================================
function toggleNavSection(sectionName) {
  const section = document.querySelector(`.nav-section-collapsible[data-section="${sectionName}"]`);
  if (section) {
    section.classList.toggle('collapsed');
    // Save state to localStorage
    const collapsedSections = JSON.parse(localStorage.getItem('layerCollapsedSections') || '{}');
    collapsedSections[sectionName] = section.classList.contains('collapsed');
    localStorage.setItem('layerCollapsedSections', JSON.stringify(collapsedSections));
  }
}

function toggleTeamSection(teamName) {
  const teamItem = document.querySelector(`.nav-team-item[data-team="${teamName}"]`);
  if (teamItem) {
    teamItem.classList.toggle('collapsed');
    const content = teamItem.querySelector('.nav-team-content');
    if (content) {
      content.classList.toggle('open');
    }
    // Save state
    const collapsedTeams = JSON.parse(localStorage.getItem('layerCollapsedTeams') || '{}');
    collapsedTeams[teamName] = teamItem.classList.contains('collapsed');
    localStorage.setItem('layerCollapsedTeams', JSON.stringify(collapsedTeams));
  }
}

function initSidebarSections() {
  // Load collapsed sections state
  const collapsedSections = JSON.parse(localStorage.getItem('layerCollapsedSections') || '{}');
  Object.keys(collapsedSections).forEach(sectionName => {
    if (collapsedSections[sectionName]) {
      const section = document.querySelector(`.nav-section-collapsible[data-section="${sectionName}"]`);
      if (section) {
        section.classList.add('collapsed');
      }
    }
  });

  // Load collapsed teams state
  const collapsedTeams = JSON.parse(localStorage.getItem('layerCollapsedTeams') || '{}');
  Object.keys(collapsedTeams).forEach(teamName => {
    if (collapsedTeams[teamName]) {
      const teamItem = document.querySelector(`.nav-team-item[data-team="${teamName}"]`);
      if (teamItem) {
        teamItem.classList.add('collapsed');
        const content = teamItem.querySelector('.nav-team-content');
        if (content) {
          content.classList.remove('open');
        }
      }
    }
  });
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
// Workspace Section Toggle - REMOVED
// ============================================
// Workspace toggle functionality has been removed
// Projects button is now directly in the navigation

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

  // Clear active state from all space items
  const spaceItems = document.querySelectorAll('.custom-space-item');
  spaceItems.forEach(item => {
    item.classList.remove('active');
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
        // Remove active class from all mobile nav items
        mobileNavItems.forEach(navItem => {
          navItem.classList.remove('active');
        });
        
        // Add active class to clicked item
        item.classList.add('active');
        
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
  if (breadcrumbText) {
    breadcrumbText.textContent = text;
  }
}

// ============================================
// Search
// ============================================
function setupSearch() {
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderCurrentView();
    });
  }
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
  const mobileSearchCloseBtn = document.getElementById('mobileSearchCloseBtn');

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

    // Add event listener for the close button
    if (mobileSearchCloseBtn) {
      mobileSearchCloseBtn.addEventListener('click', () => {
        searchOverlay.classList.remove('active');
      });
    }

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
  const modalEl = document.getElementById('modal');
  if (modalEl) modalEl.classList.remove('modal-auth-variant');
}

// ============================================
// Login Page Management
// ============================================
let loginPageAnimatedBg = null;

function showLoginPage() {
  const loginOverlay = document.getElementById('loginPageOverlay');
  const loginBgContainer = document.getElementById('loginPageBg');
  const appContainer = document.getElementById('app');
  
  if (loginOverlay) {
    loginOverlay.style.display = 'flex';
  }

  if (loginBgContainer && window.ColorBendsBackground) {
    try {
      if (!loginPageAnimatedBg) {
        loginPageAnimatedBg = new window.ColorBendsBackground(loginBgContainer, {
          rotation: 0,
          speed: 0.2,
          colors: ["#d54444","#ff9500","#742afe"],
          transparent: true,
          autoRotate: 0,
          scale: 1,
          frequency: 1,
          warpStrength: 1,
          mouseInfluence: 1,
          parallax: 0.5,
          noise: 0.1
        });
      }
    } catch (e) {
      console.error('Failed to initialize login background:', e);
    }
  }
  
  if (appContainer) {
    appContainer.style.display = 'none';
  }
}

function hideLoginPage() {
  const loginOverlay = document.getElementById('loginPageOverlay');
  const loginBgContainer = document.getElementById('loginPageBg');
  const appContainer = document.getElementById('app');
  
  if (loginOverlay) {
    loginOverlay.style.display = 'none';
  }

  if (loginPageAnimatedBg) {
    try {
      loginPageAnimatedBg.destroy();
    } catch (e) {
      console.error('Failed to cleanup login background:', e);
    }
    loginPageAnimatedBg = null;
  }

  if (loginBgContainer) {
    loginBgContainer.innerHTML = '';
  }
  
  if (appContainer) {
    appContainer.style.display = 'block';
  }
}

// Login page mode switching
let loginMode = 'signin'; // 'signin' or 'signup'

function switchLoginMode(mode) {
  loginMode = mode;
  
  const loginTabBtn = document.getElementById('loginTabBtn');
  const signupTabBtn = document.getElementById('signupTabBtn');
  const loginFormTitle = document.getElementById('loginFormTitle');
  const loginFormSubtitle = document.getElementById('loginFormSubtitle');
  const usernameGroup = document.getElementById('usernameGroup');
  const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
  const loginSubmitText = document.getElementById('loginSubmitText');
  
  if (mode === 'signin') {
    // Sign In mode
    loginTabBtn.classList.add('active');
    signupTabBtn.classList.remove('active');
    loginFormTitle.textContent = 'Welcome Back';
    loginFormSubtitle.textContent = 'Sign in to your workspace to continue';
    usernameGroup.style.display = 'none';
    confirmPasswordGroup.style.display = 'none';
    loginSubmitText.textContent = 'Sign In';
    
    // Remove required attribute from signup-only fields
    document.getElementById('loginUsername').removeAttribute('required');
    document.getElementById('loginConfirmPassword').removeAttribute('required');
  } else {
    // Sign Up mode
    loginTabBtn.classList.remove('active');
    signupTabBtn.classList.add('active');
    loginFormTitle.textContent = 'Join Layer';
    loginFormSubtitle.textContent = 'Create your professional workspace today';
    usernameGroup.style.display = 'block';
    confirmPasswordGroup.style.display = 'block';
    loginSubmitText.textContent = 'Create Account';
    
    // Add required attribute to signup fields
    document.getElementById('loginUsername').setAttribute('required', '');
    document.getElementById('loginConfirmPassword').setAttribute('required', '');
  }
  
  // Clear any existing errors
  hideLoginError();
}

function showLoginError(message) {
  const loginError = document.getElementById('loginError');
  if (loginError) {
    loginError.textContent = message;
    loginError.style.display = 'block';
  }
}

function hideLoginError() {
  const loginError = document.getElementById('loginError');
  if (loginError) {
    loginError.style.display = 'none';
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const username = document.getElementById('loginUsername').value.trim();
  const confirmPassword = document.getElementById('loginConfirmPassword').value;
  const loginOverlay = document.getElementById('loginPageOverlay');
  
  hideLoginError();

  if (loginOverlay) {
    loginOverlay.style.display = 'none';
  }
  showLoadingScreen();
  
  try {
    if (loginMode === 'signup') {
      // Sign up validation
      if (!username) {
        showLoginError('Username is required');
        hideLoadingScreen();
        showLoginPage();
        return;
      }
      
      if (password.length < 6) {
        showLoginError('Password must be at least 6 characters');
        hideLoadingScreen();
        showLoginPage();
        return;
      }
      
      if (password !== confirmPassword) {
        showLoginError('Passwords do not match');
        hideLoadingScreen();
        showLoginPage();
        return;
      }
      
      // Show loading state
      const submitBtn = document.querySelector('.login-submit-btn');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
        </svg>
        <span>Creating Account...</span>
      `;
      
      // Sign up
      await window.LayerDB.signUp(email, password, username);
      
      // Get current session after signup
      const { data: sessionData } = await window.LayerDB.supabase.auth.getSession();
      
      // Save session data for persistence
      if (sessionData.session && sessionData.user) {
        saveSessionData(sessionData.user, sessionData.session);
        startSessionHeartbeat();
      }
      
      // Successfully signed up and logged in
      hideLoadingScreen();
      hideLoginPage();
      await loadUserDataFromDB();
      updateUserDisplay({ username: username, email: email });
      showNotification('Account created successfully!', 'success');
      renderCurrentView();
      
    } else {
      // Sign in
      // Show loading state
      const submitBtn = document.querySelector('.login-submit-btn');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
        </svg>
        <span>Signing In...</span>
      `;
      
      // Sign in
      const data = await window.LayerDB.signIn(email, password);
      
      // Save session data for persistence
      if (data.user && data.session) {
        saveSessionData(data.user, data.session);
        startSessionHeartbeat();
      }
      
      // Restore button state
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
      
      if (data.user) {
        await loadUserDataFromDB();
        const displayName = data.user?.user_metadata?.name || data.user?.email?.split('@')[0] || 'User';
        await updateUserDisplay({ username: displayName, email: data.user.email });
        showNotification('Signed in successfully!', 'success');
        
        // Hide login page and show app
        hideLoadingScreen();
        hideLoginPage();
        renderCurrentView();
      }
    }
  } catch (error) {
    console.error('Login/Signup error:', error);
    hideLoadingScreen();
    showLoginPage();
    
    // Restore button state
    const submitBtn = document.querySelector('.login-submit-btn');
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>${loginMode === 'signin' ? 'Sign In' : 'Create Account'}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M5 12h14M12 5l7 7-7 7"/>
      </svg>`;
    
    // Show user-friendly error
    let errorMessage = 'Authentication failed';
    if (error.message?.includes('Invalid login credentials')) {
      errorMessage = 'Invalid email or password';
    } else if (error.message?.includes('User already registered')) {
      errorMessage = 'An account with this email already exists';
    } else if (error.message?.includes('Password should be at least')) {
      errorMessage = 'Password must be at least 6 characters';
    } else if (error.message?.includes('Email not confirmed')) {
      errorMessage = 'Please check your email to confirm your account';
    }
    
    showLoginError(errorMessage);
  }
}

// ============================================
// Authentication Modal
// ============================================
let authMode = 'signin'; // 'signin' or 'signup'

function openAuthModal() {
  // Show the login page instead of the modal
  showLoginPage();
}

function renderAuthModal() {
  const isSignIn = authMode === 'signin';
  const title = isSignIn ? 'Sign In' : 'Create Account';

  const content = `
    <div class="auth-container">
      <div class="auth-header-minimal">
        <h2 class="auth-title-large">${isSignIn ? 'Welcome back' : 'Join Layer'}</h2>
        <p class="auth-subtitle-minimal">${isSignIn ? 'Sign in to your workspace to continue' : 'Create your professional workspace today'}</p>
      </div>

      <div class="auth-tabs-modern">
        <button class="auth-tab-modern ${isSignIn ? 'active' : ''}" onclick="switchAuthMode('signin')">Sign In</button>
        <button class="auth-tab-modern ${!isSignIn ? 'active' : ''}" onclick="switchAuthMode('signup')">Sign Up</button>
      </div>
      
      <form id="authForm" class="auth-form-modern" onsubmit="handleAuthSubmit(event)">
        <div class="form-group-modern">
          <label class="form-label-modern">Email Address</label>
          <div class="input-wrapper-modern">
            <svg class="input-icon-modern" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
            <input type="email" class="form-input-modern" id="authEmail" placeholder="name@company.com" required />
          </div>
        </div>
        
        ${!isSignIn ? `
        <div class="form-group-modern">
          <label class="form-label-modern">Username</label>
          <div class="input-wrapper-modern">
            <svg class="input-icon-modern" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <input type="text" class="form-input-modern" id="authUsername" placeholder="Your name" required />
          </div>
        </div>
        ` : ''}
        
        <div class="form-group-modern">
          <label class="form-label-modern">Password</label>
          <div class="input-wrapper-modern">
            <svg class="input-icon-modern" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input type="password" class="form-input-modern" id="authPassword" placeholder="••••••••" required minlength="6" />
          </div>
        </div>
        
        ${!isSignIn ? `
        <div class="form-group-modern">
          <label class="form-label-modern">Confirm Password</label>
          <div class="input-wrapper-modern">
            <svg class="input-icon-modern" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input type="password" class="form-input-modern" id="authConfirmPassword" placeholder="••••••••" required minlength="6" />
          </div>
        </div>
        ` : ''}
        
        <div id="authError" class="auth-error-modern" style="display: none;"></div>
        
        <button type="submit" class="auth-submit-btn">
          <span>${isSignIn ? 'Sign In' : 'Create Account'}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </form>

      <div class="auth-divider-modern">
        <span>or continue with</span>
      </div>

      <button type="button" class="google-auth-btn-modern" onclick="handleGoogleSignIn()">
        <svg viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"></path>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
        </svg>
        <span>Google</span>
      </button>
      
      <div class="auth-footer-modern">
        ${isSignIn ?
      'Don\'t have an account? <button onclick="switchAuthMode(\'signup\')">Create one</button>' :
      'Already have an account? <button onclick="switchAuthMode(\'signin\')">Sign in</button>'
    }
      </div>
    </div>
  `;

  modalTitle.textContent = ''; // Hide default title as we have a custom header
  modalContent.innerHTML = content;
  const modalEl = document.getElementById('modal');
  if (modalEl) modalEl.classList.add('modal-auth-variant');
  modalOverlay.classList.add('active');
}

function switchAuthMode(mode) {
  authMode = mode;
  renderAuthModal();
}

async function handleGoogleSignIn() {
  const googleBtn = document.querySelector('.google-auth-btn-modern');
  const originalContent = googleBtn?.innerHTML;

  try {
    // Show loading state
    if (googleBtn) {
      googleBtn.disabled = true;
      googleBtn.innerHTML = `
        <svg class="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
        </svg>
        <span>Connecting...</span>
      `;
    }

    // Initiate Google OAuth
    await window.LayerDB.signInWithGoogle();
    // User will be redirected to Google, then back to app

  } catch (error) {
    console.error('Google sign in error:', error);

    // Restore button state
    if (googleBtn && originalContent) {
      googleBtn.disabled = false;
      googleBtn.innerHTML = originalContent;
    }

    // Show user-friendly error
    let errorMessage = 'Failed to sign in with Google';
    if (error.message?.includes('popup')) {
      errorMessage = 'Popup blocked. Please allow popups for this site.';
    } else if (error.message?.includes('redirect')) {
      errorMessage = 'Redirect failed. Please check your configuration.';
    }

    showAuthError(errorMessage);
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errorEl = document.getElementById('authError');
  const submitBtn = event.target.querySelector('button[type="submit"]');

  // Clear previous errors
  errorEl.style.display = 'none';

  // Disable button during submission
  if (submitBtn) {
    submitBtn.disabled = true;
    const btnText = submitBtn.querySelector('span');
    if (btnText) {
      btnText.textContent = authMode === 'signup' ? 'Creating Account...' : 'Signing In...';
    } else {
      submitBtn.textContent = authMode === 'signup' ? 'Creating Account...' : 'Signing In...';
    }
  }

  try {
    if (authMode === 'signup') {
      const username = document.getElementById('authUsername').value.trim();
      const confirmPassword = document.getElementById('authConfirmPassword').value;

      // Validation
      if (!email || !username || !password || !confirmPassword) {
        showAuthError('Please fill in all fields');
        return;
      }

      if (password !== confirmPassword) {
        showAuthError('Passwords do not match');
        return;
      }

      if (password.length < 6) {
        showAuthError('Password must be at least 6 characters');
        return;
      }

      // Use Supabase Auth for signup
      const { data, error } = await window.LayerDB.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: username
          },
          emailRedirectTo: window.location.origin + '/layer.html'
        }
      });

      if (error) {
        console.error('Signup error:', error);
        showAuthError(error.message || 'Failed to create account');
        return;
      }

      if (data.user && !data.session) {
        // Email confirmation required
        closeModal();
        showNotification('Check your email to confirm your account!', 'success');
        return;
      }

      // Successfully signed up and logged in
      closeModal();
      await loadUserDataFromDB();
      updateUserDisplay({ username: username, email: email });
      showNotification('Account created successfully!', 'success');
      renderCurrentView();

    } else {
      // Sign In with Supabase
      if (!email || !password) {
        showAuthError('Please enter your email and password');
        return;
      }

      const { data, error } = await window.LayerDB.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Sign in error:', error);
        if (error.message.includes('Invalid login credentials')) {
          showAuthError('Invalid email or password');
        } else if (error.message.includes('Email not confirmed')) {
          showAuthError('Please confirm your email before signing in');
        } else {
          showAuthError(error.message || 'Failed to sign in');
        }
        return;
      }

      closeModal();
      // Ensure profile exists for newly signed in user
      try {
        await window.LayerDB.ensureUserProfile();
      } catch (profileError) {
        console.error('Failed to ensure user profile after sign in:', profileError);
      }
      await loadUserDataFromDB();
      const username = data.user?.user_metadata?.name || data.user?.email?.split('@')[0] || 'User';
      await updateUserDisplay({ username: username, email: data.user.email });
      showNotification('Signed in successfully!', 'success');
      renderCurrentView();
    }
  } catch (err) {
    console.error('Auth error:', err);
    showAuthError('An unexpected error occurred. Please try again.');
  } finally {
    // Re-enable button
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = authMode === 'signup' ? 'Create Account' : 'Sign In';
    }
  }
}

function showAuthError(message) {
  const errorEl = document.getElementById('authError');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.style.display = 'block';

  // Re-enable submit button if it exists
  const submitBtn = document.querySelector('.auth-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = false;
    const btnText = submitBtn.querySelector('span');
    if (btnText) {
      btnText.textContent = authMode === 'signup' ? 'Create Account' : 'Sign In';
    }
  }
}

async function updateUserDisplay(user) {
  console.log('Updating user display:', user);

  let signInBtn = document.getElementById('signInBtn');
  let userInfo = document.getElementById('userInfo');

  // If user is logged in
  if (user && user.email) {
    // ONLY use the saved profile name from database, never Google name
    let displayName = 'User'; // default fallback
    
    // Try to get profile name from database (this is the ONLY source we want)
    try {
      if (window.LayerDB && typeof window.LayerDB.getProfile === 'function') {
        const profile = await window.LayerDB.getProfile();
        if (profile && profile.name) {
          displayName = profile.name;
          console.log('Using saved profile name from database (IGNORING Google name):', displayName);
        }
      }
    } catch (error) {
      console.warn('Failed to get profile name, using default:', error);
    }
    
    // If no profile name exists, use email split (NEVER use Google metadata name)
    if (displayName === 'User') {
      displayName = user.email?.split('@')[0] || 'User';
      console.log('No saved profile found, using email split (NOT Google name):', displayName);
    }
    
    const initials = displayName.slice(0, 2).toUpperCase();

    // Try to get user profile for avatar
    let avatarElement = `<div class="user-avatar">${initials}</div>`;

    try {
      if (window.LayerDB && typeof window.LayerDB.getProfile === 'function') {
        const profile = await window.LayerDB.getProfile();
        if (profile && profile.avatar_url) {
          // Use Google avatar if available
          avatarElement = `<img class="user-avatar-img" src="${profile.avatar_url}" alt="${displayName}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">` +
            `<div class="user-avatar fallback" style="display:none;">${initials}</div>`;
        }
      }
    } catch (error) {
      console.warn('Failed to load user profile for avatar:', error);
      // Fall back to initials
    }

    const userInfoHTML = `
      <div class="user-info" id="userInfo">
        <div class="user-avatar-wrapper">
          ${avatarElement}
          <div class="user-status-indicator" title="Connected to database"></div>
        </div>
        <span class="user-name">${displayName}</span>
        <button class="sign-out-btn" onclick="signOutUser()" title="Sign Out">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    `;

    if (signInBtn) {
      // Replace sign in button with user info
      signInBtn.outerHTML = userInfoHTML;
    } else if (userInfo) {
      // Update existing user info
      userInfo.outerHTML = userInfoHTML;
    } else {
      console.warn('Neither signInBtn nor userInfo found in DOM');
    }
  }
}

async function signOutUser() {
  try {
    // Stop session monitoring and remove activity listeners
    stopSessionHeartbeat();
    removeActivityListeners();
    
    await window.LayerDB.supabase.auth.signOut();

    // CRITICAL: Clear ALL user-specific localStorage data to ensure data privacy
    const keysToRemove = [
      'layerProjectsData',
      'layerBacklogTasks',
      'layerMyIssues',
      'layerCalendarEvents',
      'layerDocs',
      'layerExcels',
      'layerSpaces',
      'layerSpaceChecklists',
      'layerRecurringTasks',
      'layerCurrentUser',
      'layerAssignments'
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Clear session persistence data
    clearSessionData();

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

    showNotification('Signed out successfully', 'info');
    
    // Show login page after signing out
    showLoginPage();
    
    // Clear spaces and favorites from sidebar immediately
    if (typeof renderSpacesInSidebar === 'function') {
      renderSpacesInSidebar();
    }
    if (typeof renderFavoritesInSidebar === 'function') {
      renderFavoritesInSidebar();
    }
  } catch (error) {
    console.error('Sign out error:', error);
    showNotification('Failed to sign out', 'error');
  }
}

// Load user data from database after login
async function loadUserDataFromDB() {
  try {
    const user = window.LayerDB.getCurrentUser();
    if (!user) {
      console.log('No user authenticated, skipping DB load');
      return;
    }

    console.log('Loading user data from database for:', user.email);

    // CRITICAL: Clear existing localStorage before loading new user's data
    // This ensures no data leakage between users
    localStorage.removeItem('layerProjectsData');
    localStorage.removeItem('layerBacklogTasks');
    localStorage.removeItem('layerMyIssues');
    localStorage.removeItem('layerCalendarEvents');
    localStorage.removeItem('layerDocs');
    localStorage.removeItem('layerExcels');
    localStorage.removeItem('layerSpaces');
    localStorage.removeItem('layerDrafts');
    // Also clear old favorites arrays (now stored in docs/excels)
    localStorage.removeItem('layerFavorites');
    localStorage.removeItem('layerFavoriteDocs');
    localStorage.removeItem('layerExcelFavorites');
    localStorage.removeItem('layerFavoriteExcels');

    // Load all user data from Supabase (including calendar events, docs, excels, spaces)
    const [projects, backlogTasks, issues, calendarEvents, docs, excels, spaces, drafts] = await Promise.all([
      window.LayerDB.loadProjects(),
      window.LayerDB.loadBacklogTasks(),
      window.LayerDB.loadIssues(),
      window.LayerDB.loadCalendarEvents(),
      window.LayerDB.loadDocs(),
      window.LayerDB.loadExcels(),
      window.LayerDB.loadSpaces(),
      window.LayerDB.loadDrafts()
    ]);

    // Cache in localStorage for synchronous access by render functions
    localStorage.setItem('layerProjectsData', JSON.stringify(projects || []));
    localStorage.setItem('layerBacklogTasks', JSON.stringify(backlogTasks || []));
    localStorage.setItem('layerMyIssues', JSON.stringify(issues || []));
    localStorage.setItem('layerCalendarEvents', JSON.stringify(calendarEvents || []));
    localStorage.setItem('layerDocs', JSON.stringify(docs || []));
    localStorage.setItem('layerExcels', JSON.stringify(excels || []));
    localStorage.setItem('layerSpaces', JSON.stringify(spaces || []));
    localStorage.setItem('layerDrafts', JSON.stringify(drafts || []));

    // Cache drafts in memory for synchronous Drafts rendering
    window.cachedDrafts = drafts || [];

    // Cache checklists from spaces
    const checklists = {};
    spaces.forEach(space => {
      if (space.checklist && space.checklist.length > 0) {
        checklists[String(space.id)] = space.checklist;
      }
    });
    localStorage.setItem('layerSpaceChecklists', JSON.stringify(checklists));

    console.log('User data loaded from database:', {
      projects: projects?.length || 0,
      backlogTasks: backlogTasks?.length || 0,
      issues: issues?.length || 0,
      calendarEvents: calendarEvents?.length || 0,
      docs: docs?.length || 0,
      excels: excels?.length || 0,
      spaces: spaces?.length || 0
    });

    // Render spaces in sidebar immediately after loading
    if (typeof renderSpacesInSidebar === 'function') {
      renderSpacesInSidebar();
    }

    // Render favorites in sidebar immediately after loading
    if (typeof renderFavoritesInSidebar === 'function') {
      renderFavoritesInSidebar();
    }

    // Initialize presence tracking
    if (window.LayerDB && window.LayerDB.isAuthenticated()) {
      // Update presence on load
      window.LayerDB.updatePresence(true, null).catch(console.error);

      // Update presence every 30 seconds to keep user online
      setInterval(() => {
        if (window.LayerDB && window.LayerDB.isAuthenticated()) {
          window.LayerDB.updatePresence(true, null).catch(console.error);
        }
      }, 30000);
    }

    // Initialize realtime subscriptions for live updates
    setupRealtimeSubscription();

    // 🚀 BACKGROUND LOAD: Preload DM messages for instant team chat access
    // Start this in background after main data is loaded
    setTimeout(() => {
      if (typeof preloadTeamDMMessages === 'function') {
        preloadTeamDMMessages();
      }
    }, 1000); // Start after 1 second to not block main UI
  } catch (error) {
    console.error('Failed to load user data:', error);
    // On error, ensure empty arrays so user sees clean state
    localStorage.setItem('layerProjectsData', '[]');
    localStorage.setItem('layerBacklogTasks', '[]');
    localStorage.setItem('layerMyIssues', '[]');
    localStorage.setItem('layerCalendarEvents', '[]');
    localStorage.setItem('layerDocs', '[]');
    localStorage.setItem('layerExcels', '[]');
    localStorage.setItem('layerSpaces', '[]');
    localStorage.setItem('layerSpaceChecklists', '{}');

    // Clear spaces and favorites from sidebar on error
    if (typeof renderSpacesInSidebar === 'function') {
      renderSpacesInSidebar();
    }
    if (typeof renderFavoritesInSidebar === 'function') {
      renderFavoritesInSidebar();
    }
  }
}

// ============================================
// Advanced Session Management
// ============================================

// Session persistence configuration
const SESSION_CONFIG = {
  STORAGE_KEY: 'layer_session_data',
  REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes before expiry
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes of inactivity
  HEARTBEAT_INTERVAL: 60 * 1000, // Check every minute
};

// Session state tracking
let sessionHeartbeat = null;
let lastActivity = Date.now();
let sessionData = null;

// Save session data to localStorage for persistence
function saveSessionData(user, session) {
  try {
    const sessionInfo = {
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
        created_at: user.created_at
      },
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type
      },
      timestamp: Date.now(),
      lastActivity: Date.now()
    };
    
    localStorage.setItem(SESSION_CONFIG.STORAGE_KEY, JSON.stringify(sessionInfo));
    sessionData = sessionInfo;
    console.log('✅ Session data saved to localStorage');
  } catch (error) {
    console.error('❌ Failed to save session data:', error);
  }
}

// Load session data from localStorage
function loadSessionData() {
  try {
    const stored = localStorage.getItem(SESSION_CONFIG.STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      sessionData = data;
      return data;
    }
  } catch (error) {
    console.error('❌ Failed to load session data:', error);
    localStorage.removeItem(SESSION_CONFIG.STORAGE_KEY);
  }
  return null;
}

// Clear session data from localStorage
function clearSessionData() {
  try {
    localStorage.removeItem(SESSION_CONFIG.STORAGE_KEY);
    sessionData = null;
    console.log('✅ Session data cleared from localStorage');
  } catch (error) {
    console.error('❌ Failed to clear session data:', error);
  }
}

// Check if stored session is still valid
function isSessionValid(sessionInfo) {
  if (!sessionInfo || !sessionInfo.session) return false;
  
  const now = Date.now();
  const sessionAge = now - sessionInfo.timestamp;
  const timeSinceActivity = now - sessionInfo.lastActivity;
  
  // Check if session is too old (24 hours max)
  if (sessionAge > 24 * 60 * 60 * 1000) {
    console.log('⏰ Session too old, requiring re-authentication');
    return false;
  }
  
  // Check for inactivity timeout
  if (timeSinceActivity > SESSION_CONFIG.SESSION_TIMEOUT) {
    console.log('⏰ Session timed out due to inactivity');
    return false;
  }
  
  // Check if token is about to expire
  const expiresAt = sessionInfo.session.expires_at * 1000;
  const timeUntilExpiry = expiresAt - now;
  
  if (timeUntilExpiry < SESSION_CONFIG.REFRESH_THRESHOLD) {
    console.log('⏰ Token about to expire, refresh needed');
    return false; // Let Supabase handle refresh
  }
  
  return true;
}

// Update last activity timestamp
function updateActivity() {
  lastActivity = Date.now();
  if (sessionData) {
    sessionData.lastActivity = lastActivity;
    try {
      localStorage.setItem(SESSION_CONFIG.STORAGE_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.error('❌ Failed to update activity timestamp:', error);
    }
  }
}

// Start session heartbeat monitoring
function startSessionHeartbeat() {
  if (sessionHeartbeat) {
    clearInterval(sessionHeartbeat);
  }
  
  sessionHeartbeat = setInterval(() => {
    updateActivity();
    
    // Check session validity
    if (sessionData && !isSessionValid(sessionData)) {
      console.log('❌ Session invalid, signing out');
      signOutUser();
    }
  }, SESSION_CONFIG.HEARTBEAT_INTERVAL);
  
  console.log('✅ Session heartbeat started');
}

// Stop session heartbeat
function stopSessionHeartbeat() {
  if (sessionHeartbeat) {
    clearInterval(sessionHeartbeat);
    sessionHeartbeat = null;
    console.log('⏹️ Session heartbeat stopped');
  }
}

// Add activity listeners for session tracking
function addActivityListeners() {
  // Remove existing listeners to prevent duplicates
  removeActivityListeners();
  
  // Track user activity to prevent session timeout
  const activityEvents = [
    'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click',
    'keydown', 'keyup', 'focus', 'blur', 'change', 'input', 'submit'
  ];
  
  const throttledUpdate = throttle(updateActivity, 1000); // Throttle to once per second
  
  activityEvents.forEach(event => {
    document.addEventListener(event, throttledUpdate, { passive: true });
  });
  
  // Track page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updateActivity();
    }
  });
  
  console.log('✅ Activity listeners added for session tracking');
}

// Remove activity listeners
function removeActivityListeners() {
  const activityEvents = [
    'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click',
    'keydown', 'keyup', 'focus', 'blur', 'change', 'input', 'submit'
  ];
  
  activityEvents.forEach(event => {
    document.removeEventListener(event, updateActivity);
  });
  
  document.removeEventListener('visibilitychange', updateActivity);
  console.log('✅ Activity listeners removed');
}

// Throttle function to limit function calls
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

// Restore session from localStorage if valid
async function restoreSessionFromStorage() {
  const storedSession = loadSessionData();
  
  if (!storedSession) {
    console.log('📦 No stored session found');
    return null;
  }
  
  if (!isSessionValid(storedSession)) {
    console.log('❌ Stored session invalid, clearing');
    clearSessionData();
    return null;
  }
  
  try {
    // Try to restore session with Supabase
    const { data, error } = await window.LayerDB.supabase.auth.setSession({
      access_token: storedSession.session.access_token,
      refresh_token: storedSession.session.refresh_token
    });
    
    if (error) {
      console.error('❌ Failed to restore session:', error);
      clearSessionData();
      return null;
    }
    
    console.log('✅ Session restored from localStorage');
    return data;
  } catch (error) {
    console.error('❌ Error restoring session:', error);
    clearSessionData();
    return null;
  }
}

// Enhanced checkExistingSession with advanced persistence
async function checkExistingSession() {
  try {
    console.log('🔍 Checking for existing session...');
    
    // First, try to restore from localStorage
    const restoredSession = await restoreSessionFromStorage();
    
    // Initialize Supabase auth (this will also check for existing session)
    const { user, session } = await window.LayerDB.initAuth();

    // Always check for URL parameters (invitations) even if not logged in yet
    await handleUrlParameters();

    if (user && session) {
      console.log('✅ User session found:', user.email);

      // Save session data for persistence
      saveSessionData(user, session);
      
      // Hide login page if it's showing
      hideLoginPage();

      // Ensure profile exists for existing sessions too
      try {
        await window.LayerDB.ensureUserProfile();
      } catch (profileError) {
        console.error('Failed to ensure user profile for existing session:', profileError);
      }

      // For Google OAuth users, check if username exists in database
      const username = user.user_metadata?.name || user.email?.split('@')[0] || 'User';

      // Load user data from database
      await loadUserDataFromDB();

      // Update UI with user info
      await updateUserDisplay({ username: username, email: user.email });

      // Start session monitoring
      startSessionHeartbeat();

      // Add activity listeners for session tracking
      addActivityListeners();

      renderCurrentView();
    } else {
      // No user session - show login page
      console.log('❌ No user session found, showing login page');
      showLoginPage();
      stopSessionHeartbeat();
    }

    // Listen for auth state changes
    window.addEventListener('authStateChanged', async (event) => {
      const { user, session, event: eventType } = event.detail;
        
      // Check if this is a first-time Google user
      if (user && session && eventType === 'SIGNED_IN') {
        const isFirstTime = await detectFirstTimeGoogleUser();
        if (isFirstTime) {
          // Delay to ensure UI is ready
          setTimeout(() => {
            showFirstTimeSetup();
          }, 500);
          return; // Skip normal sign-in flow
        }
      }
      const { user: authUser, session: authSession, event: authEvent } = event.detail;

      console.log('Auth state changed:', authEvent, authUser?.email);

      if (authUser && authSession) {
        // User signed in - ensure profile exists
        try {
          await window.LayerDB.ensureUserProfile();
        } catch (profileError) {
          console.error('Failed to ensure user profile:', profileError);
          // Continue anyway as the app might still work
        }

        // Only update UI and show notifications on actual auth changes, not token refreshes
        console.log('🔍 Auth event type:', authEvent, 'Checking if should show welcome...');

        // User signed in
        const username = authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User';

        // List of events that should trigger welcome message and UI updates
        const welcomeEvents = ['SIGNED_IN', 'INITIAL_SESSION'];
        // List of refresh events that should NOT trigger any UI updates
        const refreshEvents = ['TOKEN_REFRESHED', 'REFRESHED', 'UPDATED'];

        if (welcomeEvents.includes(authEvent)) {
          console.log('✅ Processing auth change for event:', authEvent);

          // Set up realtime subscription for projects only on actual sign-in
          setupRealtimeSubscription();

          // Load user data only on actual sign-in
          await loadUserDataFromDB();

          // Initialize realtime subscriptions only on actual sign-in
          if (typeof initializeRealtimeSubscriptions === 'function') {
            await initializeRealtimeSubscriptions();
          }

          // Update UI
          await updateUserDisplay({ username: username, email: authUser.email });

          // Close any open modals
          closeModal();

          // Show success notification
          showNotification(`Welcome back, ${username}!`, 'success');

          // Send welcome email to user's Google account
          if (window.LayerDB && typeof window.LayerDB.sendWelcomeEmail === 'function') {
            try {
              await window.LayerDB.sendWelcomeEmail(authUser.email, username);
            } catch (error) {
              console.error('Failed to send welcome email:', error);
            }
          }

          // Handle project invitation after sign in
          await handleUrlParameters();

          // Re-render the entire view
          renderCurrentView();
        } else if (refreshEvents.includes(authEvent)) {
          console.log('🔄 Skipping ALL UI updates for refresh event:', authEvent);
          // Do absolutely nothing on refresh events
        } else {
          console.log('❓ Unknown auth event type:', authEvent, ' - skipping UI updates to be safe');
        }
      } else {
        // User signed out
        console.log('User signed out');

        // Cleanup realtime subscriptions
        if (typeof cleanupRealtimeSubscriptions === 'function') {
          cleanupRealtimeSubscriptions();
        }

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
        renderCurrentView();
      }
    });
  } catch (error) {
    console.error('Session check error:', error);
  }
}

/**
 * Handles project invitations and specific project views via URL parameters
 */
async function handleUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('project');

  if (!projectId) return;

  console.log('Handling URL parameters for project:', projectId);

  try {
    // Check authentication
    if (!window.LayerDB || !window.LayerDB.isAuthenticated()) {
      console.log('User not authenticated, showing login for project invitation');
      // Store project ID to show info in auth modal if we want
      window.pendingProjectInvite = projectId;

      // Open auth modal after a small delay to ensure UI is ready
      setTimeout(() => {
        if (typeof openAuthModal === 'function') {
          openAuthModal();
          showNotification('Please sign in to join the project', 'info');
        }
      }, 500);
      return;
    }

    // 1. Try to find the project in already loaded projects
    let projects = loadProjects();
    let index = projects.findIndex(p => p.id === projectId);

    if (index === -1) {
      // 2. If not found, try to join if invited
      showNotification('Checking invitation...', 'info');
      const joinResult = await window.LayerDB.checkInvitationAndJoin(projectId);

      if (joinResult.success) {
        showNotification(joinResult.message, 'success');
        // Reload projects to include the newly joined one
        await loadUserDataFromDB();
        projects = loadProjects();
        index = projects.findIndex(p => p.id === projectId);
      } else {
        console.warn('Could not join project:', joinResult.error);
        showNotification(joinResult.error || 'Project not found or no invitation', 'error');
        // Clean up URL if invitation is invalid to avoid infinite loops/confusion
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        return;
      }
    }

    // 3. Open project detail
    if (index !== -1) {
      selectedProjectIndex = index;
      currentView = 'activity'; // Ensure we are in project view mode

      // Clean up URL without refreshing
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  } catch (error) {
    console.error('Error handling URL parameters:', error);
  }
}

// ============================================
// First-Time User Setup
// ============================================

function showFirstTimeSetup() {
  const modal = document.getElementById('firstTimeSetupModal');
  if (!modal) return;
  
  isFirstTimeSetup = true;
  modal.classList.add('active');
  populateThemeGrid();
  
  // Auto-focus username field
  setTimeout(() => {
    const usernameInput = document.getElementById('setupUsername');
    if (usernameInput) {
      usernameInput.focus();
    }
  }, 300);
}

function closeFirstTimeSetup() {
  const modal = document.getElementById('firstTimeSetupModal');
  if (!modal) return;
  
  isFirstTimeSetup = false;
  modal.classList.remove('active');
}

function populateThemeGrid() {
  const themeGrid = document.getElementById('themeGrid');
  if (!themeGrid) return;
  
  themeGrid.innerHTML = '';
  
  AVAILABLE_THEMES.forEach(theme => {
    const themeCard = document.createElement('div');
    themeCard.className = 'theme-card';
    themeCard.dataset.theme = theme.id;
    themeCard.dataset.mode = theme.mode;
    
    themeCard.innerHTML = `
      <div class="theme-preview">
        <div class="theme-preview-header"></div>
        <div class="theme-preview-sidebar"></div>
        <div class="theme-preview-content">
          <div class="theme-preview-dot"></div>
        </div>
      </div>
      <div class="theme-card-info">
        <div class="theme-card-name">${theme.name}</div>
        <div class="theme-card-mode">${theme.mode === 'dark' ? 'Dark' : 'Light'}</div>
      </div>
    `;
    
    themeCard.addEventListener('click', () => {
      // Remove selected class from all cards
      document.querySelectorAll('.theme-card').forEach(card => {
        card.classList.remove('selected');
      });
      
      // Add selected class to clicked card
      themeCard.classList.add('selected');
      
      // Temporarily apply theme for preview
      applyThemePreview(theme.id, theme.mode);
    });
    
    themeGrid.appendChild(themeCard);
  });
  
  // Select default theme (dark)
  const defaultCard = themeGrid.querySelector('[data-theme="dark"]');
  if (defaultCard) {
    defaultCard.classList.add('selected');
  }
}

function applyThemePreview(themeId, mode) {
  const html = document.documentElement;
  const body = document.body;
  
  // Reset any existing theme classes
  html.removeAttribute('data-theme');
  html.removeAttribute('data-mode');
  body.classList.remove('light');
  
  // Apply new theme
  if (themeId === 'light') {
    body.classList.add('light');
  } else if (themeId === 'dark') {
    // Default dark theme - no attributes needed
  } else {
    html.setAttribute('data-theme', themeId);
    html.setAttribute('data-mode', mode);
  }
}

function getSelectedTheme() {
  const selectedCard = document.querySelector('.theme-card.selected');
  if (!selectedCard) return { theme: 'dark', mode: 'dark' };
  
  return {
    theme: selectedCard.dataset.theme,
    mode: selectedCard.dataset.mode
  };
}

async function handleFirstTimeSetupSubmit(event) {
  event.preventDefault();
  
  const usernameInput = document.getElementById('setupUsername');
  const submitBtn = document.getElementById('setupSubmitBtn');
  
  const username = usernameInput.value.trim();
  if (!username) {
    showNotification('Please enter your name', 'error');
    usernameInput.focus();
    return;
  }
  
  const selectedTheme = getSelectedTheme();
  
  // Show loading state
  submitBtn.disabled = true;
  submitBtn.classList.add('loading');
  submitBtn.textContent = 'Saving...';
  
  try {
    // Save user preferences to database
    if (window.LayerDB && typeof window.LayerDB.updateUserPreferences === 'function') {
      await window.LayerDB.updateUserPreferences({
        theme: selectedTheme.theme,
        left_panel_width: 280
      });
    }
    
    // Update user profile with username
    if (window.LayerDB && typeof window.LayerDB.updateUserProfile === 'function') {
      await window.LayerDB.updateUserProfile({
        name: username
      });
    }
    
    // Save to localStorage as fallback
    localStorage.setItem('layerTheme', selectedTheme.theme);
    localStorage.setItem('layerThemeMode', selectedTheme.mode);
    
    // Close setup modal
    closeFirstTimeSetup();
    
    // Show success message
    showNotification(`Welcome, ${username}! Theme set to ${selectedTheme.theme}.`, 'success');
    
    // Reload user data to reflect changes
    await loadUserDataFromDB();
    
    // Update user display
    const currentUser = window.LayerDB?.getCurrentUser();
    if (currentUser) {
      await updateUserDisplay({
        username: username,
        email: currentUser.email
      });
    }
    
    // Re-render the current view
    renderCurrentView();
    
  } catch (error) {
    console.error('Failed to complete setup:', error);
    showNotification('Failed to save your preferences. Please try again.', 'error');
    
    // Restore button state
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
    submitBtn.textContent = 'Get Started';
  }
}

// Detect if user is a first-time Google user
async function detectFirstTimeGoogleUser() {
  if (!window.LayerDB || !window.LayerDB.isAuthenticated()) return false;
  
  const currentUser = window.LayerDB.getCurrentUser();
  if (!currentUser) return false;
  
  // Check if user has a name set in profile or user_metadata
  const username = currentUser.user_metadata?.name || 
                  currentUser.email?.split('@')[0] || 
                  '';
  
  // Check if user has preferences stored
  try {
    const prefs = await window.LayerDB.getUserPreferences();
    const hasTheme = prefs && prefs.theme;
    
    // If user has no name in profile but Google gave us one, this is still "configured"
    const hasMetadataName = currentUser.user_metadata?.name?.trim();
    
    // Consider first-time if: no theme preference OR no name in profile
    return !hasTheme || !hasMetadataName;
  } catch (error) {
    console.error('Error checking first-time status:', error);
    return false;
  }
}


// ============================================
// View Rendering
// ============================================

// Store scroll position for schedule view
let scheduleScrollPosition = { x: 0, y: 0 };

// Save current schedule scroll position
function saveScheduleScrollPosition() {
  const scrollContainer = document.querySelector('.week-grid-scroll, .day-view-grid-scroll');
  if (scrollContainer) {
    scheduleScrollPosition = {
      x: scrollContainer.scrollLeft,
      y: scrollContainer.scrollTop
    };
  }
}

// Restore schedule scroll position after render
function restoreScheduleScrollPosition() {
  requestAnimationFrame(() => {
    const scrollContainer = document.querySelector('.week-grid-scroll, .day-view-grid-scroll');
    if (scrollContainer && (scheduleScrollPosition.x > 0 || scheduleScrollPosition.y > 0)) {
      scrollContainer.scrollLeft = scheduleScrollPosition.x;
      scrollContainer.scrollTop = scheduleScrollPosition.y;
    }
  });
}

// ============================================
// Async Profile Loading for Project Detail View
// ============================================
async function loadProjectDetailProfiles(projectIndex) {
  const projects = loadProjects();
  const project = projects[projectIndex];
  if (!project || !window.LayerDB || !window.LayerDB.isAuthenticated()) return;

  // 1. Collect all user IDs we need (owner + task completers)
  const userIds = [project.user_id];
  if (project.columns) {
    project.columns.forEach(col => {
      col.tasks.forEach(task => {
        if (task.completed_by) userIds.push(task.completed_by);
      });
    });
  }

  // 2. Batch fetch all profiles
  try {
    await window.LayerDB.fetchProfiles(userIds);
  } catch (e) {
    console.error('Failed to batch fetch profiles:', e);
    return;
  }

  // 3. Update Lead display
  const ownerProfile = window.LayerDB.getCachedProfile(project.user_id);
  const leadValueEl = document.getElementById('projectLeadValue');
  if (leadValueEl && ownerProfile) {
    const displayName = ownerProfile.name || ownerProfile.email?.split('@')[0] || 'Unknown';
    const avatarHtml = ownerProfile.avatar_url
      ? `<img src="${ownerProfile.avatar_url}" alt="${displayName}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
         <div class="member-avatar" style="width:24px;height:24px;font-size:12px;background:${getNameColor(displayName)};color:white;border-radius:50%;display:none;align-items:center;justify-content:center;">${displayName.charAt(0).toUpperCase()}</div>`
      : `<div class="member-avatar" style="width:24px;height:24px;font-size:12px;background:${getNameColor(displayName)};color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;">${displayName.charAt(0).toUpperCase()}</div>`;
    leadValueEl.innerHTML = `${avatarHtml}<span style="color:var(--foreground);">${displayName}</span>`;
  }

  // 4. Update task completer avatars
  document.querySelectorAll('.task-completer-avatar[data-completer-id]').forEach(el => {
    const userId = el.getAttribute('data-completer-id');
    const profile = window.LayerDB.getCachedProfile(userId);
    if (profile) {
      const name = profile.name || profile.email?.split('@')[0] || 'User';
      el.title = `Completed by ${name}`;
      if (profile.avatar_url) {
        el.innerHTML = `<img src="${profile.avatar_url}" alt="${name}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.parentElement.innerHTML='${name.charAt(0).toUpperCase()}'">`;
      } else {
        el.innerHTML = name.charAt(0).toUpperCase();
        el.style.background = getNameColor(name);
        el.style.color = 'white';
        el.style.fontSize = '10px';
        el.style.fontWeight = '600';
      }
    }
  });
}

// Render current view with optional scroll preservation
async function renderCurrentView(preserveScroll = false) {
  // Check if drafts need refresh and we're on drafts view
  if (currentView === 'drafts' && window.draftsNeedRefresh) {
    // Force re-render by resetting the context
    lastRenderContext = '';
  }

  // Create a context signature for this render
  const renderContext = `${currentView}_${selectedProjectIndex}_${currentProjectTab}`;

  // Debounce rapid renders
  const now = Date.now();
  if ((now - lastRenderTime < RENDER_DEBOUNCE) && lastRenderContext === renderContext) {
    // Skip rendering if called too rapidly with same context
    return;
  }
  lastRenderTime = now;
  lastRenderContext = renderContext;

  // Save scroll position if we're on schedule view and preserving scroll
  if (preserveScroll && currentView === 'schedule') {
    saveScheduleScrollPosition();
  }

  // Only render project detail view if current view is not project-specific
  if (selectedProjectIndex !== null && currentView !== 'schedule') {
    viewsContainer.innerHTML = renderProjectDetailView(selectedProjectIndex);
    updateBreadcrumb('Project Details');

    // Setup project-specific realtime subscription for live updates
    const projects = loadProjects();
    const currentProject = projects[selectedProjectIndex];
    if (currentProject && currentProject.id) {
      setupProjectDetailRealtime(currentProject.id);
    }

    // Async load profiles for lead and task completion avatars
    loadProjectDetailProfiles(selectedProjectIndex);

    // Switch to the current project tab after rendering, with a small delay
    // Only do this if we're not already on the correct tab
    setTimeout(() => {
      if (typeof switchProjectTab === 'function' && typeof currentProjectTab !== 'undefined') {
        // Check if we need to switch tabs (avoid unnecessary switching)
        const currentActiveTab = document.querySelector('.pd-tab.active');
        if (!currentActiveTab || currentActiveTab.dataset.tab !== currentProjectTab) {
          switchProjectTab(currentProjectTab, selectedProjectIndex);
        }
      }
    }, 50);

    return;
  }

  // Cleanup project detail realtime when not viewing a project
  if (typeof cleanupProjectDetailRealtime === 'function') {
    cleanupProjectDetailRealtime();
  }

  // Stop shared content polling when leaving inbox view
  if (currentView !== 'inbox' && typeof stopSharedContentPolling === 'function') {
    stopSharedContentPolling();
  }

  // Cleanup animated backgrounds when switching away from drafts
  cleanupAnimatedBackgrounds();

  switch (currentView) {
    case 'inbox':
      viewsContainer.innerHTML = renderInboxView();
      updateBreadcrumb('Inbox');
      // Apply saved widget order after rendering
      initDashboardWidgetOrder();
      // Restore dashboard AI sidebar state
      restoreDashboardAiSidebarState();
      // Start shared content polling for real-time updates
      if (typeof initializeSharedContentWidget === 'function') {
        initializeSharedContentWidget();
      }
      break;
    case 'my-issues':
      viewsContainer.innerHTML = renderMyIssuesView(currentFilter, searchQuery);
      updateBreadcrumb('My issues');
      setupIssueFilterListeners();
      break;
    case 'settings':
      // Handle async renderSettingsView
      (async () => {
        viewsContainer.innerHTML = await renderSettingsView();
        updateBreadcrumb('Settings');
        initThemeSelector();   // ← ADD THIS LINE
      })();
      break;
    case 'schedule':                          // ← Add this case
      viewsContainer.innerHTML = renderScheduleView();
      updateBreadcrumb('Schedule');
      // Initialize current time indicator
      if (typeof initCurrentTimeIndicator === 'function') {
        initCurrentTimeIndicator();
      }
      // Restore scroll position if preserving
      if (preserveScroll) {
        restoreScheduleScrollPosition();
      }
      break;
    case 'activity':
      viewsContainer.innerHTML = renderActivityView(searchQuery);
      updateBreadcrumb('Projects');
      break;
    case 'team':
      viewsContainer.innerHTML = renderTeamView();
      updateBreadcrumb('Team');
      break;
    case 'ai':
      viewsContainer.innerHTML = renderAIView();
      updateBreadcrumb('AI');
      break;
    case 'drafts':
      viewsContainer.innerHTML = renderDraftsView();
      updateBreadcrumb('Drafts');
      window.draftsNeedRefresh = false; // Reset the flag after rendering
      
      // Initialize animated backgrounds for draft cards
      setTimeout(() => {
        initializeAnimatedBackgrounds();
      }, 100);
      break;
    default:
      viewsContainer.innerHTML = renderMyIssuesView();
      updateBreadcrumb('My issues');
  }

  // Restore saved left panel width
  const savedWidth = loadLeftPanelWidth();
  if (savedWidth) {
    document.querySelectorAll('.tl-left-panel-clickup').forEach(panel => {
      panel.style.width = savedWidth + 'px';
    });
  }

  // Setup resize observer for left panels
  setTimeout(() => {
    document.querySelectorAll('.tl-left-panel-clickup').forEach(panel => {
      if (!panel.dataset.resizeObserved) {
        panel.dataset.resizeObserved = 'true';
        const observer = new ResizeObserver(entries => {
          for (const entry of entries) {
            const width = Math.round(entry.contentRect.width);
            if (width > 0) saveLeftPanelWidth(width);
          }
        });
        observer.observe(panel);
      }
    });
  }, 100);
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
  // Require authentication to create issues
  if (!window.LayerDB || !window.LayerDB.isAuthenticated()) {
    showNotification('Please sign in to create issues', 'error');
    openAuthModal();
    return;
  }
  openModal('Create New Issue', renderCreateIssueModalContent());
}

async function handleCreateIssueSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);

  const title = formData.get('title');
  const description = formData.get('description');
  const priority = formData.get('priority');
  const status = formData.get('status');

  if (title.trim()) {
    closeModal();
    await addIssue({
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      assignee: 'Zeyad Maher'
    });
    renderCurrentView();
  }
}



// ============================================
// Project Handlers
// ============================================
function openCreateProjectModal() {
  // Require authentication to create projects
  if (!window.LayerDB || !window.LayerDB.isAuthenticated()) {
    showNotification('Please sign in to create projects', 'error');
    openAuthModal();
    return;
  }
  openModal('Create new project', renderCreateProjectModalContent());
}

async function handleCreateProjectSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);

  const name = formData.get('name');
  const targetDate = formData.get('targetDate');
  const description = formData.get('description');

  if (name.trim() && targetDate) {
    console.log('Starting project creation...');
    closeModal();
    const newProject = await addProject({
      name: name.trim(),
      status: 'todo',
      startDate: new Date().toISOString().split('T')[0],
      targetDate,
      description: description.trim()
    });
    console.log('Project creation completed, re-rendering...');
    // Ensure localStorage is synced before re-render
    if (newProject) {
      // Force a synchronous read to ensure fresh data
      renderCurrentView();
      console.log('Re-render complete');
    }
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

async function handleDeleteProject(index) {
  if (confirm('Delete this project permanently?')) {
    await deleteProject(index);
    renderCurrentView();
  }
}

async function handleDeleteProjectFromDetail(index) {
  // Check if user is owner before allowing deletion
  if (typeof isProjectOwner === 'function' && !isProjectOwner(index)) {
    showNotification('Only the project owner can delete this project', 'error');
    return;
  }

  if (confirm('Delete this project permanently? This cannot be undone.')) {
    try {
      await deleteProject(index);
      showNotification('Project deleted successfully', 'success');
      closeProjectDetail();
    } catch (error) {
      console.error('Error deleting project:', error);
      showNotification(error.message || 'Failed to delete project', 'error');
    }
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
async function handleToggleProjectTask(projectIndex, columnIndex, taskIndex, event) {
  // Prevent event bubbling that could trigger tab switches or other handlers
  if (event) {
    event.stopPropagation();
  }

  // Save the current active tab before re-render
  const activeTab = document.querySelector('.pd-tab.active');
  const currentTabName = activeTab ? activeTab.dataset.tab : 'overview';

  // Toggle task done state with attribution (handled by data-store's toggleTaskDone)
  await toggleTaskDone(projectIndex, columnIndex, taskIndex);

  renderCurrentView();

  // Restore the active tab if we're in project detail view and timeline was active
  if (currentTabName === 'timeline' && typeof switchProjectTab === 'function') {
    requestAnimationFrame(() => {
      switchProjectTab('timeline', projectIndex);
    });
  }
}

function handleDeleteProjectTask(projectIndex, columnIndex, taskIndex, event) {
  // Prevent event bubbling that could trigger tab switches
  if (event) {
    event.stopPropagation();
  }

  // Save the current active tab before re-render
  const activeTab = document.querySelector('.pd-tab.active');
  const currentTabName = activeTab ? activeTab.dataset.tab : 'overview';

  // Direct deletion without confirmation
  const scrollPos = saveKanbanScrollPosition ? saveKanbanScrollPosition() : null;
  const projects = loadProjects();
  if (projects[projectIndex]?.columns[columnIndex]?.tasks[taskIndex]) {
    projects[projectIndex].columns[columnIndex].tasks.splice(taskIndex, 1);
    saveProjects(projects);
  }
  renderCurrentView();
  if (scrollPos && restoreKanbanScrollPosition) {
    restoreKanbanScrollPosition(scrollPos);
  }

  // Restore the active tab if we're in project detail view and timeline was active
  if (currentTabName === 'timeline' && typeof switchProjectTab === 'function') {
    requestAnimationFrame(() => {
        switchProjectTab('timeline', projectIndex);
      });
    }
}

function handleAddProjectTaskKeypress(event, projectIndex, columnIndex) {
  // Prevent event bubbling that could trigger tab switches
  if (event) {
    event.stopPropagation();
  }

  // Save the current active tab before re-render
  const activeTab = document.querySelector('.pd-tab.active');
  const currentTabName = activeTab ? activeTab.dataset.tab : 'overview';

  if (event.key === 'Enter') {
    const input = event.target;
    const title = input.value.trim();
    if (title) {
      addTaskToColumn(projectIndex, columnIndex, title);
      input.value = '';
      renderCurrentView();

      // Restore the active tab if we're in project detail view and timeline was active
      if (currentTabName === 'timeline' && typeof switchProjectTab === 'function') {
        requestAnimationFrame(() => {
          switchProjectTab('timeline', projectIndex);
        });
      }
    }
  }
}

function handleAddTaskToColumn(projectIndex, columnIndex, event) {
  // Prevent event bubbling that could trigger tab switches
  if (event) {
    event.stopPropagation();
  }

  // Save the current active tab before re-render
  const activeTab = document.querySelector('.pd-tab.active');
  const currentTabName = activeTab ? activeTab.dataset.tab : 'overview';

  // Find the column body where the input should be added
  const columnElement = event.target.closest('.tl-kanban-column');
  const taskListContainer = columnElement.querySelector('.tl-kanban-col-tasks');
  
  // Clear any existing input fields
  const existingInputs = taskListContainer.querySelectorAll('.tl-kanban-task-input');
  existingInputs.forEach(input => input.remove());
  
  // Create input field for task title
  const inputField = document.createElement('input');
  inputField.type = 'text';
  inputField.placeholder = 'Enter task title...';
  inputField.className = 'tl-kanban-task-input';
  inputField.style.width = 'calc(100% - 20px)';
  inputField.style.padding = '8px';
  inputField.style.margin = '10px';
  inputField.style.border = '1px solid var(--border)';
  inputField.style.borderRadius = '6px';
  inputField.style.backgroundColor = 'var(--background)';
  inputField.style.color = 'var(--foreground)';
  
  // Focus the input field
  inputField.focus();
  
  // Handle input submission
  inputField.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      const title = inputField.value;
      if (title && title.trim()) {
        addTaskToColumn(projectIndex, columnIndex, title.trim());
        renderCurrentView();
        
        // Restore the active tab if we're in project detail view and timeline was active
        if (currentTabName === 'timeline' && typeof switchProjectTab === 'function') {
          requestAnimationFrame(() => {
            switchProjectTab('timeline', projectIndex);
          });
        }
      } else {
        // Remove the input if empty
        taskListContainer.removeChild(inputField);
      }
    }
  });
  
  // Add cancel on blur if empty
  inputField.addEventListener('blur', function() {
    if (!inputField.value.trim()) {
      taskListContainer.removeChild(inputField);
    }
  });
  
  // Insert input field at the top of the task list
  taskListContainer.insertBefore(inputField, taskListContainer.firstChild);
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

// Note: renderInboxView is defined in functionality.js with the full dashboard

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

function renderDraftsView() {
  const drafts = loadDrafts();
  
  // Group drafts by type for stats
  const docDrafts = drafts.filter(d => d.type === 'doc');
  const sheetDrafts = drafts.filter(d => d.type === 'sheet');
  const whiteboardDrafts = drafts.filter(d => d.type === 'whiteboard');
  
  // Type icons
  const typeIcons = {
    doc: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
    sheet: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/>',
    whiteboard: '<path d="M2 3h20v14H2z"/><line x1="6" y1="7" x2="12" y2="7"/><line x1="6" y1="11" x2="15" y2="11"/><line x1="6" y1="15" x2="10" y2="15"/><line x1="6" y1="18" x2="5" y2="22"/><line x1="18" y1="18" x2="19" y2="22"/>'
  };
  
  const typeColors = {
    doc: 'var(--primary)',
    sheet: 'var(--success)',
    whiteboard: 'var(--warning)'
  };
  
  const typeLabels = {
    doc: 'Document',
    sheet: 'Spreadsheet',
    whiteboard: 'Whiteboard'
  };
  
  // Render empty state
  if (drafts.length === 0) {
    return `
      <div class="drafts-container">
        <div class="drafts-header-modern">
          <div class="drafts-header-left">
            <div class="drafts-title-group">
              <div class="drafts-icon-large">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div>
                <h1 class="drafts-title">Drafts</h1>
                <p class="drafts-subtitle">Work in progress saved automatically</p>
              </div>
            </div>
          </div>
        </div>
        
        <div class="drafts-empty-state">
          <div class="empty-illustration">
            <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="40" y="20" width="120" height="140" rx="8" stroke="var(--border)" stroke-width="2" fill="var(--card)"/>
              <rect x="60" y="45" width="80" height="6" rx="3" fill="var(--muted-foreground)" opacity="0.3"/>
              <rect x="60" y="60" width="60" height="6" rx="3" fill="var(--muted-foreground)" opacity="0.3"/>
              <rect x="60" y="75" width="70" height="6" rx="3" fill="var(--muted-foreground)" opacity="0.3"/>
              <rect x="60" y="100" width="80" height="40" rx="4" stroke="var(--border)" stroke-width="2" fill="var(--background)" stroke-dasharray="4 4"/>
              <circle cx="140" cy="40" r="12" fill="var(--primary)" opacity="0.1"/>
              <path d="M134 40L138 44L146 36" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h2 class="empty-title">No drafts yet</h2>
          <p class="empty-description">Start creating documents, spreadsheets, or whiteboards. Your work-in-progress will be automatically saved here.</p>
          <div class="empty-actions">
            <button class="draft-btn draft-btn-primary" onclick="openDocEditor()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
              New Document
            </button>
            <button class="draft-btn draft-btn-secondary" onclick="openExcelEditor()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              New Sheet
            </button>
            <button class="draft-btn draft-btn-secondary" onclick="createWhiteboardDraft().then(index => { if(index !== null) openGripDiagram(index); })">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="18" height="14" rx="1"/><line x1="5" y1="7" x2="11" y2="7"/><line x1="5" y1="10" x2="14" y2="10"/><line x1="5" y1="13" x2="9" y2="13"/><line x1="6" y1="17" x2="5" y2="22"/><line x1="16" y1="17" x2="17" y2="22"/></svg>
              New Whiteboard
            </button>
          </div>
        </div>
      </div>
    `;
  }
  
  return `
    <div class="drafts-container">
      <!-- Header -->
      <div class="drafts-header-modern">
        <div class="drafts-header-left">
          <div class="drafts-title-group">
            <div class="drafts-icon-large">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <div>
              <h1 class="drafts-title">Drafts</h1>
              <p class="drafts-subtitle">${drafts.length} item${drafts.length !== 1 ? 's' : ''} • Work in progress</p>
            </div>
          </div>
        </div>
        
        <div class="drafts-header-right">
          <div class="drafts-stats-chips">
            ${docDrafts.length > 0 ? `<div class="stat-chip stat-chip-docs"><span class="stat-chip-dot" style="background:#6366f1"></span>${docDrafts.length} Doc${docDrafts.length !== 1 ? 's' : ''}</div>` : ''}
            ${sheetDrafts.length > 0 ? `<div class="stat-chip stat-chip-sheets"><span class="stat-chip-dot" style="background:#22c55e"></span>${sheetDrafts.length} Sheet${sheetDrafts.length !== 1 ? 's' : ''}</div>` : ''}
            ${whiteboardDrafts.length > 0 ? `<div class="stat-chip stat-chip-boards"><span class="stat-chip-dot" style="background:#f59e0b"></span>${whiteboardDrafts.length} Board${whiteboardDrafts.length !== 1 ? 's' : ''}</div>` : ''}
          </div>
          
          <button class="draft-btn draft-btn-danger-outline" onclick="clearAllDrafts()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Clear All
          </button>
        </div>
      </div>
      
      <!-- Toolbar -->
      <div class="drafts-toolbar-modern">
        <div class="drafts-filters-modern">
          <button class="filter-chip active" data-filter="all" onclick="setDraftFilter(this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            All
          </button>
          <button class="filter-chip" data-filter="doc" onclick="setDraftFilter(this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            Docs
          </button>
          <button class="filter-chip" data-filter="sheet" onclick="setDraftFilter(this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            Sheets
          </button>
          <button class="filter-chip" data-filter="whiteboard" onclick="setDraftFilter(this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="18" height="14" rx="1"/><line x1="5" y1="7" x2="11" y2="7"/><line x1="5" y1="10" x2="14" y2="10"/><line x1="5" y1="13" x2="9" y2="13"/></svg>
            Boards
          </button>
        </div>
        
        <div class="drafts-toolbar-right">
          <div class="drafts-search-modern">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" id="drafts-search-input" placeholder="Search drafts..." onkeyup="filterDraftsModern()" />
          </div>
          
          <div class="drafts-sort-modern">
            <select id="drafts-sort-select" onchange="sortDraftsModern()">
              <option value="updated-desc">Recently updated</option>
              <option value="updated-asc">Oldest updated</option>
              <option value="created-desc">Recently created</option>
              <option value="created-asc">Oldest created</option>
              <option value="title-asc">Name A-Z</option>
              <option value="title-desc">Name Z-A</option>
            </select>
          </div>
        </div>
      </div>
      
      <!-- Content Grid -->
      <div class="drafts-content-modern">
        <div class="drafts-grid-modern" id="drafts-grid">
          ${drafts.map(draft => {
            const icon = typeIcons[draft.type] || typeIcons.doc;
            const color = typeColors[draft.type] || typeColors.doc;
            const label = typeLabels[draft.type] || 'Draft';
            const openFn = draft.type === 'doc' ? 'openDocEditorForDraft' : draft.type === 'sheet' ? 'openExcelEditorForDraft' : 'openGripDiagramForDraft';

            // Use the latest title from the underlying content when possible
            let displayTitle = draft.title || 'Untitled';
            try {
              if (draft.type === 'doc') {
                const docId = draft?.metadata?.docId;
                const doc = docId ? (loadDocs() || []).find(d => String(d.id) === String(docId)) : null;
                if (doc?.title) displayTitle = doc.title;
              } else if (draft.type === 'sheet') {
                const excelId = draft?.metadata?.excelId;
                const excel = excelId ? (loadExcels() || []).find(e => String(e.id) === String(excelId)) : null;
                if (excel?.title) displayTitle = excel.title;
              }
            } catch (e) {
              // Keep fallback title
            }
            
            return `
              <div class="draft-card" data-draft-id="${draft.id}" data-type="${draft.type}" data-title="${displayTitle}" data-updated="${draft.updatedAt}" data-created="${draft.createdAt}">
                <div class="draft-card-preview" onclick="${openFn}('${draft.id}')" style="--draft-accent: ${color}">
                  <div class="animated-background-container" data-draft-type="${draft.type}"></div>
                  <div class="draft-card-icon" style="background: ${color}20; color: ${color}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icon}</svg>
                  </div>
                  <div class="draft-card-overlay">
                    <span class="draft-card-action">Open</span>
                  </div>
                </div>
                
                <div class="draft-card-info">
                  <div class="draft-card-header">
                    <span class="draft-card-type" style="color: ${color}">${label}</span>
                    <button class="draft-card-delete" onclick="showDeleteConfirm('${draft.id}', '${draft.type}')" title="Delete draft">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                  
                  <h3 class="draft-card-title" onclick="${openFn}('${draft.id}')">${displayTitle}</h3>
                  
                  <div class="draft-card-meta">
                    <span class="draft-card-date" title="Updated: ${new Date(draft.updatedAt).toLocaleString()}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      ${formatTimeAgo(draft.updatedAt)}
                    </span>
                    
                    <!-- Save Button with Dropdown -->
                    <div class="draft-card-save-container">
                      <button class="draft-card-save-btn" onclick="toggleSaveDropdown('${draft.id}', event)" title="Save to Project or Space">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                          <polyline points="17 21 17 13 7 13 7 21"/>
                          <polyline points="7 3 7 8 15 8"/>
                        </svg>
                        <span>Save</span>
                        <svg class="dropdown-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                      
                      <!-- Save Dropdown Menu -->
                      <div class="draft-save-dropdown" id="save-dropdown-${draft.id}" style="display: none;">
                        <div class="save-dropdown-header">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                          </svg>
                          <span>Move to...</span>
                        </div>
                        
                        <div class="save-dropdown-section">
                          <div class="save-dropdown-label">Projects</div>
                          <div class="save-dropdown-projects" id="save-projects-${draft.id}">
                            <!-- Projects loaded dynamically -->
                          </div>
                        </div>
                        
                        <div class="save-dropdown-section">
                          <div class="save-dropdown-label">Spaces</div>
                          <div class="save-dropdown-spaces" id="save-spaces-${draft.id}">
                            <!-- Spaces loaded dynamically -->
                          </div>
                        </div>
                        
                        <div class="save-dropdown-footer">
                          <button class="save-dropdown-new-btn" onclick="showCreateSpaceFromDraft('${draft.id}', '${draft.type}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <line x1="12" y1="5" x2="12" y2="19"/>
                              <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            Create New Space
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Inline Delete Confirmation -->
                <div class="draft-delete-confirm" id="delete-confirm-${draft.id}" style="display: none;">
                  <div class="draft-delete-confirm-text">Delete this draft permanently?</div>
                  <div class="draft-delete-confirm-actions">
                    <button class="draft-delete-btn draft-delete-btn-cancel" onclick="hideDeleteConfirm('${draft.id}')">Cancel</button>
                    <button class="draft-delete-btn draft-delete-btn-confirm" onclick="confirmDeleteDraft('${draft.id}', '${draft.type}')">Delete</button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// Initialize animated backgrounds for draft cards
function initializeAnimatedBackgrounds() {
  const containers = document.querySelectorAll('.animated-background-container');
  
  containers.forEach(container => {
    // Skip if already initialized
    if (container.dataset.initialized) return;
    
    const draftType = container.dataset.draftType;
    
    // Define color schemes for different draft types
    const colorSchemes = {
      doc: {
        color1: '#FF9FFC',
        color2: '#5227FF',
        color3: '#B19EEF',
        timeSpeed: 0.4,
        warpStrength: 0.8,
        grainAmount: 0.05
      },
      sheet: {
        color1: '#4ECDC4',
        color2: '#44A08D',
        color3: '#093637',
        timeSpeed: 0.3,
        warpStrength: 0.6,
        grainAmount: 0.03
      },
      whiteboard: {
        color1: '#f6d365',
        color2: '#fda085',
        color3: '#ffecd2',
        timeSpeed: 0.5,
        warpStrength: 1.0,
        grainAmount: 0.08
      }
    };
    
    const scheme = colorSchemes[draftType] || colorSchemes.doc;
    
    try {
      const animatedBg = new AnimatedBackground(container, scheme);
      container.dataset.initialized = 'true';
      
      // Store reference for cleanup
      container._animatedBackground = animatedBg;
      
      console.log(`🎨 Initialized animated background for ${draftType} draft`);
    } catch (error) {
      console.error('Failed to initialize animated background:', error);
    }
  });
}

// Cleanup animated backgrounds when switching views
function cleanupAnimatedBackgrounds() {
  const containers = document.querySelectorAll('.animated-background-container');
  
  containers.forEach(container => {
    if (container._animatedBackground) {
      container._animatedBackground.destroy();
      delete container._animatedBackground;
    }
    delete container.dataset.initialized;
  });
}

// Modern filter function
function setDraftFilter(btn) {
  document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterDraftsModern();
}

function filterDraftsModern() {
  const searchTerm = (document.getElementById('drafts-search-input')?.value || '').toLowerCase();
  const activeFilter = document.querySelector('.filter-chip.active')?.dataset.filter || 'all';
  const cards = document.querySelectorAll('#drafts-grid .draft-card');
  
  cards.forEach(card => {
    const title = card.getAttribute('data-title').toLowerCase();
    const type = card.getAttribute('data-type');
    
    const matchesSearch = !searchTerm || title.includes(searchTerm);
    const matchesFilter = activeFilter === 'all' || type === activeFilter;
    
    card.style.display = matchesSearch && matchesFilter ? 'flex' : 'none';
    card.style.animation = matchesSearch && matchesFilter ? 'draftFadeIn 0.3s ease' : 'none';
  });
}

// Inline delete confirmation functions
function showDeleteConfirm(draftId, draftType) {
  // Hide any other open confirmations
  document.querySelectorAll('.draft-delete-confirm').forEach(el => {
    el.style.display = 'none';
  });
  
  // Show confirmation for this draft
  const confirmEl = document.getElementById(`delete-confirm-${draftId}`);
  if (confirmEl) {
    confirmEl.style.display = 'flex';
  }
}

function hideDeleteConfirm(draftId) {
  const confirmEl = document.getElementById(`delete-confirm-${draftId}`);
  if (confirmEl) {
    confirmEl.style.display = 'none';
  }
}

async function confirmDeleteDraft(draftId, draftType) {
  hideDeleteConfirm(draftId);
  await deleteDraft(draftId, draftType);
  // Immediately re-render drafts view to show updated list
  if (typeof renderCurrentView === 'function') {
    // Reset context to force re-render despite debounce
    lastRenderContext = '';
    renderCurrentView();
  }
}

function sortDraftsModern() {
  const sortValue = document.getElementById('drafts-sort-select')?.value || 'updated-desc';
  const grid = document.getElementById('drafts-grid');
  if (!grid) return;
  
  const cards = Array.from(grid.querySelectorAll('.draft-card'));
  
  cards.sort((a, b) => {
    const titleA = a.getAttribute('data-title').toLowerCase();
    const titleB = b.getAttribute('data-title').toLowerCase();
    const dateA = new Date(a.getAttribute('data-updated'));
    const dateB = new Date(b.getAttribute('data-updated'));
    const createdA = new Date(a.getAttribute('data-created') || a.getAttribute('data-updated'));
    const createdB = new Date(b.getAttribute('data-created') || b.getAttribute('data-updated'));
    
    switch(sortValue) {
      case 'updated-desc': return dateB - dateA;
      case 'updated-asc': return dateA - dateB;
      case 'created-desc': return createdB - createdA;
      case 'created-asc': return createdA - createdB;
      case 'title-asc': return titleA.localeCompare(titleB);
      case 'title-desc': return titleB.localeCompare(titleA);
      default: return dateB - dateA;
    }
  });
  
  cards.forEach(card => grid.appendChild(card));
}

function showNewDocDialog() {
  // This would typically show a modal or create a new document
  // For now, we'll just redirect to the docs view
  switchView('docs');
}

function showNewExcelDialog() {
  // This would typically show a modal or create a new spreadsheet
  // For now, we'll just redirect to the excel view
  switchView('excel');
}

function showNewWhiteboardDialog() {
  // This would typically show a modal or create a new whiteboard
  // For now, we'll just redirect to the whiteboard view
  switchView('whiteboard');
}

// Save Dropdown Functions
let currentOpenDropdown = null;

function toggleSaveDropdown(draftId, event) {
  event.stopPropagation();
  
  const dropdown = document.getElementById(`save-dropdown-${draftId}`);
  const button = event.currentTarget;
  
  // Close any open dropdown
  if (currentOpenDropdown && currentOpenDropdown !== dropdown) {
    currentOpenDropdown.style.display = 'none';
    const openBtn = currentOpenDropdown.previousElementSibling;
    if (openBtn) openBtn.classList.remove('active');
  }
  
  // Toggle current dropdown
  const isVisible = dropdown.style.display === 'block';
  dropdown.style.display = isVisible ? 'none' : 'block';
  button.classList.toggle('active', !isVisible);
  
  if (!isVisible) {
    currentOpenDropdown = dropdown;
    loadProjectsAndSpaces(draftId);
  } else {
    currentOpenDropdown = null;
  }
}

function loadProjectsAndSpaces(draftId) {
  // Load projects
  const projects = loadProjects();
  const projectsContainer = document.getElementById(`save-projects-${draftId}`);
  
  if (projects.length === 0) {
    projectsContainer.innerHTML = '<div class="save-dropdown-empty">No projects yet</div>';
  } else {
    projectsContainer.innerHTML = projects.map(project => `
      <div class="save-dropdown-item" onclick="moveDraftToProject('${draftId}', ${project.id})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <span>${project.name}</span>
      </div>
    `).join('');
  }
  
  // Load spaces
  const spaces = loadSpaces();
  const spacesContainer = document.getElementById(`save-spaces-${draftId}`);
  
  if (spaces.length === 0) {
    spacesContainer.innerHTML = '<div class="save-dropdown-empty">No spaces yet</div>';
  } else {
    spacesContainer.innerHTML = spaces.map(space => `
      <div class="save-dropdown-item" onclick="moveDraftToSpace('${draftId}', '${space.id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
        </svg>
        <span>${space.name}</span>
      </div>
    `).join('');
  }
}

async function moveDraftToProject(draftId, projectId) {
  try {
    const drafts = loadDrafts();
    const draft = drafts.find(d => d.id === draftId);
    
    if (!draft) {
      showToast('Draft not found', 'error');
      return;
    }
    
    // Get project data
    const projects = loadProjects();
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
      showToast('Project not found', 'error');
      return;
    }
    
    // Move the draft item to the project
    if (draft.type === 'doc') {
      // Move document
      const docs = await window.LayerDB.loadDocs();
      const doc = docs.find(d => d.id === draftId);
      if (doc) {
        await window.LayerDB.updateDoc(draftId, { projectId: projectId, isDraft: false });
      }
    } else if (draft.type === 'sheet') {
      // Move spreadsheet
      const excels = await window.LayerDB.loadExcels();
      const excel = excels.find(e => e.id === draftId);
      if (excel) {
        await window.LayerDB.updateExcel(draftId, { projectId: projectId, isDraft: false });
      }
    } else if (draft.type === 'whiteboard') {
      // Move whiteboard (project diagram)
      const whiteboardIndex = project.whiteboards?.findIndex(w => w.id === draftId);
      if (whiteboardIndex === -1 || whiteboardIndex === undefined) {
        // Add to project whiteboards
        if (!project.whiteboards) project.whiteboards = [];
        project.whiteboards.push({
          id: draftId,
          name: draft.title || 'Untitled Whiteboard',
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt
        });
        saveProjects(projects);
      }
    }
    
    // Remove from drafts
    const updatedDrafts = drafts.filter(d => d.id !== draftId);
    saveDrafts(updatedDrafts);
    
    showToast(`Moved to ${project.name}`, 'success');
    
    // Close dropdown and refresh view
    closeAllDropdowns();
    renderDraftsView();
    
  } catch (error) {
    console.error('Failed to move draft to project:', error);
    showToast('Failed to move to project', 'error');
  }
}

async function moveDraftToSpace(draftId, spaceId) {
  try {
    const drafts = loadDrafts();
    const draft = drafts.find(d => d.id === draftId);
    
    if (!draft) {
      showToast('Draft not found', 'error');
      return;
    }
    
    // Get space data
    const spaces = loadSpaces();
    const space = spaces.find(s => s.id === spaceId);
    
    if (!space) {
      showToast('Space not found', 'error');
      return;
    }
    
    // Move the draft item to the space
    if (draft.type === 'doc') {
      // Move document
      const docs = await window.LayerDB.loadDocs();
      const doc = docs.find(d => d.id === draftId);
      if (doc) {
        await window.LayerDB.updateDoc(draftId, { spaceId: spaceId, isDraft: false });
      }
    } else if (draft.type === 'sheet') {
      // Move spreadsheet
      const excels = await window.LayerDB.loadExcels();
      const excel = excels.find(e => e.id === draftId);
      if (excel) {
        await window.LayerDB.updateExcel(draftId, { spaceId: spaceId, isDraft: false });
      }
    } else if (draft.type === 'whiteboard') {
      // Move whiteboard
      const whiteboardIndex = space.whiteboards?.findIndex(w => w.id === draftId);
      if (whiteboardIndex === -1 || whiteboardIndex === undefined) {
        // Add to space whiteboards
        if (!space.whiteboards) space.whiteboards = [];
        space.whiteboards.push({
          id: draftId,
          name: draft.title || 'Untitled Whiteboard',
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt
        });
        saveSpaces(spaces);
      }
    }
    
    // Remove from drafts
    const updatedDrafts = drafts.filter(d => d.id !== draftId);
    saveDrafts(updatedDrafts);
    
    showToast(`Moved to ${space.name}`, 'success');
    
    // Close dropdown and refresh view
    closeAllDropdowns();
    renderDraftsView();
    
  } catch (error) {
    console.error('Failed to move draft to space:', error);
    showToast('Failed to move to space', 'error');
  }
}

function showCreateSpaceFromDraft(draftId, draftType) {
  // Close dropdown
  closeAllDropdowns();
  
  // Show create space modal
  showModal('Create New Space', `
    <div class="create-space-form">
      <div class="form-group">
        <label>Space Name</label>
        <input type="text" id="new-space-name" placeholder="Enter space name..." />
      </div>
      <div class="form-group">
        <label>Description (optional)</label>
        <textarea id="new-space-description" rows="3" placeholder="Enter description..."></textarea>
      </div>
      <div class="form-actions">
        <button class="draft-btn draft-btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="draft-btn draft-btn-primary" onclick="createSpaceAndMoveDraft('${draftId}', '${draftType}')">Create & Move</button>
      </div>
    </div>
  `);
}

async function createSpaceAndMoveDraft(draftId, draftType) {
  const name = document.getElementById('new-space-name').value.trim();
  const description = document.getElementById('new-space-description').value.trim();
  
  if (!name) {
    showToast('Please enter a space name', 'error');
    return;
  }
  
  try {
    // Create new space
    const newSpace = {
      id: Date.now().toString(),
      name: name,
      description: description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      whiteboards: [],
      docs: [],
      sheets: []
    };
    
    const spaces = loadSpaces();
    spaces.push(newSpace);
    saveSpaces(spaces);
    
    // Move draft to new space
    await moveDraftToSpace(draftId, newSpace.id);
    
    closeModal();
    showToast(`Created space "${name}" and moved draft`, 'success');
    
  } catch (error) {
    console.error('Failed to create space:', error);
    showToast('Failed to create space', 'error');
  }
}

function closeAllDropdowns() {
  document.querySelectorAll('.draft-save-dropdown').forEach(dropdown => {
    dropdown.style.display = 'none';
  });
  document.querySelectorAll('.draft-card-save-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  currentOpenDropdown = null;
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(event) {
  if (!event.target.closest('.draft-card-save-container')) {
    closeAllDropdowns();
  }
});

// Add event listeners after DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Add event listeners to filter buttons
  document.querySelectorAll('.filter-btn').forEach(button => {
    button.addEventListener('click', function() {
      setActiveFilter(this);
    });
  });
});

// renderTeamView() is now defined in functionality.js as a synchronous function
// This placeholder is removed to use the enhanced version from functionality.js

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

                <!-- DELETE PROJECT BUTTON - ONLY FOR PROJECT OWNERS -->
                ${window.isProjectOwner && window.isProjectOwner(projectIndex) ? `
                  <button class="project-detail-delete" onclick="handleDeleteProjectFromDetail(${projectIndex})" title="Delete project (only project creator can do this)">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                ` : ''}
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

        <!-- Team Members Section -->
        <div class="pd-team-members">
          <h3 class="section-title">Team Members</h3>
          <div class="team-members-list">
            ${renderTeamMembersList(project, projectIndex)}
          </div>
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
                        <input type="checkbox" ${task.done ? 'checked' : ''} onchange="handleToggleProjectTask(${projectIndex}, ${colIndex}, ${taskIndex}, event)">
                        <div class="checkbox-custom" style="width: 16px; height: 16px; border-radius: 3px;">
                          <svg class="check-icon" style="width: 10px; height: 10px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
                        </div>
                      </label>
                      <span class="kanban-task-title">${task.title}</span>
                      ${task.done && task.completed_by ? `
                        <div class="task-completer-avatar" data-completer-id="${task.completed_by}" title="Loading...">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;opacity:0.5;"><path d="M20 6L9 17l-5-5"/></svg>
                        </div>
                      ` : ''}
                      <button class="kanban-task-delete" onclick="handleDeleteProjectTask(${projectIndex}, ${colIndex}, ${taskIndex}, event)">
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
          <div class="property-item" id="projectLeadProperty">
            <span class="property-label">Lead</span>
            <span class="property-value" id="projectLeadValue" style="display: flex; align-items: center; gap: 8px;">
              <div class="member-avatar lead-avatar-placeholder" style="width: 24px; height: 24px; font-size: 12px; background: var(--muted); color: var(--muted-foreground); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;animation:pulse 1.5s infinite;"><circle cx="12" cy="12" r="3"/></svg>
              </div>
              <span class="lead-name-text" style="color: var(--muted-foreground);">Loading...</span>
            </span>
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

// Render team members list for project detail view
function renderTeamMembersList(project, projectIndex) {
  const teamMembers = project.teamMembers || [];
  const isOwner = window.isProjectOwner ? window.isProjectOwner(projectIndex) : false;

  let html = '';

  teamMembers.forEach((member, index) => {
    const isCurrentUser = member === (window.getCurrentUserEmail ? window.getCurrentUserEmail() : '') || member === 'You';
    const memberName = member === 'You' ? (window.getCurrentUserName ? window.getCurrentUserName() : 'You') : member;

    html += `
      <div class="team-member-item ${isCurrentUser ? 'current-user' : ''}" 
           ${isOwner && !isCurrentUser ? `oncontextmenu="window.showMemberContextMenu ? window.showMemberContextMenu(event, '${member}', ${projectIndex}, ${index}) : ''"` : ''}>
        <div class="member-avatar">${memberName.charAt(0).toUpperCase()}</div>
        <div class="member-info">
          <div class="member-name">${memberName}</div>
          ${isCurrentUser ? '<div class="member-role">You</div>' : ''}
        </div>
      </div>
    `;
  });

  if (isOwner) {
    html += `
      <button class="btn btn-secondary btn-sm" onclick="window.openInviteMemberModal ? window.openInviteMemberModal(${projectIndex}) : ''">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add Member
      </button>
    `;
  } else {
    // Show Leave Project button for non-owners who are team members
    const currentUserEmail = window.getCurrentUserEmail ? window.getCurrentUserEmail() : '';
    const isCurrentUserMember = teamMembers.includes(currentUserEmail) || teamMembers.includes('You');

    if (isCurrentUserMember) {
      html += `
        <button class="btn btn-danger btn-sm" onclick="window.leaveProject ? window.leaveProject(${projectIndex}) : ''" title="Leave this project">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16,17 21,12 16,7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Leave Project
        </button>
      `;
    }
  }

  return html;
}

// Generate vibrant color based on name
function getNameColor(name) {
  // Vibrant color palette
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
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

// ============================================
// Dashboard Widget Edit Mode
// ============================================
// Dashboard Widget Order & Edit Mode
// ============================================
let dashboardEditMode = false;

async function initDashboardWidgetOrder() {
  // Load and apply saved widget order from DB or localStorage
  const order = await loadWidgetOrder();
  if (order && order.length > 0) {
    applyWidgetOrder(order);
  }
}

// Track dashboard AI sidebar state across view switches
let dashboardAiSidebarCollapsed = false;

function toggleDashboardEditMode() {
  const btn = document.getElementById('dashboardEditToggle');
  if (!btn) return;
  
  dashboardEditMode = !dashboardEditMode;
  
  const grid = document.getElementById('dashboardWidgetsGrid');
  if (grid) {
    grid.classList.toggle('edit-mode', dashboardEditMode);
  }
  
  // Update button appearance
  btn.classList.toggle('edit-mode', dashboardEditMode);
  if (btn.querySelector('span')) {
    btn.querySelector('span').textContent = dashboardEditMode ? 'Done' : 'Edit Layout';
  }
}

function toggleDashboardAiSidebar() {
  const sidebar = document.querySelector('.dashboard-ai-sidebar');
  const btn = document.getElementById('dashboardAiSidebarToggle');
  const toggleText = btn.querySelector('.toggle-text');
  const collapseIcon = btn.querySelector('.collapse-icon');
  const expandIcon = btn.querySelector('.expand-icon');
  
  if (!sidebar) return;
  
  const isCollapsed = sidebar.classList.contains('collapsed');
  
  // Update global state
  dashboardAiSidebarCollapsed = !isCollapsed;
  
  if (isCollapsed) {
    sidebar.classList.remove('collapsed');
    btn.classList.remove('sidebar-collapsed');
    toggleText.textContent = 'Hide AI';
    collapseIcon.style.display = 'block';
    expandIcon.style.display = 'none';
  } else {
    sidebar.classList.add('collapsed');
    btn.classList.add('sidebar-collapsed');
    toggleText.textContent = 'Show AI';
    collapseIcon.style.display = 'none';
    expandIcon.style.display = 'block';
  }
}

// Restore dashboard AI sidebar state after view rendering
function restoreDashboardAiSidebarState() {
  const sidebar = document.querySelector('.dashboard-ai-sidebar');
  const btn = document.getElementById('dashboardAiSidebarToggle');
  
  if (!sidebar || !btn) return;
  
  const toggleText = btn.querySelector('.toggle-text');
  const collapseIcon = btn.querySelector('.collapse-icon');
  const expandIcon = btn.querySelector('.expand-icon');
  
  if (dashboardAiSidebarCollapsed) {
    sidebar.classList.add('collapsed');
    btn.classList.add('sidebar-collapsed');
    if (toggleText) toggleText.textContent = 'Show AI';
    if (collapseIcon) collapseIcon.style.display = 'none';
    if (expandIcon) expandIcon.style.display = 'block';
  } else {
    sidebar.classList.remove('collapsed');
    btn.classList.remove('sidebar-collapsed');
    if (toggleText) toggleText.textContent = 'Hide AI';
    if (collapseIcon) collapseIcon.style.display = 'block';
    if (expandIcon) expandIcon.style.display = 'none';
  }
}

function initWidgetDragDrop() {
  const grid = document.getElementById('dashboardWidgetsGrid');
  if (!grid) return;

  const widgets = grid.querySelectorAll('.dashboard-widget');
  let draggedWidget = null;

  widgets.forEach(widget => {
    widget.setAttribute('draggable', 'true');

    widget.addEventListener('dragstart', (e) => {
      draggedWidget = widget;
      widget.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    widget.addEventListener('dragend', () => {
      widget.classList.remove('dragging');
      draggedWidget = null;
      saveWidgetOrder();
    });

    widget.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (draggedWidget && draggedWidget !== widget) {
        const rect = widget.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;

        if (e.clientX < midX) {
          widget.parentNode.insertBefore(draggedWidget, widget);
        } else {
          widget.parentNode.insertBefore(draggedWidget, widget.nextSibling);
        }
      }
    });
  });
}

async function saveWidgetOrder() {
  const grid = document.getElementById('dashboardWidgetsGrid');
  if (!grid) return;

  const widgets = grid.querySelectorAll('.dashboard-widget');
  // Store widget IDs in their current order
  const order = Array.from(widgets).map(w => w.dataset.widgetId || w.querySelector('h3')?.textContent?.trim() || '');

  // Always save to localStorage as fallback
  localStorage.setItem('layerWidgetOrder', JSON.stringify(order));

  // Sync to DB if authenticated
  if (window.LayerDB && window.LayerDB.isAuthenticated()) {
    try {
      await window.LayerDB.saveUserPreferences({ widget_order: order });
      console.log('✓ Widget order synced to DB');
    } catch (error) {
      console.error('Failed to sync widget order to DB:', error);
    }
  }
}

async function loadWidgetOrder() {
  let order = null;

  // Try to load from DB first if authenticated
  if (window.LayerDB && window.LayerDB.isAuthenticated()) {
    try {
      const prefs = await window.LayerDB.getUserPreferences();
      if (prefs && prefs.widget_order && Array.isArray(prefs.widget_order) && prefs.widget_order.length > 0) {
        order = prefs.widget_order;
        // Cache to localStorage
        localStorage.setItem('layerWidgetOrder', JSON.stringify(order));
      }
    } catch (error) {
      console.error('Failed to load widget order from DB:', error);
    }
  }

  // Fall back to localStorage
  if (!order) {
    try {
      const stored = localStorage.getItem('layerWidgetOrder');
      if (stored) {
        order = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse widget order from localStorage:', e);
    }
  }

  return order;
}

function applyWidgetOrder(order) {
  if (!order || !Array.isArray(order) || order.length === 0) return;

  const grid = document.getElementById('dashboardWidgetsGrid');
  if (!grid) return;

  const widgets = Array.from(grid.querySelectorAll('.dashboard-widget'));
  if (widgets.length === 0) return;

  // Create a map of widget ID to element
  const widgetMap = new Map();
  widgets.forEach(w => {
    const id = w.dataset.widgetId || w.querySelector('h3')?.textContent?.trim() || '';
    if (id) widgetMap.set(id, w);
  });

  // Reorder based on saved order
  order.forEach(id => {
    const widget = widgetMap.get(id);
    if (widget) {
      grid.appendChild(widget);
    }
  });
}

// ============================================
// Whiteboard Document Sidebar
// ============================================
let whiteboardDocSidebarOpen = false;
let whiteboardSplitViewDocId = null;
let whiteboardSplitViewType = null; // 'doc' or 'excel'

function toggleWhiteboardDocSidebar() {
  whiteboardDocSidebarOpen = !whiteboardDocSidebarOpen;

  const sidebar = document.getElementById('whiteboardDocSidebar');
  const toggleBtn = document.getElementById('whiteboardDocToggleBtn');
  const splitContainer = document.getElementById('whiteboardSplitContainer');

  if (sidebar) {
    sidebar.classList.toggle('open', whiteboardDocSidebarOpen && !whiteboardSplitViewDocId);
    // Remove split-view class when closing
    if (!whiteboardDocSidebarOpen) {
      sidebar.classList.remove('split-view');
      if (splitContainer) {
        splitContainer.classList.remove('split-mode');
      }
      whiteboardSplitViewDocId = null;
      whiteboardSplitViewType = null;
      updateSplitViewPanel();
    }
  }

  if (toggleBtn) {
    toggleBtn.classList.toggle('active', whiteboardDocSidebarOpen);
  }

  if (whiteboardDocSidebarOpen) {
    updateWhiteboardDocSidebar();
  }
}

function updateWhiteboardDocSidebar() {
  const container = document.getElementById('whiteboardDocContent');
  if (!container) return;

  const projects = loadProjects();
  const project = projects[gripProjectIndex];

  if (!project) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--muted-foreground);">No project loaded</div>';
    return;
  }

  // Get ALL docs and excels from the system
  const allDocs = loadDocs();
  const allExcels = loadExcels();

  // Get linked space docs/excels if a space is linked
  const linkedSpace = project.linkedSpaceId ? loadSpaces().find(s => s.id === project.linkedSpaceId) : null;
  const spaceDocs = linkedSpace ? allDocs.filter(d => d.spaceId === linkedSpace.id) : [];
  const spaceExcels = linkedSpace ? allExcels.filter(e => e.spaceId === linkedSpace.id) : [];

  // Also get docs that might be directly linked to this project
  const projectDocs = allDocs.filter(d => d.projectId === project.id);
  const projectExcels = allExcels.filter(e => e.projectId === project.id);

  // Combine and deduplicate
  const docsMap = new Map();
  [...spaceDocs, ...projectDocs].forEach(d => docsMap.set(d.id, d));
  const docs = Array.from(docsMap.values());

  const excelsMap = new Map();
  [...spaceExcels, ...projectExcels].forEach(e => excelsMap.set(e.id, e));
  const excels = Array.from(excelsMap.values());

  // If no linked space and no docs, show all available docs
  const showAllDocs = !linkedSpace && docs.length === 0 && excels.length === 0;
  const displayDocs = showAllDocs ? allDocs.slice(0, 10) : docs;
  const displayExcels = showAllDocs ? allExcels.slice(0, 10) : excels;

  if (displayDocs.length === 0 && displayExcels.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 48px; height: 48px; color: #71717a; margin-bottom: 12px;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <p style="color: #71717a; font-size: 13px; margin: 0 0 12px 0;">
          No documents found
        </p>
        <button onclick="openDocEditor()" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 13px; cursor: pointer;">
          Create a Document
        </button>
      </div>
    `;
    return;
  }

  // Check if we're in split view mode
  const isSplitView = whiteboardSplitViewDocId !== null;
  const listClass = isSplitView ? 'whiteboard-doc-list compact' : 'whiteboard-doc-list';

  container.innerHTML = `
    ${showAllDocs ? '<div style="padding: 8px 12px; font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Recent Documents</div>' : ''}
    <div class="${listClass}">
      ${displayDocs.map(doc => `
        <div class="whiteboard-doc-item ${whiteboardSplitViewDocId === doc.id && whiteboardSplitViewType === 'doc' ? 'active' : ''}" 
             onclick="openDocInSplitView('${doc.id}')" 
             title="Click to view in split screen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="whiteboard-doc-icon doc">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span class="whiteboard-doc-title">${doc.title || 'Untitled'}</span>
          <span class="whiteboard-doc-date">${formatTimeAgo(doc.updatedAt || doc.createdAt)}</span>
        </div>
      `).join('')}
      ${displayExcels.map(excel => `
        <div class="whiteboard-doc-item ${whiteboardSplitViewDocId === excel.id && whiteboardSplitViewType === 'excel' ? 'active' : ''}" 
             onclick="openExcelInSplitView('${excel.id}')"
             title="Click to view in split screen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="whiteboard-doc-icon excel">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
          <span class="whiteboard-doc-title">${excel.title || 'Untitled'}</span>
          <span class="whiteboard-doc-date">${formatTimeAgo(excel.updatedAt || excel.createdAt)}</span>
        </div>
      `).join('')}
    </div>
    ${isSplitView ? renderSplitViewPreview() : ''}
  `;
}

function renderSplitViewPreview() {
  if (!whiteboardSplitViewDocId) return '';

  let doc = null;
  let docType = whiteboardSplitViewType;

  if (docType === 'doc') {
    const docs = loadDocs();
    doc = docs.find(d => d.id === whiteboardSplitViewDocId);
  } else if (docType === 'excel') {
    const excels = loadExcels();
    doc = excels.find(e => e.id === whiteboardSplitViewDocId);
  }

  if (!doc) return '';

  return `
    <div class="whiteboard-doc-preview">
      <div class="whiteboard-doc-preview-header">
        <span class="whiteboard-doc-preview-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:${docType === 'excel' ? '#22c55e' : '#3b82f6'};">
            ${docType === 'excel' ?
      '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/>' :
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'
    }
          </svg>
          ${doc.title || 'Untitled'}
        </span>
        <div class="whiteboard-doc-preview-actions">
          <button class="whiteboard-doc-preview-btn" onclick="${docType === 'excel' ? 'openExcelFromWhiteboard' : 'openDocFromWhiteboard'}('${doc.id}')">
            Open Full
          </button>
          <button class="whiteboard-doc-preview-btn" onclick="closeSplitView()">
            Close
          </button>
        </div>
      </div>
      <div class="whiteboard-doc-preview-content">
        ${docType === 'doc' ?
      `<div style="background:#fff;color:#000;padding:20px;border-radius:4px;height:100%;overflow:auto;font-family:serif;line-height:1.8;">${doc.content || '<p style="color:#999;">Empty document</p>'}</div>` :
      renderExcelPreviewGrid(doc)
    }
      </div>
    </div>
  `;
}

function renderExcelPreviewGrid(excel) {
  if (!excel || !excel.data) {
    return '<div style="padding:20px;color:#999;text-align:center;">No data</div>';
  }

  const rows = excel.data.slice(0, 20); // Limit preview rows
  if (rows.length === 0) return '<div style="padding:20px;color:#999;text-align:center;">Empty spreadsheet</div>';

  let html = '<table style="width:100%;border-collapse:collapse;background:#fff;color:#000;font-size:12px;">';
  rows.forEach((row, i) => {
    html += '<tr>';
    (row || []).slice(0, 10).forEach(cell => { // Limit columns
      const tag = i === 0 ? 'th' : 'td';
      html += `<${tag} style="border:1px solid #e0e0e0;padding:6px 8px;text-align:left;${i === 0 ? 'background:#f5f5f5;font-weight:600;' : ''}">${cell || ''}</${tag}>`;
    });
    html += '</tr>';
  });
  html += '</table>';
  return html;
}

function openDocInSplitView(docId) {
  const sidebar = document.getElementById('whiteboardDocSidebar');
  const splitContainer = document.getElementById('whiteboardSplitContainer');

  if (sidebar) {
    sidebar.classList.remove('open');
  }
  if (splitContainer) {
    splitContainer.classList.add('split-mode');
  }

  whiteboardSplitViewDocId = docId;
  whiteboardSplitViewType = 'doc';
  updateSplitViewPanel();
}

function openExcelInSplitView(excelId) {
  const sidebar = document.getElementById('whiteboardDocSidebar');
  const splitContainer = document.getElementById('whiteboardSplitContainer');

  if (sidebar) {
    sidebar.classList.remove('open');
  }
  if (splitContainer) {
    splitContainer.classList.add('split-mode');
  }

  whiteboardSplitViewDocId = excelId;
  whiteboardSplitViewType = 'excel';
  updateSplitViewPanel();
}

function closeSplitView() {
  const sidebar = document.getElementById('whiteboardDocSidebar');
  const splitContainer = document.getElementById('whiteboardSplitContainer');

  if (splitContainer) {
    splitContainer.classList.remove('split-mode');
  }

  whiteboardSplitViewDocId = null;
  whiteboardSplitViewType = null;
  whiteboardDocSidebarOpen = false;
  updateSplitViewPanel();

  // Update toggle button state
  const toggleBtn = document.getElementById('whiteboardDocToggleBtn');
  if (toggleBtn) {
    toggleBtn.classList.remove('active');
  }
}

function updateSplitViewPanel() {
  const panel = document.getElementById('whiteboardDocPanel');
  if (!panel) return;

  if (!whiteboardSplitViewDocId) {
    panel.innerHTML = '';
    panel.classList.add('hidden');
    return;
  }

  panel.classList.remove('hidden');

  let doc = null;
  let docType = whiteboardSplitViewType;

  if (docType === 'doc') {
    const docs = loadDocs();
    doc = docs.find(d => d.id === whiteboardSplitViewDocId);
  } else if (docType === 'excel') {
    const excels = loadExcels();
    doc = excels.find(e => e.id === whiteboardSplitViewDocId);
  }

  if (!doc) {
    panel.innerHTML = `
      <div class="whiteboard-doc-content-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <p>Document not found</p>
      </div>
    `;
    return;
  }

  // Get all docs and excels for the document list
  const allDocs = loadDocs();
  const allExcels = loadExcels();
  const projects = loadProjects();
  const project = projects[gripProjectIndex];

  // Filter relevant docs
  const linkedSpace = project?.linkedSpaceId ? loadSpaces().find(s => s.id === project.linkedSpaceId) : null;
  const spaceDocs = linkedSpace ? allDocs.filter(d => d.spaceId === linkedSpace.id) : [];
  const spaceExcels = linkedSpace ? allExcels.filter(e => e.spaceId === linkedSpace.id) : [];
  const projectDocs = project ? allDocs.filter(d => d.projectId === project.id) : [];
  const projectExcels = project ? allExcels.filter(e => e.projectId === project.id) : [];

  const docsMap = new Map();
  [...spaceDocs, ...projectDocs, ...allDocs.slice(0, 10)].forEach(d => docsMap.set(d.id, d));
  const displayDocs = Array.from(docsMap.values()).slice(0, 15);

  const excelsMap = new Map();
  [...spaceExcels, ...projectExcels, ...allExcels.slice(0, 10)].forEach(e => excelsMap.set(e.id, e));
  const displayExcels = Array.from(excelsMap.values()).slice(0, 15);

  panel.innerHTML = `
    <div class="whiteboard-doc-panel-header">
      <div class="whiteboard-doc-panel-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${docType === 'excel' ?
      '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/>' :
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'
    }
        </svg>
        ${doc.title || 'Untitled'}
      </div>
      <div class="whiteboard-doc-panel-actions">
        <button class="whiteboard-doc-panel-btn" onclick="${docType === 'excel' ? 'openExcelFromWhiteboard' : 'openDocFromWhiteboard'}('${doc.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Open Full
        </button>
        <button class="whiteboard-doc-panel-btn close-btn" onclick="closeSplitView()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
    
    <!-- Document List (compact) -->
    <div class="whiteboard-doc-list-compact">
      ${displayDocs.map(d => `
        <div class="whiteboard-doc-list-item ${whiteboardSplitViewDocId === d.id && whiteboardSplitViewType === 'doc' ? 'active' : ''}" 
             onclick="openDocInSplitView('${d.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#3b82f6;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span>${d.title || 'Untitled'}</span>
        </div>
      `).join('')}
      ${displayExcels.map(e => `
        <div class="whiteboard-doc-list-item ${whiteboardSplitViewDocId === e.id && whiteboardSplitViewType === 'excel' ? 'active' : ''}" 
             onclick="openExcelInSplitView('${e.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#22c55e;">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
          <span>${e.title || 'Untitled'}</span>
        </div>
      `).join('')}
    </div>
    
    <!-- Document Content -->
    <div class="whiteboard-doc-content-area">
      ${docType === 'doc' ?
      `<div class="whiteboard-doc-rendered">${doc.content || '<p style="color:#999;">Empty document</p>'}</div>` :
      renderExcelPreviewGrid(doc)
    }
    </div>
  `;
}

function openDocFromWhiteboard(docId) {
  // Close whiteboard temporarily and open doc
  const overlay = document.getElementById('gripDiagramOverlay');
  if (overlay) overlay.style.display = 'none';

  openDocEditor(docId);

  // Re-show whiteboard when doc is closed
  const checkDocClosed = setInterval(() => {
    if (!document.getElementById('docEditorOverlay')) {
      clearInterval(checkDocClosed);
      if (overlay) overlay.style.display = '';
      if (typeof openSpaceView === 'function' && currentSpaceId) openSpaceView(currentSpaceId);
    }
  }, 500);
}

function openExcelFromWhiteboard(excelId) {
  const overlay = document.getElementById('gripDiagramOverlay');
  if (overlay) overlay.style.display = 'none';

  openExcelEditor(excelId);

  const checkExcelClosed = setInterval(() => {
    if (!document.getElementById('excelEditorOverlay')) {
      clearInterval(checkExcelClosed);
      if (overlay) overlay.style.display = '';
    }
  }, 500);
}

// Test function to verify profile creation (for debugging)
window.testProfileCreation = async function () {
  console.log('Testing profile creation...');
  try {
    const user = window.LayerDB.getCurrentUser();
    if (!user) {
      console.log('No user logged in');
      return;
    }

    console.log('Current user:', user.email);

    // Test profile creation
    const profile = await window.LayerDB.ensureUserProfile();
    console.log('Profile ensured:', profile);

    // Verify it exists
    const { data: verifyProfile } = await window.LayerDB.supabase
      .from('profiles')
      .select('*')
      .eq('email', user.email)
      .maybeSingle();

    console.log('Verified profile:', verifyProfile);

    if (verifyProfile) {
      console.log('✅ Profile creation test PASSED');
    } else {
      console.log('❌ Profile creation test FAILED');
    }
  } catch (error) {
    console.error('Profile creation test failed:', error);
  }
};

// Test function to verify team member addition
window.testTeamMemberAddition = async function (testEmail = 'test@example.com') {
  console.log('Testing team member addition...');
  try {
    // First ensure we're logged in
    const user = window.LayerDB.getCurrentUser();
    if (!user) {
      console.log('Please log in first');
      return;
    }

    // Create a test project if none exists
    const projects = loadProjects();
    let testProject = projects.find(p => p.name.includes('Test'));

    if (!testProject) {
      // Create a test project
      testProject = {
        name: 'Test Project for Team Addition',
        description: 'Temporary project for testing team member addition',
        status: 'todo',
        startDate: new Date().toISOString().split('T')[0],
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        teamMembers: ['You'],
        columns: [
          { title: 'To Do', tasks: [] },
          { title: 'In Progress', tasks: [] },
          { title: 'Done', tasks: [] }
        ]
      };

      projects.push(testProject);
      saveProjects(projects);
      console.log('Created test project');
    }

    const projectIndex = projects.indexOf(testProject);
    console.log('Using project:', testProject.name);

    // Test adding team member
    console.log('Adding team member:', testEmail);
    await window.LayerDB.addTeamMemberToProject(testProject.id, testEmail);

    console.log('✅ Team member addition test PASSED');
    console.log('Team member added successfully to project');

  } catch (error) {
    console.error('Team member addition test failed:', error);
  }
};

// Test function to verify avatar functionality
window.testAvatarDisplay = async function () {
  console.log('Testing avatar display...');
  try {
    const user = window.LayerDB.getCurrentUser();
    if (!user) {
      console.log('No user logged in');
      return;
    }

    console.log('Current user:', user.email);
    console.log('User metadata:', user.user_metadata);

    // Test profile fetching
    const profile = await window.LayerDB.getProfile();
    console.log('User profile:', profile);

    if (profile && profile.avatar_url) {
      console.log('✅ Avatar URL found:', profile.avatar_url);
      // Force refresh the user display
      const displayName = profile.name || user.user_metadata?.name || user.email?.split('@')[0] || 'User';
      await updateUserDisplay({ username: displayName, email: user.email });
      console.log('✅ Avatar should now be displayed');
    } else {
      console.log('❌ No avatar URL found in profile');
      console.log('Profile data:', profile);
    }
  } catch (error) {
    console.error('Avatar test failed:', error);
  }
};

// Utility to fix all missing profiles (run once)
window.fixAllMissingProfiles = async function () {
  console.log('Running profile fix utility...');
  await window.LayerDB.fixMissingProfiles();
};

/* ============================================
   Advanced Focus State Management System
   Seamless window focus/blur handling
   ============================================ */

const FocusStateManager = {
  // State storage
  savedState: null,
  focusLostTime: null,
  isRestoring: false,
  welcomeBackShown: false,

  // Save current application state
  saveAppState() {
    try {
      this.savedState = {
        // Current view and navigation
        currentView: window.currentView || 'dashboard',
        currentProjectIndex: window.currentProjectIndex || null,
        currentDocId: window.currentDocId || null,
        currentExcelId: window.currentExcelId || null,

        // Scroll positions
        scrollX: window.pageXOffset || document.documentElement.scrollLeft,
        scrollY: window.pageYOffset || document.documentElement.scrollTop,

        // Active elements and focus
        activeElement: document.activeElement ? {
          tagName: document.activeElement.tagName,
          id: document.activeElement.id,
          className: document.activeElement.className,
          selectionStart: document.activeElement.selectionStart,
          selectionEnd: document.activeElement.selectionEnd
        } : null,

        // Modal state
        openModal: document.querySelector('.modal.active') ? {
          title: document.querySelector('.modal-title')?.textContent,
          content: document.querySelector('.modal-body')?.innerHTML
        } : null,

        // Sidebar state
        sidebarCollapsed: document.body.classList.contains('sidebar-collapsed'),

        // Form inputs and text areas
        textInputs: Array.from(document.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]')).map(el => ({
          id: el.id,
          value: el.value || el.innerText,
          selectionStart: el.selectionStart,
          selectionEnd: el.selectionEnd
        })),

        // Timestamp
        savedAt: Date.now()
      };

      console.log('🔄 Focus state saved:', this.savedState);
    } catch (error) {
      console.error('Failed to save app state:', error);
    }
  },

  // Restore saved application state
  async restoreAppState() {
    if (!this.savedState || this.isRestoring) return;

    this.isRestoring = true;

    try {
      console.log('🔄 Restoring focus state:', this.savedState);

      // Restore view
      if (this.savedState.currentView && window.currentView !== this.savedState.currentView) {
        window.currentView = this.savedState.currentView;
        if (typeof window.renderCurrentView === 'function') {
          await window.renderCurrentView();
        }
      }

      // Wait a bit for DOM to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Restore scroll position
      if (this.savedState.scrollX !== undefined || this.savedState.scrollY !== undefined) {
        window.scrollTo(this.savedState.scrollX, this.savedState.scrollY);
      }

      // Restore text inputs and contenteditable elements
      this.savedState.textInputs.forEach(input => {
        const element = document.getElementById(input.id) ||
          document.querySelector(`[contenteditable="true"][id="${input.id}"]`) ||
          document.querySelector(`[contenteditable="true"]:contains("${input.value.substring(0, 20)}")`);

        if (element) {
          if (element.value !== undefined) {
            element.value = input.value;
          } else {
            element.innerText = input.value;
          }

          // Restore cursor position
          if (input.selectionStart !== undefined) {
            element.setSelectionRange(input.selectionStart, input.selectionEnd);
          }
        }
      });

      // Restore active element focus
      if (this.savedState.activeElement) {
        const element = document.getElementById(this.savedState.activeElement.id) ||
          document.querySelector(this.savedState.activeElement.tagName +
            (this.savedState.activeElement.id ? `#${this.savedState.activeElement.id}` : '') +
            (this.savedState.activeElement.className ? `.${this.savedState.activeElement.className.split(' ').join('.')}` : ''));

        if (element) {
          element.focus();
          if (this.savedState.activeElement.selectionStart !== undefined) {
            element.setSelectionRange(
              this.savedState.activeElement.selectionStart,
              this.savedState.activeElement.selectionEnd
            );
          }
        }
      }

      // Restore sidebar state
      if (this.savedState.sidebarCollapsed) {
        document.body.classList.add('sidebar-collapsed');
      } else {
        document.body.classList.remove('sidebar-collapsed');
      }

      console.log('✅ Focus state restored successfully');

    } catch (error) {
      console.error('Failed to restore app state:', error);
    } finally {
      this.isRestoring = false;
    }
  },

  // Show subtle welcome back notification
  showSubtleWelcomeBack() {
    return; // Disabled - user doesn't want to see welcome back message
    
    if (this.welcomeBackShown) return; // Don't show multiple times

    this.welcomeBackShown = true;

    // Create subtle notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
      z-index: 10000;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s ease;
      pointer-events: none;
    `;

    const user = window.LayerDB?.getCurrentUser();
    const username = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
    notification.innerHTML = `Welcome back, ${username}`;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateY(0)';
    }, 100);

    // Animate out and remove
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);

    // Reset flag after a delay
    setTimeout(() => {
      this.welcomeBackShown = false;
    }, 5000);
  },

  // Initialize focus management
  initialize() {
    console.log('🎯 Initializing advanced focus management...');

    // Save state when window loses focus
    window.addEventListener('blur', () => {
      console.log('🔄 Window losing focus - saving state...');
      this.focusLostTime = Date.now();
      this.saveAppState();
    });

    // Restore state when window gains focus
    window.addEventListener('focus', async () => {
      console.log('🔄 Window gaining focus - restoring state...');

      // Only restore if it's been more than 1 second since focus lost
      if (this.focusLostTime && (Date.now() - this.focusLostTime) > 1000) {
        await this.restoreAppState();
        this.showSubtleWelcomeBack();
      }

      this.focusLostTime = null;
    });

    // Also handle page visibility changes
    document.addEventListener('visibilitychange', async () => {
      if (document.hidden) {
        console.log('🔄 Page becoming hidden - saving state...');
        this.saveAppState();
      } else {
        // Only restore if it's been more than 1 second since page hidden
        if (this.pageHiddenTime && (Date.now() - this.pageHiddenTime) > 1000) {
          await this.restoreAppState();
          this.showSubtleWelcomeBack();
        }
        this.pageHiddenTime = null;
      }
    });

    console.log('✅ Advanced focus management initialized');
  }
};

// Initialize the focus management system
document.addEventListener('DOMContentLoaded', () => {
  FocusStateManager.initialize();
});

// Make it globally available
window.FocusStateManager = FocusStateManager;

// Profile Editing Functions
window.toggleEditMode = function() {
  const viewMode = document.getElementById('profileViewMode');
  const editMode = document.getElementById('profileEditMode');
  const usernameInput = document.getElementById('usernameInput');
  const displayName = document.getElementById('displayName');
  const profileCard = document.getElementById('profileCard');
  
  if (viewMode && editMode) {
    // Add smooth transition
    viewMode.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    editMode.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    
    // Fade out view mode
    viewMode.style.opacity = '0';
    viewMode.style.transform = 'scale(0.98)';
    
    setTimeout(() => {
      viewMode.style.display = 'none';
      editMode.style.display = 'block';
      
      // Fade in edit mode
      setTimeout(() => {
        editMode.style.opacity = '1';
        editMode.style.transform = 'scale(1)';
      }, 50);
      
      if (usernameInput && displayName) {
        usernameInput.value = displayName.textContent.trim();
        usernameInput.focus();
        usernameInput.select();
        
        // Add focus animation
        profileCard.style.transform = 'scale(1.02)';
        setTimeout(() => {
          profileCard.style.transform = 'scale(1)';
        }, 200);
      }
      
      // Reset validation
      handleUsernameInput(usernameInput.value);
    }, 200);
  }
};

window.handleUsernameInput = function(value) {
  const validationIcon = document.getElementById('validationIcon');
  const validationMessage = document.getElementById('validationMessage');
  const charCounter = document.getElementById('charCounter');
  const saveBtn = document.getElementById('saveUsernameBtn');
  
  if (!validationIcon || !validationMessage || !charCounter || !saveBtn) return;
  
  // Update character counter with color coding
  charCounter.textContent = `${value.length}/30`;
  charCounter.className = 'char-counter';
  if (value.length > 25) {
    charCounter.className = 'char-counter warning';
  }
  if (value.length >= 30) {
    charCounter.className = 'char-counter error';
  }
  
  // Validation rules
  const isValid = value.length >= 2 && value.length <= 30 && /^[a-zA-Z0-9\s._-]+$/.test(value);
  const isChanged = value !== document.getElementById('displayName').textContent.trim();
  
  if (value.length === 0) {
    validationIcon.className = 'validation-icon';
    validationMessage.textContent = '';
    saveBtn.disabled = true;
  } else if (value.length < 2) {
    validationIcon.className = 'validation-icon invalid';
    validationMessage.textContent = 'Username must be at least 2 characters';
    saveBtn.disabled = true;
  } else if (value.length > 30) {
    validationIcon.className = 'validation-icon invalid';
    validationMessage.textContent = 'Username must be 30 characters or less';
    saveBtn.disabled = true;
  } else if (!/^[a-zA-Z0-9\s._-]+$/.test(value)) {
    validationIcon.className = 'validation-icon invalid';
    validationMessage.textContent = 'Only letters, numbers, spaces, dots, hyphens, and underscores allowed';
    saveBtn.disabled = true;
  } else if (!isChanged) {
    validationIcon.className = 'validation-icon';
    validationMessage.textContent = 'No changes made';
    saveBtn.disabled = true;
  } else {
    validationIcon.className = 'validation-icon valid';
    validationMessage.textContent = 'Username available';
    saveBtn.disabled = false;
    
    // Add success animation
    validationIcon.style.transform = 'scale(1.2)';
    setTimeout(() => {
      validationIcon.style.transform = 'scale(1)';
    }, 200);
  }
};

window.saveUsernameChanges = async function() {
  const usernameInput = document.getElementById('usernameInput');
  const displayName = document.getElementById('displayName');
  const saveBtn = document.getElementById('saveUsernameBtn');
  const spinner = saveBtn.querySelector('.btn-spinner');
  const btnText = saveBtn.querySelector('.btn-text');
  
  if (!usernameInput || !displayName || !saveBtn) return;
  
  const newName = usernameInput.value.trim();
  
  if (newName.length < 2 || newName.length > 30) {
    return;
  }
  
  // Show loading state with animation
  saveBtn.disabled = true;
  spinner.style.display = 'block';
  btnText.textContent = 'Saving...';
  saveBtn.style.transform = 'scale(0.95)';
  
  try {
    // Save to Supabase database using LayerDB
    if (window.LayerDB && window.LayerDB.updateProfile) {
      console.log('Saving to Supabase database:', newName);
      await window.LayerDB.updateProfile({ name: newName });
      
      // Refresh user data from database to ensure we have the latest
      if (window.LayerDB && window.LayerDB.refreshUser) {
        await window.LayerDB.refreshUser();
      }
      
      // Update current user metadata with fresh data
      const refreshedUser = window.LayerDB?.getCurrentUser();
      if (refreshedUser) {
        window.currentUser = refreshedUser;
        console.log('User data refreshed from database:', refreshedUser);
        
        // Update sidebar user display immediately
        await updateUserDisplay(refreshedUser);
      }
    }
    
    // Update localStorage as backup (but database is primary)
    localStorage.setItem('userDisplayName', newName);
    
    // Update all user-info elements in the UI
    updateUserInterfaceElements(newName);
    
    // Update display name with animation
    const profileCard = document.getElementById('profileCard');
    profileCard.style.transform = 'scale(0.98)';
    
    setTimeout(() => {
      displayName.textContent = newName;
      
      // Show success feedback
      showNotification('Profile updated successfully in database!', 'success');
      
      // Switch back to view mode
      cancelUsernameEdit();
      
      // Refresh the entire settings view to show updated name
      setTimeout(async () => {
        if (typeof renderSettingsView === 'function') {
          await renderSettingsView();
        }
      }, 100);
      
      // Reset card scale
      setTimeout(() => {
        profileCard.style.transform = 'scale(1)';
      }, 100);
    }, 150);
    
  } catch (error) {
    console.error('Error updating profile in Supabase:', error);
    showNotification('Failed to update profile in database. Please try again.', 'error');
    
    // Add error shake animation
    saveBtn.style.animation = 'shake 0.5s ease-in-out';
    setTimeout(() => {
      saveBtn.style.animation = '';
    }, 500);
  } finally {
    // Reset button state
    spinner.style.display = 'none';
    btnText.textContent = 'Save Changes';
    saveBtn.style.transform = 'scale(1)';
  }
};

// Function to ensure profile is loaded from database on app start
window.ensureProfileLoaded = async function() {
  if (window.LayerDB && window.LayerDB.isAuthenticated()) {
    try {
      console.log('Loading user profile from Supabase database...');
      
      // Get fresh profile from database
      const profile = await window.LayerDB.getProfile();
      if (profile && profile.name) {
        console.log('Profile loaded from database:', profile.name);
        
        // Update current user object with fresh data
        const currentUser = window.LayerDB.getCurrentUser();
        if (currentUser) {
          currentUser.user_metadata = currentUser.user_metadata || {};
          currentUser.user_metadata.name = profile.name;
          window.currentUser = currentUser;
          
          // Update sidebar user display
          await updateUserDisplay(currentUser);
        }
        
        // Update localStorage with database value (for backup)
        localStorage.setItem('userDisplayName', profile.name);
        
        // Update UI elements
        if (window.updateUserInterfaceElements) {
          window.updateUserInterfaceElements(profile.name);
        }
        
        return profile.name;
      }
    } catch (error) {
      console.error('Error loading profile from database:', error);
    }
  }
  return null;
};

// Auto-load profile when app starts
document.addEventListener('DOMContentLoaded', function() {
  // Wait a bit for LayerDB to initialize
  setTimeout(async function() {
    await ensureProfileLoaded();
  }, 1000);
});

// Function to update all user-info elements throughout the UI
window.updateUserInterfaceElements = function(newName) {
  // Update sidebar user-info elements
  const sidebarUserNames = document.querySelectorAll('.user-name');
  sidebarUserNames.forEach(element => {
    if (element && element.textContent !== newName) {
      element.textContent = newName;
    }
  });
  
  // Update settings display name
  const settingsDisplayName = document.getElementById('displayName');
  if (settingsDisplayName && settingsDisplayName.textContent !== newName) {
    settingsDisplayName.textContent = newName;
  }
  
  // Update any other elements that might show user name
  const userNameElements = document.querySelectorAll('[data-user-name], .current-user-name, .context-menu-user-name');
  userNameElements.forEach(element => {
    if (element && element.textContent !== newName) {
      element.textContent = newName;
    }
  });
  
  // Update avatar title attributes
  const avatarElements = document.querySelectorAll('.user-avatar, .avatar');
  avatarElements.forEach(element => {
    if (element && element.title !== newName) {
      element.title = newName;
    }
  });
  
  // Dispatch custom event for other components to listen to
  window.dispatchEvent(new CustomEvent('userNameChanged', {
    detail: { newName: newName }
  }));
  
  console.log('Updated all user interface elements with new name:', newName);
};

window.cancelUsernameEdit = function() {
  const viewMode = document.getElementById('profileViewMode');
  const editMode = document.getElementById('profileEditMode');
  const profileCard = document.getElementById('profileCard');
  
  if (viewMode && editMode) {
    // Add transition
    editMode.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    viewMode.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    
    // Fade out edit mode
    editMode.style.opacity = '0';
    editMode.style.transform = 'scale(0.98)';
    
    setTimeout(() => {
      editMode.style.display = 'none';
      viewMode.style.display = 'block';
      
      // Fade in view mode
      setTimeout(() => {
        viewMode.style.opacity = '1';
        viewMode.style.transform = 'scale(1)';
      }, 50);
      
      // Reset card scale
      profileCard.style.transform = 'scale(1)';
    }, 200);
  }
};

// Add shake animation for errors
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
`;
document.head.appendChild(style);

// Helper function to show notifications (if not already exists)
window.showNotification = function(message, type = 'info') {
  // Create notification element if it doesn't exist
  let notification = document.querySelector('.notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;
    document.body.appendChild(notification);
  }
  
  // Set message and style based on type
  notification.textContent = message;
  notification.className = `notification ${type}`;
  
  switch (type) {
    case 'success':
      notification.style.background = '#10b981';
      break;
    case 'error':
      notification.style.background = '#ef4444';
      break;
    default:
      notification.style.background = '#3b82f6';
  }
  
  // Show notification
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 100);
  
  // Hide after 3 seconds
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
};
