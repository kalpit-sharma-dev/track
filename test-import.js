const assert = require('assert');
const { parseFlexibleDate, parseTextImport, planTextImport, IMPORT_TEMPLATE } = require('./import-parser');

assert.strictEqual(parseFlexibleDate('2026-11-17'), '2026-11-17');
assert.strictEqual(parseFlexibleDate('17 Nov 2026'), '2026-11-17');
assert.strictEqual(parseFlexibleDate('17/11/2026'), '2026-11-17');
assert.strictEqual(parseFlexibleDate('not a date'), null);

const namedColors = parseTextImport([
    'Teams',
    '- Deposits | Color: Green',
    '- MFA | Color: orange',
    '- Drishti AI | Color: Purple',
    '- CQRS | Color: Pink',
    '- Techbacklog | Color: Blue'
].join('\n'));
assert.deepStrictEqual(namedColors.teams.map(team => team.color), [
    '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#4F46E5'
]);

const parsed = parseTextImport(IMPORT_TEMPLATE);
assert.strictEqual(parsed.errors.length, 0, parsed.errors.join('\n'));
assert.strictEqual(parsed.teams.length, 1);
assert.strictEqual(parsed.teams[0].name, 'Performance Pod');
assert.strictEqual(parsed.teams[0].description, 'App performance and reliability');
assert.strictEqual(parsed.teams[0].members, 'Murthy, Rajesh');
assert.strictEqual(parsed.teams[0].color, '#EF4444');
assert.strictEqual(parsed.teams[0].targetDate, '2026-11-30');
assert.strictEqual(parsed.teams[0].jira, 'PERF-120');
assert.strictEqual(parsed.updates.length, 7);
assert.ok(parsed.updates.every(update => update.teamName === 'Performance Pod'));
assert.deepStrictEqual(parsed.updates.map(update => update.category), [
    'discussion', 'meeting', 'review', 'approval', 'audit', 'planning', 'issue'
]);
assert.deepStrictEqual(parsed.updates[0].tags, ['golang', 'monitoring']);
assert.strictEqual(parsed.updates[0].targetDate, '2026-11-25');
assert.strictEqual(parsed.updates[0].jira, 'RITM8019400');
assert.strictEqual(parsed.updates[1].targetDate, '');
assert.strictEqual(parsed.updates[1].jira, '');
assert.strictEqual(parsed.actions.length, 4);
assert.ok(parsed.actions.every(action => action.teamName === 'Performance Pod'));
assert.strictEqual(parsed.actions[0].jira, 'RITM8019234');
assert.strictEqual(parsed.actions[0].title, 'Fix golang service monitoring');
assert.strictEqual(parsed.actions[0].status, 'in-progress');
assert.strictEqual(parsed.actions[0].priority, 'high');
assert.strictEqual(parsed.actions[0].recurring, 'weekly');
assert.strictEqual(parsed.actions[0].dueDate, '2026-11-25');
assert.ok(parsed.actions[0].notes.includes('dashboard link'));
assert.strictEqual(parsed.actions[1].status, 'pending');
assert.strictEqual(parsed.actions[2].status, 'blocked');
assert.strictEqual(parsed.actions[3].status, 'completed');

const targetTask = parseTextImport([
    'Tasks',
    '- Ship the report | Who: Kavita | Target: 2 Dec 2026'
].join('\n'));
assert.strictEqual(targetTask.errors.length, 0, targetTask.errors.join('\n'));
assert.strictEqual(targetTask.actions[0].dueDate, '2026-12-02');
const badTarget = parseTextImport('17 Nov 2026\n- A note | Target: someday');
assert.strictEqual(badTarget.updates.length, 0);
assert.ok(badTarget.errors[0].includes('target date'));

const existing = {
    teams: [{ name: 'Performance Pod', members: 'Murthy' }],
    updates: [{ date: '2026-11-17', description: parsed.updates[0].description }],
    actions: [{ title: 'Fix golang service monitoring', owner: 'Murthy' }]
};
const plan = planTextImport(existing, parsed);
assert.strictEqual(plan.newTeams.length, 0);
assert.strictEqual(plan.memberAdds.length, 1);
assert.deepStrictEqual(plan.memberAdds[0].members, ['Rajesh']);
assert.strictEqual(plan.skippedTeams, 1);
assert.strictEqual(plan.newUpdates.length, 6);
assert.strictEqual(plan.skippedUpdates, 1);
assert.strictEqual(plan.newActions.length, 3);
assert.strictEqual(plan.skippedActions, 1);
assert.strictEqual(plan.newActions[0].title, 'Share the MB app trace with Rajesh');

const oldFormat = parseTextImport([
    '=== UPDATES ===',
    'DATE: 17 Nov',
    'TEXT: A note without a year',
    '---',
    '=== ACTIONS ===',
    'TITLE: Chase the ticket',
    'OWNER: Me',
    '---'
].join('\n'));
assert.strictEqual(oldFormat.errors.length, 0, oldFormat.errors.join('\n'));
assert.strictEqual(oldFormat.updates[0].date, `${new Date().getFullYear()}-11-17`);
assert.strictEqual(oldFormat.actions[0].owner, 'Me');

const plain = parseTextImport('17 Nov 2026\nForgot the dash but still wrote the note\n');
assert.strictEqual(plain.errors.length, 0, plain.errors.join('\n'));
assert.strictEqual(plain.updates[0].description, 'Forgot the dash but still wrote the note');

const again = planTextImport({
    teams: existing.teams,
    updates: existing.updates.concat(plan.newUpdates.map(update => ({ date: update.date, description: update.description }))),
    actions: existing.actions.concat(plan.newActions.map(action => ({ title: action.title, owner: action.owner })))
}, parsed);
assert.strictEqual(again.newTeams.length, 0);
assert.strictEqual(again.newUpdates.length, 0);
assert.strictEqual(again.newActions.length, 0);

const fresh = planTextImport({ teams: [], updates: [], actions: [] }, parsed);
assert.strictEqual(fresh.newTeams.length, 1);
assert.strictEqual(fresh.newTeams[0].description, 'App performance and reliability');
assert.strictEqual(fresh.newTeams[0].color, '#EF4444');
assert.strictEqual(fresh.newUpdates.length, 7);
assert.strictEqual(fresh.newActions.length, 4);

const broken = parseTextImport('=== UPDATES ===\nDATE: yesterday\nTEXT: Missing a real date\n---\n');
assert.strictEqual(broken.updates.length, 0);
assert.ok(broken.errors.length >= 1);

const multiline = parseTextImport([
    '=== UPDATES ===',
    'DATE: 2026-11-21',
    'CATEGORY: meeting',
    'TEXT: First line of the note',
    'Second line stays in the same update',
    '---'
].join('\n'));
assert.strictEqual(multiline.errors.length, 0);
assert.ok(multiline.updates[0].description.includes('Second line'));

console.log('import parser tests passed');
