/* ============================================
   Layer - Advanced Infinite Whiteboard Engine
   ============================================ */

/**
 * Core State Management
 */
const GripState = {
  // Canvas State
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  isDraggingCanvas: false,
  lastMouseX: 0,
  lastMouseY: 0,

  // Interaction State
  activeTool: 'select', // select, hand, rectangle, diamond, ellipse, text, sticky, image, connect, eraser
  isDraggingNodes: false,
  isSelecting: false,
  selectionStart: { x: 0, y: 0 },

  // Eraser State
  eraserSize: 20,
  isErasing: false,
  eraserPreview: null,
  hoveredElements: new Set(),
  selectionEnd: { x: 0, y: 0 },
  dragStart: { x: 0, y: 0 }, // World coordinates

  // Selection
  selectedNodeIds: new Set(),

  // Connection State
  isConnecting: false,
  connectionStartNodeId: null,
  connectionStartHandle: null, // top, right, bottom, left
  tempConnectionEnd: { x: 0, y: 0 }, // For drawing the live line

  // Resize State
  isResizing: false,
  resizeNodeId: null,
  resizeHandle: null, // nw, n, ne, e, se, s, sw, w
  initialResizeBounds: null, // {x, y, w, h}

  // Data
  nodes: [], // { id, type, x, y, width, height, text, style: {}, ... }
  edges: [], // { id, from, fromHandle, to, toHandle, style: {} }

  // History
  history: [],
  historyIndex: -1,

  // Project Context
  projectIndex: null,
  projectName: '',
  teamMembers: [], // { name, avatarUrl, email }

  // Realtime Collaboration
  activeUsers: new Map(), // userId -> { name, avatar, cursor, selection, lastSeen }
  currentProjectId: null,
  realtimeSubscription: null,
  lastCursorBroadcast: 0,
  cursorThrottleDelay: 100, // ms

  // Config
  GRID_SIZE: 20,
  SNAP_TO_GRID: true,
  MIN_SCALE: 0.1,
  MAX_SCALE: 5
};

// ============================================
// Core Math & Helpers
// ============================================

function screenToWorld(x, y) {
  return {
    x: (x - GripState.offsetX) / GripState.scale,
    y: (y - GripState.offsetY) / GripState.scale
  };
}

function worldToScreen(x, y) {
  return {
    x: x * GripState.scale + GripState.offsetX,
    y: y * GripState.scale + GripState.offsetY
  };
}

function snapToGrid(val) {
  if (!GripState.SNAP_TO_GRID) return val;
  return Math.round(val / GripState.GRID_SIZE) * GripState.GRID_SIZE;
}

