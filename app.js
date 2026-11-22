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

let dataFileAvailable = false;
let fileSaveOk = false;
let fileSavePending = false;
const DATA_API = '/api/data';

// Initialize App
    document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    await loadAiSupport();
    syncYourNameField();
    initializeApp();
    setupNavigation();
    updateDashboard();
    populateTeamDropdowns();
    setDefaultDates();
    applyTheme();
    checkRecurringActions();
    populateTagSuggestions();
    updateLastSavedIndicator();
});

function readStoredData() {
    const saved = localStorage.getItem('techLeadTracker') || sessionStorage.getItem('techLeadTrackerBackup');
    if (!saved) return null;
    try {
        const parsed = JSON.parse(saved);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
        console.error('Error parsing saved data:', e);
        return null;
    }
}

function savedAt(data) {
    const time = data && data.lastSaved ? Date.parse(data.lastSaved) : 0;
    return Number.isNaN(time) ? 0 : time;
}

function hasTrackerData(data) {
    if (!data || typeof data !== 'object') return false;
    return ['updates', 'actions', 'teams'].some(key => Array.isArray(data[key]) && data[key].length);
}

// Load the newest copy: tracker-data.json when the local server is running, otherwise this browser.
async function loadData() {
    const localData = readStoredData();
    let fileData = null;

    try {
        const response = await fetch(DATA_API, { cache: 'no-store' });
        if (response.ok) {
            dataFileAvailable = true;
            if (response.status !== 204) {
                const parsed = await response.json();
                if (hasTrackerData(parsed)) fileData = parsed;
            }
        }
    } catch (e) {
        dataFileAvailable = false;
    }

    if (fileData && localData && hasTrackerData(localData)) {
        appData = savedAt(fileData) >= savedAt(localData) ? fileData : localData;
    } else if (fileData) {
        appData = fileData;
    } else if (localData && hasTrackerData(localData)) {
        appData = localData;
    } else {
        initializeDefaultData();
    }

    ensureDataShape();
    storeData(false);
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
}

function ensureDataShape() {
    if (!appData || typeof appData !== 'object') appData = {};
    if (!Array.isArray(appData.updates)) appData.updates = [];
    if (!Array.isArray(appData.actions)) appData.actions = [];
    if (!Array.isArray(appData.teams)) appData.teams = [];
    if (!Array.isArray(appData.tags)) appData.tags = [];
    if (!appData.settings || typeof appData.settings !== 'object') appData.settings = { darkMode: false };
    if (!String(appData.settings.yourName || '').trim()) appData.settings.yourName = 'Kalpit';
    appData.updates.forEach(update => {
        if (!Array.isArray(update.tags)) update.tags = [];
        if (!update.description) update.description = '';
        if (!update.people) update.people = '';
        update.people = replaceYourNameToken(update.people, 'Me', yourName());
        if (!update.targetDate) update.targetDate = '';
        if (!update.jira) update.jira = '';
        if (!['pending', 'in-progress', 'completed', 'blocked'].includes(update.status)) update.status = '';
    });
    appData.actions.forEach(action => {
        if (!action.priority) action.priority = 'medium';
        if (!action.status) action.status = 'pending';
        action.owner = ownerWithYourName(action.owner);
        action.owner = replaceYourNameToken(action.owner, 'Me', yourName());
        if (!action.title) action.title = 'Untitled task';
        if (!action.jira) action.jira = '';
    });
    appData.teams.forEach(team => {
        team.color = safeColor(team.color);
        if (!team.targetDate) team.targetDate = '';
        if (!team.jira) team.jira = '';
        if (!['pending', 'in-progress', 'completed', 'blocked'].includes(team.status)) team.status = '';
        team.members = replaceYourNameToken(team.members, 'Me', yourName());
    });
}

function safeColor(value) {
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || '')) ? value : '#6366F1';
}

// ==================== DARK MODE ====================

function toggleDarkMode() {
    ensureDataShape();
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
                ...(update.tags || []), update.date, dateText, update.targetDate,
                update.targetDate ? `${formatDate(update.targetDate)} ${formatDate(update.targetDate, 'short')}` : '',
                update.jira, update.status, update.status ? reportStatusLabel(update.status) : '', team?.name
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
            haystack: searchText([
                team.name, team.description, team.members, team.targetDate, team.jira, team.status,
                team.status ? reportStatusLabel(team.status) : '',
                team.targetDate ? `${formatDate(team.targetDate)} ${formatDate(team.targetDate, 'short')}` : ''
            ]),
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

    const summary = totalResults === 0
        ? `<p class="empty-state">No results found for "${escapeHtml(query)}"</p>`
        : `<p style="margin-bottom: 20px; color: var(--text-secondary);">Found ${totalResults} result${totalResults === 1 ? '' : 's'} for "<strong>${escapeHtml(query)}</strong>". Every update, action, person, team, tag, and ticket is included.</p>`;

    container.innerHTML = `
        ${summary}
        ${renderSearchSection('📝 Updates', results.updates, 'update', query, (row) => `
            <div class="search-item" onclick="openUpdateFromSearch('${row.id}')">
                <strong>${highlightText(row.update.description, query)}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                    ${formatDate(row.update.date, 'short')} • ${escapeHtml(row.update.category)}
                    ${row.teamName ? ` • ${escapeHtml(row.teamName)}` : ''}
                    ${row.update.people ? ` • ${escapeHtml(row.update.people)}` : ''}
                    ${row.update.targetDate ? ` • Target ${formatDate(row.update.targetDate, 'short')}` : ''}
                    ${row.update.jira ? ` • ${escapeHtml(row.update.jira)}` : ''}
                    ${row.update.status ? ` • ${escapeHtml(reportStatusLabel(row.update.status))}` : ''}
                </div>
            </div>
        `)}
        ${renderSearchSection('✅ Action Items', results.actions, 'action', query, (row) => `
            <div class="search-item" onclick="showView('actions'); openEditActionModal('${row.id}')">
                <strong>${highlightText(row.action.title, query)}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                    Owner: ${escapeHtml(row.action.owner)} • ${escapeHtml(row.action.status)} • ${escapeHtml(row.action.priority)}
                    ${row.action.dueDate ? ` • Target ${formatDate(row.action.dueDate, 'short')}` : ''}
                    ${row.action.jira ? ` • ${escapeHtml(row.action.jira)}` : ''}
                    ${row.teamName ? ` • ${escapeHtml(row.teamName)}` : ''}
                </div>
            </div>
        `)}
        ${renderSearchSection('👥 Teams', results.teams, 'team', query, (row) => `
            <div class="search-item" onclick="openTeamUpdates('${row.id}')">
                <strong>${highlightText(row.team.name, query)}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                    ${escapeHtml(row.team.members || row.team.description || 'No members listed')}
                    ${row.team.targetDate ? ` • Target ${formatDate(row.team.targetDate, 'short')}` : ''}
                    ${row.team.jira ? ` • ${escapeHtml(row.team.jira)}` : ''}
                    ${row.team.status ? ` • ${escapeHtml(reportStatusLabel(row.team.status))}` : ''}
                </div>
            </div>
        `)}
        <div id="relatedNotes"></div>
    `;
    scheduleRelatedNotes(query, results.updates.map(row => row.id));
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
        `<span class="tag-suggestion" onclick="addTagToInput(decodeURIComponent('${encodeURIComponent(tag)}'))">${escapeHtml(tag)}</span>`
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
    storeData(true);
}

function storeData(updateTimestamp) {
    searchIndex = null;
    ensureDataShape();
    if (updateTimestamp || !appData.lastSaved) appData.lastSaved = new Date().toISOString();
    const text = JSON.stringify(appData);
    localStorage.setItem('techLeadTracker', text);
    sessionStorage.setItem('techLeadTrackerBackup', text);
    updateLastSavedIndicator();
    writeDataFile(text);
    scheduleEmbedUpdates();
}

function writeDataFile(text) {
    if (!dataFileAvailable) return;
    fileSavePending = true;
    updateLastSavedIndicator();
    fetch(DATA_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text
    }).then(response => {
        fileSavePending = false;
        fileSaveOk = response.ok;
        updateLastSavedIndicator();
    }).catch(() => {
        fileSavePending = false;
        fileSaveOk = false;
        updateLastSavedIndicator();
    });
}

// Update the last saved indicator in UI
function updateLastSavedIndicator() {
    const indicator = document.getElementById('lastSavedIndicator');
    const location = document.getElementById('saveLocation');
    if (!indicator) return;
    const savedDate = appData.lastSaved ? new Date(appData.lastSaved) : null;
    const timeStr = savedDate ? savedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
    const dateStr = savedDate ? savedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    if (dataFileAvailable && fileSavePending) {
        indicator.textContent = 'Saving tracker-data.json…';
        indicator.style.color = '#64748B';
        if (location) location.textContent = 'File: tracker-data.json in this app folder';
    } else if (dataFileAvailable && fileSaveOk) {
        indicator.textContent = `Saved ${dateStr} ${timeStr}`;
        indicator.style.color = '#10B981';
        if (location) location.textContent = 'File: tracker-data.json in this app folder';
    } else if (dataFileAvailable) {
        indicator.textContent = 'Saved in this browser. The file update failed.';
        indicator.style.color = '#F59E0B';
        if (location) location.textContent = 'tracker-data.json was not updated';
    } else if (savedDate) {
        indicator.textContent = `Saved in this browser ${dateStr} ${timeStr}`;
        indicator.style.color = '#10B981';
        if (location) location.textContent = 'No file yet. Double-click start.command on Mac, or start.bat on Windows.';
    }
}

