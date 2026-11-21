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

let searchIndex = null;
let searchTimer = null;
let searchReturnView = 'dashboard';
let lastSearchQuery = '';
const searchLimits = { update: 40, action: 40, team: 20 };

function scheduleSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 120);
}

function searchText(parts) {
    return parts.filter(part => part !== undefined && part !== null && String(part).trim() !== '')
        .join(' ')
        .toLowerCase();
}

function buildSearchIndex() {
    const teams = new Map(appData.teams.map(team => [team.id, team]));
    const rows = [];

    appData.updates.forEach(update => {
        const team = teams.get(update.teamId);
        const dateText = update.date ? `${formatDate(update.date)} ${formatDate(update.date, 'short')}` : '';
        rows.push({
            type: 'update',
            id: update.id,
            haystack: searchText([
                update.description, update.people, update.category,
                ...(update.tags || []), update.date, dateText, team?.name
            ]),
            update,
            teamName: team?.name || ''
        });
    });

    appData.actions.forEach(action => {
        const team = teams.get(action.teamId);
        const dueText = action.dueDate ? `${formatDate(action.dueDate)} ${formatDate(action.dueDate, 'short')}` : '';
        rows.push({
            type: 'action',
            id: action.id,
            haystack: searchText([
                action.title, action.description, action.notes, action.owner,
                action.jira, action.status, action.priority, action.recurring,
                action.dueDate, dueText, team?.name
            ]),
            action,
            teamName: team?.name || ''
        });
    });

    appData.teams.forEach(team => {
        rows.push({
            type: 'team',
            id: team.id,
            haystack: searchText([team.name, team.description, team.members]),
            team
        });
    });

    searchIndex = rows;
    return rows;
}

function runSearch() {
    const input = document.getElementById('globalSearch');
    const query = input ? input.value.trim().toLowerCase() : '';
    const searchView = document.getElementById('search-view');

    if (query.length < 2) {
        if (searchView && searchView.classList.contains('active')) {
            showView(searchReturnView || 'dashboard');
        }
        return;
    }

    if (query !== lastSearchQuery) {
        searchLimits.update = 40;
        searchLimits.action = 40;
        searchLimits.team = 20;
        lastSearchQuery = query;
    }

    if (searchView && !searchView.classList.contains('active')) {
        const active = document.querySelector('.nav-item.active');
        if (active) searchReturnView = active.dataset.view;
    }

    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    searchView.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    const terms = query.split(/\s+/).filter(Boolean);
    const matches = (searchIndex || buildSearchIndex()).filter(row => terms.every(term => row.haystack.includes(term)));
    renderSearchResults({
        updates: matches.filter(row => row.type === 'update'),
        actions: matches.filter(row => row.type === 'action'),
        teams: matches.filter(row => row.type === 'team')
    }, query);
}

function renderSearchSection(title, rows, type, query, renderItem) {
    if (!rows.length) return '';
    const visible = rows.slice(0, searchLimits[type]);
    const remaining = rows.length - visible.length;
    return `
        <div class="search-section">
            <h4>${title} (${rows.length})</h4>
            ${visible.map(row => renderItem(row, query)).join('')}
            ${remaining > 0 ? `<button class="btn btn-secondary" onclick="showMoreSearch('${type}')">Show ${Math.min(40, remaining)} more</button>` : ''}
        </div>
    `;
}

