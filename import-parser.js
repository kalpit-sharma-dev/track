// Plain-text notes import. Additive only: callers must not replace existing records.
// A block is one team, one daily update, or one action item.
// Blocks are separated by a line that is only "---".
// Sections start with === TEAMS ===, === UPDATES ===, or === ACTIONS ===.

const IMPORT_FIELDS = [
    'NAME', 'DESCRIPTION', 'MEMBERS', 'COLOR',
    'DATE', 'CATEGORY', 'TEAM', 'PEOPLE', 'TAGS', 'TEXT',
    'TITLE', 'OWNER', 'PRIORITY', 'STATUS', 'DUE', 'JIRA', 'RECURRING', 'NOTES'
];

const CATEGORY_ALIASES = {
    meeting: 'meeting',
    discussion: 'discussion',
    review: 'review',
    'pr review': 'review',
    'pr': 'review',
    approval: 'approval',
    audit: 'audit',
    planning: 'planning',
    issue: 'issue',
    'issue resolution': 'issue',
    other: 'other'
};

const STATUS_ALIASES = {
    pending: 'pending',
    'in-progress': 'in-progress',
    'in progress': 'in-progress',
    wip: 'in-progress',
    completed: 'completed',
    done: 'completed',
    blocked: 'blocked'
};

const PRIORITY_ALIASES = {
    high: 'high',
    urgent: 'high',
    medium: 'medium',
    med: 'medium',
    low: 'low'
};

const MONTHS = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

function pad2(n) {
    return String(n).padStart(2, '0');
}

function ymd(year, monthIndex, day) {
    return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function parseFlexibleDate(input) {
    if (!input || !String(input).trim()) return null;
    const s = String(input).trim();

    let match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
        return ymd(year, month - 1, day);
    }

    match = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
    if (match) {
        const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
        const day = Number(match[1]);
        const year = Number(match[3]);
        if (month === undefined || day < 1 || day > 31) return null;
        return ymd(year, month, day);
    }

    match = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})$/);
    if (match) {
        const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
        const day = Number(match[1]);
        const year = new Date().getFullYear();
        if (month === undefined || day < 1 || day > 31) return null;
        return ymd(year, month, day);
    }

    match = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (match) {
        const day = Number(match[1]);
        const month = Number(match[2]);
        const year = Number(match[3]);
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
        return ymd(year, month - 1, day);
    }

    return null;
}

function parseBlock(lines) {
    const fields = {};
    let currentKey = null;

    lines.forEach(line => {
        const match = line.match(/^([A-Za-z][A-Za-z ]{0,20}):\s*(.*)$/);
        const key = match ? match[1].trim().toUpperCase() : null;
        if (key && IMPORT_FIELDS.includes(key)) {
            currentKey = key;
            fields[currentKey] = match[2];
        } else if (currentKey) {
            fields[currentKey] += (fields[currentKey] ? '\n' : '') + line;
        }
    });

    Object.keys(fields).forEach(key => {
        fields[key] = fields[key].trim();
    });
    return fields;
}

function parseTextImport(text) {
    const source = String(text || '');
    if (!/^===\s*(TEAMS|UPDATES|ACTIONS)\s*===\s*$/im.test(source)) {
        return parseSimpleNotes(source);
    }
    return parseStructuredImport(source);
}