// Manual save to file (download)
function downloadBackup() {
    const dataStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tech-lead-tracker-backup-${localDateString()}.json`;
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
    
    const reportPeriod = { weekly: 'week', monthly: 'month', quarterly: 'quarter', yearly: 'year' }[viewName];
    if (reportPeriod) {
        setCurrentPeriod(reportPeriod);
        generatePeriodReport(reportPeriod);
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

function setCurrentWeek() {
    setCurrentPeriod('week');
}

function setCurrentPeriod(period) {
    const now = new Date();
    if (period === 'week') {
        const iso = getISOWeek(now);
        document.getElementById('weekSelector').value = `${iso.year}-W${String(iso.week).padStart(2, '0')}`;
    } else if (period === 'month') {
        document.getElementById('monthSelector').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    } else if (period === 'quarter') {
        document.getElementById('quarterYear').value = now.getFullYear();
        document.getElementById('quarterPart').value = String(Math.floor(now.getMonth() / 3) + 1);
    } else if (period === 'year') {
        document.getElementById('yearSelector').value = financialYearStart(now);
    }
}

function financialYearStart(date) {
    return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
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
                dropdown.innerHTML += `<option value="${team.id}">${escapeHtml(team.name)}</option>`;
            });
            dropdown.value = currentValue;
        }
    });
    
    // Populate owner filter
    const owners = [...new Set(appData.actions.flatMap(action => splitOwnerNames(action.owner)))].sort((a, b) => a.localeCompare(b));
    const ownerFilter = document.getElementById('filterActionOwner');
    if (ownerFilter) {
        const currentOwner = ownerFilter.value;
        ownerFilter.innerHTML = '<option value="">All Owners</option>';
        owners.forEach(owner => {
            ownerFilter.innerHTML += `<option value="${escapeHtml(owner)}">${escapeHtml(owner)}</option>`;
        });
        if (owners.includes(currentOwner)) ownerFilter.value = currentOwner;
    }
}

function splitOwnerNames(value) {
    return String(value || '').split(',').map(name => name.trim()).filter(Boolean);
}

function yourName() {
    const name = appData.settings && String(appData.settings.yourName || '').trim();
    return name || 'Kalpit';
}

function replaceYourNameToken(value, fromName, toName) {
    const from = String(fromName || '').trim().toLowerCase();
    const to = String(toName || '').trim();
    if (!from || !to) return String(value || '');
    const parts = splitOwnerNames(value);
    if (!parts.some(part => part.toLowerCase() === from)) return String(value || '');
    return parts.map(part => part.toLowerCase() === from ? to : part).join(', ');
}

function ownerWithYourName(value) {
    return splitOwnerNames(value).length ? String(value).trim() : yourName();
}

function syncYourNameField() {
    const input = document.getElementById('yourName');
    if (input) input.value = yourName();
}

function saveYourName() {
    const input = document.getElementById('yourName');
    if (!input) return;
    const next = input.value.trim() || 'Kalpit';
    const previous = yourName();
    input.value = next;
    if (!appData.settings || typeof appData.settings !== 'object') appData.settings = {};
    appData.settings.yourName = next;
    if (previous.toLowerCase() !== next.toLowerCase()) {
        appData.actions.forEach(action => {
            action.owner = replaceYourNameToken(action.owner, previous, next);
        });
        appData.updates.forEach(update => {
            update.people = replaceYourNameToken(update.people, previous, next);
        });
        appData.teams.forEach(team => {
            team.members = replaceYourNameToken(team.members, previous, next);
        });
    }
    ensureDataShape();
    saveData();
    renderTeams();
    renderUpdates();
    filterActions();
    updateDashboard();
}

// ==================== UPDATES ====================

function openAddUpdateModal() {
    document.getElementById('addUpdateForm').reset();
    document.getElementById('updateDate').value = localDateString();
    const status = document.getElementById('fileUpdateStatus');
    if (status) status.textContent = '';
    openModal('addUpdateModal');
}

function saveUpdate(event) {
    event.preventDefault();
    
    const tagsInput = document.getElementById('updateTags').value;
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [];
    
    const update = {
        id: generateId(),
        date: document.getElementById('updateDate').value,
        targetDate: document.getElementById('updateTargetDate').value,
        jira: document.getElementById('updateJira').value.trim(),
        status: document.getElementById('updateStatus').value,
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
    refreshTeamUpdatesList();
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
                <div class="update-item${index > 8 ? ' no-animate' : ''}" style="border-left-color: ${team ? safeColor(team.color) : 'var(--primary)'}; cursor: pointer;" onclick="openEditUpdateModal('${update.id}')">
                    <div class="update-header">
                        <div class="update-meta">
                            <span class="update-category category-${update.category}">
                                ${categoryIcons[update.category] || '📌'} ${update.category}
                            </span>
                            ${team ? `<span class="update-team" style="background: ${safeColor(team.color)}15; color: ${safeColor(team.color)}; border: 1px solid ${safeColor(team.color)}30;">${escapeHtml(team.name)}</span>` : ''}
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
                    ${update.targetDate ? `<p class="target-date">Target ${escapeHtml(formatDate(update.targetDate))}</p>` : ''}
                    ${update.jira ? `<span class="action-jira">${escapeHtml(update.jira)}</span>` : ''}
                    ${update.status ? `<span class="pill ${reportPillClass(update.status)}">${escapeHtml(reportStatusLabel(update.status))}</span>` : ''}
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
        refreshTeamUpdatesList();
    }
}

function openEditUpdateModal(id) {
    const update = appData.updates.find(u => u.id === id);
    if (!update) return;
    
    document.getElementById('editUpdateId').value = update.id;
    document.getElementById('editUpdateDate').value = update.date;
    document.getElementById('editUpdateTargetDate').value = update.targetDate || '';
    document.getElementById('editUpdateJira').value = update.jira || '';
    document.getElementById('editUpdateStatus').value = update.status || '';
    document.getElementById('editUpdateCategory').value = update.category;
    document.getElementById('editUpdateDescription').value = update.description;
    document.getElementById('editUpdatePeople').value = update.people || '';
    document.getElementById('editUpdateTags').value = update.tags ? update.tags.join(', ') : '';
    
    // Populate team dropdown
    const teamDropdown = document.getElementById('editUpdateTeam');
    teamDropdown.innerHTML = '<option value="">Select Team</option>';
    appData.teams.forEach(team => {
        teamDropdown.innerHTML += `<option value="${team.id}">${escapeHtml(team.name)}</option>`;
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
    update.targetDate = document.getElementById('editUpdateTargetDate').value;
    update.jira = document.getElementById('editUpdateJira').value.trim();
    update.status = document.getElementById('editUpdateStatus').value;
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
    refreshTeamUpdatesList();
    closeModal('editUpdateModal');
}

function deleteUpdateFromModal() {
    const id = document.getElementById('editUpdateId').value;
    if (confirm('Are you sure you want to delete this update?')) {
        appData.updates = appData.updates.filter(u => u.id !== id);
        saveData();
        filterUpdates();
        updateDashboard();
        refreshTeamUpdatesList();
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
    document.getElementById('actionOwner').value = yourName();
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
        jira: document.getElementById('actionJira').value.trim(),
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
                    dueText = `🎯 Target overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''}`;
                } else if (daysUntilDue === 0) {
                    dueText = '🎯 Target today';
                } else if (daysUntilDue === 1) {
                    dueText = '🎯 Target tomorrow';
                } else {
                    dueText = `🎯 Target ${formatDate(action.dueDate, 'short')}`;
                }
            }
            
            return `
                <div class="action-card priority-${action.priority}" onclick="openEditActionModal('${action.id}')">
                    <span class="priority-badge ${action.priority}">${action.priority}</span>
                    <div class="action-title">${escapeHtml(action.title)}</div>
                    <div class="action-owner">👤 ${escapeHtml(action.owner)}</div>
                    ${team ? `<div style="font-size: 0.7rem; color: ${safeColor(team.color)}; margin-top: 6px; font-weight: 600;">● ${escapeHtml(team.name)}</div>` : ''}
                    ${action.dueDate ? `<div class="action-due ${isOverdue ? 'overdue' : ''}">${dueText}</div>` : ''}
                    ${action.jira ? `<span class="action-jira">${escapeHtml(action.jira)}</span>` : ''}
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
        teamDropdown.innerHTML += `<option value="${team.id}">${escapeHtml(team.name)}</option>`;
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
    action.jira = document.getElementById('editActionJira').value.trim();
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
        const wanted = ownerFilter.toLowerCase();
        filtered = filtered.filter(action => splitOwnerNames(action.owner).some(name => name.toLowerCase() === wanted));
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
        targetDate: document.getElementById('teamTargetDate').value,
        jira: document.getElementById('teamJira').value.trim(),
        status: document.getElementById('teamStatus').value,
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
            <div class="team-card" onclick="openTeamUpdates('${team.id}')">
                <div class="team-header" style="background: ${safeColor(team.color)}">
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
                    ${team.targetDate ? `<p class="target-date">Target ${escapeHtml(formatDate(team.targetDate))}</p>` : ''}
                    ${team.jira ? `<span class="action-jira">${escapeHtml(team.jira)}</span>` : ''}
                    ${team.status ? `<span class="pill ${reportPillClass(team.status)}">${escapeHtml(reportStatusLabel(team.status))}</span>` : ''}
                    <div class="team-actions">
                        <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); openEditTeamModal('${team.id}')">✏️ Edit</button>
                        <button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); deleteTeam('${team.id}')">🗑️ Delete</button>
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
    document.getElementById('editTeamTargetDate').value = team.targetDate || '';
    document.getElementById('editTeamJira').value = team.jira || '';
    document.getElementById('editTeamStatus').value = team.status || '';
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
    team.targetDate = document.getElementById('editTeamTargetDate').value;
    team.jira = document.getElementById('editTeamJira').value.trim();
    team.status = document.getElementById('editTeamStatus').value;
    team.color = document.getElementById('editTeamColor').value;
    
    saveData();
    renderTeams();
    populateTeamDropdowns();
    updateDashboard();
    closeModal('editTeamModal');
}

let openTeamUpdatesId = null;

function openTeamUpdates(teamId) {
    openTeamUpdatesId = teamId;
    renderTeamUpdatesList();
    openModal('teamUpdatesModal');
}

function refreshTeamUpdatesList() {
    if (!openTeamUpdatesId) return;
    if (!document.getElementById('teamUpdatesModal')?.classList.contains('active')) return;
    renderTeamUpdatesList();
}

