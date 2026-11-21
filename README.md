# Tech Lead Daily Tracker

A modern web-based dashboard for tech leads to track daily activities, manage action items, monitor team progress, and generate weekly reports for management.

## Features

### Dashboard Overview
- Quick stats: Today's updates, pending actions, completed this week, active teams
- Recent updates at a glance
- Pending action items with priority indicators
- Team activity summary

### Daily Updates
- Log daily activities with categories (Meeting, Discussion, PR Review, Approval, Audit, Planning, Issue Resolution)
- Associate updates with specific teams
- Track people involved in discussions
- Filter by date, team, or category

### Action Items Management
- Kanban-style board with Pending, In Progress, Completed, Blocked columns
- Priority levels (High, Medium, Low)
- Assign owners and due dates
- Link to JIRA/ServiceNow tickets
- Track progress with notes

### Team Management
- Pre-configured teams: Techbacklog, Deposits, MFA, Performance Pod, Drishti AI, CQRS
- Add custom teams with descriptions and members
- Color-coded team identification
- Track updates and actions per team

### Weekly Reports
- Automatic report generation for any week
- Summary statistics (updates, completions, meetings, reviews)
- Sections: What Was Done, Currently Working On, Blockers, Next Week's Focus
- Export/Print functionality for management sharing

### Data Management
- All data stored locally in browser (localStorage)
- Export data as JSON backup
- Import data from backup
- No server required - works offline

## Getting Started

### Option 1: Open Directly
Simply open `index.html` in your web browser.

### Option 2: Use a Local Server
```bash
# Using Python
python3 -m http.server 8000

# Then open http://localhost:8000
```

## Usage

### Adding Daily Updates
1. Click "Daily Updates" in the sidebar
2. Click "+ Add Update"
3. Select date, category, team (optional)
4. Enter description and people involved
5. Click "Save Update"

### Managing Action Items
1. Click "Action Items" in the sidebar
2. Click "+ Add Action Item"
3. Fill in title, owner, priority, due date
4. Optionally link JIRA/RITM ticket
5. Click on any card to edit or change status

### Generating Weekly Reports
1. Click "Weekly Report" in the sidebar
2. Select the week using the date picker
3. Review the auto-generated report
4. Click "Export Report" to print or save as PDF

### Keyboard Shortcuts
- `Ctrl/Cmd + N`: Quick add new update
- `Escape`: Close any open modal

## Sample Data Entry

Based on your current notes format, here's how to enter:

**17 Nov Updates:**
- Category: Discussion | Description: "Review Cost Implications on Staggered Bundle push"
- Category: Meeting | Team: Performance Pod | Description: "Discussion with Performance team on MB App"
- Category: Issue | Description: "DT monitoring issue for golang services - discussed with perf SRE team"

**Action Items:**
- Title: "Priority for tech backlog" | Owner: Shyam | Priority: High
- Title: "Complete Unit Test Case Script" | Owner: Self | Priority: Medium
- Title: "Chase RITM Tickets for Golang Java Upgrade" | Priority: High
- Title: "SonarQube Setup Jenkins" | Owner: Pratap, Adhika, Chandan | JIRA: RITM8019234

## File Structure

```
/workspace
├── index.html      # Main HTML file
├── styles.css      # All styling
├── app.js          # Application logic
├── README.md       # This file
└── track.pdf       # Original requirements
```

## Browser Support

Works on all modern browsers:
- Chrome, Edge, Firefox, Safari
- Mobile responsive design included

## Data Privacy

All data is stored locally in your browser's localStorage. No data is sent to any server. Export regularly to backup your data.