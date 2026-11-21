# Release Tag Tool

A comprehensive tool for release branch and tagging management that helps tech leads track commits, verify JIRA tickets, and manage release labels.

## Features

- **Takes a release tag input** (e.g., `r12.3.5`)
- **Fetches all commit IDs** that belong to that tag
- **Pushes/verifies commit IDs to JIRA** (or verifies if they exist in JIRA)
- **Verifies commits against Git/PR Tool** so you detect missed commits
- **Adds labels to release branches** and validates commit IDs against labels
- **Compares two tags or two labels** (previous vs current)
- **Ensures every commit in the branch is covered under a label** (bundled commits)
- **Outputs a final "Label Bundle"** that contains ALL commit IDs

## Installation

```bash
pip install -r requirements.txt
```

## Quick Start

```bash
# List all available tags
python release_tag_tool.py --list-tags

# Process a release tag
python release_tag_tool.py --tag r12.3.5

# Compare with a specific previous tag
python release_tag_tool.py --tag r12.3.5 --previous-tag r12.3.4

# Generate a markdown report
python release_tag_tool.py --tag r12.3.5 --format markdown --output release_report.md

# Generate a JSON report
python release_tag_tool.py --tag r12.3.5 --format json --output release_bundle.json
```

## Usage Examples

### Basic Tag Processing

```bash
python release_tag_tool.py --tag r12.3.5
```

This will:
1. Fetch all commits for the tag
2. Auto-detect the previous tag
3. Extract JIRA IDs from commit messages
4. Extract PR numbers from commit messages
5. Output a summary report

### Compare Two Tags

```bash
python release_tag_tool.py --compare r12.3.4 r12.3.5
```

### Add Labels to Commits

```bash
python release_tag_tool.py --tag r12.3.5 --add-labels
```

### Push Commit Info to JIRA

```bash
python release_tag_tool.py --tag r12.3.5 --push-to-jira
```

### Skip Verification Steps

```bash
# Skip JIRA verification
python release_tag_tool.py --tag r12.3.5 --no-verify-jira

# Skip PR verification
python release_tag_tool.py --tag r12.3.5 --no-verify-pr
```

## Configuration

### Environment Variables

Set these environment variables for JIRA and PR tool integration:

```bash
export JIRA_BASE_URL="https://your-company.atlassian.net"
export JIRA_AUTH_TOKEN="your-jira-api-token"
export PR_TOOL_BASE_URL="https://api.github.com/repos/owner/repo"
export PR_TOOL_AUTH_TOKEN="your-github-token"
```

### Configuration File

Create a `config.json` file (see `config.example.json`):

```json
{
  "jira_base_url": "https://your-company.atlassian.net",
  "jira_auth_token": "your-jira-api-token",
  "pr_tool_base_url": "https://api.github.com/repos/owner/repo",
  "pr_tool_auth_token": "your-github-token"
}
```

Then use it:

```bash
python release_tag_tool.py --tag r12.3.5 --config config.json
```

## Output Formats

### Text (Default)

Plain text report suitable for terminal output.

### JSON

Structured JSON output containing all commit data, JIRA IDs, and verification results.

### Markdown

Formatted markdown report suitable for documentation or sharing.

## Label Bundle Output

The tool produces a comprehensive "Label Bundle" containing:

- **Tag information**: Current and previous tag
- **All commit IDs**: Complete list of commits in the release
- **JIRA IDs**: All extracted JIRA ticket references
- **PR numbers**: All extracted pull request references
- **Verification status**: Which commits are verified in JIRA and PR tools
- **Missing references**: Commits missing JIRA or PR references
- **Labels applied**: All labels created for the release

## Commit Message Format

For best results, use commit messages that include:

- JIRA ID: `ABC-123: Fix bug in login flow`
- PR reference: `Merge pull request #456 from feature-branch`

## Command Line Options

| Option | Description |
|--------|-------------|
| `--tag, -t` | Release tag to process (e.g., r12.3.5) |
| `--previous-tag, -p` | Previous tag to compare against |
| `--compare, -c` | Compare two tags/labels |
| `--format, -f` | Output format: json, markdown, text |
| `--output, -o` | Output file path |
| `--verify-jira` | Verify commits in JIRA (default) |
| `--no-verify-jira` | Skip JIRA verification |
| `--verify-pr` | Verify commits in PR tool (default) |
| `--no-verify-pr` | Skip PR verification |
| `--push-to-jira` | Push commit info to JIRA tickets |
| `--add-labels` | Add release labels to commits |
| `--list-tags` | List all available tags |
| `--config` | Path to JSON config file |

## Example Output

```
============================================================
RELEASE LABEL BUNDLE: r12.3.5
============================================================

Generated: 2024-01-15T10:30:00
Previous Tag: r12.3.4
Total Commits: 15

----------------------------------------
SUMMARY
----------------------------------------
JIRA IDs Found: 12
Labels Applied: 15
Missing JIRA References: 3
Missing PR References: 2

----------------------------------------
ALL JIRA IDs
----------------------------------------
ABC-123, ABC-124, ABC-125, DEF-456, DEF-457

----------------------------------------
ALL COMMIT IDs (Label Bundle)
----------------------------------------
abc123def456... | abc123d | Fix login bug
def456ghi789... | def456g | Add new feature
...
```