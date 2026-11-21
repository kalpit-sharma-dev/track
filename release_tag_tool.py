#!/usr/bin/env python3
"""
Release Tag Tool - A comprehensive tool for release branch and tagging management.

Features:
- Takes a release tag input (e.g., r12.3.5)
- Fetches all commit IDs that belong to that tag
- Pushes/verifies commit IDs to JIRA
- Verifies commits against Git/PR Tool
- Adds labels to release branches
- Compares two tags or two labels (previous vs current)
- Ensures every commit is covered under a label
- Outputs a final "Label Bundle" containing ALL commit IDs
"""

import subprocess
import json
import sys
import argparse
import requests
from datetime import datetime
from typing import List, Dict, Optional, Set, Tuple
from dataclasses import dataclass, field, asdict
from pathlib import Path
import re
import os


@dataclass
class Commit:
    """Represents a Git commit."""
    sha: str
    short_sha: str
    message: str
    author: str
    date: str
    jira_ids: List[str] = field(default_factory=list)
    pr_number: Optional[str] = None
    labels: List[str] = field(default_factory=list)
    verified_in_jira: bool = False
    verified_in_pr_tool: bool = False


@dataclass
class LabelBundle:
    """Represents the final output bundle containing all commit information."""
    tag: str
    previous_tag: Optional[str]
    created_at: str
    total_commits: int
    commits: List[Commit]
    jira_ids: Set[str]
    missing_in_jira: List[str]
    missing_in_pr_tool: List[str]
    labels_applied: List[str]
    comparison_summary: Optional[Dict] = None


class GitHelper:
    """Helper class for Git operations."""
    
    @staticmethod
    def run_git_command(args: List[str], check: bool = True) -> str:
        """Execute a git command and return the output."""
        cmd = ['git'] + args
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=check
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError as e:
            print(f"Git command failed: {' '.join(cmd)}")
            print(f"Error: {e.stderr}")
            if check:
                raise
            return ""
    
    @staticmethod
    def get_all_tags() -> List[str]:
        """Get all tags in the repository."""
        output = GitHelper.run_git_command(['tag', '-l'])
        return [t for t in output.split('\n') if t]
    
    @staticmethod
    def tag_exists(tag: str) -> bool:
        """Check if a tag exists."""
        tags = GitHelper.get_all_tags()
        return tag in tags
    
    @staticmethod
    def get_commits_for_tag(tag: str, since_tag: Optional[str] = None) -> List[Dict]:
        """Get all commits for a tag, optionally since a previous tag."""
        if since_tag:
            range_spec = f"{since_tag}..{tag}"
        else:
            range_spec = tag
        
        format_str = '%H|%h|%s|%an|%ai'
        output = GitHelper.run_git_command([
            'log',
            '--format=' + format_str,
            range_spec
        ])
        
        commits = []
        for line in output.split('\n'):
            if line:
                parts = line.split('|', 4)
                if len(parts) >= 5:
                    commits.append({
                        'sha': parts[0],
                        'short_sha': parts[1],
                        'message': parts[2],
                        'author': parts[3],
                        'date': parts[4]
                    })
        return commits
    
    @staticmethod
    def get_commits_between_tags(tag1: str, tag2: str) -> List[Dict]:
        """Get commits between two tags."""
        return GitHelper.get_commits_for_tag(tag2, tag1)
    
    @staticmethod
    def get_previous_tag(tag: str) -> Optional[str]:
        """Get the previous tag before the given tag."""
        try:
            output = GitHelper.run_git_command([
                'describe',
                '--tags',
                '--abbrev=0',
                f'{tag}^'
            ], check=False)
            return output if output else None
        except Exception:
            return None
    
    @staticmethod
    def get_branch_for_tag(tag: str) -> Optional[str]:
        """Get the branch containing the tag."""
        output = GitHelper.run_git_command([
            'branch',
            '-a',
            '--contains',
            tag
        ], check=False)
        branches = [b.strip().replace('* ', '') for b in output.split('\n') if b.strip()]
        return branches[0] if branches else None
    
    @staticmethod
    def create_label(label_name: str, commit_sha: str) -> bool:
        """Create a lightweight tag as a label for a commit."""
        try:
            GitHelper.run_git_command(['tag', label_name, commit_sha])
            return True
        except Exception:
            return False
    
    @staticmethod
    def get_labels_for_commit(commit_sha: str) -> List[str]:
        """Get all tags/labels pointing to a commit."""
        output = GitHelper.run_git_command([
            'tag',
            '--points-at',
            commit_sha
        ], check=False)
        return [t for t in output.split('\n') if t]


