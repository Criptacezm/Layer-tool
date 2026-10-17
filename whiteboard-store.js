/**
 * Whiteboard Data Store
 * Handles persistence for standalone whiteboards (not linked to projects)
 */

const WHITEBOARDS_KEY = 'layer_whiteboards';

function loadWhiteboards() {
    try {
        const data = localStorage.getItem(WHITEBOARDS_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Error loading whiteboards:', e);
        return [];
    }
}

function saveWhiteboardsToCache(whiteboards) {
    try {
        localStorage.setItem(WHITEBOARDS_KEY, JSON.stringify(whiteboards));
    } catch (e) {
        console.error('Error saving whiteboards to cache:', e);
    }
}

async function addWhiteboard(whiteboardData) {
    if (!window.LayerDB || !window.LayerDB.isAuthenticated()) {
        if (typeof showToast === 'function') {
            showToast('Please sign in to create whiteboards', 'error');
        }
        return null;
    }

    try {
        // Save to DB via a new dedicated table or metadata? 
        // For now, let's use the folder_items infrastructure but with a dedicated save.
        // If LayerDB doesn't have saveWhiteboard, we might need to add it or use a generic save.
        
        const whiteboards = loadWhiteboards();
        const newWhiteboard = {
            id: 'wb_' + Date.now() + Math.random().toString(36).substr(2, 5),
            ...whiteboardData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        whiteboards.unshift(newWhiteboard);
        saveWhiteboardsToCache(whiteboards);
        
        return newWhiteboard;
    } catch (error) {
        console.error('Failed to add whiteboard:', error);
        throw error;
    }
}

async function updateWhiteboard(whiteboardId, updates) {
    try {
        const whiteboards = loadWhiteboards();
        const index = whiteboards.findIndex(w => String(w.id) === String(whiteboardId));
        
        if (index !== -1) {
            whiteboards[index] = { 
                ...whiteboards[index], 
                ...updates, 
                updated_at: new Date().toISOString() 
            };
            saveWhiteboardsToCache(whiteboards);
            return whiteboards[index];
        }
        return null;
    } catch (error) {
        console.error('Failed to update whiteboard:', error);
        throw error;
    }
}

async function deleteWhiteboard(whiteboardId) {
    try {
        const whiteboards = loadWhiteboards();
        const filtered = whiteboards.filter(w => String(w.id) !== String(whiteboardId));
        saveWhiteboardsToCache(filtered);
    } catch (error) {
        console.error('Failed to delete whiteboard:', error);
        throw error;
    }
}

// Export to window for global access
window.loadWhiteboards = loadWhiteboards;
window.addWhiteboard = addWhiteboard;
window.updateWhiteboard = updateWhiteboard;
window.deleteWhiteboard = deleteWhiteboard;
