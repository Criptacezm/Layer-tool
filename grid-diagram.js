/* ============================================
   Layer - Grip Diagram (Flowchart Builder)
   Full whiteboard with zoom, select all, and backlog
   ============================================ */

// Grip Diagram State
let gripDiagramOpen = false;
let gripProjectIndex = null;
let gripCells = [];
let gripConnections = [];
let gripSelectedCellId = null;
let gripSelectedCellIds = []; // Multi-selection
let gripDraggingCellId = null;
let gripDragOffset = { x: 0, y: 0 };
let gripIsDragging = false;
let gripConnectMode = false;
let gripConnectFromId = null;
let gripConnectFromPosition = null;
let gripNextCellId = 1;
let gripResizingCellId = null;
let gripResizeStartSize = { width: 200, height: 120 };
let gripResizeStartPos = { x: 0, y: 0 };
let gripIsInitialOpen = false; // Track initial open for animation

// Text boxes state
let gripTextBoxes = [];
let gripNextTextBoxId = 1;
let gripSelectedTextBoxId = null;
let gripDraggingTextBoxId = null;
let gripTextBoxDragOffset = { x: 0, y: 0 };

// Images state
let gripImages = [];
let gripNextImageId = 1;
let gripSelectedImageId = null;
let gripDraggingImageId = null;
let gripImageDragOffset = { x: 0, y: 0 };
let gripResizingImageId = null;
let gripImageResizeStartSize = { width: 200, height: 150 };
let gripImageResizeStartPos = { x: 0, y: 0 };

// Connection dragging state
let gripIsDraggingConnection = false;
let gripConnectionDragStart = null;
let gripConnectionDragEnd = null;

// Text highlight colors
const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: 'rgba(250, 204, 21, 0.4)' },
  { name: 'Green', value: 'rgba(34, 197, 94, 0.4)' },
  { name: 'Blue', value: 'rgba(59, 130, 246, 0.4)' },
  { name: 'Pink', value: 'rgba(236, 72, 153, 0.4)' },
  { name: 'Purple', value: 'rgba(139, 92, 246, 0.4)' },
];

// Canvas panning state
let gripIsPanning = false;
let gripPanStart = { x: 0, y: 0 };
let gripScrollStart = { x: 0, y: 0 };
let gripActiveTool = 'select'; // 'select', 'text', 'pan'

// Zoom state
let gripZoomLevel = 1;
const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;

// Backlog state
let gripBacklogOpen = false;
let gripBacklogItems = [];
let gripBacklogFilter = 'all'; // 'all', 'todo', 'in_progress', 'done'

const GRIP_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#8b5cf6', // Purple
  '#f59e0b', // Orange
  '#ef4444', // Red
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

const DEFAULT_CELL_WIDTH = 200;
const DEFAULT_CELL_HEIGHT = 120;
const MIN_CELL_WIDTH = 120;
const MIN_CELL_HEIGHT = 80;

// ============================================
// Grip Diagram Core Functions
// ============================================

function openGripDiagram(projectIndex) {
  gripProjectIndex = projectIndex;
  loadGripDiagramData(projectIndex);
  gripDiagramOpen = true;
  gripSelectedCellId = null;
  gripConnectMode = false;
  gripConnectFromId = null;
  gripConnectFromPosition = null;
  gripDraggingCellId = null;
  gripIsDragging = false;
  gripResizingCellId = null;
  gripIsInitialOpen = true; // Set flag for animation
  
  // Remove any existing overlay first
  const existingOverlay = document.getElementById('gripDiagramOverlay');
  if (existingOverlay) existingOverlay.remove();
  
  renderGripDiagramOverlay();
  gripIsInitialOpen = false; // Reset after render
}

function closeGripDiagram() {
  saveGripDiagramData(gripProjectIndex);
  gripDiagramOpen = false;
  gripProjectIndex = null;
  gripSelectedCellId = null;
  gripConnectMode = false;
  gripConnectFromId = null;
  gripConnectFromPosition = null;
  gripDraggingCellId = null;
  gripIsDragging = false;
  gripResizingCellId = null;
  
  // Remove event listeners
  document.removeEventListener('mousemove', handleGripMouseMove);
  document.removeEventListener('mouseup', handleGripMouseUp);
  document.removeEventListener('touchmove', handleGripTouchMove);
  document.removeEventListener('touchend', handleGripTouchEnd);
  
  const overlay = document.getElementById('gripDiagramOverlay');
  if (overlay) overlay.remove();
}

function loadGripDiagramData(projectIndex) {
  const projects = loadProjects();
  const project = projects[projectIndex];
  if (project && project.gripDiagram) {
    gripCells = project.gripDiagram.cells || [];
    gripConnections = project.gripDiagram.connections || [];
    gripNextCellId = project.gripDiagram.nextCellId || 1;
    gripTextBoxes = project.gripDiagram.textBoxes || [];
    gripNextTextBoxId = project.gripDiagram.nextTextBoxId || 1;
    gripImages = project.gripDiagram.images || [];
    gripNextImageId = project.gripDiagram.nextImageId || 1;
    gripBacklogItems = project.gripDiagram.backlogItems || generateDefaultBacklogItems();
    // Ensure all cells have width/height
    gripCells.forEach(cell => {
      if (!cell.width) cell.width = DEFAULT_CELL_WIDTH;
      if (!cell.height) cell.height = DEFAULT_CELL_HEIGHT;
      if (!cell.comment) cell.comment = '';
    });
    // Ensure text boxes have highlightColor
    gripTextBoxes.forEach(tb => {
      if (!tb.highlightColor) tb.highlightColor = null;
    });
  } else {
    gripCells = [];
    gripConnections = [];
    gripNextCellId = 1;
    gripTextBoxes = [];
    gripNextTextBoxId = 1;
    gripImages = [];
    gripNextImageId = 1;
    gripBacklogItems = generateDefaultBacklogItems();
  }
}

function generateDefaultBacklogItems() {
  return [
    { id: 1, title: 'Research Phase', description: 'Gather initial requirements and research', status: 'done', priority: 'high', assignee: 'You', dueDate: '2025-01-15', tags: ['research', 'planning'] },
    { id: 2, title: 'Design Wireframes', description: 'Create low-fidelity wireframes for main screens', status: 'done', priority: 'high', assignee: 'You', dueDate: '2025-01-20', tags: ['design', 'ui'] },
    { id: 3, title: 'Setup Project Structure', description: 'Initialize repository and project architecture', status: 'in_progress', priority: 'medium', assignee: 'You', dueDate: '2025-01-25', tags: ['development', 'setup'] },
    { id: 4, title: 'Implement Authentication', description: 'Add user login and registration system', status: 'todo', priority: 'high', assignee: 'Unassigned', dueDate: '2025-02-01', tags: ['development', 'security'] },
    { id: 5, title: 'Create Dashboard UI', description: 'Build the main dashboard interface', status: 'todo', priority: 'medium', assignee: 'Unassigned', dueDate: '2025-02-05', tags: ['development', 'ui'] },
    { id: 6, title: 'API Integration', description: 'Connect frontend with backend APIs', status: 'todo', priority: 'medium', assignee: 'Unassigned', dueDate: '2025-02-10', tags: ['development', 'api'] },
    { id: 7, title: 'Testing & QA', description: 'Comprehensive testing of all features', status: 'todo', priority: 'low', assignee: 'Unassigned', dueDate: '2025-02-15', tags: ['testing', 'qa'] },
    { id: 8, title: 'Documentation', description: 'Write user and technical documentation', status: 'todo', priority: 'low', assignee: 'Unassigned', dueDate: '2025-02-20', tags: ['docs'] },
  ];
}

function saveGripDiagramData(projectIndex) {
  const projects = loadProjects();
  if (projects[projectIndex]) {
    projects[projectIndex].gripDiagram = {
      cells: gripCells,
      connections: gripConnections,
      nextCellId: gripNextCellId,
      textBoxes: gripTextBoxes,
      nextTextBoxId: gripNextTextBoxId,
      images: gripImages,
      nextImageId: gripNextImageId,
      backlogItems: gripBacklogItems
    };
    saveProjects(projects);
  }
}

// ============================================
// Render Functions
// ============================================

