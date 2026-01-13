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
let gripEraserMode = false; // NEW: Eraser mode for deleting connections
let gripDragAnimationFrame = null; // For smooth dragging with requestAnimationFrame
let gripLastDragTime = 0; // Throttle drag updates

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

// Minimap state
let gripMinimapMinimized = false;

// Multi-select dragging state
let gripIsMultiDragging = false;
let gripMultiDragStartPositions = {};

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

// Lightweight update function that preserves scroll position
function updateGripUI() {
  renderGripCells();
  renderGripConnections();
  renderGripTextBoxes();
  renderGripImages();
  renderMinimap();
  updateToolbarState();
}

// Update toolbar visual state without full re-render
function updateToolbarState() {
  // Update tool buttons
  document.querySelectorAll('.grip-tool-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === gripActiveTool);
  });
  
  // Update eraser button
  const eraserBtn = document.getElementById('eraserModeBtn');
  if (eraserBtn) {
    eraserBtn.classList.toggle('active', gripEraserMode);
  }
  
  // Update connect button
  const connectBtn = document.getElementById('connectModeBtn');
  if (connectBtn) {
    connectBtn.classList.toggle('active', gripConnectMode);
  }
  
  // Update canvas classes
  const canvas = document.getElementById('gripCanvas');
  if (canvas) {
    canvas.classList.toggle('pan-mode', gripActiveTool === 'pan');
    canvas.classList.toggle('eraser-mode', gripEraserMode);
  }
}

// Open the cell editor panel without full re-render
function openCellEditor(cellId) {
  const cell = gripCells.find(c => c.id === cellId);
  if (!cell) return;
  
  // Check if editor already exists
  let editor = document.getElementById('gripCellEditor');
  if (!editor) {
    // Create editor container in sidebar
    const sidebar = document.querySelector('.grip-diagram-sidebar');
    if (sidebar) {
      const editorHtml = renderGripCellEditor();
      sidebar.insertAdjacentHTML('afterbegin', editorHtml);
    }
  }
  setTimeout(setupEditorEventListeners, 0);
}

