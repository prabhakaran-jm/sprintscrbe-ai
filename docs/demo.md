# SprintScribe AI — Demo Guide

This document provides demo transcripts and validation checklists for testing SprintScribe AI.

## Demo Transcripts

### 1. Sprint Planning

```text
Sprint Planning Meeting — Q1 2025
Context: Planning next sprint for the engineering team.

Decision: We will focus on the authentication refactor as the top priority.
We agreed to allocate 3 developers to this effort.
Decision: We decided to postpone the UI redesign until next quarter.

Action: Sarah will create the sprint backlog by Friday.
Owner: Sarah
Due: 2025-01-17

Action: Mike will review the API documentation and provide feedback.
Owner: Mike
Due: 2025-01-18

Raj will update the project timeline by end of week.
Owner: Raj

Suggestion: Consider breaking the auth refactor into smaller stories.
Suggestion: Add a daily standup to track progress.
```

**Expected Outputs:**

**Suggestions:**
- Consider breaking the auth refactor into smaller stories.
- Add a daily standup to track progress.

**Decisions:**
- Decision: We will focus on the authentication refactor as the top priority.
- We agreed to allocate 3 developers to this effort.
- Decision: We decided to postpone the UI redesign until next quarter.

**Action Items:**
- **High Confidence**: "Sarah will create the sprint backlog by Friday." (Owner: Sarah, Due: 2025-01-17)
- **High Confidence**: "Mike will review the API documentation and provide feedback." (Owner: Mike, Due: 2025-01-18)
- **Medium Confidence**: "Raj will update the project timeline by end of week." (Owner: Raj)

---

### 2. Bug Triage

```text
Bug Triage Meeting — January 2025
Context: Reviewing critical bugs reported this week.

Decision: We decided to prioritize P1 bugs for immediate fix.
We agreed that P2 bugs can wait until next release.
Decision: We will create a dedicated bug triage process.

Action: Anita will investigate the login timeout issue.
Owner: Anita
Due: 2025-01-16

Action: Ben will fix the data export bug by tomorrow.
Owner: Ben
Due: 2025-01-15

Action: Lisa will document the new triage process.
Owner: Lisa
Due: 2025-01-20

Suggestion: Set up automated bug reporting.
Suggestion: Create a bug severity matrix.
```

**Expected Outputs:**

**Suggestions:**
- Set up automated bug reporting.
- Create a bug severity matrix.

**Decisions:**
- Decision: We decided to prioritize P1 bugs for immediate fix.
- We agreed that P2 bugs can wait until next release.
- Decision: We will create a dedicated bug triage process.

**Action Items:**
- **High Confidence**: "Anita will investigate the login timeout issue." (Owner: Anita, Due: 2025-01-16)
- **High Confidence**: "Ben will fix the data export bug by tomorrow." (Owner: Ben, Due: 2025-01-15)
- **High Confidence**: "Lisa will document the new triage process." (Owner: Lisa, Due: 2025-01-20)

---

### 3. Stakeholder Review

```text
Stakeholder Review — Product Launch Prep
Context: Final review before product launch next month.

Decision: We decided to launch with core features only.
We agreed to defer advanced features to v2.
Decision: We will schedule a go-live meeting for next week.

Action: Tom will prepare the launch checklist.
Owner: Tom
Due: 2025-01-22

Action: Emma will coordinate with marketing for announcements.
Owner: Emma
Due: 2025-01-25

Action: David will complete security audit by end of month.
Owner: David
Due: 2025-01-31

Suggestion: Consider a soft launch with limited users first.
Suggestion: Prepare rollback plan in case of issues.
```

**Expected Outputs:**

**Suggestions:**
- Consider a soft launch with limited users first.
- Prepare rollback plan in case of issues.

**Decisions:**
- Decision: We decided to launch with core features only.
- We agreed to defer advanced features to v2.
- Decision: We will schedule a go-live meeting for next week.

**Action Items:**
- **High Confidence**: "Tom will prepare the launch checklist." (Owner: Tom, Due: 2025-01-22)
- **High Confidence**: "Emma will coordinate with marketing for announcements." (Owner: Emma, Due: 2025-01-25)
- **High Confidence**: "David will complete security audit by end of month." (Owner: David, Due: 2025-01-31)

---

## Validation Checklist

Use this checklist to validate the demo flow and persistence:

### Pre-Demo Setup

- [ ] App is deployed to development environment
- [ ] App is installed on Confluence + Jira site
- [ ] Jira project is available and accessible
- [ ] Test user has permissions to create Jira issues

### Demo Flow Validation

