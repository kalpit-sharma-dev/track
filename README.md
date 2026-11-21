# Tech Lead Daily Tracker

A modern, beautiful web-based dashboard for tech leads to track daily activities, manage action items, monitor team progress, and generate weekly reports for management.

![Dashboard Preview](https://img.shields.io/badge/Status-Ready-brightgreen) ![Platform](https://img.shields.io/badge/Platform-Mac%20%7C%20Windows-blue) ![No Server](https://img.shields.io/badge/Server-Not%20Required-orange)

---

## Table of Contents

- [Features](#features)
- [Installation & Setup](#installation--setup)
  - [Mac Setup](#mac-setup)
  - [Windows Setup](#windows-setup)
- [Running the App](#running-the-app)
- [Usage Guide](#usage-guide)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Data Storage & Backup](#data-storage--backup)
- [Features in Detail](#features-in-detail)

---

## Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | Quick overview with stats, recent updates, and pending actions |
| **Daily Updates** | Log meetings, discussions, PR reviews, audits with categories |
| **Action Items** | Kanban board with priorities, owners, due dates, JIRA links |
| **Teams** | Manage multiple teams (Techbacklog, Deposits, MFA, etc.) |
| **Analytics** | Charts for 7–90 days, this/last quarter, half year, and year |
| **Weekly Reports** | Auto-generated reports with export to PDF or copy for email |
| **Search** | Find any update, person, team, tag, ticket, or action |
| **Tags** | Add custom tags to updates for better organization |
| **Recurring Tasks** | Set actions to repeat daily, weekly, or monthly |
| **Dark Mode** | Toggle between light and dark themes |

---

## Installation & Setup

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, or Edge)
- Python 3 (pre-installed on Mac, need to install on Windows) - *Optional, only for local server*

---

### Mac Setup

#### Step 1: Download the App

**Option A: Using Git (Recommended)**

Open Terminal (`Cmd + Space`, type "Terminal", press Enter) and run:

```bash
# Navigate to where you want to save the app
cd ~/Documents

# Clone the repository
git clone https://github.com/kalpit-sharma-dev/track.git

# Navigate into the folder
cd track
```

**Option B: Download ZIP**

1. Go to https://github.com/kalpit-sharma-dev/track
2. Click the green **"Code"** button
3. Click **"Download ZIP"**
4. Open Finder → Downloads → Extract `track-main.zip`
5. Move the `track-main` folder to Documents (or wherever you prefer)

#### Step 2: Run the App

**Method 1: Double-Click (Easiest)**

1. Open Finder
2. Navigate to the `track` folder
3. Double-click `index.html`
4. The app opens in your default browser ✅

**Method 2: Local Server (Recommended for best experience)**

```bash
# Navigate to the app folder
cd ~/Documents/track

# Start a local server
python3 -m http.server 8080

# You'll see: "Serving HTTP on :: port 8080 ..."
```

Open your browser and go to: **http://localhost:8080**

To stop the server: Press `Ctrl + C` in Terminal

#### Step 3: Create Desktop Shortcut (Optional)

1. Open the app in Chrome
2. Click the three dots menu (⋮) → **"More tools"** → **"Create shortcut"**
3. Check **"Open as window"** → Click **Create**
4. The app now appears in your Applications folder
5. Drag it to your Dock for easy access

---

### Windows Setup

#### Step 1: Download the App

**Option A: Using Git**

1. Install Git if you don't have it: https://git-scm.com/download/win
2. Open Command Prompt or PowerShell and run:

```cmd
# Navigate to Documents
cd %USERPROFILE%\Documents

# Clone the repository
git clone https://github.com/kalpit-sharma-dev/track.git

# Navigate into the folder
cd track
```

**Option B: Download ZIP**

1. Go to https://github.com/kalpit-sharma-dev/track
2. Click the green **"Code"** button
3. Click **"Download ZIP"**
4. Open File Explorer → Downloads → Right-click `track-main.zip` → **"Extract All"**
5. Move the extracted folder to Documents

#### Step 2: Install Python (Optional - for local server)

1. Download Python from: https://www.python.org/downloads/
2. Run the installer
3. **Important:** Check ✅ **"Add Python to PATH"** during installation
4. Click "Install Now"

#### Step 3: Run the App

**Method 1: Double-Click (Easiest)**

1. Open File Explorer
2. Navigate to the `track` folder
3. Double-click `index.html`
4. The app opens in your default browser ✅

**Method 2: Local Server (Recommended)**

Open Command Prompt or PowerShell:

```cmd
# Navigate to the app folder
cd %USERPROFILE%\Documents\track

# Start a local server
python -m http.server 8080
```

If `python` doesn't work, try `python3` or `py`:

```cmd
py -m http.server 8080
```

Open your browser and go to: **http://localhost:8080**

To stop the server: Press `Ctrl + C`

#### Step 4: Create Desktop Shortcut (Optional)

**Method 1: Browser Shortcut**

1. Open the app in Chrome
2. Click the three dots menu (⋮) → **"More tools"** → **"Create shortcut"**
3. Check **"Open as window"** → Click **Create**

**Method 2: Desktop Shortcut**

1. Right-click on `index.html`
2. Click **"Create shortcut"**
3. Move the shortcut to your Desktop

---

## Running the App

### Quick Reference

| Platform | Command |
|----------|---------|
| **Mac** | `python3 -m http.server 8080` |
| **Windows** | `python -m http.server 8080` or `py -m http.server 8080` |
| **Both** | Then open http://localhost:8080 |

### Using Different Ports

If port 8080 is busy, use another port:

```bash
# Use port 3000
python3 -m http.server 3000

# Then open http://localhost:3000
```

### Running Without Server

You can also just double-click `index.html` - all features work! The local server is optional but recommended for the best experience.

---

## Usage Guide

### Adding Daily Updates

1. Click **"Daily Updates"** in the sidebar
2. Click **"+ Add Update"** button
3. Fill in:
   - **Date**: When did this happen
   - **Category**: Meeting, Discussion, PR Review, Approval, Audit, Planning, Issue
   - **Team**: Which team this relates to (optional)
   - **Description**: What happened
   - **People**: Who was involved (comma-separated)
   - **Tags**: Custom tags like `urgent`, `follow-up` (comma-separated)
4. Click **"Save Update"**

### Managing Action Items

1. Click **"Action Items"** in the sidebar
2. Click **"+ Add Action Item"**
3. Fill in:
   - **Title**: What needs to be done
   - **Owner**: Who is responsible
   - **Priority**: High / Medium / Low
   - **Due Date**: When it's due
   - **Team**: Related team
   - **JIRA/Ticket**: Link to RITM or JIRA (e.g., RITM8019234)
   - **Recurring**: If it repeats (Daily/Weekly/Bi-weekly/Monthly)
4. Click **"Save Action"**

**Changing Status:**
- Click on any action card to edit it
- Change status between: Pending → In Progress → Completed / Blocked

### Generating Weekly Reports

1. Click **"Weekly Report"** in the sidebar
2. Select the week using the date picker
3. The report auto-generates with:
   - Summary statistics
   - What was done
   - Currently working on
   - Blockers & issues
   - Next week's focus

**Exporting:**
- **📋 Copy for Email**: Copies plain text to clipboard - paste into Outlook/Gmail
- **📄 Export PDF**: Opens print dialog - save as PDF or print

### Using Analytics

1. Click **"Analytics"** in the sidebar
2. Select time range (7/14/30/90 days)
3. View:
   - Activity over time
   - Category breakdown
   - Team activity
   - Action status
   - Top collaborators
   - Productivity insights
   - Tags cloud

### Using Dark Mode

Click the **🌙** icon in the top-right of the sidebar header to toggle dark mode.

---

## Search

The search box at the top of the sidebar looks through **everything already saved**:

| You can search for | Examples |
| --- | --- |
| Update text | `golang monitoring`, `Checkmarx` |
| A person's name | `Rajesh`, `Shyam`, `Adhika` |
| A team | `Performance Pod`, `Drishti` |
| A tag | `urgent`, `vapt` |
| A ticket | `RITM8019234` |
| Status, priority, or category | `blocked`, `high`, `audit` |
| A date | `Nov 17`, `2026` |

More than one word means every word must match. `Rajesh golang` finds an update that mentions both. The search waits a moment while you type, then checks the whole tracker. It does not stop at the first few records. If there are many matches, the first set is shown and **Show more** loads the rest.

Click a result to open that update, action item, or team. Press `Esc` or clear the box to go back.

Long lists of daily updates and action items also load in pages, so a year of notes stays responsive. Search still checks every record.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + N` | Add new update |
| `Cmd/Ctrl + K` | Focus search bar |
| `Escape` | Close modal / Clear search |

---

## Upload notes from a text file

Use **Upload Notes** in the sidebar when you already wrote the day in a text file. This **adds** records. It does not change or delete anything already in the app.

1. Click **Notes Template** and save `daily-tracker-notes-template.txt`.
2. Fill in teams, daily updates, and action items. Separate each record with a line that contains only `---`.
3. Click **Upload Notes** and choose that `.txt` file.
4. Review the counts, then confirm. A second upload of the same file skips rows that are already saved.

Dates can be `2026-11-17`, `17 Nov 2026`, or `17/11/2026`.

```
=== TEAMS ===
NAME: Performance Pod
DESCRIPTION: App performance and reliability
MEMBERS: Murthy, Rajesh
COLOR: #EF4444
---

=== UPDATES ===
DATE: 17 Nov 2026
CATEGORY: discussion
TEAM: Performance Pod
PEOPLE: Murthy, Rajesh
TAGS: golang, monitoring
TEXT: Discussed the golang monitoring gap with the perf SRE team.
---

=== ACTIONS ===
TITLE: SonarQube Setup Jenkins
OWNER: Pratap, Adhika, Chandan
PRIORITY: high
STATUS: pending
TEAM: Drishti AI
DUE: 25 Nov 2026
JIRA: RITM8019234
NOTES: Ask them to test and share the result.
---
```

| If this already exists | What upload does |
| --- | --- |
| Same date and update text | Skips it |
| Same action title and owner | Skips it |
| Same team name | Keeps the team. Adds only member names that are not already listed |

**Restore Backup** is different: that JSON file replaces the whole tracker. Use it only to restore a backup.

## Analytics periods

Open **Analytics** and choose the range:

| Range | Use it for |
| --- | --- |
| Last 7, 14, 30, or 90 days | Recent delivery work |
| This quarter / Last quarter | Quarterly review |
| This half year / Last half year | Mid-year review |
| This year / Last year | Annual appraisal |

The label next to the menu shows the exact start and end dates. Charts, teams, people, tags, and action status all use that same period.

## Data Storage & Backup

### Where Data is Stored

| Location | Description |
|----------|-------------|
| **Browser localStorage** | Primary storage - persists forever |
| **Backup JSON files** | Downloaded when you click "Download Backup" |

### Your Data Survives

✅ Closing the browser tab  
✅ Restarting the browser  
✅ Restarting your computer  
✅ Restarting the app  

### Your Data is Lost If

❌ You clear browser data/cache  
❌ You use a different browser  
❌ You use Incognito/Private mode  

### Backup Workflow

1. **Regular backups**: Click **"💾 Download Backup"** in the sidebar weekly
2. **Store safely**: Keep the JSON files in a folder like `Documents/TrackerBackups/`
3. **Restore anytime**: Click **"📂 Restore from Backup"** to load from a JSON file

### Recommended Backup Schedule

| Frequency | Action |
|-----------|--------|
| **Daily** | Data auto-saves to browser |
| **Weekly** | Download a backup file |
| **Monthly** | Archive backups to cloud storage |

---

## Features in Detail

### Teams (Pre-configured)

The app comes with your teams pre-configured:

| Team | Description |
|------|-------------|
| Techbacklog | Technical backlog management |
| Deposits | Deposits feature team |
| MFA | Multi-factor authentication |
| Performance Pod | App performance optimization |
| Drishti AI | AI and ML initiatives |
| CQRS | Command Query Responsibility Segregation |

You can add, edit, or delete teams as needed.

### Categories for Updates

| Category | Use For |
|----------|---------|
| 🤝 Meeting | Scheduled meetings, calls |
| 💬 Discussion | Ad-hoc discussions, chats |
| 👀 PR Review | Code reviews, pull requests |
| ✅ Approval | Sign-offs, approvals given |
| 🔍 Audit | Audit calls, compliance reviews |
| 📋 Planning | Sprint planning, roadmap discussions |
| 🔧 Issue | Bug fixes, issue resolution |
| 📌 Other | Anything else |

### Action Item Priorities

| Priority | Color | Use For |
|----------|-------|---------|
| 🔴 High | Red | Urgent, blocking items |
| 🟡 Medium | Amber | Important but not urgent |
| 🟢 Low | Green | Nice to have, backlog |

---

## File Structure

```
track/
├── index.html      # Main application HTML
├── styles.css      # All styling (including dark mode)
├── app.js          # Application logic
├── README.md       # This documentation
└── track.pdf       # Original requirements
```

---

## Browser Support

| Browser | Supported |
|---------|-----------|
| Chrome | ✅ Recommended |
| Firefox | ✅ |
| Safari | ✅ |
| Edge | ✅ |
| IE 11 | ❌ Not supported |

---

## Troubleshooting

### "python" or "python3" not found

**Mac:**
```bash
# Check if Python is installed
which python3

# If not found, install via Homebrew
brew install python3
```

**Windows:**
- Reinstall Python from https://www.python.org/downloads/
- Make sure to check "Add Python to PATH"

### Data not saving?

1. Make sure you're not in Incognito/Private browsing mode
2. Check if localStorage is enabled in your browser
3. Try a different browser

### App looks broken?

1. Clear browser cache: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Try a different browser
3. Re-download the app

### Port already in use?

```bash
# Use a different port
python3 -m http.server 3000
```

---

## Support

If you have issues or feature requests, create an issue on GitHub:
https://github.com/kalpit-sharma-dev/track/issues

---

## License

This project is for personal use. Feel free to modify and customize as needed.