// Close the cell editor panel without full re-render
function closeCellEditor() {
  const editor = document.getElementById('gripCellEditor');
  if (editor) {
    editor.remove();
  }
}

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
      <!-- Professional Enhanced Header -->
      <div class="grip-diagram-header clickup-header">
        <div class="grip-header-left">
          <button type="button" class="grip-back-btn" id="gripBackBtn" title="Back to project">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div class="header-divider"></div>
          <div class="whiteboard-title">
            <div class="whiteboard-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18"/>
                <path d="M9 21V9"/>
              </svg>
            </div>
            <div class="whiteboard-title-content">
              <h2>Whiteboard</h2>
              <span class="whiteboard-subtitle">${gripCells.length} cells • ${gripConnections.length} connections</span>
            </div>
          </div>
        </div>
        <div class="grip-header-center">
          <!-- Quick Actions with better styling -->
          <div class="header-action-group">
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
              <span class="action-label-desktop">Fit View</span>
            </button>
            <button type="button" class="header-action-btn" id="centerViewBtn" title="Center View">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
          <div class="header-divider"></div>
          <button type="button" class="header-action-btn ${gripBacklogOpen ? 'active' : ''}" id="toggleBacklogBtn" title="Toggle Backlog">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <path d="M9 12h6M9 16h6"/>
            </svg>
            <span>Backlog</span>
            <span class="backlog-count">${backlogStats.todo + backlogStats.in_progress}</span>
          </button>
          <button type="button" class="header-action-btn ${whiteboardDocSidebarOpen ? 'active' : ''}" id="whiteboardDocToggleBtn" onclick="toggleWhiteboardDocSidebar()" title="View linked documents">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span>Docs</span>
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
          <div class="header-divider"></div>
          <button class="header-icon-btn" id="undoBtn" title="Undo (Ctrl+Z)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 7v6h6"/>
              <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6.36 2.64L3 13"/>
            </svg>
          </button>
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
        <!-- Split View Container -->
        <div class="whiteboard-split-container ${whiteboardSplitViewDocId ? 'split-mode' : ''}" id="whiteboardSplitContainer">
          <!-- Canvas Area -->
          <div class="grip-canvas-wrapper ${gripBacklogOpen ? 'with-backlog' : ''}">
            <div class="grip-diagram-canvas clickup-canvas ${gripActiveTool === 'pan' ? 'pan-mode' : ''} ${gripEraserMode ? 'eraser-mode' : ''}" id="gripCanvas">
              <div class="grip-canvas-transform" id="gripCanvasTransform" style="transform: scale(${gripZoomLevel}); transform-origin: 0 0;">
                <svg class="grip-connections-layer" id="gripConnectionsSvg"></svg>
                <div class="grip-cells-layer" id="gripCellsContainer"></div>
                <div class="grip-images-layer" id="gripImagesContainer"></div>
                <div class="grip-textboxes-layer" id="gripTextBoxesContainer"></div>
              </div>
            ${gripIsDraggingConnection ? '<div class="grip-connect-hint">Release on another cell to connect</div>' : ''}
              ${gripEraserMode ? '<div class="grip-eraser-hint">Click on connections to delete them • Press E or Esc to exit</div>' : ''}
            </div>
            
            <!-- Minimap -->
            <div class="grip-minimap ${gripMinimapMinimized ? 'minimized' : ''}" id="gripMinimap">
              <div class="minimap-header">
                <span class="minimap-title">Minimap</span>
                <button class="minimap-toggle" id="minimapToggleBtn" title="${gripMinimapMinimized ? 'Expand' : 'Minimize'}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    ${gripMinimapMinimized ? '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>' : '<path d="M4 14h6v6M14 4h6v6M20 10l-6 6M4 14l6-6"/>'}
                  </svg>
                </button>
              </div>
              <div class="minimap-content" id="minimapContent">
                <canvas id="minimapCanvas" width="180" height="120"></canvas>
                <div class="minimap-viewport" id="minimapViewport"></div>
              </div>
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
            
            <!-- Whiteboard Document Sidebar (When not in split mode) -->
            <div class="whiteboard-doc-sidebar ${whiteboardDocSidebarOpen && !whiteboardSplitViewDocId ? 'open' : ''}" id="whiteboardDocSidebar">
              <div class="whiteboard-doc-header">
                <span class="whiteboard-doc-sidebar-title">Linked Documents</span>
                <button class="whiteboard-doc-close" onclick="toggleWhiteboardDocSidebar()">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <div class="whiteboard-doc-content" id="whiteboardDocContent">
                <!-- Content populated by updateWhiteboardDocSidebar() -->
              </div>
            </div>
          </div>
          
          <!-- Document Panel (Split View) -->
          <div class="whiteboard-doc-panel ${whiteboardSplitViewDocId ? '' : 'hidden'}" id="whiteboardDocPanel">
            <!-- Content populated by updateSplitViewPanel() -->
          </div>
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
      
      <!-- Bottom Toolbar - Minimalistic with smooth animations -->
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
          
          <div class="toolbar-dropdown-wrapper" id="cellTypeDropdown">
            <button type="button" class="toolbar-tool toolbar-tool-task" id="gripAddBtn" title="Add Cell">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M12 8v8M8 12h8"/>
              </svg>
              <span class="toolbar-label">Add</span>
              <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            <div class="toolbar-dropup-menu" id="cellTypeMenu">
              <button type="button" class="dropup-item" onclick="addGripCell(); closeCellTypeMenu();">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M9 12l2 2 4-4"/>
                </svg>
                <div class="dropup-item-content">
                  <span>Task Cell</span>
                  <small>Simple task card</small>
                </div>
              </button>
              <button type="button" class="dropup-item" onclick="addDrawerCell(); closeCellTypeMenu();">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="8" y1="9" x2="16" y2="9"/>
                  <line x1="8" y1="13" x2="16" y2="13"/>
                  <line x1="8" y1="17" x2="16" y2="17"/>
                </svg>
                <div class="dropup-item-content">
                  <span>Drawer Cell</span>
                  <small>List with connectable items</small>
                </div>
              </button>
              <button type="button" class="dropup-item" onclick="addCodeContainerCell(); closeCellTypeMenu();">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="16 18 22 12 16 6"/>
                  <polyline points="8 6 2 12 8 18"/>
                </svg>
                <div class="dropup-item-content">
                  <span>Code Container</span>
                  <small>Code snippet block</small>
                </div>
              </button>
            </div>
          </div>
          
          <button type="button" class="toolbar-tool ${gripConnectMode ? 'active' : ''}" id="gripConnectBtn" title="Connect (A)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
          
          <button type="button" class="toolbar-tool ${gripEraserMode ? 'active toolbar-tool-eraser-active' : ''}" id="gripEraserBtn" title="Eraser - Click connections to delete (E)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 20H9"/>
              <path d="M16.466 6.534a5 5 0 0 1 0 7.07L12 18.07l-4.536-4.536a5 5 0 0 1 7.07-7.07l.93.93.932-.93a5 5 0 0 1 7.07 0l-7 7.07z"/>
              <path d="m9.568 15.568 3.5-3.5"/>
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
          <button type="button" class="toolbar-tool toolbar-tool-danger" id="deleteLinksBtn" title="Delete All Links">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
          ` : ''}
        </div>
        
        ${gripSelectedTextBoxId ? renderTextFormattingToolbar() : ''}
        
        <div class="toolbar-group toolbar-extras">
          <button type="button" class="toolbar-tool toolbar-ai" id="gripAiChatToggle" title="AI Assistant">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/>
              <path d="M8 10h.01M12 10h.01M16 10h.01"/>
            </svg>
          </button>
        </div>
      </div>
      
      ${gripSelectedCellId ? renderGripCellEditor() : ''}
      
      <!-- AI Chat Backdrop -->
      <div class="grip-ai-chat-backdrop" id="gripAiChatBackdrop"></div>
      
      <!-- AI Chat Sidebar (Left) -->
      <div class="grip-ai-chat" id="gripAiChat">
        <div class="grip-ai-chat-header">
          <div class="grip-ai-chat-brand">
            <svg class="grip-ai-brain-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 2a4 4 0 0 1 4 4c0 1.1-.9 2-2 2h-4a2 2 0 0 1-2-2 4 4 0 0 1 4-4z"/>
              <path d="M8 8v1a4 4 0 0 0 8 0V8"/>
              <path d="M12 12v10"/>
              <path d="M8 17h8"/>
              <circle cx="12" cy="5" r="1"/>
            </svg>
            <h4>Project Assistant</h4>
          </div>
          <button type="button" class="grip-ai-chat-close" id="gripAiChatClose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="grip-ai-chat-messages" id="gripAiMessages">
          <div class="grip-ai-welcome">
            Hi! I'm your project assistant. Ask me anything about your diagram, tasks, or let me help you brainstorm ideas.
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
  renderMinimap();
  setupMinimapListeners();
}

// ============================================
// Minimap Functions
// ============================================

function renderMinimap() {
  const canvas = document.getElementById('minimapCanvas');
  const minimapContent = document.getElementById('minimapContent');
  if (!canvas || !minimapContent || gripMinimapMinimized) return;
  
  const ctx = canvas.getContext('2d');
  const canvasEl = document.getElementById('gripCanvas');
  if (!canvasEl) return;
  
  // Clear canvas
  ctx.fillStyle = '#1a1a1b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (gripCells.length === 0) {
    ctx.fillStyle = '#3f3f46';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No cells', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  // Find bounds of all cells
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  gripCells.forEach(cell => {
    minX = Math.min(minX, cell.x);
    minY = Math.min(minY, cell.y);
    maxX = Math.max(maxX, cell.x + (cell.width || 200));
    maxY = Math.max(maxY, cell.y + (cell.height || 120));
  });
  
  // Add padding
  const padding = 50;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX += padding;
  maxY += padding;
  
  const contentWidth = maxX - minX || 1;
  const contentHeight = maxY - minY || 1;
  
  // Calculate scale to fit in minimap
  const scaleX = canvas.width / contentWidth;
  const scaleY = canvas.height / contentHeight;
  const scale = Math.min(scaleX, scaleY, 0.15);
  
  // Store scale for viewport calculation
  canvas.dataset.scale = scale;
  canvas.dataset.offsetX = minX;
  canvas.dataset.offsetY = minY;
  canvas.dataset.contentWidth = contentWidth;
  canvas.dataset.contentHeight = contentHeight;
  
  // Draw connections
  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 1;
  gripConnections.forEach(conn => {
    const fromCell = gripCells.find(c => c.id === conn.fromId);
    const toCell = gripCells.find(c => c.id === conn.toId);
    if (fromCell && toCell) {
      const fromX = (fromCell.x + (fromCell.width || 200) / 2 - minX) * scale;
      const fromY = (fromCell.y + (fromCell.height || 120) / 2 - minY) * scale;
      const toX = (toCell.x + (toCell.width || 200) / 2 - minX) * scale;
      const toY = (toCell.y + (toCell.height || 120) / 2 - minY) * scale;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
    }
  });
  
  // Draw cells
  gripCells.forEach(cell => {
    const x = (cell.x - minX) * scale;
    const y = (cell.y - minY) * scale;
    const w = (cell.width || 200) * scale;
    const h = (cell.height || 120) * scale;
    
    // Draw cell
    ctx.fillStyle = cell.headerColor || '#3b82f6';
    ctx.fillRect(x, y, Math.max(w, 3), Math.max(h, 3));
    
    // Highlight selected cells
    if (gripSelectedCellIds.includes(cell.id) || gripSelectedCellId === cell.id) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, Math.max(w, 3), Math.max(h, 3));
    }
  });
  
  // Update viewport rectangle
  updateMinimapViewport();
}

function updateMinimapViewport() {
  const viewport = document.getElementById('minimapViewport');
  const canvas = document.getElementById('minimapCanvas');
  const canvasEl = document.getElementById('gripCanvas');
  
  if (!viewport || !canvas || !canvasEl) return;
  
  const scale = parseFloat(canvas.dataset.scale) || 0.1;
  const offsetX = parseFloat(canvas.dataset.offsetX) || 0;
  const offsetY = parseFloat(canvas.dataset.offsetY) || 0;
  
  // Calculate viewport position and size
  const viewX = (canvasEl.scrollLeft / gripZoomLevel - offsetX) * scale;
  const viewY = (canvasEl.scrollTop / gripZoomLevel - offsetY) * scale;
  const viewW = (canvasEl.clientWidth / gripZoomLevel) * scale;
  const viewH = (canvasEl.clientHeight / gripZoomLevel) * scale;
  
  viewport.style.left = Math.max(0, viewX) + 'px';
  viewport.style.top = Math.max(0, viewY) + 'px';
  viewport.style.width = Math.min(viewW, canvas.width - Math.max(0, viewX)) + 'px';
  viewport.style.height = Math.min(viewH, canvas.height - Math.max(0, viewY)) + 'px';
}

function setupMinimapListeners() {
  const toggleBtn = document.getElementById('minimapToggleBtn');
  const minimapCanvas = document.getElementById('minimapCanvas');
  const canvasEl = document.getElementById('gripCanvas');
  
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      gripMinimapMinimized = !gripMinimapMinimized;
      renderGripDiagramOverlay();
    });
  }
  
  // Click on minimap to navigate
  if (minimapCanvas) {
    minimapCanvas.addEventListener('click', (e) => {
      if (!canvasEl) return;
      
      const rect = minimapCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      const scale = parseFloat(minimapCanvas.dataset.scale) || 0.1;
      const offsetX = parseFloat(minimapCanvas.dataset.offsetX) || 0;
      const offsetY = parseFloat(minimapCanvas.dataset.offsetY) || 0;
      
      // Calculate target scroll position
      const targetX = (clickX / scale + offsetX) * gripZoomLevel - canvasEl.clientWidth / 2;
      const targetY = (clickY / scale + offsetY) * gripZoomLevel - canvasEl.clientHeight / 2;
      
      canvasEl.scrollTo({
        left: Math.max(0, targetX),
        top: Math.max(0, targetY),
        behavior: 'smooth'
      });
    });
  }
  
  // Update viewport on scroll
  if (canvasEl) {
    canvasEl.addEventListener('scroll', updateMinimapViewport);
  }
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
  const eraserBtn = document.getElementById('gripEraserBtn');
  const addBtn = document.getElementById('gripAddBtn');
  const cellTypeDropdown = document.getElementById('cellTypeDropdown');
  const centerViewBtn = document.getElementById('centerViewBtn');
  
  if (backBtn) backBtn.addEventListener('click', closeGripDiagram);
  if (connectBtn) connectBtn.addEventListener('click', toggleGripConnectMode);
  if (eraserBtn) eraserBtn.addEventListener('click', toggleGripEraserMode);
  if (centerViewBtn) centerViewBtn.addEventListener('click', centerCanvasView);
  
  // Add cell dropdown toggle
  if (addBtn && cellTypeDropdown) {
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCellTypeMenu();
    });
  }
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#cellTypeDropdown')) {
      closeCellTypeMenu();
    }
  });
  
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
        // Exit eraser mode on canvas click
        if (gripEraserMode && !e.target.closest('.grip-connection-group')) {
          // Keep eraser mode active, user may want to delete more
        }
      }
    });
  }
}

// Toggle eraser mode for deleting connections
function toggleGripEraserMode() {
  gripEraserMode = !gripEraserMode;
  // Disable connect mode when eraser is on
  if (gripEraserMode) {
    gripConnectMode = false;
    gripConnectFromId = null;
    gripConnectFromPosition = null;
  }
  updateToolbarState();
  updateGripUI();
}

// Center canvas view
function centerCanvasView() {
  const canvas = document.getElementById('gripCanvas');
  if (!canvas || gripCells.length === 0) return;
  
  // Find bounding box of all cells
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  gripCells.forEach(cell => {
    minX = Math.min(minX, cell.x);
    minY = Math.min(minY, cell.y);
    maxX = Math.max(maxX, cell.x + (cell.width || 200));
    maxY = Math.max(maxY, cell.y + (cell.height || 120));
  });
  
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  canvas.scrollLeft = centerX * gripZoomLevel - canvas.clientWidth / 2;
  canvas.scrollTop = centerY * gripZoomLevel - canvas.clientHeight / 2;
}

function renderGripCells() {
  const container = document.getElementById('gripCellsContainer');
  if (!container) return;

  container.innerHTML = gripCells.map(cell => {
    const width = cell.width || DEFAULT_CELL_WIDTH;
    const height = cell.height || DEFAULT_CELL_HEIGHT;
    const hasComment = cell.comment && cell.comment.trim().length > 0;
    const isDrawer = cell.isDrawer === true;
    const isCodeContainer = cell.isCodeContainer === true;
    
    // Render drawer items if this is a drawer cell - with left/right connection points and drag handle
    const drawerItemsHtml = isDrawer && cell.drawerItems ? cell.drawerItems.map((item, idx) => `
      <div class="drawer-item" data-cell-id="${cell.id}" data-item-id="${item.id}" data-item-index="${idx}" draggable="true" ondblclick="handleDrawerItemDoubleClick(event, ${cell.id}, ${item.id})">
        <div class="drawer-item-connection-point drawer-item-conn-left" data-cell-id="${cell.id}" data-item-id="${item.id}" data-position="item-left" title="Connect from left"></div>
        <div class="drawer-item-handle" data-cell-id="${cell.id}" data-item-id="${item.id}" title="Drag to reorder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;">
            <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
            <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
          </svg>
        </div>
        <span class="drawer-item-text" contenteditable="false" data-cell-id="${cell.id}" data-item-id="${item.id}" onclick="event.stopPropagation()">${item.text}</span>
        <button type="button" class="drawer-item-delete" onclick="deleteDrawerItem(${cell.id}, ${item.id})" title="Delete item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <div class="drawer-item-connection-point drawer-item-conn-right" data-cell-id="${cell.id}" data-item-id="${item.id}" data-position="item-right" title="Connect from right"></div>
      </div>
    `).join('') : '';
    
    const isMultiSelected = gripSelectedCellIds.includes(cell.id);
    
    // Determine cell class
    let cellClass = 'grip-cell';
    if (isDrawer) cellClass += ' grip-cell-drawer';
    if (isCodeContainer) cellClass += ' grip-cell-code';
    if (gripSelectedCellId === cell.id) cellClass += ' selected';
    if (isMultiSelected) cellClass += ' multi-selected';
    if (gripConnectMode) cellClass += ' connect-mode';
    if (gripConnectFromId === cell.id) cellClass += ' connect-from';
    
    return `
    <div class="${cellClass}"
         id="gripCell-${cell.id}"
         data-cell-id="${cell.id}"
         data-is-drawer="${isDrawer}"
         data-is-code="${isCodeContainer}"
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
        ${isDrawer ? '<span class="grip-cell-badge">Drawer</span>' : ''}
        ${isCodeContainer ? `
          <div class="grip-cell-code-header-right">
            <span class="grip-cell-code-lang" id="codeLang-${cell.id}">${detectCodeLanguage(cell.content || '')}</span>
            <button type="button" class="grip-cell-run-btn" onclick="event.stopPropagation(); runCode(${cell.id})" title="Run Code">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Run
            </button>
          </div>
        ` : ''}
      </div>
      
      ${isDrawer ? `
        <div class="drawer-items-container">
          ${drawerItemsHtml}
          <button type="button" class="drawer-add-item-btn" onclick="addDrawerItem(${cell.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Item
          </button>
        </div>
      ` : isCodeContainer ? `
        <div class="grip-cell-code-wrapper">
          <div class="grip-cell-code-content" contenteditable="true" spellcheck="false" data-cell-id="${cell.id}" 
               onclick="event.stopPropagation(); this.focus();"
               onmousedown="event.stopPropagation();"
               onfocus="this.classList.add('editing');"
               onblur="this.classList.remove('editing'); updateCodeCellContent(${cell.id}, this.innerText);"
               oninput="updateCodeLanguageDisplay(${cell.id})">${escapeHtml(cell.content || '// Enter code here')}</div>
          <div class="grip-cell-code-output" id="codeOutput-${cell.id}" style="display:none;">
            <div class="code-output-header">
              <span>Output</span>
              <button type="button" class="code-output-close" onclick="hideCodeOutput(${cell.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <pre class="code-output-content" id="codeOutputContent-${cell.id}"></pre>
          </div>
        </div>
      ` : `
        <div class="grip-cell-content">
          ${cell.content || 'Click to edit...'}
        </div>
      `}
      
      <!-- Connection Points - Drawer cells have all 4 connection points too for more flexibility -->
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
      
      // Connection points - drag to connect OR click to delete in eraser mode
      const connectionPoints = cellElement.querySelectorAll('.grip-cell-connection-point');
      connectionPoints.forEach(point => {
        point.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          const position = point.dataset.position;
          // In eraser mode, handle as click immediately
          if (gripEraserMode) {
            handleConnectionPointClick(cell.id, position);
            return;
          }
          handleConnectionPointMouseDown(e, cell.id, position);
        });
        // Also handle click for eraser mode
        point.addEventListener('click', (e) => {
          e.stopPropagation();
          if (gripEraserMode) {
            const position = point.dataset.position;
            handleConnectionPointClick(cell.id, position);
          }
        });
      });
      
      // Drawer item connection points - both left and right
      const drawerItemPoints = cellElement.querySelectorAll('.drawer-item-connection-point');
      drawerItemPoints.forEach(point => {
        point.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          const itemId = parseInt(point.dataset.itemId);
          const position = point.dataset.position || 'item-right';
          handleDrawerItemConnectionPointMouseDown(e, cell.id, itemId, position);
        });
      });
      
      // Setup drawer item drag-to-reorder
      if (cell.isDrawer) {
        setupDrawerItemDragListeners(cell.id);
      }
      
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
          // Immediately show editor without full re-render to prevent glitch
          const editorHtml = renderGripCellEditor();
          const existingEditor = document.getElementById('gripCellEditor');
          if (existingEditor) existingEditor.remove();
          document.querySelector('.grip-diagram-body')?.insertAdjacentHTML('beforeend', editorHtml);
          updateGripUI();
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
    // Make SVG large enough to cover all content even when zoomed out
    const minWidth = Math.max(canvas.scrollWidth, canvas.clientWidth, 4000) / gripZoomLevel;
    const minHeight = Math.max(canvas.scrollHeight, canvas.clientHeight, 4000) / gripZoomLevel;
    svg.setAttribute('width', minWidth);
    svg.setAttribute('height', minHeight);
    svg.style.width = minWidth + 'px';
    svg.style.height = minHeight + 'px';
  }

  let svgContent = '';
  
  // Add professional arrow marker definitions - ORANGE theme
  svgContent += `
    <defs>
      <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L8,3 z" fill="#f97316"/>
      </marker>
      <marker id="arrowhead-hover" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L8,3 z" fill="#dc2626"/>
      </marker>
      <marker id="arrowhead-drawer" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L8,3 z" fill="#fb923c"/>
      </marker>
      <marker id="arrowhead-drawer-hover" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L8,3 z" fill="#dc2626"/>
      </marker>
    </defs>
  `;

  gripConnections.forEach((conn, index) => {
    const fromCell = gripCells.find(c => c.id === conn.fromId);
    const toCell = gripCells.find(c => c.id === conn.toId);
    if (!fromCell || !toCell) return;

    // Check if this is a drawer item connection
    const isDrawerConnection = conn.fromItemId !== undefined;
    let fromPoint;
    
    if (isDrawerConnection) {
      fromPoint = getDrawerItemConnectionPoint(fromCell, conn.fromItemId, conn.fromPosition);
    } else {
      fromPoint = getCellConnectionPoint(fromCell, conn.fromPosition);
    }
    
    if (!fromPoint) return;
    
    const toPoint = getCellConnectionPoint(toCell, conn.toPosition);

    // Create a smooth bezier curve
    const dx = toPoint.x - fromPoint.x;
    const dy = toPoint.y - fromPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curvature = Math.min(dist * 0.4, 100);
    
    let cp1x, cp1y, cp2x, cp2y;
    
    // Calculate control points based on connection positions
    const fromPos = conn.fromPosition || 'right';
    switch (fromPos) {
      case 'right': 
      case 'item-right':
        cp1x = fromPoint.x + curvature; cp1y = fromPoint.y; break;
      case 'left': 
      case 'item-left':
        cp1x = fromPoint.x - curvature; cp1y = fromPoint.y; break;
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
    
    // Use ORANGE colors for connections - minimalistic look
    const strokeColor = isDrawerConnection ? '#fb923c' : '#f97316';
    const markerEnd = isDrawerConnection ? 'url(#arrowhead-drawer)' : 'url(#arrowhead)';

    // Calculate midpoint for delete button
    const midX = (fromPoint.x + toPoint.x) / 2;
    const midY = (fromPoint.y + toPoint.y) / 2;

    svgContent += `
      <g class="grip-connection-group ${isDrawerConnection ? 'drawer-connection' : ''}" data-connection-index="${index}" data-is-drawer="${isDrawerConnection}" data-stroke-color="${strokeColor}">
        <!-- Main path -->
        <path class="grip-connection-path" d="${path}" fill="none" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round" marker-end="${markerEnd}"/>
        <!-- Hit area for interaction -->
        <path d="${path}" fill="none" stroke="transparent" stroke-width="16" class="grip-connection-hitarea" data-index="${index}" style="cursor: pointer;"/>
        <!-- Start dot -->
        <circle cx="${fromPoint.x}" cy="${fromPoint.y}" r="3" fill="${strokeColor}" class="grip-connection-dot"/>
        <!-- Delete indicator (minus button - shows on hover) -->
        <g class="grip-connection-delete-indicator" style="opacity: 0; transition: opacity 0.15s; cursor: pointer;">
          <circle cx="${midX}" cy="${midY}" r="10" fill="#dc2626"/>
          <path d="M${midX - 4} ${midY} L${midX + 4} ${midY}" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </g>
      </g>
    `;
  });
  
  svg.innerHTML = svgContent;
  
  // Attach click handlers to connection hit areas and delete indicators
  svg.querySelectorAll('.grip-connection-group').forEach(group => {
    const hitArea = group.querySelector('.grip-connection-hitarea');
    const deleteIndicator = group.querySelector('.grip-connection-delete-indicator');
    const index = parseInt(group.dataset.connectionIndex);
    
    // Click on hit area deletes connection
    if (hitArea) {
      hitArea.addEventListener('click', (e) => {
        e.stopPropagation();
        handleConnectionClick(index);
      });
    }
    
    // Click on delete indicator also deletes connection
    if (deleteIndicator) {
      deleteIndicator.style.cursor = 'pointer';
      deleteIndicator.style.pointerEvents = 'auto';
      deleteIndicator.addEventListener('click', (e) => {
        e.stopPropagation();
        handleConnectionClick(index);
      });
    }
    
    // Add hover effect on hit area
    if (hitArea) {
      hitArea.addEventListener('mouseenter', () => {
        const isDrawer = group.dataset.isDrawer === 'true';
        group.querySelector('.grip-connection-path').style.stroke = '#dc2626';
        group.querySelector('.grip-connection-path').setAttribute('marker-end', isDrawer ? 'url(#arrowhead-drawer-hover)' : 'url(#arrowhead-hover)');
        group.querySelector('.grip-connection-dot').style.fill = '#dc2626';
        if (deleteIndicator) deleteIndicator.style.opacity = '1';
      });
      
      hitArea.addEventListener('mouseleave', (e) => {
        // Check if we're hovering over the delete indicator
        const relatedTarget = e.relatedTarget;
        if (relatedTarget && (deleteIndicator?.contains(relatedTarget) || relatedTarget.closest('.grip-connection-delete-indicator'))) {
          return; // Don't hide if moving to delete indicator
        }
        
        const isDrawer = group.dataset.isDrawer === 'true';
        const originalColor = group.dataset.strokeColor || (isDrawer ? '#fb923c' : '#f97316');
        group.querySelector('.grip-connection-path').style.stroke = originalColor;
        group.querySelector('.grip-connection-path').setAttribute('marker-end', isDrawer ? 'url(#arrowhead-drawer)' : 'url(#arrowhead)');
        group.querySelector('.grip-connection-dot').style.fill = originalColor;
        if (deleteIndicator) deleteIndicator.style.opacity = '0';
      });
    }
    
    // Keep delete indicator visible when hovering over it
    if (deleteIndicator) {
      deleteIndicator.addEventListener('mouseenter', () => {
        const isDrawer = group.dataset.isDrawer === 'true';
        group.querySelector('.grip-connection-path').style.stroke = '#dc2626';
        group.querySelector('.grip-connection-path').setAttribute('marker-end', isDrawer ? 'url(#arrowhead-drawer-hover)' : 'url(#arrowhead-hover)');
        group.querySelector('.grip-connection-dot').style.fill = '#dc2626';
        deleteIndicator.style.opacity = '1';
      });
      
      deleteIndicator.addEventListener('mouseleave', () => {
        const isDrawer = group.dataset.isDrawer === 'true';
        const originalColor = group.dataset.strokeColor || (isDrawer ? '#fb923c' : '#f97316');
        group.querySelector('.grip-connection-path').style.stroke = originalColor;
        group.querySelector('.grip-connection-path').setAttribute('marker-end', isDrawer ? 'url(#arrowhead-drawer)' : 'url(#arrowhead)');
        group.querySelector('.grip-connection-dot').style.fill = originalColor;
        deleteIndicator.style.opacity = '0';
      });
    }
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

// Get connection point for a drawer item (supports both left and right sides)
// Uses actual DOM element positions for accurate connection points
function getDrawerItemConnectionPoint(cell, itemId, position = 'item-right') {
  if (!cell || !cell.drawerItems) return null;
  
  const itemIndex = cell.drawerItems.findIndex(i => i.id === itemId);
  if (itemIndex === -1) return null;
  
  const cellWidth = cell.width || DEFAULT_CELL_WIDTH;
  
  // Try to get actual position from DOM element
  const cellElement = document.getElementById(`gripCell-${cell.id}`);
  const itemElement = cellElement?.querySelector(`[data-item-id="${itemId}"].drawer-item`);
  
  if (itemElement && cellElement) {
    const cellRect = cellElement.getBoundingClientRect();
    const itemRect = itemElement.getBoundingClientRect();
    const canvas = document.getElementById('gripCanvas');
    const canvasRect = canvas?.getBoundingClientRect();
    
    if (canvasRect && canvas) {
      // Calculate the item's center Y relative to canvas (accounting for zoom)
      const itemCenterY = ((itemRect.top + itemRect.height / 2 - canvasRect.top + canvas.scrollTop) / gripZoomLevel);
      
      if (position === 'item-left') {
        return {
          x: cell.x,
          y: itemCenterY
        };
      }
      
      return {
        x: cell.x + cellWidth,
        y: itemCenterY
      };
    }
  }
  
  // Fallback: Calculate position using fixed values
  const headerHeight = 40;
  const containerPadding = 10;
  const itemHeight = 46; // Height of each drawer item including gap
  const itemVerticalCenter = headerHeight + containerPadding + (itemIndex * itemHeight) + (itemHeight / 2) - 3;
  
  if (position === 'item-left') {
    return {
      x: cell.x,
      y: cell.y + itemVerticalCenter
    };
  }
  
  return {
    x: cell.x + cellWidth,
    y: cell.y + itemVerticalCenter
  };
}

function renderGripCellEditor() {
  const cell = gripCells.find(c => c.id === gripSelectedCellId);
  if (!cell) return '';

  const isCodeContainer = cell.isCodeContainer === true;

  // For code containers, show only Title, Comment, and Header Color
  if (isCodeContainer) {
    return `
      <div class="grip-cell-editor" id="gripCellEditor">
        <div class="grip-editor-header">
          <h3>Edit Code Cell</h3>
          <button type="button" class="grip-editor-close" id="gripEditorClose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="grip-editor-content">
          <div class="grip-editor-field">
            <label>Title</label>
            <input type="text" id="gripCellTitle" value="${cell.title || ''}" placeholder="Code cell title...">
          </div>
          <div class="grip-editor-field">
            <label>Comment (shows on hover)</label>
            <textarea id="gripCellComment" placeholder="Add a comment that appears when hovering...">${cell.comment || ''}</textarea>
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
          <p class="grip-editor-hint">Tip: Click directly in the code area on the cell to edit your code.</p>
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

  // Default editor for regular and drawer cells
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

  const isCodeContainer = cell.isCodeContainer === true;

  // Close button
  document.getElementById('gripEditorClose').addEventListener('click', deselectGripCell);
  
  // Title input
  document.getElementById('gripCellTitle').addEventListener('input', (e) => {
    updateGripCellTitle(cell.id, e.target.value);
  });
  
  // Content textarea - only for non-code cells
  const contentInput = document.getElementById('gripCellContent');
  if (contentInput && !isCodeContainer) {
    contentInput.addEventListener('input', (e) => {
      updateGripCellContent(cell.id, e.target.value);
    });
  }
  
  // Comment textarea
  const commentInput = document.getElementById('gripCellComment');
  if (commentInput) {
    commentInput.addEventListener('input', (e) => {
      updateGripCellComment(cell.id, e.target.value);
    });
  }
  
  // Size inputs - only for non-code cells
  if (!isCodeContainer) {
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

  const canvas = document.getElementById('gripCanvas');
  const canvasRect = canvas.getBoundingClientRect();
  
  // Handle Shift+Click for multi-select
  if (event.shiftKey) {
    if (gripSelectedCellIds.includes(cellId)) {
      gripSelectedCellIds = gripSelectedCellIds.filter(id => id !== cellId);
    } else {
      gripSelectedCellIds.push(cellId);
    }
    gripSelectedCellId = gripSelectedCellIds.length > 0 ? gripSelectedCellIds[0] : null;
    renderGripCells();
    return;
  }
  
  // Check if clicking on a cell that's part of multi-selection
  if (gripSelectedCellIds.includes(cellId) && gripSelectedCellIds.length > 1) {
    // Start multi-drag
    gripIsMultiDragging = true;
    gripDraggingCellId = cellId;
    gripIsDragging = false;
    
    // Store starting positions of all selected cells
    gripMultiDragStartPositions = {};
    gripSelectedCellIds.forEach(id => {
      const c = gripCells.find(cell => cell.id === id);
      if (c) {
        gripMultiDragStartPositions[id] = { x: c.x, y: c.y };
      }
    });
    
    // Calculate offset from click to the dragged cell position, accounting for zoom
    gripDragOffset = {
      x: (event.clientX - canvasRect.left + canvas.scrollLeft) / gripZoomLevel - cell.x,
      y: (event.clientY - canvasRect.top + canvas.scrollTop) / gripZoomLevel - cell.y
    };
    
    // Add dragging class to all selected cells
    gripSelectedCellIds.forEach(id => {
      const el = document.getElementById(`gripCell-${id}`);
      if (el) el.classList.add('dragging');
    });
    return;
  }

  gripDraggingCellId = cellId;
  gripIsDragging = false;
  gripIsMultiDragging = false;
  
  // Calculate drag offset accounting for zoom level
  gripDragOffset = {
    x: (event.clientX - canvasRect.left + canvas.scrollLeft) / gripZoomLevel - cell.x,
    y: (event.clientY - canvasRect.top + canvas.scrollTop) / gripZoomLevel - cell.y
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
  
  // Handle connection dragging
  if (gripIsDraggingConnection) {
    handleConnectionDragMove(event);
    return;
  }
  
  if (!gripDraggingCellId) return;
  
  event.preventDefault();
  gripIsDragging = true;
  
  // Throttle updates for smooth performance (16ms = ~60fps)
  const now = performance.now();
  if (now - gripLastDragTime < 16) return;
  gripLastDragTime = now;
  
  // Cancel any pending animation frame
  if (gripDragAnimationFrame) {
    cancelAnimationFrame(gripDragAnimationFrame);
  }
  
  // Use requestAnimationFrame for smooth rendering
  gripDragAnimationFrame = requestAnimationFrame(() => {
    const canvas = document.getElementById('gripCanvas');
    if (!canvas) return;
    
    const canvasRect = canvas.getBoundingClientRect();
    
    // Calculate new position accounting for zoom level
    const newX = Math.max(0, (event.clientX - canvasRect.left + canvas.scrollLeft) / gripZoomLevel - gripDragOffset.x);
    const newY = Math.max(0, (event.clientY - canvasRect.top + canvas.scrollTop) / gripZoomLevel - gripDragOffset.y);
    
    // Handle multi-select dragging
    if (gripIsMultiDragging && gripSelectedCellIds.length > 1) {
      const primaryCell = gripCells.find(c => c.id === gripDraggingCellId);
      if (!primaryCell) return;
      
      const deltaX = newX - gripMultiDragStartPositions[gripDraggingCellId].x;
      const deltaY = newY - gripMultiDragStartPositions[gripDraggingCellId].y;
      
      // Move all selected cells by the same delta
      gripSelectedCellIds.forEach(id => {
        const cellIndex = gripCells.findIndex(c => c.id === id);
        if (cellIndex !== -1 && gripMultiDragStartPositions[id]) {
          const nx = Math.max(0, gripMultiDragStartPositions[id].x + deltaX);
          const ny = Math.max(0, gripMultiDragStartPositions[id].y + deltaY);
          gripCells[cellIndex].x = nx;
          gripCells[cellIndex].y = ny;
          
          const cellElement = document.getElementById(`gripCell-${id}`);
          if (cellElement) {
            cellElement.style.left = `${nx}px`;
            cellElement.style.top = `${ny}px`;
          }
        }
      });
      
      renderGripConnections();
      return;
    }
    
    // Single cell drag
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
  });
}

function handleGripMouseUp(event) {
  // Handle resize end
  if (gripResizingCellId) {
    handleResizeEnd();
    return;
  }
  
  // Handle connection drag end
  if (gripIsDraggingConnection) {
    handleConnectionDragEnd(event);
    return;
  }
  
  // Cancel any pending animation frame
  if (gripDragAnimationFrame) {
    cancelAnimationFrame(gripDragAnimationFrame);
    gripDragAnimationFrame = null;
  }
  
  if (gripDraggingCellId) {
    // Remove dragging class from all selected cells if multi-dragging
    if (gripIsMultiDragging) {
      gripSelectedCellIds.forEach(id => {
        const el = document.getElementById(`gripCell-${id}`);
        if (el) el.classList.remove('dragging');
      });
    } else {
      const cellElement = document.getElementById(`gripCell-${gripDraggingCellId}`);
      if (cellElement) {
        cellElement.classList.remove('dragging');
      }
    }
    
    if (gripIsDragging) {
      // Update connection positions dynamically after dragging
      updateConnectionPositions();
      saveGripDiagramData(gripProjectIndex);
      renderMinimap();
    }
    
    gripDraggingCellId = null;
    gripIsDragging = false;
    gripIsMultiDragging = false;
    gripMultiDragStartPositions = {};
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
      updateToolbarState();
      updateGripUI();
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
    closeCellEditor();
    updateGripUI();
  }
}

function handleConnectionPointClick(cellId, position) {
  // If eraser mode is active, delete connections at this point
  if (gripEraserMode) {
    deleteConnectionsAtPoint(cellId, position);
    return;
  }
  
  if (!gripConnectMode) {
    // Start connect mode from this specific point
    gripConnectMode = true;
    gripConnectFromId = cellId;
    gripConnectFromPosition = position;
    updateToolbarState();
    updateGripUI();
    return;
  }
  
  if (gripConnectFromId && gripConnectFromId !== cellId) {
    // Complete the connection
    const fromPosition = gripConnectFromPosition || 'right';
    createGripConnection(gripConnectFromId, fromPosition, cellId, position);
    gripConnectMode = false;
    gripConnectFromId = null;
    gripConnectFromPosition = null;
    updateToolbarState();
    updateGripUI();
  }
}

// Delete all connections attached to a specific connection point
function deleteConnectionsAtPoint(cellId, position) {
  const initialCount = gripConnections.length;
  
  // Filter out connections that match this cell and position (from or to)
  gripConnections = gripConnections.filter(conn => {
    const isFromMatch = conn.fromId === cellId && conn.fromPosition === position;
    const isToMatch = conn.toId === cellId && conn.toPosition === position;
    return !isFromMatch && !isToMatch;
  });
  
  const deletedCount = initialCount - gripConnections.length;
  
  if (deletedCount > 0) {
    saveGripDiagramData(gripProjectIndex);
    renderGripConnections();
    // Show visual feedback
    showEraserFeedback(deletedCount);
  }
}

// Show feedback when connections are deleted
function showEraserFeedback(count) {
  const canvas = document.getElementById('gripCanvas');
  if (!canvas) return;
  
  const feedback = document.createElement('div');
  feedback.className = 'eraser-feedback';
  feedback.textContent = `${count} connection${count > 1 ? 's' : ''} deleted`;
  feedback.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: #dc2626;
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    z-index: 10000;
    animation: fadeInOut 1.5s ease forwards;
    pointer-events: none;
  `;
  
  document.body.appendChild(feedback);
  setTimeout(() => feedback.remove(), 1500);
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

// Drawer Cell - a cell with connectable list items
function addDrawerCell() {
  const canvas = document.getElementById('gripCanvas');
  const canvasWidth = canvas ? canvas.clientWidth : 800;
  const canvasHeight = canvas ? canvas.clientHeight : 600;
  
  const scrollLeft = canvas ? canvas.scrollLeft : 0;
  const scrollTop = canvas ? canvas.scrollTop : 0;
  
  let x = scrollLeft + (canvasWidth / 2) - (DEFAULT_CELL_WIDTH / 2);
  let y = scrollTop + (canvasHeight / 2) - (DEFAULT_CELL_HEIGHT / 2);
  
  const offset = (gripCells.length % 5) * 40;
  x += offset;
  y += offset;
  
  x = Math.max(50, x);
  y = Math.max(50, y);
  
  const newCell = {
    id: gripNextCellId++,
    x: x,
    y: y,
    width: DEFAULT_CELL_WIDTH + 40,
    height: DEFAULT_CELL_HEIGHT + 60,
    title: `Drawer ${gripNextCellId - 1}`,
    content: '',
    comment: '',
    headerColor: GRIP_COLORS[Math.floor(Math.random() * GRIP_COLORS.length)],
    isDrawer: true,
    drawerItems: [
      { id: 1, text: 'Item 1' },
      { id: 2, text: 'Item 2' },
      { id: 3, text: 'Item 3' }
    ],
    nextDrawerItemId: 4
  };
  
  gripCells.push(newCell);
  saveGripDiagramData(gripProjectIndex);
  renderGripCells();
  renderGripConnections();
}

// Code Container Cell - a cell for code snippets
function addCodeContainerCell() {
  const canvas = document.getElementById('gripCanvas');
  const canvasWidth = canvas ? canvas.clientWidth : 800;
  const canvasHeight = canvas ? canvas.clientHeight : 600;
  
  const scrollLeft = canvas ? canvas.scrollLeft : 0;
  const scrollTop = canvas ? canvas.scrollTop : 0;
  
  let x = scrollLeft + (canvasWidth / 2) - (DEFAULT_CELL_WIDTH / 2);
  let y = scrollTop + (canvasHeight / 2) - (DEFAULT_CELL_HEIGHT / 2);
  
  const offset = (gripCells.length % 5) * 40;
  x += offset;
  y += offset;
  
  x = Math.max(50, x);
  y = Math.max(50, y);
  
  const newCell = {
    id: gripNextCellId++,
    x: x,
    y: y,
    width: DEFAULT_CELL_WIDTH + 80,
    height: DEFAULT_CELL_HEIGHT + 80,
    title: `Code ${gripNextCellId - 1}`,
    content: '// Enter your code here\nfunction example() {\n  return "Hello World";\n}',
    comment: '',
    headerColor: '#10b981', // Green for code
    isCodeContainer: true
  };
  
  gripCells.push(newCell);
  saveGripDiagramData(gripProjectIndex);
  renderGripCells();
  renderGripConnections();
}

function toggleCellTypeMenu() {
  const menu = document.getElementById('cellTypeMenu');
  if (menu) {
    menu.classList.toggle('open');
  }
}

function closeCellTypeMenu() {
  const menu = document.getElementById('cellTypeMenu');
  if (menu) {
    menu.classList.remove('open');
  }
}

function addDrawerItem(cellId) {
  const cellIndex = gripCells.findIndex(c => c.id === cellId);
  if (cellIndex === -1) return;
  
  const cell = gripCells[cellIndex];
  if (!cell.drawerItems) cell.drawerItems = [];
  if (!cell.nextDrawerItemId) cell.nextDrawerItemId = 1;
  
  cell.drawerItems.push({
    id: cell.nextDrawerItemId++,
    text: 'New Item'
  });
  
  // Increase cell height if needed
  cell.height = Math.max(cell.height, 120 + (cell.drawerItems.length * 44));
  
  saveGripDiagramData(gripProjectIndex);
  renderGripCells();
  renderGripConnections();
}

// Handle double-click on drawer item to edit text
function handleDrawerItemDoubleClick(event, cellId, itemId) {
  event.preventDefault();
  event.stopPropagation();
  
  const textElement = event.target.closest('.drawer-item')?.querySelector('.drawer-item-text');
  if (textElement) {
    textElement.contentEditable = 'true';
    textElement.focus();
    
    // Select all text
    const range = document.createRange();
    range.selectNodeContents(textElement);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Handle blur to save and disable editing
    const handleBlur = () => {
      textElement.contentEditable = 'false';
      updateDrawerItemText(cellId, itemId, textElement.textContent);
      textElement.removeEventListener('blur', handleBlur);
    };
    
    // Handle Enter key to finish editing
    const handleKeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        textElement.blur();
      }
      if (e.key === 'Escape') {
        textElement.blur();
      }
    };
    
    textElement.addEventListener('blur', handleBlur);
    textElement.addEventListener('keydown', handleKeydown, { once: true });
  }
}

// Make function globally available
window.handleDrawerItemDoubleClick = handleDrawerItemDoubleClick;

function updateDrawerItemText(cellId, itemId, text) {
  const cellIndex = gripCells.findIndex(c => c.id === cellId);
  if (cellIndex === -1) return;
  
  const cell = gripCells[cellIndex];
  const item = cell.drawerItems?.find(i => i.id === itemId);
  if (item) {
    item.text = text;
    saveGripDiagramData(gripProjectIndex);
  }
}

function deleteDrawerItem(cellId, itemId) {
  const cellIndex = gripCells.findIndex(c => c.id === cellId);
  if (cellIndex === -1) return;
  
  const cell = gripCells[cellIndex];
  if (cell.drawerItems) {
    cell.drawerItems = cell.drawerItems.filter(i => i.id !== itemId);
    // Also remove any connections from this item
    gripConnections = gripConnections.filter(c => 
      !(c.fromCellId === cellId && c.fromItemId === itemId) &&
      !(c.toCellId === cellId && c.toItemId === itemId)
    );
    saveGripDiagramData(gripProjectIndex);
    renderGripCells();
    renderGripConnections();
  }
}

// Drawer item reordering via drag - supports moving between drawers
let gripDraggingDrawerItem = null;
let gripDraggingDrawerItemCellId = null;
let gripDragGhost = null;
let gripDragTargetCellId = null;
let gripDragTargetPosition = null;

function setupDrawerItemDragListeners(cellId) {
  const cellElement = document.getElementById(`gripCell-${cellId}`);
  if (!cellElement) return;
  
  const drawerItems = cellElement.querySelectorAll('.drawer-item');
  
  drawerItems.forEach((item) => {
    const handle = item.querySelector('.drawer-item-handle');
    if (!handle) return;
    
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const itemId = parseInt(item.dataset.itemId);
      startDrawerItemDrag(cellId, itemId, item, e);
    });
  });
}

function startDrawerItemDrag(cellId, itemId, itemElement, e) {
  gripDraggingDrawerItem = itemId;
  gripDraggingDrawerItemCellId = cellId;
  gripDragTargetCellId = cellId;
  
  itemElement.classList.add('dragging');
  document.body.style.cursor = 'grabbing';
  
  // Create drag ghost
  const rect = itemElement.getBoundingClientRect();
  gripDragGhost = document.createElement('div');
  gripDragGhost.className = 'drawer-item-drag-ghost';
  gripDragGhost.innerHTML = itemElement.querySelector('.drawer-item-text')?.textContent || 'Item';
  gripDragGhost.style.cssText = `
    position: fixed;
    left: ${e.clientX - 50}px;
    top: ${e.clientY - 15}px;
    width: ${rect.width}px;
    padding: 8px 12px;
    background: rgba(59, 130, 246, 0.9);
    color: white;
    border-radius: 6px;
    font-size: 12px;
    pointer-events: none;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transform: rotate(2deg);
    transition: transform 0.1s;
  `;
  document.body.appendChild(gripDragGhost);
  
  // Add global listeners
  document.addEventListener('mousemove', handleDrawerItemDragMove);
  document.addEventListener('mouseup', handleDrawerItemDragEnd);
}

function handleDrawerItemDragMove(e) {
  if (!gripDraggingDrawerItem || !gripDragGhost) return;
  
  // Update ghost position
  gripDragGhost.style.left = `${e.clientX - 50}px`;
  gripDragGhost.style.top = `${e.clientY - 15}px`;
  
  // Clear all drop indicators
  document.querySelectorAll('.drawer-item').forEach(item => {
    item.classList.remove('drop-before', 'drop-after');
  });
  document.querySelectorAll('.grip-cell-drawer').forEach(cell => {
    cell.classList.remove('drawer-drop-target');
  });
  
  // Find target drawer cell and item
  const targetElement = document.elementFromPoint(e.clientX, e.clientY);
  if (!targetElement) return;
  
  const targetDrawerItem = targetElement.closest('.drawer-item');
  const targetDrawerCell = targetElement.closest('.grip-cell-drawer');
  
  if (targetDrawerCell) {
    const targetCellId = parseInt(targetDrawerCell.dataset.cellId);
    gripDragTargetCellId = targetCellId;
    targetDrawerCell.classList.add('drawer-drop-target');
    
    if (targetDrawerItem) {
      const targetItemId = parseInt(targetDrawerItem.dataset.itemId);
      // Don't highlight the dragged item itself
      if (!(targetCellId === gripDraggingDrawerItemCellId && targetItemId === gripDraggingDrawerItem)) {
        const rect = targetDrawerItem.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          targetDrawerItem.classList.add('drop-before');
          gripDragTargetPosition = { itemId: targetItemId, before: true };
        } else {
          targetDrawerItem.classList.add('drop-after');
          gripDragTargetPosition = { itemId: targetItemId, before: false };
        }
      }
    } else {
      // Dropping at end of drawer
      gripDragTargetPosition = { itemId: null, before: false };
    }
  } else {
    gripDragTargetCellId = null;
    gripDragTargetPosition = null;
  }
}