function renderSearchResults(results, query) {
    const container = document.getElementById('searchResults');
    const totalResults = results.updates.length + results.actions.length + results.teams.length;

    if (totalResults === 0) {
        container.innerHTML = `<p class="empty-state">No results found for "${escapeHtml(query)}"</p>`;
        return;
    }

    container.innerHTML = `
        <p style="margin-bottom: 20px; color: var(--text-secondary);">Found ${totalResults} result${totalResults === 1 ? '' : 's'} for "<strong>${escapeHtml(query)}</strong>". Every update, action, person, team, tag, and ticket is included.</p>
        ${renderSearchSection('📝 Updates', results.updates, 'update', query, (row) => `
            <div class="search-item" onclick="openUpdateFromSearch('${row.id}')">
                <strong>${highlightText(row.update.description, query)}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                    ${formatDate(row.update.date, 'short')} • ${escapeHtml(row.update.category)}
                    ${row.teamName ? ` • ${escapeHtml(row.teamName)}` : ''}
                    ${row.update.people ? ` • ${escapeHtml(row.update.people)}` : ''}
                </div>
            </div>
        `)}
        ${renderSearchSection('✅ Action Items', results.actions, 'action', query, (row) => `
            <div class="search-item" onclick="showView('actions'); openEditActionModal('${row.id}')">
                <strong>${highlightText(row.action.title, query)}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                    Owner: ${escapeHtml(row.action.owner)} • ${escapeHtml(row.action.status)} • ${escapeHtml(row.action.priority)}
                    ${row.action.jira ? ` • ${escapeHtml(row.action.jira)}` : ''}
                    ${row.teamName ? ` • ${escapeHtml(row.teamName)}` : ''}
                </div>
            </div>
        `)}
        ${renderSearchSection('👥 Teams', results.teams, 'team', query, (row) => `
            <div class="search-item" onclick="showView('teams'); setTimeout(() => openEditTeamModal('${row.id}'), 50)">
                <strong>${highlightText(row.team.name, query)}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                    ${escapeHtml(row.team.members || row.team.description || 'No members listed')}
                </div>
            </div>
        `)}
    `;
}

function showMoreSearch(type) {
    searchLimits[type] += 40;
    runSearch();
}

function openUpdateFromSearch(id) {
    showView('daily');
    setTimeout(() => openEditUpdateModal(id), 50);
}

function highlightText(text, query) {
    const safe = escapeHtml(text || '');
    const terms = String(query || '').split(/\s+/).filter(Boolean).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!terms.length) return safe;
    return safe.replace(new RegExp(`(${terms.join('|')})`, 'gi'), '<span class="search-highlight">$1</span>');
}

function closeSearch() {
    const input = document.getElementById('globalSearch');
    if (input) input.value = '';
    lastSearchQuery = '';
    showView(searchReturnView || 'dashboard');
}

function searchByTag(tag) {
    const input = document.getElementById('globalSearch');
    input.value = tag;
    lastSearchQuery = '';
    runSearch();
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
    searchIndex = null;
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
        filterUpdates();
    }
    
    if (viewName === 'actions') {
        filterActions();
    }
}

// Set default dates
function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function setDefaultDates() {
    document.getElementById('updateDate').value = localDateString();
    document.getElementById('filterDate').value = '';
}

// Set current week in week selector
function setCurrentWeek() {
    const iso = getISOWeek(new Date());
    document.getElementById('weekSelector').value = `${iso.year}-W${String(iso.week).padStart(2, '0')}`;
}

function getISOWeek(date) {
    const thursday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = thursday.getDay() || 7;
    thursday.setDate(thursday.getDate() + 4 - day);
    const weekYear = thursday.getFullYear();
    const yearStart = new Date(weekYear, 0, 4);
    const yearStartDay = yearStart.getDay() || 7;
    const week1Monday = new Date(weekYear, 0, 4 - yearStartDay + 1);
    const week = 1 + Math.round((thursday - week1Monday) / 604800000);
    return { year: weekYear, week };
}

// Format date
function formatDate(date, format = 'long') {
    if (!date) return '';
    const text = String(date);
    const d = /^\d{4}-\d{2}-\d{2}$/.test(text)
        ? new Date(Number(text.slice(0, 4)), Number(text.slice(5, 7)) - 1, Number(text.slice(8, 10)))
        : new Date(date);
    if (Number.isNaN(d.getTime())) return text;
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
    document.getElementById('updateDate').value = localDateString();
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
    filterUpdates();
    updateDashboard();
    populateTagSuggestions();
    closeModal('addUpdateModal');
}

let updateRenderLimit = 60;
let updateRenderSource = null;
let actionRenderLimit = 40;
let actionRenderSource = null;