class JiraHelper:
    """Helper class for JIRA operations."""
    
    def __init__(self, base_url: Optional[str] = None, auth_token: Optional[str] = None):
        self.base_url = base_url or os.environ.get('JIRA_BASE_URL', '')
        self.auth_token = auth_token or os.environ.get('JIRA_AUTH_TOKEN', '')
        self.jira_pattern = re.compile(r'([A-Z][A-Z0-9]+-\d+)')
    
    def extract_jira_ids(self, text: str) -> List[str]:
        """Extract JIRA IDs from commit message or PR description."""
        matches = self.jira_pattern.findall(text)
        return list(set(matches))
    
    def verify_jira_exists(self, jira_id: str) -> bool:
        """Verify if a JIRA ticket exists."""
        if not self.base_url or not self.auth_token:
            print(f"  [WARN] JIRA not configured. Cannot verify {jira_id}")
            return False
        
        try:
            headers = {
                'Authorization': f'Bearer {self.auth_token}',
                'Content-Type': 'application/json'
            }
            response = requests.get(
                f'{self.base_url}/rest/api/2/issue/{jira_id}',
                headers=headers,
                timeout=10
            )
            return response.status_code == 200
        except Exception as e:
            print(f"  [ERROR] Failed to verify JIRA {jira_id}: {e}")
            return False
    
    def add_commit_to_jira(self, jira_id: str, commit_sha: str, commit_message: str) -> bool:
        """Add a commit reference to a JIRA ticket."""
        if not self.base_url or not self.auth_token:
            print(f"  [WARN] JIRA not configured. Cannot add commit to {jira_id}")
            return False
        
        try:
            headers = {
                'Authorization': f'Bearer {self.auth_token}',
                'Content-Type': 'application/json'
            }
            comment_body = f"Commit {commit_sha[:8]} added to release:\n{commit_message}"
            payload = {'body': comment_body}
            response = requests.post(
                f'{self.base_url}/rest/api/2/issue/{jira_id}/comment',
                headers=headers,
                json=payload,
                timeout=10
            )
            return response.status_code in [200, 201]
        except Exception as e:
            print(f"  [ERROR] Failed to add commit to JIRA {jira_id}: {e}")
            return False


class PRToolHelper:
    """Helper class for PR/Git tool operations (GitHub/GitLab/etc)."""
    
    def __init__(self, api_base_url: Optional[str] = None, auth_token: Optional[str] = None):
        self.api_base_url = api_base_url or os.environ.get('PR_TOOL_BASE_URL', '')
        self.auth_token = auth_token or os.environ.get('PR_TOOL_AUTH_TOKEN', '')
        self.pr_pattern = re.compile(r'#(\d+)|Merge pull request #(\d+)')
    
    def extract_pr_number(self, text: str) -> Optional[str]:
        """Extract PR number from commit message."""
        match = self.pr_pattern.search(text)
        if match:
            return match.group(1) or match.group(2)
        return None
    
    def verify_pr_exists(self, pr_number: str) -> bool:
        """Verify if a PR exists in the PR tool."""
        if not self.api_base_url or not self.auth_token:
            # Try using git log to verify PR merge commits exist
            try:
                output = GitHelper.run_git_command([
                    'log',
                    '--grep',
                    f'#{pr_number}',
                    '--oneline'
                ], check=False)
                return bool(output)
            except Exception:
                return False
        
        try:
            headers = {
                'Authorization': f'Bearer {self.auth_token}',
                'Accept': 'application/vnd.github.v3+json'
            }
            response = requests.get(
                f'{self.api_base_url}/pulls/{pr_number}',
                headers=headers,
                timeout=10
            )
            return response.status_code == 200
        except Exception as e:
            print(f"  [ERROR] Failed to verify PR #{pr_number}: {e}")
            return False
    
    def get_commits_for_pr(self, pr_number: str) -> List[str]:
        """Get all commits associated with a PR."""
        if not self.api_base_url or not self.auth_token:
            return []
        
        try:
            headers = {
                'Authorization': f'Bearer {self.auth_token}',
                'Accept': 'application/vnd.github.v3+json'
            }
            response = requests.get(
                f'{self.api_base_url}/pulls/{pr_number}/commits',
                headers=headers,
                timeout=10
            )
            if response.status_code == 200:
                commits = response.json()
                return [c['sha'] for c in commits]
        except Exception as e:
            print(f"  [ERROR] Failed to get commits for PR #{pr_number}: {e}")
        return []