function handleDrawerItemDragEnd(e) {
  document.removeEventListener('mousemove', handleDrawerItemDragMove);
  document.removeEventListener('mouseup', handleDrawerItemDragEnd);
  
  if (!gripDraggingDrawerItem) return;
  
  // Perform the move/reorder
  if (gripDragTargetCellId && gripDragTargetCellId !== gripDraggingDrawerItemCellId) {
    // Moving to a different drawer
    moveDrawerItemToCell(gripDraggingDrawerItemCellId, gripDraggingDrawerItem, gripDragTargetCellId, gripDragTargetPosition);
  } else if (gripDragTargetCellId === gripDraggingDrawerItemCellId && gripDragTargetPosition?.itemId) {
    // Reordering within same drawer
    reorderDrawerItem(gripDraggingDrawerItemCellId, gripDraggingDrawerItem, gripDragTargetPosition.itemId, gripDragTargetPosition.before);
  }
  
  finishDrawerItemDrag();
}

function moveDrawerItemToCell(fromCellId, itemId, toCellId, targetPosition) {
  const fromCellIndex = gripCells.findIndex(c => c.id === fromCellId);
  const toCellIndex = gripCells.findIndex(c => c.id === toCellId);
  
  if (fromCellIndex === -1 || toCellIndex === -1) return;
  
  const fromCell = gripCells[fromCellIndex];
  const toCell = gripCells[toCellIndex];
  
  if (!fromCell.drawerItems || !toCell.isDrawer) return;
  
  // Find and remove item from source
  const itemIndex = fromCell.drawerItems.findIndex(i => i.id === itemId);
  if (itemIndex === -1) return;
  
  const [movedItem] = fromCell.drawerItems.splice(itemIndex, 1);
  
  // Generate new ID for target cell
  if (!toCell.drawerItems) toCell.drawerItems = [];
  if (!toCell.nextDrawerItemId) toCell.nextDrawerItemId = 1;
  
  movedItem.id = toCell.nextDrawerItemId++;
  
  // Insert at target position
  if (targetPosition?.itemId) {
    const targetIndex = toCell.drawerItems.findIndex(i => i.id === targetPosition.itemId);
    if (targetIndex !== -1) {
      const insertIndex = targetPosition.before ? targetIndex : targetIndex + 1;
      toCell.drawerItems.splice(insertIndex, 0, movedItem);
    } else {
      toCell.drawerItems.push(movedItem);
    }
  } else {
    toCell.drawerItems.push(movedItem);
  }
  
  // Update cell heights
  fromCell.height = Math.max(120, 120 + (fromCell.drawerItems.length * 44));
  toCell.height = Math.max(toCell.height, 120 + (toCell.drawerItems.length * 44));
  
  // Update connections (remove connections from the moved item in source)
  gripConnections = gripConnections.filter(c => 
    !(c.fromCellId === fromCellId && c.fromItemId === itemId)
  );
  
  saveGripDiagramData(gripProjectIndex);
  renderGripCells();
  renderGripConnections();
}

