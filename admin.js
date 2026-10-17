/* ============================================
   Layer - Admin Dashboard Functionality
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initial Access Check
    await initAdminAccess();
});

async function initAdminAccess() {
    const authStatus = document.getElementById('admin-user-email');
    const tbody = document.getElementById('user-data-tbody');

    try {
        // Wait for Supabase to initialize
        if (!window.LayerDB) {
            console.error('LayerDB not found');
            return;
        }

        const { user } = await window.LayerDB.initAuth();
        
        if (!user) {
            authStatus.innerHTML = '<span class="text-red-400">Not Authenticated</span>';
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-20 text-slate-400">Please sign in to access the admin panel.</td></tr>';
            window.location.href = 'index.html'; // Redirect to login
            return;
        }

        // 🛡️ ADMIN CHECK: In this environment, we consider the first user or specific emails as admin.
        // You can restrict this to your specific email.
        const isAdmin = user.email === 'cript.service@gmail.com' || user.email.includes('admin'); 
        
        if (!isAdmin) {
            authStatus.innerHTML = `<span class="text-red-400">Access Denied: ${user.email}</span>`;
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-20 text-red-400 font-medium">This area is restricted to administrators only.</td></tr>';
            showToast('Access denied. Administrators only.', 'error');
            return;
        }

        authStatus.innerHTML = `<span class="text-green-400 flex items-center gap-2">
            <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            Admin: ${user.email}
        </span>`;

        // 2. Fetch all data
        await fetchAllAdminData();

    } catch (error) {
        console.error('Admin init error:', error);
        authStatus.innerText = 'Error checking access';
    }
}

async function fetchAllAdminData() {
    const tbody = document.getElementById('user-data-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-20"><div class="flex flex-col items-center gap-3"><div class="loading-spinner"></div><p class="text-slate-400">Fetching across all modules...</p></div></td></tr>';

    try {
        // We use the supabase client directly for admin queries as LayerDB is often scoped to current user
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Fetch everything in parallel
        const [
            { data: profiles },
            { data: preferences },
            { data: docs },
            { data: excels },
            { data: projects },
            { data: calendar },
            { data: drafts },
            { data: projectMembers },
            { data: chatMessages }
        ] = await Promise.all([
            supabase.from('profiles').select('*'),
            supabase.from('user_preferences').select('*'),
            supabase.from('docs').select('id, user_id, title, updated_at'),
            supabase.from('excels').select('id, user_id, title, updated_at'),
            supabase.from('projects').select('id, user_id, name, status'),
            supabase.from('calendar_events').select('id, user_id, title'),
            supabase.from('drafts').select('id, user_id, title, type'),
            supabase.from('project_members').select('id, project_id, user_id, role'),
            supabase.from('team_chat_messages').select('id, user_id, recipient_id, channel_type, message')
        ]);

        // Update Stats
        document.getElementById('stat-total-users').innerText = profiles?.length || 0;
        document.getElementById('stat-total-docs').innerText = docs?.length || 0;
        document.getElementById('stat-total-projects').innerText = projects?.length || 0;
        document.getElementById('stat-total-sheets').innerText = excels?.length || 0;

        // Process Data per User
        renderUserRows(profiles, { preferences, docs, excels, projects, calendar, drafts, projectMembers, chatMessages });

    } catch (error) {
        console.error('Data fetch error:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-20 text-red-400">Failed to load admin data: ${error.message}</td></tr>`;
    }
}

function renderUserRows(profiles, data) {
    const tbody = document.getElementById('user-data-tbody');
    if (!profiles || profiles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-20 text-slate-400">No users found.</td></tr>';
        return;
    }

    tbody.innerHTML = profiles.map(user => {
        const userPrefs = data.preferences?.find(p => p.user_id === user.id) || {};
        
        // Ownership
        const ownedDocs = data.docs?.filter(d => d.user_id === user.id) || [];
        const ownedExcels = data.excels?.filter(e => e.user_id === user.id) || [];
        const ownedProjects = data.projects?.filter(p => p.user_id === user.id) || [];
        
        // Read Only / Member access
        const memberProjects = data.projectMembers?.filter(m => m.user_id === user.id && m.role === 'member') || [];
        const readOnlyProjects = data.projectMembers?.filter(m => m.user_id === user.id && m.role === 'viewer') || [];
        
        // Chats
        const userDMs = data.chatMessages?.filter(m => m.channel_type === 'dm' && (m.user_id === user.id || m.recipient_id === user.id)) || [];
        const sentDMs = userDMs.filter(m => m.user_id === user.id);
        const receivedDMs = userDMs.filter(m => m.recipient_id === user.id);

        const userCalendar = data.calendar?.filter(c => c.user_id === user.id) || [];
        const userDrafts = data.drafts?.filter(d => d.user_id === user.id) || [];
        
        const theme = userPrefs.theme || 'dark';
        const themeColor = theme === 'light' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400';

        return `
            <tr>
                <td>
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg font-bold">
                            ${(user.name || user.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="font-medium text-slate-100">${user.name || 'N/A'}</div>
                            <div class="text-xs text-slate-500 font-mono">${user.email}</div>
                            <div class="text-[10px] text-slate-600 mt-1">ID: ${user.id}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <span class="text-slate-500">Docs (Owner): <b class="text-slate-300">${ownedDocs.length}</b></span>
                        <span class="text-slate-500">Sheets (Owner): <b class="text-slate-300">${ownedExcels.length}</b></span>
                        <span class="text-slate-500">Projects (Owner): <b class="text-slate-300">${ownedProjects.length}</b></span>
                        <span class="text-slate-400">Read Only/Shared: <b class="text-slate-200">${memberProjects.length + readOnlyProjects.length}</b></span>
                        <span class="text-slate-500">DMs (Sent): <b class="text-slate-300">${sentDMs.length}</b></span>
                        <span class="text-slate-500">DMs (Recv): <b class="text-slate-300">${receivedDMs.length}</b></span>
                    </div>
                </td>
                <td>
                    <span class="status-badge ${themeColor} capitalize">${theme}</span>
                </td>
                <td>
                    <div class="text-xs space-y-1 max-w-[200px]">
                        ${ownedDocs.length > 0 ? `<div class="truncate text-slate-400">📄 ${ownedDocs[0].title}</div>` : ''}
                        ${ownedProjects.length > 0 ? `<div class="truncate text-slate-400">📂 ${ownedProjects[0].name}</div>` : ''}
                        ${sentDMs.length > 0 ? `<div class="truncate text-slate-500 italic">" ${sentDMs[0].message.substring(0, 30)}... "</div>` : ''}
                        ${ownedDocs.length === 0 && ownedProjects.length === 0 && sentDMs.length === 0 ? '<span class="text-slate-600 italic">No recent activity</span>' : ''}
                    </div>
                </td>
                <td>
                    <button class="px-3 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/5 text-xs transition-colors">Manage</button>
                </td>
            </tr>
        `;
    }).join('');
}

function showToast(message, type = 'info') {
    // Simple admin toast if function.js isn't available
    console.log(`[Admin Toast] ${type}: ${message}`);
}
