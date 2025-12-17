import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import { view } from '@forge/bridge';

function App() {
  // Session status: 'IDLE' | 'RUNNING'
  const [sessionStatus, setSessionStatus] = useState('IDLE');
  // Content ID from context
  const [contentId, setContentId] = useState(null);
  // Site URL and page URL for Jira issue enrichment
  const [siteUrl, setSiteUrl] = useState(null);
  const [pageUrl, setPageUrl] = useState(null);
  // Transcript text
  const [transcriptText, setTranscriptText] = useState('');
  // Analysis results
  const [analysis, setAnalysis] = useState({
    suggestions: [],
    decisions: [],
    actionItems: []
  });
  // Jira projects
  const [jiraProjects, setJiraProjects] = useState([]);
  const [selectedProjectKey, setSelectedProjectKey] = useState('');
  // Selected action items with editable fields
  const [selectedActionItems, setSelectedActionItems] = useState([]);
  // Created issues
  const [createdIssues, setCreatedIssues] = useState([]);
  // Meeting state
  const [meeting, setMeeting] = useState({
    transcriptText: '',
    summary: '',
    createdIssueKeys: [],
    updatedAt: null
  });
  // Summary (parsed from meeting.summary)
  const [summary, setSummary] = useState(null);
  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  // Analyzing state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // Analyzing with AI state
  const [isAnalyzingWithAI, setIsAnalyzingWithAI] = useState(false);
  // Creating issues state
  const [isCreatingIssues, setIsCreatingIssues] = useState(false);
  // Generating summary state
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  // Error state
  const [error, setError] = useState(null);
  // Debug info
  const [debugInfo, setDebugInfo] = useState({
    lastAction: null,
    lastResult: null,
    lastError: null
  });
  const [showDebug, setShowDebug] = useState(false);
  // UI message for user guidance (info/error/success)
  const [uiMessage, setUiMessage] = useState(null);
  // Track if Analyze has been run in the current session (not just loaded from storage)
  const [hasAnalyzedInSession, setHasAnalyzedInSession] = useState(false);
  // Selected demo scenario
  const [selectedDemoScenario, setSelectedDemoScenario] = useState('');

  // Load contentId, session state, and analysis on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Get contentId and URLs from context
        const context = await view.getContext();
        const contentIdValue = context?.extension?.content?.id || context?.content?.id;
        
        // Extract site base URL (e.g., https://tenant.atlassian.net)
        // Try multiple possible locations in context, including window.location as fallback
        let rawBaseUrl = context?.extension?.baseUrl || 
                        context?.baseUrl || 
                        (context?.extension?.host ? `https://${context.extension.host}` : null);
        
        // If we got a CDN URL, try to extract hostname from it (e.g., _hostname_tenant.atlassian.net)
        // This handles cases where Forge provides CDN URLs in the context
        if (rawBaseUrl && rawBaseUrl.includes('_hostname_')) {
          const hostnameMatch = rawBaseUrl.match(/_hostname_([^\/]+)/);
          if (hostnameMatch && hostnameMatch[1]) {
            rawBaseUrl = `https://${hostnameMatch[1]}`;
          }
        }
        
        // Fallback: try to extract from window.location if context didn't provide it
        // In Forge Custom UI, window.location may be a CDN URL, so we need to extract the hostname from the path
        if (!rawBaseUrl && typeof window !== 'undefined' && window.location) {
          try {
            const location = window.location;
            // Check if URL contains _hostname_ pattern (CDN URL case)
            if (location.href && location.href.includes('_hostname_')) {
              const hostnameMatch = location.href.match(/_hostname_([^\/]+)/);
              if (hostnameMatch && hostnameMatch[1]) {
                rawBaseUrl = `https://${hostnameMatch[1]}`;
              }
            } else if (location.hostname && location.hostname.includes('.atlassian.net')) {
              // Direct site URL (not CDN)
              rawBaseUrl = `${location.protocol}//${location.hostname}`;
            }
          } catch (e) {
            // Ignore errors
          }
        }
        
        // Normalize baseUrl to strip /wiki or any path (same logic as backend)
        const baseUrl = rawBaseUrl ? (() => {
          try {
            const u = new URL(rawBaseUrl);
            return `${u.protocol}//${u.host}`;
          } catch {
            return rawBaseUrl.replace(/\/wiki\/?$/, '').replace(/\/$/, '');
          }
        })() : null;
        
        // Extract or construct page URL
        // Best effort: try to get full URL from context
        // Note: We don't construct /wiki/pages/{contentId} as it's invalid without space key
        // Backend will fetch space key from API if needed
        let pageUrlValue = null;
        if (context?.extension?.content?.url) {
          // If full URL is available in context, use it (should include space key)
          pageUrlValue = context.extension.content.url;
        }
        // Don't construct invalid URL - let backend fetch space key from API
        
        if (contentIdValue) {
          setContentId(contentIdValue);
          // Set URLs if available (will be passed to backend for Jira issue enrichment)
          if (baseUrl) {
            setSiteUrl(baseUrl);
          }
          if (pageUrlValue) {
            setPageUrl(pageUrlValue);
          }
          
          // Initialize variables for debug info
          let sessionResult = null;
          let analysisResult = null;
          
          // Load session state (per-page) - wrap in try-catch for resilience
          try {
            sessionResult = await invoke('getSessionState', { contentId: contentIdValue });
            if (sessionResult && sessionResult.status) {
              setSessionStatus(sessionResult.status);
            }
          } catch (sessionError) {
            console.warn('Error loading session state:', sessionError);
            // Continue with default IDLE state
          }
          
          // Load meeting state - wrap in try-catch for resilience
          try {
            const meetingResult = await invoke('getMeeting', { contentId: contentIdValue });
            if (meetingResult) {
              setMeeting(meetingResult);
              // Hydrate transcript text from meeting state (this happens during initial load)
              if (meetingResult.transcriptText) {
                // Set transcript text - this will be ignored by debounced save due to isInitialLoad flag
                setTranscriptText(meetingResult.transcriptText);
              }
              // Parse and set summary if available
              if (meetingResult.summary) {
                try {
                  const parsedSummary = typeof meetingResult.summary === 'string' 
                    ? JSON.parse(meetingResult.summary) 
                    : meetingResult.summary;
                  setSummary(parsedSummary);
                } catch (e) {
                  console.warn('Failed to parse summary:', e);
                }
              }
            }
          } catch (meetingError) {
            console.warn('Error loading meeting state:', meetingError);
            // Continue without meeting data
          }
          
          // Mark initial load as complete after all data is loaded
          setIsInitialLoad(false);
          
          // Load analysis - wrap in try-catch for resilience
          try {
            analysisResult = await invoke('getAnalysis', { contentId: contentIdValue });
            if (analysisResult) {
              setAnalysis({
                suggestions: analysisResult.suggestions || [],
                decisions: analysisResult.decisions || [],
                actionItems: analysisResult.actionItems || []
              });
              // Note: If analysis exists from storage, Generate Summary button will be enabled
              // This is expected behavior for per-page persistence
              // Initialize selected action items (all checked by default)
              // Handle both old format (string) and new format (object with confidence)
              setSelectedActionItems(
                (analysisResult.actionItems || []).map((item, index) => {
                  // Backward compatibility: handle string items
                  if (typeof item === 'string') {
                    return {
                      index,
                      text: item,
                      selected: true,
                      owner: '',
                      dueDate: '',
                      confidence: 'low', // Default for old format
                      issueKey: null,
                      originalLine: item
                    };
                  }
                  // New format with confidence
                  return {
                    index,
                    text: item.text || item,
                    selected: true,
                    owner: item.owner || '',
                    dueDate: item.dueDate || '',
                    confidence: item.confidence || 'low',
                    issueKey: null,
                    originalLine: item.originalLine || item.text || item
                  };
                })
              );
            }
          } catch (analysisError) {
            console.warn('Error loading analysis:', analysisError);
            // Continue without analysis data
          }
          
          // Load created issues - wrap in try-catch for resilience
          try {
            const createdIssuesResult = await invoke('getCreatedIssues', { contentId: contentIdValue });
            if (createdIssuesResult) {
              setCreatedIssues(createdIssuesResult);
              // Map created issue keys back to action items
              const issueKeys = createdIssuesResult.map(issue => issue.key || issue);
              setSelectedActionItems(prev => {
                // For now, we'll match by index order (first created issue = first action item)
                // In a production system, you might want to store a mapping
                return prev.map((item, index) => {
                  if (index < issueKeys.length && issueKeys[index]) {
                    return {
                      ...item,
                      issueKey: issueKeys[index],
                      selected: false // Published items are not selected
                    };
                  }
                  return item;
                });
              });
            }
          } catch (issuesError) {
            console.warn('Error loading created issues:', issuesError);
            // Continue without created issues
          }
          
          // Load Jira projects
          try {
            const projectsResult = await invoke('listJiraProjects');
            if (projectsResult && Array.isArray(projectsResult)) {
              setJiraProjects(projectsResult);
              setDebugInfo(prev => ({
                ...prev,
                lastAction: 'listJiraProjects',
                lastResult: projectsResult
              }));
            } else {
              console.warn('listJiraProjects returned invalid result:', projectsResult);
            }
          } catch (projectsError) {
            console.error('Error loading Jira projects:', projectsError);
            setError(`Failed to load Jira projects: ${projectsError.message || projectsError}`);
            setDebugInfo(prev => ({
              ...prev,
              lastAction: 'listJiraProjects',
              lastError: projectsError.message || String(projectsError)
            }));
            // Don't fail the whole load if projects can't be loaded
          }
          
          setDebugInfo(prev => ({
            ...prev,
            lastAction: 'loadInitialData',
            lastResult: { contentId: contentIdValue, session: sessionResult, analysis: analysisResult }
          }));
        } else {
          console.warn('Could not get content ID from context:', context);
          setError('Could not determine page ID');
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
        // Check if it's a tunnel/network error
        const errorMessage = err.message || String(err);
        const isNetworkError = errorMessage.includes('ERR_CANNOT_FORWARD') || 
                              errorMessage.includes('tunnel') || 
                              errorMessage.includes('squid') ||
                              errorMessage.includes('DOCTYPE HTML');
        
        if (isNetworkError) {
          setError('Network connection issue. Please check your tunnel connection and try again. If using forge tunnel, ensure it is running.');
        } else {
          setError(`Failed to load data: ${errorMessage}`);
        }
        
        setDebugInfo(prev => ({
          ...prev,
          lastAction: 'loadInitialData',
          lastError: errorMessage
        }));
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Handler to start the session with optimistic update
  const handleStartSession = async () => {
    if (!contentId) {
      setError('Content ID not available');
      return;
    }

    // Optimistic update
    const previousStatus = sessionStatus;
    setSessionStatus('RUNNING');
    setError(null);

    try {
      const result = await invoke('setSessionState', { contentId, status: 'RUNNING' });
      
      if (result && result.status) {
        setSessionStatus(result.status);
        setDebugInfo(prev => ({
          ...prev,
          lastAction: 'setSessionState',
          lastResult: result,
          lastError: null
        }));
      }
    } catch (err) {
      console.error('Error starting session:', err);
      // Revert optimistic update
      setSessionStatus(previousStatus);
      setError(`Failed to start session: ${err.message || err}`);
      setDebugInfo(prev => ({
        ...prev,
        lastAction: 'setSessionState',
        lastError: err.message || String(err)
      }));
    }
  };

  // Handler to stop the session with optimistic update
  const handleStopSession = async () => {
    if (!contentId) {
      setError('Content ID not available');
      return;
    }

    // Optimistic update
    const previousStatus = sessionStatus;
    setSessionStatus('IDLE');
    setError(null);

    try {
      const result = await invoke('setSessionState', { contentId, status: 'IDLE' });
      
      if (result && result.status) {
        setSessionStatus(result.status);
        setDebugInfo(prev => ({
          ...prev,
          lastAction: 'setSessionState',
          lastResult: result,
          lastError: null
        }));
      }
    } catch (err) {
      console.error('Error stopping session:', err);
      // Revert optimistic update
      setSessionStatus(previousStatus);
      setError(`Failed to stop session: ${err.message || err}`);
      setDebugInfo(prev => ({
        ...prev,
        lastAction: 'setSessionState',
        lastError: err.message || String(err)
      }));
    }
  };

  // Handler to analyze transcript
  const handleAnalyze = async () => {
    if (!contentId) {
      setError('Content ID not available');
      return;
    }

    if (!transcriptText || !transcriptText.trim()) {
      setError('Please enter transcript text');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setUiMessage(null); // Clear any existing message

    try {
      const result = await invoke('analyzeTranscript', {
        contentId,
        transcriptText: transcriptText.trim()
      });

      if (result) {
        setAnalysis({
          suggestions: result.suggestions || [],
          decisions: result.decisions || [],
          actionItems: result.actionItems || []
        });
        // Mark that Analyze has been run in this session
        setHasAnalyzedInSession(true);
        // Show success message
        setUiMessage({
          type: 'success',
          text: `Analysis complete. Found ${result.suggestions?.length || 0} suggestions, ${result.decisions?.length || 0} decisions, and ${result.actionItems?.length || 0} action items.`
        });
        // Auto-clear after 4 seconds
        setTimeout(() => setUiMessage(null), 4000);
        // Update selected action items (all checked by default)
        // Handle both old format (string) and new format (object with confidence)
        const newSelectedItems = (result.actionItems || []).map((item, index) => {
          // Backward compatibility: handle string items
          if (typeof item === 'string') {
            return {
              index,
              text: item,
              selected: true,
              owner: '',
              dueDate: '',
              confidence: 'low', // Default for old format
              issueKey: null,
              originalLine: item
            };
          }
          // New format with confidence
          return {
            index,
            text: item.text || item,
            selected: true,
            owner: item.owner || '',
            dueDate: item.dueDate || '',
            confidence: item.confidence || 'low',
            issueKey: null,
            originalLine: item.originalLine || item.text || item
          };
        });
        setSelectedActionItems(newSelectedItems);
        setDebugInfo(prev => ({
          ...prev,
          lastAction: 'analyzeTranscript',
          lastResult: result,
          lastError: null
        }));
      }
    } catch (err) {
      console.error('Error analyzing transcript:', err);
      setError(`Failed to analyze transcript: ${err.message || err}`);
      setDebugInfo(prev => ({
        ...prev,
        lastAction: 'analyzeTranscript',
        lastError: err.message || String(err)
      }));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handler to analyze transcript with AI-powered extraction
  const handleAnalyzeWithAI = async () => {
    if (!contentId) {
      setError('Content ID not available');
      return;
    }

    if (!transcriptText || !transcriptText.trim()) {
      setError('Please enter transcript text');
      return;
    }

    setIsAnalyzingWithAI(true);
    setError(null);
    setUiMessage(null); // Clear any existing message

    try {
      const result = await invoke('analyzeWithAI', {
        contentId,
        transcriptText: transcriptText.trim()
      });

      if (result) {
        setAnalysis({
          suggestions: result.suggestions || [],
          decisions: result.decisions || [],
          actionItems: result.actionItems || []
        });
        // Mark that Analyze has been run in this session
        setHasAnalyzedInSession(true);
        // Show success message
        setUiMessage({
          type: 'success',
          text: `AI analysis complete. Found ${result.suggestions?.length || 0} suggestions, ${result.decisions?.length || 0} decisions, and ${result.actionItems?.length || 0} action items.`
        });
        // Auto-clear after 4 seconds
        setTimeout(() => setUiMessage(null), 4000);
        // Update selected action items (all checked by default)
        const newSelectedItems = (result.actionItems || []).map((item, index) => {
          // Handle both string and object formats
          if (typeof item === 'string') {
            return {
              index,
              text: item,
              selected: true,
              owner: '',
              dueDate: '',
              confidence: 'low',
              issueKey: null,
              originalLine: item
            };
          }
          return {
            index,
            text: item.text || item,
            selected: true,
            owner: item.owner || '',
            dueDate: item.dueDate || '',
            confidence: item.confidence || 'low',
            issueKey: null,
            originalLine: item.originalLine || item.text || item
          };
        });
        setSelectedActionItems(newSelectedItems);
        setDebugInfo(prev => ({
          ...prev,
          lastAction: 'analyzeWithAI',
          lastResult: result,
          lastError: null
        }));
      }
    } catch (err) {
      console.error('Error analyzing transcript with AI:', err);
      setError(`Failed to analyze transcript with AI: ${err.message || err}`);
      setDebugInfo(prev => ({
        ...prev,
        lastAction: 'analyzeWithAI',
        lastError: err.message || String(err)
      }));
    } finally {
      setIsAnalyzingWithAI(false);
    }
  };

  // Handler to toggle action item selection
  const toggleActionItemSelection = (index) => {
    setSelectedActionItems(prev => 
      prev.map(item => 
        item.index === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  // Handler to update action item owner
  const updateActionItemOwner = (index, owner) => {
    setSelectedActionItems(prev => 
      prev.map(item => 
        item.index === index ? { ...item, owner } : item
      )
    );
  };

  // Handler to update action item due date
  const updateActionItemDueDate = (index, dueDate) => {
    setSelectedActionItems(prev => 
      prev.map(item => 
        item.index === index ? { ...item, dueDate } : item
      )
    );
  };

  // Track if this is the initial load to prevent auto-save on hydration
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Debounced save transcript (500ms delay)
  useEffect(() => {
    // Skip auto-save on initial load (when transcript is hydrated from storage)
    if (isInitialLoad) {
      return;
    }

    if (!contentId || sessionStatus !== 'RUNNING' || !transcriptText) {
      return;
    }

    // Simple debounce implementation
    const timeoutId = setTimeout(async () => {
      if (transcriptText !== undefined && transcriptText.trim()) {
        try {
          await invoke('saveTranscript', { contentId, transcriptText });
          // Update meeting state
          setMeeting(prev => ({
            ...prev,
            transcriptText,
            updatedAt: new Date().toISOString()
          }));
        } catch (err) {
          console.error('Error saving transcript:', err);
          // Don't show error to user for background saves
        }
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [transcriptText, contentId, sessionStatus, isInitialLoad]);

  // Handler to generate summary
  const handleGenerateSummary = async () => {
    if (!contentId) {
      setError('Content ID not available');
      return;
    }

    if (!transcriptText || !transcriptText.trim()) {
      setError('Please enter transcript text');
      return;
    }

    // Guard condition: Check if Analyze has been run in the current session
    // If not, show info message to guide user immediately
    // Note: We check hasAnalyzedInSession instead of just analysis data because
    // analysis might exist from storage (per-page persistence), but user should
    // still run Analyze in the current session for fresh results
    if (!hasAnalyzedInSession) {
      setUiMessage({
        type: 'info',
        text: 'Run Analyze first to extract decisions and action items for the summary.'
      });
      // Auto-clear after 6 seconds
      setTimeout(() => setUiMessage(null), 6000);
      // Return early - don't proceed with summary generation
      setIsGeneratingSummary(false);
      return;
    }

    setIsGeneratingSummary(true);
    setError(null);

    try {
      const result = await invoke('generateSummary', {
        contentId,
        transcriptText: transcriptText.trim()
      });

      if (result) {
        setSummary(result);
        // Update meeting state
        setMeeting(prev => ({
          ...prev,
          summary: JSON.stringify(result),
          updatedAt: new Date().toISOString()
        }));
        setDebugInfo(prev => ({
          ...prev,
          lastAction: 'generateSummary',
          lastResult: result,
          lastError: null
        }));
        // Show success message
        setUiMessage({
          type: 'success',
          text: 'Summary generated.'
        });
        // Auto-clear after 4 seconds
        setTimeout(() => setUiMessage(null), 4000);
      }
    } catch (err) {
      console.error('Error generating summary:', err);
      setError(`Failed to generate summary: ${err.message || err}`);
      // Show error message
      setUiMessage({
        type: 'error',
        text: `Failed to generate summary: ${err.message || err}`
      });
      // Auto-clear after 6 seconds
      setTimeout(() => setUiMessage(null), 6000);
      setDebugInfo(prev => ({
        ...prev,
        lastAction: 'generateSummary',
        lastError: err.message || String(err)
      }));
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Handler to clear session data
  const handleClearSession = async () => {
    if (!contentId) {
      setError('Content ID not available');
      return;
    }

    // Confirm with user (simple confirmation)
    if (!window.confirm('Clear all session data? This will remove analysis, summary, and created issues for this page.')) {
      return;
    }

    try {
      await invoke('clearSessionData', { contentId });
      
      // Reset all state
      setAnalysis({
        suggestions: [],
        decisions: [],
        actionItems: []
      });
      setSelectedActionItems([]);
      setSummary(null);
      setCreatedIssues([]);
      setMeeting({
        transcriptText: '',
        summary: '',
        createdIssueKeys: [],
        updatedAt: null
      });
      setHasAnalyzedInSession(false);
      setUiMessage(null);
      setError(null);
      
      // Show success message
      setUiMessage({
        type: 'success',
        text: 'Session data cleared. Ready for new transcript.'
      });
      setTimeout(() => setUiMessage(null), 3000);
      
      setDebugInfo(prev => ({
        ...prev,
        lastAction: 'clearSessionData',
        lastResult: { success: true },
        lastError: null
      }));
    } catch (err) {
      console.error('Error clearing session data:', err);
      setError(`Failed to clear session data: ${err.message || err}`);
      setUiMessage({
        type: 'error',
        text: `Failed to clear session data: ${err.message || err}`
      });
      setTimeout(() => setUiMessage(null), 6000);
    }
  };

  // Handler to reset meeting (clears transcript, analysis, summary, but keeps created issues)
  const handleResetMeeting = async () => {
    if (!contentId) {
      setError('Content ID not available');
      return;
    }

    // Confirm with user
    if (!window.confirm('This will clear transcript, analysis, summary, and created issues for this page.')) {
      return;
    }

    try {
      await invoke('resetMeeting', { contentId });
      
      // Reset meeting-related state (clear everything including created issues)
      setAnalysis({
        suggestions: [],
        decisions: [],
        actionItems: []
      });
      setSelectedActionItems([]);
      setSummary(null);
      setTranscriptText('');
      setCreatedIssues([]);
      setMeeting({
        transcriptText: '',
        summary: '',
        createdIssueKeys: [],
        updatedAt: null
      });
      setHasAnalyzedInSession(false);
      setSessionStatus('IDLE');
      setUiMessage(null);
      setError(null);
      
      // Show success message
      setUiMessage({
        type: 'success',
        text: 'Meeting reset. Ready for new transcript.'
      });
      setTimeout(() => setUiMessage(null), 3000);
      
      setDebugInfo(prev => ({
        ...prev,
        lastAction: 'resetMeeting',
        lastResult: { success: true },
        lastError: null
      }));
    } catch (err) {
      console.error('Error resetting meeting:', err);
      setError(`Failed to reset meeting: ${err.message || err}`);
      setUiMessage({
        type: 'error',
        text: `Failed to reset meeting: ${err.message || err}`
      });
      setTimeout(() => setUiMessage(null), 6000);
    }
  };

  // Demo transcript scenarios
  const demoTranscripts = {
    'Sprint Planning': `Sprint Planning Meeting — Q1 2025
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
Suggestion: Add a daily standup to track progress.`,

    'Bug Triage': `Bug Triage Meeting — January 2025
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
Suggestion: Create a bug severity matrix.`,

    'Stakeholder Review': `Stakeholder Review — Product Launch Prep
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
Suggestion: Prepare rollback plan in case of issues.`
  };

  // Handler to load demo transcript
  const handleLoadDemoTranscript = (scenario) => {
    if (!scenario || !demoTranscripts[scenario]) {
      return;
    }

    const transcript = demoTranscripts[scenario];
    setTranscriptText(transcript);
    
    // Trigger autosave by updating meeting state
    // The debounced saveTranscript effect will handle the actual save
    setMeeting(prev => ({
      ...prev,
      transcriptText: transcript,
      updatedAt: new Date().toISOString()
    }));

    // Show success message
    setUiMessage({
      type: 'success',
      text: `Demo transcript "${scenario}" loaded.`
    });
    setTimeout(() => setUiMessage(null), 3000);
  };

  // Handler to create Jira issues
  const handleCreateJiraIssues = async () => {
    if (!contentId) {
      setError('Content ID not available');
      return;
    }

    if (!selectedProjectKey) {
      setError('Please select a Jira project');
      return;
    }

    const selectedItems = selectedActionItems.filter(item => item.selected);
    if (selectedItems.length === 0) {
      setError('Please select at least one action item');
      return;
    }

    setIsCreatingIssues(true);
    setError(null);

    try {
      const itemsToCreate = selectedItems.map(item => ({
        text: item.text,
        owner: item.owner || undefined,
        dueDate: item.dueDate || undefined,
        originalLine: item.originalLine || item.text
      }));

      const result = await invoke('createJiraIssuesFromActionItems', {
        contentId,
        projectKey: selectedProjectKey,
        items: itemsToCreate,
        // Pass siteUrl and pageUrl for proper URL construction in Jira issues
        // These are optional - backend will fallback if not provided (backward compatible)
        siteUrl: siteUrl || undefined,
        pageUrl: pageUrl || undefined
      });

      if (result && Array.isArray(result)) {
        // Update created issues list
        setCreatedIssues(prev => [...prev, ...result]);
        
        // Map created issues back to action items by index
        // Update selectedActionItems to mark which items are published
        setSelectedActionItems(prev => {
          const updated = [...prev];
          let resultIndex = 0;
          selectedItems.forEach(selectedItem => {
            const itemIndex = updated.findIndex(item => item.index === selectedItem.index);
            if (itemIndex !== -1 && resultIndex < result.length) {
              updated[itemIndex] = {
                ...updated[itemIndex],
                issueKey: result[resultIndex].key,
                selected: false // Uncheck published items
              };
              resultIndex++;
            }
          });
          return updated;
        });
        
        // Save created issue keys to meeting state
        const issueKeys = result.map(issue => issue.key || issue);
        try {
          await invoke('saveCreatedIssues', { contentId, issueKeys });
          // Update meeting state
          setMeeting(prev => ({
            ...prev,
            createdIssueKeys: [...(prev.createdIssueKeys || []), ...issueKeys],
            updatedAt: new Date().toISOString()
          }));
        } catch (saveError) {
          console.error('Error saving created issues:', saveError);
          // Don't fail the whole operation if save fails
        }
        
        setDebugInfo(prev => ({
          ...prev,
          lastAction: 'createJiraIssuesFromActionItems',
          lastResult: result,
          lastError: null
        }));
      }
    } catch (err) {
      console.error('Error creating Jira issues:', err);
      setError(`Failed to create Jira issues: ${err.message || err}`);
      setDebugInfo(prev => ({
        ...prev,
        lastAction: 'createJiraIssuesFromActionItems',
        lastError: err.message || String(err)
      }));
    } finally {
      setIsCreatingIssues(false);
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      {/* Error Banner */}
      {error && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          backgroundColor: '#FFEBE6',
          border: '1px solid #DE350B',
          borderRadius: '3px',
          color: '#DE350B'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          backgroundColor: '#F4F5F7',
          borderRadius: '3px',
          color: '#42526E'
        }}>
          Loading session status...
        </div>
      )}

      {/* Header Section */}
      <div style={{ 
        marginBottom: '24px',
        borderBottom: '2px solid #e3e5e9',
        paddingBottom: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ 
              margin: '0 0 12px 0',
              fontSize: '24px',
              fontWeight: '600',
              color: '#172B4D'
            }}>
              SprintScribe AI — Pit Crew Console
            </h1>
          </div>
          <button
            onClick={() => setShowDebug(!showDebug)}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: '#F4F5F7',
              border: '1px solid #DFE1E6',
              borderRadius: '3px',
              cursor: 'pointer',
              color: '#42526E'
            }}
          >
            {showDebug ? 'Hide' : 'Show'} Debug
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '3px',
            backgroundColor: sessionStatus === 'RUNNING' ? '#00875A' : '#DFE1E6',
            color: sessionStatus === 'RUNNING' ? '#FFFFFF' : '#42526E',
            fontSize: '12px',
            fontWeight: '600',
            textTransform: 'uppercase'
          }}>
            {sessionStatus}
          </span>
        </div>
      </div>

      {/* Control Buttons Section */}
      <div style={{ 
        marginBottom: '24px',
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={handleStartSession}
          disabled={sessionStatus === 'RUNNING'}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#FFFFFF',
            backgroundColor: sessionStatus === 'RUNNING' ? '#C1C7D0' : '#0052CC',
            border: 'none',
            borderRadius: '3px',
            cursor: sessionStatus === 'RUNNING' ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => {
            if (sessionStatus !== 'RUNNING') {
              e.target.style.backgroundColor = '#0065FF';
            }
          }}
          onMouseOut={(e) => {
            if (sessionStatus !== 'RUNNING') {
              e.target.style.backgroundColor = '#0052CC';
            }
          }}
        >
          Start Session
        </button>
        <button
          onClick={handleStopSession}
          disabled={sessionStatus === 'IDLE'}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#FFFFFF',
            backgroundColor: sessionStatus === 'IDLE' ? '#C1C7D0' : '#DE350B',
            border: 'none',
            borderRadius: '3px',
            cursor: sessionStatus === 'IDLE' ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => {
            if (sessionStatus !== 'IDLE') {
              e.target.style.backgroundColor = '#FF5630';
            }
          }}
          onMouseOut={(e) => {
            if (sessionStatus !== 'IDLE') {
              e.target.style.backgroundColor = '#DE350B';
            }
          }}
        >
          Stop Session
        </button>
        <button
          onClick={handleClearSession}
          disabled={!contentId}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#FFFFFF',
            backgroundColor: !contentId ? '#C1C7D0' : '#6B778C',
            border: 'none',
            borderRadius: '3px',
            cursor: !contentId ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => {
            if (contentId) {
              e.target.style.backgroundColor = '#42526E';
            }
          }}
          onMouseOut={(e) => {
            if (contentId) {
              e.target.style.backgroundColor = '#6B778C';
            }
          }}
          title="Clear all session data (analysis, summary, created issues) for this page"
        >
          Clear Session
        </button>
        <button
          onClick={handleResetMeeting}
          disabled={!contentId}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#FFFFFF',
            backgroundColor: !contentId ? '#C1C7D0' : '#FFAB00',
            border: 'none',
            borderRadius: '3px',
            cursor: !contentId ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => {
            if (contentId) {
              e.target.style.backgroundColor = '#FFC400';
            }
          }}
          onMouseOut={(e) => {
            if (contentId) {
              e.target.style.backgroundColor = '#FFAB00';
            }
          }}
          title="Reset meeting (clears transcript, analysis, summary, but keeps created issues)"
        >
          Reset Meeting
        </button>
      </div>

      {/* Demo Transcript Pack */}
      {sessionStatus === 'RUNNING' && (
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: '#F4F5F7',
          border: '1px solid #DFE1E6',
          borderRadius: '3px'
        }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#172B4D'
          }}>
            Demo Scenario:
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <select
              value={selectedDemoScenario}
              onChange={(e) => setSelectedDemoScenario(e.target.value)}
              style={{
                flex: 1,
                minWidth: '200px',
                maxWidth: '300px',
                padding: '6px 8px',
                border: '1px solid #DFE1E6',
                borderRadius: '3px',
                fontSize: '14px',
                backgroundColor: '#FFFFFF',
                cursor: 'pointer'
              }}
            >
              <option value="">Select a demo scenario...</option>
              <option value="Sprint Planning">Sprint Planning</option>
              <option value="Bug Triage">Bug Triage</option>
              <option value="Stakeholder Review">Stakeholder Review</option>
            </select>
            <button
              onClick={() => handleLoadDemoTranscript(selectedDemoScenario)}
              disabled={!selectedDemoScenario}
              style={{
                padding: '6px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#FFFFFF',
                backgroundColor: !selectedDemoScenario ? '#C1C7D0' : '#36B37E',
                border: 'none',
                borderRadius: '3px',
                cursor: !selectedDemoScenario ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              Load
            </button>
          </div>
        </div>
      )}

      {/* Jira Project Selection */}
      {sessionStatus === 'RUNNING' && (
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: '#F4F5F7',
          border: '1px solid #DFE1E6',
          borderRadius: '3px'
        }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#172B4D'
          }}>
            Jira Project:
          </label>
          <select
            value={selectedProjectKey}
            onChange={(e) => setSelectedProjectKey(e.target.value)}
            disabled={isLoading || jiraProjects.length === 0}
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '6px 8px',
              border: '1px solid #DFE1E6',
              borderRadius: '3px',
              fontSize: '14px',
              backgroundColor: isLoading || jiraProjects.length === 0 ? '#F4F5F7' : '#FFFFFF',
              cursor: isLoading || jiraProjects.length === 0 ? 'not-allowed' : 'pointer',
              pointerEvents: isLoading || jiraProjects.length === 0 ? 'none' : 'auto'
            }}
          >
            <option value="">Select a project...</option>
            {jiraProjects.map(project => (
              <option key={project.key} value={project.key}>
                {project.name} ({project.key})
              </option>
            ))}
          </select>
          {isLoading && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#6B778C' }}>
              Loading Jira projects...
            </div>
          )}
          {jiraProjects.length === 0 && !isLoading && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#DE350B' }}>
              No Jira projects available. Check console for errors or ensure you have Jira access.
            </div>
          )}
        </div>
      )}

      {/* Debug Panel */}
      {showDebug && (
        <div style={{
          padding: '12px',
          marginBottom: '16px',
          backgroundColor: '#F4F5F7',
          border: '1px solid #DFE1E6',
          borderRadius: '3px',
          fontSize: '12px',
          fontFamily: 'monospace'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '8px' }}>Debug Info:</div>
          <div><strong>Content ID:</strong> {contentId || 'Not available'}</div>
          <div><strong>Meeting Updated:</strong> {meeting.updatedAt ? new Date(meeting.updatedAt).toLocaleString() : 'Never'}</div>
          <div><strong>Created Issue Keys:</strong> {meeting.createdIssueKeys ? meeting.createdIssueKeys.length : 0}</div>
          <div><strong>Last Action:</strong> {debugInfo.lastAction || 'None'}</div>
          {debugInfo.lastResult && (
            <div style={{ marginTop: '4px' }}>
              <strong>Last Result:</strong>
              <pre style={{ margin: '4px 0', whiteSpace: 'pre-wrap', fontSize: '11px' }}>
                {JSON.stringify(debugInfo.lastResult, null, 2)}
              </pre>
            </div>
          )}
          {debugInfo.lastError && (
            <div style={{ color: '#DE350B', marginTop: '4px' }}>
              <strong>Last Error:</strong> {debugInfo.lastError}
            </div>
          )}
        </div>
      )}

      {/* Meeting Summary Panel */}
      {summary && (
        <div style={{
          marginBottom: '16px',
          border: '1px solid #DFE1E6',
          borderRadius: '3px',
          padding: '16px',
          backgroundColor: '#FFFFFF'
        }}>
          <h2 style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#172B4D',
            borderBottom: '1px solid #DFE1E6',
            paddingBottom: '8px'
          }}>
            Meeting Summary
          </h2>
          <div style={{
            fontSize: '14px',
            color: '#172B4D'
          }}>
            {summary.whatWasDiscussed && (
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ display: 'block', marginBottom: '4px', color: '#172B4D' }}>
                  What was discussed:
                </strong>
                <div style={{ color: '#42526E' }}>{summary.whatWasDiscussed}</div>
              </div>
            )}
            {summary.decisions && summary.decisions.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ display: 'block', marginBottom: '4px', color: '#172B4D' }}>
                  Decisions:
                </strong>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#42526E' }}>
                  {summary.decisions.map((decision, index) => (
                    <li key={index} style={{ marginBottom: '4px' }}>
                      {decision}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {summary.actions && summary.actions.length > 0 && (
              <div>
                <strong style={{ display: 'block', marginBottom: '4px', color: '#172B4D' }}>
                  Actions:
                </strong>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#42526E' }}>
                  {summary.actions.map((action, index) => {
                    // Handle both string format (backward compatibility) and object format
                    if (typeof action === 'string') {
                      return (
                        <li key={index} style={{ marginBottom: '4px' }}>
                          {action}
                        </li>
                      );
                    }
                    // Object format: display text with owner and due date if available
                    const actionText = action.text || action.originalLine || String(action);
                    const ownerText = action.owner ? ` Owner: ${action.owner}` : '';
                    const dueText = action.dueDate ? ` Due: ${action.dueDate}` : '';
                    return (
                      <li key={index} style={{ marginBottom: '4px' }}>
                        {actionText}{ownerText}{dueText}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Panels Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px'
      }}>
        {/* Transcript Input Panel */}
        <div style={{
          border: '1px solid #DFE1E6',
          borderRadius: '3px',
          padding: '16px',
          backgroundColor: '#FFFFFF',
          minHeight: '200px'
        }}>
          <h2 style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#172B4D',
            borderBottom: '1px solid #DFE1E6',
            paddingBottom: '8px'
          }}>
            Transcript Input
          </h2>
          <textarea
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            placeholder={sessionStatus !== 'RUNNING' ? 'Start session to enter transcript' : 'Paste transcript text here...'}
            disabled={sessionStatus !== 'RUNNING'}
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '8px',
              border: '1px solid #DFE1E6',
              borderRadius: '3px',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'vertical',
              backgroundColor: sessionStatus !== 'RUNNING' ? '#F4F5F7' : '#FFFFFF',
              color: sessionStatus !== 'RUNNING' ? '#6B778C' : '#172B4D',
              cursor: sessionStatus !== 'RUNNING' ? 'not-allowed' : 'text'
            }}
          />
          
          {/* UI Message - shows info/error/success messages above buttons */}
          {uiMessage && (
            <div style={{
              marginTop: '12px',
              marginBottom: '8px',
              padding: '8px 12px',
              borderRadius: '3px',
              fontSize: '13px',
              backgroundColor: uiMessage.type === 'error' ? '#FFEBE6' : 
                               uiMessage.type === 'success' ? '#E3FCEF' : 
                               '#E3F5FF',
              border: `1px solid ${uiMessage.type === 'error' ? '#DE350B' : 
                                  uiMessage.type === 'success' ? '#36B37E' : 
                                  '#0052CC'}`,
              color: uiMessage.type === 'error' ? '#DE350B' : 
                     uiMessage.type === 'success' ? '#006644' : 
                     '#0052CC'
            }}>
              {uiMessage.text}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '8px', marginTop: uiMessage ? '0' : '12px', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={handleAnalyze}
                disabled={sessionStatus !== 'RUNNING' || !transcriptText.trim() || isAnalyzing || isAnalyzingWithAI}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#FFFFFF',
                  backgroundColor: (sessionStatus !== 'RUNNING' || !transcriptText.trim() || isAnalyzing || isAnalyzingWithAI) ? '#C1C7D0' : '#0052CC',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: (sessionStatus !== 'RUNNING' || !transcriptText.trim() || isAnalyzing || isAnalyzingWithAI) ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze'}
              </button>
              <button
                onClick={handleAnalyzeWithAI}
                disabled={sessionStatus !== 'RUNNING' || !transcriptText.trim() || isAnalyzing || isAnalyzingWithAI}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#FFFFFF',
                  backgroundColor: (sessionStatus !== 'RUNNING' || !transcriptText.trim() || isAnalyzing || isAnalyzingWithAI) ? '#C1C7D0' : '#7A869A',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: (sessionStatus !== 'RUNNING' || !transcriptText.trim() || isAnalyzing || isAnalyzingWithAI) ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s'
                }}
                title="Uses enhanced AI-powered extraction with better pattern matching for real-world transcripts"
              >
                {isAnalyzingWithAI ? 'Analyzing with AI...' : '🤖 Analyze with AI'}
              </button>
              <button
                onClick={handleGenerateSummary}
                disabled={sessionStatus !== 'RUNNING' || !transcriptText.trim() || isGeneratingSummary || !hasAnalyzedInSession}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#FFFFFF',
                  backgroundColor: (sessionStatus !== 'RUNNING' || !transcriptText.trim() || isGeneratingSummary || !hasAnalyzedInSession) ? '#C1C7D0' : '#36B37E',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: (sessionStatus !== 'RUNNING' || !transcriptText.trim() || isGeneratingSummary || !hasAnalyzedInSession) ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                {isGeneratingSummary ? 'Generating...' : 'Generate Summary'}
              </button>
            </div>
            {/* Helper text when Generate Summary is disabled due to missing analysis */}
            {sessionStatus === 'RUNNING' && transcriptText.trim() && !hasAnalyzedInSession && (
              <div style={{
                fontSize: '11px',
                color: '#6B778C',
                fontStyle: 'italic',
                marginTop: '4px'
              }}>
                Analyze the transcript first.
              </div>
            )}
          </div>
        </div>

        {/* Suggestions Panel */}
        <div style={{
          border: '1px solid #DFE1E6',
          borderRadius: '3px',
          padding: '16px',
          backgroundColor: '#FFFFFF',
          minHeight: '200px'
        }}>
          <h2 style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#172B4D',
            borderBottom: '1px solid #DFE1E6',
            paddingBottom: '8px'
          }}>
            Suggestions
          </h2>
          <div style={{
            fontSize: '14px',
            color: '#172B4D'
          }}>
            {analysis.suggestions.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {analysis.suggestions.map((suggestion, index) => (
                  <li key={index} style={{ marginBottom: '8px' }}>
                    {suggestion}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: '#6B778C', fontStyle: 'italic' }}>
                No suggestions yet. Analyze a transcript to see insights.
              </div>
            )}
          </div>
        </div>

        {/* Decisions Log Panel */}
        <div style={{
          border: '1px solid #DFE1E6',
          borderRadius: '3px',
          padding: '16px',
          backgroundColor: '#FFFFFF',
          minHeight: '200px'
        }}>
          <h2 style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#172B4D',
            borderBottom: '1px solid #DFE1E6',
            paddingBottom: '8px'
          }}>
            Decisions Log
          </h2>
          <div style={{
            fontSize: '14px',
            color: '#172B4D'
          }}>
            {analysis.decisions.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {analysis.decisions.map((decision, index) => (
                  <li key={index} style={{ marginBottom: '8px' }}>
                    {decision}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: '#6B778C', fontStyle: 'italic' }}>
                No decisions found yet. Analyze a transcript to extract decisions.
              </div>
            )}
          </div>
        </div>

        {/* Action Items Panel */}
        <div style={{
          border: '1px solid #DFE1E6',
          borderRadius: '3px',
          padding: '16px',
          backgroundColor: '#FFFFFF',
          minHeight: '200px'
        }}>
          <h2 style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#172B4D',
            borderBottom: '1px solid #DFE1E6',
            paddingBottom: '8px'
          }}>
            Action Items
          </h2>
          <div style={{
            fontSize: '14px',
            color: '#172B4D'
          }}>
            {selectedActionItems.length > 0 ? (
              <div>
                {/* Draft Action Items */}
                {selectedActionItems.filter(item => !item.issueKey).length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{
                      margin: '0 0 8px 0',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#42526E',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Draft Action Items
                    </h3>
                    {selectedActionItems.filter(item => !item.issueKey).map((item) => {
                      const isPublished = !!item.issueKey;
                      const isDisabled = isPublished || sessionStatus !== 'RUNNING';
                      const confidenceColors = {
                        high: { bg: '#E3FCEF', text: '#006644', border: '#57D9A3' },
                        medium: { bg: '#FFF4E5', text: '#974F00', border: '#FFC400' },
                        low: { bg: '#F4F5F7', text: '#42526E', border: '#C1C7D0' }
                      };
                      const confStyle = confidenceColors[item.confidence] || confidenceColors.low;
                      
                      return (
                        <div key={`action-item-${item.index}`} style={{
                          marginBottom: '12px',
                          padding: '8px',
                          border: '1px solid #DFE1E6',
                          borderRadius: '3px',
                          backgroundColor: item.selected ? '#FFFFFF' : '#F4F5F7',
                          opacity: isDisabled ? 0.6 : 1
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <input
                              type="checkbox"
                              id={`checkbox-${item.index}`}
                              checked={item.selected}
                              onChange={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleActionItemSelection(item.index);
                              }}
                              disabled={isDisabled}
                              style={{
                                marginTop: '4px',
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                pointerEvents: isDisabled ? 'none' : 'auto',
                                width: '18px',
                                height: '18px',
                                flexShrink: 0
                              }}
                            />
                            <label
                              htmlFor={`checkbox-${item.index}`}
                              style={{
                                flex: 1,
                                fontSize: '13px',
                                cursor: isDisabled ? 'default' : 'pointer',
                                margin: 0,
                                userSelect: 'none',
                                minWidth: '200px'
                              }}
                              onClick={(e) => {
                                if (!isDisabled) {
                                  e.preventDefault();
                                  toggleActionItemSelection(item.index);
                                }
                              }}
                            >
                              {item.text}
                            </label>
                            {/* Confidence Badge */}
                            <span style={{
                              padding: '2px 6px',
                              fontSize: '10px',
                              fontWeight: '600',
                              borderRadius: '3px',
                              backgroundColor: confStyle.bg,
                              color: confStyle.text,
                              border: `1px solid ${confStyle.border}`,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              flexShrink: 0
                            }}>
                              {item.confidence || 'low'}
                            </span>
                            {/* Status Label */}
                            {isPublished && (
                              <span style={{
                                padding: '2px 6px',
                                fontSize: '10px',
                                fontWeight: '600',
                                borderRadius: '3px',
                                backgroundColor: '#E3FCEF',
                                color: '#006644',
                                border: '1px solid #57D9A3',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                flexShrink: 0
                              }}>
                                Published: {item.issueKey}
                              </span>
                            )}
                            {!isPublished && (
                              <span style={{
                                padding: '2px 6px',
                                fontSize: '10px',
                                fontWeight: '600',
                                borderRadius: '3px',
                                backgroundColor: '#F4F5F7',
                                color: '#42526E',
                                border: '1px solid #C1C7D0',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                flexShrink: 0
                              }}>
                                Draft
                              </span>
                            )}
                          </div>
                          {item.selected && !isDisabled && (
                            <div style={{ marginLeft: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, minWidth: '150px' }}>
                                <label style={{ display: 'block', fontSize: '11px', color: '#6B778C', marginBottom: '4px' }}>
                                  Owner:
                                </label>
                                <input
                                  type="text"
                                  value={item.owner || ''}
                                  onChange={(e) => updateActionItemOwner(item.index, e.target.value)}
                                  placeholder="Name or email"
                                  disabled={isDisabled}
                                  style={{
                                    width: '100%',
                                    padding: '4px 6px',
                                    fontSize: '12px',
                                    border: '1px solid #DFE1E6',
                                    borderRadius: '3px',
                                    backgroundColor: isDisabled ? '#F4F5F7' : '#FFFFFF'
                                  }}
                                />
                              </div>
                              <div style={{ flex: 1, minWidth: '150px' }}>
                                <label style={{ display: 'block', fontSize: '11px', color: '#6B778C', marginBottom: '4px' }}>
                                  Due Date:
                                </label>
                                <input
                                  type="date"
                                  value={item.dueDate || ''}
                                  onChange={(e) => updateActionItemDueDate(item.index, e.target.value)}
                                  disabled={isDisabled}
                                  style={{
                                    width: '100%',
                                    padding: '4px 6px',
                                    fontSize: '12px',
                                    border: '1px solid #DFE1E6',
                                    borderRadius: '3px',
                                    backgroundColor: isDisabled ? '#F4F5F7' : '#FFFFFF'
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Published Action Items */}
                {selectedActionItems.filter(item => item.issueKey).length > 0 && (
                  <div>
                    <h3 style={{
                      margin: '0 0 8px 0',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#42526E',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Published Action Items
                    </h3>
                    {selectedActionItems.filter(item => item.issueKey).map((item) => {
                      const confidenceColors = {
                        high: { bg: '#E3FCEF', text: '#006644', border: '#57D9A3' },
                        medium: { bg: '#FFF4E5', text: '#974F00', border: '#FFC400' },
                        low: { bg: '#F4F5F7', text: '#42526E', border: '#C1C7D0' }
                      };
                      const confStyle = confidenceColors[item.confidence] || confidenceColors.low;
                      
                      return (
                        <div key={`action-item-${item.index}`} style={{
                          marginBottom: '12px',
                          padding: '8px',
                          border: '1px solid #DFE1E6',
                          borderRadius: '3px',
                          backgroundColor: '#F4F5F7',
                          opacity: 0.8
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <div style={{
                              flex: 1,
                              fontSize: '13px',
                              margin: 0,
                              minWidth: '200px'
                            }}>
                              {item.text}
                            </div>
                            {/* Confidence Badge */}
                            <span style={{
                              padding: '2px 6px',
                              fontSize: '10px',
                              fontWeight: '600',
                              borderRadius: '3px',
                              backgroundColor: confStyle.bg,
                              color: confStyle.text,
                              border: `1px solid ${confStyle.border}`,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              flexShrink: 0
                            }}>
                              {item.confidence || 'low'}
                            </span>
                            {/* Status Label */}
                            <span style={{
                              padding: '2px 6px',
                              fontSize: '10px',
                              fontWeight: '600',
                              borderRadius: '3px',
                              backgroundColor: '#E3FCEF',
                              color: '#006644',
                              border: '1px solid #57D9A3',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              flexShrink: 0
                            }}>
                              Published: {item.issueKey}
                            </span>
                          </div>
                          {(item.owner || item.dueDate) && (
                            <div style={{ marginLeft: '0', fontSize: '11px', color: '#6B778C' }}>
                              {item.owner && <span>Owner: {item.owner}</span>}
                              {item.owner && item.dueDate && <span> • </span>}
                              {item.dueDate && <span>Due: {item.dueDate}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Create Jira Issues Button */}
                {sessionStatus === 'RUNNING' && selectedActionItems.filter(item => !item.issueKey && item.selected).length > 0 && (
                  <button
                    onClick={handleCreateJiraIssues}
                    disabled={!selectedProjectKey || selectedActionItems.filter(item => !item.issueKey && item.selected).length === 0 || isCreatingIssues}
                    style={{
                      marginTop: '12px',
                      padding: '8px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#FFFFFF',
                      backgroundColor: (!selectedProjectKey || selectedActionItems.filter(item => !item.issueKey && item.selected).length === 0 || isCreatingIssues) ? '#C1C7D0' : '#0052CC',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: (!selectedProjectKey || selectedActionItems.filter(item => !item.issueKey && item.selected).length === 0 || isCreatingIssues) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isCreatingIssues ? 'Creating Issues...' : 'Create Jira Issues'}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ color: '#6B778C', fontStyle: 'italic' }}>
                No action items found yet. Analyze a transcript to extract action items.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Created Issues Section */}
      {createdIssues.length > 0 && (
        <div style={{
          marginTop: '24px',
          padding: '16px',
          border: '1px solid #DFE1E6',
          borderRadius: '3px',
          backgroundColor: '#FFFFFF'
        }}>
          <h2 style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#172B4D',
            borderBottom: '1px solid #DFE1E6',
            paddingBottom: '8px'
          }}>
            Created Jira Issues
          </h2>
          {/* Time Saved Counter */}
          <div style={{
            padding: '12px',
            backgroundColor: '#E3FCEF',
            borderRadius: '3px',
            marginBottom: '16px',
            border: '1px solid #57D9A3'
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#006644',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>⏱️</span>
              <span>Time Saved: {((createdIssues.length * 1.5).toFixed(1))} minutes</span>
            </div>
            <div style={{
              fontSize: '12px',
              color: '#006644',
              opacity: 0.8
            }}>
              (vs {createdIssues.length} × 90 seconds per manual Jira issue creation)
            </div>
          </div>
          <div style={{
            fontSize: '14px',
            color: '#172B4D'
          }}>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {createdIssues.map((issue, index) => (
                <li key={index} style={{ marginBottom: '8px' }}>
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#0052CC',
                      textDecoration: 'none'
                    }}
                    onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                    onMouseOut={(e) => e.target.style.textDecoration = 'none'}
                  >
                    {issue.key}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
