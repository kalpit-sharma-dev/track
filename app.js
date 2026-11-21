// Tech Lead Daily Tracker - Main Application

// Data Store
let appData = {
    updates: [],
    actions: [],
    teams: [],
    tags: [],
    lastSaved: null,
    settings: {
        darkMode: false
    }
};

// Auto-save file path (for reference)
const DATA_FILE_NAME = 'tech-lead-tracker-data.json';

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initializeApp();
    setupNavigation();
    updateDashboard();
    populateTeamDropdowns();
    setDefaultDates();
    updateLastSavedIndicator();
    applyTheme();
    checkRecurringActions();
    populateTagSuggestions();
});

// Load data from localStorage (with fallback to sessionStorage backup)
function loadData() {
    let saved = localStorage.getItem('techLeadTracker');
    
    // If localStorage is empty, try sessionStorage backup
    if (!saved) {
        saved = sessionStorage.getItem('techLeadTrackerBackup');
        if (saved) {
            console.log('Restored from session backup');
        }
    }
    
    if (saved) {
        try {
            appData = JSON.parse(saved);
            // Ensure all required arrays exist
            if (!appData.updates) appData.updates = [];
            if (!appData.actions) appData.actions = [];
            if (!appData.teams) appData.teams = [];
        } catch (e) {
            console.error('Error parsing saved data:', e);
            initializeDefaultData();
        }
    } else {
        initializeDefaultData();
    }
}

// Initialize with default teams
function initializeDefaultData() {
    appData = {
        updates: [],
        actions: [],
        teams: [
            { id: generateId(), name: 'Techbacklog', description: 'Technical backlog management', members: 'Shyam', color: '#4F46E5' },
            { id: generateId(), name: 'Deposits', description: 'Deposits feature team', members: '', color: '#10B981' },
            { id: generateId(), name: 'MFA', description: 'Multi-factor authentication', members: '', color: '#F59E0B' },
            { id: generateId(), name: 'Performance Pod', description: 'App performance optimization', members: 'Murthy', color: '#EF4444' },
            { id: generateId(), name: 'Drishti AI', description: 'AI and ML initiatives', members: '', color: '#8B5CF6' },
            { id: generateId(), name: 'CQRS', description: 'Command Query Responsibility Segregation', members: 'Kavita, Indra', color: '#EC4899' }
        ],
        tags: ['urgent', 'follow-up', 'blocked', 'review-needed', 'completed', 'in-progress'],
        lastSaved: null,
        settings: {
            darkMode: false
        }
    };
    saveData();
}

// ==================== DARK MODE ====================

function toggleDarkMode() {
    appData.settings.darkMode = !appData.settings.darkMode;
    applyTheme();
    saveData();
}

function applyTheme() {
    const theme = appData.settings?.darkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = appData.settings?.darkMode ? '☀️' : '🌙';
    }
}

// ==================== GLOBAL SEARCH ====================

function globalSearch(event) {
    const query = event.target.value.trim().toLowerCase();
    
    if (query.length < 2) {
        // If less than 2 characters, go back to previous view
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav) {
            showView(activeNav.dataset.view);
        }
        return;
    }
    
    // Show search results view
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('search-view').classList.add('active');
    
    // Remove active state from nav items when in search
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    const results = {
        updates: [],
        actions: [],
        teams: []
    };
    
    // Search updates
    appData.updates.forEach(update => {
        if (update.description.toLowerCase().includes(query) ||
            update.people?.toLowerCase().includes(query) ||
            update.category.toLowerCase().includes(query) ||
            update.tags?.some(t => t.toLowerCase().includes(query))) {
            results.updates.push(update);
        }
    });
    
    // Search actions
    appData.actions.forEach(action => {
        if (action.title.toLowerCase().includes(query) ||
            action.description?.toLowerCase().includes(query) ||
            action.owner.toLowerCase().includes(query) ||
            action.jira?.toLowerCase().includes(query)) {
            results.actions.push(action);
        }
    });
    
    // Search teams
    appData.teams.forEach(team => {
        if (team.name.toLowerCase().includes(query) ||
            team.description?.toLowerCase().includes(query) ||
            team.members?.toLowerCase().includes(query)) {
            results.teams.push(team);
        }
    });
    
    renderSearchResults(results, query);
}