function renderTeamUpdatesList() {
    const title = document.getElementById('teamUpdatesTitle');
    const note = document.getElementById('teamUpdatesNote');
    const list = document.getElementById('teamUpdatesList');
    if (!title || !note || !list) return;
    const team = appData.teams.find(item => item.id === openTeamUpdatesId);
    if (!team) {
        title.textContent = 'Team updates';
        note.textContent = 'This team is no longer available.';
        list.innerHTML = '';
        return;
    }
    const updates = appData.updates
        .filter(update => update.teamId === team.id)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    title.textContent = team.name;
    note.textContent = updates.length
        ? `${countWord(updates.length, 'update', 'updates')}. Select one to edit it.`
        : 'No updates for this team yet.';
    list.innerHTML = updates.map(update => {
        const meta = [
            formatDate(update.date, 'short'),
            reportCategoryLabel(update.category),
            update.people,
            update.targetDate ? `Target ${formatDate(update.targetDate, 'short')}` : '',
            update.jira,
            statusPhrase(update.status)
        ].filter(Boolean).join(' · ');
        return `<button type="button" class="team-update-row" onclick="openEditUpdateModal('${update.id}')">
            <span class="team-update-main">
                <p>${escapeHtml(update.description || 'Untitled note')}</p>
                <div class="fine">${escapeHtml(meta)}</div>
            </span>
            <span class="btn btn-small btn-primary">Edit</span>
        </button>`;
    }).join('');
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

    const activeReport = document.querySelector('.view.active');
    const activePeriod = { 'weekly-view': 'week', 'monthly-view': 'month', 'quarterly-view': 'quarter', 'yearly-view': 'year' }[activeReport?.id];
    if (activePeriod) generatePeriodReport(activePeriod);
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
                <div class="recent-update-title">${escapeHtml((update.description || '').substring(0, 60))}${(update.description || '').length > 60 ? '...' : ''}</div>
                <div class="recent-update-category">${update.category}${update.targetDate ? ` · Target ${escapeHtml(formatDate(update.targetDate, 'short'))}` : ''}${update.jira ? ` · ${escapeHtml(update.jira)}` : ''}${update.status ? ` · ${escapeHtml(reportStatusLabel(update.status))}` : ''}</div>
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
                <div class="recent-update-category">👤 ${escapeHtml(action.owner)}${action.dueDate ? ` · Target ${escapeHtml(formatDate(action.dueDate, 'short'))}` : ''}${action.jira ? ` · ${escapeHtml(action.jira)}` : ''}</div>
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
            <div class="team-summary-item" style="cursor: pointer" onclick="openTeamUpdates('${team.id}')">
                <div class="team-summary-name">
                    <span class="team-color-dot" style="background: ${safeColor(team.color)}"></span>
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

let latestWeeklyModel = null;
let latestReportModel = null;

const REPORT_CATEGORY_LABELS = {
    meeting: 'Meeting',
    discussion: 'Discussion',
    review: 'PR review',
    approval: 'Approval',
    audit: 'Audit',
    planning: 'Planning',
    issue: 'Issue',
    other: 'Note'
};

const REPORT_STATUS_LABELS = {
    pending: 'Not started',
    'in-progress': 'In progress',
    completed: 'Done',
    blocked: 'Blocked'
};

function countWord(count, one, many) {
    return `${count} ${count === 1 ? one : many}`;
}

function reportCategoryLabel(category) {
    return REPORT_CATEGORY_LABELS[category] || 'Note';
}

function reportStatusLabel(status) {
    return REPORT_STATUS_LABELS[status] || 'Open';
}

function reportPillClass(value) {
    return Object.prototype.hasOwnProperty.call(REPORT_CATEGORY_LABELS, value) || Object.prototype.hasOwnProperty.call(REPORT_STATUS_LABELS, value)
        ? value
        : 'other';
}

function expandHex(color) {
    const hex = safeColor(color).slice(1);
    return hex.length === 3 ? hex.split('').map(char => char + char).join('') : hex;
}

function colorWithAlpha(color, alpha) {
    return `#${expandHex(color)}${alpha}`;
}

function teamById(id) {
    return appData.teams.find(team => team.id === id) || null;
}

function joinNames(names) {
    if (names.length <= 1) return names[0] || '';
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function formatWeekRange(start, end) {
    const sameYear = start.getFullYear() === end.getFullYear();
    const left = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
    const right = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${left} – ${right}`;
}

function weekDayList(weekStart) {
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + index);
        return date;
    });
}

function sameLocalDay(left, right) {
    return localDateString(left) === localDateString(right);
}

function actionDetail(action) {
    const note = String(action.notes || '').trim();
    const description = String(action.description || '').trim();
    if (description && note && description !== note) return `${description} — ${note}`;
    return description || note;
}

function targetPhrase(date) {
    if (!date) return '';
    return `target ${formatDate(date, 'short')}`;
}

function jiraPhrase(value) {
    const text = String(value || '').trim();
    return text ? `Jira ${text}` : '';
}

function statusPhrase(status) {
    return ['pending', 'in-progress', 'completed', 'blocked'].includes(status) ? reportStatusLabel(status) : '';
}

function duePhrase(action, weekEnd) {
    if (!action.dueDate) return '';
    const due = parseLocalDate(action.dueDate);
    const late = action.status !== 'completed' && due && startOfDay(due) < startOfDay(weekEnd);
    return `${targetPhrase(action.dueDate)}${late ? ', late' : ''}`;
}

function compareOpenActions(a, b) {
    const rank = { blocked: 0, 'in-progress': 1, pending: 2 };
    const statusGap = (rank[a.status] ?? 3) - (rank[b.status] ?? 3);
    if (statusGap) return statusGap;
    const priority = { high: 0, medium: 1, low: 2 };
    const priorityGap = (priority[a.priority] ?? 1) - (priority[b.priority] ?? 1);
    if (priorityGap) return priorityGap;
    return String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'));
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function updateVisibleThrough(update) {
    const date = parseLocalDate(update.date);
    if (!date) return null;
    const target = parseLocalDate(update.targetDate);
    if (target && target >= date) return endOfDay(target);
    if (update.status === 'completed') return endOfDay(date);
    return endOfDay(addDays(date, 28));
}

function latestNotesBefore(weekEnd) {
    const newest = new Map();
    appData.updates.forEach(update => {
        const date = parseLocalDate(update.date);
        if (!date || date > weekEnd) return;
        const key = update.teamId || '';
        const current = newest.get(key);
        if (!current || String(update.date) > String(current.date)) newest.set(key, update);
    });
    return [...newest.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function collectWeeklyModel(weekStart, weekEnd) {
    const withTeam = item => ({ ...item, teamName: teamById(item.teamId)?.name || '' });
    const updates = appData.updates
        .filter(update => {
            const date = parseLocalDate(update.date);
            return date && date >= weekStart && date <= weekEnd;
        })
        .map(withTeam)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const loggedIds = new Set(updates.map(update => update.id));
    const carried = appData.updates
        .filter(update => {
            if (loggedIds.has(update.id)) return false;
            const date = parseLocalDate(update.date);
            const until = updateVisibleThrough(update);
            return date && until && date < weekStart && until >= weekStart;
        })
        .map(withTeam)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const doneActions = appData.actions
        .filter(action => {
            if (!action.completedAt) return false;
            const completed = new Date(action.completedAt);
            return !Number.isNaN(completed.getTime()) && completed >= weekStart && completed <= weekEnd;
        })
        .map(withTeam)
        .sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)));
    const openActions = appData.actions
        .filter(action => action.status !== 'completed' && activeDuringWeek(action, weekStart, weekEnd))
        .map(withTeam)
        .sort(compareOpenActions);
    let showcase = [];
    if (!updates.length && !carried.length && !openActions.length && !doneActions.length) {
        showcase = latestNotesBefore(weekEnd).map(withTeam);
    }
    return { weekStart, weekEnd, updates, carried, showcase, doneActions, openActions };
}

function bucketByTeam(model) {
    const known = new Set(appData.teams.map(team => team.id));
    const carried = model.carried || [];
    const showcase = model.showcase || [];
    const hasWork = pack => pack.updates.length || pack.carried.length || pack.showcase.length || pack.open.length || pack.done.length;
    const packs = appData.teams.map(team => ({
        team,
        updates: model.updates.filter(update => update.teamId === team.id),
        carried: carried.filter(update => update.teamId === team.id),
        showcase: showcase.filter(update => update.teamId === team.id),
        open: model.openActions.filter(action => action.teamId === team.id),
        done: model.doneActions.filter(action => action.teamId === team.id)
    }));
    return {
        active: packs
            .filter(hasWork)
            .sort((a, b) => (b.updates.length + b.carried.length + b.showcase.length + b.done.length + b.open.length) - (a.updates.length + a.carried.length + a.showcase.length + a.done.length + a.open.length) || a.team.name.localeCompare(b.team.name)),
        quiet: packs.filter(pack => !hasWork(pack)),
        loose: {
            updates: model.updates.filter(update => !known.has(update.teamId)),
            carried: carried.filter(update => !known.has(update.teamId)),
            showcase: showcase.filter(update => !known.has(update.teamId)),
            open: model.openActions.filter(action => !known.has(action.teamId)),
            done: model.doneActions.filter(action => !known.has(action.teamId))
        }
    };
}

function peopleThisWeek(model) {
    const people = new Map();
    const entry = name => {
        const key = name.toLowerCase();
        if (!people.has(key)) people.set(key, { name, notes: 0, open: 0, done: 0, blocked: 0, teams: new Set() });
        return people.get(key);
    };
    [...model.updates, ...(model.carried || []), ...(model.showcase || [])].forEach(update => {
        splitOwnerNames(update.people).forEach(name => {
            const person = entry(name);
            person.notes += 1;
            if (update.teamName) person.teams.add(update.teamName);
        });
    });
    model.openActions.forEach(action => {
        splitOwnerNames(action.owner).forEach(name => {
            const person = entry(name);
            person.open += 1;
            if (action.status === 'blocked') person.blocked += 1;
            if (action.teamName) person.teams.add(action.teamName);
        });
    });
    model.doneActions.forEach(action => {
        splitOwnerNames(action.owner).forEach(name => {
            const person = entry(name);
            person.done += 1;
            if (action.teamName) person.teams.add(action.teamName);
        });
    });
    return [...people.values()].sort((a, b) => (b.open + b.done + b.notes) - (a.open + a.done + a.notes) || a.name.localeCompare(b.name));
}

function namedPeople(pack) {
    const names = new Set(splitOwnerNames(pack.team?.members));
    pack.updates.forEach(update => splitOwnerNames(update.people).forEach(name => names.add(name)));
    pack.open.forEach(action => splitOwnerNames(action.owner).forEach(name => names.add(name)));
    pack.done.forEach(action => splitOwnerNames(action.owner).forEach(name => names.add(name)));
    return [...names];
}

function managementLead(model, buckets, people) {
    const carried = model.carried || [];
    const showcase = model.showcase || [];
    const periodName = model.periodName || 'week';
    if (!model.updates.length && !carried.length && !showcase.length && !model.doneActions.length && !model.openActions.length) {
        return `Nothing was logged for this ${periodName}, and no open work falls inside it.`;
    }
    const sentences = [];
    if (model.updates.length && buckets.active.length) {
        sentences.push(`${countWord(model.updates.length, 'note', 'notes')} across ${countWord(buckets.active.length, 'team', 'teams')}.`);
    } else if (model.updates.length) {
        sentences.push(`${countWord(model.updates.length, 'note', 'notes')} were logged, and none are tagged to a team.`);
    } else if (carried.length) {
        sentences.push(`No new notes were logged. ${countWord(carried.length, 'item is', 'items are')} still in progress from earlier, so this ${periodName} still has work to show.`);
    } else if (showcase.length) {
        sentences.push(`No new notes were logged. The latest saved work is included so this ${periodName} is not empty.`);
    } else {
        sentences.push('No new notes were logged.');
    }
    if (model.doneActions.length) sentences.push(`${countWord(model.doneActions.length, 'task', 'tasks')} finished.`);
    if (model.openActions.length) {
        const inProgress = model.openActions.filter(action => action.status === 'in-progress').length;
        const pending = model.openActions.filter(action => action.status === 'pending').length;
        const bits = [];
        if (inProgress) bits.push(`${inProgress} in progress`);
        if (pending) bits.push(`${pending} not started`);
        sentences.push(`${countWord(model.openActions.length, 'task is', 'tasks are')} still open${bits.length ? ` (${bits.join(', ')})` : ''}.`);
    }
    const blockers = model.openActions.filter(action => action.status === 'blocked');
    if (blockers.length === 1) sentences.push('1 blocker needs a decision.');
    else if (blockers.length) sentences.push(`${blockers.length} blockers need a decision.`);
    else sentences.push('No blockers are open.');
    if (buckets.active[0]) sentences.push(`${buckets.active[0].team.name} had the most movement.`);
    const busiestPerson = [...people].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name))[0];
    if (busiestPerson && busiestPerson.open > 0) {
        sentences.push(`${busiestPerson.name} is carrying the most open work (${countWord(busiestPerson.open, 'task', 'tasks')}).`);
    }
    return sentences.join(' ');
}

function insightTiles(model, buckets, people) {
    const tiles = [];
    if (buckets.active[0]) {
        const pack = buckets.active[0];
        tiles.push({
            kicker: 'Busiest team',
            title: pack.team.name,
            detail: `${countWord(pack.updates.length + (pack.carried || []).length + (pack.showcase || []).length, 'note', 'notes')}, ${countWord(pack.open.length, 'open task', 'open tasks')}, ${countWord(pack.done.length, 'finished', 'finished')}`
        });
    } else {
        tiles.push({ kicker: 'Busiest team', title: 'No team activity', detail: 'Tag a note or a task to a team and it will show up here.' });
    }
    const blockers = model.openActions.filter(action => action.status === 'blocked');
    if (blockers.length === 1) {
        tiles.push({
            kicker: 'Needs a decision',
            title: blockers[0].title,
            detail: [blockers[0].owner || 'Unassigned', blockers[0].teamName].filter(Boolean).join(' · ')
        });
    } else if (blockers.length) {
        tiles.push({
            kicker: 'Needs a decision',
            title: countWord(blockers.length, 'blocker', 'blockers'),
            detail: blockers.slice(0, 2).map(action => action.title).join('; ')
        });
    } else {
        tiles.push({ kicker: 'Needs a decision', title: 'No blockers', detail: `Nothing is marked blocked for this ${model.periodName || 'week'}.` });
    }
    const busiestPerson = [...people].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name))[0];
    if (busiestPerson && busiestPerson.open > 0) {
        tiles.push({
            kicker: 'Most open work',
            title: busiestPerson.name,
            detail: `${countWord(busiestPerson.open, 'open task', 'open tasks')}${busiestPerson.teams.size ? ` · ${[...busiestPerson.teams].join(', ')}` : ''}`
        });
    } else if (people[0]) {
        tiles.push({
            kicker: 'Most visible',
            title: people[0].name,
            detail: `${countWord(people[0].notes, 'note', 'notes')} this ${model.periodName || 'week'}`
        });
    } else {
        tiles.push({ kicker: 'Most open work', title: 'No owners named', detail: 'Add a person on a note or a task.' });
    }
    return tiles;
}

function eachLocalDay(start, end) {
    const days = [];
    const cursor = startOfDay(start);
    const last = startOfDay(end);
    while (cursor <= last) {
        days.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return days;
}

function countInRange(items, dateOf, rangeStart, rangeEnd) {
    const start = startOfDay(rangeStart);
    const end = endOfDay(rangeEnd);
    return items.filter(item => {
        const date = parseLocalDate(dateOf(item));
        return date && date >= start && date <= end;
    }).length;
}

function timelineBuckets(items, model, dateOf) {
    const period = model.period || 'week';
    if (period === 'year') {
        return Array.from({ length: 12 }, (_, index) => {
            const day = new Date(model.weekStart.getFullYear(), model.weekStart.getMonth() + index, 1);
            const rangeEnd = endOfDay(new Date(day.getFullYear(), day.getMonth() + 1, 0));
            return {
                day,
                label: day.toLocaleDateString('en-US', { month: 'short' }),
                date: '',
                caption: day.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                count: countInRange(items, dateOf, day, rangeEnd)
            };
        });
    }
    if (period === 'quarter') {
        const buckets = [];
        const cursor = startOfDay(model.weekStart);
        const weekday = cursor.getDay() || 7;
        cursor.setDate(cursor.getDate() - weekday + 1);
        const last = startOfDay(model.weekEnd);
        while (cursor <= last) {
            const weekStart = new Date(cursor);
            const weekEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 6);
            const visibleStart = weekStart < startOfDay(model.weekStart) ? startOfDay(model.weekStart) : weekStart;
            const visibleEnd = weekEnd > startOfDay(model.weekEnd) ? model.weekEnd : weekEnd;
            buckets.push({
                day: visibleStart,
                label: visibleStart.toLocaleDateString('en-US', { month: 'short' }),
                date: visibleStart.getDate(),
                caption: `Week of ${visibleStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
                count: countInRange(items, dateOf, visibleStart, visibleEnd)
            });
            cursor.setDate(cursor.getDate() + 7);
        }
        return buckets;
    }
    return eachLocalDay(model.weekStart, model.weekEnd).map(day => ({
        day,
        label: day.toLocaleDateString('en-US', { weekday: 'short' }),
        date: day.getDate(),
        caption: day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        count: items.filter(item => {
            const date = parseLocalDate(dateOf(item));
            return date && sameLocalDay(date, day);
        }).length
    }));
}