function renderGripDiagramOverlay() {
  // Remove existing overlay if any
  const existingOverlay = document.getElementById('gripDiagramOverlay');
  if (existingOverlay) existingOverlay.remove();

  const overlay = document.createElement('div');
  overlay.id = 'gripDiagramOverlay';
  overlay.className = 'grip-diagram-overlay' + (gripIsInitialOpen ? ' grip-animate-in' : '');
  
  const zoomPercent = Math.round(gripZoomLevel * 100);
  const filteredBacklog = getFilteredBacklogItems();
  const backlogStats = getBacklogStats();
  
  overlay.innerHTML = `
    <div class="grip-diagram-container clickup-style">
      <!-- Header -->
      <div class="grip-diagram-header clickup-header">
        <div class="grip-header-left">
          <button type="button" class="grip-back-btn" id="gripBackBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div class="whiteboard-title">
            <span class="whiteboard-icon">📋</span>
            <h2>Whiteboard</h2>
            <button class="whiteboard-star" title="Add to favorites">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="grip-header-center">
          <!-- Quick Actions -->
          <button type="button" class="header-action-btn" id="selectAllBtn" title="Select All (Ctrl+A)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            <span>Select All</span>
          </button>
          <button type="button" class="header-action-btn" id="fitToScreenBtn" title="Fit to Screen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
            </svg>
          </button>
          <button type="button" class="header-action-btn ${gripBacklogOpen ? 'active' : ''}" id="toggleBacklogBtn" title="Toggle Backlog">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <path d="M9 12h6M9 16h6"/>
            </svg>
            <span>Backlog</span>
          </button>
        </div>
        <div class="grip-header-right">
          <div class="zoom-controls">
            <button class="zoom-btn" id="zoomOut" title="Zoom out (-)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>
            </button>
            <button class="zoom-level-btn" id="zoomLevelBtn" title="Reset zoom">
              <span id="zoomLevel">${zoomPercent}%</span>
            </button>
            <button class="zoom-btn" id="zoomIn" title="Zoom in (+)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>
          <button class="share-btn" title="Share">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>
            </svg>
            <span>Share</span>
          </button>
        </div>
      </div>
      
      <!-- Main Content Area -->
      <div class="grip-diagram-body clickup-body">
        <!-- Canvas Area -->
        <div class="grip-canvas-wrapper ${gripBacklogOpen ? 'with-backlog' : ''}">
          <div class="grip-diagram-canvas clickup-canvas ${gripActiveTool === 'pan' ? 'pan-mode' : ''}" id="gripCanvas">
            <div class="grip-canvas-transform" id="gripCanvasTransform" style="transform: scale(${gripZoomLevel}); transform-origin: 0 0;">
              <svg class="grip-connections-layer" id="gripConnectionsSvg"></svg>
              <div class="grip-cells-layer" id="gripCellsContainer"></div>
              <div class="grip-images-layer" id="gripImagesContainer"></div>
              <div class="grip-textboxes-layer" id="gripTextBoxesContainer"></div>
            </div>
            ${gripIsDraggingConnection ? '<div class="grip-connect-hint">Release on another cell to connect</div>' : ''}
          </div>
          
          <!-- Selection info bar -->
          ${gripSelectedCellIds.length > 1 ? `
            <div class="selection-info-bar">
              <span>${gripSelectedCellIds.length} items selected</span>
              <button class="selection-action" id="deleteSelectedBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m5 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                Delete
              </button>
              <button class="selection-action" id="duplicateSelectedBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                Duplicate
              </button>
              <button class="selection-action" id="clearSelectionBtn">Clear</button>
            </div>
          ` : ''}
        </div>
        
        <!-- Backlog Panel -->
        <div class="backlog-panel ${gripBacklogOpen ? 'open' : ''}" id="backlogPanel">
          <div class="backlog-header">
            <div class="backlog-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
              </svg>
              <h3>Project Backlog</h3>
            </div>
            <button class="backlog-close" id="closeBacklogBtn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          
          <!-- Backlog Stats -->
          <div class="backlog-stats">
            <div class="stat-item stat-todo">
              <span class="stat-count">${backlogStats.todo}</span>
              <span class="stat-label">To Do</span>
            </div>
            <div class="stat-item stat-progress">
              <span class="stat-count">${backlogStats.in_progress}</span>
              <span class="stat-label">In Progress</span>
            </div>
            <div class="stat-item stat-done">
              <span class="stat-count">${backlogStats.done}</span>
              <span class="stat-label">Done</span>
            </div>
          </div>
          
          <!-- Backlog Filters -->
          <div class="backlog-filters">
            <button class="filter-btn ${gripBacklogFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
            <button class="filter-btn ${gripBacklogFilter === 'todo' ? 'active' : ''}" data-filter="todo">To Do</button>
            <button class="filter-btn ${gripBacklogFilter === 'in_progress' ? 'active' : ''}" data-filter="in_progress">In Progress</button>
            <button class="filter-btn ${gripBacklogFilter === 'done' ? 'active' : ''}" data-filter="done">Done</button>
          </div>
          
          <!-- Backlog Search -->
          <div class="backlog-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input type="text" id="backlogSearchInput" placeholder="Search backlog...">
          </div>
          
          <!-- Backlog Items -->
          <div class="backlog-items" id="backlogItems">
            ${filteredBacklog.map(item => renderBacklogItem(item)).join('')}
          </div>
          
          <!-- Add Item Button -->
          <button class="backlog-add-btn" id="addBacklogItemBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Item
          </button>
        </div>
      </div>
      
      <!-- Hidden file input for image import -->
      <input type="file" id="gripImageInput" accept="image/*" style="display: none;" />
      
      <!-- Bottom Toolbar -->
      <div class="whiteboard-bottom-toolbar" id="whiteboardToolbar">
        <div class="toolbar-group toolbar-main">
          <button type="button" class="toolbar-tool ${gripActiveTool === 'select' ? 'active' : ''}" data-tool="select" title="Select (V)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
            </svg>
          </button>
          
          <button type="button" class="toolbar-tool ${gripActiveTool === 'pan' ? 'active' : ''}" data-tool="pan" title="Hand (H)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 11V6a2 2 0 00-2-2 2 2 0 00-2 2v1M14 10V4a2 2 0 00-2-2 2 2 0 00-2 2v6M10 10.5V6a2 2 0 00-2-2 2 2 0 00-2 2v8"/>
              <path d="M18 8a2 2 0 012 2v7a5 5 0 01-5 5h-4a5 5 0 01-5-5v-2"/>
            </svg>
          </button>
          
          <div class="toolbar-divider"></div>
          
          <button type="button" class="toolbar-tool toolbar-tool-task" id="gripAddBtn" title="Add Task Card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
            <span class="toolbar-label">Task</span>
          </button>
          
          <button type="button" class="toolbar-tool" id="gripConnectBtn" title="Arrow - Drag from connection points (A)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
          
          <div class="toolbar-divider"></div>
          
          <button type="button" class="toolbar-tool ${gripActiveTool === 'text' ? 'active' : ''}" data-tool="text" title="Text (T)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
            </svg>
          </button>
          
          <button type="button" class="toolbar-tool" id="gripImageBtn" title="Image (I)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
          </button>
          
          ${getSelectedCellHasConnections() ? `
          <div class="toolbar-divider"></div>
          <button type="button" class="toolbar-tool" id="deleteLinksBtn" title="Delete Links" style="background: #ef4444; color: white;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
            <span class="toolbar-label">Delete Links</span>
          </button>
          ` : ''}
        </div>
        
        ${gripSelectedTextBoxId ? renderTextFormattingToolbar() : ''}
        
        <div class="toolbar-group toolbar-extras">
          <button type="button" class="toolbar-tool toolbar-ai" id="gripAiChatToggle" title="AI Assistant">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2a10 10 0 1010 10H12V2z"/>
              <path d="M12 2a7 7 0 017 7h-7V2z"/>
            </svg>
          </button>
        </div>
      </div>
      
      ${gripSelectedCellId ? renderGripCellEditor() : ''}
      
      <!-- AI Chat Box -->
      <div class="grip-ai-chat" id="gripAiChat" style="display: none;">
        <div class="grip-ai-chat-header">
          <h4>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
              <line x1="9" y1="9" x2="9.01" y2="9"/>
              <line x1="15" y1="9" x2="15.01" y2="9"/>
            </svg>
            Project Assistant
          </h4>
          <button type="button" class="grip-ai-chat-close" id="gripAiChatClose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="grip-ai-chat-messages" id="gripAiMessages">
          <div class="grip-ai-message assistant">
            Hey! I'm here to help with your project. What do you need?
          </div>
        </div>
        <div class="grip-ai-chat-input">
          <input type="text" id="gripAiInput" placeholder="Ask me anything..." />
          <button type="button" class="grip-ai-chat-send" id="gripAiSend">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  overlay.style.display = 'flex';
  
  // Setup all event listeners
  setupGripEventListeners();
  setupAiChatListeners();
  setupToolsListeners();
  setupZoomListeners();
  setupBacklogListeners();
  setupKeyboardShortcuts();
  renderGripCells();
  renderGripConnections();
  renderGripTextBoxes();
  renderGripImages();
  setupImageListeners();
  applyZoom();
}

function renderBacklogItem(item) {
  const priorityColors = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
  const statusColors = { todo: '#6b7280', in_progress: '#3b82f6', done: '#22c55e' };
  const statusLabels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
  
  return `
    <div class="backlog-item" data-item-id="${item.id}" draggable="true">
      <div class="backlog-item-header">
        <span class="backlog-item-priority" style="background: ${priorityColors[item.priority]}"></span>
        <span class="backlog-item-title">${item.title}</span>
        <button class="backlog-item-menu" data-item-id="${item.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
          </svg>
        </button>
      </div>
      <p class="backlog-item-desc">${item.description}</p>
      <div class="backlog-item-meta">
        <span class="backlog-item-status" style="background: ${statusColors[item.status]}20; color: ${statusColors[item.status]}">
          ${statusLabels[item.status]}
        </span>
        <span class="backlog-item-assignee">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          ${item.assignee}
        </span>
      </div>
      ${item.tags && item.tags.length > 0 ? `
        <div class="backlog-item-tags">
          ${item.tags.map(tag => `<span class="backlog-tag">${tag}</span>`).join('')}
        </div>
      ` : ''}
      <div class="backlog-item-footer">
        <span class="backlog-item-due">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
          ${item.dueDate}
        </span>
        <button class="backlog-add-to-board" data-item-id="${item.id}" title="Add to board">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function getFilteredBacklogItems() {
  if (gripBacklogFilter === 'all') return gripBacklogItems;
  return gripBacklogItems.filter(item => item.status === gripBacklogFilter);
}

function getBacklogStats() {
  return {
    todo: gripBacklogItems.filter(i => i.status === 'todo').length,
    in_progress: gripBacklogItems.filter(i => i.status === 'in_progress').length,
    done: gripBacklogItems.filter(i => i.status === 'done').length
  };
}

function setupGripEventListeners() {
  // Header buttons
  const backBtn = document.getElementById('gripBackBtn');
  const connectBtn = document.getElementById('gripConnectBtn');
  const addBtn = document.getElementById('gripAddBtn');
  
  if (backBtn) backBtn.addEventListener('click', closeGripDiagram);
  if (connectBtn) connectBtn.addEventListener('click', toggleGripConnectMode);
  if (addBtn) addBtn.addEventListener('click', addGripCell);
  
  // Global mouse/touch events for dragging
  document.addEventListener('mousemove', handleGripMouseMove);
  document.addEventListener('mouseup', handleGripMouseUp);
  document.addEventListener('touchmove', handleGripTouchMove, { passive: false });
  document.addEventListener('touchend', handleGripTouchEnd);
  
  // Canvas click to deselect
  const canvas = document.getElementById('gripCanvas');
  if (canvas) {
    canvas.addEventListener('click', (e) => {
      if (e.target === canvas || e.target.classList.contains('grip-cells-layer')) {
        if (gripConnectMode) {
          gripConnectMode = false;
          gripConnectFromId = null;
          gripConnectFromPosition = null;
          renderGripDiagramOverlay();
        }
      }
    });
  }
}

function renderGripCells() {
  const container = document.getElementById('gripCellsContainer');
  if (!container) return;

  container.innerHTML = gripCells.map(cell => {
    const width = cell.width || DEFAULT_CELL_WIDTH;
    const height = cell.height || DEFAULT_CELL_HEIGHT;
    const hasComment = cell.comment && cell.comment.trim().length > 0;
    
    return `
    <div class="grip-cell ${gripSelectedCellId === cell.id ? 'selected' : ''} ${gripConnectMode ? 'connect-mode' : ''} ${gripConnectFromId === cell.id ? 'connect-from' : ''}"
         id="gripCell-${cell.id}"
         data-cell-id="${cell.id}"
         style="left: ${cell.x}px; top: ${cell.y}px; width: ${width}px; min-height: ${height}px;"
         ${hasComment ? `data-comment="${escapeHtml(cell.comment)}"` : ''}>
      
      <!-- Cell Action Buttons -->
      <div class="grip-cell-actions">
        <button type="button" class="grip-cell-action-btn grip-delete-btn" data-cell-id="${cell.id}" title="Delete cell">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m5 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
        </button>
        <button type="button" class="grip-cell-action-btn grip-edit-btn" data-cell-id="${cell.id}" title="Edit cell">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>
      
      <!-- Comment indicator -->
      ${hasComment ? `
        <div class="grip-cell-comment-indicator" title="${escapeHtml(cell.comment)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/>
          </svg>
        </div>
        <div class="grip-cell-tooltip">${escapeHtml(cell.comment)}</div>
      ` : ''}
      
      <div class="grip-cell-header" style="background: ${cell.headerColor};">
        <span class="grip-cell-title">${cell.title || 'Untitled'}</span>
      </div>
      <div class="grip-cell-content">
        ${cell.content || 'Click to edit...'}
      </div>
      
      <!-- Connection Points -->
      <div class="grip-cell-connection-point grip-conn-top" data-cell-id="${cell.id}" data-position="top"></div>
      <div class="grip-cell-connection-point grip-conn-right" data-cell-id="${cell.id}" data-position="right"></div>
      <div class="grip-cell-connection-point grip-conn-bottom" data-cell-id="${cell.id}" data-position="bottom"></div>
      <div class="grip-cell-connection-point grip-conn-left" data-cell-id="${cell.id}" data-position="left"></div>
      
      <!-- Resize Handles -->
      <div class="grip-cell-resize-handle grip-resize-e" data-cell-id="${cell.id}" data-direction="e"></div>
      <div class="grip-cell-resize-handle grip-resize-s" data-cell-id="${cell.id}" data-direction="s"></div>
      <div class="grip-cell-resize-handle grip-resize-se" data-cell-id="${cell.id}" data-direction="se"></div>
    </div>
  `}).join('');

  // Attach event listeners to each cell
  gripCells.forEach(cell => {
    const cellElement = document.getElementById(`gripCell-${cell.id}`);
    if (cellElement) {
      // Mouse events
      cellElement.addEventListener('mousedown', (e) => handleGripCellMouseDown(e, cell.id));
      cellElement.addEventListener('click', (e) => handleGripCellClick(e, cell.id));
      
      // Touch events
      cellElement.addEventListener('touchstart', (e) => handleGripCellTouchStart(e, cell.id), { passive: false });
      
      // Connection points - drag to connect
      const connectionPoints = cellElement.querySelectorAll('.grip-cell-connection-point');
      connectionPoints.forEach(point => {
        point.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          const position = point.dataset.position;
          handleConnectionPointMouseDown(e, cell.id, position);
        });
      });
      
      // Resize handles
      const resizeHandles = cellElement.querySelectorAll('.grip-cell-resize-handle');
      resizeHandles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => handleResizeStart(e, cell.id, handle.dataset.direction));
        handle.addEventListener('touchstart', (e) => handleResizeTouchStart(e, cell.id, handle.dataset.direction), { passive: false });
      });
      
      // Action buttons
      const deleteBtn = cellElement.querySelector('.grip-delete-btn');
      const editBtn = cellElement.querySelector('.grip-edit-btn');
      
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteGripCell(cell.id);
        });
        deleteBtn.addEventListener('mousedown', (e) => e.stopPropagation());
      }
      
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          gripSelectedCellId = cell.id;
          renderGripDiagramOverlay();
          setTimeout(setupEditorEventListeners, 0);
        });
        editBtn.addEventListener('mousedown', (e) => e.stopPropagation());
      }
    }
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderGripConnections() {
  const svg = document.getElementById('gripConnectionsSvg');
  if (!svg) return;

  const canvas = document.getElementById('gripCanvas');
  if (canvas) {
    const minWidth = Math.max(canvas.scrollWidth, canvas.clientWidth, 2000);
    const minHeight = Math.max(canvas.scrollHeight, canvas.clientHeight, 2000);
    svg.setAttribute('width', minWidth);
    svg.setAttribute('height', minHeight);
    svg.style.width = minWidth + 'px';
    svg.style.height = minHeight + 'px';
  }

  let svgContent = '';
  
  // Add professional arrow marker definitions
  svgContent += `
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,7 L10,3.5 z" fill="#64748b"/>
      </marker>
      <marker id="arrowhead-hover" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,7 L10,3.5 z" fill="#ef4444"/>
      </marker>
      <filter id="connection-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.15"/>
      </filter>
    </defs>
  `;

  gripConnections.forEach((conn, index) => {
    const fromCell = gripCells.find(c => c.id === conn.fromId);
    const toCell = gripCells.find(c => c.id === conn.toId);
    if (!fromCell || !toCell) return;

    const fromPoint = getCellConnectionPoint(fromCell, conn.fromPosition);
    const toPoint = getCellConnectionPoint(toCell, conn.toPosition);

    // Create a smooth bezier curve
    const dx = toPoint.x - fromPoint.x;
    const dy = toPoint.y - fromPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curvature = Math.min(dist * 0.4, 100);
    
    let cp1x, cp1y, cp2x, cp2y;
    
    // Calculate control points based on connection positions
    switch (conn.fromPosition) {
      case 'right': cp1x = fromPoint.x + curvature; cp1y = fromPoint.y; break;
      case 'left': cp1x = fromPoint.x - curvature; cp1y = fromPoint.y; break;
      case 'top': cp1x = fromPoint.x; cp1y = fromPoint.y - curvature; break;
      case 'bottom': cp1x = fromPoint.x; cp1y = fromPoint.y + curvature; break;
      default: cp1x = fromPoint.x + curvature; cp1y = fromPoint.y;
    }
    
    switch (conn.toPosition) {
      case 'right': cp2x = toPoint.x + curvature; cp2y = toPoint.y; break;
      case 'left': cp2x = toPoint.x - curvature; cp2y = toPoint.y; break;
      case 'top': cp2x = toPoint.x; cp2y = toPoint.y - curvature; break;
      case 'bottom': cp2x = toPoint.x; cp2y = toPoint.y + curvature; break;
      default: cp2x = toPoint.x - curvature; cp2y = toPoint.y;
    }

    const path = `M ${fromPoint.x} ${fromPoint.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toPoint.x} ${toPoint.y}`;

    svgContent += `
      <g class="grip-connection-group" data-connection-index="${index}">
        <!-- Shadow path -->
        <path d="${path}" fill="none" stroke="rgba(0,0,0,0.08)" stroke-width="5" filter="url(#connection-shadow)"/>
        <!-- Main path -->
        <path class="grip-connection-path" d="${path}" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" marker-end="url(#arrowhead)"/>
        <!-- Hit area for interaction -->
        <path d="${path}" fill="none" stroke="transparent" stroke-width="20" class="grip-connection-hitarea" data-index="${index}" style="cursor: pointer;"/>
        <!-- Start dot -->
        <circle cx="${fromPoint.x}" cy="${fromPoint.y}" r="3.5" fill="#64748b" class="grip-connection-dot"/>
        <!-- Delete indicator (shows on hover) -->
        <g class="grip-connection-delete-indicator" style="opacity: 0; transition: opacity 0.2s;">
          <circle cx="${(fromPoint.x + toPoint.x) / 2}" cy="${(fromPoint.y + toPoint.y) / 2}" r="12" fill="#ef4444"/>
          <path d="M${(fromPoint.x + toPoint.x) / 2 - 4} ${(fromPoint.y + toPoint.y) / 2} L${(fromPoint.x + toPoint.x) / 2 + 4} ${(fromPoint.y + toPoint.y) / 2}" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </g>
      </g>
    `;
  });
  
  svg.innerHTML = svgContent;
  
  // Attach click handlers to connection hit areas
  svg.querySelectorAll('.grip-connection-hitarea').forEach(hitArea => {
    hitArea.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(hitArea.dataset.index);
      handleConnectionClick(index);
    });
    
    // Add hover effect
    hitArea.addEventListener('mouseenter', () => {
      const group = hitArea.closest('.grip-connection-group');
      if (group) {
        group.querySelector('.grip-connection-path').style.stroke = '#ef4444';
        group.querySelector('.grip-connection-path').setAttribute('marker-end', 'url(#arrowhead-hover)');
        group.querySelector('.grip-connection-dot').style.fill = '#ef4444';
        const deleteIndicator = group.querySelector('.grip-connection-delete-indicator');
        if (deleteIndicator) deleteIndicator.style.opacity = '1';
      }
    });
    
    hitArea.addEventListener('mouseleave', () => {
      const group = hitArea.closest('.grip-connection-group');
      if (group) {
        group.querySelector('.grip-connection-path').style.stroke = '#64748b';
        group.querySelector('.grip-connection-path').setAttribute('marker-end', 'url(#arrowhead)');
        group.querySelector('.grip-connection-dot').style.fill = '#64748b';
        const deleteIndicator = group.querySelector('.grip-connection-delete-indicator');
        if (deleteIndicator) deleteIndicator.style.opacity = '0';
      }
    });
  });
}