function renderUpdates(filteredUpdates = null) {
    const source = filteredUpdates === null ? appData.updates : filteredUpdates;
    if (source !== updateRenderSource) {
        updateRenderSource = source;
        updateRenderLimit = 60;
    }
    const updates = source.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, updateRenderLimit);
    const remaining = source.length - updates.length;
    const container = document.getElementById('dailyUpdatesList');
    const teamMap = new Map(appData.teams.map(team => [team.id, team]));
    
    if (source.length === 0) {
        container.innerHTML = '<p class="empty-state">No daily updates yet. Click "Add Update" to get started!</p>';
        return;
    }
    
    // Group by date
    const grouped = {};
    const dateTotals = {};
    source.forEach(update => {
        dateTotals[update.date] = (dateTotals[update.date] || 0) + 1;
    });
    updates.forEach(update => {
        if (!grouped[update.date]) grouped[update.date] = [];
        grouped[update.date].push(update);
    });
    
    let html = '';
    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
    
    sortedDates.forEach((date, dateIndex) => {
        const today = localDateString();
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const isToday = date === today;
        const isYesterday = date === localDateString(yesterdayDate);
        
        let dateLabel = formatDate(date);
        if (isToday) dateLabel = '📍 Today - ' + dateLabel;
        else if (isYesterday) dateLabel = '📅 Yesterday - ' + dateLabel;
        else dateLabel = '📅 ' + dateLabel;
        
        html += `<div class="date-group" style="margin-bottom: 28px;">
            <h3 style="margin-bottom: 16px; ${isToday ? 'color: var(--primary); font-weight: 700;' : ''}">
                ${dateLabel}
                <span style="font-weight: 400; opacity: 0.6; margin-left: 8px; font-size: 0.8rem;">(${dateTotals[date]} update${dateTotals[date] !== 1 ? 's' : ''})</span>
            </h3>`;
        
        grouped[date].forEach((update, index) => {
            const team = teamMap.get(update.teamId);
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
                ? `<div class="tags-container">${update.tags.map(tag => `<span class="tag" onclick="event.stopPropagation(); searchByTag(decodeURIComponent('${encodeURIComponent(tag)}'))">#${escapeHtml(tag)}</span>`).join('')}</div>` 
                : '';
            
            html += `
                <div class="update-item${index > 8 ? ' no-animate' : ''}" style="border-left-color: ${team ? team.color : 'var(--primary)'}; cursor: pointer;" onclick="openEditUpdateModal('${update.id}')">
                    <div class="update-header">
                        <div class="update-meta">
                            <span class="update-category category-${update.category}">
                                ${categoryIcons[update.category] || '📌'} ${update.category}
                            </span>
                            ${team ? `<span class="update-team" style="background: ${team.color}15; color: ${team.color}; border: 1px solid ${team.color}30;">${escapeHtml(team.name)}</span>` : ''}
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
                    <p class="update-description">${escapeHtml(update.description)}</p>
                    ${update.people ? `<p class="update-people"><strong>With:</strong> ${escapeHtml(update.people)}</p>` : ''}
                    ${tagsHtml}
                </div>
            `;
        });
        
        html += '</div>';
    });

    if (remaining > 0) {
        html += `<button class="btn btn-secondary" onclick="updateRenderLimit += 60; renderUpdates(updateRenderSource)">Show ${Math.min(60, remaining)} more updates (${remaining} remaining)</button>`;
    }
    
    container.innerHTML = html;
}