function parseSimpleNotes(text) {
    const result = { teams: [], updates: [], actions: [], errors: [] };
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    let mode = 'notes';
    let currentDate = null;

    lines.forEach((line, index) => {
        const lineNo = index + 1;
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        const heading = trimmed.replace(/:$/, '').toLowerCase();
        if (['tasks', 'task', 'to do', 'action items', 'actions'].includes(heading)) {
            mode = 'tasks';
            return;
        }
        if (heading === 'teams' || heading === 'team') {
            mode = 'teams';
            return;
        }
        if (['notes', 'updates', 'what happened'].includes(heading)) {
            mode = 'notes';
            return;
        }

        const dateLabel = trimmed.match(/^date:\s*(.+)$/i);
        const date = parseFlexibleDate(dateLabel ? dateLabel[1] : trimmed);
        if (date && !/^[-*•]/.test(trimmed)) {
            currentDate = date;
            mode = 'notes';
            return;
        }

        const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
        const content = bullet ? bullet[1].trim() : trimmed;
        if (!content) return;
        const parsedLine = splitSimpleDetails(content);

        if (mode === 'teams') {
            if (!parsedLine.text) {
                result.errors.push(`Line ${lineNo}: write the team name before the | mark.`);
                return;
            }
            result.teams.push({
                line: lineNo,
                name: parsedLine.text,
                description: '',
                members: parsedLine.details.people || '',
                color: '#6366F1'
            });
            return;
        }

        if (mode === 'tasks') {
            if (!parsedLine.text) {
                result.errors.push(`Line ${lineNo}: write the task before the | mark.`);
                return;
            }
            const due = parsedLine.details.due ? parseFlexibleDate(parsedLine.details.due) : '';
            if (parsedLine.details.due && !due) {
                result.errors.push(`Line ${lineNo}: the due date "${parsedLine.details.due}" could not be read. Use 21 Nov 2026.`);
                return;
            }
            result.actions.push({
                line: lineNo,
                title: parsedLine.text,
                description: parsedLine.details.notes || '',
                owner: parsedLine.details.who || 'Me',
                priority: normalizePriority(parsedLine.details.urgent),
                status: normalizeStatus(parsedLine.details.status),
                dueDate: due || '',
                teamName: parsedLine.details.team || '',
                jira: parsedLine.details.ticket || '',
                recurring: normalizeRecurring(parsedLine.details.repeats),
                notes: parsedLine.details.notes || ''
            });
            return;
        }

        if (!currentDate) {
            result.errors.push(`Line ${lineNo}: write a date first, on its own line, such as 17 Nov 2026.`);
            return;
        }
        const category = guessCategory(parsedLine.text, parsedLine.details.type);
        result.updates.push({
            line: lineNo,
            date: currentDate,
            category: category.value,
            categoryWarning: category.warning,
            teamName: parsedLine.details.team || '',
            people: parsedLine.details.people || '',
            tags: splitList(parsedLine.details.tags).map(tag => tag.toLowerCase()),
            description: parsedLine.text
        });
    });

    return result;
}

const SIMPLE_DETAIL_KEYS = {
    team: 'team',
    people: 'people',
    with: 'people',
    type: 'type',
    category: 'type',
    tags: 'tags',
    who: 'who',
    owner: 'who',
    urgent: 'urgent',
    priority: 'urgent',
    due: 'due',
    ticket: 'ticket',
    jira: 'ticket',
    status: 'status',
    notes: 'notes',
    repeats: 'repeats',
    repeat: 'repeats'
};

function splitSimpleDetails(content) {
    const details = {};
    const textParts = [];
    content.split('|').forEach(part => {
        const piece = part.trim();
        if (!piece) return;
        const match = piece.match(/^([A-Za-z ]{2,20}):\s*(.*)$/);
        const key = match ? SIMPLE_DETAIL_KEYS[match[1].trim().toLowerCase()] : null;
        if (key) details[key] = match[2].trim();
        else textParts.push(piece);
    });
    return { text: textParts.join(' '), details };
}

function guessCategory(text, explicit) {
    if (explicit && explicit.trim()) return normalizeCategory(explicit);
    const value = text.toLowerCase();
    if (/\b(pr|pull request|code review)\b/.test(value) || value.includes('pull requests')) return { value: 'review', warning: '' };
    if (/\baudit\b/.test(value)) return { value: 'audit', warning: '' };
    if (/\b(meeting|call)\b/.test(value)) return { value: 'meeting', warning: '' };
    if (/\bapprov/.test(value)) return { value: 'approval', warning: '' };
    if (/\b(plan|planning)\b/.test(value)) return { value: 'planning', warning: '' };
    if (/\b(issue|bug|error)\b/.test(value)) return { value: 'issue', warning: '' };
    return { value: 'discussion', warning: '' };
}