class ReleaseTagTool:
    """Main tool for release tag management."""
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.git = GitHelper()
        self.jira = JiraHelper(
            self.config.get('jira_base_url'),
            self.config.get('jira_auth_token')
        )
        self.pr_tool = PRToolHelper(
            self.config.get('pr_tool_base_url'),
            self.config.get('pr_tool_auth_token')
        )
    
    def process_tag(self, tag: str, previous_tag: Optional[str] = None,
                    verify_jira: bool = True, verify_pr: bool = True,
                    push_to_jira: bool = False, add_labels: bool = False) -> LabelBundle:
        """Process a release tag and generate a label bundle."""
        
        print(f"\n{'='*60}")
        print(f"Processing Release Tag: {tag}")
        print(f"{'='*60}\n")
        
        # Validate tag exists
        if not GitHelper.tag_exists(tag):
            print(f"[ERROR] Tag '{tag}' does not exist!")
            sys.exit(1)
        
        # Determine previous tag if not provided
        if not previous_tag:
            previous_tag = GitHelper.get_previous_tag(tag)
            if previous_tag:
                print(f"Auto-detected previous tag: {previous_tag}")
        
        # Fetch commits
        print(f"\nFetching commits for tag: {tag}")
        if previous_tag:
            print(f"  (since: {previous_tag})")
            commits_data = GitHelper.get_commits_between_tags(previous_tag, tag)
        else:
            commits_data = GitHelper.get_commits_for_tag(tag)
        
        print(f"Found {len(commits_data)} commits\n")
        
        # Process each commit
        commits: List[Commit] = []
        all_jira_ids: Set[str] = set()
        missing_in_jira: List[str] = []
        missing_in_pr_tool: List[str] = []
        
        for idx, commit_data in enumerate(commits_data, 1):
            print(f"Processing commit {idx}/{len(commits_data)}: {commit_data['short_sha']}")
            
            commit = Commit(
                sha=commit_data['sha'],
                short_sha=commit_data['short_sha'],
                message=commit_data['message'],
                author=commit_data['author'],
                date=commit_data['date']
            )
            
            # Extract JIRA IDs
            jira_ids = self.jira.extract_jira_ids(commit_data['message'])
            commit.jira_ids = jira_ids
            all_jira_ids.update(jira_ids)
            
            if jira_ids:
                print(f"  Found JIRA IDs: {', '.join(jira_ids)}")
            
            # Extract PR number
            pr_number = self.pr_tool.extract_pr_number(commit_data['message'])
            if pr_number:
                commit.pr_number = pr_number
                print(f"  Found PR: #{pr_number}")
            
            # Verify in JIRA
            if verify_jira and jira_ids:
                for jira_id in jira_ids:
                    if self.jira.verify_jira_exists(jira_id):
                        commit.verified_in_jira = True
                        print(f"  [OK] JIRA {jira_id} verified")
                        
                        if push_to_jira:
                            if self.jira.add_commit_to_jira(jira_id, commit.sha, commit.message):
                                print(f"  [OK] Commit added to JIRA {jira_id}")
                    else:
                        missing_in_jira.append(f"{commit.short_sha}: {jira_id}")
                        print(f"  [WARN] JIRA {jira_id} not found/verified")
            elif verify_jira and not jira_ids:
                missing_in_jira.append(f"{commit.short_sha}: No JIRA ID in commit message")
            
            # Verify in PR tool
            if verify_pr and pr_number:
                if self.pr_tool.verify_pr_exists(pr_number):
                    commit.verified_in_pr_tool = True
                    print(f"  [OK] PR #{pr_number} verified")
                else:
                    missing_in_pr_tool.append(f"{commit.short_sha}: PR #{pr_number}")
                    print(f"  [WARN] PR #{pr_number} not verified")
            elif verify_pr and not pr_number:
                missing_in_pr_tool.append(f"{commit.short_sha}: No PR reference")
            
            # Get existing labels
            commit.labels = GitHelper.get_labels_for_commit(commit.sha)
            
            # Add label if requested
            if add_labels:
                label_name = f"release-{tag}-{commit.short_sha}"
                if label_name not in commit.labels:
                    if GitHelper.create_label(label_name, commit.sha):
                        commit.labels.append(label_name)
                        print(f"  [OK] Label created: {label_name}")
            
            commits.append(commit)
        
        # Create comparison summary
        comparison_summary = None
        if previous_tag:
            comparison_summary = self._create_comparison_summary(previous_tag, tag, commits)
        
        # Collect all labels applied
        all_labels = set()
        for commit in commits:
            all_labels.update(commit.labels)
        
        # Create the Label Bundle
        label_bundle = LabelBundle(
            tag=tag,
            previous_tag=previous_tag,
            created_at=datetime.now().isoformat(),
            total_commits=len(commits),
            commits=commits,
            jira_ids=all_jira_ids,
            missing_in_jira=missing_in_jira,
            missing_in_pr_tool=missing_in_pr_tool,
            labels_applied=list(all_labels),
            comparison_summary=comparison_summary
        )
        
        return label_bundle
    
    def _create_comparison_summary(self, tag1: str, tag2: str, commits: List[Commit]) -> Dict:
        """Create a summary comparing two tags."""
        return {
            'previous_tag': tag1,
            'current_tag': tag2,
            'total_commits': len(commits),
            'commits_with_jira': sum(1 for c in commits if c.jira_ids),
            'commits_without_jira': sum(1 for c in commits if not c.jira_ids),
            'commits_with_pr': sum(1 for c in commits if c.pr_number),
            'commits_without_pr': sum(1 for c in commits if not c.pr_number),
            'unique_jira_ids': len(set(jid for c in commits for jid in c.jira_ids)),
            'verified_in_jira': sum(1 for c in commits if c.verified_in_jira),
            'verified_in_pr_tool': sum(1 for c in commits if c.verified_in_pr_tool)
        }
    
    def compare_labels(self, label1: str, label2: str) -> Dict:
        """Compare two labels/tags and show the differences."""
        print(f"\nComparing: {label1} vs {label2}\n")
        
        commits1 = set(c['sha'] for c in GitHelper.get_commits_for_tag(label1))
        commits2 = set(c['sha'] for c in GitHelper.get_commits_for_tag(label2))
        
        only_in_first = commits1 - commits2
        only_in_second = commits2 - commits1
        common = commits1 & commits2
        
        return {
            'label1': label1,
            'label2': label2,
            'commits_in_first': len(commits1),
            'commits_in_second': len(commits2),
            'only_in_first': list(only_in_first),
            'only_in_second': list(only_in_second),
            'common_commits': len(common)
        }
    
    def generate_report(self, bundle: LabelBundle, output_format: str = 'json') -> str:
        """Generate a report from the label bundle."""
        if output_format == 'json':
            return self._generate_json_report(bundle)
        elif output_format == 'markdown':
            return self._generate_markdown_report(bundle)
        elif output_format == 'text':
            return self._generate_text_report(bundle)
        else:
            return self._generate_json_report(bundle)
    
    def _generate_json_report(self, bundle: LabelBundle) -> str:
        """Generate JSON report."""
        data = {
            'tag': bundle.tag,
            'previous_tag': bundle.previous_tag,
            'created_at': bundle.created_at,
            'total_commits': bundle.total_commits,
            'jira_ids': list(bundle.jira_ids),
            'missing_in_jira': bundle.missing_in_jira,
            'missing_in_pr_tool': bundle.missing_in_pr_tool,
            'labels_applied': bundle.labels_applied,
            'comparison_summary': bundle.comparison_summary,
            'commits': [
                {
                    'sha': c.sha,
                    'short_sha': c.short_sha,
                    'message': c.message,
                    'author': c.author,
                    'date': c.date,
                    'jira_ids': c.jira_ids,
                    'pr_number': c.pr_number,
                    'labels': c.labels,
                    'verified_in_jira': c.verified_in_jira,
                    'verified_in_pr_tool': c.verified_in_pr_tool
                }
                for c in bundle.commits
            ]
        }
        return json.dumps(data, indent=2)
    
    def _generate_markdown_report(self, bundle: LabelBundle) -> str:
        """Generate Markdown report."""
        lines = [
            f"# Release Label Bundle: {bundle.tag}",
            "",
            f"**Generated:** {bundle.created_at}",
            f"**Previous Tag:** {bundle.previous_tag or 'N/A'}",
            f"**Total Commits:** {bundle.total_commits}",
            "",
            "## Summary",
            "",
            f"- **JIRA IDs Found:** {len(bundle.jira_ids)}",
            f"- **Labels Applied:** {len(bundle.labels_applied)}",
            f"- **Missing JIRA References:** {len(bundle.missing_in_jira)}",
            f"- **Missing PR References:** {len(bundle.missing_in_pr_tool)}",
            ""
        ]
        
        if bundle.comparison_summary:
            lines.extend([
                "## Comparison Summary",
                "",
                f"| Metric | Value |",
                f"|--------|-------|",
                f"| Previous Tag | {bundle.comparison_summary['previous_tag']} |",
                f"| Current Tag | {bundle.comparison_summary['current_tag']} |",
                f"| Total Commits | {bundle.comparison_summary['total_commits']} |",
                f"| Commits with JIRA | {bundle.comparison_summary['commits_with_jira']} |",
                f"| Commits without JIRA | {bundle.comparison_summary['commits_without_jira']} |",
                f"| Commits with PR | {bundle.comparison_summary['commits_with_pr']} |",
                f"| Verified in JIRA | {bundle.comparison_summary['verified_in_jira']} |",
                f"| Verified in PR Tool | {bundle.comparison_summary['verified_in_pr_tool']} |",
                ""
            ])
        
        lines.extend([
            "## JIRA IDs",
            "",
            ", ".join(sorted(bundle.jira_ids)) if bundle.jira_ids else "_No JIRA IDs found_",
            "",
            "## Commits",
            "",
            "| SHA | Message | Author | JIRA | PR |",
            "|-----|---------|--------|------|-----|"
        ])
        
        for commit in bundle.commits:
            jira_str = ", ".join(commit.jira_ids) if commit.jira_ids else "-"
            pr_str = f"#{commit.pr_number}" if commit.pr_number else "-"
            message = commit.message[:50] + "..." if len(commit.message) > 50 else commit.message
            lines.append(f"| {commit.short_sha} | {message} | {commit.author} | {jira_str} | {pr_str} |")
        
        if bundle.missing_in_jira:
            lines.extend([
                "",
                "## ⚠️ Missing JIRA References",
                ""
            ])
            for item in bundle.missing_in_jira:
                lines.append(f"- {item}")
        
        if bundle.missing_in_pr_tool:
            lines.extend([
                "",
                "## ⚠️ Missing PR References",
                ""
            ])
            for item in bundle.missing_in_pr_tool:
                lines.append(f"- {item}")
        
        return "\n".join(lines)
    
    def _generate_text_report(self, bundle: LabelBundle) -> str:
        """Generate plain text report."""
        lines = [
            "=" * 60,
            f"RELEASE LABEL BUNDLE: {bundle.tag}",
            "=" * 60,
            "",
            f"Generated: {bundle.created_at}",
            f"Previous Tag: {bundle.previous_tag or 'N/A'}",
            f"Total Commits: {bundle.total_commits}",
            "",
            "-" * 40,
            "SUMMARY",
            "-" * 40,
            f"JIRA IDs Found: {len(bundle.jira_ids)}",
            f"Labels Applied: {len(bundle.labels_applied)}",
            f"Missing JIRA References: {len(bundle.missing_in_jira)}",
            f"Missing PR References: {len(bundle.missing_in_pr_tool)}",
            "",
            "-" * 40,
            "ALL JIRA IDs",
            "-" * 40,
            ", ".join(sorted(bundle.jira_ids)) if bundle.jira_ids else "No JIRA IDs found",
            "",
            "-" * 40,
            "ALL COMMIT IDs (Label Bundle)",
            "-" * 40
        ]
        
        for commit in bundle.commits:
            lines.append(f"{commit.sha} | {commit.short_sha} | {commit.message[:40]}")
        
        if bundle.missing_in_jira:
            lines.extend([
                "",
                "-" * 40,
                "WARNING: Missing JIRA References",
                "-" * 40
            ])
            for item in bundle.missing_in_jira:
                lines.append(f"  - {item}")
        
        return "\n".join(lines)