function generateUUID() {
  return 'node-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

function generateEdgeId() {
  return 'edge-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

// ============================================
// Initialization & Lifecycle
// ============================================

async function openGripDiagram(projectIndex) {
  GripState.projectIndex = projectIndex;

  // Load project details
  const projects = loadProjects();
  const project = projects[projectIndex];
  if (project) {
    GripState.projectName = project.name || 'Untitled Project';
    GripState.teamMembers = []; // Reset

    // Initial team members from local project data (names only usually)
    if (project.teamMembers) {
      const currentUser = window.LayerDB?.getCurrentUser();
      GripState.teamMembers = project.teamMembers.map(m => {
        const isYou = m === 'You' || (currentUser && m === currentUser.email);
        return {
          name: isYou ? (currentUser?.user_metadata?.name || 'You') : m,
          email: m,
          avatarUrl: isYou ? currentUser?.user_metadata?.avatar_url : null
        };
      });
    }

    // Try to fetch detailed member info from Supabase if available
    if (window.LayerDB && project.id) {
      try {
        const members = await window.LayerDB.getProjectMembers(project.id);
        if (members && members.length > 0) {
          GripState.teamMembers = members.map(m => ({
            name: m.name || m.email?.split('@')[0] || 'Member',
            email: m.email,
            avatarUrl: m.avatarUrl
          }));
          // Re-render header if overlay is already shown
          updateGripHeader();
        }
      } catch (err) {
        console.warn('Failed to fetch project members for whiteboard:', err);
      }
    }
  }

  await loadGripData(projectIndex);

  // Reset View for good UX if it's the first open or empty
  if (GripState.nodes.length === 0) {
    GripState.scale = 1;
    GripState.offsetX = window.innerWidth / 2;
    GripState.offsetY = window.innerHeight / 2;
  }

  renderGripOverlay();
  requestAnimationFrame(gripGameLoop);

  // Setup real-time subscription for whiteboard changes
  subscribeToGripDiagramChanges(projectIndex);
}

function updateGripHeader() {
  const filenameEl = document.querySelector('.grip-filename');
  if (filenameEl) {
    filenameEl.textContent = GripState.projectName;
  }

  const avatarListEl = document.getElementById('gripTeamAvatars');
  if (avatarListEl) {
    avatarListEl.innerHTML = renderGripTeamAvatars();
  }
}

function renderGripTeamAvatars() {
  return GripState.teamMembers.map(member => {
    const name = member.name || 'User';
    if (member.avatarUrl) {
      return `<img src="${member.avatarUrl}" class="grip-team-avatar" title="${name}" alt="${name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
              <div class="grip-team-avatar-fallback" title="${name}">${name.charAt(0).toUpperCase()}</div>`;
    }
    return `<div class="grip-team-avatar-fallback" title="${name}">${name.charAt(0).toUpperCase()}</div>`;
  }).join('');
}

async function loadGripData(index) {
  console.log('📂 loadGripData called for index:', index);

  // First try to load from localStorage
  const projects = loadProjects();
  const project = projects[index];

  // CRITICAL: Refresh from Supabase to ensure we have latest data
  if (project?.id && window.LayerDB?.getCurrentUser?.()) {
    try {
      console.log('🔄 Refreshing project data from Supabase...');
      const freshProject = await window.LayerDB.getProject(project.id);
      console.log('Fresh project data:', {
        hasGripDiagram: !!freshProject.grip_diagram,
        nodes: freshProject.grip_diagram?.nodes?.length || 0,
        edges: freshProject.grip_diagram?.edges?.length || 0
      });

      // Update local storage with fresh data
      if (freshProject) {
        projects[index] = freshProject;
        localStorage.setItem('layer_projects', JSON.stringify(projects));
        console.log('✅ Local storage updated with fresh Supabase data');
      }
    } catch (error) {
      console.error('❌ Failed to refresh from Supabase, using local data:', error);
    }
  }

  // Now load the data (either fresh from Supabase or local)
  if (project?.gripDiagram || project?.grip_diagram) {
    const gripData = project.gripDiagram || project.grip_diagram;
    console.log('Loading grip data:', {
      nodes: gripData.nodes?.length || 0,
      edges: gripData.edges?.length || 0
    });

    // Migration check: if old format (gripCells), convert them
    if (gripData.cells) {
      migrateOldData(gripData);
    } else {
      GripState.nodes = gripData.nodes || [];
      GripState.edges = gripData.edges || [];
      GripState.offsetX = gripData.offsetX || 0;
      GripState.offsetY = gripData.offsetY || 0;
      GripState.scale = gripData.scale || 1;
    }
  } else {
    console.log('No grip data found, initializing empty');
    GripState.nodes = [];
    GripState.edges = [];
  }

  // Initialize History
  GripState.history = [{
    nodes: JSON.parse(JSON.stringify(GripState.nodes)),
    edges: JSON.parse(JSON.stringify(GripState.edges))
  }];
  GripState.historyIndex = 0;

  console.log('📋 Final loaded state:', {
    nodes: GripState.nodes.length,
    edges: GripState.edges.length
  });
}

function migrateOldData(oldData) {
  GripState.nodes = [];
  // Convert cells
  (oldData.cells || []).forEach(cell => {
    GripState.nodes.push({
      id: 'node-' + cell.id,
      type: 'card', // layout-card
      x: cell.x || 0,
      y: cell.y || 0,
      width: cell.width || 200,
      height: cell.height || 100,
      text: cell.title + '\n' + (cell.content || ''),
      style: { background: '#111', color: '#fff' }
    });
  });

  GripState.edges = [];
  // Convert connections
  (oldData.connections || []).forEach(conn => {
    GripState.edges.push({
      id: generateEdgeId(),
      from: 'node-' + conn.fromId,
      fromHandle: conn.fromPosition || 'right',
      to: 'node-' + conn.toId,
      toHandle: conn.toPosition || 'left'
    });
  });

  console.log('Migrated old whiteboard data to new format');
}

function saveGripData() {
  console.log('💾 saveGripData called');
  const projects = loadProjects();
  console.log('Projects loaded:', projects.length, 'Current index:', GripState.projectIndex);

  if (projects[GripState.projectIndex]) {
    console.log('Saving grip data to project:', projects[GripState.projectIndex].name);
    projects[GripState.projectIndex].gripDiagram = {
      nodes: GripState.nodes,
      edges: GripState.edges,
      offsetX: GripState.offsetX,
      offsetY: GripState.offsetY,
      scale: GripState.scale
    };
    saveProjects(projects);
    console.log('✅ Grip data saved to localStorage');

    // Save to Supabase continuously
    saveGripDataToSupabase();
  } else {
    console.warn('❌ No project found at index', GripState.projectIndex);
  }
}

// Auto-save to Supabase with debouncing
let gripSaveTimeout = null;
let lastGripData = null;
let gripSaveStatusTimeout = null;
let remoteUpdateNotificationTimeout = null;
let gripThrottleTimeout = null;
let lastThrottleTime = 0;
let instantSaveInProgress = false;

// Throttle function for frequent operations like dragging - OPTIMIZED FOR INSTANT SAVES
function throttleSaveGripData() {
  console.log('⚡ throttleSaveGripData called');
  const now = Date.now();
  const throttleDelay = 100; // Reduced from 500ms to 100ms for faster saves

  if (now - lastThrottleTime >= throttleDelay) {
    console.log('✅ Throttle condition met, saving immediately');
    saveGripData();
    lastThrottleTime = now;
  } else {
    console.log('⏱️ Throttled, scheduling save for later');
    // Schedule a save after the throttle delay
    if (gripThrottleTimeout) clearTimeout(gripThrottleTimeout);
    gripThrottleTimeout = setTimeout(() => {
      console.log('⏰ Scheduled save triggered');
      saveGripData();
      lastThrottleTime = Date.now();
    }, throttleDelay - (now - lastThrottleTime));
  }
}

function saveGripDataToLocalStorage() {
  console.log('💾 saveGripDataToLocalStorage called - bypassing data change check');

  if (!GripState.projectIndex === undefined || GripState.projectIndex === null) {
    console.log('No project selected, skipping localStorage save');
    return;
  }

  const currentGripData = {
    nodes: GripState.nodes,
    edges: GripState.edges,
    offsetX: GripState.offsetX,
    offsetY: GripState.offsetY,
    scale: GripState.scale
  };

  console.log('Saving to localStorage immediately:', {
    nodes: currentGripData.nodes?.length || 0,
    edges: currentGripData.edges?.length || 0,
    projectIndex: GripState.projectIndex
  });

  try {
    // Save to localStorage
    const projects = loadProjects();
    if (projects[GripState.projectIndex]) {
      projects[GripState.projectIndex].gripDiagram = currentGripData;
      localStorage.setItem('layer_projects', JSON.stringify(projects));
      console.log('✅ localStorage updated successfully');
    }
  } catch (error) {
    console.error('❌ localStorage save failed:', error);
  }
}

function saveGripDataToSupabase() {
  console.log('🔄 saveGripDataToSupabase called');
  console.log('GripState at save:', {
    nodes: GripState.nodes?.length || 0,
    edges: GripState.edges?.length || 0,
    projectIndex: GripState.projectIndex
  });

  if (!window.LayerDB?.getCurrentUser?.()) {
    console.log('User not authenticated, skipping Supabase save');
    return;
  }

  const currentGripData = {
    nodes: GripState.nodes,
    edges: GripState.edges,
    offsetX: GripState.offsetX,
    offsetY: GripState.offsetY,
    scale: GripState.scale
  };

  console.log('Current grip data:', currentGripData);
  console.log('Last grip data:', lastGripData);

  // Check if data actually changed
  const dataChanged = !lastGripData || JSON.stringify(currentGripData) !== JSON.stringify(lastGripData);
  console.log('Data changed:', dataChanged);
  if (!dataChanged) {
    console.log('⏭️ No data change detected, skipping save');
    return;
  }

  lastGripData = currentGripData;

  // Clear existing timeout
  if (gripSaveTimeout) {
    clearTimeout(gripSaveTimeout);
  }

  // Show saving status immediately
  showGripSaveStatus('saving');

  // Debounce saves - wait 100ms after last change (INSTANT auto-save - reduced from 300ms)
  gripSaveTimeout = setTimeout(async () => {
    try {
      const projects = loadProjects();
      const project = projects[GripState.projectIndex];

      if (!project) {
        console.warn('Project not found for saving grip diagram');
        showGripSaveStatus('error');
        return;
      }

      console.log('💾 Auto-saving whiteboard to Supabase...');
      console.log('Project ID:', project.id);
      console.log('Current user:', window.LayerDB?.getCurrentUser?.());
      console.log('Grip data size:', JSON.stringify(currentGripData).length, 'characters');

      showGripSaveStatus('saving'); // Show saving status

      // Update the project in Supabase
      const result = await window.LayerDB.updateProject(project.id, {
        grip_diagram: currentGripData,
        updated_at: new Date().toISOString()
      });

      console.log('✅ Whiteboard auto-saved to Supabase:', result);
      showGripSaveStatus('saved');
    } catch (error) {
      console.error('❌ Failed to auto-save whiteboard to Supabase:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      showGripSaveStatus('error');
    }
  }, 100); // 100ms debounce for INSTANT auto-save (reduced from 300ms)
}

// INSTANT SAVE FUNCTION - No debouncing for immediate saves
function saveGripDataInstant() {
  console.log('⚡ INSTANT SAVE triggered');
  console.log('Current GripState:', {
    nodes: GripState.nodes?.length || 0,
    edges: GripState.edges?.length || 0,
    projectIndex: GripState.projectIndex,
    hasUser: !!window.LayerDB?.getCurrentUser?.(),
    saveInProgress: instantSaveInProgress
  });

  if (!window.LayerDB?.getCurrentUser?.()) {
    console.log('User not authenticated, skipping instant Supabase save');
    return;
  }

  if (instantSaveInProgress) {
    console.log('⚠️ Instant save already in progress, skipping');
    return;
  }

  const currentGripData = {
    nodes: GripState.nodes,
    edges: GripState.edges,
    offsetX: GripState.offsetX,
    offsetY: GripState.offsetY,
    scale: GripState.scale
  };

  console.log('📋 Grip data prepared for instant save:', {
    nodesCount: currentGripData.nodes?.length || 0,
    edgesCount: currentGripData.edges?.length || 0,
    timestamp: new Date().toISOString()
  });

  // Save to localStorage first (but skip the data change check for instant save)
  saveGripDataToLocalStorage();

  // Then save to Supabase immediately (no debounce)
  (async () => {
    try {
      const projects = loadProjects();
      console.log('📁 Loaded projects:', projects?.length || 0);
      const project = projects[GripState.projectIndex];

      if (!project) {
        console.warn('❌ Project not found for instant grip diagram save');
        console.warn('Available projects:', projects?.map(p => ({ id: p.id, name: p.name })) || []);
        console.warn('Requested projectIndex:', GripState.projectIndex);
        return;
      }

      console.log('🚀 INSTANT save to Supabase starting...');
      console.log('Project details:', { id: project.id, name: project.name });

      instantSaveInProgress = true;
      console.log('🔒 Instant save locked - in progress');
      showGripSaveStatus('saving'); // Show saving status

      const updateResult = await window.LayerDB.updateProject(project.id, {
        grip_diagram: currentGripData,
        updated_at: new Date().toISOString()
      });

      console.log('✅ INSTANT whiteboard saved to Supabase successfully');
      console.log('Update result:', updateResult);

      // Update lastGripData to ensure subsequent saves work correctly
      lastGripData = currentGripData;
      console.log('Updated lastGripData for next comparison');

      instantSaveInProgress = false;
      console.log('🔓 Instant save unlocked - completed');

      showGripSaveStatus('saved');

      // Verify the save actually worked
      setTimeout(async () => {
        try {
          const verification = await window.LayerDB.getProject(project.id);
          console.log('🔍 Verification check - saved data:', {
            savedNodes: verification.grip_diagram?.nodes?.length || 0,
            savedEdges: verification.grip_diagram?.edges?.length || 0,
            matchesCurrent: verification.grip_diagram?.nodes?.length === currentGripData.nodes?.length
          });
        } catch (verifyError) {
          console.error('❌ Verification failed:', verifyError);
        }
      }, 500);

    } catch (error) {
      console.error('❌ INSTANT save failed:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details
      });
      instantSaveInProgress = false;
      console.log('🔓 Instant save unlocked - failed');
      showGripSaveStatus('error');
    }
  })();
}

function showGripSaveStatus(status) {
  const saveStatus = document.getElementById('gripSaveStatus');
  if (!saveStatus) return;

  // Clear existing timeout
  if (gripSaveStatusTimeout) {
    clearTimeout(gripSaveStatusTimeout);
  }

  saveStatus.style.display = 'block';
  saveStatus.className = `grip-save-indicator-dot ${status}`;

  // Enhanced status messages for better user feedback
  if (status === 'saving') {
    saveStatus.title = 'Saving to database...';
  } else if (status === 'saved') {
    saveStatus.title = 'Saved to database ✅';
  } else if (status === 'error') {
    saveStatus.title = 'Save failed ❌';
  }

  if (status === 'saved') {
    // Auto-hide after 1.5 seconds for saved status (faster than before)
    gripSaveStatusTimeout = setTimeout(() => {
      saveStatus.style.display = 'none';
    }, 1500);
  }
}

function showRemoteUpdateNotification() {
  const notification = document.getElementById('remoteUpdateNotification');
  if (!notification) return;

  // Clear existing timeout
  if (remoteUpdateNotificationTimeout) {
    clearTimeout(remoteUpdateNotificationTimeout);
  }

  notification.style.display = 'flex';
  notification.className = 'remote-update-notification';
  notification.querySelector('.remote-update-text').textContent = 'Updated by team member';

  // Auto-hide after 3 seconds
  remoteUpdateNotificationTimeout = setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}




// ============================================
// History Management
// ============================================

function pushToHistory() {
  // Clear any history ahead of current index (redo stack)
  if (GripState.historyIndex < GripState.history.length - 1) {
    GripState.history = GripState.history.slice(0, GripState.historyIndex + 1);
  }

  // Limit history size
  if (GripState.history.length > 50) {
    GripState.history.shift();
    GripState.historyIndex--;
  }

  GripState.history.push({
    nodes: JSON.parse(JSON.stringify(GripState.nodes)),
    edges: JSON.parse(JSON.stringify(GripState.edges))
  });

  GripState.historyIndex++;
}

function undo() {
  if (GripState.historyIndex > 0) {
    GripState.historyIndex--;
    const state = GripState.history[GripState.historyIndex];
    GripState.nodes = JSON.parse(JSON.stringify(state.nodes));
    GripState.edges = JSON.parse(JSON.stringify(state.edges));
    renderCanvas();
    saveGripDataInstant(); // INSTANT SAVE for text changes
  }
}

function redo() {
  if (GripState.historyIndex < GripState.history.length - 1) {
    GripState.historyIndex++;
    const state = GripState.history[GripState.historyIndex];
    GripState.nodes = JSON.parse(JSON.stringify(state.nodes));
    GripState.edges = JSON.parse(JSON.stringify(state.edges));
    renderCanvas();
    saveGripData();
  }
}

// ============================================
// DOM Rendering & Events
// ============================================

function renderGripOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'gripDiagramOverlay';
  overlay.className = 'grip-diagram-overlay';

  overlay.innerHTML = `
    <div class="grip-toolbar-top">
      <div style="display: flex; align-items: center; gap: 12px; pointer-events: auto;">
        <div class="grip-toolbar-group grip-logo-container">
           <svg width="32" height="32" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="logoGradientGrip" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#7c3aed" />
                  <stop offset="100%" stop-color="#5b21b6" />
                </linearGradient>
              </defs>
              <rect x="38" y="38" width="52" height="52" rx="16" fill="url(#logoGradientGrip)" opacity="0.28" />
              <rect x="38" y="54" width="52" height="36" rx="14" fill="url(#logoGradientGrip)" opacity="0.55" />
              <rect x="38" y="70" width="52" height="20" rx="10" fill="url(#logoGradientGrip)" />
              <rect x="38" y="38" width="20" height="52" rx="10" fill="url(#logoGradientGrip)" />
            </svg>
        </div>
        <div class="grip-toolbar-group">
          <button class="grip-btn-icon" onclick="closeGripDiagram()" title="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div class="grip-divider-vertical"></div>
          <div class="grip-filename">${GripState.projectName}</div>
          <div class="grip-team-avatars" id="gripTeamAvatars">
            ${renderGripTeamAvatars()}
          </div>
        </div>
      </div>
      
      <div class="grip-toolbar-group">
        <button class="grip-btn-icon" onclick="undo()" title="Undo (Ctrl+Z)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
        </button>
        <button class="grip-btn-icon" onclick="redo()" title="Redo (Ctrl+Y)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/></svg>
        </button>
      </div>
      
      <div class="grip-toolbar-group">
        <button class="grip-btn-icon" onclick="zoomOut()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <span class="grip-zoom-val" id="gripZoomVal">100%</span>
        <button class="grip-btn-icon" onclick="zoomIn()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      
      <div class="grip-save-indicator-dot" id="gripSaveStatus" style="display: none;">
        <span class="grip-save-dot"></span>
      </div>
      <div id="remoteUpdateNotification" class="remote-update-notification" style="display: none;">
        <span class="remote-update-indicator"></span>
        <span class="remote-update-text">Updated by team member</span>
      </div>
    </div>
    
    <div class="grip-toolbar-bottom">
      <button class="grip-tool-btn active" data-tool="select" title="Select (V)" onclick="setTool('select')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>
      </button>
      <button class="grip-tool-btn" data-tool="hand" title="Hand Tool (H)" onclick="setTool('hand')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 11V6a2 2 0 00-2-2 2 2 0 00-2 2v1M14 10V4a2 2 0 00-2-2 2 2 0 00-2 2v6M10 10.5V6a2 2 0 00-2-2 2 2 0 00-2 2v8"/><path d="M18 8a2 2 0 012 2v7a5 5 0 01-5 5h-4a5 5 0 01-5-5v-2"/></svg>
      </button>
      <div class="grip-divider-vertical"></div>
      
      <button class="grip-tool-btn" data-tool="pencil" title="Free Draw (X)" onclick="setTool('pencil')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
      </button>

      <!-- New User Flow Tools -->
      <button class="grip-tool-btn" data-tool="pill" title="Pill Node (P)" onclick="setTool('pill')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="6"/></svg>
      </button>

      <button class="grip-tool-btn" data-tool="header" title="Large Header (T)" onclick="setTool('header')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
      </button>

      <button class="grip-tool-btn" data-tool="calculator" title="Scientific Calculator" onclick="window.layerCalculator.toggle()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <line x1="8" y1="6" x2="16" y2="6" />
          <line x1="16" y1="14" x2="16" y2="18" />
          <path d="M16 10h.01" />
          <path d="M12 10h.01" />
          <path d="M8 10h.01" />
          <path d="M12 14h.01" />
          <path d="M8 14h.01" />
          <path d="M12 18h.01" />
          <path d="M8 18h.01" />
        </svg>
      </button>

      <button class="grip-tool-btn" data-tool="circuit" title="Circuit Designer (C)" onclick="toggleCircuitPanel()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="6" cy="6" r="2"/>
          <circle cx="18" cy="6" r="2"/>
          <circle cx="6" cy="18" r="2"/>
          <circle cx="18" cy="18" r="2"/>
          <path d="M8 6h8M6 8v8M18 8v8M8 18h8"/>
          <circle cx="12" cy="12" r="3" fill="none" stroke-dasharray="2 2"/>
        </svg>
      </button>
      
      <div class="grip-divider-vertical"></div>
      
      <button class="grip-tool-btn" data-tool="eraser" title="Eraser (E)" onclick="setTool('eraser')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <defs>
            <linearGradient id="eraserGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ff6b6b" />
              <stop offset="50%" stop-color="#ffa500" />
              <stop offset="100%" stop-color="#ffd700" />
            </linearGradient>
          </defs>
          <path d="M18 4l-5 5-7 7-3 3 3 3 3-3 7-7 5-5z" fill="url(#eraserGradient)" stroke="none"/>
          <path d="M18 4l-5 5-7 7-3 3" stroke="currentColor" fill="none" stroke-width="1.5"/>
          <path d="M6 18l3 3" stroke="rgba(0,0,0,0.3)" stroke-width="1" fill="none"/>
        </svg>
      </button>
      
      <!-- Eraser Size Options -->
      <div id="eraserSizeOptions" class="eraser-size-options" style="display: none;">
        <button class="eraser-size-btn small" data-size="small" title="Small Eraser" onclick="setEraserSize('small')">S</button>
        <button class="eraser-size-btn medium active" data-size="medium" title="Medium Eraser" onclick="setEraserSize('medium')">M</button>
        <button class="eraser-size-btn large" data-size="large" title="Large Eraser" onclick="setEraserSize('large')">L</button>
      </div>
    </div>
    
    <div id="gripPropertiesPanel" class="grip-properties-panel" style="display:none;"></div>

    <div id="gripCanvasContainer" class="grip-canvas-container">
      <div id="gripTransformLayer" class="grip-transform-layer">
         <!-- Content injected by JS -->
      </div>
      <div id="gripSelectionBox" class="grip-selection-box" style="display:none;"></div>
      <svg id="gripTempConnection" class="grip-temp-connection"></svg>
      
      <!-- Realtime Collaboration Elements -->
      <div id="gripActiveUsers" class="grip-active-users-container"></div>
      <div id="gripRemoteCursors" class="grip-remote-cursors-container"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Attach Event Listeners
  const container = document.getElementById('gripCanvasContainer');
  container.addEventListener('mousedown', handleMouseDown);
  container.addEventListener('dblclick', handleDoubleClick);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  container.addEventListener('wheel', handleWheel, { passive: false });
  document.addEventListener('keydown', handleKeyDown);
  
  // Drag-and-drop from circuit panel
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const componentId = e.dataTransfer.getData('text/plain');
    if (componentId && typeof CircuitComponents !== 'undefined' && CircuitComponents[componentId]) {
      const comp = CircuitComponents[componentId];
      const worldPos = screenToWorld(e.clientX, e.clientY);
      const node = {
        id: generateUUID(),
        type: 'circuit',
        circuitType: componentId,
        x: snapToGrid(worldPos.x - comp.width / 2),
        y: snapToGrid(worldPos.y - comp.height / 2),
        width: comp.width,
        height: comp.height,
        text: comp.name,
        style: {},
        pins: comp.pins.map(p => ({ ...p })),
        labelText: '',
        circuitState: {}
      };
      GripState.nodes.push(node);
      GripState.selectedNodeIds.clear();
      GripState.selectedNodeIds.add(node.id);
      pushToHistory();
      saveGripDataInstant();
      renderCanvas();
      if (typeof broadcastNodeOperation === 'function') broadcastNodeOperation('add', node.id, node);
    }
  });

  // Initial Render
  renderCanvas();
  updateCursor();

  // Initialize Smooth Zoom Targets
  GripState.targetScale = GripState.scale;
  GripState.targetOffsetX = GripState.offsetX;
  GripState.targetOffsetY = GripState.offsetY;

  // Start Animation Loop
  requestAnimationFrame(function animate() {
    updateSmoothTransform();
    requestAnimationFrame(animate);
  });
}

function updateSmoothTransform() {
  // Lerp factor (higher = faster, lower = smoother)
  const lerp = 0.15;

  if (Math.abs(GripState.targetScale - GripState.scale) > 0.001 ||
    Math.abs(GripState.targetOffsetX - GripState.offsetX) > 0.1 ||
    Math.abs(GripState.targetOffsetY - GripState.offsetY) > 0.1) {

    GripState.scale += (GripState.targetScale - GripState.scale) * lerp;
    GripState.offsetX += (GripState.targetOffsetX - GripState.offsetX) * lerp;
    GripState.offsetY += (GripState.targetOffsetY - GripState.offsetY) * lerp;

    renderCanvasTransform();
    updateZoomDisplay();
  }
}

function updateCursor() {
  const container = document.getElementById('gripCanvasContainer');
  if (!container) return;

  if (GripState.isDraggingCanvas) {
    container.className = 'grip-canvas-container cursor-grabbing';
    hideEraserCursor();
    return;
  }

  if (GripState.activeTool === 'hand' || GripState.isSpacePressed) {
    container.className = 'grip-canvas-container cursor-grab';
    hideEraserCursor();
  } else if (GripState.activeTool === 'eraser') {
    container.className = 'grip-canvas-container cursor-eraser';
    showEraserCursor();
  } else if (['pill', 'card', 'shape:rectangle', 'shape:diamond', 'shape:ellipse', 'text', 'header', 'sticky', 'pencil', 'connect', 'circuit'].includes(GripState.activeTool)) {
    container.className = 'grip-canvas-container';
    container.style.cursor = 'crosshair';
    hideEraserCursor();
  } else {
    container.className = 'grip-canvas-container';
    container.style.cursor = 'default';
    hideEraserCursor();
  }
}

function setTool(tool) {
  GripState.activeTool = tool;
  updateCursor();
  renderToolbar();

  // Show/hide eraser size options
  const eraserSizeOptions = document.getElementById('eraserSizeOptions');
  if (eraserSizeOptions) {
    eraserSizeOptions.style.display = tool === 'eraser' ? 'flex' : 'none';
  }
}

function setEraserSize(size) {
  GripState.eraserSize = size === 'small' ? 20 : size === 'medium' ? 40 : 60;

  // Update button states
  document.querySelectorAll('.eraser-size-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.size === size);
  });

  // Update cursor size
  updateEraserCursor();
}

function showEraserCursor() {
  if (!GripState.eraserPreview) {
    GripState.eraserPreview = document.createElement('div');
    GripState.eraserPreview.className = 'grip-eraser-cursor medium';
    GripState.eraserPreview.id = 'gripEraserCursor';
    // Prevent pointer events on the cursor itself
    GripState.eraserPreview.style.pointerEvents = 'none';
    document.body.appendChild(GripState.eraserPreview);
  }
  updateEraserCursor();
}

function hideEraserCursor() {
  if (GripState.eraserPreview) {
    GripState.eraserPreview.remove();
    GripState.eraserPreview = null;
  }
  clearEraserHover();
}

function updateEraserCursor() {
  if (!GripState.eraserPreview) return;

  const size = GripState.eraserSize <= 20 ? 'small' : GripState.eraserSize <= 40 ? 'medium' : 'large';
  const erasingClass = GripState.isErasing ? 'erasing' : '';
  GripState.eraserPreview.className = `grip-eraser-cursor ${size} ${erasingClass}`;
}

function updateEraserHover(mouseX, mouseY) {
  const worldPos = screenToWorld(mouseX, mouseY);
  const newHoveredElements = new Set();

  // Check nodes
  GripState.nodes.forEach(node => {
    let isHovered = false;

    if (node.type === 'draw' && node.points && node.points.length > 0) {
      // For free drawing, check if any point is within eraser radius
      const eraserRadius = GripState.eraserSize / GripState.scale / 2;

      // Check each point in the drawing
      for (const point of node.points) {
        const absX = node.x + point.x;
        const absY = node.y + point.y;
        const distance = Math.sqrt((worldPos.x - absX) ** 2 + (worldPos.y - absY) ** 2);
        if (distance <= eraserRadius) {
          isHovered = true;
          break;
        }
      }

      // Also check if eraser is near the path segments between points
      if (!isHovered && node.points.length > 1) {
        for (let i = 0; i < node.points.length - 1; i++) {
          const p1 = { x: node.x + node.points[i].x, y: node.y + node.points[i].y };
          const p2 = { x: node.x + node.points[i + 1].x, y: node.y + node.points[i + 1].y };

          // Distance from point to line segment
          const dist = pointToLineSegmentDistance(worldPos, p1, p2);
          if (dist <= eraserRadius) {
            isHovered = true;
            break;
          }
        }
      }
    } else {
      // For regular nodes, check bounding box
      isHovered = worldPos.x >= node.x && worldPos.x <= node.x + node.width &&
        worldPos.y >= node.y && worldPos.y <= node.y + node.height;
    }

    if (isHovered) {
      newHoveredElements.add(`node-${node.id}`);
    }
  });

  // Check edges (simplified - just check proximity to edge path)
  GripState.edges.forEach(edge => {
    const fromNode = GripState.nodes.find(n => n.id === edge.from);
    const toNode = GripState.nodes.find(n => n.id === edge.to);
    if (fromNode && toNode) {
      const fromCenter = { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 };
      const toCenter = { x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 };

      // Simple distance check to edge line
      const dist = pointToLineDistance(worldPos, fromCenter, toCenter);
      if (dist < GripState.eraserSize / GripState.scale / 2) {
        newHoveredElements.add(`edge-${edge.id}`);
      }
    }
  });

  // Update DOM classes for hover effect
  GripState.hoveredElements.forEach(elementId => {
    if (!newHoveredElements.has(elementId)) {
      const element = document.querySelector(`[data-element-id="${elementId}"]`);
      if (element) element.classList.remove('eraser-hover');
    }
  });

  newHoveredElements.forEach(elementId => {
    if (!GripState.hoveredElements.has(elementId)) {
      const element = document.querySelector(`[data-element-id="${elementId}"]`);
      if (element) element.classList.add('eraser-hover');
    }
  });

  GripState.hoveredElements = newHoveredElements;
}

function clearEraserHover() {
  GripState.hoveredElements.forEach(elementId => {
    const element = document.querySelector(`[data-element-id="${elementId}"]`);
    if (element) element.classList.remove('eraser-hover');
  });
  GripState.hoveredElements.clear();
}

function pointToLineDistance(point, lineStart, lineEnd) {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;

  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;

  return Math.sqrt(dx * dx + dy * dy);
}

// Distance from point to line segment (bounded line)
function pointToLineSegmentDistance(point, lineStart, lineEnd) {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;

  if (lenSq === 0) {
    // Line segment is actually a point
    const dx = point.x - lineStart.x;
    const dy = point.y - lineStart.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  let param = dot / lenSq;
  param = Math.max(0, Math.min(1, param)); // Clamp to [0,1]

  const xx = lineStart.x + param * C;
  const yy = lineStart.y + param * D;

  const dx = point.x - xx;
  const dy = point.y - yy;

  return Math.sqrt(dx * dx + dy * dy);
}

function eraseAtPosition(mouseX, mouseY) {
  const worldPos = screenToWorld(mouseX, mouseY);
  let deletedSomething = false;

  // Check and delete nodes
  const nodesToDelete = [];
  GripState.nodes.forEach(node => {
    let isHit = false;

    if (node.type === 'draw' && node.points && node.points.length > 0) {
      // For free drawing, check if any point is within eraser radius
      const eraserRadius = GripState.eraserSize / GripState.scale / 2;

      // Check each point in the drawing
      for (const point of node.points) {
        const absX = node.x + point.x;
        const absY = node.y + point.y;
        const distance = Math.sqrt((worldPos.x - absX) ** 2 + (worldPos.y - absY) ** 2);
        if (distance <= eraserRadius) {
          isHit = true;
          break;
        }
      }

      // Also check if eraser is near the path segments between points
      if (!isHit && node.points.length > 1) {
        for (let i = 0; i < node.points.length - 1; i++) {
          const p1 = { x: node.x + node.points[i].x, y: node.y + node.points[i].y };
          const p2 = { x: node.x + node.points[i + 1].x, y: node.y + node.points[i + 1].y };

          // Distance from point to line segment
          const dist = pointToLineSegmentDistance(worldPos, p1, p2);
          if (dist <= eraserRadius) {
            isHit = true;
            break;
          }
        }
      }
    } else {
      // For regular nodes, check bounding box
      isHit = worldPos.x >= node.x && worldPos.x <= node.x + node.width &&
        worldPos.y >= node.y && worldPos.y <= node.y + node.height;
    }

    if (isHit) {
      nodesToDelete.push(node.id);
    }
  });

  // Delete nodes and their connected edges
  nodesToDelete.forEach(nodeId => {
    deleteNode(nodeId);
    deletedSomething = true;
  });

  // Check and delete edges
  const edgesToDelete = [];
  GripState.edges.forEach(edge => {
    const fromNode = GripState.nodes.find(n => n.id === edge.from);
    const toNode = GripState.nodes.find(n => n.id === edge.to);

    if (fromNode && toNode) {
      const fromCenter = { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 };
      const toCenter = { x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 };

      const dist = pointToLineDistance(worldPos, fromCenter, toCenter);
      if (dist < GripState.eraserSize / GripState.scale / 2) {
        edgesToDelete.push(edge.id);
      }
    }
  });

  edgesToDelete.forEach(edgeId => {
    GripState.edges = GripState.edges.filter(e => e.id !== edgeId);
    deletedSomething = true;
  });

  if (deletedSomething) {
    renderCanvas();
    saveGripData();
  }
}

function renderToolbar() {
  let selectedType = null;
  if (GripState.selectedNodeIds.size === 1) {
    const node = GripState.nodes.find(n => n.id === [...GripState.selectedNodeIds][0]);
    if (node) {
      selectedType = node.type;
      // Map special types
      if (selectedType === 'draw') selectedType = 'pencil';
    }
  }

  document.querySelectorAll('.grip-tool-btn').forEach(btn => {
    const tool = btn.dataset.tool;
    const isActiveTool = tool === GripState.activeTool;
    // Context active if it matches selected node type, AND we are in 'select' mode (usually),
    // or just always show context? User said "when the node is pressed and active".
    // Let's show it always when selected.
    const isContextActive = tool === selectedType;

    // If we are drawing, the pencil is active tool.
    // If we select a drawing, pencil is context active.

    btn.classList.toggle('active', isActiveTool);
    btn.classList.toggle('context-active', isContextActive && !isActiveTool);
  });
}


// ============================================
// Canvas Logic (Events)
// ============================================

function handleWheel(e) {
  e.preventDefault();

  if (e.ctrlKey || e.metaKey) {
    // Zoom
    const zoomFactor = -e.deltaY * 0.002; // Reduced sensitivity for smooth feel
    const newScale = Math.min(Math.max(GripState.targetScale * (1 + zoomFactor), GripState.MIN_SCALE), GripState.MAX_SCALE);

    // Zoom towards mouse pointer logic using Targets
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate world point relative to current TARGET transform 
    // (This ensures stability during rapid scrolling)
    const worldX = (mouseX - GripState.targetOffsetX) / GripState.targetScale;
    const worldY = (mouseY - GripState.targetOffsetY) / GripState.targetScale;

    GripState.targetScale = newScale;
    GripState.targetOffsetX = mouseX - worldX * GripState.targetScale;
    GripState.targetOffsetY = mouseY - worldY * GripState.targetScale;

  } else {
    // Pan
    GripState.targetOffsetX -= e.deltaX;
    GripState.targetOffsetY -= e.deltaY;
  }
}

function handleMouseDown(e) {
  if (e.target.closest('.grip-node-content') && e.target.isContentEditable) return;
  if (e.target.closest('.grip-properties-panel')) return;

  const isMiddleClick = e.button === 1;
  const isSpaceBar = GripState.isSpacePressed;

  // Hit Testing - Use proper bounding box calculation
  // Prioritize non-draw nodes (visual top) over draw nodes (visual bottom)
  const worldPos = screenToWorld(e.clientX, e.clientY);
  const nodesToCheck = [
    ...GripState.nodes.filter(n => n.type !== 'draw').reverse(),
    ...GripState.nodes.filter(n => n.type === 'draw').reverse()
  ];

  const hitNode = nodesToCheck.find(node => {
    const bounds = getNodeBoundingBox(node);

    // Check bounding box first for all nodes (fast fail)
    const inBounds = worldPos.x >= bounds.x && worldPos.x <= bounds.x + bounds.width &&
      worldPos.y >= bounds.y && worldPos.y <= bounds.y + bounds.height;

    if (!inBounds) return false;

    // For draw nodes, check precise path hit
    if (node.type === 'draw' && node.points && node.points.length > 1) {
      // Threshold for selection (e.g., 10px or stroke width based)
      const threshold = (node.style?.strokeWidth || 3) + 10;

      for (let i = 0; i < node.points.length - 1; i++) {
        const p1 = { x: node.x + node.points[i].x, y: node.y + node.points[i].y };
        const p2 = { x: node.x + node.points[i + 1].x, y: node.y + node.points[i + 1].y };

        // Use existing helper
        const dist = pointToLineSegmentDistance(worldPos, p1, p2); // Assuming this function exists in scope

        // Or simpler implementation if helper not available or to be safe:
        // const dist = Math.abs((p2.y - p1.y) * worldPos.x - (p2.x - p1.x) * worldPos.y + p2.x * p1.y - p2.y * p1.x) / Math.sqrt(Math.pow(p2.y - p1.y, 2) + Math.pow(p2.x - p1.x, 2));

        // Actually pointToLineSegmentDistance is better.
        // Let's implement inline logic if needed or rely on helper. 
        // Based on previous read, pointToLineSegmentDistance IS available.

        // But wait, pointToLineSegmentDistance implementation:
        // It calculates distance from point to segment.

        const A = worldPos.x - p1.x;
        const B = worldPos.y - p1.y;
        const C = p2.x - p1.x;
        const D = p2.y - p1.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;
        if (param < 0) { xx = p1.x; yy = p1.y; }
        else if (param > 1) { xx = p2.x; yy = p2.y; }
        else { xx = p1.x + param * C; yy = p1.y + param * D; }

        const dx = worldPos.x - xx;
        const dy = worldPos.y - yy;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= threshold) return true;
      }
      return false;
    }

    return true;
  });

  GripState.lastMouseX = e.clientX;
  GripState.lastMouseY = e.clientY;

  // 1. Pan (Hand Tool / Spacebar / Middle Click)
  if (GripState.activeTool === 'hand' || isMiddleClick || isSpaceBar) {
    GripState.isDraggingCanvas = true;
    updateCursor(); // Will set grabbing
    updatePropertiesPanel();
    return;
  }

  // ... (Rest of Tool Logic)
  if (GripState.activeTool === 'pencil') { startFreeDraw(worldPos); return; }

  if (e.target.classList.contains('grip-handle-connect')) {
    const nodeId = e.target.dataset.nodeId;
    const handle = e.target.dataset.position;
    startConnection(nodeId, handle, worldPos);
    return;
  }

  if (e.target.classList.contains('grip-resize-handle')) {
    const nodeId = e.target.dataset.nodeId;
    const handle = e.target.dataset.handle;
    startResize(nodeId, handle);
    return;
  }

  // Move Handle Click (Allow Drag) - Updated to .drag-handle
  if (e.target.closest('.drag-handle')) {
    const handle = e.target.closest('.drag-handle');
    const nodeId = handle.dataset.nodeId;
    if (!e.shiftKey && !GripState.selectedNodeIds.has(nodeId)) {
      GripState.selectedNodeIds.clear();
    }
    GripState.selectedNodeIds.add(nodeId);
    GripState.isDraggingNodes = true;
    renderCanvas();
    updatePropertiesPanel();
    renderToolbar(); // Ensure toolbar stays updated
    return;
  }

  // Note Button Click
  if (e.target.closest('.note-btn')) {
    // Handled by onclick, but prevent drag/selection
    return;
  }

  // Delete Button Click
  if (e.target.closest('.delete')) {
    // Handled by onclick
    return;
  }

  // Node Body Click (Select Only, No Drag)
  if (hitNode) {
    if (GripState.activeTool === 'eraser') {
      GripState.isErasing = true;
      deleteNode(hitNode.id);
      return;
    }
    if (GripState.activeTool === 'connect') { startConnection(hitNode.id, 'center', worldPos); return; }

    if (!e.shiftKey && !GripState.selectedNodeIds.has(hitNode.id)) {
      GripState.selectedNodeIds.clear();
    }
    GripState.selectedNodeIds.add(hitNode.id);
    GripState.isDraggingNodes = false; // Explicitly false
    renderCanvas();
    updatePropertiesPanel();
    renderToolbar();
    return;
  }

  if (GripState.activeTool === 'select') {
    if (!e.shiftKey) { GripState.selectedNodeIds.clear(); updatePropertiesPanel(); renderToolbar(); }
    GripState.isSelecting = true;
    GripState.selectionStart = { x: e.clientX, y: e.clientY };
    GripState.selectionEnd = { x: e.clientX, y: e.clientY };
    renderCanvas();
  } else if (GripState.activeTool === 'eraser') {
    // Eraser on empty space - start continuous erasing
    GripState.isErasing = true;
    eraseAtPosition(e.clientX, e.clientY);
  } else {
    createNodeAt(worldPos.x, worldPos.y, GripState.activeTool);
    // Optional: Don't switch back to select if holding shift? Excalidraw style
    if (!e.shiftKey) setTool('select');
  }
}

function handleMouseMove(e) {
  const dx = e.clientX - GripState.lastMouseX;
  const dy = e.clientY - GripState.lastMouseY;
  GripState.lastMouseX = e.clientX;
  GripState.lastMouseY = e.clientY;

  // Update eraser cursor position
  if (GripState.activeTool === 'eraser' && GripState.eraserPreview) {
    // Use requestAnimationFrame for smoother updates
    requestAnimationFrame(() => {
      if (GripState.eraserPreview) {
        GripState.eraserPreview.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;

        // Check for hover preview
        updateEraserHover(e.clientX, e.clientY);

        // Handle drag-to-erase
        if (GripState.isErasing) {
          eraseAtPosition(e.clientX, e.clientY);
        }
      }
    });
  }

  // Broadcast cursor position for real-time collaboration
  broadcastCursorPosition(e.clientX, e.clientY);

  // Panning
  if (GripState.isDraggingCanvas) {
    // Directly update target to follow mouse, but smooth tick handles the render
    GripState.targetOffsetX += dx;
    GripState.targetOffsetY += dy;
    // Also update actual instantly if we want 1:1 drag (optional, but smooth looks cool too)
    // For direct 1:1 drag feel with momentum on release, we can use targets.
    // For now, let's keep it responsive:
    GripState.offsetX += dx;
    GripState.offsetY += dy;
    renderCanvasTransform();

    // Sync targets to avoid jump when switching back to wheel
    GripState.targetOffsetX = GripState.offsetX;
    GripState.targetOffsetY = GripState.offsetY;
    return;
  }

  if (GripState.isDrawing) { continueFreeDraw(screenToWorld(e.clientX, e.clientY)); return; }

  if (GripState.isDraggingNodes) {
    const worldDx = dx / GripState.scale;
    const worldDy = dy / GripState.scale;
    GripState.selectedNodeIds.forEach(id => {
      const node = GripState.nodes.find(n => n.id === id);
      if (node) {
        node.x += worldDx;
        node.y += worldDy;
      }
    });
    renderCanvas();
    // Throttled save during dragging
    throttleSaveGripData();

    // Broadcast node movement to other users
    GripState.selectedNodeIds.forEach(id => {
      const node = GripState.nodes.find(n => n.id === id);
      if (node) {
        broadcastNodeOperation('move', id, { x: node.x, y: node.y });
      }
    });
    return;
  }

  if (GripState.isResizing) { handleResizeMove(dx, dy); return; }

  if (GripState.isConnecting) {
    GripState.tempConnectionEnd = screenToWorld(e.clientX, e.clientY);
    renderTempConnection();
    return;
  }

  if (GripState.isSelecting) {
    GripState.selectionEnd = { x: e.clientX, y: e.clientY };
    renderSelectionBox();
  }
}

function handleMouseUp(e) {
  if (GripState.isDrawing) finishFreeDraw();
  if (GripState.isDraggingNodes) pushToHistory();

  const wasPanning = GripState.isDraggingCanvas;

  GripState.isDraggingCanvas = false;
  GripState.isDraggingNodes = false;
  GripState.isResizing = false;
  GripState.isDrawing = false;
  GripState.isErasing = false; // Reset eraser state

  // Reset cursor from grabbing to grab (if hand tool) or default
  updateCursor();

  // Save viewport position when panning stops
  if (wasPanning) {
    saveGripData();
  }

  if (GripState.isSelecting) {
    commitSelectionBox();
    GripState.isSelecting = false;
    document.getElementById('gripSelectionBox').style.display = 'none';
    updatePropertiesPanel();
  }

  if (GripState.isConnecting) {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    
    // First check if we're directly over a circuit pin
    const pinEl = document.elementFromPoint(e.clientX, e.clientY);
    const circuitPin = pinEl ? (pinEl.closest('.circuit-pin') || null) : null;
    
    if (circuitPin) {
      const targetNodeId = circuitPin.dataset.nodeId;
      const targetPinId = circuitPin.dataset.pinId;
      if (targetNodeId && targetNodeId !== GripState.connectionStartNodeId) {
        createEdge(GripState.connectionStartNodeId, GripState.connectionStartHandle, targetNodeId, targetPinId);
      }
    } else {
      const hitNode = GripState.nodes.slice().reverse().find(node => {
        const bounds = getNodeBoundingBox(node);
        return worldPos.x >= bounds.x && worldPos.x <= bounds.x + bounds.width &&
          worldPos.y >= bounds.y && worldPos.y <= bounds.y + bounds.height;
      });
      if (hitNode && hitNode.id !== GripState.connectionStartNodeId) {
        // For circuit nodes, find the nearest pin
        if (hitNode.type === 'circuit') {
          const nearestPin = findNearestCircuitPin(hitNode, worldPos);
          createEdge(GripState.connectionStartNodeId, GripState.connectionStartHandle, hitNode.id, nearestPin || 'auto');
        } else {
          createEdge(GripState.connectionStartNodeId, GripState.connectionStartHandle, hitNode.id, 'auto');
        }
      }
    }
    GripState.isConnecting = false;
    document.getElementById('gripTempConnection').innerHTML = '';
  }

  saveGripData();
}

// Double-click handler for switch toggling and component interaction
function handleDoubleClick(e) {
  const worldPos = screenToWorld(e.clientX, e.clientY);
  const hitNode = GripState.nodes.slice().reverse().find(node => {
    const bounds = getNodeBoundingBox(node);
    return worldPos.x >= bounds.x && worldPos.x <= bounds.x + bounds.width &&
      worldPos.y >= bounds.y && worldPos.y <= bounds.y + bounds.height;
  });
  
  if (hitNode && hitNode.type === 'circuit') {
    if (typeof handleCircuitDoubleClick === 'function') {
      handleCircuitDoubleClick(hitNode, e);
    }
  }
}

function handleKeyDown(e) {
  if (e.target.isContentEditable) return;

  if (e.code === 'Space' && !GripState.isSpacePressed) {
    GripState.isSpacePressed = true;
    updateCursor();
  }

  if (e.key === 'Delete' || e.key === 'Backspace') { if (GripState.selectedNodeIds.size > 0) deleteSelectedNodes(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }

  if (e.key === 'v') setTool('select');
  if (e.key === 'h') setTool('hand');
  if (e.key === 'p') setTool('pill');

  if (e.key === 't') setTool('header');
  if (e.key === 'x') setTool('pencil');
  if (e.key === 'e') setTool('eraser');
  if (e.key === 'l') setTool('connect');
  if (e.key === 'c' && !e.ctrlKey && !e.metaKey) { if (typeof toggleCircuitPanel === 'function') toggleCircuitPanel(); }
}

// Add KeyUp listener to global or container
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    GripState.isSpacePressed = false;
    updateCursor();
  }
});


// ============================================
// Logic Implementation (New Features)
// ============================================

function createNodeAt(x, y, toolType) {
  const typeMap = {
    'pill': { w: 140, h: 50, style: 'shape-pill', text: 'Type here...' },
    'header': { w: 400, h: 80, style: 'shape-header', text: 'Section Header' },
    // Legacy mapping
    'card': { w: 200, h: 100, style: 'card-default', text: 'Card' },
    'shape:rectangle': { w: 100, h: 100, style: 'shape-rect', text: '' },
    'shape:diamond': { w: 100, h: 100, style: 'shape-diamond', text: '' },
    'shape:ellipse': { w: 100, h: 100, style: 'shape-ellipse', text: '' },
    'text': { w: 150, h: 40, style: 'shape-text', text: 'Text' },
    'sticky': { w: 150, h: 150, style: 'grip-node-sticky', text: 'Sticky Note' } // Added text for consistency
  };

  const config = typeMap[toolType] || typeMap['card'];

  const newNode = {
    id: generateUUID(),
    type: toolType,
    x: snapToGrid(x - config.w / 2),
    y: snapToGrid(y - config.h / 2),
    width: config.w,
    height: config.h,
    text: config.text,
    style: {}
  };

  GripState.nodes.push(newNode);
  GripState.selectedNodeIds.clear();
  GripState.selectedNodeIds.add(newNode.id);
  pushToHistory();

  // INSTANT SAVE for node creation
  saveGripDataInstant();
  renderCanvas();

  // Broadcast node creation to other users
  broadcastNodeOperation('add', newNode.id, newNode);
}

function createEdge(fromId, fromHandle, toId, toHandle) {
  const newEdge = {
    id: generateEdgeId(),
    from: fromId,
    fromHandle: fromHandle,
    to: toId,
    toHandle: toHandle,
    style: {}
  };
  GripState.edges.push(newEdge);
  pushToHistory();
  
  // Update circuit pin signals when connections change
  if (typeof updateAllPinSignals === 'function') {
    updateAllPinSignals();
  }
  
  renderCanvas();

  // Broadcast edge creation to other users
  broadcastEdgeOperation('add', newEdge.id, newEdge);
}

function startConnection(nodeId, handle, pos) {
  GripState.isConnecting = true;
  GripState.connectionStartNodeId = nodeId;
  GripState.connectionStartHandle = handle;
  GripState.tempConnectionEnd = pos;
  renderTempConnection();
}

function startResize(nodeId, handle) {
  GripState.isResizing = true;
  GripState.resizeNodeId = nodeId;
  GripState.resizeHandle = handle;
  const node = GripState.nodes.find(n => n.id === nodeId);
  GripState.initialResizeBounds = { x: node.x, y: node.y, w: node.width, h: node.height };
}

function handleResizeMove(dx, dy) {
  const node = GripState.nodes.find(n => n.id === GripState.resizeNodeId);
  const handle = GripState.resizeHandle;
  const worldDx = dx / GripState.scale;
  const worldDy = dy / GripState.scale;

  // Simplified resizing logic (just bottom-right for MVP robustness, can expand)
  if (handle.includes('e')) node.width = Math.max(50, node.width + worldDx);
  if (handle.includes('s')) node.height = Math.max(50, node.height + worldDy);
  // Add other directions...

  renderCanvas();
  // Throttled save during resizing
  throttleSaveGripData();
}
// ============================================
// Free Draw Logic (Smoothed)
// ============================================

function startFreeDraw(pos) {
  GripState.isDrawing = true;
  const id = generateUUID();
  const newNode = {
    id: id,
    type: 'draw',
    x: pos.x,
    y: pos.y,
    width: 0,
    height: 0,
    points: [{ x: 0, y: 0 }], // Relative
    style: { stroke: 'var(--foreground)', strokeWidth: 3, opacity: 1 }
  };
  GripState.nodes.push(newNode);
  GripState.activeDrawNodeId = id;
  renderCanvas(); // Force render start
}

function continueFreeDraw(pos) {
  const node = GripState.nodes.find(n => n.id === GripState.activeDrawNodeId);
  if (!node) return;

  const relX = pos.x - node.x;
  const relY = pos.y - node.y;

  // Optimize: Don't add if too close (simple thinning)
  const last = node.points[node.points.length - 1];
  if (Math.hypot(relX - last.x, relY - last.y) > 2) {
    node.points.push({ x: relX, y: relY });
    renderCanvas();
    // Throttled save during drawing
    throttleSaveGripData();
  }
}

function finishFreeDraw() {
  if (GripState.activeDrawNodeId) {
    const node = GripState.nodes.find(n => n.id === GripState.activeDrawNodeId);
    if (node && node.points.length > 0) {
      // Smooth the points significantly (only if enough points)
      if (node.points.length > 2) {
        node.points = smoothPoints(node.points);
        node.points = smoothPoints(node.points); // Double pass for extra smoothness
      }

      // Normalize Coordinates: Calculate bounding box and shift points
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;

      node.points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });

      // Shift node position
      node.x += minX;
      node.y += minY;
      node.width = maxX - minX;
      node.height = maxY - minY;

      // Shift points relative to new origin
      node.points = node.points.map(p => ({
        x: p.x - minX,
        y: p.y - minY
      }));

      renderCanvas();
    }
  }
  GripState.isDrawing = false;
  GripState.activeDrawNodeId = null;
  pushToHistory();
}

function smoothPoints(points) {
  if (points.length < 3) return points;
  const smoothed = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];

    const x = (p0.x + p1.x + p2.x) / 3;
    const y = (p0.y + p1.y + p2.y) / 3;
    smoothed.push({ x, y });
  }
  smoothed.push(points[points.length - 1]);
  return smoothed;
}

/**
 * Catmull-Rom spline to SVG path conversion for smooth drawing
 */
function getSvgPathFromStroke(points) {
  if (points.length < 2) return "";
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;

  // Loop through points to create curves
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]; // Previous
    const p1 = points[i];                  // Current
    const p2 = points[i + 1];              // Next
    const p3 = points[Math.min(points.length - 1, i + 2)]; // Next next

    // Catmull-Rom to Cubic Bezier conversion
    // cp1 = p1 + (p2 - p0) / 6
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;

    // cp2 = p2 - (p3 - p1) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return d;
}


// ============================================
// Properties Panel Logic (Enhanced)
// ============================================

function updatePropertiesPanel() {
  const panel = document.getElementById('gripPropertiesPanel');
  if (GripState.selectedNodeIds.size === 0) {
    panel.style.display = 'none';
    panel.style.opacity = '0';
    return;
  }

  // Transition In
  panel.style.display = 'flex';
  requestAnimationFrame(() => panel.style.opacity = '1');

  const node = GripState.nodes.find(n => n.id === [...GripState.selectedNodeIds][0]);
  if (!node) return;

  // CIRCUIT-SPECIFIC PROPERTIES PANEL
  if (node.type === 'circuit') {
    const comp = window.CircuitComponents ? window.CircuitComponents[node.circuitType] : null;
    const compName = comp ? comp.name : node.circuitType;
    const ct = node.circuitType;
    const cs = node.circuitState || {};
    const rotation = node.rotation || 0;

    let controlsHTML = '';

    // Voltage control for batteries/sources
    if (ct === 'battery' || ct === 'dc_source') {
      const voltage = cs.voltage || 5;
      const presets = [1.5, 3.3, 5, 9, 12, 24, 48, 120, 240];
      controlsHTML += `
        <div class="grip-prop-section">
          <div class="grip-prop-header"><span>⚡ Voltage</span><span style="color:var(--circuit-accent)">${voltage}V</span></div>
          <input type="range" class="grip-range-input" min="0.1" max="240" step="0.1" value="${voltage}"
                 oninput="updateCircuitValue('${node.id}', 'voltage', this.value); this.parentElement.querySelector('.grip-prop-header span:last-child').textContent = parseFloat(this.value) + 'V'; renderCanvas();">
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">
            ${presets.map(p => `<button class="grip-prop-btn ${p === voltage ? 'active' : ''}" style="font-size:10px;padding:2px 8px;" 
                onclick="updateCircuitValue('${node.id}', 'voltage', ${p}); updatePropertiesPanel();">${p}V</button>`).join('')}
          </div>
        </div>`;
    }

    // Resistance control for resistors/potentiometers
    if (ct === 'resistor' || ct === 'potentiometer') {
      const resistance = cs.resistance || 1000;
      const formatR = (r) => r >= 1000000 ? (r/1000000).toFixed(1) + 'MΩ' : r >= 1000 ? (r/1000).toFixed(1) + 'kΩ' : r + 'Ω';
      const presets = [100, 220, 470, 1000, 2200, 4700, 10000, 47000, 100000, 1000000];
      controlsHTML += `
        <div class="grip-prop-section">
          <div class="grip-prop-header"><span>🔧 Resistance</span><span style="color:var(--circuit-accent)">${formatR(resistance)}</span></div>
          <input type="range" class="grip-range-input" min="1" max="1000000" step="1" value="${resistance}"
                 oninput="updateCircuitValue('${node.id}', 'resistance', this.value); updatePropertiesPanel();">
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">
            ${presets.map(p => `<button class="grip-prop-btn ${p === resistance ? 'active' : ''}" style="font-size:10px;padding:2px 8px;" 
                onclick="updateCircuitValue('${node.id}', 'resistance', ${p}); updatePropertiesPanel();">${formatR(p)}</button>`).join('')}
          </div>
        </div>`;
    }

    // Switch toggle
    if (['switch_spst', 'switch_spdt', 'pushbutton'].includes(ct)) {
      const isOn = ct === 'switch_spdt' ? cs.switchPosition === 'nc' : !!cs.switchClosed;
      controlsHTML += `
        <div class="grip-prop-section">
          <div class="grip-prop-header"><span>🔀 Switch</span><span style="color:${isOn ? 'var(--circuit-accent)' : 'var(--circuit-label)'}">${isOn ? 'ON' : 'OFF'}</span></div>
          <button class="grip-prop-btn ${isOn ? 'active' : ''}" style="width:100%" onclick="toggleCircuitSwitch('${node.id}'); updatePropertiesPanel();">
            Toggle ${isOn ? 'OFF' : 'ON'}
          </button>
        </div>`;
    }

    // Logic input toggle
    if (ct === 'logic_input') {
      const val = cs.logicValue ? 1 : 0;
      controlsHTML += `
        <div class="grip-prop-section">
          <div class="grip-prop-header"><span>🔲 Logic Value</span><span style="color:var(--circuit-accent);font-family:monospace;font-weight:800;">${val}</span></div>
          <button class="grip-prop-btn ${val ? 'active' : ''}" style="width:100%" onclick="toggleCircuitSwitch('${node.id}'); updatePropertiesPanel();">
            Set to ${val ? '0' : '1'}
          </button>
        </div>`;
    }

    // Rotation control
    controlsHTML += `
      <div class="grip-prop-section">
        <div class="grip-prop-header"><span>🔄 Rotation</span><span style="color:#fff">${rotation}°</span></div>
        <div class="grip-row-btns">
          <button class="grip-prop-btn ${rotation === 0 ? 'active' : ''}" onclick="setCircuitRotation('${node.id}', 0)">0°</button>
          <button class="grip-prop-btn ${rotation === 90 ? 'active' : ''}" onclick="setCircuitRotation('${node.id}', 90)">90°</button>
          <button class="grip-prop-btn ${rotation === 180 ? 'active' : ''}" onclick="setCircuitRotation('${node.id}', 180)">180°</button>
          <button class="grip-prop-btn ${rotation === 270 ? 'active' : ''}" onclick="setCircuitRotation('${node.id}', 270)">270°</button>
        </div>
      </div>`;

    // Label editor
    controlsHTML += `
      <div class="grip-prop-section">
        <div class="grip-prop-header"><span>🏷️ Label</span></div>
        <input type="text" class="grip-label-input" value="${node.labelText || ''}" placeholder="Component label..."
               oninput="updateCircuitLabel('${node.id}', this.value)"
               style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:6px 10px;color:var(--circuit-accent);font-size:12px;outline:none;font-family:inherit;">
      </div>`;

    // Pin connection summary
    const pins = node.pins || (comp ? comp.pins : []);
    if (pins.length > 0) {
      const pinSummaries = pins.map(pin => {
        const summary = window.getCircuitPinConnectionSummary ? window.getCircuitPinConnectionSummary(node.id, pin.id) : '';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;font-size:10px;">
          <span style="color:var(--circuit-label);opacity:0.7;">${pin.label || pin.id}</span>
          <span style="color:${summary ? 'var(--circuit-accent)' : 'rgba(255,255,255,0.3)'};font-size:9px;">${summary || 'not connected'}</span>
        </div>`;
      }).join('');
      controlsHTML += `
        <div class="grip-prop-section">
          <div class="grip-prop-header"><span>📌 Connections</span></div>
          ${pinSummaries}
        </div>`;
    }

    panel.innerHTML = `
      <div class="grip-prop-section" style="border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:10px;margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;">${ct.includes('gate') ? '🔲' : ct.includes('switch') || ct.includes('push') ? '🔀' : ct.includes('battery') || ct.includes('source') ? '🔋' : ct.includes('resistor') || ct.includes('pot') ? '⚡' : ct === 'bulb' ? '💡' : '🔌'}</span>
          <div>
            <div style="color:var(--circuit-accent);font-weight:600;font-size:13px;">${compName}</div>
            <div style="color:var(--circuit-label);opacity:0.5;font-size:10px;">${ct}</div>
          </div>
        </div>
      </div>
      ${controlsHTML}
      <button class="grip-prop-btn danger" style="width:100%; margin-top:8px;" onclick="deleteNode('${node.id}')">Delete Component</button>
    `;
    return;
  }

  // DEFAULT PROPERTIES PANEL (non-circuit nodes)
  const s = node.style || {};
  const strokeWidth = s.strokeWidth || 2;
  const opacity = s.opacity !== undefined ? s.opacity : 1;
  const fontSize = s.fontSize || 24;

  // Helper to render color grid with 'active' check
  const renderColors = (colors, type) => colors.map(c => {
    const isActive = (type === 'stroke' && (s.stroke === c || (!s.stroke && c === '#000000'))) ||
      (type === 'background' && (s.background === c));
    // Special check for transparent/none
    const style = c === 'transparent' ? 'background:transparent; border:1px solid #555;' : `background:${c}`;
    return `<div class="grip-color-swatch ${isActive ? 'active' : ''}" style="${style}" 
                 onclick="updateNodeStyle('${node.id}', '${type}', '${c}')" title="${c}"></div>`;
  }).join('');

  panel.innerHTML = `
      <div class="grip-prop-section">
         <div class="grip-prop-header">Stroke Color</div>
         <div class="grip-color-picker">
            ${renderColors(['var(--foreground)', '#ff6b6b', '#51cf66', '#339af0', '#fcc419', '#845ef7', '#000000', 'transparent'], 'stroke')}
         </div>
      </div>
      
      <div class="grip-prop-section">
         <div class="grip-prop-header">Background</div>
         <div class="grip-color-picker">
            ${renderColors(['transparent', '#191919', '#ffffff', '#ffcccc', '#ccffcc', '#cceeff', '#25262b', '#2C2E33'], 'background')}
         </div>
      </div>
      
      <div class="grip-prop-section">
         <div class="grip-prop-header">
            <span>Stroke Width</span>
            <span style="color:#fff">${strokeWidth}px</span>
         </div>
         <input type="range" class="grip-range-input" min="1" max="10" value="${strokeWidth}" 
                oninput="updateNodeStyle('${node.id}', 'strokeWidth', this.value); this.previousElementSibling.children[1].textContent = this.value + 'px'">
      </div>

       <div class="grip-prop-section">
         <div class="grip-prop-header">
            <span>Font Size</span>
            <span style="color:#fff">${fontSize}px</span>
         </div>
         <input type="range" class="grip-range-input" min="12" max="72" step="4" value="${fontSize}" 
                oninput="updateNodeStyle('${node.id}', 'fontSize', this.value); this.previousElementSibling.children[1].textContent = this.value + 'px'">
      </div>
      
      <div class="grip-prop-section">
         <div class="grip-prop-header">
            <span>Opacity</span>
            <span style="color:#fff">${Math.round(opacity * 100)}%</span>
         </div>
         <input type="range" class="grip-range-input" min="0.1" max="1" step="0.1" value="${opacity}" 
                oninput="updateNodeStyle('${node.id}', 'opacity', this.value); this.previousElementSibling.children[1].textContent = Math.round(this.value*100) + '%'">
      </div>

      <div class="grip-prop-section">
         <div class="grip-prop-header">Ordering</div>
         <div class="grip-row-btns">
            <button class="grip-prop-btn" onclick="bringToFront('${node.id}')">Front</button>
            <button class="grip-prop-btn" onclick="sendToBack('${node.id}')">Back</button>
         </div>
      </div>
      
      <button class="grip-prop-btn danger" style="width:100%; margin-top:8px;" onclick="deleteNode('${node.id}')">Delete Node</button>
  `;
}

