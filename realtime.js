/* ============================================
   Layer - Realtime Collaboration System
   Professional-grade live updates for all actions
   ============================================ */

// Global realtime subscription channels
let realtimeChannels = new Map();
let currentProjectSubscription = null;
let projectDetailSubscription = null;

// Callbacks registry for UI updates
const realtimeCallbacks = {
  onProjectUpdate: null,
  onMemberAdded: null,
  onMemberRemoved: null,
  onProjectDeleted: null
};

// ============================================
// Register UI Callbacks
// ============================================

function registerRealtimeCallbacks(callbacks) {
  Object.assign(realtimeCallbacks, callbacks);
  console.log('Realtime callbacks registered');
}

// ============================================
// Project Detail Realtime Subscriptions
// Subscribe when viewing a specific project
// ============================================

function subscribeToProjectDetail(projectId, callbacks) {
  if (!projectId) {
    console.warn('projectId is required for project detail subscription');
    return null;
  }

  // Unsubscribe from existing detail subscription
  unsubscribeFromProjectDetail();

  const channelName = `project_detail_${projectId}`;
  
  console.log('Subscribing to project detail:', projectId);
  
  projectDetailSubscription = supabaseClient
    .channel(channelName)
    // Listen to project changes
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'projects', 
        filter: `id=eq.${projectId}` 
      },
      (payload) => {
        console.log('Project detail change:', payload.eventType, payload);
        
        if (payload.eventType === 'DELETE') {
          // Project was deleted - notify UI
          if (callbacks?.onProjectDeleted || realtimeCallbacks.onProjectDeleted) {
            (callbacks?.onProjectDeleted || realtimeCallbacks.onProjectDeleted)(payload);
          }
        } else if (callbacks?.onProjectUpdate || realtimeCallbacks.onProjectUpdate) {
          (callbacks?.onProjectUpdate || realtimeCallbacks.onProjectUpdate)(payload);
        }
      }
    )
    // Listen to member changes for this project
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'project_members', 
        filter: `project_id=eq.${projectId}` 
      },
      (payload) => {
        console.log('Project member change:', payload.eventType, payload);
        
        if (payload.eventType === 'INSERT') {
          if (callbacks?.onMemberAdded || realtimeCallbacks.onMemberAdded) {
            (callbacks?.onMemberAdded || realtimeCallbacks.onMemberAdded)(payload);
          }
        } else if (payload.eventType === 'DELETE') {
          if (callbacks?.onMemberRemoved || realtimeCallbacks.onMemberRemoved) {
            (callbacks?.onMemberRemoved || realtimeCallbacks.onMemberRemoved)(payload);
          }
        }
      }
    )
    .subscribe((status) => {
      console.log('Project detail subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('✓ Subscribed to project detail realtime');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('Failed to subscribe to project detail');
      }
    });

  realtimeChannels.set(channelName, projectDetailSubscription);
  return projectDetailSubscription;
}

function unsubscribeFromProjectDetail() {
  if (projectDetailSubscription) {
    console.log('Unsubscribing from project detail');
    supabaseClient.removeChannel(projectDetailSubscription);
    projectDetailSubscription = null;
  }
  
  // Clean up any project_detail channels
  realtimeChannels.forEach((channel, name) => {
    if (name.startsWith('project_detail_')) {
      supabaseClient.removeChannel(channel);
      realtimeChannels.delete(name);
    }
  });
}

// ============================================
// Project Realtime Subscriptions (Legacy - redirect to detail)
// ============================================

function subscribeToProjectChanges(projectId, onChangeCallback) {
  return subscribeToProjectDetail(projectId, {
    onProjectUpdate: onChangeCallback,
    onMemberAdded: onChangeCallback,
    onMemberRemoved: onChangeCallback,
    onProjectDeleted: onChangeCallback
  });
}

function unsubscribeFromProjectChanges() {
  unsubscribeFromProjectDetail();
}

// ============================================
// Global Projects Realtime Subscriptions
// For the projects list view
// ============================================

function subscribeToAllUserProjects(callback) {
  if (!currentUser) {
    console.warn('User must be authenticated for realtime');
    return null;
  }

  // Unsubscribe from existing
  unsubscribeFromAllProjects();

  const channelName = 'user_projects_realtime';
  
  console.log('Subscribing to all user projects changes');
  
  const channel = supabaseClient
    .channel(channelName)
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'projects' }, 
      (payload) => {
        console.log('Global project change:', payload.eventType);
        handleProjectChange(payload, callback);
      }
    )
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'project_members' }, 
      (payload) => {
        console.log('Global member change:', payload.eventType);
        handleMemberChange(payload, callback);
      }
    )
    .subscribe((status) => {
      console.log('Global projects subscription:', status);
    });
  
  realtimeChannels.set(channelName, channel);
  return channel;
}