function finishDrawerItemDrag() {
  // Remove ghost
  if (gripDragGhost) {
    gripDragGhost.remove();
    gripDragGhost = null;
  }
  
  // Clear all drag classes
  document.querySelectorAll('.drawer-item').forEach(item => {
    item.classList.remove('dragging', 'drop-before', 'drop-after');
  });
  document.querySelectorAll('.grip-cell-drawer').forEach(cell => {
    cell.classList.remove('drawer-drop-target');
  });
  
  gripDraggingDrawerItem = null;
  gripDraggingDrawerItemCellId = null;
  gripDragTargetCellId = null;
  gripDragTargetPosition = null;
  document.body.style.cursor = '';
}

function reorderDrawerItem(cellId, draggedItemId, targetItemId, insertBefore) {
  const cellIndex = gripCells.findIndex(c => c.id === cellId);
  if (cellIndex === -1) return;
  
  const cell = gripCells[cellIndex];
  if (!cell.drawerItems) return;
  
  const draggedIndex = cell.drawerItems.findIndex(i => i.id === draggedItemId);
  const targetIndex = cell.drawerItems.findIndex(i => i.id === targetItemId);
  
  if (draggedIndex === -1 || targetIndex === -1) return;
  
  // Remove dragged item
  const [draggedItem] = cell.drawerItems.splice(draggedIndex, 1);
  
  // Calculate new position
  let newIndex = targetIndex;
  if (draggedIndex < targetIndex) newIndex--;
  if (!insertBefore) newIndex++;
  
  // Insert at new position
  cell.drawerItems.splice(newIndex, 0, draggedItem);
  
  saveGripDiagramData(gripProjectIndex);
  renderGripCells();
  renderGripConnections();
}