function renderSearchResults(results, query) {
    const container = document.getElementById('searchResults');
    const totalResults = results.updates.length + results.actions.length + results.teams.length;
    
    if (totalResults === 0) {
        container.innerHTML = `<p class="empty-state">No results found for "${query}"</p>`;
        return;
    }
    
    let html = `<p style="margin-bottom: 20px; color: var(--text-secondary);">Found ${totalResults} result${totalResults !== 1 ? 's' : ''} for "<strong>${query}</strong>"</p>`;
    
    if (results.updates.length > 0) {
        html += `
            <div class="search-section">
                <h4>📝 Updates (${results.updates.length})</h4>
                ${results.updates.slice(0, 10).map(update => `
                    <div class="search-item" onclick="showView('daily')">
                        <strong>${highlightText(update.description, query)}</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                            ${formatDate(update.date, 'short')} • ${update.category}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    if (results.actions.length > 0) {
        html += `
            <div class="search-section">
                <h4>✅ Action Items (${results.actions.length})</h4>
                ${results.actions.slice(0, 10).map(action => `
                    <div class="search-item" onclick="showView('actions'); openEditActionModal('${action.id}')">
                        <strong>${highlightText(action.title, query)}</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                            Owner: ${action.owner} • Status: ${action.status}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    if (results.teams.length > 0) {
        html += `
            <div class="search-section">
                <h4>👥 Teams (${results.teams.length})</h4>
                ${results.teams.map(team => `
                    <div class="search-item" onclick="showView('teams')">
                        <strong>${highlightText(team.name, query)}</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                            ${team.description || 'No description'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function highlightText(text, query) {
    if (!text) return '';
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
}

function closeSearch() {
    document.getElementById('globalSearch').value = '';
    showView('dashboard');
}

function searchByTag(tag) {
    document.getElementById('globalSearch').value = tag;
    globalSearch({ target: { value: tag } });
}

// ==================== TAGS ====================

function populateTagSuggestions() {
    const container = document.getElementById('tagSuggestions');
    if (!container) return;
    
    // Get all unique tags from updates
    const allTags = new Set(appData.tags || []);
    appData.updates.forEach(u => {
        if (u.tags) u.tags.forEach(t => allTags.add(t));
    });
    
    container.innerHTML = Array.from(allTags).slice(0, 8).map(tag => 
        `<span class="tag-suggestion" onclick="addTagToInput('${tag}')">${tag}</span>`
    ).join('');
}

function addTagToInput(tag) {
    const input = document.getElementById('updateTags');
    const currentTags = input.value.split(',').map(t => t.trim()).filter(t => t);
    if (!currentTags.includes(tag)) {
        currentTags.push(tag);
        input.value = currentTags.join(', ');
    }
}

// Save data to localStorage and update indicator
function saveData() {
    appData.lastSaved = new Date().toISOString();
    localStorage.setItem('techLeadTracker', JSON.stringify(appData));
    updateLastSavedIndicator();
    
    // Also save to a downloadable file location for extra safety
    saveToFile();
}

// Update the last saved indicator in UI
function updateLastSavedIndicator() {
    const indicator = document.getElementById('lastSavedIndicator');
    if (indicator && appData.lastSaved) {
        const savedDate = new Date(appData.lastSaved);
        const timeStr = savedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const dateStr = savedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        indicator.textContent = `Last saved: ${dateStr} ${timeStr}`;
        indicator.style.color = '#10B981';
    }
}

// Save data to a JSON file (creates downloadable backup)
function saveToFile() {
    const dataStr = JSON.stringify(appData, null, 2);
    
    // Store in sessionStorage as immediate backup
    sessionStorage.setItem('techLeadTrackerBackup', dataStr);
}

// Manual save to file (download)
function downloadBackup() {
    const dataStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tech-lead-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    // Show confirmation
    alert('Backup downloaded! Keep this file safe. You can import it anytime to restore your data.');
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Initialize application
function initializeApp() {
    document.getElementById('currentDate').textContent = formatDate(new Date());
    renderTeams();
    renderUpdates();
    renderActions();
    
    // Show data summary on first load
    showDataSummary();
}

// Show summary of loaded data
function showDataSummary() {
    const updates = appData.updates.length;
    const actions = appData.actions.length;
    const teams = appData.teams.length;
    
    if (updates > 0 || actions > 0) {
        console.log(`📊 Data loaded: ${updates} updates, ${actions} action items, ${teams} teams`);
    }
    
    // Reminder to backup if there's significant data and no recent backup
    if ((updates > 10 || actions > 5) && appData.lastSaved) {
        const lastSave = new Date(appData.lastSaved);
        const daysSinceBackup = (new Date() - lastSave) / (1000 * 60 * 60 * 24);
        
        if (daysSinceBackup > 7) {
            setTimeout(() => {
                if (confirm(`You have ${updates} updates and ${actions} action items.\n\nIt's been ${Math.floor(daysSinceBackup)} days since your last backup.\n\nWould you like to download a backup now?`)) {
                    downloadBackup();
                }
            }, 2000);
        }
    }
}

// Setup navigation
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            showView(view);
            
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

// Show specific view
function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`${viewName}-view`).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
    });
    
    if (viewName === 'weekly') {
        setCurrentWeek();
        generateWeeklyReport();
    }
    
    if (viewName === 'analytics') {
        updateAnalytics();
    }
    
    if (viewName === 'teams') {
        renderTeams();
    }
    
    if (viewName === 'daily') {
        renderUpdates();
    }
    
    if (viewName === 'actions') {
        renderActions();
    }
}

// Set default dates
function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('updateDate').value = today;
    document.getElementById('filterDate').value = '';
}

// Set current week in week selector
function setCurrentWeek() {
    const now = new Date();
    const year = now.getFullYear();
    const week = getWeekNumber(now);
    document.getElementById('weekSelector').value = `${year}-W${week.toString().padStart(2, '0')}`;
}

// Get week number
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Format date
function formatDate(date, format = 'long') {
    const d = new Date(date);
    if (format === 'short') {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Populate team dropdowns
function populateTeamDropdowns() {
    const dropdowns = ['updateTeam', 'actionTeam', 'filterTeam', 'filterActionTeam'];
    dropdowns.forEach(id => {
        const dropdown = document.getElementById(id);
        if (dropdown) {
            const currentValue = dropdown.value;
            const isFilter = id.startsWith('filter');
            dropdown.innerHTML = isFilter ? '<option value="">All Teams</option>' : '<option value="">Select Team</option>';
            appData.teams.forEach(team => {
                dropdown.innerHTML += `<option value="${team.id}">${team.name}</option>`;
            });
            dropdown.value = currentValue;
        }
    });
    
    // Populate owner filter
    const owners = [...new Set(appData.actions.map(a => a.owner))].filter(o => o).sort();
    const ownerFilter = document.getElementById('filterActionOwner');
    if (ownerFilter) {
        ownerFilter.innerHTML = '<option value="">All Owners</option>';
        owners.forEach(owner => {
            ownerFilter.innerHTML += `<option value="${owner}">${owner}</option>`;
        });
    }
}

// ==================== UPDATES ====================

function openAddUpdateModal() {
    document.getElementById('addUpdateForm').reset();
    document.getElementById('updateDate').value = new Date().toISOString().split('T')[0];
    openModal('addUpdateModal');
}

function saveUpdate(event) {
    event.preventDefault();
    
    const tagsInput = document.getElementById('updateTags').value;
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [];
    
    const update = {
        id: generateId(),
        date: document.getElementById('updateDate').value,
        category: document.getElementById('updateCategory').value,
        teamId: document.getElementById('updateTeam').value,
        description: document.getElementById('updateDescription').value,
        people: document.getElementById('updatePeople').value,
        tags: tags,
        createdAt: new Date().toISOString()
    };
    
    // Add new tags to global tags list
    tags.forEach(tag => {
        if (!appData.tags.includes(tag)) {
            appData.tags.push(tag);
        }
    });
    
    appData.updates.unshift(update);
    saveData();
    renderUpdates();
    updateDashboard();
    populateTagSuggestions();
    closeModal('addUpdateModal');
}

function renderUpdates(filteredUpdates = null) {
    const updates = filteredUpdates || appData.updates;
    const container = document.getElementById('dailyUpdatesList');
    
    if (updates.length === 0) {
        container.innerHTML = '<p class="empty-state">No daily updates yet. Click "Add Update" to get started!</p>';
        return;
    }
    
    // Group by date
    const grouped = {};
    updates.forEach(update => {
        if (!grouped[update.date]) grouped[update.date] = [];
        grouped[update.date].push(update);
    });
    
    let html = '';
    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
    
    sortedDates.forEach((date, dateIndex) => {
        const isToday = date === new Date().toISOString().split('T')[0];
        const isYesterday = date === new Date(Date.now() - 86400000).toISOString().split('T')[0];
        
        let dateLabel = formatDate(date);
        if (isToday) dateLabel = '📍 Today - ' + dateLabel;
        else if (isYesterday) dateLabel = '📅 Yesterday - ' + dateLabel;
        else dateLabel = '📅 ' + dateLabel;
        
        html += `<div class="date-group" style="margin-bottom: 28px;">
            <h3 style="margin-bottom: 16px; ${isToday ? 'color: var(--primary); font-weight: 700;' : ''}">
                ${dateLabel}
                <span style="font-weight: 400; opacity: 0.6; margin-left: 8px; font-size: 0.8rem;">(${grouped[date].length} update${grouped[date].length !== 1 ? 's' : ''})</span>
            </h3>`;
        
        grouped[date].forEach((update, index) => {
            const team = appData.teams.find(t => t.id === update.teamId);
            const categoryIcons = {
                meeting: '🤝',
                discussion: '💬',
                review: '👀',
                approval: '✅',
                audit: '🔍',
                planning: '📋',
                issue: '🔧',
                other: '📌'
            };
            
            const tagsHtml = update.tags && update.tags.length > 0 
                ? `<div class="tags-container">${update.tags.map(tag => `<span class="tag" onclick="event.stopPropagation(); searchByTag('${tag}')">#${tag}</span>`).join('')}</div>` 
                : '';
            
            html += `
                <div class="update-item" style="animation-delay: ${index * 0.05}s; border-left-color: ${team ? team.color : 'var(--primary)'}; cursor: pointer;" onclick="openEditUpdateModal('${update.id}')">
                    <div class="update-header">
                        <div class="update-meta">
                            <span class="update-category category-${update.category}">
                                ${categoryIcons[update.category] || '📌'} ${update.category}
                            </span>
                            ${team ? `<span class="update-team" style="background: ${team.color}15; color: ${team.color}; border: 1px solid ${team.color}30;">${team.name}</span>` : ''}
                        </div>
                        <div class="update-actions">
                            <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); openEditUpdateModal('${update.id}')" title="Edit this update">
                                ✏️
                            </button>
                            <button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); deleteUpdate('${update.id}')" title="Delete this update">
                                🗑️
                            </button>
                        </div>
                    </div>
                    <p class="update-description">${update.description}</p>
                    ${update.people ? `<p class="update-people"><strong>With:</strong> ${update.people}</p>` : ''}
                    ${tagsHtml}
                </div>
            `;
        });
        
        html += '</div>';
    });
    
    container.innerHTML = html;
}

function deleteUpdate(id) {
    if (confirm('Are you sure you want to delete this update?')) {
        appData.updates = appData.updates.filter(u => u.id !== id);
        saveData();
        renderUpdates();
        updateDashboard();
    }
}

function openEditUpdateModal(id) {
    const update = appData.updates.find(u => u.id === id);
    if (!update) return;
    
    document.getElementById('editUpdateId').value = update.id;
    document.getElementById('editUpdateDate').value = update.date;
    document.getElementById('editUpdateCategory').value = update.category;
    document.getElementById('editUpdateDescription').value = update.description;
    document.getElementById('editUpdatePeople').value = update.people || '';
    document.getElementById('editUpdateTags').value = update.tags ? update.tags.join(', ') : '';
    
    // Populate team dropdown
    const teamDropdown = document.getElementById('editUpdateTeam');
    teamDropdown.innerHTML = '<option value="">Select Team</option>';
    appData.teams.forEach(team => {
        teamDropdown.innerHTML += `<option value="${team.id}">${team.name}</option>`;
    });
    teamDropdown.value = update.teamId || '';
    
    openModal('editUpdateModal');
}

function updateUpdate(event) {
    event.preventDefault();
    
    const id = document.getElementById('editUpdateId').value;
    const update = appData.updates.find(u => u.id === id);
    if (!update) return;
    
    const tagsInput = document.getElementById('editUpdateTags').value;
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [];
    
    update.date = document.getElementById('editUpdateDate').value;
    update.category = document.getElementById('editUpdateCategory').value;
    update.teamId = document.getElementById('editUpdateTeam').value;
    update.description = document.getElementById('editUpdateDescription').value;
    update.people = document.getElementById('editUpdatePeople').value;
    update.tags = tags;
    
    // Add new tags to global tags list
    tags.forEach(tag => {
        if (!appData.tags.includes(tag)) {
            appData.tags.push(tag);
        }
    });
    
    saveData();
    renderUpdates();
    updateDashboard();
    populateTagSuggestions();
    closeModal('editUpdateModal');
}

function deleteUpdateFromModal() {
    const id = document.getElementById('editUpdateId').value;
    if (confirm('Are you sure you want to delete this update?')) {
        appData.updates = appData.updates.filter(u => u.id !== id);
        saveData();
        renderUpdates();
        updateDashboard();
        closeModal('editUpdateModal');
    }
}

function filterUpdates() {
    const dateFilter = document.getElementById('filterDate').value;
    const teamFilter = document.getElementById('filterTeam').value;
    const categoryFilter = document.getElementById('filterCategory').value;
    const sortBy = document.getElementById('sortUpdates').value;
    
    let filtered = [...appData.updates];
    
    if (dateFilter) {
        filtered = filtered.filter(u => u.date === dateFilter);
    }
    if (teamFilter) {
        filtered = filtered.filter(u => u.teamId === teamFilter);
    }
    if (categoryFilter) {
        filtered = filtered.filter(u => u.category === categoryFilter);
    }
    
    // Sort
    switch (sortBy) {
        case 'date-desc':
            filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
        case 'date-asc':
            filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
            break;
        case 'category':
            filtered.sort((a, b) => a.category.localeCompare(b.category));
            break;
    }
    
    renderUpdates(filtered);
}

function clearFilters() {
    document.getElementById('filterDate').value = '';
    document.getElementById('filterTeam').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('sortUpdates').value = 'date-desc';
    renderUpdates();
}

// ==================== ACTIONS ====================

function openAddActionModal() {
    document.getElementById('addActionForm').reset();
    openModal('addActionModal');
}

function saveAction(event) {
    event.preventDefault();
    
    const action = {
        id: generateId(),
        title: document.getElementById('actionTitle').value,
        description: document.getElementById('actionDescription').value,
        owner: document.getElementById('actionOwner').value,
        priority: document.getElementById('actionPriority').value,
        dueDate: document.getElementById('actionDueDate').value,
        teamId: document.getElementById('actionTeam').value,
        jira: document.getElementById('actionJira').value,
        recurring: document.getElementById('actionRecurring').value,
        status: 'pending',
        notes: '',
        createdAt: new Date().toISOString(),
        completedAt: null,
        lastRecurringCreated: null
    };
    
    appData.actions.push(action);
    saveData();
    renderActions();
    updateDashboard();
    populateTeamDropdowns();
    closeModal('addActionModal');
}

// ==================== RECURRING ACTIONS ====================

function checkRecurringActions() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    appData.actions.forEach(action => {
        if (!action.recurring || action.status !== 'completed') return;
        
        const lastCreated = action.lastRecurringCreated ? new Date(action.lastRecurringCreated) : new Date(action.completedAt);
        lastCreated.setHours(0, 0, 0, 0);
        
        let shouldCreate = false;
        const daysDiff = Math.floor((today - lastCreated) / (1000 * 60 * 60 * 24));
        
        switch (action.recurring) {
            case 'daily':
                shouldCreate = daysDiff >= 1;
                break;
            case 'weekly':
                shouldCreate = daysDiff >= 7;
                break;
            case 'biweekly':
                shouldCreate = daysDiff >= 14;
                break;
            case 'monthly':
                shouldCreate = daysDiff >= 30;
                break;
        }
        
        if (shouldCreate) {
            createRecurringAction(action);
        }
    });
}

function createRecurringAction(originalAction) {
    const newAction = {
        id: generateId(),
        title: originalAction.title,
        description: originalAction.description,
        owner: originalAction.owner,
        priority: originalAction.priority,
        dueDate: calculateNextDueDate(originalAction.recurring),
        teamId: originalAction.teamId,
        jira: originalAction.jira,
        recurring: originalAction.recurring,
        status: 'pending',
        notes: '',
        createdAt: new Date().toISOString(),
        completedAt: null,
        parentActionId: originalAction.id
    };
    
    appData.actions.push(newAction);
    originalAction.lastRecurringCreated = new Date().toISOString();
    saveData();
    renderActions();
}

function calculateNextDueDate(recurring) {
    const date = new Date();
    switch (recurring) {
        case 'daily':
            date.setDate(date.getDate() + 1);
            break;
        case 'weekly':
            date.setDate(date.getDate() + 7);
            break;
        case 'biweekly':
            date.setDate(date.getDate() + 14);
            break;
        case 'monthly':
            date.setMonth(date.getMonth() + 1);
            break;
    }
    return date.toISOString().split('T')[0];
}

function renderActions(filteredActions = null) {
    const actions = filteredActions || appData.actions;
    
    const statuses = ['pending', 'in-progress', 'completed', 'blocked'];
    const statusToId = {
        'pending': 'pending',
        'in-progress': 'inProgress',
        'completed': 'completed',
        'blocked': 'blocked'
    };
    
    statuses.forEach(status => {
        const idPrefix = statusToId[status];
        const container = document.getElementById(`${idPrefix}ActionItems`);
        const countEl = document.getElementById(`${idPrefix}Count`);
        
        if (!container) return;
        
        const statusActions = actions.filter(a => a.status === status);
        countEl.textContent = statusActions.length;
        
        if (statusActions.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 30px 20px; opacity: 0.7;">
                ${status === 'completed' ? '✨ Complete some tasks!' : status === 'blocked' ? '🎉 No blockers!' : 'No items'}
            </p>`;
            return;
        }
        
        // Sort by priority within each status
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        statusActions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        
        container.innerHTML = statusActions.map(action => {
            const team = appData.teams.find(t => t.id === action.teamId);
            const isOverdue = action.dueDate && new Date(action.dueDate) < new Date() && action.status !== 'completed';
            const daysUntilDue = action.dueDate ? Math.ceil((new Date(action.dueDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;
            
            let dueText = '';
            if (action.dueDate) {
                if (isOverdue) {
                    dueText = `⚠️ Overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''}`;
                } else if (daysUntilDue === 0) {
                    dueText = '📅 Due today';
                } else if (daysUntilDue === 1) {
                    dueText = '📅 Due tomorrow';
                } else {
                    dueText = `📅 ${formatDate(action.dueDate, 'short')}`;
                }
            }
            
            return `
                <div class="action-card priority-${action.priority}" onclick="openEditActionModal('${action.id}')">
                    <span class="priority-badge ${action.priority}">${action.priority}</span>
                    <div class="action-title">${action.title}</div>
                    <div class="action-owner">👤 ${action.owner}</div>
                    ${team ? `<div style="font-size: 0.7rem; color: ${team.color}; margin-top: 6px; font-weight: 600;">● ${team.name}</div>` : ''}
                    ${action.dueDate ? `<div class="action-due ${isOverdue ? 'overdue' : ''}">${dueText}</div>` : ''}
                    ${action.jira ? `<span class="action-jira">${action.jira}</span>` : ''}
                    ${action.recurring ? `<span class="recurring-badge">${action.recurring}</span>` : ''}
                </div>
            `;
        }).join('');
    });
}

function openEditActionModal(id) {
    const action = appData.actions.find(a => a.id === id);
    if (!action) return;
    
    document.getElementById('editActionId').value = action.id;
    document.getElementById('editActionTitle').value = action.title;
    document.getElementById('editActionDescription').value = action.description || '';
    document.getElementById('editActionOwner').value = action.owner;
    document.getElementById('editActionStatus').value = action.status;
    document.getElementById('editActionPriority').value = action.priority;
    document.getElementById('editActionDueDate').value = action.dueDate || '';
    document.getElementById('editActionNotes').value = action.notes || '';
    document.getElementById('editActionJira').value = action.jira || '';
    document.getElementById('editActionRecurring').value = action.recurring || '';
    
    // Populate team dropdown
    const teamDropdown = document.getElementById('editActionTeam');
    teamDropdown.innerHTML = '<option value="">Select Team</option>';
    appData.teams.forEach(team => {
        teamDropdown.innerHTML += `<option value="${team.id}">${team.name}</option>`;
    });
    teamDropdown.value = action.teamId || '';
    
    openModal('editActionModal');
}

function updateAction(event) {
    event.preventDefault();
    
    const id = document.getElementById('editActionId').value;
    const action = appData.actions.find(a => a.id === id);
    if (!action) return;
    
    const wasNotCompleted = action.status !== 'completed';
    
    action.title = document.getElementById('editActionTitle').value;
    action.description = document.getElementById('editActionDescription').value;
    action.owner = document.getElementById('editActionOwner').value;
    action.status = document.getElementById('editActionStatus').value;
    action.priority = document.getElementById('editActionPriority').value;
    action.dueDate = document.getElementById('editActionDueDate').value;
    action.notes = document.getElementById('editActionNotes').value;
    action.teamId = document.getElementById('editActionTeam').value;
    action.jira = document.getElementById('editActionJira').value;
    action.recurring = document.getElementById('editActionRecurring').value;
    
    if (wasNotCompleted && action.status === 'completed') {
        action.completedAt = new Date().toISOString();
    }
    
    saveData();
    renderActions();
    updateDashboard();
    populateTeamDropdowns();
    closeModal('editActionModal');
}

function deleteAction() {
    const id = document.getElementById('editActionId').value;
    if (confirm('Are you sure you want to delete this action item?')) {
        appData.actions = appData.actions.filter(a => a.id !== id);
        saveData();
        renderActions();
        updateDashboard();
        closeModal('editActionModal');
    }
}

function filterActions() {
    const statusFilter = document.getElementById('filterActionStatus').value;
    const ownerFilter = document.getElementById('filterActionOwner').value;
    const priorityFilter = document.getElementById('filterActionPriority').value;
    const teamFilter = document.getElementById('filterActionTeam')?.value || '';
    const sortBy = document.getElementById('sortActions').value;
    
    let filtered = [...appData.actions];
    
    if (statusFilter) {
        filtered = filtered.filter(a => a.status === statusFilter);
    }
    if (ownerFilter) {
        filtered = filtered.filter(a => a.owner === ownerFilter);
    }
    if (priorityFilter) {
        filtered = filtered.filter(a => a.priority === priorityFilter);
    }
    if (teamFilter) {
        filtered = filtered.filter(a => a.teamId === teamFilter);
    }
    
    // Sort
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    switch (sortBy) {
        case 'priority':
            filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
            break;
        case 'due-date':
            filtered.sort((a, b) => {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate) - new Date(b.dueDate);
            });
            break;
        case 'owner':
            filtered.sort((a, b) => a.owner.localeCompare(b.owner));
            break;
        case 'created':
            filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            break;
    }
    
    renderActions(filtered);
}

function clearActionFilters() {
    document.getElementById('filterActionStatus').value = '';
    document.getElementById('filterActionOwner').value = '';
    document.getElementById('filterActionPriority').value = '';
    if (document.getElementById('filterActionTeam')) {
        document.getElementById('filterActionTeam').value = '';
    }
    document.getElementById('sortActions').value = 'priority';
    renderActions();
}

// ==================== TEAMS ====================

function openAddTeamModal() {
    document.getElementById('addTeamForm').reset();
    openModal('addTeamModal');
}

function saveTeam(event) {
    event.preventDefault();
    
    const team = {
        id: generateId(),
        name: document.getElementById('teamName').value,
        description: document.getElementById('teamDescription').value,
        members: document.getElementById('teamMembers').value,
        color: document.getElementById('teamColor').value
    };
    
    appData.teams.push(team);
    saveData();
    renderTeams();
    populateTeamDropdowns();
    updateDashboard();
    closeModal('addTeamModal');
}

function renderTeams() {
    const container = document.getElementById('teamsGrid');
    
    if (appData.teams.length === 0) {
        container.innerHTML = '<p class="empty-state">No teams added yet. Click "Add Team" to get started!</p>';
        return;
    }
    
    container.innerHTML = appData.teams.map(team => {
        const teamUpdates = appData.updates.filter(u => u.teamId === team.id).length;
        const teamActions = appData.actions.filter(a => a.teamId === team.id);
        const pendingActions = teamActions.filter(a => a.status !== 'completed').length;
        
        return `
            <div class="team-card">
                <div class="team-header" style="background: ${team.color}">
                    <h3>${team.name}</h3>
                    <p>${team.description || 'No description'}</p>
                </div>
                <div class="team-body">
                    <div class="team-stats">
                        <div class="team-stat">
                            <div class="value">${teamUpdates}</div>
                            <div class="label">Updates</div>
                        </div>
                        <div class="team-stat">
                            <div class="value">${pendingActions}</div>
                            <div class="label">Pending Actions</div>
                        </div>
                    </div>
                    <div class="team-members">
                        <strong>Members:</strong> <span>${team.members || 'Not specified'}</span>
                    </div>
                    <div class="team-actions">
                        <button class="btn btn-small btn-primary" onclick="openEditTeamModal('${team.id}')">✏️ Edit</button>
                        <button class="btn btn-small btn-secondary" onclick="deleteTeam('${team.id}')">🗑️ Delete</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function deleteTeam(id) {
    if (confirm('Are you sure you want to delete this team? This will not delete updates or actions associated with this team.')) {
        appData.teams = appData.teams.filter(t => t.id !== id);
        saveData();
        renderTeams();
        populateTeamDropdowns();
        updateDashboard();
    }
}

function openEditTeamModal(id) {
    const team = appData.teams.find(t => t.id === id);
    if (!team) return;
    
    document.getElementById('editTeamId').value = team.id;
    document.getElementById('editTeamName').value = team.name;
    document.getElementById('editTeamDescription').value = team.description || '';
    document.getElementById('editTeamMembers').value = team.members || '';
    document.getElementById('editTeamColor').value = team.color || '#4F46E5';
    
    openModal('editTeamModal');
}

function updateTeam(event) {
    event.preventDefault();
    
    const id = document.getElementById('editTeamId').value;
    const team = appData.teams.find(t => t.id === id);
    if (!team) return;
    
    team.name = document.getElementById('editTeamName').value;
    team.description = document.getElementById('editTeamDescription').value;
    team.members = document.getElementById('editTeamMembers').value;
    team.color = document.getElementById('editTeamColor').value;
    
    saveData();
    renderTeams();
    populateTeamDropdowns();
    updateDashboard();
    closeModal('editTeamModal');
}

function deleteTeamFromModal() {
    const id = document.getElementById('editTeamId').value;
    if (confirm('Are you sure you want to delete this team? This will not delete updates or actions associated with this team.')) {
        appData.teams = appData.teams.filter(t => t.id !== id);
        saveData();
        renderTeams();
        populateTeamDropdowns();
        updateDashboard();
        closeModal('editTeamModal');
    }
}

// ==================== DASHBOARD ====================

function updateDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const weekStart = getWeekStart(new Date());
    
    // Today's updates
    const todayUpdates = appData.updates.filter(u => u.date === today).length;
    document.getElementById('todayUpdates').textContent = todayUpdates;
    
    // Pending actions
    const pendingActions = appData.actions.filter(a => a.status === 'pending' || a.status === 'in-progress').length;
    document.getElementById('pendingActions').textContent = pendingActions;
    
    // Completed this week
    const completedThisWeek = appData.actions.filter(a => {
        if (!a.completedAt) return false;
        return new Date(a.completedAt) >= weekStart;
    }).length;
    document.getElementById('completedActions').textContent = completedThisWeek;
    
    // Active teams
    document.getElementById('activeTeams').textContent = appData.teams.length;
    
    // Recent updates
    renderRecentUpdates();
    
    // Pending actions list
    renderPendingActionsList();
    
    // Team summary
    renderTeamSummary();
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function renderRecentUpdates() {
    const container = document.getElementById('recentUpdatesList');
    const recent = appData.updates.slice(0, 5);
    
    if (recent.length === 0) {
        container.innerHTML = '<p class="empty-state">No updates yet. Add your first daily update!</p>';
        return;
    }
    
    container.innerHTML = recent.map(update => `
        <div class="recent-update-item" style="cursor: pointer" onclick="showView('daily'); setTimeout(() => openEditUpdateModal('${update.id}'), 100)">
            <div class="recent-update-date">${formatDate(update.date, 'short')}</div>
            <div class="recent-update-content">
                <div class="recent-update-title">${update.description.substring(0, 60)}${update.description.length > 60 ? '...' : ''}</div>
                <div class="recent-update-category">${update.category}</div>
            </div>
        </div>
    `).join('');
}

function renderPendingActionsList() {
    const container = document.getElementById('pendingActionsList');
    const pending = appData.actions
        .filter(a => a.status === 'pending' || a.status === 'in-progress')
        .sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        })
        .slice(0, 5);
    
    if (pending.length === 0) {
        container.innerHTML = '<p class="empty-state">No pending actions. Great job!</p>';
        return;
    }
    
    container.innerHTML = pending.map(action => `
        <div class="recent-update-item" style="cursor: pointer" onclick="showView('actions'); openEditActionModal('${action.id}')">
            <div class="recent-update-date" style="color: ${action.priority === 'high' ? 'var(--danger)' : 'var(--text-muted)'}">${action.priority.toUpperCase()}</div>
            <div class="recent-update-content">
                <div class="recent-update-title">${action.title}</div>
                <div class="recent-update-category">👤 ${action.owner}</div>
            </div>
        </div>
    `).join('');
}

function renderTeamSummary() {
    const container = document.getElementById('teamSummary');
    
    if (appData.teams.length === 0) {
        container.innerHTML = '<p class="empty-state">No team activity recorded yet.</p>';
        return;
    }
    
    container.innerHTML = appData.teams.map(team => {
        const updates = appData.updates.filter(u => u.teamId === team.id).length;
        const actions = appData.actions.filter(a => a.teamId === team.id && a.status !== 'completed').length;
        
        return `
            <div class="team-summary-item" style="cursor: pointer" onclick="showView('teams'); setTimeout(() => openEditTeamModal('${team.id}'), 100)">
                <div class="team-summary-name">
                    <span class="team-color-dot" style="background: ${team.color}"></span>
                    <strong>${team.name}</strong>
                </div>
                <div class="team-summary-stats">
                    <span><strong>${updates}</strong> update${updates !== 1 ? 's' : ''}</span>
                    <span><strong>${actions}</strong> pending</span>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== WEEKLY REPORT ====================

function generateWeeklyReport() {
    const weekInput = document.getElementById('weekSelector').value;
    if (!weekInput) return;
    
    const [year, week] = weekInput.split('-W');
    const weekStart = getDateOfWeek(parseInt(week), parseInt(year));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    // Filter data for the week
    const weekUpdates = appData.updates.filter(u => {
        const d = new Date(u.date);
        return d >= weekStart && d <= weekEnd;
    });
    
    const weekActionsCompleted = appData.actions.filter(a => {
        if (!a.completedAt) return false;
        const d = new Date(a.completedAt);
        return d >= weekStart && d <= weekEnd;
    });
    
    const meetings = weekUpdates.filter(u => u.category === 'meeting').length;
    const reviews = weekUpdates.filter(u => u.category === 'review').length;
    
    // Update stats
    document.getElementById('weeklyUpdatesCount').textContent = weekUpdates.length;
    document.getElementById('weeklyActionsCompleted').textContent = weekActionsCompleted.length;
    document.getElementById('weeklyMeetings').textContent = meetings;
    document.getElementById('weeklyReviews').textContent = reviews;
    
    // What was done
    const doneList = document.getElementById('weeklyDoneList');
    const doneItems = [...weekUpdates, ...weekActionsCompleted.map(a => ({
        description: a.title,
        category: 'completed',
        date: a.completedAt
    }))];
    
    if (doneItems.length === 0) {
        doneList.innerHTML = '<p class="empty-state">No completed items this week</p>';
    } else {
        doneList.innerHTML = doneItems.map(item => `
            <div class="report-item">
                <div class="report-item-icon" style="background: var(--success); color: white;">✓</div>
                <div class="report-item-content">
                    <div class="report-item-title">${item.description}</div>
                    <div class="report-item-meta">${formatDate(item.date, 'short')} • ${item.category}</div>
                </div>
            </div>
        `).join('');
    }
    
    // Currently working on
    const inProgressList = document.getElementById('weeklyInProgressList');
    const inProgress = appData.actions.filter(a => a.status === 'in-progress');
    
    if (inProgress.length === 0) {
        inProgressList.innerHTML = '<p class="empty-state">No items currently in progress</p>';
    } else {
        inProgressList.innerHTML = inProgress.map(item => `
            <div class="report-item">
                <div class="report-item-icon" style="background: var(--info); color: white;">⟳</div>
                <div class="report-item-content">
                    <div class="report-item-title">${item.title}</div>
                    <div class="report-item-meta">Owner: ${item.owner}${item.dueDate ? ` • Due: ${formatDate(item.dueDate, 'short')}` : ''}</div>
                </div>
            </div>
        `).join('');
    }
    
    // Blockers
    const blockersList = document.getElementById('weeklyBlockersList');
    const blockers = appData.actions.filter(a => a.status === 'blocked');
    
    if (blockers.length === 0) {
        blockersList.innerHTML = '<p class="empty-state">No blockers reported</p>';
    } else {
        blockersList.innerHTML = blockers.map(item => `
            <div class="report-item">
                <div class="report-item-icon" style="background: var(--danger); color: white;">!</div>
                <div class="report-item-content">
                    <div class="report-item-title">${item.title}</div>
                    <div class="report-item-meta">Owner: ${item.owner}</div>
                </div>
            </div>
        `).join('');
    }
    
    // Next week's focus (pending high priority items)
    const nextList = document.getElementById('weeklyNextList');
    const nextFocus = appData.actions
        .filter(a => a.status === 'pending' && a.priority === 'high')
        .slice(0, 5);
    
    if (nextFocus.length === 0) {
        nextList.innerHTML = '<p class="empty-state">No high priority items pending</p>';
    } else {
        nextList.innerHTML = nextFocus.map(item => `
            <div class="report-item">
                <div class="report-item-icon" style="background: var(--warning); color: white;">→</div>
                <div class="report-item-content">
                    <div class="report-item-title">${item.title}</div>
                    <div class="report-item-meta">Owner: ${item.owner}</div>
                </div>
            </div>
        `).join('');
    }
}

function getDateOfWeek(week, year) {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const weekStart = simple;
    if (dow <= 4)
        weekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        weekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return weekStart;
}

function exportWeeklyReport() {
    const weekInput = document.getElementById('weekSelector').value;
    const reportContent = document.getElementById('weeklyReport');
    
    // Create a printable version
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Weekly Report - ${weekInput}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                h1 { color: #4F46E5; border-bottom: 2px solid #4F46E5; padding-bottom: 10px; }
                h2 { color: #374151; margin-top: 30px; }
                .stat-row { display: flex; gap: 20px; margin: 20px 0; }
                .stat { text-align: center; padding: 20px; background: #F3F4F6; border-radius: 8px; flex: 1; }
                .stat-value { font-size: 2em; font-weight: bold; color: #4F46E5; }
                .stat-label { color: #6B7280; }
                .item { padding: 10px; background: #F9FAFB; margin: 8px 0; border-radius: 4px; border-left: 4px solid #4F46E5; }
                .item-title { font-weight: 500; }
                .item-meta { font-size: 0.85em; color: #6B7280; }
                @media print { body { padding: 20px; } }
            </style>
        </head>
        <body>
            <h1>Weekly Report - Week ${weekInput}</h1>
            <div class="stat-row">
                <div class="stat">
                    <div class="stat-value">${document.getElementById('weeklyUpdatesCount').textContent}</div>
                    <div class="stat-label">Updates Logged</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${document.getElementById('weeklyActionsCompleted').textContent}</div>
                    <div class="stat-label">Actions Completed</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${document.getElementById('weeklyMeetings').textContent}</div>
                    <div class="stat-label">Meetings</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${document.getElementById('weeklyReviews').textContent}</div>
                    <div class="stat-label">PR Reviews</div>
                </div>
            </div>
            
            <h2>What Was Done</h2>
            ${document.getElementById('weeklyDoneList').innerHTML}
            
            <h2>Currently Working On</h2>
            ${document.getElementById('weeklyInProgressList').innerHTML}
            
            <h2>Blockers & Issues</h2>
            ${document.getElementById('weeklyBlockersList').innerHTML}
            
            <h2>Next Week's Focus</h2>
            ${document.getElementById('weeklyNextList').innerHTML}
            
            <p style="margin-top: 40px; color: #9CA3AF; font-size: 0.85em;">Generated on ${new Date().toLocaleString()}</p>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// ==================== MODAL HELPERS ====================

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Close modal on outside click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

// ==================== EXPORT/IMPORT ====================

function exportData() {
    downloadBackup();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            
            // Validate the data structure
            if (!imported.updates && !imported.actions && !imported.teams) {
                throw new Error('Invalid data format');
            }
            
            const updateCount = (imported.updates || []).length;
            const actionCount = (imported.actions || []).length;
            const teamCount = (imported.teams || []).length;
            
            if (confirm(`This will import:\n- ${updateCount} daily updates\n- ${actionCount} action items\n- ${teamCount} teams\n\nThis will replace all existing data. Continue?`)) {
                appData = imported;
                // Ensure all arrays exist
                if (!appData.updates) appData.updates = [];
                if (!appData.actions) appData.actions = [];
                if (!appData.teams) appData.teams = [];
                
                saveData();
                initializeApp();
                updateDashboard();
                populateTeamDropdowns();
                alert('Data imported successfully! Your data is now restored.');
            }
        } catch (error) {
            alert('Error importing data. Please make sure you selected a valid backup file.\n\nError: ' + error.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// Check data integrity on visibility change (tab focus)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Verify localStorage still has our data
        const saved = localStorage.getItem('techLeadTracker');
        if (!saved && appData.updates.length > 0) {
            // Data was lost, restore from memory
            console.warn('localStorage was cleared, restoring from memory');
            saveData();
        }
    }
});

// Save before page unload
window.addEventListener('beforeunload', () => {
    saveData();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Escape to close modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
        closeSearch();
    }
    
    // Ctrl/Cmd + N for new update
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openAddUpdateModal();
    }
    
    // Ctrl/Cmd + K for search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('globalSearch').focus();
    }
});

// ==================== ANALYTICS ====================

function updateAnalytics() {
    const days = parseInt(document.getElementById('analyticsRange').value);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Filter data for the period
    const periodUpdates = appData.updates.filter(u => new Date(u.date) >= startDate);
    const periodActions = appData.actions.filter(a => new Date(a.createdAt) >= startDate);
    
    renderActivityChart(periodUpdates, days);
    renderCategoryChart(periodUpdates);
    renderTeamChart(periodUpdates);
    renderActionStatusChart();
    renderTopPeople(periodUpdates);
    renderProductivityInsights(periodUpdates, periodActions, days);
    renderTagsCloud();
}

function renderActivityChart(updates, days) {
    const container = document.getElementById('activityChart');
    
    // Group by date
    const dateMap = {};
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dateMap[dateStr] = 0;
    }
    
    updates.forEach(u => {
        if (dateMap.hasOwnProperty(u.date)) {
            dateMap[u.date]++;
        }
    });
    
    const maxValue = Math.max(...Object.values(dateMap), 1);
    const dates = Object.keys(dateMap);
    
    // Show fewer bars for longer periods
    const step = days > 30 ? Math.ceil(days / 15) : 1;
    const displayDates = dates.filter((_, i) => i % step === 0);
    
    container.innerHTML = displayDates.map(date => {
        const value = dateMap[date];
        const height = (value / maxValue) * 180;
        const d = new Date(date);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        return `
            <div class="chart-bar">
                <div class="chart-bar-fill" style="height: ${height}px;" data-value="${value}"></div>
                <div class="chart-bar-label">${label}</div>
            </div>
        `;
    }).join('');
}

function renderCategoryChart(updates) {
    const container = document.getElementById('categoryChart');
    
    const categoryCount = {};
    updates.forEach(u => {
        categoryCount[u.category] = (categoryCount[u.category] || 0) + 1;
    });
    
    const total = Object.values(categoryCount).reduce((a, b) => a + b, 0) || 1;
    const colors = {
        meeting: '#3B82F6',
        discussion: '#6366F1',
        review: '#10B981',
        approval: '#F59E0B',
        audit: '#EF4444',
        planning: '#8B5CF6',
        issue: '#EC4899',
        other: '#6B7280'
    };
    
    const maxValue = Math.max(...Object.values(categoryCount), 1);
    
    container.innerHTML = `
        <div class="horizontal-chart">
            ${Object.entries(categoryCount).sort((a, b) => b[1] - a[1]).map(([cat, count]) => `
                <div class="horizontal-bar-row">
                    <div class="horizontal-bar-label">${cat}</div>
                    <div class="horizontal-bar-track">
                        <div class="horizontal-bar-fill" style="width: ${(count / maxValue) * 100}%; background: ${colors[cat] || '#6B7280'}">
                            ${count}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderTeamChart(updates) {
    const container = document.getElementById('teamChart');
    
    const teamCount = {};
    updates.forEach(u => {
        if (u.teamId) {
            const team = appData.teams.find(t => t.id === u.teamId);
            if (team) {
                teamCount[team.name] = {
                    count: (teamCount[team.name]?.count || 0) + 1,
                    color: team.color
                };
            }
        }
    });
    
    const maxValue = Math.max(...Object.values(teamCount).map(t => t.count), 1);
    
    if (Object.keys(teamCount).length === 0) {
        container.innerHTML = '<p class="empty-state" style="padding: 40px;">No team data for this period</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="horizontal-chart">
            ${Object.entries(teamCount).sort((a, b) => b[1].count - a[1].count).map(([name, data]) => `
                <div class="horizontal-bar-row">
                    <div class="horizontal-bar-label">${name}</div>
                    <div class="horizontal-bar-track">
                        <div class="horizontal-bar-fill" style="width: ${(data.count / maxValue) * 100}%; background: ${data.color}">
                            ${data.count}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderActionStatusChart() {
    const container = document.getElementById('actionStatusChart');
    
    const statusCount = {
        pending: 0,
        'in-progress': 0,
        completed: 0,
        blocked: 0
    };
    
    appData.actions.forEach(a => {
        statusCount[a.status] = (statusCount[a.status] || 0) + 1;
    });
    
    const colors = {
        pending: '#F59E0B',
        'in-progress': '#3B82F6',
        completed: '#10B981',
        blocked: '#EF4444'
    };
    
    const total = Object.values(statusCount).reduce((a, b) => a + b, 0) || 1;
    
    container.innerHTML = `
        <div class="horizontal-chart">
            ${Object.entries(statusCount).map(([status, count]) => `
                <div class="horizontal-bar-row">
                    <div class="horizontal-bar-label">${status.replace('-', ' ')}</div>
                    <div class="horizontal-bar-track">
                        <div class="horizontal-bar-fill" style="width: ${(count / total) * 100}%; background: ${colors[status]}">
                            ${count}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="chart-legend">
            ${Object.entries(statusCount).map(([status, count]) => `
                <div class="legend-item">
                    <div class="legend-color" style="background: ${colors[status]}"></div>
                    <span>${status}: ${count}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function renderTopPeople(updates) {
    const container = document.getElementById('topPeopleList');
    
    const peopleCount = {};
    updates.forEach(u => {
        if (u.people) {
            u.people.split(',').forEach(person => {
                const name = person.trim();
                if (name) {
                    peopleCount[name] = (peopleCount[name] || 0) + 1;
                }
            });
        }
    });
    
    const sorted = Object.entries(peopleCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    if (sorted.length === 0) {
        container.innerHTML = '<p class="empty-state" style="padding: 20px;">No people data for this period</p>';
        return;
    }
    
    container.innerHTML = sorted.map(([name, count], index) => `
        <div class="top-list-item">
            <div class="top-list-rank">${index + 1}</div>
            <div class="top-list-name">${name}</div>
            <div class="top-list-count">${count} interaction${count !== 1 ? 's' : ''}</div>
        </div>
    `).join('');
}

function renderProductivityInsights(updates, actions, days) {
    const container = document.getElementById('productivityInsights');
    
    const avgUpdatesPerDay = (updates.length / days).toFixed(1);
    const completedActions = actions.filter(a => a.status === 'completed').length;
    const completionRate = actions.length > 0 ? Math.round((completedActions / actions.length) * 100) : 0;
    const meetingCount = updates.filter(u => u.category === 'meeting').length;
    const reviewCount = updates.filter(u => u.category === 'review').length;
    
    // Calculate busiest day
    const dayCount = {};
    updates.forEach(u => {
        const day = new Date(u.date).toLocaleDateString('en-US', { weekday: 'long' });
        dayCount[day] = (dayCount[day] || 0) + 1;
    });
    const busiestDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    
    container.innerHTML = `
        <div class="insight-card">
            <div class="insight-icon">📊</div>
            <div class="insight-value">${avgUpdatesPerDay}</div>
            <div class="insight-label">Avg Updates/Day</div>
        </div>
        <div class="insight-card">
            <div class="insight-icon">✅</div>
            <div class="insight-value">${completionRate}%</div>
            <div class="insight-label">Task Completion Rate</div>
        </div>
        <div class="insight-card">
            <div class="insight-icon">🤝</div>
            <div class="insight-value">${meetingCount}</div>
            <div class="insight-label">Meetings</div>
        </div>
        <div class="insight-card">
            <div class="insight-icon">👀</div>
            <div class="insight-value">${reviewCount}</div>
            <div class="insight-label">PR Reviews</div>
        </div>
        <div class="insight-card">
            <div class="insight-icon">📅</div>
            <div class="insight-value">${busiestDay.slice(0, 3)}</div>
            <div class="insight-label">Busiest Day</div>
        </div>
        <div class="insight-card">
            <div class="insight-icon">📝</div>
            <div class="insight-value">${updates.length}</div>
            <div class="insight-label">Total Updates</div>
        </div>
        <div class="insight-card">
            <div class="insight-icon">🎯</div>
            <div class="insight-value">${actions.filter(a => a.priority === 'high').length}</div>
            <div class="insight-label">High Priority Items</div>
        </div>
        <div class="insight-card">
            <div class="insight-icon">👥</div>
            <div class="insight-value">${appData.teams.length}</div>
            <div class="insight-label">Teams Managed</div>
        </div>
    `;
}

function renderTagsCloud() {
    const container = document.getElementById('tagsCloud');
    
    const tagCount = {};
    appData.updates.forEach(u => {
        if (u.tags) {
            u.tags.forEach(tag => {
                tagCount[tag] = (tagCount[tag] || 0) + 1;
            });
        }
    });
    
    if (Object.keys(tagCount).length === 0) {
        container.innerHTML = '<p class="empty-state" style="padding: 20px;">No tags yet. Add tags to your updates to see them here!</p>';
        return;
    }
    
    const maxCount = Math.max(...Object.values(tagCount));
    const sorted = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
    
    container.innerHTML = sorted.map(([tag, count]) => {
        const size = Math.ceil((count / maxCount) * 5);
        return `<span class="cloud-tag size-${size}" onclick="searchByTag('${tag}')">#${tag} (${count})</span>`;
    }).join('');
}

// ==================== EMAIL REPORT ====================

function copyReportToClipboard() {
    const weekInput = document.getElementById('weekSelector').value;
    const [year, week] = weekInput.split('-W');
    
    // Build plain text report
    let report = `WEEKLY STATUS REPORT - Week ${week}, ${year}\n`;
    report += `${'='.repeat(50)}\n\n`;
    
    // Stats
    report += `SUMMARY\n`;
    report += `-`.repeat(30) + '\n';
    report += `• Updates Logged: ${document.getElementById('weeklyUpdatesCount').textContent}\n`;
    report += `• Actions Completed: ${document.getElementById('weeklyActionsCompleted').textContent}\n`;
    report += `• Meetings: ${document.getElementById('weeklyMeetings').textContent}\n`;
    report += `• PR Reviews: ${document.getElementById('weeklyReviews').textContent}\n\n`;
    
    // What was done
    report += `WHAT WAS DONE\n`;
    report += `-`.repeat(30) + '\n';
    const doneItems = document.querySelectorAll('#weeklyDoneList .report-item-title');
    if (doneItems.length === 0) {
        report += `• No items completed this week\n`;
    } else {
        doneItems.forEach(item => {
            report += `• ${item.textContent}\n`;
        });
    }
    report += '\n';
    
    // In Progress
    report += `CURRENTLY WORKING ON\n`;
    report += `-`.repeat(30) + '\n';
    const inProgressItems = document.querySelectorAll('#weeklyInProgressList .report-item-title');
    if (inProgressItems.length === 0) {
        report += `• No items in progress\n`;
    } else {
        inProgressItems.forEach(item => {
            report += `• ${item.textContent}\n`;
        });
    }
    report += '\n';
    
    // Blockers
    report += `BLOCKERS & ISSUES\n`;
    report += `-`.repeat(30) + '\n';
    const blockers = document.querySelectorAll('#weeklyBlockersList .report-item-title');
    if (blockers.length === 0) {
        report += `• No blockers reported\n`;
    } else {
        blockers.forEach(item => {
            report += `• ${item.textContent}\n`;
        });
    }
    report += '\n';
    
    // Next week
    report += `NEXT WEEK'S FOCUS\n`;
    report += `-`.repeat(30) + '\n';
    const nextItems = document.querySelectorAll('#weeklyNextList .report-item-title');
    if (nextItems.length === 0) {
        report += `• No high priority items pending\n`;
    } else {
        nextItems.forEach(item => {
            report += `• ${item.textContent}\n`;
        });
    }
    
    report += `\n${'='.repeat(50)}\n`;
    report += `Generated: ${new Date().toLocaleString()}\n`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(report).then(() => {
        alert('Report copied to clipboard! You can now paste it into your email.');
    }).catch(err => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = report;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Report copied to clipboard! You can now paste it into your email.');
    });
}