function railColumns(count) {
    if (count === 12) return 6;
    if (count <= 7) return count || 1;
    return 7;
}

function railHtml(days, color) {
    const columns = railColumns(days.length);
    return `<div class="week-rail" style="grid-template-columns:repeat(${columns}, minmax(0, 1fr))">${days.map(day => `
        <div class="week-day${day.count ? ' has-work' : ''}"${day.count ? ` style="background:${colorWithAlpha(color, '22')}"` : ''}>
            <span>${escapeHtml(String(day.label))}</span>${day.date !== '' ? `<em>${escapeHtml(String(day.date))}</em>` : ''}<strong>${day.count}</strong>
        </div>`).join('')}</div>`;
}

function happenedHtml(update) {
    const meta = [formatDate(update.date, 'short'), splitOwnerNames(update.people).join(', '), targetPhrase(update.targetDate), jiraPhrase(update.jira), statusPhrase(update.status), (update.tags || []).map(tag => `#${tag}`).join(' ')].filter(Boolean).join(' · ');
    return `<div class="happened-item">
        <p><span class="pill ${reportPillClass(update.category)}">${escapeHtml(reportCategoryLabel(update.category))}</span>${update.status ? `<span class="pill ${reportPillClass(update.status)}">${escapeHtml(reportStatusLabel(update.status))}</span>` : ''}${escapeHtml(update.description || 'Untitled note')}</p>
        ${meta ? `<div class="fine">${escapeHtml(meta)}</div>` : ''}
    </div>`;
}

function workBits(action, weekEnd) {
    return [
        splitOwnerNames(action.owner).join(', ') || 'Unassigned',
        duePhrase(action, weekEnd),
        jiraPhrase(action.jira),
        action.priority === 'high' ? 'High priority' : action.priority === 'low' ? 'Low priority' : '',
        action.recurring ? `Repeats ${action.recurring}` : ''
    ].filter(Boolean);
}

function workHtml(action, weekEnd) {
    const extra = actionDetail(action);
    return `<div class="work-row">
        <p><span class="pill ${reportPillClass(action.status)}">${escapeHtml(reportStatusLabel(action.status))}</span><strong>${escapeHtml(action.title)}</strong></p>
        <div class="fine">${escapeHtml(workBits(action, weekEnd).join(' · '))}</div>
        ${extra ? `<div class="fine">${escapeHtml(extra)}</div>` : ''}
    </div>`;
}

function doneHtml(action) {
    const bits = [
        splitOwnerNames(action.owner).join(', ') || 'Unassigned',
        action.completedAt ? `finished ${formatDate(action.completedAt, 'short')}` : '',
        targetPhrase(action.dueDate),
        jiraPhrase(action.jira)
    ].filter(Boolean);
    const extra = actionDetail(action);
    return `<div class="work-row">
        <p><span class="pill completed">Done</span><strong>${escapeHtml(action.title)}</strong></p>
        <div class="fine">${escapeHtml(bits.join(' · '))}</div>
        ${extra ? `<div class="fine">${escapeHtml(extra)}</div>` : ''}
    </div>`;
}

function teamCardHtml(pack, model, color, title, subtitle) {
    const blockers = pack.open.filter(action => action.status === 'blocked').length;
    const carried = pack.carried || [];
    const showcase = pack.showcase || [];
    const counts = [
        countWord(pack.updates.length + carried.length + showcase.length, 'note', 'notes'),
        countWord(pack.open.length, 'open', 'open'),
        countWord(pack.done.length, 'finished', 'finished')
    ];
    if (blockers) counts.push(countWord(blockers, 'blocker', 'blockers'));
    const teamId = pack.team && pack.team.id ? pack.team.id : '';
    return `<article class="team-brief">
        <header class="team-brief-head" ${teamId ? `onclick="openTeamUpdates('${teamId}')"` : ''} style="border-left-color:${safeColor(color)};background:${colorWithAlpha(color, '18')}${teamId ? ';cursor:pointer' : ''}">
            <div>
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(subtitle)}</p>
            </div>
            <div class="team-counts">${counts.map(count => `<span>${escapeHtml(count)}</span>`).join('')}</div>
        </header>
        <div class="team-brief-body">
            <div>
                <div class="section-label">Timeline</div>
                ${railHtml(timelineBuckets(pack.updates, model, update => update.date), color)}
            </div>
            <div class="team-split">
                <div>
                    <h4>What happened</h4>
                    ${pack.updates.length ? pack.updates.map(happenedHtml).join('') : `<p class="fine">No new notes this ${escapeHtml(model.periodName || 'week')}.</p>`}
                    ${carried.length ? `<h4 class="split-follow">Still in progress</h4><p class="fine">Logged earlier, and still open in this ${escapeHtml(model.periodName || 'week')}.</p>${carried.map(happenedHtml).join('')}` : ''}
                    ${showcase.length ? `<h4 class="split-follow">Latest work to show</h4><p class="fine">Nothing new was logged in this ${escapeHtml(model.periodName || 'week')}. These are the latest updates.</p>${showcase.map(happenedHtml).join('')}` : ''}
                </div>
                <div>
                    <h4>Who is working on what</h4>
                    ${pack.open.length ? pack.open.map(action => workHtml(action, model.weekEnd)).join('') : `<p class="fine">No open tasks this ${escapeHtml(model.periodName || 'week')}.</p>`}
                    ${pack.done.length ? `<h4 class="split-follow">Finished this ${escapeHtml(model.periodName || 'week')}</h4>${pack.done.map(doneHtml).join('')}` : ''}
                </div>
            </div>
        </div>
    </article>`;
}