// Handle drawer item connection point mouse down - supports both left and right sides
let gripDraggingFromDrawerItem = null;
let gripDraggingFromDrawerItemPosition = null;

function handleDrawerItemConnectionPointMouseDown(e, cellId, itemId, position = 'item-right') {
  e.preventDefault();
  e.stopPropagation();
  
  gripIsDraggingConnection = true;
  gripDraggingFromDrawerItem = { cellId, itemId };
  gripDraggingFromDrawerItemPosition = position;
  
  const cell = gripCells.find(c => c.id === cellId);
  const item = cell?.drawerItems?.find(i => i.id === itemId);
  
  if (cell && item) {
    // Calculate position of the drawer item connection point
    const cellElement = document.getElementById(`gripCell-${cellId}`);
    const itemElement = cellElement?.querySelector(`[data-item-id="${itemId}"]`);
    
    if (itemElement) {
      const canvas = document.getElementById('gripCanvas');
      const canvasRect = canvas.getBoundingClientRect();
      const itemRect = itemElement.getBoundingClientRect();
      
      // Use left or right based on position
      const xPos = position === 'item-left' 
        ? (itemRect.left - canvasRect.left + canvas.scrollLeft) / gripZoomLevel
        : (itemRect.right - canvasRect.left + canvas.scrollLeft) / gripZoomLevel;
      
      gripConnectionDragStart = {
        x: xPos,
        y: (itemRect.top + itemRect.height / 2 - canvasRect.top + canvas.scrollTop) / gripZoomLevel
      };
      gripConnectionDragEnd = { ...gripConnectionDragStart };
    }
  }
}

