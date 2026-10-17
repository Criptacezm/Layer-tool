/**
 * Project Context State Management
 * Manages selected project state for AI chat with RAG context injection
 */

// Storage key for persisting selected project
const PROJECT_CONTEXT_STORAGE_KEY = 'layer_selected_project';
const PROJECT_CONTEXT_DATA_KEY = 'layer_project_context_data';

/**
 * Helper function to extract kanban tasks from columns
 * @param {Array} columns - Project columns array
 * @returns {Array} - Flattened array of tasks with column info
 */
function extractKanbanTasks(columns) {
    const tasks = [];
    if (!columns || !Array.isArray(columns)) return tasks;
    
    columns.forEach((column, colIndex) => {
        if (column.tasks && Array.isArray(column.tasks)) {
            column.tasks.forEach(task => {
                tasks.push({
                    ...task,
                    column: column.title || `Column ${colIndex + 1}`,
                    status: column.title?.toLowerCase().replace(' ', '_') || 'todo'
                });
            });
        }
    });
    return tasks;
}

/**
 * @typedef {Object} ProjectContext
 * @property {string|null} id - Selected project ID
 * @property {string|null} name - Project name
 * @property {string|null} description - Project description
 * @property {Array} tasks - Project tasks
 * @property {Array} milestones - Project milestones
 * @property {Array} teamMembers - Team members
 * @property {Object} metadata - Additional project metadata
 */

/**
 * @typedef {Object} ProjectContextState
 * @property {ProjectContext|null} selectedProject - Currently selected project
 * @property {Object|null} projectData - Cached full project data
 * @property {boolean} isLoading - Loading state
 * @property {string|null} error - Error message if any
 */

// State object
const projectContextState = {
    selectedProject: null,
    projectData: null,
    isLoading: false,
    error: null,
    listeners: new Set()
};

/**
 * Subscribe to state changes
 * @param {Function} callback - Callback function to call on state change
 * @returns {Function} Unsubscribe function
 */
function subscribeToProjectContext(callback) {
    projectContextState.listeners.add(callback);
    return () => projectContextState.listeners.delete(callback);
}

/**
 * Notify all subscribers of state change
 */
function notifyProjectContextListeners() {
    projectContextState.listeners.forEach(callback => {
        try {
            callback(getProjectContextState());
        } catch (err) {
            console.error('Project context listener error:', err);
        }
    });
}

/**
 * Get current state
 * @returns {ProjectContextState}
 */
function getProjectContextState() {
    return {
        selectedProject: projectContextState.selectedProject,
        projectData: projectContextState.projectData,
        isLoading: projectContextState.isLoading,
        error: projectContextState.error
    };
}

/**
 * Get selected project ID
 * @returns {string|null}
 */
function getSelectedProjectId() {
    return projectContextState.selectedProject?.id || null;
}

/**
 * Get selected project name
 * @returns {string|null}
 */
function getSelectedProjectName() {
    return projectContextState.selectedProject?.name || null;
}

/**
 * Check if a project is selected
 * @returns {boolean}
 */
function isProjectSelected() {
    return projectContextState.selectedProject !== null;
}

/**
 * Load persisted project selection from localStorage
 */
function loadPersistedProjectContext() {
    try {
        const stored = localStorage.getItem(PROJECT_CONTEXT_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            projectContextState.selectedProject = parsed;
            // Load full project data if we have an ID
            if (parsed?.id && typeof window !== 'undefined' && window.supabase) {
                refreshProjectData(parsed.id);
            }
        }
    } catch (err) {
        console.error('Error loading persisted project context:', err);
        localStorage.removeItem(PROJECT_CONTEXT_STORAGE_KEY);
    }
}

/**
 * Persist project selection to localStorage
 */
function persistProjectContext() {
    try {
        if (projectContextState.selectedProject) {
            localStorage.setItem(
                PROJECT_CONTEXT_STORAGE_KEY, 
                JSON.stringify(projectContextState.selectedProject)
            );
        } else {
            localStorage.removeItem(PROJECT_CONTEXT_STORAGE_KEY);
        }
    } catch (err) {
        console.error('Error persisting project context:', err);
    }
}

/**
 * Select a project and load its data
 * @param {string} projectId - Project ID to select
 * @param {string} projectName - Project name (for immediate display)
 * @returns {Promise<void>}
 */
async function selectProject(projectId, projectName = null) {
    if (!projectId) {
        console.error('selectProject: No project ID provided');
        return;
    }

    projectContextState.isLoading = true;
    projectContextState.error = null;
    notifyProjectContextListeners();

    try {
        // Set minimal project info immediately for UI responsiveness
        projectContextState.selectedProject = {
            id: projectId,
            name: projectName || 'Loading...'
        };
        persistProjectContext();
        notifyProjectContextListeners();

        // Load full project data
        await refreshProjectData(projectId);
        
    } catch (err) {
        console.error('Error selecting project:', err);
        projectContextState.error = err.message || 'Failed to load project';
        projectContextState.isLoading = false;
        notifyProjectContextListeners();
    }
}

/**
 * Refresh project data from Supabase
 * @param {string} projectId - Project ID
 */