function renderWeeklyHtml(model) {
    const buckets = bucketByTeam(model);
    const people = peopleThisWeek(model);
    const meetings = model.updates.filter(update => update.category === 'meeting').length;
    const reviews = model.updates.filter(update => update.category === 'review').length;
    const inProgress = model.openActions.filter(action => action.status === 'in-progress').length;
    const blockers = model.openActions.filter(action => action.status === 'blocked');
    const stats = [
        [model.updates.length, 'Notes'],
        [model.doneActions.length, 'Finished'],
        [inProgress, 'In progress'],
        [blockers.length, 'Blockers'],
        [meetings, 'Meetings'],
        [reviews, 'PR reviews']
    ];
    const cards = buckets.active.map(pack => {
        return teamCardHtml(pack, model, pack.team.color, pack.team.name, teamReportSubtitle(pack));
    }).join('');
    const looseHas = buckets.loose.updates.length || (buckets.loose.carried || []).length || (buckets.loose.showcase || []).length || buckets.loose.open.length || buckets.loose.done.length;
    const loose = looseHas
        ? teamCardHtml({ ...buckets.loose, team: { members: '' } }, model, '#64748B', 'Not tagged to a team', 'These notes and tasks have no team, so they are easy to miss.')
        : '';
    const quietNames = buckets.quiet.map(quietTeamLabel);
    const quiet = quietNames.length
        ? `<div class="quiet-teams"><div class="section-label">Quiet this ${escapeHtml(model.periodName || 'week')}</div><p>${escapeHtml(joinNames(quietNames))} had no notes and no open work in this ${escapeHtml(model.periodName || 'week')}.</p></div>`
        : '';
    const attention = blockers.length ? `<section class="mgmt-callout"><h4>Needs attention</h4><ul>${blockers.map(action => {
        const bits = [action.owner || 'Unassigned', action.teamName, duePhrase(action, model.weekEnd), jiraPhrase(action.jira), actionDetail(action)].filter(Boolean);
        return `<li><strong>${escapeHtml(action.title)}</strong> — ${escapeHtml(bits.join(' · '))}</li>`;
    }).join('')}</ul></section>` : '';
    const peopleBoard = people.length ? `<section class="people-board"><div class="section-label">Who was involved</div><div class="people-chips">${people.map(person => {
        const otherOpen = person.open - person.blocked;
        const bits = [];
        if (person.blocked) bits.push(countWord(person.blocked, 'blocked', 'blocked'));
        if (otherOpen > 0) bits.push(countWord(otherOpen, 'open', 'open'));
        if (person.done) bits.push(countWord(person.done, 'finished', 'finished'));
        if (person.notes) bits.push(countWord(person.notes, 'note', 'notes'));
        const teams = [...person.teams].join(', ');
        return `<span class="person-chip">${escapeHtml(person.name)}${teams ? ` · ${escapeHtml(teams)}` : ''} · ${escapeHtml(bits.join(' · '))}</span>`;
    }).join('')}</div></section>` : '';
    return `
        <div class="mgmt-hero">
            <div class="mgmt-kicker">Management update · ${escapeHtml(model.label)}</div>
            <h3>${escapeHtml(model.range)}</h3>
            <p class="mgmt-lead">${escapeHtml(managementLead(model, buckets, people))}</p>
        </div>
        <div class="mgmt-stats">${stats.map(([value, label]) => `<div class="mgmt-stat"><strong>${value}</strong><span>${label}</span></div>`).join('')}</div>
        <div class="mgmt-body">
            <div class="insight-row">${insightTiles(model, buckets, people).map(tile => `
                <div class="insight-tile"><span>${escapeHtml(tile.kicker)}</span><strong>${escapeHtml(tile.title)}</strong><p>${escapeHtml(tile.detail)}</p></div>
            `).join('')}</div>
            <section class="timeline-board">
                <div class="section-label">When the work happened</div>
                ${railHtml(timelineBuckets(model.updates, model, update => update.date), '#4F46E5')}
            </section>
            ${attention}
            ${peopleBoard}
            ${cards || (!loose ? `<p class="empty-state">No team had notes or open work in this ${escapeHtml(model.periodName || 'week')}.</p>` : '')}
            ${loose}
            ${quiet}
            <p class="report-foot">Prepared from the daily tracker · ${escapeHtml(new Date().toLocaleString())}</p>
        </div>`;
}

const REPORT_VIEWS = {
    week: { hostId: 'weeklyReport', buttonId: 'downloadWeeklyPdf', choice: 'week' },
    month: { hostId: 'monthlyReport', buttonId: 'downloadMonthlyPdf', choice: 'month' },
    quarter: { hostId: 'quarterlyReport', buttonId: 'downloadQuarterlyPdf', choice: 'quarter' },
    year: { hostId: 'yearlyReport', buttonId: 'downloadYearlyPdf', choice: 'year' }
};

function readPeriod(period) {
    if (period === 'week') {
        const value = document.getElementById('weekSelector')?.value || '';
        if (!value.includes('-W')) return null;
        const [yearText, weekText] = value.split('-W');
        const weekStart = getDateOfISOWeek(parseInt(weekText, 10), parseInt(yearText, 10));
        const weekEnd = endOfDay(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6));
        return {
            start: weekStart,
            end: weekEnd,
            label: `Week ${Number(weekText)}, ${yearText}`,
            range: formatWeekRange(weekStart, weekEnd),
            fileKey: value,
            periodName: 'week'
        };
    }
    if (period === 'month') {
        const value = document.getElementById('monthSelector')?.value || '';
        const match = /^(\d{4})-(\d{2})$/.exec(value);
        if (!match) return null;
        const year = Number(match[1]);
        const month = Number(match[2]);
        if (month < 1 || month > 12) return null;
        const start = new Date(year, month - 1, 1);
        const end = endOfDay(new Date(year, month, 0));
        return {
            start,
            end,
            label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            range: formatWeekRange(start, end),
            fileKey: value,
            periodName: 'month'
        };
    }
    if (period === 'quarter') {
        const year = Number(document.getElementById('quarterYear')?.value);
        const part = Number(document.getElementById('quarterPart')?.value);
        if (!year || part < 1 || part > 4) return null;
        const startMonth = (part - 1) * 3;
        const start = new Date(year, startMonth, 1);
        const end = endOfDay(new Date(year, startMonth + 3, 0));
        return {
            start,
            end,
            label: `Q${part} ${year}`,
            range: formatWeekRange(start, end),
            fileKey: `${year}-Q${part}`,
            periodName: 'quarter'
        };
    }
    if (period === 'year') {
        const year = Number(document.getElementById('yearSelector')?.value);
        if (!year || year < 2000 || year > 2100) return null;
        const start = new Date(year, 3, 1);
        const end = endOfDay(new Date(year + 1, 3, 0));
        return {
            start,
            end,
            label: `FY ${year}-${String(year + 1).slice(-2)}`,
            range: formatWeekRange(start, end),
            fileKey: `FY${year}-${String(year + 1).slice(-2)}`,
            periodName: 'year'
        };
    }
    return null;
}

function generateWeeklyReport() {
    generatePeriodReport('week');
}

function generatePeriodReport(period) {
    const view = REPORT_VIEWS[period];
    const host = view && document.getElementById(view.hostId);
    if (!host) return;
    const spec = readPeriod(period);
    if (!spec) {
        if (latestReportModel && latestReportModel.period === period) {
            latestReportModel = null;
            latestWeeklyModel = null;
        }
        host.innerHTML = `<p class="empty-state">Choose a ${view.choice} to build the management update.</p>`;
        return;
    }
    const model = collectWeeklyModel(spec.start, spec.end);
    model.label = spec.label;
    model.range = spec.range;
    model.period = period;
    model.periodName = spec.periodName;
    model.fileKey = spec.fileKey;
    latestReportModel = model;
    latestWeeklyModel = model;
    host.innerHTML = renderWeeklyHtml(model);
}

function activeDuringWeek(item, weekStart, weekEnd) {
    const created = item.createdAt ? new Date(item.createdAt) : null;
    if (created && !Number.isNaN(created.getTime()) && created > weekEnd) return false;
    if (item.completedAt) {
        const completed = new Date(item.completedAt);
        if (!Number.isNaN(completed.getTime()) && completed < weekStart) return false;
    }
    return true;
}

function getDateOfISOWeek(week, year) {
    const jan4 = new Date(year, 0, 4);
    const day = jan4.getDay() || 7;
    const monday = new Date(year, 0, 4 - day + 1 + (week - 1) * 7);
    monday.setHours(0, 0, 0, 0);
    return monday;
}

function gridTracks(root, selector, fallback) {
    const el = root.querySelector(selector);
    if (!el) return fallback;
    const value = getComputedStyle(el).gridTemplateColumns;
    return value && value !== 'none' ? value : fallback;
}

async function buildExactReportDocument(report) {
    const previousOverflow = report.style.overflow;
    report.style.overflow = 'visible';
    const width = Math.max(720, Math.ceil(report.getBoundingClientRect().width));
    const height = Math.max(900, Math.ceil(report.scrollHeight) + 64);
    report.style.overflow = previousOverflow;
    const statsTracks = gridTracks(report, '.mgmt-stats', 'repeat(6, minmax(0, 1fr))');
    const insightTracks = gridTracks(report, '.insight-row', 'repeat(3, minmax(0, 1fr))');
    const cssResponse = await fetch('styles.css', { cache: 'no-store' });
    if (!cssResponse.ok) throw new Error('The report styles could not be loaded. Start the tracker with the Mac or Windows script, then export again.');
    const css = (await cssResponse.text()).replace(/<\/style/gi, '<\\/style');
    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const pageTitle = latestReportModel ? `${latestReportModel.label} ${latestReportModel.range}` : 'Management report';
    return {
        width,
        height,
        html: `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(pageTitle)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap">
<style>${css}</style>
<style>
  html, body { margin: 0; padding: 0; background: ${theme === 'dark' ? '#0F172A' : '#F8FAFC'}; width: ${width}px; }
  .weekly-report, .team-brief { overflow: visible !important; height: auto !important; max-height: none !important; width: ${width}px; max-width: none; }
  .mgmt-stats { grid-template-columns: ${statsTracks} !important; }
  .insight-row { grid-template-columns: ${insightTracks} !important; }
  .team-brief-head { flex-direction: row !important; }
  .team-counts { justify-content: flex-end !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @page { size: ${width}px ${height}px; margin: 0; }
</style>
</head>
<body>${report.outerHTML}</body>
</html>`
    };
}

function appraisalItems() {
    const teamName = item => teamById(item.teamId)?.name || '';
    const updates = appData.updates.map(update => ({
        kind: 'update',
        text: update.description || 'Untitled note',
        date: update.date,
        teamName: teamName(update),
        people: update.people || '',
        jira: update.jira || '',
        category: update.category || '',
        status: update.status || '',
        tags: update.tags || []
    }));
    const actions = appData.actions.map(action => ({
        kind: 'action',
        text: action.title || 'Untitled task',
        date: action.completedAt || action.dueDate || action.createdAt || '',
        teamName: teamName(action),
        people: action.owner || '',
        jira: action.jira || '',
        category: '',
        status: action.status || '',
        tags: []
    }));
    return { updates, actions };
}

function appraisalBlob(item) {
    return [item.text, item.teamName, item.category, item.status, ...(item.tags || [])].join(' ').toLowerCase();
}

function appraisalSectionFor(item) {
    const blob = appraisalBlob(item);
    if (item.teamName.toLowerCase() === 'techbacklog' || blob.includes('backlog')) return 'backlog';
    if (/mentor|junior|coaching|guided|guidance|unblock/.test(blob)) return 'people';
    if (item.kind === 'update' && (item.category === 'meeting' || item.category === 'discussion')) return 'stakeholders';
    if (item.status === 'completed' || item.category === 'approval' || item.category === 'review') return 'delivery';
    return 'leadership';
}

function leadershipGroup(item) {
    const blob = appraisalBlob(item);
    if (/security|compliance|audit|checkmarx|mfa|risk|secret|vulnerab/.test(blob)) return 'Security, Compliance & Risk Management';
    if (/performance|latency|observ|reliab|slow|sre/.test(blob)) return 'Performance, Observability & Reliability';
    if (/deliver|release|newsletter|production/.test(blob)) return 'Critical Delivery Impact';
    return 'Enterprise-Level Architecture & Solutioning';
}

function appraisalBullet(item) {
    const when = item.date ? formatDate(String(item.date).slice(0, 10), 'short') : '';
    const bits = [when, item.teamName, item.people, item.jira ? `Jira ${item.jira}` : '', item.category ? reportCategoryLabel(item.category) : '', item.status ? reportStatusLabel(item.status) : ''].filter(Boolean);
    return `<li><strong>${escapeHtml(item.text)}</strong>${bits.length ? ` <span class="meta">— ${escapeHtml(bits.join(' · '))}</span>` : ''}</li>`;
}