function deleteUpdate(id) {
    if (confirm('Are you sure you want to delete this update?')) {
        appData.updates = appData.updates.filter(u => u.id !== id);
        saveData();
        filterUpdates();
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
    filterUpdates();
    updateDashboard();
    populateTagSuggestions();
    closeModal('editUpdateModal');
}

function deleteUpdateFromModal() {
    const id = document.getElementById('editUpdateId').value;
    if (confirm('Are you sure you want to delete this update?')) {
        appData.updates = appData.updates.filter(u => u.id !== id);
        saveData();
        filterUpdates();
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
    filterActions();
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
    filterActions();
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
    return localDateString(date);
}

function renderActions(filteredActions = null) {
    const actions = filteredActions === null ? appData.actions : filteredActions;
    actionRenderSource = actions;
    
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
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        statusActions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        const visibleActions = statusActions.slice(0, actionRenderLimit);
        const hiddenActions = statusActions.length - visibleActions.length;
        
        if (statusActions.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 30px 20px; opacity: 0.7;">
                ${status === 'completed' ? '✨ Complete some tasks!' : status === 'blocked' ? '🎉 No blockers!' : 'No items'}
            </p>`;
            return;
        }
        
        const teamMap = new Map(appData.teams.map(team => [team.id, team]));
        const todayStart = startOfDay(new Date());
        container.innerHTML = visibleActions.map(action => {
            const team = teamMap.get(action.teamId);
            const due = action.dueDate ? parseLocalDate(action.dueDate) : null;
            const dueStart = due ? startOfDay(due) : null;
            const isOverdue = dueStart && dueStart < todayStart && action.status !== 'completed';
            const daysUntilDue = dueStart ? Math.round((dueStart - todayStart) / 86400000) : null;
            
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
                    <div class="action-title">${escapeHtml(action.title)}</div>
                    <div class="action-owner">👤 ${escapeHtml(action.owner)}</div>
                    ${team ? `<div style="font-size: 0.7rem; color: ${team.color}; margin-top: 6px; font-weight: 600;">● ${team.name}</div>` : ''}
                    ${action.dueDate ? `<div class="action-due ${isOverdue ? 'overdue' : ''}">${dueText}</div>` : ''}
                    ${action.jira ? `<span class="action-jira">${action.jira}</span>` : ''}
                    ${action.recurring ? `<span class="recurring-badge">${action.recurring}</span>` : ''}
                </div>
            `;
        }).join('') + (hiddenActions > 0
            ? `<button class="btn btn-small btn-secondary" onclick="actionRenderLimit += 40; renderActions(actionRenderSource)">Show ${hiddenActions} more</button>`
            : '');
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
    filterActions();
    updateDashboard();
    populateTeamDropdowns();
    closeModal('editActionModal');
}

function deleteAction() {
    const id = document.getElementById('editActionId').value;
    if (confirm('Are you sure you want to delete this action item?')) {
        appData.actions = appData.actions.filter(a => a.id !== id);
        saveData();
        filterActions();
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
                return parseLocalDate(a.dueDate) - parseLocalDate(b.dueDate);
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
                    <h3>${escapeHtml(team.name)}</h3>
                    <p>${escapeHtml(team.description || 'No description')}</p>
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
                        <strong>Members:</strong> <span>${escapeHtml(team.members || 'Not specified')}</span>
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
    const today = localDateString();
    const weekStart = getWeekStart(new Date());
    const weekEnd = endOfDay(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6));
    
    // Today's updates
    const todayUpdates = appData.updates.filter(u => u.date === today).length;
    document.getElementById('todayUpdates').textContent = todayUpdates;
    
    // Pending actions
    const pendingActions = appData.actions.filter(a => a.status === 'pending' || a.status === 'in-progress').length;
    document.getElementById('pendingActions').textContent = pendingActions;
    
    // Completed this week
    const completedThisWeek = appData.actions.filter(a => {
        if (!a.completedAt) return false;
        const completed = new Date(a.completedAt);
        return completed >= weekStart && completed <= weekEnd;
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
    const d = startOfDay(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d;
}

function renderRecentUpdates() {
    const container = document.getElementById('recentUpdatesList');
    const recent = appData.updates
        .slice()
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .slice(0, 5);
    
    if (recent.length === 0) {
        container.innerHTML = '<p class="empty-state">No updates yet. Add your first daily update!</p>';
        return;
    }
    
    container.innerHTML = recent.map(update => `
        <div class="recent-update-item" style="cursor: pointer" onclick="showView('daily'); setTimeout(() => openEditUpdateModal('${update.id}'), 100)">
            <div class="recent-update-date">${formatDate(update.date, 'short')}</div>
            <div class="recent-update-content">
                <div class="recent-update-title">${escapeHtml(update.description.substring(0, 60))}${update.description.length > 60 ? '...' : ''}</div>
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
                <div class="recent-update-title">${escapeHtml(action.title)}</div>
                <div class="recent-update-category">👤 ${escapeHtml(action.owner)}</div>
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
                    <strong>${escapeHtml(team.name)}</strong>
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
    const weekStart = getDateOfISOWeek(parseInt(week, 10), parseInt(year, 10));
    const weekEnd = endOfDay(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6));
    
    // Filter data for the week
    const weekUpdates = appData.updates.filter(u => {
        const d = parseLocalDate(u.date);
        return d && d >= weekStart && d <= weekEnd;
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
                    <div class="report-item-title">${escapeHtml(item.description)}</div>
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
                    <div class="report-item-title">${escapeHtml(item.title)}</div>
                    <div class="report-item-meta">Owner: ${escapeHtml(item.owner)}${item.dueDate ? ` • Due: ${formatDate(item.dueDate, 'short')}` : ''}</div>
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
                    <div class="report-item-title">${escapeHtml(item.title)}</div>
                    <div class="report-item-meta">Owner: ${escapeHtml(item.owner)}</div>
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
                    <div class="report-item-title">${escapeHtml(item.title)}</div>
                    <div class="report-item-meta">Owner: ${escapeHtml(item.owner)}</div>
                </div>
            </div>
        `).join('');
    }
}

function getDateOfISOWeek(week, year) {
    const jan4 = new Date(year, 0, 4);
    const day = jan4.getDay() || 7;
    const monday = new Date(year, 0, 4 - day + 1 + (week - 1) * 7);
    monday.setHours(0, 0, 0, 0);
    return monday;
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

const IMPORT_TEAM_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#0EA5E9', '#14B8A6'];

function downloadImportTemplate() {
    const blob = new Blob([IMPORT_TEMPLATE], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'daily-tracker-notes-template.txt';
    link.click();
    URL.revokeObjectURL(url);
}

function importTextFile(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = String(e.target.result || '');
        const trimmed = text.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            alert('This file is a JSON backup. Use Restore Backup for JSON files. Upload Notes reads the text template.');
            return;
        }

        const parsed = parseTextImport(text);
        const plan = planTextImport(appData, parsed);
        const hasAdditions = plan.newTeams.length || plan.memberAdds.length || plan.newUpdates.length || plan.newActions.length;

        if (!hasAdditions) {
            showImportResult(plan, false);
            return;
        }

        const lines = [
            'This adds records only. Nothing already saved is changed or deleted.',
            '',
            `Daily updates to add: ${plan.newUpdates.length} (${plan.skippedUpdates} already saved, skipped)`,
            `Action items to add: ${plan.newActions.length} (${plan.skippedActions} already saved, skipped)`,
            `Teams to add: ${plan.newTeams.length} (${plan.skippedTeams} existing teams left unchanged)`,
            `Existing teams getting new members: ${plan.memberAdds.length}`
        ];
        if (plan.errors.length) {
            lines.push('', 'Blocks that will not be imported:');
            plan.errors.slice(0, 8).forEach(error => lines.push(`- ${error}`));
        }
        lines.push('', 'Add these records?');
        if (!confirm(lines.join('\n'))) return;

        applyTextImportPlan(plan);
        showImportResult(plan, true);
    };
    reader.readAsText(file);
}

function applyTextImportPlan(plan) {
    if (!appData.tags) appData.tags = [];

    plan.newTeams.forEach(team => {
        appData.teams.push({
            id: generateId(),
            name: team.name,
            description: team.description || '',
            members: team.members || '',
            color: team.color && team.color !== '#6366F1'
                ? team.color
                : IMPORT_TEAM_COLORS[appData.teams.length % IMPORT_TEAM_COLORS.length]
        });
    });

    plan.memberAdds.forEach(addition => {
        const team = appData.teams.find(item => item.name.toLowerCase() === addition.teamName.toLowerCase());
        if (!team) return;
        const members = team.members ? team.members.split(',').map(name => name.trim()).filter(Boolean) : [];
        addition.members.forEach(member => {
            if (!members.some(name => name.toLowerCase() === member.toLowerCase())) members.push(member);
        });
        team.members = members.join(', ');
    });

    plan.newUpdates.forEach(update => {
        const team = appData.teams.find(item => item.name.toLowerCase() === (update.teamName || '').toLowerCase());
        appData.updates.push({
            id: generateId(),
            date: update.date,
            category: update.category,
            teamId: team ? team.id : '',
            description: update.description,
            people: update.people,
            tags: update.tags,
            createdAt: new Date().toISOString()
        });
        update.tags.forEach(tag => {
            if (!appData.tags.includes(tag)) appData.tags.push(tag);
        });
    });

    plan.newActions.forEach(action => {
        const team = appData.teams.find(item => item.name.toLowerCase() === (action.teamName || '').toLowerCase());
        appData.actions.push({
            id: generateId(),
            title: action.title,
            description: action.notes || '',
            owner: action.owner,
            priority: action.priority,
            dueDate: action.dueDate,
            teamId: team ? team.id : '',
            jira: action.jira,
            recurring: action.recurring,
            status: action.status,
            notes: action.notes,
            createdAt: new Date().toISOString(),
            completedAt: action.status === 'completed' ? new Date().toISOString() : null,
            lastRecurringCreated: null
        });
    });

    saveData();
    initializeApp();
    updateDashboard();
    populateTeamDropdowns();
    populateTagSuggestions();
}

function showImportResult(plan, applied) {
    const body = document.getElementById('importResultBody');
    const memberLines = plan.memberAdds.map(addition => `${addition.teamName}: ${addition.members.join(', ')}`);
    body.innerHTML = `
        <p>${applied ? 'New records were added. Existing records were left as they are.' : 'Nothing new was added. Matching records are already saved.'}</p>
        <ul>
            <li>${plan.newUpdates.length} daily update${plan.newUpdates.length === 1 ? '' : 's'} added, ${plan.skippedUpdates} skipped</li>
            <li>${plan.newActions.length} action item${plan.newActions.length === 1 ? '' : 's'} added, ${plan.skippedActions} skipped</li>
            <li>${plan.newTeams.length} team${plan.newTeams.length === 1 ? '' : 's'} added, ${plan.skippedTeams} existing team${plan.skippedTeams === 1 ? '' : 's'} unchanged</li>
        </ul>
        ${memberLines.length ? `<h4>Members added</h4><ul>${memberLines.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ul>` : ''}
        ${plan.errors.length ? `<h4>Not imported</h4><ul>${plan.errors.map(error => `<li>${escapeHtml(error)}</li>`).join('')}</ul>` : ''}
        <div class="form-actions"><button type="button" class="btn btn-primary" onclick="closeModal('importResultModal')">Done</button></div>
    `;
    openModal('importResultModal');
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
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

function parseLocalDate(value) {
    if (!value) return null;
    const text = String(value);
    if (text.includes('T')) return new Date(text);
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return new Date(text);
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function startOfDay(date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function endOfDay(date) {
    const copy = new Date(date);
    copy.setHours(23, 59, 59, 999);
    return copy;
}

function getAnalyticsPeriod(key) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const quarter = Math.floor(month / 3);
    const half = month < 6 ? 0 : 1;

    if (['7', '14', '30', '90'].includes(key)) {
        const days = Number(key);
        const start = startOfDay(now);
        start.setDate(start.getDate() - (days - 1));
        return {
            start,
            end: endOfDay(now),
            label: `Last ${days} days`,
            bucket: days <= 31 ? 'day' : 'week'
        };
    }

    if (key === 'thisQuarter' || key === 'lastQuarter') {
        let periodYear = year;
        let periodQuarter = key === 'thisQuarter' ? quarter : quarter - 1;
        if (periodQuarter < 0) {
            periodQuarter = 3;
            periodYear -= 1;
        }
        return {
            start: new Date(periodYear, periodQuarter * 3, 1),
            end: endOfDay(new Date(periodYear, periodQuarter * 3 + 3, 0)),
            label: `Q${periodQuarter + 1} ${periodYear}`,
            bucket: 'week'
        };
    }

    if (key === 'thisHalf' || key === 'lastHalf') {
        let periodYear = year;
        let periodHalf = key === 'thisHalf' ? half : half - 1;
        if (periodHalf < 0) {
            periodHalf = 1;
            periodYear -= 1;
        }
        return {
            start: new Date(periodYear, periodHalf * 6, 1),
            end: endOfDay(new Date(periodYear, periodHalf * 6 + 6, 0)),
            label: `${periodHalf === 0 ? 'H1' : 'H2'} ${periodYear}`,
            bucket: 'month'
        };
    }

    const periodYear = key === 'lastYear' ? year - 1 : year;
    return {
        start: new Date(periodYear, 0, 1),
        end: endOfDay(new Date(periodYear, 11, 31)),
        label: `Year ${periodYear}`,
        bucket: 'month'
    };
}

function dateInPeriod(value, period) {
    if (!value) return false;
    const date = parseLocalDate(value);
    return date && !Number.isNaN(date.getTime()) && date >= period.start && date <= period.end;
}

function bucketKey(date, bucket) {
    if (bucket === 'month') {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    if (bucket === 'week') {
        const weekday = day.getDay() || 7;
        day.setDate(day.getDate() - weekday + 1);
    }
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

function bucketLabel(key, bucket) {
    if (bucket === 'month') {
        const [year, month] = key.split('-').map(Number);
        return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
    return parseLocalDate(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function updateAnalytics() {
    const period = getAnalyticsPeriod(document.getElementById('analyticsRange').value);
    const label = document.getElementById('analyticsPeriodLabel');
    if (label) {
        const start = period.start.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        const end = period.end.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        label.textContent = `${period.label}: ${start} – ${end}`;
    }

    const periodUpdates = appData.updates.filter(update => dateInPeriod(update.date, period));
    const periodActions = appData.actions.filter(action =>
        dateInPeriod(action.createdAt, period) ||
        dateInPeriod(action.completedAt, period) ||
        dateInPeriod(action.dueDate, period)
    );

    renderActivityChart(periodUpdates, period);
    renderCategoryChart(periodUpdates);
    renderTeamChart(periodUpdates);
    renderActionStatusChart(periodActions);
    renderTopPeople(periodUpdates);
    renderProductivityInsights(periodUpdates, periodActions, period);
    renderTagsCloud(periodUpdates);
}

function renderActivityChart(updates, period) {
    const container = document.getElementById('activityChart');
    const counts = {};
    const keys = [];
    const cursor = new Date(period.start);

    while (cursor <= period.end) {
        const key = bucketKey(cursor, period.bucket);
        if (!counts.hasOwnProperty(key)) {
            counts[key] = 0;
            keys.push(key);
        }
        cursor.setDate(cursor.getDate() + 1);
    }

    updates.forEach(update => {
        const key = bucketKey(parseLocalDate(update.date), period.bucket);
        if (counts.hasOwnProperty(key)) counts[key] += 1;
    });

    const groupSize = Math.max(1, Math.ceil(keys.length / 16));
    const groups = [];
    for (let index = 0; index < keys.length; index += groupSize) {
        const slice = keys.slice(index, index + groupSize);
        groups.push({
            label: bucketLabel(slice[0], period.bucket),
            value: slice.reduce((sum, key) => sum + counts[key], 0)
        });
    }

    const maxValue = Math.max(...groups.map(group => group.value), 1);
    container.innerHTML = groups.map(group => `
        <div class="chart-bar">
            <div class="chart-bar-fill" style="height: ${(group.value / maxValue) * 180}px;" data-value="${group.value}"></div>
            <div class="chart-bar-label">${group.label}</div>
        </div>
    `).join('');
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

function renderActionStatusChart(actions = appData.actions) {
    const container = document.getElementById('actionStatusChart');
    
    const statusCount = {
        pending: 0,
        'in-progress': 0,
        completed: 0,
        blocked: 0
    };
    
    actions.forEach(a => {
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

function renderProductivityInsights(updates, actions, period) {
    const container = document.getElementById('productivityInsights');
    const days = Math.max(1, Math.round((period.end - period.start) / 86400000));
    const avgUpdatesPerDay = (updates.length / days).toFixed(1);
    const completedActions = actions.filter(a => a.status === 'completed').length;
    const completionRate = actions.length > 0 ? Math.round((completedActions / actions.length) * 100) : 0;
    const meetingCount = updates.filter(u => u.category === 'meeting').length;
    const reviewCount = updates.filter(u => u.category === 'review').length;
    
    // Calculate busiest day
    const dayCount = {};
    updates.forEach(u => {
        const day = parseLocalDate(u.date).toLocaleDateString('en-US', { weekday: 'long' });
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
            <div class="insight-value">${new Set(updates.map(update => update.teamId).filter(Boolean)).size}</div>
            <div class="insight-label">Teams Active</div>
        </div>
    `;
}

function renderTagsCloud(updates = appData.updates) {
    const container = document.getElementById('tagsCloud');
    
    const tagCount = {};
    updates.forEach(u => {
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