// Helper functions for circuit properties panel
function setCircuitRotation(nodeId, degrees) {
  const node = GripState.nodes.find(n => n.id === nodeId);
  if (!node || node.type !== 'circuit') return;
  
  node.rotation = degrees;
  
  // Recalculate pin positions
  const comp = window.CircuitComponents ? window.CircuitComponents[node.circuitType] : null;
  if (comp && node.pins) {
    const cx = node.width / 2;
    const cy = node.height / 2;
    node.pins = node.pins.map((pin, i) => {
      const origPin = comp.pins[i];
      const rad = (degrees * Math.PI) / 180;
      const dx = origPin.x - cx;
      const dy = origPin.y - cy;
      return {
        ...pin,
        x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
        y: cy + dx * Math.sin(rad) + dy * Math.cos(rad)
      };
    });
  }
  
  pushToHistory();
  saveGripDataInstant();
  renderCanvas();
  updatePropertiesPanel();
}

function updateCircuitLabel(nodeId, label) {
  const node = GripState.nodes.find(n => n.id === nodeId);
  if (!node) return;
  node.labelText = label;
  saveGripDataInstant();
  renderCanvas();
}

function updateNodeStyle(id, prop, value) {
  const node = GripState.nodes.find(n => n.id === id);
  if (node) {
    if (!node.style) node.style = {};
    if (prop === 'background') {
      if (value === 'transparent') node.style.background = 'transparent';
      else node.style.background = value;
    }
    if (prop === 'stroke') {
      node.style.borderColor = value;
      node.style.color = value;
      if (node.type === 'draw') node.style.stroke = value;
    }
    if (prop === 'strokeWidth') {
      node.style.strokeWidth = parseInt(value, 10);
      node.style.borderWidth = value + 'px';
    }
    if (prop === 'fontSize') {
      node.style.fontSize = parseInt(value, 10);
    }
    if (prop === 'opacity') {
      node.style.opacity = parseFloat(value);
    }

    saveGripDataInstant(); // INSTANT SAVE for style changes
    renderCanvas();
  }
}