async function refreshProjectData(projectId) {
    if (!projectId) {
        console.error('refreshProjectData: No projectId provided');
        return;
    }

    // Get Supabase client - try multiple sources
    const supabase = window.supabaseClient || (window.LayerDB?.getSupabase?.()) || null;
    
    if (!supabase) {
        console.error('refreshProjectData: Supabase client not available');
        // Fallback: try to load from localStorage cache
        const projects = typeof loadProjects === 'function' ? loadProjects() : [];
        const project = projects.find(p => p.id === projectId);
        if (project) {
            console.log('Using localStorage fallback for project data');
            projectContextState.projectData = {
                ...project,
                startDate: project.start_date,
                targetDate: project.target_date,
                kanbanTasks: extractKanbanTasks(project.columns),
                backlogTasks: [],
                milestones: [],
                teamMembers: [],
                docs: [],
                issues: []
            };
            projectContextState.selectedProject = {
                id: projectId,
                name: project.name,
                description: project.description
            };
            projectContextState.isLoading = false;
            notifyProjectContextListeners();
        }
        return;
    }

    try {
        console.log('refreshProjectData: Fetching data for project', projectId);
        
        // Fetch project details
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (projectError) {
            console.error('Error fetching project:', projectError);
            throw projectError;
        }
        
        console.log('Project fetched:', project?.name);

        // Fetch backlog tasks
        const { data: backlogTasks, error: tasksError } = await supabase
            .from('backlog_tasks')
            .select('*')
            .eq('project_id', projectId);

        // Fetch project milestones
        const { data: milestones, error: milestonesError } = await supabase
            .from('milestones')
            .select('*')
            .eq('project_id', projectId);

        // Fetch project members
        const { data: members, error: membersError } = await supabase
            .from('project_members')
            .select('*, profiles(name, email, avatar_url)')
            .eq('project_id', projectId);

        // Fetch project docs with full content
        const { data: docs, error: docsError } = await supabase
            .from('docs')
            .select('id, title, content, updated_at')
            .eq('project_id', projectId)
            .limit(10);

        // Fetch issues
        const { data: issues, error: issuesError } = await supabase
            .from('issues')
            .select('id, title, description, status, priority, assignee_name, created_at')
            .eq('project_id', projectId)
            .limit(20);

        // Extract kanban tasks from project columns (JSONB)
        const kanbanTasks = [];
        if (project.columns && Array.isArray(project.columns)) {
            project.columns.forEach((column, colIndex) => {
                if (column.tasks && Array.isArray(column.tasks)) {
                    column.tasks.forEach(task => {
                        kanbanTasks.push({
                            ...task,
                            column: column.title || `Column ${colIndex + 1}`,
                            status: column.title?.toLowerCase().replace(' ', '_') || 'todo'
                        });
                    });
                }
            });
        }

        // Build comprehensive project data
        projectContextState.projectData = {
            ...project,
            // Project dates
            startDate: project.start_date,
            targetDate: project.target_date,
            // Kanban tasks from columns JSONB
            kanbanTasks: kanbanTasks,
            // Backlog tasks
            backlogTasks: backlogTasks || [],
            milestones: milestones || [],
            teamMembers: members || [],
            docs: docs || [],
            issues: issues || []
        };

        // Update selected project with full name
        projectContextState.selectedProject = {
            id: projectId,
            name: project.name,
            description: project.description
        };

        projectContextState.isLoading = false;
        persistProjectContext();
        notifyProjectContextListeners();

        console.log('Project context loaded:', {
            name: project.name,
            kanbanTasks: kanbanTasks.length,
            backlogTasks: (backlogTasks || []).length,
            docs: (docs || []).length,
            milestones: (milestones || []).length
        });

    } catch (err) {
        console.error('Error refreshing project data:', err);
        projectContextState.error = err.message;
        projectContextState.isLoading = false;
        notifyProjectContextListeners();
    }
}

/**
 * Clear selected project
 */
function clearProject() {
    projectContextState.selectedProject = null;
    projectContextState.projectData = null;
    projectContextState.error = null;
    projectContextState.isLoading = false;
    localStorage.removeItem(PROJECT_CONTEXT_STORAGE_KEY);
    notifyProjectContextListeners();
}

/**
 * Get chat history key scoped to selected project
 * @returns {string}
 */
function getProjectChatHistoryKey() {
    const projectId = getSelectedProjectId();
    if (projectId) {
        return `aiChatHistory_${projectId}`;
    }
    return 'aiChatHistory';
}

/**
 * Build context string for AI prompt
 * @returns {string}
 */
