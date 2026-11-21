# Tech Lead Daily Tracker

A modern, beautiful web-based dashboard for tech leads to track daily activities, manage action items, monitor team progress, and generate weekly reports for management.

![Dashboard Preview](https://img.shields.io/badge/Status-Ready-brightgreen) ![Platform](https://img.shields.io/badge/Platform-Mac%20%7C%20Windows-blue) ![Notes file](https://img.shields.io/badge/Notes-tracker--data.json-blue)

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

**Double-click `start.command`**

1. Open Finder and open the `track` folder
2. Double-click `start.command`
3. If macOS asks, click **Open**
4. Your browser opens at **http://127.0.0.1:8080**
5. Your notes are written to **`tracker-data.json`** in that same folder

To stop the app, click the Terminal window and press `Ctrl + C`.

You can also double-click `index.html`. That opens the app, but the notes stay inside the browser and you will not see `tracker-data.json`.

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

#### Step 2: Install Python

Python creates `tracker-data.json`, the file that holds your notes.

1. Download Python from: https://www.python.org/downloads/
2. Run the installer
3. **Important:** Check ✅ **"Add Python to PATH"** during installation
4. Click "Install Now"

#### Step 3: Run the App

**Double-click `start.bat`**

1. Open File Explorer and open the `track` folder
2. Double-click `start.bat`
3. Your browser opens at **http://127.0.0.1:8080**
4. Your notes are written to **`tracker-data.json`** in that same folder

To stop the app, click the command window and press `Ctrl + C`.

You can also double-click `index.html`. That opens the app, but the notes stay inside the browser and you will not see `tracker-data.json`.

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

Use **Upload Notes** when the day is already written in a text file. This **adds** records. It does not change or delete anything already in the app.

1. Click **Notes Template** and open the downloaded text file. It is one filled-in team, with the team line, daily updates, and tasks.
2. Copy that block when you have another team. Replace the names, dates, and sentences with your own.
3. Click **Upload Notes** and choose that file.
4. Check the counts, then confirm. Uploading the same notes again skips the lines that are already saved.

```
Teams
- Performance Pod | People: Murthy, Rajesh | About: App performance and reliability | Color: Red

17 Nov 2026
- Discussed the golang monitoring gap with the perf SRE team | Team: Performance Pod | People: Murthy, Rajesh | Type: Discussion | Tags: golang, monitoring
- Morning sync on the MB app slow screens | Team: Performance Pod | People: Murthy | Type: Meeting | Tags: mb app

18 Nov 2026
- Reviewed 4 pull requests for the performance fixes | Team: Performance Pod | People: Rajesh | Type: PR review | Tags: pr
- Approved the staggered bundle push plan | Team: Performance Pod | People: Murthy | Type: Approval | Tags: release

19 Nov 2026
- Checkmarx review for the R12 Go services | Team: Performance Pod | People: Murthy, Rajesh | Type: Audit | Tags: checkmarx, r12
- Planned the next monitoring dashboard work | Team: Performance Pod | People: Rajesh | Type: Planning | Tags: dashboard
- Login latency spike after the last release | Team: Performance Pod | People: Murthy | Type: Issue | Tags: latency

Tasks
- Fix golang service monitoring | Who: Murthy | Team: Performance Pod | Urgent: High | Status: In progress | Due: 25 Nov 2026 | Ticket: RITM8019234 | Notes: Confirm the new entry point and share the dashboard link | Repeats: Weekly
- Share the MB app trace with Rajesh | Who: Rajesh | Team: Performance Pod | Urgent: Medium | Status: Pending | Due: 21 Nov 2026 | Notes: Include the slow screen names
- Close the Checkmarx R12 findings | Who: Murthy | Team: Performance Pod | Urgent: High | Status: Blocked | Due: 28 Nov 2026 | Ticket: RITM8019300 | Notes: Waiting on the security sign-off
- Publish the weekly performance note | Who: Rajesh | Team: Performance Pod | Urgent: Low | Status: Done | Due: 19 Nov 2026 | Notes: Sent to the pod channel | Repeats: Weekly
```

A date and a dashed line are enough. Add the words after `|` when you have them:

| After the bar | What to write |
| --- | --- |
| `People:` or `Who:` | The person, or several names separated by commas |
| `About:` | A short line about the team |
| `Color:` | Red, Green, Orange, Blue, Purple, Pink, Teal, or Sky |
| `Team:` | The same team name on every update and task |
| `Type:` | Meeting, Discussion, PR review, Approval, Audit, Planning, Issue, or Other |
| `Tags:` | Words separated by commas, such as `golang, monitoring` |
| `Urgent:` | High, Medium, or Low |
| `Status:` | Pending, In progress, Blocked, or Done |
| `Due:` | 21 Nov 2026 |
| `Ticket:` | RITM8019234 |
| `Notes:` | Extra detail for a task |
| `Repeats:` | Daily, Weekly, Biweekly, or Monthly |

`17 Nov` is enough for the date. The app uses the current year. A task with no `Who:` is saved under your name, Me. A new team picks up `About:` and `Color:`. Leave `Color:` out and the app picks one. A team already in the app keeps the about text and color it already has. Open **Teams** to see that color.

The teams already in the app use these colors:

| Team | Color |
| --- | --- |
| Techbacklog | Blue |
| Deposits | Green |
| MFA | Orange |
| Performance Pod | Red |
| Drishti AI | Purple |
| CQRS | Pink |

| If this already exists | What upload does |
| --- | --- |
| Same date and same note | Skips it |
| Same task and same person | Skips it |
| Same team name | Keeps the team. Adds only new people |

**Restore Backup** replaces the whole tracker from a JSON backup. Use it only when you are putting a saved copy back.

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

Your notes are saved in a real file when you start the app with `start.command` (Mac) or `start.bat` (Windows).

| What you see | Where it is |
| --- | --- |
| **`tracker-data.json`** | In the same folder as `index.html`. Open the `track` folder in Finder or File Explorer. |
| Sidebar line | **File: tracker-data.json in this app folder** |
| **Download Backup** | A dated copy you can keep somewhere else |

The file is updated every time you add or edit a note. Closing the browser, restarting the laptop, or updating the app does not remove it.

Double-clicking `index.html` by itself does not create that file. The notes stay in that browser only. Start the app with `start.command` or `start.bat`, and the app copies those browser notes into `tracker-data.json`.

**Restore Backup** replaces everything from a JSON file you choose. Use it when you are putting a saved copy back.

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
├── index.html           # The tracker
├── styles.css           # Styling
├── app.js               # Tracker behavior
├── server.py            # Saves tracker-data.json
├── start.command        # Mac: open the app and keep the file
├── start.bat            # Windows: open the app and keep the file
├── tracker-data.json    # Your notes. Created the first time you run the app
├── README.md
└── track.pdf
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

### I cannot see a saved file

Start the app with `start.command` on Mac or `start.bat` on Windows. Then look in the `track` folder for `tracker-data.json`. The sidebar says **File: tracker-data.json in this app folder** when that file is being updated.

Double-clicking `index.html` keeps notes in the browser only.

### App looks broken?

1. Clear browser cache: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Try a different browser
3. Re-download the app

### Port already in use?

```bash
python3 server.py --port 3000
```

Then open **http://127.0.0.1:3000**.

---

## Support

If you have issues or feature requests, create an issue on GitHub:
https://github.com/kalpit-sharma-dev/track/issues

---

## License

This project is for personal use. Feel free to modify and customize as needed.