// ... (sendToBack, bringToFront remain generic)

function updateNodeText(id, text) {
  const node = GripState.nodes.find(n => n.id === id);
  if (node) {
    node.text = text;

    // Auto-resize logic (Basic)
    // If it's a text tool, extend width/height to fit?
    // For now, simpler handling: rely on user to resize or add auto-measure later
    // Real Excalidraw measures text metrics canvas.measureText...

    saveGripData();
  }
}

function toggleNodeNote(id) {
  if (GripState.editingNoteId === id) {
    GripState.editingNoteId = null;
  } else {
    GripState.editingNoteId = id;
  }
  renderCanvas();
}

function updateNodeNote(id, note) {
  const node = GripState.nodes.find(n => n.id === id);
  if (node) {
    node.note = note;
    // Don't save on every keystroke if very frequent, but for now simple
    saveGripData();
  }
}


function deleteSelectedNodes() {
  const ids = GripState.selectedNodeIds;
  GripState.nodes = GripState.nodes.filter(n => !ids.has(n.id));
  GripState.edges = GripState.edges.filter(e => !ids.has(e.from) && !ids.has(e.to));
  GripState.selectedNodeIds.clear();
  pushToHistory();
  renderCanvas();

  // INSTANT SAVE for node deletion
  saveGripDataInstant();
}