function parseStructuredImport(text) {
    const result = { teams: [], updates: [], actions: [], errors: [] };
    const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    let section = null;
    let block = [];
    let blockStart = 1;

    function flush(endLine) {
        const content = block.join('\n').trim();
        const start = blockStart;
        block = [];
        if (!content) return;
        if (!section) {
            result.errors.push(`Line ${start}: add a section heading (=== TEAMS ===, === UPDATES ===, or === ACTIONS ===) before this block.`);
            return;
        }

        const fields = parseBlock(content.split('\n'));
        if (section === 'TEAMS') {
            if (!fields.NAME) {
                result.errors.push(`Line ${start}: team block is missing NAME.`);
                return;
            }
            result.teams.push({
                line: start,
                name: fields.NAME,
                description: fields.DESCRIPTION || '',
                members: fields.MEMBERS || '',
                color: normalizeColor(fields.COLOR)
            });
            return;
        }

        if (section === 'UPDATES') {
            const date = parseFlexibleDate(fields.DATE);
            if (!fields.DATE || !date) {
                result.errors.push(`Line ${start}: update needs a DATE such as 2026-11-17 or 17 Nov 2026.`);
                return;
            }
            if (!fields.TEXT) {
                result.errors.push(`Line ${start}: update needs TEXT.`);
                return;
            }
            const category = normalizeCategory(fields.CATEGORY);
            result.updates.push({
                line: start,
                date,
                category: category.value,
                categoryWarning: category.warning,
                teamName: fields.TEAM || '',
                people: fields.PEOPLE || '',
                tags: splitList(fields.TAGS).map(tag => tag.toLowerCase()),
                description: fields.TEXT
            });
            return;
        }

        if (section === 'ACTIONS') {
            if (!fields.TITLE) {
                result.errors.push(`Line ${start}: action block is missing TITLE.`);
                return;
            }
            if (!fields.OWNER) {
                result.errors.push(`Line ${start}: action "${fields.TITLE}" is missing OWNER.`);
                return;
            }
            const due = fields.DUE ? parseFlexibleDate(fields.DUE) : '';
            if (fields.DUE && !due) {
                result.errors.push(`Line ${start}: action "${fields.TITLE}" has a DUE date that could not be read.`);
                return;
            }
            result.actions.push({
                line: start,
                title: fields.TITLE,
                description: fields.NOTES || '',
                owner: fields.OWNER,
                priority: normalizePriority(fields.PRIORITY),
                status: normalizeStatus(fields.STATUS),
                dueDate: due || '',
                teamName: fields.TEAM || '',
                jira: fields.JIRA || '',
                recurring: normalizeRecurring(fields.RECURRING),
                notes: fields.NOTES || ''
            });
        }
    }

    lines.forEach((line, index) => {
        const lineNo = index + 1;
        const trimmed = line.trim();
        if (/^===\s*(TEAMS|UPDATES|ACTIONS)\s*===$/i.test(trimmed)) {
            flush(lineNo);
            section = trimmed.replace(/=/g, '').trim().toUpperCase();
            blockStart = lineNo + 1;
            return;
        }
        if (trimmed === '---') {
            flush(lineNo);
            blockStart = lineNo + 1;
            return;
        }
        if (!block.length && (trimmed === '' || trimmed.startsWith('#'))) {
            blockStart = lineNo + 1;
            return;
        }
        if (!block.length) blockStart = lineNo;
        block.push(line);
    });
    flush(lines.length + 1);

    return result;
}

function normalizeColor(value) {
    if (!value) return '#6366F1';
    const color = value.trim();
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : '#6366F1';
}

function normalizeCategory(value) {
    const key = (value || 'discussion').trim().toLowerCase();
    if (CATEGORY_ALIASES[key]) return { value: CATEGORY_ALIASES[key], warning: '' };
    return { value: 'other', warning: `Unknown category "${value}" was saved as other.` };
}

function normalizeStatus(value) {
    const key = (value || 'pending').trim().toLowerCase();
    return STATUS_ALIASES[key] || 'pending';
}

function normalizePriority(value) {
    const key = (value || 'medium').trim().toLowerCase();
    return PRIORITY_ALIASES[key] || 'medium';
}

function normalizeRecurring(value) {
    const key = (value || '').trim().toLowerCase();
    if (['daily', 'weekly', 'biweekly', 'bi-weekly', 'monthly'].includes(key)) {
        return key === 'bi-weekly' ? 'biweekly' : key;
    }
    return '';
}

function splitList(value) {
    if (!value) return [];
    return value.split(',').map(part => part.trim()).filter(Boolean);
}