function buildProjectContextPrompt() {
    const project = projectContextState.selectedProject;
    const data = projectContextState.projectData;

    if (!project || !data) {
        return '';
    }

    const contextParts = [
        `## Current Project Context`,
        `You are helping the user with their project: **${project.name}**`,
        ''
    ];

    // Add description if available
    if (project.description) {
        contextParts.push(`**Project Description:** ${project.description}`);
        contextParts.push('');
    }

    // Add project dates
    if (data.startDate || data.targetDate) {
        contextParts.push('### Project Timeline');
        if (data.startDate) {
            contextParts.push(`**Start Date:** ${new Date(data.startDate).toLocaleDateString()}`);
        }
        if (data.targetDate) {
            contextParts.push(`**Target/Due Date:** ${new Date(data.targetDate).toLocaleDateString()}`);
        }
        contextParts.push('');
    }

    // Add project status
    if (data.status) {
        contextParts.push(`**Status:** ${data.status}`);
        contextParts.push('');
    }

    // Add Kanban tasks (from columns)
    if (data.kanbanTasks && data.kanbanTasks.length > 0) {
        contextParts.push('### Kanban Board Tasks');
        // Group by column
        const byColumn = {};
        data.kanbanTasks.forEach(t => {
            const col = t.column || 'Uncategorized';
            if (!byColumn[col]) byColumn[col] = [];
            byColumn[col].push(t);
        });
        
        Object.entries(byColumn).forEach(([column, tasks]) => {
            contextParts.push(`**${column}:**`);
            tasks.slice(0, 10).forEach(t => {
                const statusIcon = t.completed ? '✅' : '⏳';
                contextParts.push(`  - ${statusIcon} ${t.title || t.text || 'Untitled'}${t.assignee_name ? ` (Assigned: ${t.assignee_name})` : ''}`);
            });
        });
        contextParts.push('');
    }

    // Add Backlog tasks
    if (data.backlogTasks && data.backlogTasks.length > 0) {
        contextParts.push('### Backlog Tasks');
        const sortedBacklog = data.backlogTasks
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 15);
        
        sortedBacklog.forEach(t => {
            const status = t.status || (t.completed ? 'completed' : 'pending');
            const statusIcon = status === 'completed' ? '✅' : status === 'in_progress' ? '🔄' : '⏳';
            const priority = t.priority ? ` [${t.priority}]` : '';
            contextParts.push(`- ${statusIcon} ${t.title}${priority}${t.assignee_name ? ` (Assigned: ${t.assignee_name})` : ''}`);
        });
        contextParts.push('');
    }

    // Add milestones
    if (data.milestones && data.milestones.length > 0) {
        contextParts.push('### Milestones');
        data.milestones.slice(0, 5).forEach(m => {
            const status = m.completed ? '✅' : '⏳';
            contextParts.push(`- ${status} ${m.title}${m.due_date ? ` (Due: ${new Date(m.due_date).toLocaleDateString()})` : ''}`);
        });
        contextParts.push('');
    }

    // Add issues if any
    if (data.issues && data.issues.length > 0) {
        contextParts.push('### Issues');
        data.issues.slice(0, 10).forEach(i => {
            const priorityIcon = i.priority === 'high' ? '🔴' : i.priority === 'medium' ? '🟡' : '🟢';
            contextParts.push(`- ${priorityIcon} ${i.title} (${i.status || 'open'})${i.assignee_name ? ` - Assigned: ${i.assignee_name}` : ''}`);
        });
        contextParts.push('');
    }

    // Add team members
    if (data.teamMembers && data.teamMembers.length > 0) {
        contextParts.push('### Team Members');
        data.teamMembers.forEach(m => {
            const name = m.profiles?.name || m.profiles?.email || 'Unknown';
            const role = m.role || 'Member';
            contextParts.push(`- ${name} (${role})`);
        });
        contextParts.push('');
    }

    // Add project documents with content summary
    if (data.docs && data.docs.length > 0) {
        contextParts.push('### Project Documents (Attached Resources)');
        data.docs.forEach(d => {
            contextParts.push(`**${d.title}:**`);
            // Include document content (truncated for context)
            if (d.content) {
                const contentPreview = d.content.substring(0, 800);
                contextParts.push(`${contentPreview}${d.content.length > 800 ? '...' : ''}`);
            } else {
                contextParts.push('_(No content)_');
            }
            contextParts.push('');
        });
    }

    contextParts.push('---');
    contextParts.push('**Instructions:** Use this context to provide relevant, project-specific assistance. Reference specific tasks, milestones, documents, or team members when relevant to the user\'s questions. If the user asks about tasks, dates, or project details, use the information above.');
    contextParts.push('');

    return contextParts.join('\n');
}

/**
 * Get formatted project data for RAG retrieval
 * @returns {Object|null}
 */
function getProjectDataForRAG() {
    return projectContextState.projectData;
}

// Initialize on load
if (typeof window !== 'undefined') {
    // Wait for DOM and Supabase to be ready
    const initContext = () => {
        if (window.supabase) {
            loadPersistedProjectContext();
        } else {
            // Retry after a short delay
            setTimeout(initContext, 500);
        }
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initContext);
    } else {
        initContext();
    }
}

// Export functions for use in other modules
window.ProjectContext = {
    subscribe: subscribeToProjectContext,
    getState: getProjectContextState,
    getSelectedProjectId,
    getSelectedProjectName,
    isProjectSelected,
    selectProject,
    clearProject,
    getProjectChatHistoryKey,
    buildProjectContextPrompt,
    getProjectDataForRAG,
    refreshProjectData
};