function deleteNode(id) {
  GripState.nodes = GripState.nodes.filter(n => n.id !== id);
  GripState.edges = GripState.edges.filter(e => e.from !== id && e.to !== id);
  
  // Update circuit pin signals when nodes/connections change
  if (typeof updateAllPinSignals === 'function') {
    updateAllPinSignals();
  }
  
  renderCanvas();

  // Broadcast node deletion to other users
  broadcastNodeOperation('delete', id);

  // INSTANT SAVE for single node deletion
  saveGripDataInstant();
}

function setTool(tool) {
  GripState.activeTool = tool;
  document.querySelectorAll('.grip-tool-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === tool);
  });
}

function zoomIn() {
  GripState.scale = Math.min(GripState.scale * 1.2, GripState.MAX_SCALE);
  updateZoomDisplay();
  renderCanvasTransform();
  saveGripData(); // Save zoom changes
}

function zoomOut() {
  GripState.scale = Math.max(GripState.scale / 1.2, GripState.MIN_SCALE);
  updateZoomDisplay();
  renderCanvasTransform();
  saveGripData(); // Save zoom changes
}

function updateZoomDisplay() {
  document.getElementById('gripZoomVal').textContent = Math.round(GripState.scale * 100) + '%';
}


// ============================================
// Render Helpers
// ============================================