// Extend the connection creation to support drawer items from both sides
const originalCreateGripConnection = createGripConnection;

function createDrawerItemConnection(fromCellId, fromItemId, toCellId, toPosition, fromPosition = 'item-right') {
  // Check if connection already exists
  const exists = gripConnections.some(c => 
    c.fromCellId === fromCellId && c.fromItemId === fromItemId && c.toId === toCellId
  );
  
  if (!exists) {
    gripConnections.push({
      fromId: fromCellId,
      fromCellId: fromCellId,
      fromItemId: fromItemId,
      fromPosition: fromPosition,
      toId: toCellId,
      toPosition: toPosition || (fromPosition === 'item-left' ? 'right' : 'left')
    });
    saveGripDiagramData(gripProjectIndex);
    renderGripConnections();
  }
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
  closeCellEditor();
  updateGripUI();
}

function deselectGripCell() {
  gripSelectedCellId = null;
  closeCellEditor();
  updateGripUI();
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

function updateCodeCellContent(cellId, content) {
  const cellIndex = gripCells.findIndex(c => c.id === cellId);
  if (cellIndex !== -1) {
    gripCells[cellIndex].content = content;
    saveGripDiagramData(gripProjectIndex);
    // Update language display
    updateCodeLanguageDisplay(cellId);
  }
}

// ============================================
// Code Language Detection and Execution
// ============================================

function detectCodeLanguage(code) {
  if (!code || typeof code !== 'string') return 'Plain';
  
  const trimmed = code.trim().toLowerCase();
  
  // Python detection
  if (/^(import |from .+ import |def |class |print\(|#.*python)/m.test(code) ||
      /:\s*$/m.test(code) && /^\s+(pass|return|if|for|while)/m.test(code) ||
      /\bself\./m.test(code)) {
    return 'Python';
  }
  
  // JavaScript/TypeScript detection
  if (/^(const |let |var |function |import .+ from|export |async |=>\s*{|console\.log)/m.test(code) ||
      /\bawait\b/.test(code) ||
      /\b(document|window)\./m.test(code)) {
    return 'JavaScript';
  }
  
  // C++ detection
  if (/#include\s*<|using namespace|int main\s*\(|cout\s*<<|cin\s*>>|std::|void\s+\w+\s*\(/.test(code)) {
    return 'C++';
  }
  
  // C detection
  if (/#include\s*<stdio\.h>|printf\s*\(|scanf\s*\(|int main\s*\(/.test(code) && !/#include\s*<iostream>/.test(code)) {
    return 'C';
  }
  
  // Java detection
  if (/public\s+(static\s+)?class|System\.out\.print|public\s+static\s+void\s+main/.test(code)) {
    return 'Java';
  }
  
  // HTML detection
  if (/^<!DOCTYPE|<html|<head|<body|<div|<span|<p\b/im.test(code)) {
    return 'HTML';
  }
  
  // CSS detection
  if (/^[.#]?\w+\s*{[^}]*}|@media|@keyframes|:root\s*{/m.test(code)) {
    return 'CSS';
  }
  
  // SQL detection
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s/im.test(code)) {
    return 'SQL';
  }
  
  // JSON detection
  if (/^\s*[{\[]/.test(code) && /[}\]]\s*$/.test(code)) {
    try {
      JSON.parse(code);
      return 'JSON';
    } catch(e) {}
  }
  
  // Shell/Bash detection
  if (/^(#!\/bin\/|echo\s|cd\s|ls\s|grep\s|chmod\s|sudo\s)/m.test(code)) {
    return 'Shell';
  }
  
  return 'Plain';
}

function updateCodeLanguageDisplay(cellId) {
  const cell = gripCells.find(c => c.id === cellId);
  if (!cell || !cell.isCodeContainer) return;
  
  const langEl = document.getElementById(`codeLang-${cellId}`);
  if (langEl) {
    langEl.textContent = detectCodeLanguage(cell.content || '');
  }
}

async function runCode(cellId) {
  const cell = gripCells.find(c => c.id === cellId);
  if (!cell || !cell.isCodeContainer) return;
  
  const code = cell.content || '';
  const lang = detectCodeLanguage(code);
  const outputEl = document.getElementById(`codeOutput-${cellId}`);
  const contentEl = document.getElementById(`codeOutputContent-${cellId}`);
  const codeEl = document.querySelector(`[data-cell-id="${cellId}"].grip-cell-code-content`);
  
  if (!outputEl || !contentEl) return;
  
  outputEl.style.display = 'block';
  contentEl.innerHTML = '<span class="code-running-animation">⏳ Running...</span>';
  
  // Clear previous error highlights
  clearCodeErrorHighlights(cellId);
  
  // Run the code first
  let hasError = false;
  let runtimeError = null;
  
  if (lang === 'JavaScript') {
    const result = runJavaScript(code, contentEl, outputEl);
    hasError = result.hasError;
    runtimeError = result.error;
  } else if (lang === 'Python') {
    runPythonSimulated(code, contentEl, outputEl);
  } else if (lang === 'C++' || lang === 'C') {
    runCppSimulated(code, contentEl, outputEl);
  } else {
    contentEl.textContent = `⚠️ Code execution not supported for ${lang}.\n\nSupported languages: JavaScript, Python, C++`;
  }
  
  // ALWAYS use AI to analyze code for potential issues
  if (typeof window.analyzeCodeErrors === 'function') {
    try {
      // Show analyzing indicator with smooth animation
      if (hasError) {
        contentEl.innerHTML += `\n\n<span class="ai-analyzing">
          <svg class="ai-analyzing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
          <span class="ai-analyzing-text">AI analyzing errors</span>
          <span class="ai-analyzing-dots"><span></span><span></span><span></span></span>
        </span>`;
      }
      
      const analysis = await window.analyzeCodeErrors(code, lang.toLowerCase());
      
      // Remove analyzing indicator
      const analyzingEl = contentEl.querySelector('.ai-analyzing');
      if (analyzingEl) analyzingEl.remove();
      
      if (analysis.errors && analysis.errors.length > 0) {
        highlightCodeErrors(cellId, analysis.errors, codeEl);
        
        // Add AI insights to output if there were errors
        if (hasError) {
          contentEl.innerHTML += `\n\n<div class="ai-error-summary">
            <div class="ai-error-summary-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <strong>AI Found ${analysis.errors.length} issue${analysis.errors.length > 1 ? 's' : ''}</strong>
            </div>
            <ul>${analysis.errors.map(e => `<li>Line ${e.line}: ${e.message}</li>`).join('')}</ul>
            <small>Hover over highlighted lines for fix suggestions</small>
          </div>`;
        }
      }
    } catch (e) {
      console.log('AI code analysis unavailable:', e);
    }
  }
}

function clearCodeErrorHighlights(cellId) {
  const codeEl = document.querySelector(`[data-cell-id="${cellId}"].grip-cell-code-content`);
  if (codeEl) {
    // Remove any error tooltips
    codeEl.querySelectorAll('.code-error-tooltip').forEach(el => el.remove());
    codeEl.querySelectorAll('.code-error-highlight').forEach(el => {
      el.classList.remove('code-error-highlight');
    });
  }
}

function highlightCodeErrors(cellId, errors, codeEl) {
  if (!codeEl || !errors.length) return;
  
  const lines = (codeEl.textContent || '').split('\n');
  let html = '';
  
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const error = errors.find(e => e.line === lineNum);
    
    if (error) {
      const escapedLine = escapeHtml(line);
      html += `<span class="code-error-highlight" data-line="${lineNum}">${escapedLine}
        <div class="code-error-tooltip">
          <div class="code-error-tooltip-header">
            <div class="code-error-tooltip-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <span class="code-error-tooltip-type">${error.type}</span>
          </div>
          <div class="code-error-tooltip-message">${escapeHtml(error.message)}</div>
          <div class="code-error-tooltip-fix"><strong>Fix:</strong> ${escapeHtml(error.fix)}</div>
        </div>
      </span>\n`;
    } else {
      html += escapeHtml(line) + '\n';
    }
  });
  
  codeEl.innerHTML = html;
}

function runJavaScript(code, contentEl, outputEl) {
  try {
    const logs = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = (...args) => {
      logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
    };
    console.error = (...args) => {
      logs.push('❌ ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
    };
    console.warn = (...args) => {
      logs.push('⚠️ ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
    };
    
    const result = eval(code);
    
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    
    let output = logs.join('\n');
    if (result !== undefined && logs.length === 0) {
      output = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
    }
    
    contentEl.textContent = output || '✅ Code executed successfully (no output)';
    outputEl.style.borderColor = '#22c55e';
    outputEl.style.background = 'rgba(34, 197, 94, 0.1)';
    return { hasError: false, error: null };
  } catch (error) {
    contentEl.textContent = `❌ Error: ${error.message}`;
    outputEl.style.borderColor = '#ef4444';
    outputEl.style.background = 'rgba(239, 68, 68, 0.1)';
    return { hasError: true, error: error };
  }
}

function runPythonSimulated(code, outputEl) {
  // Simple Python simulation for basic operations
  try {
    const lines = code.split('\n');
    const outputs = [];
    const variables = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Handle print statements
      const printMatch = trimmed.match(/^print\s*\(\s*(.+)\s*\)$/);
      if (printMatch) {
        let content = printMatch[1];
        
        // Handle string literals
        if ((content.startsWith('"') && content.endsWith('"')) || 
            (content.startsWith("'") && content.endsWith("'"))) {
          outputs.push(content.slice(1, -1));
        } else if (content.startsWith('f"') || content.startsWith("f'")) {
          // f-string simulation
          let fstring = content.slice(2, -1);
          fstring = fstring.replace(/\{([^}]+)\}/g, (match, varName) => {
            return variables[varName.trim()] !== undefined ? variables[varName.trim()] : match;
          });
          outputs.push(fstring);
        } else {
          // Try to evaluate expression
          const val = variables[content] !== undefined ? variables[content] : evalSimplePythonExpr(content, variables);
          outputs.push(String(val));
        }
        continue;
      }
      
      // Handle variable assignment
      const assignMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
      if (assignMatch) {
        const [, varName, value] = assignMatch;
        variables[varName] = evalSimplePythonExpr(value, variables);
        continue;
      }
    }
    
    outputEl.textContent = outputs.length > 0 
      ? outputs.join('\n') 
      : '✓ Python code simulated (no print output)\n⚠️ Note: This is a simplified simulation. Complex Python features may not work.';
  } catch (error) {
    outputEl.textContent = `❌ Simulation Error: ${error.message}\n⚠️ Note: This is a simplified Python simulation.`;
  }
}

function evalSimplePythonExpr(expr, variables) {
  expr = expr.trim();
  
  // String literals
  if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
    return expr.slice(1, -1);
  }
  
  // Numbers
  if (!isNaN(Number(expr))) {
    return Number(expr);
  }
  
  // Variable reference
  if (variables[expr] !== undefined) {
    return variables[expr];
  }
  
  // Simple arithmetic
  try {
    const sanitized = expr.replace(/\b(\w+)\b/g, (match) => {
      return variables[match] !== undefined ? variables[match] : match;
    });
    return eval(sanitized);
  } catch (e) {
    return expr;
  }
}

function runCppSimulated(code, outputEl) {
  // Very basic C++ output simulation
  try {
    const outputs = [];
    const lines = code.split('\n');
    
    for (const line of lines) {
      // Handle cout statements
      const coutMatch = line.match(/cout\s*<<\s*(.+?)\s*(?:<<\s*endl)?;/);
      if (coutMatch) {
        let content = coutMatch[1];
        // Handle multiple << operators
        const parts = content.split('<<').map(p => p.trim());
        const output = parts.map(part => {
          if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
            return part.slice(1, -1);
          }
          if (part === 'endl') return '';
          return part;
        }).join('');
        if (output) outputs.push(output);
      }
      
      // Handle printf
      const printfMatch = line.match(/printf\s*\(\s*"([^"]+)".*\)/);
      if (printfMatch) {
        outputs.push(printfMatch[1].replace(/\\n/g, '\n'));
      }
    }
    
    outputEl.textContent = outputs.length > 0 
      ? outputs.join('\n') 
      : '✓ C++ code parsed (no cout/printf output detected)\n⚠️ Note: This is a simplified simulation. Actual compilation requires a C++ compiler.';
  } catch (error) {
    outputEl.textContent = `❌ Simulation Error: ${error.message}\n⚠️ Note: This is a simplified C++ simulation.`;
  }
}

function hideCodeOutput(cellId) {
  const outputEl = document.getElementById(`codeOutput-${cellId}`);
  if (outputEl) {
    outputEl.style.display = 'none';
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
  updateToolbarState();
  updateGripUI();
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
window.runCode = runCode;
window.hideCodeOutput = hideCodeOutput;
window.updateCodeCellContent = updateCodeCellContent;
window.updateCodeLanguageDisplay = updateCodeLanguageDisplay;

// ============================================
// AI Chat Assistant Functions
// ============================================
let aiChatMessages = [];

function setupAiChatListeners() {
  const toggleBtn = document.getElementById('gripAiChatToggle');
  const closeBtn = document.getElementById('gripAiChatClose');
  const backdrop = document.getElementById('gripAiChatBackdrop');
  const sendBtn = document.getElementById('gripAiSend');
  const input = document.getElementById('gripAiInput');
  
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleAiChat);
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeAiChat);
  }
  
  if (backdrop) {
    backdrop.addEventListener('click', closeAiChat);
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
  const backdrop = document.getElementById('gripAiChatBackdrop');
  if (chat) {
    const isOpen = chat.classList.contains('open');
    if (isOpen) {
      closeAiChat();
    } else {
      chat.classList.add('open');
      if (backdrop) backdrop.classList.add('open');
      // Focus input
      const input = document.getElementById('gripAiInput');
      if (input) setTimeout(() => input.focus(), 100);
    }
  }
}

function closeAiChat() {
  const chat = document.getElementById('gripAiChat');
  const backdrop = document.getElementById('gripAiChatBackdrop');
  if (chat) chat.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
}

function handleAiSend() {
  // Use Gemini-powered handler if available
  if (typeof window.handleWhiteboardAiSendWithGemini === 'function') {
    window.handleWhiteboardAiSendWithGemini();
    return;
  }
  
  // Fallback to simulated response
  const input = document.getElementById('gripAiInput');
  const messagesContainer = document.getElementById('gripAiMessages');
  
  if (!input || !messagesContainer) return;
  
  const message = input.value.trim();
  if (!message) return;
  
  // Clear welcome message if exists
  const welcomeMsg = messagesContainer.querySelector('.grip-ai-welcome');
  if (welcomeMsg) welcomeMsg.remove();
  
  // Add user message
  const userMsg = document.createElement('div');
  userMsg.className = 'grip-ai-message user';
  userMsg.textContent = message;
  messagesContainer.appendChild(userMsg);
  
  input.value = '';
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Show looping AI loading indicator
  const loadingMsg = document.createElement('div');
  loadingMsg.className = 'grip-ai-loading-loop';
  loadingMsg.id = 'aiTyping';
  loadingMsg.innerHTML = `
    <div class="grip-ai-loading-dots-loop">
      <span></span><span></span><span></span>
    </div>
    <span class="grip-ai-loading-text-loop">Thinking...</span>
  `;
  messagesContainer.appendChild(loadingMsg);
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
  
  // Whiteboard-specific responses (enhanced)
  
  // Greetings
  if (msg.includes('hi') || msg.includes('hello') || msg.includes('hey')) {
    const greetings = [
      "Hey! I'm your whiteboard assistant. Need help with cells, connections, or organizing your flowchart?",
      "Hi there! I can help you navigate the whiteboard. Try asking about cells, connections, or drawer items!",
      "Hey! What do you need help with on the whiteboard today?"
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
  
  // Cell creation help
  if (msg.includes('create') || msg.includes('add cell') || msg.includes('new cell')) {
    return "To add a cell: Click the '+Add' button in the toolbar at the bottom. Choose 'Task Cell' for simple cards, or 'Drawer Cell' for a list with connectable items. Cells can be dragged anywhere on the canvas!";
  }
  
  // Drawer cell specific help
  if (msg.includes('drawer') || msg.includes('list') || msg.includes('items')) {
    return "Drawer cells are special! They contain a list of items, each with connection points on both left AND right sides. You can: \\n• Edit item labels by clicking on them \\n• Drag items by their handle to reorder \\n• Connect items to other cells from either side \\n• Delete items with the X button";
  }
  
  // Connection help
  if (msg.includes('connect') || msg.includes('link') || msg.includes('arrow') || msg.includes('line')) {
    return "To connect cells: \\n1. Hover over a cell to see connection points (dots on sides) \\n2. Drag from a connection point to another cell \\n3. To remove: hover over a connection line - it turns red with a delete button. Click to remove!";
  }
  
  // Remove/Delete connections
  if (msg.includes('delete connection') || msg.includes('remove connection') || msg.includes('remove link')) {
    return "Easy! Just hover over any connection line - it will highlight in red and show a delete indicator in the middle. Click it to remove the connection instantly.";
  }
  
  // Text and images
  if (msg.includes('text') || msg.includes('image') || msg.includes('picture')) {
    return "Click the 'T' icon in the toolbar to add text boxes anywhere. Click the image icon to upload images. Both can be dragged around and resized!";
  }
  
  // Zoom and pan
  if (msg.includes('zoom') || msg.includes('pan') || msg.includes('move around') || msg.includes('navigate')) {
    return "Use the zoom controls in the header (+/-) or scroll wheel. To pan: click the hand icon in the toolbar, then drag the canvas. Keyboard: use H for hand tool, V for select, + and - for zoom.";
  }
  
  // Backlog
  if (msg.includes('backlog')) {
    return "The Backlog panel on the right helps you track project tasks! Click 'Backlog' in the header to open it. You can drag backlog items onto the canvas to create cells, or use filters to organize.";
  }
  
  // Select all / multiple selection
  if (msg.includes('select all') || msg.includes('multiple') || msg.includes('bulk')) {
    return "Press Ctrl/Cmd + A to select all cells. Hold Shift and click to select multiple. A selection bar appears at top with options to delete or duplicate selected items.";
  }
  
  // Keyboard shortcuts
  if (msg.includes('keyboard') || msg.includes('shortcut')) {
    return "Keyboard shortcuts: \\n• V - Select tool \\n• H - Pan/Hand tool \\n• T - Text tool \\n• A - Toggle connect mode \\n• Delete/Backspace - Remove selected \\n• Ctrl+A - Select all \\n• +/- - Zoom in/out \\n• Escape - Deselect";
  }
  
  // Save / persistence
  if (msg.includes('save') || msg.includes('data')) {
    return "Your whiteboard automatically saves to your browser! All cells, connections, and positions are preserved. Use the back button to return to project view - your diagram will be there when you come back.";
  }
  
  // Theme
  if (msg.includes('theme') || msg.includes('dark') || msg.includes('light') || msg.includes('color')) {
    return "The whiteboard uses your app theme! Change it in Settings from the main sidebar. We support Dark, Light, and many custom themes like Liquid Glass, Coffee, Pink, and more.";
  }
  
  // Help
  if (msg.includes('help') || msg.includes('what can you') || msg.includes('how do') || msg.includes('how to')) {
    return "I can help with: \\n• Creating cells and drawer cells \\n• Connecting elements \\n• Removing connections (just hover!) \\n• Reordering drawer items \\n• Keyboard shortcuts \\n• Zoom/pan navigation \\n\\nWhat would you like to know?";
  }
  
  // Thanks
  if (msg.includes('thank') || msg.includes('thanks')) {
    return "Happy to help! Let me know if you need anything else with your whiteboard. 🎨";
  }
  
  // Default responses - more whiteboard focused
  const defaults = [
    "I'm here to help with the whiteboard! Try asking about cells, connections, drawer items, or keyboard shortcuts.",
    "Need help organizing your flowchart? Ask me about connecting cells, adding items to drawers, or using the toolbar!",
    "I can guide you through any whiteboard feature. Try: 'How do I connect cells?' or 'How do drawer cells work?'",
    "Whiteboard tip: Hover over connections to delete them! Ask me about any feature you'd like to learn."
  ];
  
  return defaults[Math.floor(Math.random() * defaults.length)];
}

// ============================================
// Tools Sidebar Functions
// ============================================

function setupToolsListeners() {
  // Bottom toolbar tools (new ClickUp style) - Use updateGripUI to prevent scroll reset
  const toolbarTools = document.querySelectorAll('.toolbar-tool[data-tool]');
  toolbarTools.forEach(btn => {
    btn.addEventListener('click', () => {
      gripActiveTool = btn.dataset.tool;
      gripSelectedTextBoxId = null;
      // Use updateGripUI instead of full re-render to preserve scroll
      updateToolbarState();
      updateGripUI();
    });
  });
  
  // Legacy tool buttons (sidebar)
  const toolBtns = document.querySelectorAll('.grip-tool-btn[data-tool]');
  toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      gripActiveTool = btn.dataset.tool;
      gripSelectedTextBoxId = null;
      // Use updateGripUI instead of full re-render to preserve scroll
      updateToolbarState();
      updateGripUI();
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
    gripEraserMode = false;
    renderGripDiagramOverlay();
  } else if (key === 'h') {
    gripActiveTool = 'pan';
    gripEraserMode = false;
    renderGripDiagramOverlay();
  } else if (key === 't') {
    gripActiveTool = 'text';
    gripEraserMode = false;
    renderGripDiagramOverlay();
  } else if (key === 'e') {
    // Toggle eraser mode
    toggleGripEraserMode();
  } else if (key === 'a' && !e.ctrlKey && !e.metaKey) {
    // Toggle arrow/connect mode
    gripEraserMode = false;
    toggleGripConnectMode();
  } else if (key === 'escape') {
    if (gripConnectMode) {
      gripConnectMode = false;
      gripConnectFromId = null;
      gripConnectFromPosition = null;
    }
    gripEraserMode = false;
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
    // Skip the source cell for drawer item connections too
    const sourceId = gripDraggingFromDrawerItem ? gripDraggingFromDrawerItem.cellId : gripConnectFromId;
    if (cell.id === sourceId) continue;
    
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
  
  // Handle drawer item connection
  if (targetCellId && gripDraggingFromDrawerItem) {
    createDrawerItemConnection(
      gripDraggingFromDrawerItem.cellId, 
      gripDraggingFromDrawerItem.itemId, 
      targetCellId, 
      targetPosition
    );
  }
  // Handle normal cell connection
  else if (targetCellId && gripConnectFromId) {
    createGripConnection(gripConnectFromId, gripConnectFromPosition, targetCellId, targetPosition);
  }
  
  // Reset all connection state
  gripIsDraggingConnection = false;
  gripConnectFromId = null;
  gripConnectFromPosition = null;
  gripConnectionDragStart = null;
  gripConnectionDragEnd = null;
  gripDraggingFromDrawerItem = null;
  
  renderGripDiagramOverlay();
}
