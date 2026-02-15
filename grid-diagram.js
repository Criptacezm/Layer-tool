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

  // Config
  GRID_SIZE: 20,
  SNAP_TO_GRID: true,
  MIN_SCALE: 0.1,
  MAX_SCALE: 5,
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

function openGripDiagram(projectIndex) {
  GripState.projectIndex = projectIndex;
  loadGripData(projectIndex);

  // Reset View for good UX if it's the first open or empty
  if (GripState.nodes.length === 0) {
    GripState.scale = 1;
    GripState.offsetX = window.innerWidth / 2;
    GripState.offsetY = window.innerHeight / 2;
  }

  renderGripOverlay();
  requestAnimationFrame(gripGameLoop);
}

function loadGripData(index) {
  const projects = loadProjects();
  const project = projects[index];

  if (project?.gripDiagram) {
    // Migration check: if old format (gripCells), convert them
    if (project.gripDiagram.cells) {
      migrateOldData(project.gripDiagram);
    } else {
      GripState.nodes = project.gripDiagram.nodes || [];
      GripState.edges = project.gripDiagram.edges || [];
      GripState.offsetX = project.gripDiagram.offsetX || 0;
      GripState.offsetY = project.gripDiagram.offsetY || 0;
      GripState.scale = project.gripDiagram.scale || 1;
    }
  } else {
    GripState.nodes = [];
    GripState.edges = [];
  }

  // Initialize History
  GripState.history = [{
    nodes: JSON.parse(JSON.stringify(GripState.nodes)),
    edges: JSON.parse(JSON.stringify(GripState.edges))
  }];
  GripState.historyIndex = 0;
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
  const projects = loadProjects();
  if (projects[GripState.projectIndex]) {
    projects[GripState.projectIndex].gripDiagram = {
      nodes: GripState.nodes,
      edges: GripState.edges,
      offsetX: GripState.offsetX,
      offsetY: GripState.offsetY,
      scale: GripState.scale
    };
    saveProjects(projects);
  }
}