function renderCanvasTransform() {
  const layer = document.getElementById('gripTransformLayer');
  if (layer) {
    layer.style.transform = `translate(${GripState.offsetX}px, ${GripState.offsetY}px) scale(${GripState.scale})`;
  }
  // Also update grid background position if we want parallax effect (omitted for clean look)
}

function renderCanvas() {
  const layer = document.getElementById('gripTransformLayer');
  if (!layer) return;

  renderCanvasTransform();

  let html = '';

  // Render Edges (SVG Layer)
  html += `<svg class="grip-edges-layer" style="width: 10000px; height: 10000px; position: absolute; top: -5000px; left: -5000px; pointer-events: none; overflow: visible;">
    <defs>
      <marker id="arrowhead" markerWidth="14" markerHeight="14" refX="2" refY="6" markerUnits="userSpaceOnUse" orient="auto">
         <path d="M0,1 L12,6 L0,11 Z" fill="var(--wb-text)" />
      </marker>
    </defs>`;

  GripState.edges.forEach(edge => {
    const fromNode = GripState.nodes.find(n => n.id === edge.from);
    const toNode = GripState.nodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode) return;

    const isCircuitWire = fromNode.type === 'circuit' || toNode.type === 'circuit';

    // Offset for the SVG coordination system
    const ox = 5000;
    const oy = 5000;

    if (isCircuitWire) {
      const startHandleId = edge.fromHandle || 'right';
      const endHandleId = edge.toHandle || 'left';

      const p1 = getNodeHandlePos(fromNode, startHandleId);
      const p2 = getNodeHandlePos(toNode, endHandleId);

      const startDir = getConnectionDirection(fromNode, startHandleId, p1);
      const endDir = getConnectionDirection(toNode, endHandleId, p2);

      const wirePath = getOrthogonalWirePath(p1.x + ox, p1.y + oy, p2.x + ox, p2.y + oy, startDir, endDir);
      html += `<path d="${wirePath}" stroke="var(--circuit-wire)" stroke-opacity="1" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
      return;
    }

    // Resolve Handles (Fully Dynamic "Closest" Behavior)
    const { startHandle, endHandle } = getDynamicConnectionHandles(fromNode, toNode);

    let p1 = getNodeHandlePos(fromNode, startHandle);
    let p2 = getNodeHandlePos(toNode, endHandle);

    // Apply Margin/Gap (Offset points away from node)
    // Gap should be slightly MORE than arrow length + desired visual space
    // Arrow length is 12px (approx). refX is 2 (so it overlaps 2px).
    // Effective extension = 10px.
    // If we want ~8px gap: 10 + 8 = 18px gap needed.
    // Let's use 20px gap for a clear separation.
    const gap = 20;

    if (startHandle === 'top') p1.y -= gap;
    if (startHandle === 'bottom') p1.y += gap;
    if (startHandle === 'left') p1.x -= gap;
    if (startHandle === 'right') p1.x += gap;

    if (endHandle === 'top') p2.y -= gap;
    if (endHandle === 'bottom') p2.y += gap;
    if (endHandle === 'left') p2.x -= gap;
    if (endHandle === 'right') p2.x += gap;

    const pathD = getSmartPath(p1.x + ox, p1.y + oy, p2.x + ox, p2.y + oy, startHandle, endHandle);
    const strokeColor = 'var(--wb-text)';

    // Increased opacity for better look
    html += `<path d="${pathD}" stroke="${strokeColor}" stroke-opacity="1" stroke-width="2" fill="none" marker-end="url(#arrowhead)" />`;
  });
  html += `</svg>`;

  // Render Nodes (Drawings first, then circuit, then other nodes)
  const drawNodes = GripState.nodes.filter(n => n.type === 'draw');
  const circuitNodes = GripState.nodes.filter(n => n.type === 'circuit');
  const otherNodes = GripState.nodes.filter(n => n.type !== 'draw' && n.type !== 'circuit');

  drawNodes.forEach(node => {
    const isSelected = GripState.selectedNodeIds.has(node.id);
    html += renderNodeHTML(node, isSelected);
  });

  circuitNodes.forEach(node => {
    const isSelected = GripState.selectedNodeIds.has(node.id);
    html += (typeof renderCircuitNodeHTML === 'function') ? renderCircuitNodeHTML(node, isSelected) : renderNodeHTML(node, isSelected);
  });

  otherNodes.forEach(node => {
    const isSelected = GripState.selectedNodeIds.has(node.id);
    html += renderNodeHTML(node, isSelected);
  });

  layer.innerHTML = html;

  // Attach circuit pin event listeners
  if (circuitNodes.length > 0) {
    document.querySelectorAll('.circuit-pin').forEach(pin => {
      pin.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const nodeId = pin.dataset.nodeId;
        const pinId = pin.dataset.pinId;
        if (typeof handleCircuitPinClick === 'function') {
          handleCircuitPinClick(nodeId, pinId, e);
        }
      });

      pin.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const nodeId = pin.dataset.nodeId;
        const pinId = pin.dataset.pinId;
        if (typeof disconnectCircuitPin === 'function') {
          disconnectCircuitPin(nodeId, pinId);
        }
      });
    });
    
    // Update pin signals after DOM is ready
    if (typeof updateAllPinSignals === 'function') {
      updateAllPinSignals();
    }
  }
}

/** 
 * Helper to determine best connection handles dynamically 
 */
function getDynamicConnectionHandles(fromNode, toNode) {
  const c1 = { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 };
  const c2 = { x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 };

  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  let startHandle = 'right';
  let endHandle = 'left';

  if (absDx > absDy) {
    startHandle = dx > 0 ? 'right' : 'left';
    endHandle = dx > 0 ? 'left' : 'right';
  } else {
    startHandle = dy > 0 ? 'bottom' : 'top';
    endHandle = dy > 0 ? 'top' : 'bottom';
  }
  return { startHandle, endHandle };
}

/**
 * Calculates a smooth Cubic Bezier path based on handle directions
 */
function getSmartPath(x1, y1, x2, y2, startDir, endDir) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const controlDist = Math.max(dist * 0.5, 50);

  let cp1x = x1, cp1y = y1;
  let cp2x = x2, cp2y = y2;

  // Adjust Control Point 1 based on Start Direction
  switch (startDir) {
    case 'left': cp1x -= controlDist; break;
    case 'right': cp1x += controlDist; break;
    case 'top': cp1y -= controlDist; break;
    case 'bottom': cp1y += controlDist; break;
  }

  // Adjust Control Point 2 based on End Direction
  switch (endDir) {
    case 'left': cp2x -= controlDist; break;
    case 'right': cp2x += controlDist; break;
    case 'top': cp2y -= controlDist; break;
    case 'bottom': cp2y += controlDist; break;
  }

  return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
}

function getConnectionDirection(node, handleId, handlePos) {
  if (handleId === 'top' || handleId === 'right' || handleId === 'bottom' || handleId === 'left') {
    return handleId;
  }

  // For circuit pins (or unknown handle ids), infer direction from position relative to node bounds.
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const dx = handlePos.x - cx;
  const dy = handlePos.y - cy;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'bottom' : 'top';
}

function getOrthogonalWirePath(x1, y1, x2, y2, startDir, endDir) {
  const stub = 30; // Increased stub for cleaner routing away from components

  const s1 = offsetPoint(x1, y1, startDir, stub);
  const e1 = offsetPoint(x2, y2, endDir, stub);

  // Collect all circuit node bounding boxes (for obstacle avoidance)
  const obstacles = [];
  const padding = 15;
  GripState.nodes.forEach(n => {
    if (n.type !== 'circuit') return;
    obstacles.push({
      left: n.x - padding + 5000, // offset for SVG coordinate system
      top: n.y - padding + 5000,
      right: n.x + n.width + padding + 5000,
      bottom: n.y + n.height + padding + 5000
    });
  });

  const dx = e1.x - s1.x;
  const dy = e1.y - s1.y;

  // Check if the simple Manhattan path would intersect any obstacle
  let m1, m2;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const midX = s1.x + dx / 2;
    m1 = { x: midX, y: s1.y };
    m2 = { x: midX, y: e1.y };
  } else {
    const midY = s1.y + dy / 2;
    m1 = { x: s1.x, y: midY };
    m2 = { x: e1.x, y: midY };
  }

  // Check if any segment intersects an obstacle
  const segments = [
    [s1, m1], [m1, m2], [m2, e1]
  ];

  let hasCollision = false;
  for (const obs of obstacles) {
    for (const [segStart, segEnd] of segments) {
      if (segmentIntersectsRect(segStart, segEnd, obs)) {
        hasCollision = true;
        break;
      }
    }
    if (hasCollision) break;
  }

  if (!hasCollision) {
    return `M ${x1} ${y1} L ${s1.x} ${s1.y} L ${m1.x} ${m1.y} L ${m2.x} ${m2.y} L ${e1.x} ${e1.y} L ${x2} ${y2}`;
  }

  // Route around obstacles: use a wider detour
  const detourPadding = 40;
  
  // Find the bounding box of all obstacles between start and end
  const minX = Math.min(s1.x, e1.x);
  const maxX = Math.max(s1.x, e1.x);
  const minY = Math.min(s1.y, e1.y);
  const maxY = Math.max(s1.y, e1.y);
  
  // Find obstacles in the path region
  let routeTop = Infinity, routeBottom = -Infinity;
  let routeLeft = Infinity, routeRight = -Infinity;
  for (const obs of obstacles) {
    if (obs.right >= minX && obs.left <= maxX && obs.bottom >= minY && obs.top <= maxY) {
      routeTop = Math.min(routeTop, obs.top);
      routeBottom = Math.max(routeBottom, obs.bottom);
      routeLeft = Math.min(routeLeft, obs.left);
      routeRight = Math.max(routeRight, obs.right);
    }
  }

  if (routeTop === Infinity) {
    // No obstacles in path region, use simple path
    return `M ${x1} ${y1} L ${s1.x} ${s1.y} L ${m1.x} ${m1.y} L ${m2.x} ${m2.y} L ${e1.x} ${e1.y} L ${x2} ${y2}`;
  }

  // Decide whether to route above or below (pick shorter detour)
  const distTop = Math.abs(s1.y - (routeTop - detourPadding)) + Math.abs(e1.y - (routeTop - detourPadding));
  const distBottom = Math.abs(s1.y - (routeBottom + detourPadding)) + Math.abs(e1.y - (routeBottom + detourPadding));
  
  const detourY = distTop <= distBottom ? routeTop - detourPadding : routeBottom + detourPadding;
  
  // Create a 5-segment detour path
  const w1 = { x: s1.x, y: detourY };
  const w2 = { x: e1.x, y: detourY };
  
  return `M ${x1} ${y1} L ${s1.x} ${s1.y} L ${w1.x} ${w1.y} L ${w2.x} ${w2.y} L ${e1.x} ${e1.y} L ${x2} ${y2}`;
}

// Check if a line segment intersects a rectangle
function segmentIntersectsRect(p1, p2, rect) {
  // Check if a horizontal or vertical segment passes through the rect
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);
  
  // No overlap at all
  if (maxX < rect.left || minX > rect.right || maxY < rect.top || minY > rect.bottom) return false;
  
  // Horizontal segment
  if (Math.abs(p1.y - p2.y) < 1) {
    return p1.y >= rect.top && p1.y <= rect.bottom && maxX >= rect.left && minX <= rect.right;
  }
  // Vertical segment
  if (Math.abs(p1.x - p2.x) < 1) {
    return p1.x >= rect.left && p1.x <= rect.right && maxY >= rect.top && minY <= rect.bottom;
  }
  
  // Diagonal (shouldn't happen in orthogonal routing but check anyway)
  return true;
}

function offsetPoint(x, y, dir, amount) {
  if (dir === 'left') return { x: x - amount, y };
  if (dir === 'right') return { x: x + amount, y };
  if (dir === 'top') return { x, y: y - amount };
  if (dir === 'bottom') return { x, y: y + amount };
  return { x, y };
}

// Calculate the actual bounding box for a node (especially important for free drawing)
function getNodeBoundingBox(node) {
  if (node.type === 'draw' && node.points && node.points.length > 0) {
    // For free drawing, calculate bounds from all points
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    node.points.forEach(point => {
      const absX = node.x + point.x;
      const absY = node.y + point.y;
      minX = Math.min(minX, absX);
      minY = Math.min(minY, absY);
      maxX = Math.max(maxX, absX);
      maxY = Math.max(maxY, absY);
    });

    // Add some padding for stroke width
    const padding = (node.style?.strokeWidth || 3) / 2;
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2
    };
  } else {
    // For regular nodes, use the stored dimensions
    return {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height
    };
  }
}

function renderNodeHTML(node, isSelected) {
  const style = node.style || {};
  const opacity = style.opacity !== undefined ? style.opacity : 1;

  if (node.type === 'draw') {
    const stroke = style.stroke || 'var(--foreground)';
    const width = style.strokeWidth || 3;
    // Use smoothed path
    const pathD = getSvgPathFromStroke(node.points);

    // Fix for visibility during drawing: if width/height are 0, use overflow visible and don't constrain
    const w = node.width || 1;
    const h = node.height || 1;
    const isDrawing = !node.width && !node.height;

    return `
       <div class="grip-node grip-node-draw ${isSelected ? 'selected' : ''}"
          style="transform: translate(${node.x}px, ${node.y}px); width: ${w}px; height: ${h}px; pointer-events: none; opacity: ${opacity}; overflow: visible;" data-id="${node.id}">
          <svg style="overflow:visible; width:100%; height:100%;"><path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/></svg>
       </div>
     `;
  }

  const typeClass = getNodeClass(node.type);
  const selectedClass = isSelected ? 'selected' : '';
  const inlineStyle = [`opacity: ${opacity}`];

  if (style.background) inlineStyle.push(`background: ${style.background}`);
  if (style.borderColor) inlineStyle.push(`border-color: ${style.borderColor}`);
  if (style.color) inlineStyle.push(`color: ${style.color}`);
  if (style.strokeWidth) inlineStyle.push(`border-width: ${style.strokeWidth}px`);
  if (style.fontSize) inlineStyle.push(`font-size: ${style.fontSize}px`);

  const notePopup = node.id === GripState.editingNoteId ? `
     <div class="grip-node-note-popup" onmousedown="event.stopPropagation()">
        <label style="font-size:12px; color:#aaa; margin-bottom:4px;">Note</label>
        <textarea oninput="updateNodeNote('${node.id}', this.value)">${node.note || ''}</textarea>
        <button class="grip-prop-btn" style="width:100%" onclick="GripState.editingNoteId = null; renderCanvas();">Close</button>
     </div>
  ` : '';

  const toolbar = `
     <div class="grip-node-toolbar">
        <div class="grip-action-btn drag-handle" title="Move" data-node-id="${node.id}">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M19 9l3 3-3 3M9 19l3 3 3-3M2 12h20M12 2v20"/></svg>
        </div>
        <div class="grip-action-btn note-btn" title="Add Note" onclick="toggleNodeNote('${node.id}')" data-node-id="${node.id}">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </div>
        <div class="grip-action-btn delete" title="Delete" onclick="deleteNode('${node.id}')" data-node-id="${node.id}">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </div>
     </div>
  `;

  return `
    <div class="grip-node ${typeClass} ${selectedClass}" 
         style="transform: translate(${node.x}px, ${node.y}px); width: ${node.width}px; height: ${node.height}px; ${inlineStyle.join(';')}"
         data-id="${node.id}">
       
       <div class="grip-node-content" contenteditable="true" onblur="updateNodeText('${node.id}', this.innerText)">${node.text || ''}</div>
       
       ${isSelected ? toolbar : ''}
       ${isSelected ? notePopup : ''}
       
       ${isSelected ? renderResizeHandles(node.id) : ''}
       ${renderConnectHandles(node.id)}
       ${node.note ? `<div style="position:absolute; top:-5px; right:-5px; width:10px; height:10px; background:#fcc419; border-radius:50%; border:1px solid #000;" title="Has note"></div>` : ''}
    </div>
  `;
}

function getNodeClass(type) {
  if (type === 'pill') return 'shape-pill';
  if (type === 'header') return 'shape-header';
  if (type === 'card') return 'card-default';
  if (type === 'shape:rectangle') return 'shape-rect';
  if (type === 'shape:diamond') return 'shape-diamond';
  if (type === 'shape:ellipse') return 'shape-ellipse';
  if (type === 'text') return 'shape-text';
  if (type === 'sticky') return 'shape-sticky';
  if (type === 'circuit') return 'circuit-node';
  return 'card-default'; // Fallback
}

function renderResizeHandles(id) {
  return `
    <div class="grip-resize-handle nw" data-node-id="${id}" data-handle="nw"></div>
    <div class="grip-resize-handle ne" data-node-id="${id}" data-handle="ne"></div>
    <div class="grip-resize-handle sw" data-node-id="${id}" data-handle="sw"></div>
    <div class="grip-resize-handle se" data-node-id="${id}" data-handle="se"></div>
  `;
}

function renderConnectHandles(nodeId) {
  // Positions: top, right, bottom, left
  const handles = ['top', 'right', 'bottom', 'left'];

  return handles.map(h => {
    // Check if connected using dynamic logic
    const isConnected = GripState.edges.some(e => {
      if (e.from === nodeId || e.to === nodeId) {
        const otherId = e.from === nodeId ? e.to : e.from;
        const otherNode = GripState.nodes.find(n => n.id === otherId);
        const thisNode = GripState.nodes.find(n => n.id === nodeId);

        if (otherNode && thisNode) {
          const { startHandle, endHandle } = getDynamicConnectionHandles(
            e.from === nodeId ? thisNode : otherNode,
            e.to === nodeId ? thisNode : otherNode
          );

          if (e.from === nodeId) return startHandle === h;
          else return endHandle === h;
        }
      }
      return false;
    });

    const connectedClass = isConnected ? 'connected' : '';
    const title = isConnected ? 'Double-click to disconnect' : 'Drag to connect';

    return `<div class="grip-handle-connect ${h} ${connectedClass}"
               data-node-id="${nodeId}"
               data-position="${h}"
               title="${title}"
               ondblclick="disconnectNodeHandle('${nodeId}', '${h}', event)"></div>`;
  }).join('');
}

function disconnectNodeHandle(nodeId, handle, event) {
  if (event) event.stopPropagation();

  // Remove edges connected to this specific handle (visually)
  const initialCount = GripState.edges.length;
  GripState.edges = GripState.edges.filter(e => {
    // Check if this edge involves our node
    if (e.from === nodeId || e.to === nodeId) {
      const fromNode = GripState.nodes.find(n => n.id === e.from);
      const toNode = GripState.nodes.find(n => n.id === e.to);

      if (fromNode && toNode) {
        // Calculate where the line is ACTUALLY drawing
        const { startHandle, endHandle } = getDynamicConnectionHandles(fromNode, toNode);

        // Check if it hits the handle we clicked
        if (e.from === nodeId && startHandle === handle) return false; // Remove
        if (e.to === nodeId && endHandle === handle) return false; // Remove
      }
    }
    return true; // Keep others
  });

  if (GripState.edges.length !== initialCount) {
    pushToHistory();
    renderCanvas();
  }
}

function updateNodeText(id, text) {
  const node = GripState.nodes.find(n => n.id === id);
  if (node) {
    node.text = text;
    saveGripDataInstant(); // INSTANT SAVE for text changes
    // Broadcast node update to other users
    broadcastNodeOperation('update', id, { text });
  }
}

function findNearestCircuitPin(node, worldPos) {
  if (node.type !== 'circuit') return null;
  const comp = CircuitComponents[node.circuitType];
  const pins = node.pins || (comp ? comp.pins : []);
  if (!pins || pins.length === 0) return null;
  
  let nearestId = pins[0].id;
  let nearestDist = Infinity;
  pins.forEach(pin => {
    const px = node.x + pin.x;
    const py = node.y + pin.y;
    const dist = Math.hypot(worldPos.x - px, worldPos.y - py);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestId = pin.id;
    }
  });
  return nearestId;
}

function getNodeHandlePos(node, handle) {
  // Circuit pin handling
  if (node.type === 'circuit' && typeof getCircuitPinPos === 'function') {
    const pos = getCircuitPinPos(node, handle);
    if (pos) return pos;
    
    // If handle is 'auto' or unknown, find the nearest output pin
    if (handle === 'auto' || handle === 'center') {
      const comp = CircuitComponents[node.circuitType];
      const pins = node.pins || (comp ? comp.pins : []);
      // Default to first pin
      if (pins && pins.length > 0) {
        const defaultPin = pins.find(p => p.id === 'out') || pins[0];
        return { x: node.x + defaultPin.x, y: node.y + defaultPin.y };
      }
    }
  }

  const x = node.x;
  const y = node.y;
  const w = node.width;
  const h = node.height;

  if (handle === 'top') return { x: x + w / 2, y: y };
  if (handle === 'right') return { x: x + w, y: y + h / 2 };
  if (handle === 'bottom') return { x: x + w / 2, y: y + h };
  if (handle === 'left') return { x: x, y: y + h / 2 };

  // Default to center if auto or unknown
  return { x: x + w / 2, y: y + h / 2 };
}

function renderTempConnection() {
  const svg = document.getElementById('gripTempConnection');
  if (!svg || !GripState.connectionStartNodeId) return;

  const node = GripState.nodes.find(n => n.id === GripState.connectionStartNodeId);
  if (!node) return;

  const startPos = getNodeHandlePos(node, GripState.connectionStartHandle);
  const endPos = GripState.tempConnectionEnd;

  // We need to convert world coordinates to screen (or SVG) coordinates for the temp line overlay
  // Actually better to put temp SVG inside transform layer so coords match

  // For now, let's assume the temp SVG is full screen overlay
  const sStart = worldToScreen(startPos.x, startPos.y);
  const sEnd = worldToScreen(endPos.x, endPos.y);

  svg.innerHTML = `<line x1="${sStart.x}" y1="${sStart.y}" x2="${sEnd.x}" y2="${sEnd.y}" stroke="#fff" stroke-width="2" stroke-dasharray="5,5" />`;
}

function renderSelectionBox() {
  const box = document.getElementById('gripSelectionBox');
  if (!box) return;

  const start = GripState.selectionStart;
  const end = GripState.selectionEnd;

  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(start.x - end.x);
  const h = Math.abs(start.y - end.y);

  box.style.display = 'block';
  box.style.left = x + 'px';
  box.style.top = y + 'px';
  box.style.width = w + 'px';
  box.style.height = h + 'px';
}

function commitSelectionBox() {
  const start = GripState.selectionStart;
  const end = GripState.selectionEnd;

  // Convert screen rect to world rect
  const p1 = screenToWorld(start.x, start.y);
  const p2 = screenToWorld(end.x, end.y);

  const x1 = Math.min(p1.x, p2.x);
  const x2 = Math.max(p1.x, p2.x);
  const y1 = Math.min(p1.y, p2.y);
  const y2 = Math.max(p1.y, p2.y);

  GripState.nodes.forEach(node => {
    // Get the actual bounding box for the node
    const bounds = getNodeBoundingBox(node);

    // Check if the selection rectangle intersects with the node's bounding box
    // A node is selected if any part of its bounding box is within the selection
    const intersects = !(bounds.x > x2 || bounds.x + bounds.width < x1 ||
      bounds.y > y2 || bounds.y + bounds.height < y1);

    if (intersects) {
      GripState.selectedNodeIds.add(node.id);
    }
  });
  renderCanvas();
}


/* Export Helpers */
window.openGripDiagram = openGripDiagram;

// ============================================
// Enhanced Realtime Collaboration Functions
// ============================================

let gripRealtimeSubscription = null;
let isApplyingRemoteChange = false;

function subscribeToGripDiagramChanges(projectIndex) {
  const projects = loadProjects();
  const project = projects[projectIndex];

  if (!project || !window.LayerDB?.getCurrentUser?.()) {
    console.log('Cannot subscribe to whiteboard changes: project or user not available');
    return;
  }

  // Unsubscribe from existing subscription
  unsubscribeFromGripDiagramChanges();

  const projectId = project.id;
  GripState.currentProjectId = projectId;
  console.log('🔄 Subscribing to whiteboard collaboration for project:', projectId);

  // Use the enhanced realtime system
  if (window.LayerRealtime) {
    GripState.realtimeSubscription = window.LayerRealtime.subscribeToWhiteboard(projectId, {
      onWhiteboardUpdate: (data) => {
        console.log('📡 Received whiteboard update:', data);
        handleRemoteGripDiagramChange(data.gripDiagram);
      },
      onUserPresenceChange: (data) => {
        console.log('👥 User presence change:', data);
        handleUserPresenceChange(data);
      },
      onCursorUpdate: (data) => {
        handleRemoteCursorUpdate(data);
      },
      onNodeUpdate: (data) => {
        handleRemoteNodeUpdate(data);
      },
      onEdgeUpdate: (data) => {
        handleRemoteEdgeUpdate(data);
      }
    });
  } else {
    // Fallback to basic subscription
    console.warn('LayerRealtime not available, using basic subscription');
    gripRealtimeSubscription = window.supabaseClient
      .channel(`grip_diagram_${projectId}`)
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectId}`
        },
        (payload) => {
          if (isApplyingRemoteChange) {
            console.log('Ignoring self-triggered change');
            return;
          }
          console.log('📡 Received whiteboard update from other user:', payload);
          handleRemoteGripDiagramChange(payload.new.grip_diagram);
        }
      )
      .subscribe((status) => {
        console.log('Whiteboard subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Subscribed to whiteboard realtime updates');
        }
      });
  }
}