function unsubscribeFromAllProjects() {
  const channel = realtimeChannels.get('user_projects_realtime');
  if (channel) {
    console.log('Unsubscribing from all projects');
    supabaseClient.removeChannel(channel);
    realtimeChannels.delete('user_projects_realtime');
  }
}

// ============================================
// Change Handlers with Filtering
// ============================================

function handleProjectChange(payload, callback) {
  if (!currentUser || !payload) return;
  
  const { eventType, new: newRecord, old: oldRecord } = payload;
  const record = newRecord || oldRecord;
  
  if (!record) return;
  
  // Check relevance
  const isOwner = record.user_id === currentUser.id;
  const isTeamMember = Array.isArray(record.team_members) && 
    record.team_members.includes(currentUser.email);
  
  // For deletes, check old record ownership
  if (eventType === 'DELETE') {
    const wasOwner = oldRecord?.user_id === currentUser.id;
    const wasTeamMember = Array.isArray(oldRecord?.team_members) && 
      oldRecord.team_members.includes(currentUser.email);
    
    if (wasOwner || wasTeamMember) {
      callback(payload);
    }
    return;
  }
  
  // For other events, only trigger if relevant
  if (isOwner || isTeamMember) {
    callback(payload);
  }
}

function handleMemberChange(payload, callback) {
  if (!currentUser || !payload) return;
  
  const { eventType, new: newRecord, old: oldRecord } = payload;
  const record = newRecord || oldRecord;
  
  if (!record) return;
  
  // Always notify if change involves current user
  if (record.user_id === currentUser.id) {
    callback(payload);
    return;
  }
  
  // For other changes, check if user has access to the project
  // (RLS ensures we only receive events we're allowed to see)
  callback(payload);
}

// ============================================
// Helper Functions
// ============================================

function isProjectChangeRelevant(payload) {
  if (!currentUser || !payload) return false;
  
  const { eventType, new: newRecord, old: oldRecord } = payload;
  const record = newRecord || oldRecord;
  
  if (!record) return false;
  
  // Check if user is owner
  if (record.user_id === currentUser.id) return true;
  
  // For INSERT/UPDATE, check if user is a member
  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    return true; // RLS handles filtering
  }
  
  // For DELETE, check old record
  if (eventType === 'DELETE' && oldRecord) {
    return oldRecord.user_id === currentUser.id;
  }
  
  return false;
}

function isMemberChangeRelevant(payload) {
  if (!currentUser || !payload) return false;
  
  const { new: newRecord, old: oldRecord } = payload;
  const record = newRecord || oldRecord;
  
  if (!record) return false;
  
  // Always relevant if involves current user
  if (record.user_id === currentUser.id) return true;
  
  // Otherwise, trust RLS filtering
  return true;
}

// ============================================
// Optimistic UI Updates
// ============================================

function createOptimisticUpdate(updateType, data, projectId) {
  return {
    type: 'optimistic',
    updateType,
    data,
    projectId,
    timestamp: Date.now(),
    id: `optimistic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
}

function handleRealtimeUpdate(payload, optimisticUpdates, renderCallback) {
  const { eventType, table, new: newRecord, old: oldRecord } = payload;
  
  // Remove matching optimistic updates
  const filteredOptimistic = optimisticUpdates.filter(update => {
    if (update.updateType === eventType && update.table === table) {
      if (eventType === 'INSERT' && newRecord && update.data.tempId === newRecord.tempId) {
        return false;
      }
      if (eventType === 'UPDATE' && newRecord && update.data.id === newRecord.id) {
        return false;
      }
      if (eventType === 'DELETE' && oldRecord && update.data.id === oldRecord.id) {
        return false;
      }
    }
    return true;
  });
  
  // Trigger re-render
  if (renderCallback) {
    renderCallback(payload, filteredOptimistic);
  }
  
  return filteredOptimistic;
}

// ============================================
// Cleanup
// ============================================

function cleanupRealtimeSubscriptions() {
  console.log('Cleaning up all realtime subscriptions');
  
  realtimeChannels.forEach((channel, channelName) => {
    console.log('Unsubscribing from:', channelName);
    supabaseClient.removeChannel(channel);
  });
  
  realtimeChannels.clear();
  currentProjectSubscription = null;
  projectDetailSubscription = null;
}

// Auto-cleanup on page unload
window.addEventListener('beforeunload', cleanupRealtimeSubscriptions);

// ============================================
// Export Functions
// ============================================

window.LayerRealtime = {
  // New API
  subscribeToProjectDetail,
  unsubscribeFromProjectDetail,
  registerRealtimeCallbacks,
  
  // Legacy API (still works)
  subscribeToProjectChanges,
  unsubscribeFromProjectChanges,
  subscribeToAllUserProjects,
  unsubscribeFromAllProjects,
  
  // Utilities
  createOptimisticUpdate,
  handleRealtimeUpdate,
  cleanupRealtimeSubscriptions
};