function sameText(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function planTextImport(data, parsed) {
    const teams = (data.teams || []).map(team => ({
        name: team.name,
        members: splitList(team.members)
    }));
    const knownUpdates = new Set((data.updates || []).map(update => `${update.date}::${update.description.trim().toLowerCase()}`));
    const knownActions = new Set((data.actions || []).map(action => `${action.title.trim().toLowerCase()}::${action.owner.trim().toLowerCase()}`));

    const plan = {
        newTeams: [],
        memberAdds: [],
        newUpdates: [],
        newActions: [],
        skippedUpdates: 0,
        skippedActions: 0,
        skippedTeams: 0,
        warnings: [],
        errors: parsed.errors.slice()
    };

    function findTeam(name) {
        return teams.find(team => sameText(team.name, name));
    }

    parsed.teams.forEach(team => {
        const existing = findTeam(team.name);
        if (!existing) {
            const members = splitList(team.members);
            teams.push({ name: team.name, members: members.slice() });
            plan.newTeams.push(team);
            return;
        }
        plan.skippedTeams += 1;
        const additions = splitList(team.members).filter(member => !existing.members.some(current => sameText(current, member)));
        if (additions.length) {
            existing.members.push(...additions);
            plan.memberAdds.push({ teamName: existing.name, members: additions });
        }
        plan.warnings.push(`Team "${existing.name}" already exists, so its name, description, and color were left unchanged.`);
    });

    parsed.updates.forEach(update => {
        if (update.categoryWarning) plan.warnings.push(`Line ${update.line}: ${update.categoryWarning}`);
        const key = `${update.date}::${update.description.trim().toLowerCase()}`;
        if (knownUpdates.has(key)) {
            plan.skippedUpdates += 1;
            return;
        }
        knownUpdates.add(key);
        if (update.teamName && !findTeam(update.teamName)) {
            teams.push({ name: update.teamName, members: [] });
            plan.newTeams.push({
                line: update.line,
                name: update.teamName,
                description: '',
                members: '',
                color: '#6366F1',
                createdFrom: 'update'
            });
        }
        plan.newUpdates.push(update);
    });

    parsed.actions.forEach(action => {
        const key = `${action.title.trim().toLowerCase()}::${action.owner.trim().toLowerCase()}`;
        if (knownActions.has(key)) {
            plan.skippedActions += 1;
            return;
        }
        knownActions.add(key);
        if (action.teamName && !findTeam(action.teamName)) {
            teams.push({ name: action.teamName, members: [] });
            plan.newTeams.push({
                line: action.line,
                name: action.teamName,
                description: '',
                members: '',
                color: '#6366F1',
                createdFrom: 'action'
            });
        }
        plan.newActions.push(action);
    });

    return plan;
}

const IMPORT_TEMPLATE = `# Daily notes
#
# How to fill this in
# 1. Write the date on its own line, such as 17 Nov 2026. The year is optional.
# 2. Write a dash, then what you did.
# 3. Under Tasks, write a dash and the task. Add Who: and the person's name.
# 4. Extra details are optional. Add them after a | mark.
#    Team:    People:    Type:    Urgent:    Due:    Ticket:
# 5. Save this file, then click Upload Notes in the app.
#    Upload adds these notes. It does not change notes you already saved.
# 6. Delete the sample lines and write your own.

Teams
- Performance Pod | People: Murthy, Rajesh

17 Nov 2026
- Talked with the perf SRE team about golang monitoring | Team: Performance Pod | People: Murthy, Rajesh | Tags: golang, monitoring

18 Nov 2026
- Reviewed 4-5 pull requests for AI Banking | Team: Drishti AI | Type: PR review | People: Chandan

19 Nov 2026
- Checkmarx discussion with Saman for the R12 release | Type: Audit | People: Saman

Tasks
- Set up SonarQube on Jenkins | Who: Pratap, Adhika, Chandan | Ticket: RITM8019234 | Team: Drishti AI | Due: 25 Nov 2026
- Priority for tech backlog | Who: Shyam | Urgent: High | Due: 21 Nov 2026 | Status: In progress
`;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseFlexibleDate,
        parseTextImport,
        planTextImport,
        IMPORT_TEMPLATE
    };
}