function closeGripDiagram() {
  saveGripData();
  const overlay = document.getElementById('gripDiagramOverlay');
  if (overlay) overlay.remove();
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
    saveGripData();
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
      <div class="grip-toolbar-group">
        <button class="grip-btn-icon" onclick="closeGripDiagram()" title="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div class="grip-divider-vertical"></div>
        <div class="grip-filename">User Flow</div>
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
      <button class="grip-tool-btn" data-tool="flow-card" title="Flow Card (C)" onclick="setTool('flow-card')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M7 13h.01"/><path d="M7 17h.01"/><path d="M11 13h6"/><path d="M11 17h6"/></svg>
      </button>
      <button class="grip-tool-btn" data-tool="header" title="Large Header (T)" onclick="setTool('header')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
      </button>
      
      <div class="grip-divider-vertical"></div>
      
      <button class="grip-tool-btn" data-tool="connect" title="Connect (L)" onclick="setTool('connect')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
      </button>
      <button class="grip-tool-btn" data-tool="eraser" title="Eraser (E)" onclick="setTool('eraser')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    
    <div id="gripPropertiesPanel" class="grip-properties-panel" style="display:none;"></div>

    <div id="gripCanvasContainer" class="grip-canvas-container">
      <div id="gripTransformLayer" class="grip-transform-layer">
         <!-- Content injected by JS -->
      </div>
      <div id="gripSelectionBox" class="grip-selection-box" style="display:none;"></div>
      <svg id="gripTempConnection" class="grip-temp-connection"></svg>
    </div>
  `;

  document.body.appendChild(overlay);

  // Attach Event Listeners
  const container = document.getElementById('gripCanvasContainer');
  container.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  container.addEventListener('wheel', handleWheel, { passive: false });
  document.addEventListener('keydown', handleKeyDown);

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
    return;
  }

  if (GripState.activeTool === 'hand' || GripState.isSpacePressed) {
    container.className = 'grip-canvas-container cursor-grab';
  } else if (['pill', 'flow-card', 'card', 'shape:rectangle', 'shape:diamond', 'shape:ellipse', 'text', 'header', 'sticky', 'pencil', 'connect'].includes(GripState.activeTool)) {
    container.className = 'grip-canvas-container'; // Default arrow or crosshair if we add CSS
    container.style.cursor = 'crosshair';
  } else {
    container.className = 'grip-canvas-container';
    container.style.cursor = 'default';
  }
}

function setTool(tool) {
  GripState.activeTool = tool;
  updateCursor();
  renderToolbar();
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

  // Hit Testing
  const worldPos = screenToWorld(e.clientX, e.clientY);
  const hitNode = GripState.nodes.slice().reverse().find(node =>
    worldPos.x >= node.x && worldPos.x <= node.x + node.width &&
    worldPos.y >= node.y && worldPos.y <= node.y + node.height
  );

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
    if (GripState.activeTool === 'eraser') { deleteNode(hitNode.id); return; }
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
      if (node) { node.x += worldDx; node.y += worldDy; }
    });
    renderCanvas();
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

  GripState.isDraggingCanvas = false;
  GripState.isDraggingNodes = false;
  GripState.isResizing = false;
  GripState.isDrawing = false;

  // Reset cursor from grabbing to grab (if hand tool) or default
  updateCursor();

  if (GripState.isSelecting) {
    commitSelectionBox();
    GripState.isSelecting = false;
    document.getElementById('gripSelectionBox').style.display = 'none';
    updatePropertiesPanel();
  }

  if (GripState.isConnecting) {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    const hitNode = GripState.nodes.slice().reverse().find(node =>
      worldPos.x >= node.x && worldPos.x <= node.x + node.width &&
      worldPos.y >= node.y && worldPos.y <= node.y + node.height
    );
    if (hitNode && hitNode.id !== GripState.connectionStartNodeId) {
      createEdge(GripState.connectionStartNodeId, GripState.connectionStartHandle, hitNode.id, 'auto');
    }
    GripState.isConnecting = false;
    document.getElementById('gripTempConnection').innerHTML = '';
  }

  saveGripData();
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
  if (e.key === 'c') setTool('flow-card');
  if (e.key === 't') setTool('header');
  if (e.key === 'x') setTool('pencil');
  if (e.key === 'l') setTool('connect');
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
    'flow-card': { w: 220, h: 140, style: 'shape-flow-card', text: 'Details\n• Point 1\n• Point 2' },
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
  renderCanvas();
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
  renderCanvas();
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
    style: { stroke: '#ffffff', strokeWidth: 3, opacity: 1 }
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
  }
}

function finishFreeDraw() {
  if (GripState.activeDrawNodeId) {
    const node = GripState.nodes.find(n => n.id === GripState.activeDrawNodeId);
    if (node && node.points.length > 2) {
      // Smooth the points significantly
      node.points = smoothPoints(node.points);
      node.points = smoothPoints(node.points); // Double pass for extra smoothness
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
            ${renderColors(['#ffffff', '#ff6b6b', '#51cf66', '#339af0', '#fcc419', '#845ef7', '#000000', 'transparent'], 'stroke')}
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

    saveGripData();
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
}

function deleteNode(id) {
  GripState.nodes = GripState.nodes.filter(n => n.id !== id);
  GripState.edges = GripState.edges.filter(e => e.from !== id && e.to !== id);
  renderCanvas();
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
}

function zoomOut() {
  GripState.scale = Math.max(GripState.scale / 1.2, GripState.MIN_SCALE);
  updateZoomDisplay();
  renderCanvasTransform();
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

    // Offset for the SVG coordination system
    const ox = 5000;
    const oy = 5000;

    const pathD = getSmartPath(p1.x + ox, p1.y + oy, p2.x + ox, p2.y + oy, startHandle, endHandle);

    const strokeColor = 'var(--wb-text)';

    // Increased opacity for better look
    html += `<path d="${pathD}" stroke="${strokeColor}" stroke-opacity="1" stroke-width="2" fill="none" marker-end="url(#arrowhead)" />`;
  });
  html += `</svg>`;

  // Render Nodes
  GripState.nodes.forEach(node => {
    const isSelected = GripState.selectedNodeIds.has(node.id);
    html += renderNodeHTML(node, isSelected);
  });

  layer.innerHTML = html;
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

function renderNodeHTML(node, isSelected) {
  const style = node.style || {};
  const opacity = style.opacity !== undefined ? style.opacity : 1;

  if (node.type === 'draw') {
    const stroke = style.stroke || '#fff';
    const width = style.strokeWidth || 3;
    // Use smoothed path
    const pathD = getSvgPathFromStroke(node.points);

    return `
       <div class="grip-node grip-node-draw ${isSelected ? 'selected' : ''}"
          style="transform: translate(${node.x}px, ${node.y}px); pointer-events: none; opacity: ${opacity};" data-id="${node.id}">
          <svg style="overflow:visible;"><path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/></svg>
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
  if (type === 'flow-card') return 'shape-flow-card';
  if (type === 'header') return 'shape-header';
  if (type === 'card') return 'card-default';
  if (type === 'shape:rectangle') return 'shape-rect';
  if (type === 'shape:diamond') return 'shape-diamond';
  if (type === 'shape:ellipse') return 'shape-ellipse';
  if (type === 'text') return 'shape-text';
  if (type === 'sticky') return 'shape-sticky'; // Added for consistency
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
    saveGripData(); // Save on blur
  }
}

function getNodeHandlePos(node, handle) {
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
    // Check intersection (simple containment for now)
    const center = { x: node.x + node.width / 2, y: node.y + node.height / 2 };
    if (center.x >= x1 && center.x <= x2 && center.y >= y1 && center.y <= y2) {
      GripState.selectedNodeIds.add(node.id);
    }
  });
  renderCanvas();
}


/* Export Helpers */
window.openGripDiagram = openGripDiagram;
window.closeGripDiagram = closeGripDiagram;