#### Step 1: Start Session
- [ ] Click "Start Session" button
- [ ] Status badge changes to "RUNNING" (green)
- [ ] Transcript textarea becomes enabled
- [ ] Demo Scenario dropdown appears

#### Step 2: Load Demo Transcript
- [ ] Select a demo scenario from dropdown
- [ ] Click "Load" button
- [ ] Transcript textarea is populated with demo transcript
- [ ] Success message appears: "Demo transcript [scenario] loaded."

#### Step 3: Analyze
- [ ] Click "Analyze" button
- [ ] Success message shows counts: "Analysis complete. Found X suggestions, Y decisions, and Z action items."
- [ ] Suggestions panel shows extracted suggestions
- [ ] Decisions Log panel shows extracted decisions
- [ ] Action Items panel shows extracted action items with confidence badges
- [ ] Action items are grouped in "Draft Action Items" section

#### Step 4: Generate Summary
- [ ] Click "Generate Summary" button
- [ ] Success message appears: "Summary generated."
- [ ] Meeting Summary panel appears above Decisions Log
- [ ] Summary shows "What was discussed" (first 2 lines)
- [ ] Summary shows Decisions list
- [ ] Summary shows Actions list with owner/due date info

#### Step 5: Create Jira Issues
- [ ] Select Jira project from dropdown
- [ ] Check at least one action item
- [ ] Optionally edit Owner and Due Date fields
- [ ] Click "Create Jira Issues" button
- [ ] Success: Issues are created in Jira
- [ ] Action items move to "Published Action Items" section
- [ ] Status labels show "Published: [ISSUE-KEY]"
- [ ] Created Jira Issues section appears with issue links
- [ ] Published items are disabled (no checkbox/inputs)

#### Step 6: Verify Persistence
- [ ] Refresh the Confluence page (F5)
- [ ] Transcript text persists in textarea
- [ ] Analysis results persist (suggestions, decisions, action items)
- [ ] Meeting Summary persists and displays
- [ ] Created issues list persists
- [ ] Published action items show correct issue keys
- [ ] Session status resets to IDLE (expected behavior)

### Reset Meeting Validation

- [ ] Click "Reset Meeting" button
- [ ] Confirmation dialog appears
- [ ] On confirm: Transcript is cleared
- [ ] Analysis is cleared (panels show empty state)
- [ ] Summary is cleared (panel disappears)
- [ ] Session status resets to IDLE
- [ ] Created issues are preserved (for traceability)
- [ ] Success message: "Meeting reset. Ready for new transcript."

### Per-Page Isolation Validation

- [ ] Create two Confluence pages (Page A and Page B)
- [ ] Add SprintScribe AI macro to both pages
- [ ] On Page A: Start session, load transcript, analyze
- [ ] On Page B: Verify it shows IDLE state (not affected by Page A)
- [ ] On Page B: Start session, load different transcript, analyze
- [ ] Verify both pages maintain independent state
- [ ] Refresh both pages: Each maintains its own data

### Error Handling Validation

- [ ] Try Generate Summary before Analyze → Info message appears
- [ ] Try Create Jira Issues without selecting project → Button disabled
- [ ] Try Create Jira Issues without selecting items → Button disabled
- [ ] Invalid Jira project → Error message appears
- [ ] Network error → Error message appears with details

## Troubleshooting

### Issue: "Failed to load Jira projects"
- **Solution**: Ensure app is installed with correct scopes. Run `forge install --upgrade` after adding scopes.

### Issue: "Generate Summary does nothing"
- **Solution**: Run "Analyze" first. The summary requires analysis data.

### Issue: Action items not showing confidence badges
- **Solution**: Ensure you're using the latest deployed version. Confidence badges were added in Step 5.

### Issue: Data not persisting after refresh
- **Solution**: Check browser console for errors. Verify `contentId` is available in context.

### Issue: Created issues not appearing
- **Solution**: Check Jira project permissions. Verify user has create issue permissions.

## Demo Tips

1. **Use Demo Scenarios**: The pre-loaded transcripts are optimized for extraction
2. **Show Confidence**: Point out the color-coded confidence badges (green/yellow/grey)
3. **Demonstrate Persistence**: Refresh the page to show data persists
4. **Show Traceability**: Click a created Jira issue link to show the enriched description
5. **Reset for Repeat**: Use "Reset Meeting" to quickly start a new demo

## Expected Jira Issue Description Format

When action items are created as Jira issues, the description should include:

```
Source: https://your-site.atlassian.net/wiki/spaces/*/pages/[contentId]

Meeting Summary:
[First 2 lines of transcript]

Extracted from transcript: [Original action item line]
```

This provides full traceability from Jira issue back to the Confluence meeting page.