function getCellConnectionPoint(cell, position) {
  const cellWidth = cell.width || DEFAULT_CELL_WIDTH;
  const cellHeight = cell.height || DEFAULT_CELL_HEIGHT;
  
  switch (position) {
    case 'top':
      return { x: cell.x + cellWidth / 2, y: cell.y };
    case 'right':
      return { x: cell.x + cellWidth, y: cell.y + cellHeight / 2 };
    case 'bottom':
      return { x: cell.x + cellWidth / 2, y: cell.y + cellHeight };
    case 'left':
      return { x: cell.x, y: cell.y + cellHeight / 2 };
    default:
      return { x: cell.x + cellWidth / 2, y: cell.y + cellHeight / 2 };
  }
}

function renderGripCellEditor() {
  const cell = gripCells.find(c => c.id === gripSelectedCellId);
  if (!cell) return '';

  return `
    <div class="grip-cell-editor" id="gripCellEditor">
      <div class="grip-editor-header">
        <h3>Edit Cell</h3>
        <button type="button" class="grip-editor-close" id="gripEditorClose">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="grip-editor-content">
        <div class="grip-editor-field">
          <label>Title</label>
          <input type="text" id="gripCellTitle" value="${cell.title || ''}" placeholder="Cell title...">
        </div>
        <div class="grip-editor-field">
          <label>Content</label>
          <textarea id="gripCellContent" placeholder="Cell content...">${cell.content || ''}</textarea>
        </div>
        <div class="grip-editor-field">
          <label>Comment (shows on hover)</label>
          <textarea id="gripCellComment" placeholder="Add a comment that appears when hovering...">${cell.comment || ''}</textarea>
        </div>
        <div class="grip-editor-field">
          <label>Size</label>
          <div class="grip-size-inputs">
            <div class="grip-size-input-group">
              <span>W:</span>
              <input type="number" id="gripCellWidth" value="${cell.width || DEFAULT_CELL_WIDTH}" min="${MIN_CELL_WIDTH}">
            </div>
            <div class="grip-size-input-group">
              <span>H:</span>
              <input type="number" id="gripCellHeight" value="${cell.height || DEFAULT_CELL_HEIGHT}" min="${MIN_CELL_HEIGHT}">
            </div>
          </div>
        </div>
        <div class="grip-editor-field">
          <label>Header Color</label>
          <div class="grip-color-picker" id="gripColorPicker">
            ${GRIP_COLORS.map(color => `
              <button type="button" class="grip-color-btn ${cell.headerColor === color ? 'active' : ''}"
                      style="background: ${color};"
                      data-color="${color}">
              </button>
            `).join('')}
          </div>
        </div>
        <div class="grip-editor-actions">
          <button type="button" class="btn btn-destructive" id="gripDeleteBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m5 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
            Delete Cell
          </button>
        </div>
      </div>
    </div>
  `;
}

function setupEditorEventListeners() {
  const editor = document.getElementById('gripCellEditor');
  if (!editor) return;
  
  const cell = gripCells.find(c => c.id === gripSelectedCellId);
  if (!cell) return;

  // Close button
  document.getElementById('gripEditorClose').addEventListener('click', deselectGripCell);
  
  // Title input
  document.getElementById('gripCellTitle').addEventListener('input', (e) => {
    updateGripCellTitle(cell.id, e.target.value);
  });
  
  // Content textarea
  document.getElementById('gripCellContent').addEventListener('input', (e) => {
    updateGripCellContent(cell.id, e.target.value);
  });
  
  // Comment textarea
  const commentInput = document.getElementById('gripCellComment');
  if (commentInput) {
    commentInput.addEventListener('input', (e) => {
      updateGripCellComment(cell.id, e.target.value);
    });
  }
  
  // Size inputs
  const widthInput = document.getElementById('gripCellWidth');
  const heightInput = document.getElementById('gripCellHeight');
  
  if (widthInput) {
    widthInput.addEventListener('change', (e) => {
      const newWidth = Math.max(MIN_CELL_WIDTH, parseInt(e.target.value) || DEFAULT_CELL_WIDTH);
      updateGripCellSize(cell.id, newWidth, cell.height || DEFAULT_CELL_HEIGHT);
    });
  }
  
  if (heightInput) {
    heightInput.addEventListener('change', (e) => {
      const newHeight = Math.max(MIN_CELL_HEIGHT, parseInt(e.target.value) || DEFAULT_CELL_HEIGHT);
      updateGripCellSize(cell.id, cell.width || DEFAULT_CELL_WIDTH, newHeight);
    });
  }
  
  // Color picker
  document.querySelectorAll('#gripColorPicker .grip-color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      updateGripCellColor(cell.id, btn.dataset.color);
    });
  });
  
  // Delete button
  document.getElementById('gripDeleteBtn').addEventListener('click', () => {
    deleteGripCell(cell.id);
  });
}

// ============================================
// Event Handlers - Mouse
// ============================================

function handleGripCellMouseDown(event, cellId) {
  // Ignore if clicking on connection point, resize handle, or action button
  if (event.target.classList.contains('grip-cell-connection-point') ||
      event.target.classList.contains('grip-cell-resize-handle') ||
      event.target.closest('.grip-cell-actions') ||
      event.target.closest('.grip-cell-action-btn')) return;
  
  if (gripConnectMode) return;
  if (gripResizingCellId) return;
  
  event.preventDefault();
  event.stopPropagation();
  
  const cell = gripCells.find(c => c.id === cellId);
  if (!cell) return;

  gripDraggingCellId = cellId;
  gripIsDragging = false;
  
  const canvas = document.getElementById('gripCanvas');
  const canvasRect = canvas.getBoundingClientRect();
  
  gripDragOffset = {
    x: event.clientX - canvasRect.left + canvas.scrollLeft - cell.x,
    y: event.clientY - canvasRect.top + canvas.scrollTop - cell.y
  };
  
  // Add dragging class
  const cellElement = document.getElementById(`gripCell-${cellId}`);
  if (cellElement) {
    cellElement.classList.add('dragging');
  }
}

function handleGripMouseMove(event) {
  // Handle resize
  if (gripResizingCellId) {
    handleResizeMove(event);
    return;
  }
  
  if (!gripDraggingCellId) return;
  
  event.preventDefault();
  gripIsDragging = true;
  
  const canvas = document.getElementById('gripCanvas');
  if (!canvas) return;
  
  const canvasRect = canvas.getBoundingClientRect();
  
  const newX = Math.max(0, event.clientX - canvasRect.left + canvas.scrollLeft - gripDragOffset.x);
  const newY = Math.max(0, event.clientY - canvasRect.top + canvas.scrollTop - gripDragOffset.y);
  
  const cellIndex = gripCells.findIndex(c => c.id === gripDraggingCellId);
  if (cellIndex !== -1) {
    gripCells[cellIndex].x = newX;
    gripCells[cellIndex].y = newY;
    
    const cellElement = document.getElementById(`gripCell-${gripDraggingCellId}`);
    if (cellElement) {
      cellElement.style.left = `${newX}px`;
      cellElement.style.top = `${newY}px`;
    }
    
    renderGripConnections();
  }
}

function handleGripMouseUp(event) {
  // Handle resize end
  if (gripResizingCellId) {
    handleResizeEnd();
    return;
  }
  
  if (gripDraggingCellId) {
    const cellElement = document.getElementById(`gripCell-${gripDraggingCellId}`);
    if (cellElement) {
      cellElement.classList.remove('dragging');
    }
    
    if (gripIsDragging) {
      // Update connection positions dynamically after dragging
      updateConnectionPositions();
      saveGripDiagramData(gripProjectIndex);
    }
    
    gripDraggingCellId = null;
    gripIsDragging = false;
  }
}

// ============================================
// Event Handlers - Touch
// ============================================