function unsubscribeFromGripDiagramChanges() {
  if (gripRealtimeSubscription) {
    console.log('Unsubscribing from whiteboard changes');
    window.supabaseClient.removeChannel(gripRealtimeSubscription);
    gripRealtimeSubscription = null;
  }
}

function handleRemoteGripDiagramChange(updatedProject) {
  if (!updatedProject?.grip_diagram) {
    console.log('No grip diagram data in update');
    return;
  }

  const remoteData = updatedProject.grip_diagram;
  const currentData = {
    nodes: GripState.nodes,
    edges: GripState.edges,
    offsetX: GripState.offsetX,
    offsetY: GripState.offsetY,
    scale: GripState.scale
  };

  // Check if remote data is different from current data
  if (JSON.stringify(remoteData) === JSON.stringify(currentData)) {
    console.log('Remote data is identical to current data, ignoring');
    return;
  }

  console.log('🔄 Applying remote whiteboard changes...');

  // Show remote update notification
  showRemoteUpdateNotification();

  // Prevent feedback loop
  isApplyingRemoteChange = true;

  try {
    // Apply the remote changes
    GripState.nodes = remoteData.nodes || [];
    GripState.edges = remoteData.edges || [];
    GripState.offsetX = remoteData.offsetX || 0;
    GripState.offsetY = remoteData.offsetY || 0;
    GripState.scale = remoteData.scale || 1;

    // Update the local storage
    saveGripData();

    // Re-render the canvas
    renderCanvas();

    console.log('✅ Remote whiteboard changes applied successfully');
  } catch (error) {
    console.error('❌ Failed to apply remote whiteboard changes:', error);
  } finally {
    isApplyingRemoteChange = false;
  }
}

