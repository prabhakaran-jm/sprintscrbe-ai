# Privacy Policy for SprintScribe AI

**Last Updated:** December 2025

## Overview

SprintScribe AI is a Forge app for Atlassian Confluence that helps transform meeting transcripts into actionable Jira issues. This privacy policy explains how SprintScribe AI handles data.

## Data Storage

SprintScribe AI stores meeting data using **Atlassian Forge Storage API**, which is part of Atlassian's infrastructure. All data is stored within your Atlassian Cloud instance and is **not shared with third parties**.

### What Data is Stored

- **Meeting transcripts** (text you paste into the macro)
- **Analysis results** (extracted suggestions, decisions, action items)
- **Meeting summaries** (generated summaries)
- **Created Jira issue keys** (references to issues created from action items)
- **Session state** (IDLE/RUNNING status per Confluence page)

### Data Scoping

All data is **scoped per Confluence page** using `contentId`-scoped storage keys:
- `sprintscrbe:${contentId}:session`
- `sprintscrbe:${contentId}:analysis`
- `sprintscrbe:${contentId}:meeting`
- `sprintscrbe:${contentId}:createdIssues`

This ensures that:
- Each Confluence page maintains independent meeting data
- Data is isolated between different pages
- Only users with access to the page can view the data

## Data Access

- **Access Control:** Only users with access to the Confluence page can view the meeting data stored by SprintScribe AI
- **No External Access:** Data is stored within Atlassian's infrastructure and is not accessible outside your Atlassian Cloud instance
- **User Control:** Users can clear session data using the "Clear Session" or "Reset Meeting" buttons in the macro UI

## Third-Party Services

SprintScribe AI integrates with the following Atlassian services:

1. **Atlassian Jira**
   - Creates Jira issues from extracted action items
   - Searches for Jira users for assignment
   - All API calls are made using Atlassian's official APIs

2. **Atlassian Confluence**
   - Reads page context (contentId, spaceId)
   - Updates pages with meeting summaries (via Rovo Agent)
   - All API calls are made using Atlassian's official APIs

3. **Atlassian Rovo**
   - Uses Rovo Agent for AI-powered extraction of decisions and action items
   - Rovo processes transcripts using LLM (Large Language Model)
   - Rovo is an Atlassian service, and data processing follows Atlassian's privacy policies

**No data is transmitted to external services outside of Atlassian's infrastructure.**

## AI Processing (Rovo Agent)

When using the Rovo Agent feature:
- Meeting transcripts are processed by Atlassian Rovo's LLM
- The LLM extracts decisions and action items
- Processed data is used to create Jira issues and update Confluence pages
- Rovo processing follows Atlassian's privacy and data handling policies

## Data Retention

- Data is stored in Forge Storage API until:
  - User explicitly clears it using "Clear Session" or "Reset Meeting"
  - The Confluence page is deleted
  - The app is uninstalled from your site

## Security

- All data storage uses Atlassian Forge Storage API, which provides:
  - Encryption at rest
  - Access control via Atlassian permissions
  - Compliance with Atlassian's security standards

## Permissions

SprintScribe AI requires the following permissions (scopes):
- `storage:app` - Store per-page meeting data
- `read:jira-work` - Read Jira projects and issues
- `write:jira-work` - Create Jira issues and comments
- `read:jira-user` - Search for Jira users (for assignment)
- `read:page:confluence` - Read Confluence pages (for Rovo Agent)
- `write:page:confluence` - Update Confluence pages (for Rovo Agent)

These permissions are clearly displayed during app installation, and you can review them in the app's manifest.

## Personal Data Declaration

**SprintScribe AI does NOT:**
- Copy personal data to external systems
- Cache data for longer than 24 hours outside Atlassian infrastructure
- Store personal data in third-party services
- Share data with third parties

All data remains within your Atlassian Cloud instance.

## Changes to This Policy

This privacy policy may be updated from time to time. The "Last Updated" date at the top indicates when changes were last made.

## Contact

For privacy concerns or questions about data handling:
- **GitHub Issues:** https://github.com/prabhakaran-jm/sprintscrbe-ai/issues
- **Repository:** https://github.com/prabhakaran-jm/sprintscrbe-ai

## Compliance

SprintScribe AI is built on Atlassian Forge, which complies with:
- Atlassian's security and privacy standards
- Data residency requirements (data stored in your Atlassian Cloud region)
- GDPR compliance (when applicable, through Atlassian's infrastructure)

---

**Note:** This is a hackathon project (CodeGeist 2025). For production use, additional privacy considerations may apply.