function appraisalList(items, numbered) {
    if (!items.length) return '<p class="empty">Nothing logged for this point yet. Add an update and it will appear here.</p>';
    const bullets = items.map(appraisalBullet).join('');
    return numbered ? `<ol>${bullets}</ol>` : `<ul>${bullets}</ul>`;
}

function buildAppraisalDocument() {
    const name = yourName();
    const { updates, actions } = appraisalItems();
    const all = updates.concat(actions);
    const groups = { leadership: [], delivery: [], backlog: [], stakeholders: [], people: [] };
    all.forEach(item => groups[appraisalSectionFor(item)].push(item));
    const peopleNames = [...new Set(updates.flatMap(item => splitOwnerNames(item.people)))];
    if (!groups.people.length && peopleNames.length) {
        groups.people.push({
            kind: 'update',
            text: `Worked with ${peopleNames.join(', ')} across the saved updates.`,
            date: '',
            teamName: '',
            people: '',
            jira: '',
            category: '',
            status: '',
            tags: []
        });
    }
    const leadershipOrder = [
        'Enterprise-Level Architecture & Solutioning',
        'Security, Compliance & Risk Management',
        'Performance, Observability & Reliability',
        'Critical Delivery Impact'
    ];
    const leadershipHtml = leadershipOrder.map(title => {
        const items = groups.leadership.filter(item => leadershipGroup(item) === title);
        if (!items.length) return '';
        return `<h3>${escapeHtml(title)}</h3>${appraisalList(items, false)}`;
    }).join('');
    const dates = updates.map(item => item.date).filter(Boolean).sort();
    const range = dates.length ? `${formatDate(dates[0], 'short')} – ${formatDate(dates[dates.length - 1], 'short')}` : 'the dates saved in the tracker';
    const teamNames = [...new Set(all.map(item => item.teamName).filter(Boolean))];
    const summary = [
        teamNames.length ? `Ownership across ${teamNames.join(', ')}.` : '',
        `${countWord(updates.length, 'update', 'updates')} logged and ${countWord(actions.filter(item => item.status === 'completed').length, 'task', 'tasks')} finished.`,
        peopleNames.length ? `Collaboration with ${peopleNames.join(', ')}.` : '',
        groups.delivery.length ? `${countWord(groups.delivery.length, 'delivery item', 'delivery items')} called out below.` : '',
        groups.backlog.length ? `${countWord(groups.backlog.length, 'tech backlog item', 'tech backlog items')} called out below.` : ''
    ].filter(Boolean);
    const section = (number, title, body) => `<section><h2><span>${number}</span> ${escapeHtml(title)}</h2>${body}</section>`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Appraisal Write-Up – ${escapeHtml(name)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&amp;display=swap">
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: Inter, sans-serif; color: #1E1B4B; margin: 0; font-size: 12.5px; line-height: 1.45; }
  .banner { color: #6366F1; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-align: center; }
  h1 { font-size: 28px; line-height: 1.15; margin: 8px 0 12px; }
  h2 { font-size: 18px; margin: 22px 0 8px; break-after: avoid; }
  h2 span { color: #059669; margin-right: 6px; }
  h3 { font-size: 14px; margin: 12px 0 4px; break-after: avoid; }
  p { margin: 0 0 8px; }
  ul, ol { margin: 4px 0 10px; padding-left: 22px; }
  li { margin: 4px 0; break-inside: avoid; }
  .meta { color: #475569; font-weight: 400; }
  .empty { color: #64748B; font-style: italic; }
  .summary { background: #F8FAFC; border-radius: 12px; padding: 12px 14px; break-inside: avoid; }
</style>
</head>
<body>
<p class="banner">Classification - Internal</p>
<h1>Promotion &amp; Performance Appraisal Write-Up – ${escapeHtml(name)}</h1>
<p>Over ${escapeHtml(range)}, ${escapeHtml(name)} logged ${escapeHtml(countWord(updates.length, 'update', 'updates'))}${teamNames.length ? ` across ${escapeHtml(teamNames.join(', '))}` : ''}. This write-up keeps the five appraisal points and fills each one from those saved updates and tasks.</p>
${section('1.', 'Technical Leadership & Ownership', leadershipHtml || appraisalList(groups.leadership, false))}
${section('2.', 'Delivery Excellence – Key Items Delivered', `<h3>Major Functional Deliveries</h3>${appraisalList(groups.delivery, true)}`)}
${section('3.', 'Tech Backlog – High Impact Items Closed', `<p>Below is a consolidated summary of Tech Backlog items saved in the tracker.</p>${appraisalList(groups.backlog, false)}`)}
${section('4.', 'Stakeholder Collaboration & Cross-Functional Impact', `<p>End-to-end communication recorded in meetings and discussions.</p>${appraisalList(groups.stakeholders, false)}`)}
${section('5.', 'People Leadership & Team Value', appraisalList(groups.people, false))}
<section class="summary">
  <h2><span>★</span> Summary – Why I am ready for the next role</h2>
  <p>I have been managing the work recorded in this tracker across solutioning, delivery, and the teams named above.</p>
  <p><strong>I have demonstrated:</strong></p>
  <ul>${summary.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
  <p>I respectfully submit this write-up in support of my promotion to the next leadership level.</p>
</section>
<p class="banner">Classification - Internal</p>
</body>
</html>`;
}

async function downloadPdfFile({ html, filename, width, height }) {
    const response = await fetch('/api/report.pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, filename, width, height })
    });
    if (!response.ok) {
        const message = (await response.text()).trim();
        throw new Error(message || 'The PDF could not be created.');
    }
    const blob = await response.blob();
    if (!blob.size) throw new Error('The PDF came back empty.');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function downloadAppraisal() {
    const button = document.getElementById('downloadAppraisal');
    const previousLabel = button ? button.textContent : '';
    if (button) {
        button.disabled = true;
        button.textContent = 'Preparing PDF…';
    }
    try {
        await downloadPdfFile({
            html: buildAppraisalDocument(),
            filename: 'self-appraisal.pdf',
            width: 900,
            height: 1400
        });
    } catch (error) {
        const message = error && error.message ? error.message : 'The PDF could not be downloaded.';
        alert(message.includes('fetch') || message === 'Failed to fetch'
            ? 'Start the tracker with the Mac or Windows script, then download the appraisal again.'
            : message);
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = previousLabel;
        }
    }
}

async function exportWeeklyReport(period = 'week') {
    const view = REPORT_VIEWS[period] || REPORT_VIEWS.week;
    generatePeriodReport(period);
    if (!latestReportModel || latestReportModel.period !== period) {
        alert(`Pick a ${view.choice} first.`);
        return;
    }
    const report = document.getElementById(view.hostId);
    const button = document.getElementById(view.buttonId);
    const previousLabel = button ? button.textContent : '';
    if (button) {
        button.disabled = true;
        button.textContent = 'Preparing PDF…';
    }
    try {
        const documentForPdf = await buildExactReportDocument(report);
        await downloadPdfFile({
            html: documentForPdf.html,
            filename: `management-update-${latestReportModel.fileKey}.pdf`,
            width: documentForPdf.width,
            height: documentForPdf.height
        });
    } catch (error) {
        const message = error && error.message ? error.message : 'The PDF could not be downloaded.';
        alert(message.includes('fetch') || message === 'Failed to fetch'
            ? 'Start the tracker with the Mac or Windows script, then export the PDF again.'
            : message);
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = previousLabel;
        }
    }
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

// ==================== DELETE DATA ====================

let deleteDataMode = 'period';

function dateInRange(value, range) {
    if (!value || !range) return false;
    const date = parseLocalDate(value);
    if (!date || Number.isNaN(date.getTime())) return false;
    return date >= range.start && date <= range.end;
}

function actionInRange(action, range) {
    if (dateInRange(action.dueDate, range)) return true;
    if (dateInRange(action.completedAt, range)) return true;
    if (!action.dueDate && dateInRange(action.createdAt, range)) return true;
    return false;
}

function deleteRange() {
    const kind = document.getElementById('deleteRangeKind').value;
    if (kind === 'day') {
        const value = document.getElementById('deleteDay').value;
        const day = parseLocalDate(value);
        if (!day || Number.isNaN(day.getTime())) return null;
        const start = startOfDay(day);
        return { start, end: endOfDay(start), label: formatDate(value) };
    }
    if (kind === 'week') {
        const value = document.getElementById('deleteWeek').value || '';
        if (!value.includes('-W')) return null;
        const [yearText, weekText] = value.split('-W');
        const start = getDateOfISOWeek(parseInt(weekText, 10), parseInt(yearText, 10));
        const end = endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
        return { start, end, label: `Week ${Number(weekText)}, ${yearText} (${formatWeekRange(start, end)})` };
    }
    if (kind === 'month') {
        const value = document.getElementById('deleteMonth').value || '';
        const match = /^(\d{4})-(\d{2})$/.exec(value);
        if (!match) return null;
        const year = Number(match[1]);
        const month = Number(match[2]);
        if (month < 1 || month > 12) return null;
        const start = new Date(year, month - 1, 1);
        const end = endOfDay(new Date(year, month, 0));
        return { start, end, label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) };
    }
    if (kind === 'year') {
        const year = Number(document.getElementById('deleteYear').value);
        if (!year || year < 2000 || year > 2100) return null;
        const start = new Date(year, 0, 1);
        const end = endOfDay(new Date(year, 11, 31));
        return { start, end, label: String(year) };
    }
    return null;
}

function recordsInDeleteRange(range) {
    const notes = appData.updates.filter(update => dateInRange(update.date, range));
    const tasks = appData.actions.filter(action => actionInRange(action, range));
    return { notes, tasks };
}

function deleteConfirmReady() {
    return document.getElementById('deleteConfirmText').value.trim().toLowerCase() === 'confirm';
}

function syncDeleteRangeFields() {
    const kind = document.getElementById('deleteRangeKind').value;
    document.getElementById('deleteDayField').hidden = kind !== 'day';
    document.getElementById('deleteWeekField').hidden = kind !== 'week';
    document.getElementById('deleteMonthField').hidden = kind !== 'month';
    document.getElementById('deleteYearField').hidden = kind !== 'year';
    previewDataDelete();
}

function previewDataDelete() {
    const summary = document.getElementById('deleteDataSummary');
    document.getElementById('deleteConfirmText').value = '';
    if (deleteDataMode === 'reset') {
        const notes = appData.updates.length;
        const tasks = appData.actions.length;
        const teams = appData.teams.length;
        summary.textContent = notes || tasks || teams
            ? `This deletes ${countWord(notes, 'note', 'notes')}, ${countWord(tasks, 'task', 'tasks')}, and ${countWord(teams, 'team', 'teams')}. Download a backup first if you still need any of it.`
            : 'There is nothing to delete.';
    } else {
        const range = deleteRange();
        if (!range) {
            const kind = document.getElementById('deleteRangeKind').value;
            summary.textContent = `Choose a ${kind}.`;
        } else {
            const { notes, tasks } = recordsInDeleteRange(range);
            summary.textContent = notes.length || tasks.length
                ? `${range.label}. This deletes ${countWord(notes.length, 'note', 'notes')} and ${countWord(tasks.length, 'task', 'tasks')} from that ${document.getElementById('deleteRangeKind').value}. Teams stay.`
                : `${range.label}. Nothing from this ${document.getElementById('deleteRangeKind').value} will be deleted.`;
        }
    }
    syncDeleteApproval();
}

function syncDeleteApproval() {
    const button = document.getElementById('deleteDataApprove');
    const hasSomething = deleteDataMode === 'reset'
        ? appData.updates.length + appData.actions.length + appData.teams.length > 0
        : (() => {
            const range = deleteRange();
            if (!range) return false;
            const found = recordsInDeleteRange(range);
            return found.notes.length + found.tasks.length > 0;
        })();
    button.disabled = !(deleteConfirmReady() && hasSomething);
    button.textContent = deleteDataMode === 'reset' ? 'Reset everything' : 'Delete';
}

function openDeletePeriodModal() {
    deleteDataMode = 'period';
    document.getElementById('deleteDataTitle').textContent = 'Delete a period';
    document.getElementById('deletePeriodFields').hidden = false;
    document.getElementById('deleteRangeKind').value = 'day';
    const now = new Date();
    document.getElementById('deleteDay').value = localDateString(now);
    const iso = getISOWeek(now);
    document.getElementById('deleteWeek').value = `${iso.year}-W${String(iso.week).padStart(2, '0')}`;
    document.getElementById('deleteMonth').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('deleteYear').value = now.getFullYear();
    syncDeleteRangeFields();
    openModal('deleteDataModal');
}

function openResetDataModal() {
    deleteDataMode = 'reset';
    document.getElementById('deleteDataTitle').textContent = 'Reset everything';
    document.getElementById('deletePeriodFields').hidden = true;
    previewDataDelete();
    openModal('deleteDataModal');
}

function refreshAfterDelete() {
    saveData();
    filterUpdates();
    filterActions();
    renderTeams();
    updateDashboard();
    populateTagSuggestions();
    if (lastSearchQuery) scheduleSearch();
}

function approveDataDelete(event) {
    event.preventDefault();
    if (!deleteConfirmReady()) return;
    if (deleteDataMode === 'reset') {
        if (!appData.updates.length && !appData.actions.length && !appData.teams.length) return;
        appData.updates = [];
        appData.actions = [];
        appData.teams = [];
        appData.tags = [];
    } else {
        const range = deleteRange();
        if (!range) return;
        const { notes, tasks } = recordsInDeleteRange(range);
        if (!notes.length && !tasks.length) return;
        const noteIds = new Set(notes.map(note => note.id));
        const taskIds = new Set(tasks.map(task => task.id));
        appData.updates = appData.updates.filter(note => !noteIds.has(note.id));
        appData.actions = appData.actions.filter(task => !taskIds.has(task.id));
    }
    refreshAfterDelete();
    closeModal('deleteDataModal');
}

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
                ensureDataShape();
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
    reader.onload = async (e) => {
        const text = String(e.target.result || '');
        const trimmed = text.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            alert('This file is a JSON backup. Use Restore Backup for JSON files. Upload Notes reads the text template.');
            return;
        }

        const parsed = await parseUploadedNotes(text);
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

const ASK_FIELDS = {
    week: ['askWeek', 'askWeekAnswer', 'copyAskWeek'],
    month: ['askMonth', 'askMonthAnswer', 'copyAskMonth'],
    quarter: ['askQuarter', 'askQuarterAnswer', 'copyAskQuarter'],
    year: ['askYear', 'askYearAnswer', 'copyAskYear']
};

let aiStatus = { chat: false, embed: false };
let noteVectors = { vectors: {} };
let relatedRequest = 0;
let relatedQueued = null;
let relatedRunning = false;
let embedTimer = null;
let embedPromise = null;

async function loadAiSupport() {
    try {
        const [statusResponse, vectorResponse] = await Promise.all([
            fetch('/api/ai/status', { cache: 'no-store' }),
            fetch('/api/embeddings', { cache: 'no-store' })
        ]);
        aiStatus = statusResponse.ok ? await statusResponse.json() : { chat: false, embed: false };
        const stored = vectorResponse.ok ? await vectorResponse.json() : { vectors: {} };
        noteVectors = stored && stored.vectors ? stored : { vectors: {} };
    } catch (error) {
        aiStatus = { chat: false, embed: false };
        noteVectors = { vectors: {} };
    }
    scheduleEmbedUpdates();
}

async function postAi(path, payload) {
    let response;
    try {
        response = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        const failure = new Error('offline');
        failure.reason = 'The tracker server is not running. Start it with the Mac or Windows script, then try again.';
        throw failure;
    }
    let body = {};
    try {
        body = await response.json();
    } catch (error) {
        body = {};
    }
    if (!response.ok) {
        const failure = new Error('fallback');
        failure.reason = body.reason || 'The assistant is unavailable. Use Copy for Email for the full report.';
        throw failure;
    }
    return body;
}

function noteEmbedText(update) {
    const team = appData.teams.find(item => item.id === update.teamId);
    return [update.description, team ? team.name : '', update.people, update.jira, ...(update.tags || [])]
        .filter(Boolean)
        .join(' ');
}

function textHash(value) {
    let hash = 5381;
    const text = String(value);
    for (let index = 0; index < text.length; index++) {
        hash = ((hash << 5) + hash) + text.charCodeAt(index);
    }
    return (hash >>> 0).toString(16);
}

function scheduleEmbedUpdates() {
    if (!aiStatus.embed) return;
    clearTimeout(embedTimer);
    embedTimer = setTimeout(embedMissingNotes, 600);
}

function embedMissingNotes() {
    if (!aiStatus.embed) return Promise.resolve();
    if (!embedPromise) {
        embedPromise = embedMissingNotesNow().finally(() => {
            embedPromise = null;
        });
    }
    return embedPromise;
}

async function embedMissingNotesNow() {
    const pending = appData.updates.filter(update => {
        const text = noteEmbedText(update);
        const stored = noteVectors.vectors[update.id];
        return text && (!stored || stored.hash !== textHash(text));
    }).slice(0, 16);
    if (!pending.length) return;
    const texts = pending.map(noteEmbedText);
    let embeddings;
    try {
        const body = await postAi('/api/ai/embed', { input: texts });
        embeddings = body.embeddings;
    } catch (error) {
        return;
    }
    if (!Array.isArray(embeddings) || embeddings.length !== pending.length) return;
    pending.forEach((update, index) => {
        noteVectors.vectors[update.id] = { hash: textHash(texts[index]), vector: embeddings[index] };
    });
    try {
        await postAi('/api/embeddings', { vectors: noteVectors.vectors });
    } catch (error) {
        return;
    }
}

function cosineSimilarity(left, right) {
    const length = Math.min(left.length, right.length);
    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    for (let index = 0; index < length; index++) {
        dot += left[index] * right[index];
        leftNorm += left[index] * left[index];
        rightNorm += right[index] * right[index];
    }
    if (!leftNorm || !rightNorm) return 0;
    return dot / Math.sqrt(leftNorm * rightNorm);
}

function scheduleRelatedNotes(query, shownIds) {
    const host = document.getElementById('relatedNotes');
    if (!host) return;
    if (!aiStatus.embed || shownIds.length >= 3) {
        relatedRequest += 1;
        host.innerHTML = '';
        return;
    }
    relatedQueued = { query, shownIds: shownIds.slice(), request: ++relatedRequest };
    host.innerHTML = '';
    if (!relatedRunning) drainRelatedNotes();
}

async function drainRelatedNotes() {
    relatedRunning = true;
    try {
    while (relatedQueued) {
        const job = relatedQueued;
        relatedQueued = null;
        try {
            await embedMissingNotes();
            if (job.request !== relatedRequest) continue;
            const body = await postAi('/api/ai/embed', { input: [job.query] });
            if (job.request !== relatedRequest) continue;
            const vector = body.embeddings && body.embeddings[0];
            if (!Array.isArray(vector)) continue;
            const shown = new Set(job.shownIds);
            const related = appData.updates.map(update => {
                const stored = noteVectors.vectors[update.id];
                if (!stored || shown.has(update.id)) return null;
                const score = cosineSimilarity(vector, stored.vector);
                return score >= 0.45 ? { update, score } : null;
            }).filter(Boolean).sort((left, right) => right.score - left.score).slice(0, 5);
            const current = document.getElementById('relatedNotes');
            if (job.request !== relatedRequest || !current || !related.length) continue;
            current.innerHTML = `
                <div class="search-section">
                    <h4>Related notes (${related.length})</h4>
                    ${related.map(row => {
                        const team = appData.teams.find(item => item.id === row.update.teamId);
                        return `
                            <div class="search-item" onclick="openUpdateFromSearch('${row.update.id}')">
                                <strong>${escapeHtml(row.update.description)}</strong>
                                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                                    ${formatDate(row.update.date, 'short')}
                                    ${team ? ` • ${escapeHtml(team.name)}` : ''}
                                    ${row.update.people ? ` • ${escapeHtml(row.update.people)}` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } catch (error) {
            const current = document.getElementById('relatedNotes');
            if (job.request === relatedRequest && current) current.innerHTML = '';
        }
    }
    } finally {
        relatedRunning = false;
        if (relatedQueued) drainRelatedNotes();
    }
}

async function askReport(period) {
    const fields = ASK_FIELDS[period];
    const input = document.getElementById(fields[0]);
    const answer = document.getElementById(fields[1]);
    const copy = document.getElementById(fields[2]);
    const question = input.value.trim();
    if (!question) return;
    generatePeriodReport(period);
    answer.hidden = false;
    copy.disabled = true;
    if (!latestReportModel || latestReportModel.period !== period) {
        answer.textContent = 'Choose a period first. The report itself is unchanged.';
        return;
    }
    answer.textContent = 'Reading this report…';
    try {
        const body = await postAi('/api/ai/ask', {
            question,
            report: buildWeeklyEmail(latestReportModel)
        });
        answer.textContent = body.answer || body.reason || 'The assistant is unavailable. Use Copy for Email for the full report.';
        copy.disabled = !body.answer;
        if (body.answer) aiStatus.chat = true;
    } catch (error) {
        answer.textContent = error.reason || 'The assistant is unavailable. Use Copy for Email for the full report.';
        copy.disabled = true;
    }
}

function copyAskAnswer(period) {
    const fields = ASK_FIELDS[period];
    const answer = document.getElementById(fields[1]);
    const copy = document.getElementById(fields[2]);
    const text = answer.textContent.trim();
    if (!text || copy.disabled) return;
    navigator.clipboard.writeText(text).then(() => {
        copy.textContent = 'Copied';
        setTimeout(() => {
            copy.textContent = 'Copy answer';
        }, 1500);
    }).catch(() => {
        copy.textContent = 'Copy failed';
    });
}

async function fileUpdateWithAI() {
    const description = document.getElementById('updateDescription').value.trim();
    const status = document.getElementById('fileUpdateStatus');
    if (!description) {
        status.textContent = 'Write the description first.';
        return;
    }
    status.textContent = 'Reading the description…';
    try {
        const body = await postAi('/api/ai/file-note', {
            description,
            teams: appData.teams.map(team => team.name)
        });
        const applied = applyFiledNote(body.fields || {});
        status.textContent = applied
            ? 'Filled from the description. Nothing is saved until you click Save.'
            : 'Nothing in the description matched a team, person, ticket, status, or target date. The form was left as you typed it.';
        if (applied) aiStatus.chat = true;
    } catch (error) {
        status.textContent = error.reason || 'The assistant is unavailable, so the form was left as you typed it.';
    }
}

function applyFiledNote(fields) {
    let applied = false;
    if (fields.team) {
        const select = document.getElementById('updateTeam');
        const match = Array.from(select.options).find(option => option.textContent.trim().toLowerCase() === fields.team.toLowerCase());
        if (match) {
            select.value = match.value;
            applied = true;
        }
    }
    if (fields.people) {
        document.getElementById('updatePeople').value = fields.people;
        applied = true;
    }
    if (fields.jira) {
        document.getElementById('updateJira').value = fields.jira;
        applied = true;
    }
    if (fields.status && document.querySelector(`#updateStatus option[value="${fields.status}"]`)) {
        document.getElementById('updateStatus').value = fields.status;
        applied = true;
    }
    if (fields.targetDate) {
        document.getElementById('updateTargetDate').value = fields.targetDate;
        applied = true;
    }
    if (fields.category && document.querySelector(`#updateCategory option[value="${fields.category}"]`)) {
        document.getElementById('updateCategory').value = fields.category;
        applied = true;
    }
    return applied;
}

async function parseUploadedNotes(text) {
    try {
        const body = await postAi('/api/ai/parse-notes', { text });
        const parsed = body.parsed;
        if (parsed && (parsed.updates.length || parsed.actions.length || parsed.teams.length)) {
            aiStatus.chat = true;
            return parsed;
        }
    } catch (error) {
        return parseTextImport(text);
    }
    return parseTextImport(text);
}

function applyTextImportPlan(plan) {
    if (!appData.tags) appData.tags = [];

    plan.newTeams.forEach(team => {
        appData.teams.push({
            id: generateId(),
            name: team.name,
            description: team.description || '',
            members: team.members || '',
            targetDate: team.targetDate || '',
            jira: team.jira || '',
            status: team.status || '',
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
            targetDate: update.targetDate || '',
            jira: update.jira || '',
            status: update.status || '',
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
    
    if (!updates.length) {
        container.innerHTML = '<p class="empty-state" style="padding: 40px;">No updates for this period</p>';
        return;
    }

    const maxValue = Math.max(...Object.values(categoryCount), 1);
    
    container.innerHTML = `
        <div class="horizontal-chart">
            ${Object.entries(categoryCount).sort((a, b) => b[1] - a[1]).map(([cat, count]) => `
                <div class="horizontal-bar-row">
                    <div class="horizontal-bar-label">${escapeHtml(cat)}</div>
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
                    color: safeColor(team.color)
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
                    <div class="horizontal-bar-label">${escapeHtml(name)}</div>
                    <div class="horizontal-bar-track">
                        <div class="horizontal-bar-fill" style="width: ${(data.count / maxValue) * 100}%; background: ${safeColor(data.color)}">
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
            <div class="top-list-name">${escapeHtml(name)}</div>
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
        return `<span class="cloud-tag size-${size}" onclick="searchByTag(decodeURIComponent('${encodeURIComponent(tag)}'))">#${escapeHtml(tag)} (${count})</span>`;
    }).join('');
}

// ==================== EMAIL REPORT ====================

function teamReportSubtitle(pack) {
    const peopleLine = namedPeople(pack).join(', ') || 'No people named';
    return [pack.team && pack.team.description, peopleLine, targetPhrase(pack.team && pack.team.targetDate), jiraPhrase(pack.team && pack.team.jira), statusPhrase(pack.team && pack.team.status)].filter(Boolean).join(' · ');
}

function quietTeamLabel(pack) {
    const extras = [targetPhrase(pack.team && pack.team.targetDate), jiraPhrase(pack.team && pack.team.jira), statusPhrase(pack.team && pack.team.status)].filter(Boolean);
    return extras.length ? `${pack.team.name} (${extras.join(', ')})` : pack.team.name;
}

function emailActionLine(action, weekEnd, finished) {
    const status = finished ? 'Done' : reportStatusLabel(action.status);
    const bits = finished
        ? [splitOwnerNames(action.owner).join(', ') || 'Unassigned', action.completedAt ? `finished ${formatDate(action.completedAt, 'short')}` : '', targetPhrase(action.dueDate), jiraPhrase(action.jira)].filter(Boolean)
        : workBits(action, weekEnd);
    const detail = actionDetail(action);
    return `• ${status} · ${action.title}\n  ${bits.join(' · ')}${detail ? `\n  ${detail}` : ''}`;
}

function emailUpdateLine(update) {
    const meta = [formatDate(update.date, 'short'), reportCategoryLabel(update.category), splitOwnerNames(update.people).join(', ') || 'No people named', targetPhrase(update.targetDate), jiraPhrase(update.jira), statusPhrase(update.status), (update.tags || []).map(tag => `#${tag}`).join(' ')].filter(Boolean);
    return `• ${meta.join(' · ')}\n  ${update.description || 'Untitled note'}`;
}

function emailTeamSection(title, subtitle, pack, model) {
    const lines = ['', title.toUpperCase(), subtitle];
    const blockers = pack.open.filter(action => action.status === 'blocked').length;
    lines.push(`${countWord(pack.updates.length, 'note', 'notes')} · ${countWord(pack.open.length, 'open task', 'open tasks')} · ${countWord(pack.done.length, 'finished', 'finished')}${blockers ? ` · ${countWord(blockers, 'blocker', 'blockers')}` : ''}`);
    const periodName = model.periodName || 'week';
    lines.push('', 'Timeline');
    timelineBuckets(pack.updates, model, update => update.date).forEach(day => {
        lines.push(`${day.caption}: ${day.count}`);
    });
    lines.push('', 'What happened');
    if (!pack.updates.length) lines.push(`• No new notes this ${periodName}.`);
    pack.updates.forEach(update => lines.push(emailUpdateLine(update)));
    if ((pack.carried || []).length) {
        lines.push('', 'Still in progress');
        lines.push('Logged earlier, and still open in this period.');
        pack.carried.forEach(update => lines.push(emailUpdateLine(update)));
    }
    if ((pack.showcase || []).length) {
        lines.push('', 'Latest work to show');
        lines.push('Nothing new was logged in this period. These are the latest updates.');
        pack.showcase.forEach(update => lines.push(emailUpdateLine(update)));
    }
    lines.push('', 'Who is working on what');
    if (!pack.open.length) lines.push(`• No open tasks this ${periodName}.`);
    pack.open.forEach(action => lines.push(emailActionLine(action, model.weekEnd, false)));
    if (pack.done.length) {
        lines.push('', `Finished this ${periodName}`);
        pack.done.forEach(action => lines.push(emailActionLine(action, model.weekEnd, true)));
    }
    return lines.join('\n');
}

function buildWeeklyEmail(model) {
    const buckets = bucketByTeam(model);
    const people = peopleThisWeek(model);
    const meetings = model.updates.filter(update => update.category === 'meeting').length;
    const reviews = model.updates.filter(update => update.category === 'review').length;
    const inProgress = model.openActions.filter(action => action.status === 'in-progress').length;
    const blockers = model.openActions.filter(action => action.status === 'blocked');
    const lines = [
        'MANAGEMENT UPDATE',
        model.label,
        model.range,
        '',
        managementLead(model, buckets, people),
        '',
        'SNAPSHOT',
        `Notes: ${model.updates.length}`,
        `Finished: ${model.doneActions.length}`,
        `In progress: ${inProgress}`,
        `Blockers: ${blockers.length}`,
        `Meetings: ${meetings}`,
        `PR reviews: ${reviews}`,
        '',
        `THIS ${(model.periodName || 'week').toUpperCase()} AT A GLANCE`
    ];
    insightTiles(model, buckets, people).forEach(tile => {
        lines.push(`${tile.kicker}: ${tile.title}`);
        lines.push(`  ${tile.detail}`);
    });
    lines.push('', 'WHEN THE WORK HAPPENED');
    timelineBuckets(model.updates, model, update => update.date).forEach(day => {
        lines.push(`${day.caption}: ${day.count}`);
    });
    lines.push('', 'NEEDS ATTENTION');
    if (!blockers.length) lines.push('• No blockers are open.');
    blockers.forEach(action => {
        const bits = [action.owner || 'Unassigned', action.teamName, duePhrase(action, model.weekEnd), jiraPhrase(action.jira), actionDetail(action)].filter(Boolean);
        lines.push(`• ${action.title}`);
        lines.push(`  ${bits.join(' · ')}`);
    });
    lines.push('', 'WHO WAS INVOLVED');
    if (!people.length) lines.push('• No people were named.');
    people.forEach(person => {
        const otherOpen = person.open - person.blocked;
        const bits = [];
        if (person.blocked) bits.push(countWord(person.blocked, 'blocked', 'blocked'));
        if (otherOpen > 0) bits.push(countWord(otherOpen, 'open', 'open'));
        if (person.done) bits.push(countWord(person.done, 'finished', 'finished'));
        if (person.notes) bits.push(countWord(person.notes, 'note', 'notes'));
        const teams = [...person.teams].join(', ');
        lines.push(`• ${person.name}${teams ? ` · ${teams}` : ''} · ${bits.join(' · ')}`);
    });
    buckets.active.forEach(pack => {
        lines.push(emailTeamSection(pack.team.name, teamReportSubtitle(pack), pack, model));
    });
    const looseHas = buckets.loose.updates.length || (buckets.loose.carried || []).length || (buckets.loose.showcase || []).length || buckets.loose.open.length || buckets.loose.done.length;
    if (looseHas) {
        lines.push(emailTeamSection('Not tagged to a team', 'These notes and tasks have no team, so they are easy to miss.', { ...buckets.loose, team: { members: '' } }, model));
    }
    const periodName = model.periodName || 'week';
    if (!buckets.active.length && !looseHas) lines.push('', `No team had notes or open work in this ${periodName}.`);
    if (buckets.quiet.length) {
        lines.push('', `QUIET THIS ${periodName.toUpperCase()}`);
        lines.push(`${joinNames(buckets.quiet.map(quietTeamLabel))} had no notes and no open work in this ${periodName}.`);
    }
    lines.push('', `Prepared from the daily tracker · ${new Date().toLocaleString()}`);
    return lines.join('\n');
}

function copyReportToClipboard(period = 'week') {
    const view = REPORT_VIEWS[period] || REPORT_VIEWS.week;
    generatePeriodReport(period);
    if (!latestReportModel || latestReportModel.period !== period) {
        alert(`Pick a ${view.choice} first.`);
        return;
    }
    const report = buildWeeklyEmail(latestReportModel);
    const notify = () => alert('Report copied. Paste it into your email.');
    const fallbackCopy = () => {
        const textarea = document.createElement('textarea');
        textarea.value = report;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        notify();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(report).then(notify).catch(fallbackCopy);
    } else {
        fallbackCopy();
    }
}