// Clean up subscription when closing the diagram
function closeGripDiagramWithCleanup() {
  unsubscribeFromGripDiagramChanges();

  // Hide calculator if open
  if (window.layerCalculator) {
    const calc = document.getElementById('layerCalculator');
    if (calc) calc.classList.remove('visible');
  }

  // Original closeGripDiagram logic
  saveGripData();
  const overlay = document.getElementById('gripDiagramOverlay');
  if (overlay) overlay.remove();
}

// Override the closeGripDiagram function
window.closeGripDiagram = closeGripDiagramWithCleanup;

// ============================================
// Realtime Collaboration Handlers
// ============================================

function handleUserPresenceChange(data) {
  const { presence, eventType } = data;
  const currentUser = window.LayerDB?.getCurrentUser();

  if (!currentUser || presence.user_id === currentUser.id) {
    return; // Ignore own presence changes
  }

  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    // Add or update active user
    GripState.activeUsers.set(presence.user_id, {
      name: presence.profiles?.name || presence.profiles?.email?.split('@')[0] || 'User',
      avatar: presence.profiles?.avatar_url,
      lastSeen: new Date(presence.last_seen)
    });
  } else if (eventType === 'DELETE') {
    // Remove active user
    GripState.activeUsers.delete(presence.user_id);
  }

  // Update active users display
  renderActiveUsers();
}

function handleRemoteCursorUpdate(data) {
  const currentUser = window.LayerDB?.getCurrentUser();

  if (!currentUser || data.userId === currentUser.id) {
    return; // Ignore own cursor updates
  }

  // Update cursor position for this user
  const userData = GripState.activeUsers.get(data.userId) || {};
  userData.cursor = data.cursor;
  userData.selection = data.selection;
  userData.lastSeen = data.timestamp;

  GripState.activeUsers.set(data.userId, userData);

  // Render remote cursors
  renderRemoteCursors();
}

function handleRemoteNodeUpdate(data) {
  const currentUser = window.LayerDB?.getCurrentUser();

  if (!currentUser || data.userId === currentUser.id) {
    return; // Ignore own updates
  }

  console.log('🔄 Remote node update:', data.operation, data.nodeId);

  isApplyingRemoteChange = true;

  try {
    switch (data.operation) {
      case 'add':
        // Add new node
        if (data.nodeData) {
          GripState.nodes.push(data.nodeData);
        }
        break;

      case 'update':
        // Update existing node
        const nodeIndex = GripState.nodes.findIndex(n => n.id === data.nodeId);
        if (nodeIndex !== -1 && data.nodeData) {
          GripState.nodes[nodeIndex] = { ...GripState.nodes[nodeIndex], ...data.nodeData };
        }
        break;

      case 'delete':
        // Delete node
        GripState.nodes = GripState.nodes.filter(n => n.id !== data.nodeId);
        break;

      case 'move':
        // Move node
        const moveNode = GripState.nodes.find(n => n.id === data.nodeId);
        if (moveNode && data.nodeData) {
          moveNode.x = data.nodeData.x;
          moveNode.y = data.nodeData.y;
        }
        break;
    }

    // Update local storage and render
    saveGripData();
    renderCanvas();

    // Show notification for non-move operations
    if (data.operation !== 'move') {
      showRemoteActionNotification(`${data.userName} ${data.operation}ed a node`);
    }
  } catch (error) {
    console.error('Error handling remote node update:', error);
  } finally {
    isApplyingRemoteChange = false;
  }
}

function handleRemoteEdgeUpdate(data) {
  const currentUser = window.LayerDB?.getCurrentUser();

  if (!currentUser || data.userId === currentUser.id) {
    return; // Ignore own updates
  }

  console.log('🔄 Remote edge update:', data.operation, data.edgeId);

  isApplyingRemoteChange = true;

  try {
    switch (data.operation) {
      case 'add':
        // Add new edge
        if (data.edgeData) {
          GripState.edges.push(data.edgeData);
        }
        break;

      case 'update':
        // Update existing edge
        const edgeIndex = GripState.edges.findIndex(e => e.id === data.edgeId);
        if (edgeIndex !== -1 && data.edgeData) {
          GripState.edges[edgeIndex] = { ...GripState.edges[edgeIndex], ...data.edgeData };
        }
        break;

      case 'delete':
        // Delete edge
        GripState.edges = GripState.edges.filter(e => e.id !== data.edgeId);
        break;
    }

    // Update local storage and render
    saveGripData();
    renderCanvas();

    // Show notification
    showRemoteActionNotification(`${data.userName} ${data.operation}ed a connection`);
  } catch (error) {
    console.error('Error handling remote edge update:', error);
  } finally {
    isApplyingRemoteChange = false;
  }
}

// ============================================
// Realtime Broadcasting Functions
// ============================================

function broadcastCursorPosition(mouseX, mouseY) {
  if (!GripState.currentProjectId || !window.LayerRealtime) return;

  const now = Date.now();
  if (now - GripState.lastCursorBroadcast < GripState.cursorThrottleDelay) {
    return; // Throttle cursor updates
  }

  GripState.lastCursorBroadcast = now;

  const worldPos = screenToWorld(mouseX, mouseY);
  const selection = Array.from(GripState.selectedNodeIds);

  window.LayerRealtime.broadcastCursorUpdate(
    GripState.currentProjectId,
    worldPos,
    selection.length > 0 ? selection : null
  );
}

function broadcastNodeOperation(operation, nodeId, nodeData = null) {
  if (!GripState.currentProjectId || !window.LayerRealtime) return;

  window.LayerRealtime.broadcastNodeUpdate(
    GripState.currentProjectId,
    operation,
    nodeId,
    nodeData
  );
}

function broadcastEdgeOperation(operation, edgeId, edgeData = null) {
  if (!GripState.currentProjectId || !window.LayerRealtime) return;

  window.LayerRealtime.broadcastEdgeUpdate(
    GripState.currentProjectId,
    operation,
    edgeId,
    edgeData
  );
}

// ============================================
// UI Rendering for Collaboration (Premium)
// ============================================

const COLLAB_COLORS = ['#FFD700', '#00E0FF', '#FF2E9A', '#A3FF00', '#C14CFF', '#FF6B00', '#00F5D4'];
const MAX_VISIBLE_CURSORS = 12;
const LABEL_HIDE_DELAY = 4000;
const cursorLastMoveTime = new Map();
const knownUserIds = new Set();

function getUserColor(userId) {
  if (!userId) return COLLAB_COLORS[1];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length];
}

function triggerClickRipple(x, y, color) {
  const el = document.createElement('div');
  el.className = 'grip-click-ripple';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.setProperty('--ripple-color', color);
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

function spawnConfetti(targetEl, color) {
  const rect = targetEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < 6; i++) {
    const p = document.createElement('div');
    p.className = 'grip-confetti-particle';
    const angle = (Math.PI * 2 * i) / 6;
    const dist = 15 + Math.random() * 10;
    p.style.setProperty('--cx', Math.cos(angle) * dist + 'px');
    p.style.setProperty('--cy', Math.sin(angle) * dist + 'px');
    p.style.background = COLLAB_COLORS[(i + 1) % COLLAB_COLORS.length];
    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    p.style.position = 'fixed';
    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}

function renderActiveUsers() {
  const container = document.getElementById('gripActiveUsers');
  if (!container) return;

  const currentUser = window.LayerDB?.getCurrentUser();
  const activeUsersArray = Array.from(GripState.activeUsers.values())
    .filter(user => user.name && (Date.now() - user.lastSeen < 30000));

  if (activeUsersArray.length === 0) {
    container.innerHTML = '';
    return;
  }

  const MAX_SHOW = 5;
  const visible = activeUsersArray.slice(0, MAX_SHOW);
  const overflow = activeUsersArray.length - MAX_SHOW;

  container.innerHTML = `
    <div class="grip-active-users">
      <div class="grip-active-users-list">
        ${visible.map(user => {
    const isOwn = currentUser && user.id === currentUser.id;
    const color = getUserColor(user.id);
    const isNew = !knownUserIds.has(user.id);
    const status = user.cursor ? 'Drawing' : 'Idle';
    return `
            <div class="grip-active-user ${isOwn ? 'is-own' : ''} ${isNew ? 'pop-in' : ''}"
                 style="--user-color: ${color};" data-user-id="${user.id}">
              ${user.avatar
        ? `<img src="${user.avatar}" class="grip-active-user-avatar" alt="${user.name}" />`
        : `<div class="grip-active-user-avatar-fallback" style="--user-color: ${color};">${user.name.charAt(0).toUpperCase()}</div>`
      }
              <div class="grip-active-user-status status-good"></div>
              ${isOwn ? '<div class="grip-active-user-you-badge">You</div>' : ''}
              <div class="grip-active-user-tooltip">
                <div class="grip-active-user-tooltip-name">${user.name}</div>
                <div class="grip-active-user-tooltip-email">${user.email || ''}</div>
                <div class="grip-active-user-tooltip-status" style="--user-color: ${color};">${status}</div>
              </div>
            </div>
          `;
  }).join('')}
        ${overflow > 0 ? `<div class="grip-active-users-more">+${overflow}</div>` : ''}
      </div>
    </div>
  `;

  // Track new users for confetti
  activeUsersArray.forEach(user => {
    if (!knownUserIds.has(user.id)) {
      knownUserIds.add(user.id);
      const el = container.querySelector(`[data-user-id="${user.id}"]`);
      if (el) setTimeout(() => spawnConfetti(el, getUserColor(user.id)), 200);
    }
  });
}

function renderRemoteCursors() {
  const container = document.getElementById('gripRemoteCursors');
  if (!container) return;

  const currentUser = window.LayerDB?.getCurrentUser();
  const now = Date.now();
  const cursors = Array.from(GripState.activeUsers.entries())
    .filter(([userId, user]) => user.cursor && userId !== currentUser?.id)
    .slice(0, MAX_VISIBLE_CURSORS)
    .map(([userId, user]) => {
      const screenPos = worldToScreen(user.cursor.x, user.cursor.y);
      const lastMove = cursorLastMoveTime.get(userId) || now;
      return {
        userId, name: user.name, avatar: user.avatar,
        x: screenPos.x, y: screenPos.y, selection: user.selection,
        color: getUserColor(userId),
        labelHidden: (now - lastMove) > LABEL_HIDE_DELAY
      };
    });

  // Update last move times
  cursors.forEach(c => {
    const prev = container.querySelector(`[data-cursor-id="${c.userId}"]`);
    if (prev) {
      const prevX = parseFloat(prev.style.left);
      const prevY = parseFloat(prev.style.top);
      if (Math.abs(prevX - c.x) > 1 || Math.abs(prevY - c.y) > 1) {
        cursorLastMoveTime.set(c.userId, now);
        c.labelHidden = false;
      }
    } else {
      cursorLastMoveTime.set(c.userId, now);
      c.labelHidden = false;
    }
  });

  if (cursors.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = cursors.map(cursor => `
    <div class="grip-remote-cursor" data-cursor-id="${cursor.userId}"
         style="left: ${cursor.x}px; top: ${cursor.y}px; --cursor-color: ${cursor.color};">
      <div class="grip-cursor-trail"></div>
      <div class="grip-cursor-pointer"></div>
      <div class="grip-cursor-label ${cursor.labelHidden ? 'label-hidden' : 'label-visible'}">
        ${cursor.avatar
      ? `<img src="${cursor.avatar}" class="grip-cursor-avatar" alt="${cursor.name}" />`
      : `<div class="grip-cursor-avatar-fallback" style="--cursor-color: ${cursor.color};">${(cursor.name || 'G').charAt(0).toUpperCase()}</div>`
    }
        <span>${cursor.name || 'Guest'}</span>
        <span class="grip-cursor-status-dot" style="--cursor-color: ${cursor.color};"></span>
      </div>
    </div>
  `).join('');
}

function showRemoteActionNotification(message, userId) {
  const color = getUserColor(userId);
  const user = userId ? GripState.activeUsers.get(userId) : null;
  const name = user?.name || 'Someone';
  const initial = name.charAt(0).toUpperCase();

  const notification = document.createElement('div');
  notification.className = 'grip-remote-notification';
  notification.style.setProperty('--toast-color', color);
  notification.innerHTML = `
    <div class="grip-remote-notification-content">
      ${user?.avatar
      ? `<img src="${user.avatar}" class="toast-avatar" alt="${name}" />`
      : `<div class="toast-avatar-fallback" style="--toast-color: ${color};">${initial}</div>`
    }
      <span class="toast-text">${message}</span>
    </div>
    <div class="toast-progress"></div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease forwards';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function showRemoteUpdateNotification() {
  if (remoteUpdateNotificationTimeout) {
    clearTimeout(remoteUpdateNotificationTimeout);
  }

  const notification = document.createElement('div');
  notification.className = 'grip-remote-update';
  notification.innerHTML = `
    <div class="grip-remote-update-content">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
        <path d="M23 7l-7 5 7 5V7z"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
      <span>Whiteboard updated by teammate</span>
    </div>
  `;

  document.body.appendChild(notification);

  remoteUpdateNotificationTimeout = setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease forwards';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// Override existing closeGripDiagram function
window.closeGripDiagram = closeGripDiagramWithCleanup;