def main():
    """Main entry point for the release tag tool."""
    parser = argparse.ArgumentParser(
        description="Release Tag Tool - Manage release tags and commit verification",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage - process a tag
  python release_tag_tool.py --tag r12.3.5

  # Compare with specific previous tag
  python release_tag_tool.py --tag r12.3.5 --previous-tag r12.3.4

  # Generate markdown report
  python release_tag_tool.py --tag r12.3.5 --format markdown --output release_report.md

  # Push commit info to JIRA
  python release_tag_tool.py --tag r12.3.5 --push-to-jira

  # Compare two tags/labels
  python release_tag_tool.py --compare r12.3.4 r12.3.5

  # Add labels to commits
  python release_tag_tool.py --tag r12.3.5 --add-labels

Environment Variables:
  JIRA_BASE_URL       - Base URL for JIRA API (e.g., https://company.atlassian.net)
  JIRA_AUTH_TOKEN     - JIRA API authentication token
  PR_TOOL_BASE_URL    - Base URL for PR tool API (e.g., https://api.github.com/repos/owner/repo)
  PR_TOOL_AUTH_TOKEN  - PR tool API authentication token
        """
    )
    
    parser.add_argument(
        '--tag', '-t',
        help='Release tag to process (e.g., r12.3.5)'
    )
    parser.add_argument(
        '--previous-tag', '-p',
        help='Previous tag to compare against (auto-detected if not provided)'
    )
    parser.add_argument(
        '--compare', '-c',
        nargs=2,
        metavar=('TAG1', 'TAG2'),
        help='Compare two tags/labels'
    )
    parser.add_argument(
        '--format', '-f',
        choices=['json', 'markdown', 'text'],
        default='text',
        help='Output format (default: text)'
    )
    parser.add_argument(
        '--output', '-o',
        help='Output file (default: stdout)'
    )
    parser.add_argument(
        '--verify-jira',
        action='store_true',
        default=True,
        help='Verify commits in JIRA (default: True)'
    )
    parser.add_argument(
        '--no-verify-jira',
        action='store_false',
        dest='verify_jira',
        help='Skip JIRA verification'
    )
    parser.add_argument(
        '--verify-pr',
        action='store_true',
        default=True,
        help='Verify commits in PR tool (default: True)'
    )
    parser.add_argument(
        '--no-verify-pr',
        action='store_false',
        dest='verify_pr',
        help='Skip PR tool verification'
    )
    parser.add_argument(
        '--push-to-jira',
        action='store_true',
        help='Push commit information to JIRA tickets'
    )
    parser.add_argument(
        '--add-labels',
        action='store_true',
        help='Add release labels to commits'
    )
    parser.add_argument(
        '--list-tags',
        action='store_true',
        help='List all available tags'
    )
    parser.add_argument(
        '--config',
        help='Path to JSON configuration file'
    )
    
    args = parser.parse_args()
    
    # Load config if provided
    config = {}
    if args.config:
        with open(args.config, 'r') as f:
            config = json.load(f)
    
    # Create tool instance
    tool = ReleaseTagTool(config)
    
    # List tags
    if args.list_tags:
        tags = GitHelper.get_all_tags()
        print("Available tags:")
        for tag in sorted(tags):
            print(f"  {tag}")
        return
    
    # Compare tags
    if args.compare:
        result = tool.compare_labels(args.compare[0], args.compare[1])
        output = json.dumps(result, indent=2)
        if args.output:
            with open(args.output, 'w') as f:
                f.write(output)
            print(f"Comparison written to {args.output}")
        else:
            print(output)
        return
    
    # Process tag
    if not args.tag:
        parser.print_help()
        print("\nError: --tag is required unless using --list-tags or --compare")
        sys.exit(1)
    
    bundle = tool.process_tag(
        tag=args.tag,
        previous_tag=args.previous_tag,
        verify_jira=args.verify_jira,
        verify_pr=args.verify_pr,
        push_to_jira=args.push_to_jira,
        add_labels=args.add_labels
    )
    
    # Generate report
    report = tool.generate_report(bundle, args.format)
    
    if args.output:
        with open(args.output, 'w') as f:
            f.write(report)
        print(f"\nReport written to {args.output}")
    else:
        print("\n" + "=" * 60)
        print("LABEL BUNDLE OUTPUT")
        print("=" * 60)
        print(report)


if __name__ == '__main__':
    main()