function handleGripCellTouchStart(event, cellId) {
  if (event.target.classList.contains('grip-cell-connection-point') ||
      event.target.classList.contains('grip-cell-resize-handle') ||
      event.target.closest('.grip-cell-actions')) return;
  if (gripConnectMode) return;
  
  event.preventDefault();
  
  const touch = event.touches[0];
  const cell = gripCells.find(c => c.id === cellId);
  if (!cell) return;

  gripDraggingCellId = cellId;
  gripIsDragging = false;
  
  const canvas = document.getElementById('gripCanvas');
  const canvasRect = canvas.getBoundingClientRect();
  
  gripDragOffset = {
    x: touch.clientX - canvasRect.left + canvas.scrollLeft - cell.x,
    y: touch.clientY - canvasRect.top + canvas.scrollTop - cell.y
  };
  
  const cellElement = document.getElementById(`gripCell-${cellId}`);
  if (cellElement) {
    cellElement.classList.add('dragging');
  }
}

function handleGripTouchMove(event) {
  if (gripResizingCellId) {
    handleResizeTouchMove(event);
    return;
  }
  
  if (!gripDraggingCellId) return;
  
  event.preventDefault();
  gripIsDragging = true;
  
  const touch = event.touches[0];
  const canvas = document.getElementById('gripCanvas');
  if (!canvas) return;
  
  const canvasRect = canvas.getBoundingClientRect();
  
  const newX = Math.max(0, touch.clientX - canvasRect.left + canvas.scrollLeft - gripDragOffset.x);
  const newY = Math.max(0, touch.clientY - canvasRect.top + canvas.scrollTop - gripDragOffset.y);
  
  const cellIndex = gripCells.findIndex(c => c.id === gripDraggingCellId);
  if (cellIndex !== -1) {
    gripCells[cellIndex].x = newX;
    gripCells[cellIndex].y = newY;
    
    const cellElement = document.getElementById(`gripCell-${gripDraggingCellId}`);
    if (cellElement) {
      cellElement.style.left = `${newX}px`;
      cellElement.style.top = `${newY}px`;
    }
    
    renderGripConnections();
  }
}

function handleGripTouchEnd(event) {
  if (gripResizingCellId) {
    handleResizeEnd();
    return;
  }
  
  if (gripDraggingCellId) {
    const cellElement = document.getElementById(`gripCell-${gripDraggingCellId}`);
    if (cellElement) {
      cellElement.classList.remove('dragging');
    }
    
    if (gripIsDragging) {
      // Update connection positions dynamically after dragging
      updateConnectionPositions();
      saveGripDiagramData(gripProjectIndex);
    }
    
    gripDraggingCellId = null;
    gripIsDragging = false;
  }
}

// ============================================
// Event Handlers - Resize
// ============================================

function handleResizeStart(event, cellId, direction) {
  event.preventDefault();
  event.stopPropagation();
  
  const cell = gripCells.find(c => c.id === cellId);
  if (!cell) return;
  
  gripResizingCellId = cellId;
  gripResizeStartSize = {
    width: cell.width || DEFAULT_CELL_WIDTH,
    height: cell.height || DEFAULT_CELL_HEIGHT
  };
  gripResizeStartPos = { x: event.clientX, y: event.clientY };
  gripResizeDirection = direction;
  
  const cellElement = document.getElementById(`gripCell-${cellId}`);
  if (cellElement) {
    cellElement.classList.add('resizing');
  }
}

function handleResizeTouchStart(event, cellId, direction) {
  event.preventDefault();
  event.stopPropagation();
  
  const touch = event.touches[0];
  const cell = gripCells.find(c => c.id === cellId);
  if (!cell) return;
  
  gripResizingCellId = cellId;
  gripResizeStartSize = {
    width: cell.width || DEFAULT_CELL_WIDTH,
    height: cell.height || DEFAULT_CELL_HEIGHT
  };
  gripResizeStartPos = { x: touch.clientX, y: touch.clientY };
  gripResizeDirection = direction;
}

function handleResizeMove(event) {
  if (!gripResizingCellId) return;
  
  const deltaX = event.clientX - gripResizeStartPos.x;
  const deltaY = event.clientY - gripResizeStartPos.y;
  
  const cellIndex = gripCells.findIndex(c => c.id === gripResizingCellId);
  if (cellIndex === -1) return;
  
  let newWidth = gripResizeStartSize.width;
  let newHeight = gripResizeStartSize.height;
  
  if (gripResizeDirection.includes('e')) {
    newWidth = Math.max(MIN_CELL_WIDTH, gripResizeStartSize.width + deltaX);
  }
  if (gripResizeDirection.includes('s')) {
    newHeight = Math.max(MIN_CELL_HEIGHT, gripResizeStartSize.height + deltaY);
  }
  
  gripCells[cellIndex].width = newWidth;
  gripCells[cellIndex].height = newHeight;
  
  const cellElement = document.getElementById(`gripCell-${gripResizingCellId}`);
  if (cellElement) {
    cellElement.style.width = `${newWidth}px`;
    cellElement.style.minHeight = `${newHeight}px`;
  }
  
  renderGripConnections();
}

function handleResizeTouchMove(event) {
  if (!gripResizingCellId) return;
  
  const touch = event.touches[0];
  const deltaX = touch.clientX - gripResizeStartPos.x;
  const deltaY = touch.clientY - gripResizeStartPos.y;
  
  const cellIndex = gripCells.findIndex(c => c.id === gripResizingCellId);
  if (cellIndex === -1) return;
  
  let newWidth = gripResizeStartSize.width;
  let newHeight = gripResizeStartSize.height;
  
  if (gripResizeDirection.includes('e')) {
    newWidth = Math.max(MIN_CELL_WIDTH, gripResizeStartSize.width + deltaX);
  }
  if (gripResizeDirection.includes('s')) {
    newHeight = Math.max(MIN_CELL_HEIGHT, gripResizeStartSize.height + deltaY);
  }
  
  gripCells[cellIndex].width = newWidth;
  gripCells[cellIndex].height = newHeight;
  
  const cellElement = document.getElementById(`gripCell-${gripResizingCellId}`);
  if (cellElement) {
    cellElement.style.width = `${newWidth}px`;
    cellElement.style.minHeight = `${newHeight}px`;
  }
  
  renderGripConnections();
}

function handleResizeEnd() {
  if (gripResizingCellId) {
    const cellElement = document.getElementById(`gripCell-${gripResizingCellId}`);
    if (cellElement) {
      cellElement.classList.remove('resizing');
    }
    
    saveGripDiagramData(gripProjectIndex);
    gripResizingCellId = null;
  }
}

let gripResizeDirection = '';

// ============================================
// Event Handlers - Click & Connect
// ============================================

function handleGripCellClick(event, cellId) {
  // If we were dragging, don't process as click
  if (gripIsDragging) return;
  
  // Ignore clicks on action buttons
  if (event.target.closest('.grip-cell-actions')) return;
  
  event.stopPropagation();
  
  if (gripConnectMode) {
    if (gripConnectFromId && gripConnectFromId !== cellId) {
      // Complete connection - find best connection points
      const fromCell = gripCells.find(c => c.id === gripConnectFromId);
      const toCell = gripCells.find(c => c.id === cellId);
      
      if (fromCell && toCell) {
        const positions = findBestConnectionPoints(fromCell, toCell);
        createGripConnection(gripConnectFromId, positions.from, cellId, positions.to);
      }
      
      gripConnectFromId = null;
      gripConnectFromPosition = null;
      gripConnectMode = false;
      renderGripDiagramOverlay();
    } else if (!gripConnectFromId) {
      gripConnectFromId = cellId;
      renderGripCells();
    }
    return;
  }
  
  // Do NOT open editor on cell click - only when clicking the edit button
  // Just deselect if clicking on a different cell
  if (gripSelectedCellId && gripSelectedCellId !== cellId) {
    gripSelectedCellId = null;
    renderGripDiagramOverlay();
  }
}

function handleConnectionPointClick(cellId, position) {
  if (!gripConnectMode) {
    // Start connect mode from this specific point
    gripConnectMode = true;
    gripConnectFromId = cellId;
    gripConnectFromPosition = position;
    renderGripDiagramOverlay();
    return;
  }
  
  if (gripConnectFromId && gripConnectFromId !== cellId) {
    // Complete the connection
    const fromPosition = gripConnectFromPosition || 'right';
    createGripConnection(gripConnectFromId, fromPosition, cellId, position);
    gripConnectMode = false;
    gripConnectFromId = null;
    gripConnectFromPosition = null;
    renderGripDiagramOverlay();
  }
}

function handleConnectionClick(connectionIndex) {
  // Delete connection without confirm dialog for better UX
  gripConnections.splice(connectionIndex, 1);
  saveGripDiagramData(gripProjectIndex);
  renderGripConnections();
}

// Update all connection positions based on current cell positions
function updateConnectionPositions() {
  gripConnections.forEach((conn, index) => {
    const fromCell = gripCells.find(c => c.id === conn.fromId);
    const toCell = gripCells.find(c => c.id === conn.toId);
    
    if (fromCell && toCell) {
      const positions = findBestConnectionPoints(fromCell, toCell);
      gripConnections[index].fromPosition = positions.from;
      gripConnections[index].toPosition = positions.to;
    }
  });
  
  renderGripConnections();
}

function findBestConnectionPoints(fromCell, toCell) {
  const fromWidth = fromCell.width || DEFAULT_CELL_WIDTH;
  const fromHeight = fromCell.height || DEFAULT_CELL_HEIGHT;
  const toWidth = toCell.width || DEFAULT_CELL_WIDTH;
  const toHeight = toCell.height || DEFAULT_CELL_HEIGHT;
  
  const fromCenterX = fromCell.x + fromWidth / 2;
  const fromCenterY = fromCell.y + fromHeight / 2;
  const toCenterX = toCell.x + toWidth / 2;
  const toCenterY = toCell.y + toHeight / 2;
  
  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;
  
  let fromPos, toPos;
  
  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal dominant
    if (dx > 0) {
      fromPos = 'right';
      toPos = 'left';
    } else {
      fromPos = 'left';
      toPos = 'right';
    }
  } else {
    // Vertical dominant
    if (dy > 0) {
      fromPos = 'bottom';
      toPos = 'top';
    } else {
      fromPos = 'top';
      toPos = 'bottom';
    }
  }
  
  return { from: fromPos, to: toPos };
}

// ============================================
// Cell Operations
// ============================================

function addGripCell() {
  const canvas = document.getElementById('gripCanvas');
  const canvasWidth = canvas ? canvas.clientWidth : 800;
  const canvasHeight = canvas ? canvas.clientHeight : 600;
  
  // Calculate center position of visible canvas area
  const scrollLeft = canvas ? canvas.scrollLeft : 0;
  const scrollTop = canvas ? canvas.scrollTop : 0;
  
  // Start cells near center of canvas
  let x = scrollLeft + (canvasWidth / 2) - (DEFAULT_CELL_WIDTH / 2);
  let y = scrollTop + (canvasHeight / 2) - (DEFAULT_CELL_HEIGHT / 2);
  
  // Offset based on number of cells to avoid overlap
  const offset = (gripCells.length % 5) * 40;
  x += offset;
  y += offset;
  
  // Ensure minimum position
  x = Math.max(50, x);
  y = Math.max(50, y);
  
  const newCell = {
    id: gripNextCellId++,
    x: x,
    y: y,
    width: DEFAULT_CELL_WIDTH,
    height: DEFAULT_CELL_HEIGHT,
    title: `Cell ${gripNextCellId - 1}`,
    content: '',
    comment: '',
    headerColor: GRIP_COLORS[Math.floor(Math.random() * GRIP_COLORS.length)]
  };
  
  gripCells.push(newCell);
  saveGripDiagramData(gripProjectIndex);
  renderGripCells();
  renderGripConnections();
}

function deleteGripCell(cellId) {
  if (!confirm('Delete this cell and all its connections?')) return;
  
  gripCells = gripCells.filter(c => c.id !== cellId);
  gripConnections = gripConnections.filter(c => c.fromId !== cellId && c.toId !== cellId);
  gripSelectedCellId = null;
  
  saveGripDiagramData(gripProjectIndex);
  renderGripDiagramOverlay();
}

function deselectGripCell() {
  gripSelectedCellId = null;
  renderGripDiagramOverlay();
}

function updateGripCellTitle(cellId, title) {
  const cellIndex = gripCells.findIndex(c => c.id === cellId);
  if (cellIndex !== -1) {
    gripCells[cellIndex].title = title;
    
    // Update just the title element without full re-render
    const cellElement = document.getElementById(`gripCell-${cellId}`);
    if (cellElement) {
      const titleEl = cellElement.querySelector('.grip-cell-title');
      if (titleEl) titleEl.textContent = title || 'Untitled';
    }
    
    saveGripDiagramData(gripProjectIndex);
  }
}

