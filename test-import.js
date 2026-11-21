const assert = require('assert');
const { parseFlexibleDate, parseTextImport, planTextImport, IMPORT_TEMPLATE } = require('./import-parser');

assert.strictEqual(parseFlexibleDate('2026-11-17'), '2026-11-17');
assert.strictEqual(parseFlexibleDate('17 Nov 2026'), '2026-11-17');
assert.strictEqual(parseFlexibleDate('17/11/2026'), '2026-11-17');
assert.strictEqual(parseFlexibleDate('not a date'), null);

const parsed = parseTextImport(IMPORT_TEMPLATE);
assert.strictEqual(parsed.errors.length, 0, parsed.errors.join('\n'));
assert.strictEqual(parsed.teams.length, 1);
assert.strictEqual(parsed.teams[0].name, 'Performance Pod');
assert.strictEqual(parsed.updates.length, 3);
assert.deepStrictEqual(parsed.updates.map(update => update.date), ['2026-11-17', '2026-11-18', '2026-11-19']);
assert.strictEqual(parsed.updates[1].category, 'review');
assert.strictEqual(parsed.updates[2].category, 'audit');
assert.deepStrictEqual(parsed.updates[0].tags, ['golang', 'monitoring']);
assert.strictEqual(parsed.actions.length, 2);
assert.strictEqual(parsed.actions[0].jira, 'RITM8019234');
assert.strictEqual(parsed.actions[0].title, 'Set up SonarQube on Jenkins');
assert.strictEqual(parsed.actions[1].status, 'in-progress');
assert.strictEqual(parsed.actions[1].owner, 'Shyam');

const existing = {
    teams: [{ name: 'Performance Pod', members: 'Murthy' }],
    updates: [{ date: '2026-11-17', description: parsed.updates[0].description }],
    actions: [{ title: 'Priority for tech backlog', owner: 'Shyam' }]
};
const plan = planTextImport(existing, parsed);
assert.strictEqual(plan.newTeams.length, 1);
assert.strictEqual(plan.newTeams[0].name, 'Drishti AI');
assert.strictEqual(plan.memberAdds.length, 1);
assert.deepStrictEqual(plan.memberAdds[0].members, ['Rajesh']);
assert.strictEqual(plan.skippedTeams, 1);
assert.strictEqual(plan.newUpdates.length, 2);
assert.strictEqual(plan.skippedUpdates, 1);
assert.strictEqual(plan.newActions.length, 1);
assert.strictEqual(plan.skippedActions, 1);
assert.strictEqual(plan.newActions[0].title, 'Set up SonarQube on Jenkins');

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
    teams: existing.teams.concat([{ name: 'Drishti AI', members: '' }]),
    updates: existing.updates.concat(plan.newUpdates.map(update => ({ date: update.date, description: update.description }))),
    actions: existing.actions.concat([{ title: plan.newActions[0].title, owner: plan.newActions[0].owner }])
}, parsed);
assert.strictEqual(again.newTeams.length, 0);
assert.strictEqual(again.newUpdates.length, 0);
assert.strictEqual(again.newActions.length, 0);

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