function updateGripCellContent(cellId, content) {
  const cellIndex = gripCells.findIndex(c => c.id === cellId);
  if (cellIndex !== -1) {
    gripCells[cellIndex].content = content;
    
    // Update just the content element without full re-render
    const cellElement = document.getElementById(`gripCell-${cellId}`);
    if (cellElement) {
      const contentEl = cellElement.querySelector('.grip-cell-content');
      if (contentEl) contentEl.textContent = content || 'Click to edit...';
    }
    
    saveGripDiagramData(gripProjectIndex);
  }
}

function updateGripCellComment(cellId, comment) {
  const cellIndex = gripCells.findIndex(c => c.id === cellId);
  if (cellIndex !== -1) {
    gripCells[cellIndex].comment = comment;
    saveGripDiagramData(gripProjectIndex);
    // Re-render cells to show/hide comment indicator
    renderGripCells();
  }
}

function updateGripCellSize(cellId, width, height) {
  const cellIndex = gripCells.findIndex(c => c.id === cellId);
  if (cellIndex !== -1) {
    gripCells[cellIndex].width = width;
    gripCells[cellIndex].height = height;
    
    const cellElement = document.getElementById(`gripCell-${cellId}`);
    if (cellElement) {
      cellElement.style.width = `${width}px`;
      cellElement.style.minHeight = `${height}px`;
    }
    
    saveGripDiagramData(gripProjectIndex);
    renderGripConnections();
  }
}

function updateGripCellColor(cellId, color) {
  const cellIndex = gripCells.findIndex(c => c.id === cellId);
  if (cellIndex !== -1) {
    gripCells[cellIndex].headerColor = color;
    
    // Update the header color
    const cellElement = document.getElementById(`gripCell-${cellId}`);
    if (cellElement) {
      const headerEl = cellElement.querySelector('.grip-cell-header');
      if (headerEl) headerEl.style.background = color;
    }
    
    // Update color picker active state
    document.querySelectorAll('#gripColorPicker .grip-color-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === color);
    });
    
    saveGripDiagramData(gripProjectIndex);
  }
}

// ============================================
// Connection Operations
// ============================================

function toggleGripConnectMode() {
  gripConnectMode = !gripConnectMode;
  gripConnectFromId = null;
  gripConnectFromPosition = null;
  renderGripDiagramOverlay();
}

function createGripConnection(fromId, fromPosition, toId, toPosition) {
  // Check if connection already exists
  const exists = gripConnections.some(c => 
    (c.fromId === fromId && c.toId === toId) || 
    (c.fromId === toId && c.toId === fromId)
  );
  
  if (!exists) {
    gripConnections.push({
      fromId,
      fromPosition,
      toId,
      toPosition
    });
    saveGripDiagramData(gripProjectIndex);
    renderGripConnections();
  }
}

// Make functions globally available
window.openGripDiagram = openGripDiagram;
window.closeGripDiagram = closeGripDiagram;

// ============================================
// AI Chat Assistant Functions
// ============================================
let aiChatMessages = [];

function setupAiChatListeners() {
  const toggleBtn = document.getElementById('gripAiChatToggle');
  const closeBtn = document.getElementById('gripAiChatClose');
  const sendBtn = document.getElementById('gripAiSend');
  const input = document.getElementById('gripAiInput');
  
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleAiChat);
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const chat = document.getElementById('gripAiChat');
      if (chat) chat.style.display = 'none';
    });
  }
  
  if (sendBtn) {
    sendBtn.addEventListener('click', handleAiSend);
  }
  
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleAiSend();
    });
  }
}

function toggleAiChat() {
  const chat = document.getElementById('gripAiChat');
  if (chat) {
    chat.style.display = chat.style.display === 'none' ? 'flex' : 'none';
  }
}

function handleAiSend() {
  const input = document.getElementById('gripAiInput');
  const messagesContainer = document.getElementById('gripAiMessages');
  
  if (!input || !messagesContainer) return;
  
  const message = input.value.trim();
  if (!message) return;
  
  // Add user message
  const userMsg = document.createElement('div');
  userMsg.className = 'grip-ai-message user';
  userMsg.textContent = message;
  messagesContainer.appendChild(userMsg);
  
  input.value = '';
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Show typing indicator
  const typingMsg = document.createElement('div');
  typingMsg.className = 'grip-ai-message assistant typing';
  typingMsg.id = 'aiTyping';
  typingMsg.innerHTML = '<span></span><span></span><span></span>';
  messagesContainer.appendChild(typingMsg);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Simulate AI response after delay
  setTimeout(() => {
    const typing = document.getElementById('aiTyping');
    if (typing) typing.remove();
    
    const response = generateAiResponse(message);
    const aiMsg = document.createElement('div');
    aiMsg.className = 'grip-ai-message assistant';
    aiMsg.textContent = response;
    messagesContainer.appendChild(aiMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 1000 + Math.random() * 1000);
}

function generateAiResponse(userMessage) {
  const msg = userMessage.toLowerCase();
  
  // Website/App help responses
  
  // Greetings
  if (msg.includes('hi') || msg.includes('hello') || msg.includes('hey')) {
    const greetings = ["Hey! How can I help you with Layer today?", "Hi there! What do you need help with?", "Hey! I'm here to assist with any questions about the app."];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
  
  // Project creation
  if (msg.includes('create project') || msg.includes('new project') || msg.includes('add project')) {
    return "To create a new project: Go to the 'Activity' tab in the sidebar, then click 'Create project' button. Fill in the name, target date, and any notes you want to add.";
  }
  
  // Tasks
  if (msg.includes('add task') || msg.includes('create task') || msg.includes('new task')) {
    return "To add a task: Open a project, scroll to the Tasks section, and type in the '+ Add a task...' input at the bottom of any column. Press Enter to add it.";
  }
  
  // Columns
  if (msg.includes('column') || msg.includes('kanban')) {
    return "You can add columns by clicking 'Add Column' button in the Tasks section. Rename columns by clicking on their title. Delete them with the X button.";
  }
  
  // Grid/Diagram help
  if (msg.includes('grid') || msg.includes('diagram') || msg.includes('flowchart') || msg.includes('cell')) {
    return "The Grip Diagram lets you create visual flowcharts. Click 'Add Cell' to create blocks, drag them to position. Use 'Connect' to draw lines between cells. Click on a connection to remove it.";
  }
  
  // Issues
  if (msg.includes('issue') || msg.includes('bug') || msg.includes('problem')) {
    return "To track issues: Go to 'My issues' in the sidebar. Click 'New Issue' to create one. You can set priority, status, and description. Filter issues using the tabs at the top.";
  }
  
  // Schedule/Calendar
  if (msg.includes('schedule') || msg.includes('calendar') || msg.includes('event')) {
    return "The Schedule view shows a calendar. Click on any day to add a task/event. Drag tasks between days to reschedule. Click a task to expand details or delete it.";
  }
  
  // Backlog
  if (msg.includes('backlog')) {
    return "The Backlog is for tasks you haven't started yet. Add tasks there, check them off when done. Great for brain dumps and future planning.";
  }
  
  // Theme
  if (msg.includes('theme') || msg.includes('dark') || msg.includes('light') || msg.includes('color')) {
    return "Change themes in Settings! We have multiple options: Dark, Light, Liquid Glass, Coffee, Pink, Purple, Ocean, and more. Just select from the dropdown.";
  }
  
  // Comments
  if (msg.includes('comment') || msg.includes('update') || msg.includes('message')) {
    return "You can add comments in the project sidebar under 'Team Comments & Updates'. Choose Normal or Important message type, then post your update. Others can reply or react!";
  }
  
  // Team/Members
  if (msg.includes('team') || msg.includes('member') || msg.includes('invite') || msg.includes('collaborate')) {
    return "To add team members: Open a project, look for the team icons in the sidebar, click the + button to invite by email. Team members will appear as overlapping avatars.";
  }
  
  // Priority
  if (msg.includes('priority')) {
    return "To set project priority: In the project sidebar, click on the Priority badge. Choose High, Medium, or Low. Priority is color-coded: Red=High, Yellow=Medium, Green=Low.";
  }
  
  // Target date
  if (msg.includes('target') || msg.includes('deadline') || msg.includes('due date')) {
    return "To change the target date: In project properties sidebar, click on the date. A modal will pop up where you can pick a new date and save.";
  }
  
  // Documents
  if (msg.includes('document') || msg.includes('upload') || msg.includes('pdf') || msg.includes('file')) {
    return "You can upload documents to share with your team! In the project sidebar, find 'Share Document', click to upload PDFs or docs. They'll appear in a list for easy access.";
  }
  
  // Progress
  if (msg.includes('progress') || msg.includes('chart') || msg.includes('graph')) {
    return "The progress chart at the bottom of project details shows task completion over the past 4 weeks. Hover over points to see exact numbers. The circular progress in sidebar shows overall completion.";
  }
  
  // Status
  if (msg.includes('status')) {
    return "Project status is automatic! 0% = To Do, 1-99% = In Progress, 100% = Done. Complete tasks to update the status automatically.";
  }
  
  // Export/Import
  if (msg.includes('export') || msg.includes('backup') || msg.includes('import')) {
    return "Go to Settings to export all your data as JSON backup. You can also import from a previous backup file. Great for keeping your work safe!";
  }
  
  // Delete
  if (msg.includes('delete') || msg.includes('remove')) {
    return "Delete projects with the trash icon in project header. Delete tasks with the X button. Delete columns with the X in their header. Be careful - deletes are permanent!";
  }
  
  // Settings
  if (msg.includes('setting')) {
    return "Settings has: Theme selection, Data export/import, and Reset option. Access it from the sidebar (gear icon).";
  }
  
  // Connection/Link removal
  if (msg.includes('connection') || msg.includes('link') || msg.includes('line') || msg.includes('arrow')) {
    return "To remove a connection in the Grid Diagram: Simply click on the connection line. It will highlight in red, then click to delete it.";
  }
  
  // Thank you
  if (msg.includes('thank') || msg.includes('thanks')) {
    return "You're welcome! Let me know if you need anything else! 😊";
  }
  
  // Help
  if (msg.includes('help') || msg.includes('what can you') || msg.includes('how do') || msg.includes('how to')) {
    return "I can help with: creating projects & tasks, using the grid diagram, managing team members, changing themes, uploading documents, understanding the progress chart, and more! What do you need?";
  }
  
  // Default responses
  const defaults = [
    "I can help with any Layer feature! Try asking about projects, tasks, themes, team, or the grid diagram.",
    "What would you like to do? I can guide you through any feature.",
    "Need help navigating? Just ask about specific features like 'how to add tasks' or 'how to change theme'.",
    "I'm here to help! Ask me about any feature in Layer.",
    "Try asking: 'How do I create a project?' or 'How to add team members?'"
  ];
  
  return defaults[Math.floor(Math.random() * defaults.length)];
}

// ============================================
// Tools Sidebar Functions
// ============================================

function setupToolsListeners() {
  // Bottom toolbar tools (new ClickUp style)
  const toolbarTools = document.querySelectorAll('.toolbar-tool[data-tool]');
  toolbarTools.forEach(btn => {
    btn.addEventListener('click', () => {
      gripActiveTool = btn.dataset.tool;
      gripSelectedTextBoxId = null;
      renderGripDiagramOverlay();
    });
  });
  
  // Legacy tool buttons (sidebar)
  const toolBtns = document.querySelectorAll('.grip-tool-btn[data-tool]');
  toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      gripActiveTool = btn.dataset.tool;
      gripSelectedTextBoxId = null;
      renderGripDiagramOverlay();
    });
  });
  
  // Canvas events for tools
  const canvas = document.getElementById('gripCanvas');
  if (canvas) {
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('click', handleCanvasClick);
  }
  
  // Zoom controls
  const zoomIn = document.getElementById('zoomIn');
  const zoomOut = document.getElementById('zoomOut');
  const zoomLevel = document.getElementById('zoomLevel');
  
  if (zoomIn) {
    zoomIn.addEventListener('click', () => {
      // Placeholder for zoom functionality
      if (zoomLevel) zoomLevel.textContent = '110%';
    });
  }
  
  if (zoomOut) {
    zoomOut.addEventListener('click', () => {
      // Placeholder for zoom functionality
      if (zoomLevel) zoomLevel.textContent = '90%';
    });
  }
  
  // Text box style controls
  const fontSizeSelect = document.getElementById('gripFontSize');
  const boldBtn = document.getElementById('gripBoldBtn');
  const italicBtn = document.getElementById('gripItalicBtn');
  const highlightBtn = document.getElementById('gripHighlightBtn');
  const deleteTextBtn = document.getElementById('gripDeleteTextBox');
  
  if (fontSizeSelect && gripSelectedTextBoxId) {
    const textBox = gripTextBoxes.find(t => t.id === gripSelectedTextBoxId);
    if (textBox) {
      fontSizeSelect.value = textBox.fontSize || '16';
    }
    fontSizeSelect.addEventListener('change', () => {
      updateTextBoxStyle(gripSelectedTextBoxId, { fontSize: parseInt(fontSizeSelect.value) });
    });
  }
  
  if (boldBtn) {
    boldBtn.addEventListener('click', () => {
      const textBox = gripTextBoxes.find(t => t.id === gripSelectedTextBoxId);
      if (textBox) {
        updateTextBoxStyle(gripSelectedTextBoxId, { bold: !textBox.bold });
      }
    });
  }
  
  if (italicBtn) {
    italicBtn.addEventListener('click', () => {
      const textBox = gripTextBoxes.find(t => t.id === gripSelectedTextBoxId);
      if (textBox) {
        updateTextBoxStyle(gripSelectedTextBoxId, { italic: !textBox.italic });
      }
    });
  }
  
  if (highlightBtn) {
    highlightBtn.addEventListener('click', () => {
      const textBox = gripTextBoxes.find(t => t.id === gripSelectedTextBoxId);
      if (textBox) {
        updateTextBoxStyle(gripSelectedTextBoxId, { highlight: !textBox.highlight });
      }
    });
  }
  
  if (deleteTextBtn) {
    deleteTextBtn.addEventListener('click', () => {
      deleteTextBox(gripSelectedTextBoxId);
    });
  }
}

function handleCanvasMouseDown(e) {
  const canvas = document.getElementById('gripCanvas');
  if (!canvas) return;
  
  // Pan mode - start panning
  if (gripActiveTool === 'pan') {
    if (e.target === canvas || e.target.classList.contains('grip-cells-layer') || e.target.classList.contains('grip-textboxes-layer')) {
      gripIsPanning = true;
      gripPanStart = { x: e.clientX, y: e.clientY };
      gripScrollStart = { x: canvas.scrollLeft, y: canvas.scrollTop };
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
    }
  }
}

function handleCanvasClick(e) {
  const canvas = document.getElementById('gripCanvas');
  if (!canvas) return;
  
  // Text tool - create text box on click
  if (gripActiveTool === 'text') {
    if (e.target === canvas || e.target.classList.contains('grip-cells-layer') || e.target.classList.contains('grip-textboxes-layer')) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left + canvas.scrollLeft;
      const y = e.clientY - rect.top + canvas.scrollTop;
      createTextBox(x, y);
    }
  }
  
  // Deselect text box when clicking empty space
  if (gripActiveTool === 'select') {
    if (e.target === canvas || e.target.classList.contains('grip-cells-layer') || e.target.classList.contains('grip-textboxes-layer')) {
      if (gripSelectedTextBoxId) {
        gripSelectedTextBoxId = null;
        renderGripDiagramOverlay();
      }
    }
  }
}

// ============================================
// Text Box Functions
// ============================================

function createTextBox(x, y) {
  // Ensure text boxes are positioned correctly within the canvas
  const canvas = document.getElementById('gripCanvas');
  const scrollLeft = canvas ? canvas.scrollLeft : 0;
  const scrollTop = canvas ? canvas.scrollTop : 0;
  
  const textBox = {
    id: gripNextTextBoxId++,
    x: Math.max(10, x),
    y: Math.max(10, y),
    text: 'Click to edit',
    fontSize: 16,
    bold: false,
    italic: false,
    highlight: false
  };
  
  gripTextBoxes.push(textBox);
  gripSelectedTextBoxId = textBox.id;
  gripActiveTool = 'select';
  saveGripDiagramData(gripProjectIndex);
  renderGripDiagramOverlay();
}

function renderGripTextBoxes() {
  const container = document.getElementById('gripTextBoxesContainer');
  if (!container) return;
  
  container.innerHTML = gripTextBoxes.map(textBox => {
    const isSelected = gripSelectedTextBoxId === textBox.id;
    const styles = [
      `left: ${textBox.x}px`,
      `top: ${textBox.y}px`,
      `font-size: ${textBox.fontSize || 16}px`,
      textBox.bold ? 'font-weight: bold' : '',
      textBox.italic ? 'font-style: italic' : '',
      textBox.highlightColor ? `background: ${textBox.highlightColor}` : ''
    ].filter(Boolean).join('; ');
    
    return `
      <div class="grip-text-box ${isSelected ? 'selected' : ''}"
           id="gripTextBox-${textBox.id}"
           data-textbox-id="${textBox.id}"
           style="${styles}"
           contenteditable="true"
           spellcheck="false">${textBox.text}</div>
    `;
  }).join('');
  
  // Attach event listeners
  gripTextBoxes.forEach(textBox => {
    const element = document.getElementById(`gripTextBox-${textBox.id}`);
    if (element) {
      element.addEventListener('mousedown', (e) => handleTextBoxMouseDown(e, textBox.id));
      element.addEventListener('blur', (e) => {
        updateTextBoxContent(textBox.id, e.target.textContent);
      });
      element.addEventListener('click', (e) => {
        e.stopPropagation();
        gripSelectedTextBoxId = textBox.id;
        gripActiveTool = 'select';
        renderGripDiagramOverlay();
      });
    }
  });
}

function handleTextBoxMouseDown(e, textBoxId) {
  if (e.target.isContentEditable && document.activeElement === e.target) {
    return; // Allow text editing
  }
  
  e.stopPropagation();
  gripSelectedTextBoxId = textBoxId;
  gripDraggingTextBoxId = textBoxId;
  
  const textBox = gripTextBoxes.find(t => t.id === textBoxId);
  if (textBox) {
    gripTextBoxDragOffset = {
      x: e.clientX - textBox.x,
      y: e.clientY - textBox.y
    };
  }
  
  renderGripDiagramOverlay();
}

function updateTextBoxContent(textBoxId, text) {
  const index = gripTextBoxes.findIndex(t => t.id === textBoxId);
  if (index !== -1) {
    gripTextBoxes[index].text = text || 'Click to edit';
    saveGripDiagramData(gripProjectIndex);
  }
}

function updateTextBoxStyle(textBoxId, styles) {
  const index = gripTextBoxes.findIndex(t => t.id === textBoxId);
  if (index !== -1) {
    Object.assign(gripTextBoxes[index], styles);
    saveGripDiagramData(gripProjectIndex);
    renderGripTextBoxes();
  }
}

function deleteTextBox(textBoxId) {
  const index = gripTextBoxes.findIndex(t => t.id === textBoxId);
  if (index !== -1) {
    gripTextBoxes.splice(index, 1);
    gripSelectedTextBoxId = null;
    saveGripDiagramData(gripProjectIndex);
    renderGripDiagramOverlay();
  }
}

// Update mouse move handler to include text box dragging, panning, images, and connection drag
const originalHandleGripMouseMove = handleGripMouseMove;
handleGripMouseMove = function(e) {
  // Handle connection dragging
  if (gripIsDraggingConnection) {
    handleConnectionDragMove(e);
    return;
  }
  
  // Handle image dragging
  if (gripDraggingImageId) {
    const canvas = document.getElementById('gripCanvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left + canvas.scrollLeft) / gripZoomLevel - gripImageDragOffset.x;
    const y = (e.clientY - rect.top + canvas.scrollTop) / gripZoomLevel - gripImageDragOffset.y;
    const imgIndex = gripImages.findIndex(i => i.id === gripDraggingImageId);
    if (imgIndex !== -1) {
      gripImages[imgIndex].x = Math.max(0, x);
      gripImages[imgIndex].y = Math.max(0, y);
      const el = document.getElementById(`gripImage-${gripDraggingImageId}`);
      if (el) {
        el.style.left = `${gripImages[imgIndex].x}px`;
        el.style.top = `${gripImages[imgIndex].y}px`;
      }
    }
    return;
  }
  
  // Handle image resizing
  if (gripResizingImageId) {
    const deltaX = e.clientX - gripImageResizeStartPos.x;
    const deltaY = e.clientY - gripImageResizeStartPos.y;
    const imgIndex = gripImages.findIndex(i => i.id === gripResizingImageId);
    if (imgIndex !== -1) {
      gripImages[imgIndex].width = Math.max(50, gripImageResizeStartSize.width + deltaX);
      gripImages[imgIndex].height = Math.max(50, gripImageResizeStartSize.height + deltaY);
      const el = document.getElementById(`gripImage-${gripResizingImageId}`);
      if (el) {
        el.style.width = `${gripImages[imgIndex].width}px`;
        el.style.height = `${gripImages[imgIndex].height}px`;
      }
    }
    return;
  }
  
  // Handle panning
  if (gripIsPanning) {
    const canvas = document.getElementById('gripCanvas');
    if (canvas) {
      const dx = e.clientX - gripPanStart.x;
      const dy = e.clientY - gripPanStart.y;
      canvas.scrollLeft = gripScrollStart.x - dx;
      canvas.scrollTop = gripScrollStart.y - dy;
    }
    return;
  }
  
  // Handle text box dragging
  if (gripDraggingTextBoxId) {
    const canvas = document.getElementById('gripCanvas');
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + canvas.scrollLeft - gripTextBoxDragOffset.x + rect.left;
    const y = e.clientY - rect.top + canvas.scrollTop - gripTextBoxDragOffset.y + rect.top;
    
    const index = gripTextBoxes.findIndex(t => t.id === gripDraggingTextBoxId);
    if (index !== -1) {
      gripTextBoxes[index].x = Math.max(0, x);
      gripTextBoxes[index].y = Math.max(0, y);
      
      const element = document.getElementById(`gripTextBox-${gripDraggingTextBoxId}`);
      if (element) {
        element.style.left = `${gripTextBoxes[index].x}px`;
        element.style.top = `${gripTextBoxes[index].y}px`;
      }
    }
    return;
  }
  
  // Call original handler for cell dragging
  if (typeof originalHandleGripMouseMove === 'function') {
    originalHandleGripMouseMove.call(this, e);
  }
};

// Update mouse up handler
const originalHandleGripMouseUp = handleGripMouseUp;
handleGripMouseUp = function(e) {
  // Handle connection drag end
  if (gripIsDraggingConnection) {
    handleConnectionDragEnd(e);
    return;
  }
  
  // Handle image drag end
  if (gripDraggingImageId) {
    saveGripDiagramData(gripProjectIndex);
    gripDraggingImageId = null;
  }
  
  // Handle image resize end
  if (gripResizingImageId) {
    saveGripDiagramData(gripProjectIndex);
    gripResizingImageId = null;
  }
  
  // Handle panning end
  if (gripIsPanning) {
    gripIsPanning = false;
    const canvas = document.getElementById('gripCanvas');
    if (canvas) {
      canvas.style.cursor = gripActiveTool === 'pan' ? 'grab' : '';
    }
  }
  
  // Handle text box drag end
  if (gripDraggingTextBoxId) {
    saveGripDiagramData(gripProjectIndex);
    gripDraggingTextBoxId = null;
  }
  
  // Call original handler
  if (typeof originalHandleGripMouseUp === 'function') {
    originalHandleGripMouseUp.call(this, e);
  }
};

// ============================================
// Zoom Functions
// ============================================

function setupZoomListeners() {
  const zoomIn = document.getElementById('zoomIn');
  const zoomOut = document.getElementById('zoomOut');
  const zoomLevelBtn = document.getElementById('zoomLevelBtn');
  const fitToScreenBtn = document.getElementById('fitToScreenBtn');
  const canvas = document.getElementById('gripCanvas');
  
  if (zoomIn) {
    zoomIn.addEventListener('click', () => {
      const currentIndex = ZOOM_LEVELS.findIndex(z => z >= gripZoomLevel);
      if (currentIndex < ZOOM_LEVELS.length - 1) {
        gripZoomLevel = ZOOM_LEVELS[currentIndex + 1];
        applyZoom();
      }
    });
  }
  
  if (zoomOut) {
    zoomOut.addEventListener('click', () => {
      const currentIndex = ZOOM_LEVELS.findIndex(z => z >= gripZoomLevel);
      if (currentIndex > 0) {
        gripZoomLevel = ZOOM_LEVELS[currentIndex - 1];
        applyZoom();
      }
    });
  }
  
  if (zoomLevelBtn) {
    zoomLevelBtn.addEventListener('click', () => {
      gripZoomLevel = 1;
      applyZoom();
    });
  }
  
  if (fitToScreenBtn) {
    fitToScreenBtn.addEventListener('click', fitToScreen);
  }
  
  // Mouse wheel zoom
  if (canvas) {
    canvas.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        gripZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, gripZoomLevel + delta));
        applyZoom();
      }
    }, { passive: false });
  }
}

function applyZoom() {
  const transform = document.getElementById('gripCanvasTransform');
  const zoomLevel = document.getElementById('zoomLevel');
  
  if (transform) {
    transform.style.transform = `scale(${gripZoomLevel})`;
  }
  
  if (zoomLevel) {
    zoomLevel.textContent = `${Math.round(gripZoomLevel * 100)}%`;
  }
}

function fitToScreen() {
  if (gripCells.length === 0) {
    gripZoomLevel = 1;
    applyZoom();
    return;
  }
  
  const canvas = document.getElementById('gripCanvas');
  if (!canvas) return;
  
  // Find bounds of all cells
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  gripCells.forEach(cell => {
    minX = Math.min(minX, cell.x);
    minY = Math.min(minY, cell.y);
    maxX = Math.max(maxX, cell.x + (cell.width || DEFAULT_CELL_WIDTH));
    maxY = Math.max(maxY, cell.y + (cell.height || DEFAULT_CELL_HEIGHT));
  });
  
  const contentWidth = maxX - minX + 100;
  const contentHeight = maxY - minY + 100;
  const canvasWidth = canvas.clientWidth - 100;
  const canvasHeight = canvas.clientHeight - 100;
  
  const scaleX = canvasWidth / contentWidth;
  const scaleY = canvasHeight / contentHeight;
  gripZoomLevel = Math.max(MIN_ZOOM, Math.min(1.5, Math.min(scaleX, scaleY)));
  
  applyZoom();
  
  // Scroll to center content
  canvas.scrollLeft = (minX - 50) * gripZoomLevel;
  canvas.scrollTop = (minY - 50) * gripZoomLevel;
}

// ============================================
// Backlog Functions
// ============================================

function setupBacklogListeners() {
  const toggleBacklogBtn = document.getElementById('toggleBacklogBtn');
  const closeBacklogBtn = document.getElementById('closeBacklogBtn');
  const addBacklogItemBtn = document.getElementById('addBacklogItemBtn');
  const backlogSearchInput = document.getElementById('backlogSearchInput');
  
  if (toggleBacklogBtn) {
    toggleBacklogBtn.addEventListener('click', () => {
      gripBacklogOpen = !gripBacklogOpen;
      renderGripDiagramOverlay();
    });
  }
  
  if (closeBacklogBtn) {
    closeBacklogBtn.addEventListener('click', () => {
      gripBacklogOpen = false;
      renderGripDiagramOverlay();
    });
  }
  
  if (addBacklogItemBtn) {
    addBacklogItemBtn.addEventListener('click', addNewBacklogItem);
  }
  
  if (backlogSearchInput) {
    backlogSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const items = document.querySelectorAll('.backlog-item');
      items.forEach(item => {
        const title = item.querySelector('.backlog-item-title')?.textContent.toLowerCase() || '';
        const desc = item.querySelector('.backlog-item-desc')?.textContent.toLowerCase() || '';
        item.style.display = (title.includes(query) || desc.includes(query)) ? 'block' : 'none';
      });
    });
  }
  
  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      gripBacklogFilter = btn.dataset.filter;
      renderGripDiagramOverlay();
    });
  });
  
  // Add to board buttons
  document.querySelectorAll('.backlog-add-to-board').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = parseInt(btn.dataset.itemId);
      addBacklogItemToBoard(itemId);
    });
  });
  
  // Backlog item drag
  document.querySelectorAll('.backlog-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', item.dataset.itemId);
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });
  });
}

function addNewBacklogItem() {
  const newItem = {
    id: Date.now(),
    title: 'New Task',
    description: 'Click to edit description',
    status: 'todo',
    priority: 'medium',
    assignee: 'Unassigned',
    dueDate: new Date().toISOString().split('T')[0],
    tags: []
  };
  gripBacklogItems.unshift(newItem);
  saveGripDiagramData(gripProjectIndex);
  renderGripDiagramOverlay();
}

function addBacklogItemToBoard(itemId) {
  const item = gripBacklogItems.find(i => i.id === itemId);
  if (!item) return;
  
  const canvas = document.getElementById('gripCanvas');
  const scrollLeft = canvas ? canvas.scrollLeft : 0;
  const scrollTop = canvas ? canvas.scrollTop : 0;
  
  const newCell = {
    id: gripNextCellId++,
    title: item.title,
    content: item.description,
    x: 100 + scrollLeft / gripZoomLevel + Math.random() * 100,
    y: 100 + scrollTop / gripZoomLevel + Math.random() * 100,
    headerColor: item.priority === 'high' ? '#ef4444' : item.priority === 'medium' ? '#f59e0b' : '#22c55e',
    width: DEFAULT_CELL_WIDTH,
    height: DEFAULT_CELL_HEIGHT,
    comment: `Status: ${item.status}\nAssignee: ${item.assignee}\nDue: ${item.dueDate}`
  };
  
  gripCells.push(newCell);
  saveGripDiagramData(gripProjectIndex);
  renderGripDiagramOverlay();
}

// ============================================
// Selection Functions
// ============================================

function selectAllCells() {
  gripSelectedCellIds = gripCells.map(c => c.id);
  gripSelectedCellId = gripSelectedCellIds.length > 0 ? gripSelectedCellIds[0] : null;
  renderGripDiagramOverlay();
}

function clearSelection() {
  gripSelectedCellIds = [];
  gripSelectedCellId = null;
  renderGripDiagramOverlay();
}

function deleteSelectedCells() {
  if (gripSelectedCellIds.length === 0) return;
  
  gripSelectedCellIds.forEach(id => {
    const index = gripCells.findIndex(c => c.id === id);
    if (index !== -1) gripCells.splice(index, 1);
    // Remove related connections
    gripConnections = gripConnections.filter(conn => conn.fromId !== id && conn.toId !== id);
  });
  
  gripSelectedCellIds = [];
  gripSelectedCellId = null;
  saveGripDiagramData(gripProjectIndex);
  renderGripDiagramOverlay();
}

function duplicateSelectedCells() {
  if (gripSelectedCellIds.length === 0) return;
  
  const newCellIds = [];
  gripSelectedCellIds.forEach(id => {
    const original = gripCells.find(c => c.id === id);
    if (original) {
      const newCell = {
        ...original,
        id: gripNextCellId++,
        x: original.x + 30,
        y: original.y + 30
      };
      gripCells.push(newCell);
      newCellIds.push(newCell.id);
    }
  });
  
  gripSelectedCellIds = newCellIds;
  gripSelectedCellId = newCellIds.length > 0 ? newCellIds[0] : null;
  saveGripDiagramData(gripProjectIndex);
  renderGripDiagramOverlay();
}

// ============================================
// Keyboard Shortcuts
// ============================================

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', handleKeyboardShortcut);
}

function handleKeyboardShortcut(e) {
  if (!gripDiagramOpen) return;
  
  // Don't trigger if typing in input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
  
  const key = e.key.toLowerCase();
  
  // Select All (Ctrl/Cmd + A)
  if ((e.ctrlKey || e.metaKey) && key === 'a') {
    e.preventDefault();
    selectAllCells();
    return;
  }
  
  // Delete (Delete or Backspace)
  if (key === 'delete' || key === 'backspace') {
    if (gripSelectedCellIds.length > 0) {
      e.preventDefault();
      deleteSelectedCells();
    } else if (gripSelectedCellId) {
      e.preventDefault();
      deleteGripCell(gripSelectedCellId);
    }
    return;
  }
  
  // Duplicate (Ctrl/Cmd + D)
  if ((e.ctrlKey || e.metaKey) && key === 'd') {
    e.preventDefault();
    if (gripSelectedCellIds.length > 0) {
      duplicateSelectedCells();
    }
    return;
  }
  
  // Zoom In (+)
  if (key === '+' || key === '=') {
    const currentIndex = ZOOM_LEVELS.findIndex(z => z >= gripZoomLevel);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      gripZoomLevel = ZOOM_LEVELS[currentIndex + 1];
      applyZoom();
    }
    return;
  }
  
  // Zoom Out (-)
  if (key === '-') {
    const currentIndex = ZOOM_LEVELS.findIndex(z => z >= gripZoomLevel);
    if (currentIndex > 0) {
      gripZoomLevel = ZOOM_LEVELS[currentIndex - 1];
      applyZoom();
    }
    return;
  }
  
  // Reset Zoom (0)
  if (key === '0') {
    gripZoomLevel = 1;
    applyZoom();
    return;
  }
  
  // Tool shortcuts
  if (key === 'v') {
    gripActiveTool = 'select';
    renderGripDiagramOverlay();
  } else if (key === 'h') {
    gripActiveTool = 'pan';
    renderGripDiagramOverlay();
  } else if (key === 't') {
    gripActiveTool = 'text';
    renderGripDiagramOverlay();
  } else if (key === 'a' && !e.ctrlKey && !e.metaKey) {
    // Toggle arrow/connect mode
    toggleGripConnectMode();
  } else if (key === 'escape') {
    if (gripConnectMode) {
      gripConnectMode = false;
      gripConnectFromId = null;
      gripConnectFromPosition = null;
    }
    clearSelection();
  }
}

// Selection button listeners
function setupSelectionListeners() {
  const selectAllBtn = document.getElementById('selectAllBtn');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  const duplicateSelectedBtn = document.getElementById('duplicateSelectedBtn');
  const clearSelectionBtn = document.getElementById('clearSelectionBtn');
  
  if (selectAllBtn) selectAllBtn.addEventListener('click', selectAllCells);
  if (deleteSelectedBtn) deleteSelectedBtn.addEventListener('click', deleteSelectedCells);
  if (duplicateSelectedBtn) duplicateSelectedBtn.addEventListener('click', duplicateSelectedCells);
  if (clearSelectionBtn) clearSelectionBtn.addEventListener('click', clearSelection);
}

// Update setupGripEventListeners to include selection
const originalSetupGripEventListeners = setupGripEventListeners;
setupGripEventListeners = function() {
  originalSetupGripEventListeners();
  setupSelectionListeners();
};

// ============================================
// Project Detail AI Chat (shared instance)
// ============================================
window.projectDetailAiChatOpen = false;

function renderProjectDetailAiChat() {
  return `
    <!-- AI Chat Toggle Button -->
    <button type="button" class="project-ai-chat-toggle" id="projectAiChatToggle" onclick="toggleProjectDetailAiChat()" title="AI Project Assistant">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/>
      </svg>
    </button>
    
    <!-- AI Chat Box -->
    <div class="project-ai-chat" id="projectAiChat" style="display: none;">
      <div class="grip-ai-chat-header">
        <h4>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" y1="9" x2="9.01" y2="9"/>
            <line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
          Project Assistant
        </h4>
        <button type="button" class="grip-ai-chat-close" onclick="toggleProjectDetailAiChat()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="grip-ai-chat-messages" id="projectAiMessages">
        <div class="grip-ai-message assistant">
          Hey! I'm here to help with your senior project. What do you need?
        </div>
      </div>
      <div class="grip-ai-chat-input">
        <input type="text" id="projectAiInput" placeholder="Ask me anything..." onkeypress="if(event.key==='Enter')handleProjectAiSend()" />
        <button type="button" class="grip-ai-chat-send" onclick="handleProjectAiSend()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function toggleProjectDetailAiChat() {
  const chat = document.getElementById('projectAiChat');
  if (chat) {
    chat.style.display = chat.style.display === 'none' ? 'flex' : 'none';
  }
}

function handleProjectAiSend() {
  const input = document.getElementById('projectAiInput');
  const messagesContainer = document.getElementById('projectAiMessages');
  
  if (!input || !messagesContainer) return;
  
  const message = input.value.trim();
  if (!message) return;
  
  // Add user message
  const userMsg = document.createElement('div');
  userMsg.className = 'grip-ai-message user';
  userMsg.textContent = message;
  messagesContainer.appendChild(userMsg);
  
  input.value = '';
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Show typing indicator
  const typingMsg = document.createElement('div');
  typingMsg.className = 'grip-ai-message assistant typing';
  typingMsg.id = 'projectAiTyping';
  typingMsg.innerHTML = '<span></span><span></span><span></span>';
  messagesContainer.appendChild(typingMsg);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Simulate AI response
  setTimeout(() => {
    const typing = document.getElementById('projectAiTyping');
    if (typing) typing.remove();
    
    const response = generateAiResponse(message);
    const aiMsg = document.createElement('div');
    aiMsg.className = 'grip-ai-message assistant';
    aiMsg.textContent = response;
    messagesContainer.appendChild(aiMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 800 + Math.random() * 800);
}

// Make functions globally available
window.renderProjectDetailAiChat = renderProjectDetailAiChat;
window.toggleProjectDetailAiChat = toggleProjectDetailAiChat;
window.handleProjectAiSend = handleProjectAiSend;

// ============================================
// Helper Functions
// ============================================

function getSelectedCellHasConnections() {
  if (!gripSelectedCellId) return false;
  return gripConnections.some(c => c.fromId === gripSelectedCellId || c.toId === gripSelectedCellId);
}

function renderTextFormattingToolbar() {
  const textBox = gripTextBoxes.find(t => t.id === gripSelectedTextBoxId);
  if (!textBox) return '';
  
  return `
    <div class="toolbar-group toolbar-text-format">
      <div class="toolbar-divider"></div>
      
      <select id="textSizeSelect" class="toolbar-select" title="Font Size">
        <option value="12" ${textBox.fontSize === 12 ? 'selected' : ''}>12px</option>
        <option value="14" ${textBox.fontSize === 14 ? 'selected' : ''}>14px</option>
        <option value="16" ${textBox.fontSize === 16 ? 'selected' : ''}>16px</option>
        <option value="20" ${textBox.fontSize === 20 ? 'selected' : ''}>20px</option>
        <option value="24" ${textBox.fontSize === 24 ? 'selected' : ''}>24px</option>
        <option value="32" ${textBox.fontSize === 32 ? 'selected' : ''}>32px</option>
        <option value="48" ${textBox.fontSize === 48 ? 'selected' : ''}>48px</option>
      </select>
      
      <button type="button" class="toolbar-tool ${textBox.bold ? 'active' : ''}" id="textBoldBtn" title="Bold">
        <strong>B</strong>
      </button>
      
      <button type="button" class="toolbar-tool ${textBox.italic ? 'active' : ''}" id="textItalicBtn" title="Italic">
        <em>I</em>
      </button>
      
      <div class="toolbar-divider"></div>
      
      <div class="highlight-picker" id="highlightPicker">
        <button type="button" class="toolbar-tool" id="highlightBtn" title="Highlight Color" style="${textBox.highlightColor ? 'background:' + textBox.highlightColor : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
          </svg>
        </button>
        <div class="highlight-dropdown" id="highlightDropdown" style="display: none;">
          <button type="button" class="highlight-option" data-color="" title="No highlight" style="background: transparent; border: 1px dashed #666;">✕</button>
          ${HIGHLIGHT_COLORS.map(c => `
            <button type="button" class="highlight-option ${textBox.highlightColor === c.value ? 'active' : ''}" 
                    data-color="${c.value}" 
                    title="${c.name}" 
                    style="background: ${c.value}"></button>
          `).join('')}
        </div>
      </div>
      
      <div class="toolbar-divider"></div>
      
      <button type="button" class="toolbar-tool" id="deleteTextBtn" title="Delete Text" style="color: #ef4444;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m5 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
        </svg>
      </button>
    </div>
  `;
}

// ============================================
// Image Functions
// ============================================

function renderGripImages() {
  const container = document.getElementById('gripImagesContainer');
  if (!container) return;
  
  container.innerHTML = gripImages.map(img => {
    const isSelected = gripSelectedImageId === img.id;
    return `
      <div class="grip-image ${isSelected ? 'selected' : ''}"
           id="gripImage-${img.id}"
           data-image-id="${img.id}"
           style="left: ${img.x}px; top: ${img.y}px; width: ${img.width}px; height: ${img.height}px;">
        <img src="${img.src}" alt="${img.name || 'Image'}" draggable="false" />
        ${isSelected ? `
          <div class="grip-image-actions">
            <button type="button" class="grip-image-delete" data-image-id="${img.id}" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m5 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
          </div>
          <div class="grip-image-resize-handle grip-resize-se" data-image-id="${img.id}"></div>
        ` : ''}
      </div>
    `;
  }).join('');
  
  // Attach event listeners
  gripImages.forEach(img => {
    const element = document.getElementById(`gripImage-${img.id}`);
    if (element) {
      element.addEventListener('mousedown', (e) => handleImageMouseDown(e, img.id));
      element.addEventListener('click', (e) => {
        e.stopPropagation();
        gripSelectedImageId = img.id;
        gripSelectedTextBoxId = null;
        gripSelectedCellId = null;
        renderGripDiagramOverlay();
      });
      
      const deleteBtn = element.querySelector('.grip-image-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteGripImage(img.id);
        });
        deleteBtn.addEventListener('mousedown', (e) => e.stopPropagation());
      }
      
      const resizeHandle = element.querySelector('.grip-image-resize-handle');
      if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', (e) => handleImageResizeStart(e, img.id));
      }
    }
  });
}

function handleImageMouseDown(e, imageId) {
  if (e.target.closest('.grip-image-actions') || e.target.closest('.grip-image-resize-handle')) return;
  
  e.stopPropagation();
  gripSelectedImageId = imageId;
  gripDraggingImageId = imageId;
  
  const img = gripImages.find(i => i.id === imageId);
  if (img) {
    const canvas = document.getElementById('gripCanvas');
    const rect = canvas.getBoundingClientRect();
    gripImageDragOffset = {
      x: (e.clientX - rect.left + canvas.scrollLeft) / gripZoomLevel - img.x,
      y: (e.clientY - rect.top + canvas.scrollTop) / gripZoomLevel - img.y
    };
  }
  
  renderGripDiagramOverlay();
}

function handleImageResizeStart(e, imageId) {
  e.stopPropagation();
  e.preventDefault();
  
  gripResizingImageId = imageId;
  const img = gripImages.find(i => i.id === imageId);
  if (img) {
    gripImageResizeStartSize = { width: img.width, height: img.height };
    gripImageResizeStartPos = { x: e.clientX, y: e.clientY };
  }
}

function deleteGripImage(imageId) {
  gripImages = gripImages.filter(i => i.id !== imageId);
  gripSelectedImageId = null;
  saveGripDiagramData(gripProjectIndex);
  renderGripDiagramOverlay();
}

function setupImageListeners() {
  const imageBtn = document.getElementById('gripImageBtn');
  const imageInput = document.getElementById('gripImageInput');
  
  if (imageBtn) {
    imageBtn.addEventListener('click', () => {
      imageInput?.click();
    });
  }
  
  if (imageInput) {
    imageInput.addEventListener('change', handleImageUpload);
  }
  
  // Delete links button
  const deleteLinksBtn = document.getElementById('deleteLinksBtn');
  if (deleteLinksBtn) {
    deleteLinksBtn.addEventListener('click', () => {
      if (gripSelectedCellId) {
        gripConnections = gripConnections.filter(c => 
          c.fromId !== gripSelectedCellId && c.toId !== gripSelectedCellId
        );
        saveGripDiagramData(gripProjectIndex);
        renderGripDiagramOverlay();
      }
    });
  }
  
  // Text formatting listeners
  setupTextFormattingListeners();
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.getElementById('gripCanvas');
      const scrollLeft = canvas ? canvas.scrollLeft : 0;
      const scrollTop = canvas ? canvas.scrollTop : 0;
      
      // Scale image to max 300px while maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      const maxSize = 300;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      const newImage = {
        id: gripNextImageId++,
        x: 100 + scrollLeft / gripZoomLevel,
        y: 100 + scrollTop / gripZoomLevel,
        width: width,
        height: height,
        src: event.target.result,
        name: file.name
      };
      
      gripImages.push(newImage);
      gripSelectedImageId = newImage.id;
      saveGripDiagramData(gripProjectIndex);
      renderGripDiagramOverlay();
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
  
  // Reset input
  e.target.value = '';
}

// ============================================
// Text Formatting Functions
// ============================================

function setupTextFormattingListeners() {
  const sizeSelect = document.getElementById('textSizeSelect');
  const boldBtn = document.getElementById('textBoldBtn');
  const italicBtn = document.getElementById('textItalicBtn');
  const highlightBtn = document.getElementById('highlightBtn');
  const highlightDropdown = document.getElementById('highlightDropdown');
  const deleteTextBtn = document.getElementById('deleteTextBtn');
  
  if (sizeSelect) {
    sizeSelect.addEventListener('change', (e) => {
      if (gripSelectedTextBoxId) {
        updateTextBoxStyle(gripSelectedTextBoxId, { fontSize: parseInt(e.target.value) });
        renderGripDiagramOverlay();
      }
    });
  }
  
  if (boldBtn) {
    boldBtn.addEventListener('click', () => {
      if (gripSelectedTextBoxId) {
        const textBox = gripTextBoxes.find(t => t.id === gripSelectedTextBoxId);
        if (textBox) {
          updateTextBoxStyle(gripSelectedTextBoxId, { bold: !textBox.bold });
          renderGripDiagramOverlay();
        }
      }
    });
  }
  
  if (italicBtn) {
    italicBtn.addEventListener('click', () => {
      if (gripSelectedTextBoxId) {
        const textBox = gripTextBoxes.find(t => t.id === gripSelectedTextBoxId);
        if (textBox) {
          updateTextBoxStyle(gripSelectedTextBoxId, { italic: !textBox.italic });
          renderGripDiagramOverlay();
        }
      }
    });
  }
  
  if (highlightBtn && highlightDropdown) {
    highlightBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      highlightDropdown.style.display = highlightDropdown.style.display === 'none' ? 'flex' : 'none';
    });
    
    highlightDropdown.querySelectorAll('.highlight-option').forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = option.dataset.color || null;
        if (gripSelectedTextBoxId) {
          updateTextBoxStyle(gripSelectedTextBoxId, { highlightColor: color });
          highlightDropdown.style.display = 'none';
          renderGripDiagramOverlay();
        }
      });
    });
    
    // Close dropdown on outside click
    document.addEventListener('click', () => {
      if (highlightDropdown) highlightDropdown.style.display = 'none';
    });
  }
  
  if (deleteTextBtn) {
    deleteTextBtn.addEventListener('click', () => {
      if (gripSelectedTextBoxId) {
        deleteTextBox(gripSelectedTextBoxId);
      }
    });
  }
}

// ============================================
// Connection Drag-to-Connect
// ============================================

function handleConnectionPointMouseDown(e, cellId, position) {
  e.stopPropagation();
  e.preventDefault();
  
  gripIsDraggingConnection = true;
  gripConnectFromId = cellId;
  gripConnectFromPosition = position;
  
  const cell = gripCells.find(c => c.id === cellId);
  if (cell) {
    gripConnectionDragStart = getCellConnectionPoint(cell, position);
    gripConnectionDragEnd = { ...gripConnectionDragStart };
  }
  
  renderGripDiagramOverlay();
}

function handleConnectionDragMove(e) {
  if (!gripIsDraggingConnection) return;
  
  const canvas = document.getElementById('gripCanvas');
  if (!canvas) return;
  
  const rect = canvas.getBoundingClientRect();
  gripConnectionDragEnd = {
    x: (e.clientX - rect.left + canvas.scrollLeft) / gripZoomLevel,
    y: (e.clientY - rect.top + canvas.scrollTop) / gripZoomLevel
  };
  
  renderGripConnections();
}

function handleConnectionDragEnd(e) {
  if (!gripIsDraggingConnection) return;
  
  const canvas = document.getElementById('gripCanvas');
  if (!canvas) return;
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left + canvas.scrollLeft) / gripZoomLevel;
  const mouseY = (e.clientY - rect.top + canvas.scrollTop) / gripZoomLevel;
  
  // Find if we're over a cell
  let targetCellId = null;
  let targetPosition = null;
  
  for (const cell of gripCells) {
    if (cell.id === gripConnectFromId) continue;
    
    const cellWidth = cell.width || DEFAULT_CELL_WIDTH;
    const cellHeight = cell.height || DEFAULT_CELL_HEIGHT;
    
    if (mouseX >= cell.x && mouseX <= cell.x + cellWidth &&
        mouseY >= cell.y && mouseY <= cell.y + cellHeight) {
      targetCellId = cell.id;
      // Determine best connection position based on where we dropped
      const relX = mouseX - cell.x;
      const relY = mouseY - cell.y;
      
      const distTop = relY;
      const distBottom = cellHeight - relY;
      const distLeft = relX;
      const distRight = cellWidth - relX;
      
      const minDist = Math.min(distTop, distBottom, distLeft, distRight);
      if (minDist === distTop) targetPosition = 'top';
      else if (minDist === distBottom) targetPosition = 'bottom';
      else if (minDist === distLeft) targetPosition = 'left';
      else targetPosition = 'right';
      
      break;
    }
  }
  
  if (targetCellId && gripConnectFromId) {
    createGripConnection(gripConnectFromId, gripConnectFromPosition, targetCellId, targetPosition);
  }
  
  gripIsDraggingConnection = false;
  gripConnectFromId = null;
  gripConnectFromPosition = null;
  gripConnectionDragStart = null;
  gripConnectionDragEnd = null;
  
  renderGripDiagramOverlay();
}
