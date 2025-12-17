import Resolver from '@forge/resolver';
import api, { storage, route } from '@forge/api';

const resolver = new Resolver();

/**
 * Get storage key for session (per-page)
 */
const getSessionKey = (contentId) => {
  return `sprintscrbe:${contentId}:session`;
};

/**
 * Get storage key for analysis (per-page)
 */
const getAnalysisKey = (contentId) => {
  return `sprintscrbe:${contentId}:analysis`;
};

/**
 * Get storage key for created issues (per-page)
 */
const getCreatedIssuesKey = (contentId) => {
  return `sprintscrbe:${contentId}:createdIssues`;
};

/**
 * Get storage key for meeting state (per-page)
 */
const getMeetingKey = (contentId) => {
  return `sprintscrbe:${contentId}:meeting`;
};

/**
 * Normalize site URL to base origin (strips /wiki or any path)
 * Prevents issues where baseUrl might include /wiki, which would break Jira URLs
 * @param {string} maybeUrl - URL that might include path segments
 * @returns {string} Normalized base URL (e.g., https://tenant.atlassian.net)
 */
const normalizeSiteUrl = (maybeUrl) => {
  if (!maybeUrl) return '';
  try {
    const u = new URL(maybeUrl);
    return `${u.protocol}//${u.host}`; // strips /wiki or anything else
  } catch {
    // fallback if it's already like https://tenant.atlassian.net
    return maybeUrl.replace(/\/wiki\/?$/, '').replace(/\/$/, '');
  }
};

/**
 * Get the current session state for a page
 * @param {Object} req - Request object containing contentId
 * @returns {Promise<Object>} Session state object
 */
resolver.define('getSessionState', async (req) => {
  const { contentId } = req.payload;
  
  if (!contentId) {
    return { status: 'IDLE' };
  }

  try {
    const sessionKey = getSessionKey(contentId);
    const sessionData = await storage.get(sessionKey);
    
    if (sessionData && sessionData.status) {
      return sessionData;
    }
    
    // Default to IDLE if no session exists
    return { status: 'IDLE' };
  } catch (error) {
    console.error('Error getting session state:', error);
    // Return IDLE on error to avoid breaking the UI
    return { status: 'IDLE' };
  }
});

/**
 * Set the session state for a page
 * @param {Object} req - Request object containing contentId and status
 * @returns {Promise<Object>} Updated session state
 */
resolver.define('setSessionState', async (req) => {
  const { contentId, status } = req.payload;
  
  if (!contentId) {
    throw new Error('contentId is required');
  }
  
  if (status !== 'IDLE' && status !== 'RUNNING') {
    throw new Error('status must be IDLE or RUNNING');
  }

  try {
    const sessionKey = getSessionKey(contentId);
    const sessionData = {
      status: status
    };
    
    await storage.set(sessionKey, sessionData);
    
    return sessionData;
  } catch (error) {
    console.error('Error setting session state:', error);
    throw error;
  }
});

/**
 * Get stored analysis for a page
 * @param {Object} req - Request object containing contentId
 * @returns {Promise<Object>} Analysis object with suggestions, decisions, actionItems
 */
resolver.define('getAnalysis', async (req) => {
  const { contentId } = req.payload;
  
  if (!contentId) {
    return {
      suggestions: [],
      decisions: [],
      actionItems: []
    };
  }

  try {
    const analysisKey = getAnalysisKey(contentId);
    const analysis = await storage.get(analysisKey);
    
    if (analysis && (analysis.suggestions || analysis.decisions || analysis.actionItems)) {
      return {
        suggestions: analysis.suggestions || [],
        decisions: analysis.decisions || [],
        actionItems: analysis.actionItems || []
      };
    }
    
    // Return empty arrays if no analysis exists
    return {
      suggestions: [],
      decisions: [],
      actionItems: []
    };
  } catch (error) {
    console.error('Error getting analysis:', error);
    return {
      suggestions: [],
      decisions: [],
      actionItems: []
    };
  }
});

/**
 * Analyze transcript text and extract insights
 * @param {Object} req - Request object containing contentId and transcriptText
 * @returns {Promise<Object>} Analysis object with suggestions, decisions, actionItems
 */
resolver.define('analyzeTranscript', async (req) => {
  const { contentId, transcriptText } = req.payload;
  
  if (!contentId) {
    throw new Error('contentId is required');
  }
  
  if (!transcriptText || !transcriptText.trim()) {
    throw new Error('transcriptText is required');
  }

  try {
    const text = transcriptText.trim();
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const suggestions = [];
    const decisions = [];
    const actionItems = [];
    
    // Extract suggestions (bullet-style insights or explicit "Suggestion:" lines)
    // Look for lines starting with bullet points, dashes, numbered lists, or "Suggestion:"
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      const lowerLine = trimmedLine.toLowerCase();
      
      // Check for explicit "Suggestion:" pattern first
      const suggestionPattern = /^suggestion\s*:\s*(.+)$/i;
      if (suggestionPattern.test(trimmedLine)) {
        const match = trimmedLine.match(suggestionPattern);
        if (match && match[1]) {
          suggestions.push(match[1].trim());
        }
        return; // Skip other pattern checks if this matches
      }
      
      // Check for bullet points, dashes, or numbered lists
      const bulletPattern = /^[-•*]\s+(.+)$/i;
      const numberedPattern = /^\d+[.)]\s+(.+)$/;
      
      if (bulletPattern.test(trimmedLine) || numberedPattern.test(trimmedLine)) {
        const match = trimmedLine.match(bulletPattern) || trimmedLine.match(numberedPattern);
        if (match && match[1]) {
          suggestions.push(match[1].trim());
        }
      }
    });
    
    // Extract decisions
    // Look for patterns like "we decided", "agreed", "decision:", "decided to"
    const decisionPatterns = [
      /(?:we|they|the team|we all)\s+(?:decided|agreed|concluded|determined)/i,
      /decision\s*:/i,
      /decided\s+to/i,
      /agreement\s+was/i,
      /consensus\s+is/i
    ];
    
    lines.forEach((line) => {
      const lowerLine = line.toLowerCase();
      for (const pattern of decisionPatterns) {
        if (pattern.test(lowerLine)) {
          decisions.push(line);
          break;
        }
      }
    });
    
    // Extract action items with improved parsing
    // Treat "Action:" lines as primary, attach subsequent "Owner:" and "Due:" lines
    let currentActionItem = null;
    
    lines.forEach((line, index) => {
      const lowerLine = line.toLowerCase();
      const trimmedLine = line.trim();
      
      // Check if this is an "Action:" line (primary action item)
      const actionMatch = trimmedLine.match(/^action\s*:\s*(.+)$/i);
      if (actionMatch) {
        // Save previous action item if exists
        if (currentActionItem) {
          actionItems.push(currentActionItem);
        }
        
        // Start new action item with high confidence
        currentActionItem = {
          text: actionMatch[1].trim(),
          owner: undefined,
          dueDate: undefined,
          confidence: 'high',
          originalLine: trimmedLine
        };
        return;
      }
      
      // Check if this is an "Owner:" line - attach to current action item
      const ownerMatch = trimmedLine.match(/^owner\s*:\s*(.+)$/i);
      if (ownerMatch && currentActionItem) {
        currentActionItem.owner = ownerMatch[1].trim();
        return;
      }
      
      // Check if this is a "Due:" or "Due Date:" line - attach to current action item
      const dueMatch = trimmedLine.match(/^due\s*(?:date)?\s*:\s*(.+)$/i);
      if (dueMatch && currentActionItem) {
        // Try to parse date formats
        const dueText = dueMatch[1].trim();
        // Try common date formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, "EOW", "tomorrow", etc.
        if (dueText.match(/^\d{4}-\d{2}-\d{2}$/)) {
          currentActionItem.dueDate = dueText;
        } else if (dueText.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]?\d{0,4}$/)) {
          // Basic date format - store as-is for now
          currentActionItem.dueDate = dueText;
        } else {
          // Store text as-is (e.g., "EOW", "tomorrow")
          currentActionItem.dueDate = dueText;
        }
        return;
      }
      
      // If we have a current action item and this line doesn't match Action/Owner/Due,
      // check if it's a continuation or if we should finalize the current item
      if (currentActionItem) {
        // If this line doesn't look like metadata, it might be a continuation
        // For now, we'll finalize the current action item and check if this is a new action
        actionItems.push(currentActionItem);
        currentActionItem = null;
      }
      
      // Check for "will" patterns (medium confidence) - only if not already in an action item
      if (!currentActionItem && /\b(?:will|should|must|needs to)\s+(?:do|complete|finish|deliver|implement|create|update|fix|test|deploy)/i.test(lowerLine)) {
        actionItems.push({
          text: trimmedLine,
          owner: undefined,
          dueDate: undefined,
          confidence: 'medium',
          originalLine: trimmedLine
        });
        return;
      }
      
      // Low confidence: other action-like patterns (only if no current action item)
      if (!currentActionItem && (
        /(?:task|todo|action item)\s*:/i.test(lowerLine) ||
        /\b(?:assign|responsible|owner)\s*:/i.test(lowerLine)
      )) {
        actionItems.push({
          text: trimmedLine,
          owner: undefined,
          dueDate: undefined,
          confidence: 'low',
          originalLine: trimmedLine
        });
      }
    });
    
    // Don't forget the last action item
    if (currentActionItem) {
      actionItems.push(currentActionItem);
    }
    
    // Store the analysis
    const analysis = {
      suggestions: suggestions.length > 0 ? suggestions : [],
      decisions: decisions.length > 0 ? decisions : [],
      actionItems: actionItems.length > 0 ? actionItems : []
    };
    
    const analysisKey = getAnalysisKey(contentId);
    await storage.set(analysisKey, analysis);
    
    return analysis;
  } catch (error) {
    console.error('Error analyzing transcript:', error);
    throw error;
  }
});

/**
 * Analyze transcript with AI-powered extraction (improved heuristics)
 * This uses enhanced pattern matching similar to what Rovo Agent would do
 * @param {Object} req - Request object containing contentId and transcriptText
 * @returns {Promise<Object>} Analysis results with suggestions, decisions, and actionItems
 */
resolver.define('analyzeWithAI', async (req) => {
  const { contentId, transcriptText } = req.payload;
  
  if (!contentId) {
    throw new Error('contentId is required');
  }
  
  if (!transcriptText || !transcriptText.trim()) {
    throw new Error('transcriptText is required');
  }

  try {
    const text = transcriptText.trim();
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const suggestions = [];
    const decisions = [];
    const actionItems = [];
    
    // Enhanced extraction with better patterns for real-world transcripts
    
    // Extract suggestions (insights, recommendations)
    lines.forEach((line) => {
      const lowerLine = line.toLowerCase();
      // Look for suggestion patterns, recommendations, insights
      if (/suggestion|recommend|insight|consider|propose|suggest/i.test(line) && 
          !/action|todo|task/i.test(line)) {
        // Extract the actual suggestion text
        const match = line.match(/(?:suggestion|recommend|insight|consider|propose|suggest)[\s:]+(.+)/i);
        if (match && match[1]) {
          suggestions.push(match[1].trim());
        } else if (line.length > 20) {
          suggestions.push(line);
        }
      }
    });
    
    // Enhanced decision extraction
    const decisionPatterns = [
      /(?:we|they|the team|we all|everyone)\s+(?:decided|agreed|concluded|determined|resolved)/i,
      /decision\s*[:]\s*(.+)/i,
      /decided\s+to\s+(.+)/i,
      /agreement\s+was\s+(.+)/i,
      /consensus\s+is\s+(.+)/i,
      /(?:we|they)\s+will\s+(?:proceed|move forward|adopt|use)/i,
      /(?:it|that)\s+was\s+(?:decided|agreed|determined)/i
    ];
    
    lines.forEach((line) => {
      for (const pattern of decisionPatterns) {
        const match = line.match(pattern);
        if (match) {
          const decisionText = match[1] ? match[1].trim() : line.trim();
          if (decisionText && decisionText.length > 10) {
            decisions.push(decisionText);
            break;
          }
        }
      }
    });
    
    // Enhanced action item extraction with timestamp and speaker support
    // Support formats like: [00:12:34] Sarah: "We should refactor auth"
    // Or: Sarah: Action: Refactor auth module
    let currentActionItem = null;
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      const lowerLine = trimmedLine.toLowerCase();
      
      // Extract timestamp and speaker if present: [HH:MM:SS] Name: text
      const timestampSpeakerMatch = trimmedLine.match(/^\[(\d{1,2}:\d{2}:\d{2})\]\s*([^:]+):\s*(.+)$/);
      let speaker = null;
      let actionText = trimmedLine;
      
      if (timestampSpeakerMatch) {
        speaker = timestampSpeakerMatch[2].trim();
        actionText = timestampSpeakerMatch[3].trim();
      }
      
      // Check for explicit "Action:" pattern (high confidence)
      const actionMatch = actionText.match(/^action\s*:\s*(.+)$/i);
      if (actionMatch) {
        if (currentActionItem) {
          actionItems.push(currentActionItem);
        }
        currentActionItem = {
          text: actionMatch[1].trim(),
          owner: speaker || undefined,
          dueDate: undefined,
          confidence: 'high',
          originalLine: trimmedLine
        };
        return;
      }
      
      // Check for "Owner:" line
      const ownerMatch = trimmedLine.match(/^owner\s*:\s*(.+)$/i);
      if (ownerMatch && currentActionItem) {
        currentActionItem.owner = ownerMatch[1].trim();
        return;
      }
      
      // Check for "Due:" line
      const dueMatch = trimmedLine.match(/^due\s*(?:date)?\s*:\s*(.+)$/i);
      if (dueMatch && currentActionItem) {
        currentActionItem.dueDate = dueMatch[1].trim();
        return;
      }
      
      // Finalize current action item if we hit a non-metadata line
      if (currentActionItem) {
        actionItems.push(currentActionItem);
        currentActionItem = null;
      }
      
      // Medium confidence: commitment verbs with action verbs
      if (/\b(?:will|should|must|needs to|going to)\s+(?:do|complete|finish|deliver|implement|create|update|fix|test|deploy|refactor|build|add|remove|change|update)/i.test(lowerLine)) {
        // Extract owner from speaker if available
        const owner = speaker || (lowerLine.match(/(?:^|\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|should|must)/) || [])[1];
        actionItems.push({
          text: actionText,
          owner: owner || undefined,
          dueDate: undefined,
          confidence: 'medium',
          originalLine: trimmedLine
        });
        return;
      }
      
      // Low confidence: implicit actions
      if (/(?:task|todo|action item|needs? to happen|someone should)/i.test(lowerLine) &&
          !currentActionItem) {
        actionItems.push({
          text: actionText,
          owner: speaker || undefined,
          dueDate: undefined,
          confidence: 'low',
          originalLine: trimmedLine
        });
      }
    });
    
    // Don't forget the last action item
    if (currentActionItem) {
      actionItems.push(currentActionItem);
    }
    
    // Store the analysis
    const analysis = {
      suggestions: suggestions.length > 0 ? suggestions : [],
      decisions: decisions.length > 0 ? decisions : [],
      actionItems: actionItems.length > 0 ? actionItems : []
    };
    
    const analysisKey = getAnalysisKey(contentId);
    await storage.set(analysisKey, analysis);
    
    return analysis;
  } catch (error) {
    console.error('Error analyzing transcript with AI:', error);
    throw error;
  }
});

/**
 * List available Jira projects
 * @returns {Promise<Array>} Array of project objects with key and name
 */
resolver.define('listJiraProjects', async (req) => {
  try {
    // Use route template literal tag with asUser() to make authenticated request to Jira API
    const response = await api.asUser().requestJira(route`/rest/api/3/project`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      // Get detailed error message from response
      let errorMessage = `Failed to fetch projects: ${response.status}`;
      try {
        const errorBody = await response.text();
        if (errorBody) {
          errorMessage += ` - ${errorBody}`;
        }
      } catch (e) {
        // Ignore if we can't read error body
      }
      console.error('Jira API error:', errorMessage);
      throw new Error(errorMessage);
    }

    const projects = await response.json();
    
    // Return simplified project list (key and name)
    return projects.map(project => ({
      key: project.key,
      name: project.name
    })).slice(0, 50); // Limit to first 50 projects
  } catch (error) {
    console.error('Error listing Jira projects:', error);
    throw error;
  }
});

/**
 * Parse action item text to extract owner and due date
 * @param {string} text - Action item text
 * @returns {Object} Parsed object with text, owner, dueDate
 */
const parseActionItem = (text) => {
  let cleanText = text.trim();
  let owner = null;
  let dueDate = null;

  // Remove leading "Action:", "Task:", etc.
  cleanText = cleanText.replace(/^(?:action|task|todo|action item)\s*:\s*/i, '');

  // Extract owner patterns: "Owner: John", "Assigned to: Jane", etc.
  const ownerPatterns = [
    /(?:owner|assigned to|assignee|responsible)\s*:\s*([^\n,;]+)/i,
    /\b(?:by|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i
  ];
  
  for (const pattern of ownerPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      owner = match[1].trim();
      cleanText = cleanText.replace(pattern, '').trim();
      break;
    }
  }

  // Extract due date patterns: "Due: 2024-12-31", "by 12/31/2024", etc.
  const datePatterns = [
    /(?:due|deadline|by|target)\s*(?:date)?\s*:\s*(\d{4}-\d{2}-\d{2})/i, // ISO format
    /(?:due|deadline|by|target)\s*(?:date)?\s*:\s*(\d{1,2}[\/\-]\d{1,2}(?:\/\d{2,4})?)/i, // MM/DD or MM/DD/YYYY
    /\b(?:by|before|until)\s+(\d{4}-\d{2}-\d{2})\b/i, // ISO format standalone
    /\b(?:by|before|until)\s+(\d{1,2}[\/\-]\d{1,2}(?:\/\d{2,4})?)\b/i // MM/DD format standalone
  ];

  for (const pattern of datePatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      let dateStr = match[1].trim();
      // Convert MM/DD/YYYY to ISO format if needed
      if (dateStr.includes('/') || dateStr.includes('-')) {
        const parts = dateStr.split(/[\/\-]/);
        if (parts.length === 3) {
          const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          dueDate = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        } else if (parts.length === 2) {
          // MM/DD - assume current year
          const year = new Date().getFullYear();
          dueDate = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
      } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dueDate = dateStr;
      }
      if (dueDate) {
        cleanText = cleanText.replace(pattern, '').trim();
        break;
      }
    }
  }

  // Clean up extra whitespace and punctuation
  cleanText = cleanText.replace(/\s+/g, ' ').trim();
  cleanText = cleanText.replace(/^[,\-•*]\s*/, '').trim();

  return {
    text: cleanText,
    owner: owner,
    dueDate: dueDate
  };
};

/**
 * Search for Jira user by display name or email
 * @param {string} searchTerm - Display name or email to search
 * @returns {Promise<string|null>} User accountId or null if not found
 */
const findJiraUser = async (searchTerm) => {
  try {
    const response = await api.asUser().requestJira(route`/rest/api/3/user/search?query=${encodeURIComponent(searchTerm)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const users = await response.json();
    if (users && users.length > 0) {
      // Return the first matching user's accountId
      return users[0].accountId;
    }
    return null;
  } catch (error) {
    console.error('Error searching for Jira user:', error);
    return null;
  }
};

/**
 * Create Jira issues from action items
 * @param {Object} req - Request object containing contentId, projectKey, and items
 * @returns {Promise<Array>} Array of created issue objects with key and url
 */
resolver.define('createJiraIssuesFromActionItems', async (req) => {
  const { contentId, projectKey, items, siteUrl, pageUrl } = req.payload;
  
  if (!contentId) {
    throw new Error('contentId is required');
  }
  
  if (!projectKey) {
    throw new Error('projectKey is required');
  }
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('items array is required and must not be empty');
  }

  try {
    const createdIssues = [];

    // Get URLs from payload (preferred) or fallback to context (backward compatibility)
    // siteUrl: Atlassian site base URL (e.g., https://tenant.atlassian.net)
    // pageUrl: Full Confluence page URL (e.g., https://tenant.atlassian.net/wiki/spaces/SPACE/pages/12345)
    let rawSiteUrl = siteUrl
      || (req.context?.extension?.host ? `https://${req.context.extension.host}` : '')
      || req.context?.extension?.baseUrl
      || '';
    
    // If we got a CDN URL, try to extract hostname from it (e.g., _hostname_tenant.atlassian.net)
    if (rawSiteUrl && rawSiteUrl.includes('_hostname_')) {
      const hostnameMatch = rawSiteUrl.match(/_hostname_([^\/]+)/);
      if (hostnameMatch && hostnameMatch[1]) {
        rawSiteUrl = `https://${hostnameMatch[1]}`;
      }
    }
    
    const effectiveSiteUrl = normalizeSiteUrl(rawSiteUrl);
    
    // Get proper Confluence page URL - fetch from API if needed to get space key
    // If pageUrl is provided but uses invalid format (/wiki/pages/ without space), we'll fetch to get space key
    let effectivePageUrl = pageUrl;
    const hasInvalidFormat = effectivePageUrl && effectivePageUrl.includes('/wiki/pages/') && !effectivePageUrl.includes('/wiki/spaces/');
    const needsSpaceKey = !effectivePageUrl || hasInvalidFormat;
    
    if (needsSpaceKey && effectiveSiteUrl && contentId) {
      // Try to fetch page from Confluence API to get space key for proper URL construction
      try {
        const pageResponse = await api.asUser().requestConfluence(
          route`/wiki/api/v2/pages/${contentId}`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          }
        );
        
        if (pageResponse.ok) {
          const pageData = await pageResponse.json();
          // Construct proper URL with space key: /wiki/spaces/{spaceKey}/pages/{contentId}
          // Try multiple possible field names for space identifier
          const spaceId = pageData.spaceId || 
                         pageData.space?.id || 
                         pageData.space?.key ||
                         (pageData._links?.webui && pageData._links.webui.match(/\/spaces\/([^\/]+)/)?.[1]);
          
          if (spaceId) {
            effectivePageUrl = `${effectiveSiteUrl}/wiki/spaces/${spaceId}/pages/${contentId}`;
          } else {
            // Log for debugging if spaceId is not found
            console.warn('Confluence page API response missing spaceId. Available fields:', Object.keys(pageData).join(', '));
            // Try alternative URL format: /pages/viewpage.action?pageId={contentId}
            effectivePageUrl = `${effectiveSiteUrl}/wiki/pages/viewpage.action?pageId=${contentId}`;
          }
        } else {
          const errorText = await pageResponse.text();
          console.warn(`Failed to fetch Confluence page: ${pageResponse.status} - ${errorText.substring(0, 200)}`);
        }
      } catch (e) {
        // If API call fails, fallback to contentId reference
        console.warn('Failed to fetch Confluence page for URL construction:', e);
      }
      
      // Final fallback: use contentId reference if we couldn't get space key
      // Only use fallback if we still don't have a valid URL (API call failed or no spaceId)
      if (!effectivePageUrl || (effectivePageUrl.includes('/wiki/pages/') && !effectivePageUrl.includes('/wiki/spaces/'))) {
        effectivePageUrl = contentId ? `Content ID: ${contentId}` : '';
      }
    } else if (!effectivePageUrl) {
      effectivePageUrl = contentId ? `Content ID: ${contentId}` : '';
    }
    
    // If we still don't have a site URL, we'll try to extract it from the Jira API response
    let fallbackSiteUrl = effectiveSiteUrl;

    for (const item of items) {
      if (!item.text || !item.text.trim()) {
        continue; // Skip empty items
      }

      // Parse the action item (for backward compatibility)
      const parsed = parseActionItem(item.text);
      const summary = parsed.text || item.text;
      
      // Use provided pageUrl or fallback to Content ID reference
      const sourceUrl = effectivePageUrl || `Content ID: ${contentId}`;
      
      // Get meeting summary if available
      const meetingKey = getMeetingKey(contentId);
      const meeting = await storage.get(meetingKey) || {};
      let meetingSummaryText = '';
      if (meeting.summary) {
        try {
          const summaryObj = typeof meeting.summary === 'string' ? JSON.parse(meeting.summary) : meeting.summary;
          if (summaryObj && summaryObj.whatWasDiscussed) {
            meetingSummaryText = summaryObj.whatWasDiscussed;
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      // Build enriched description as structured ADF content
      // This allows the Confluence Source URL to be a clickable link
      const descriptionContent = [];
      
      // Source paragraph with clickable link (if URL is valid) or plain text (if Content ID fallback)
      const isUrl = sourceUrl && (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://'));
      const sourceParagraph = {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Source: ' }
        ]
      };
      
      if (isUrl) {
        // Make the URL a clickable link with friendly label text
        sourceParagraph.content.push({
          type: 'text',
          text: 'SprintScribe meeting page',
          marks: [
            { type: 'link', attrs: { href: sourceUrl } }
          ]
        });
      } else {
        // Fallback: Content ID as plain text
        sourceParagraph.content.push({
          type: 'text',
          text: sourceUrl || `Content ID: ${contentId}`
        });
      }
      descriptionContent.push(sourceParagraph);
      
      // Meeting Summary paragraph (if available)
      if (meetingSummaryText) {
        descriptionContent.push({
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Meeting Summary:' }
          ]
        });
        descriptionContent.push({
          type: 'paragraph',
          content: [
            { type: 'text', text: meetingSummaryText }
          ]
        });
      }
      
      // Extracted from transcript paragraph
      descriptionContent.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Extracted from transcript: ' },
          { type: 'text', text: item.originalLine || item.text }
        ]
      });
      
      // Build issue creation payload
      const issuePayload = {
        fields: {
          project: {
            key: projectKey
          },
          summary: summary.substring(0, 255), // Jira summary max length
          issuetype: {
            name: 'Task'
          },
          description: {
            type: 'doc',
            version: 1,
            content: descriptionContent
          }
        }
      };

      // Add assignee if owner is provided
      if (item.owner || parsed.owner) {
        const ownerName = item.owner || parsed.owner;
        const accountId = await findJiraUser(ownerName);
        if (accountId) {
          issuePayload.fields.assignee = {
            accountId: accountId
          };
        }
      }

      // Add due date if provided
      if (item.dueDate || parsed.dueDate) {
        const dueDate = item.dueDate || parsed.dueDate;
        // Validate ISO date format
        if (dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          issuePayload.fields.duedate = dueDate;
        }
      }

      // Create the issue using route template literal tag
      const createResponse = await api.asUser().requestJira(route`/rest/api/3/issue`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(issuePayload)
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error(`Failed to create issue: ${createResponse.status} - ${errorText}`);
        throw new Error(`Failed to create issue: ${createResponse.status}`);
      }

      const createdIssue = await createResponse.json();
      const issueKey = createdIssue.key;
      
      // Try to extract site URL from Jira API response if we don't have one
      // Note: Forge apps use api.atlassian.com proxy, so we can't use the 'self' field directly
      // Instead, we rely on frontend-provided siteUrl or CDN URL extraction
      let finalSiteUrl = fallbackSiteUrl;
      
      // Only try to extract from 'self' if it's NOT the Forge proxy (api.atlassian.com)
      if (!finalSiteUrl && createdIssue.self && !createdIssue.self.includes('api.atlassian.com')) {
        try {
          const selfUrl = new URL(createdIssue.self);
          // Extract site from API URL: https://tenant.atlassian.net/rest/api/3/issue/...
          finalSiteUrl = `${selfUrl.protocol}//${selfUrl.host}`;
          // Update fallback for subsequent issues in this batch
          fallbackSiteUrl = finalSiteUrl;
        } catch (e) {
          // If parsing fails, keep existing fallback
        }
      }
      
      // Build Jira issue URL using siteUrl (Jira is on same domain as Confluence)
      // Fallback to just the key if siteUrl is missing (backward compatible)
      const issueUrl = finalSiteUrl ? `${finalSiteUrl}/browse/${issueKey}` : issueKey;

      // Add comment with clickable link back to Confluence page
      // Build comment as structured ADF content so the URL is clickable
      const isCommentUrl = effectivePageUrl && (effectivePageUrl.startsWith('http://') || effectivePageUrl.startsWith('https://'));
      const commentContent = [];
      
      if (isCommentUrl) {
        // Comment with clickable Confluence page link
        commentContent.push({
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Created from SprintScribe AI analysis on Confluence page: ' },
            {
              type: 'text',
              text: effectivePageUrl,
              marks: [
                { type: 'link', attrs: { href: effectivePageUrl } }
              ]
            }
          ]
        });
      } else {
        // Fallback: Content ID as plain text
        commentContent.push({
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: `Created from SprintScribe AI analysis (Content ID: ${contentId})`
            }
          ]
        });
      }

      try {
        await api.asUser().requestJira(route`/rest/api/3/issue/${issueKey}/comment`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            body: {
              type: 'doc',
              version: 1,
              content: commentContent
            }
          })
        });
      } catch (commentError) {
        // Log but don't fail if comment creation fails
        console.error('Failed to add comment to issue:', commentError);
      }

      createdIssues.push({
        key: issueKey,
        url: issueUrl
      });
    }

    // Store created issues
    const createdIssuesKey = getCreatedIssuesKey(contentId);
    const existingIssues = await storage.get(createdIssuesKey) || [];
    const updatedIssues = [...existingIssues, ...createdIssues];
    await storage.set(createdIssuesKey, updatedIssues);

    return createdIssues;
  } catch (error) {
    console.error('Error creating Jira issues:', error);
    throw error;
  }
});

/**
 * Get created issues for a page
 * @param {Object} req - Request object containing contentId
 * @returns {Promise<Array>} Array of created issue objects with key and url
 */
resolver.define('getCreatedIssues', async (req) => {
  const { contentId } = req.payload;
  
  if (!contentId) {
    return [];
  }

  try {
    const createdIssuesKey = getCreatedIssuesKey(contentId);
    const createdIssues = await storage.get(createdIssuesKey);
    
    return createdIssues || [];
  } catch (error) {
    console.error('Error getting created issues:', error);
    return [];
  }
});

/**
 * Get meeting state for a page
 * @param {Object} req - Request object containing contentId
 * @returns {Promise<Object>} Meeting state object with defaults
 */
resolver.define('getMeeting', async (req) => {
  const { contentId } = req.payload;
  
  if (!contentId) {
    return {
      transcriptText: '',
      summary: '',
      createdIssueKeys: [],
      updatedAt: null
    };
  }

  try {
    const meetingKey = getMeetingKey(contentId);
    const meeting = await storage.get(meetingKey);
    
    if (meeting) {
      return {
        transcriptText: meeting.transcriptText || '',
        summary: meeting.summary || '',
        createdIssueKeys: meeting.createdIssueKeys || [],
        updatedAt: meeting.updatedAt || null
      };
    }
    
    // Return defaults if no meeting exists
    return {
      transcriptText: '',
      summary: '',
      createdIssueKeys: [],
      updatedAt: null
    };
  } catch (error) {
    console.error('Error getting meeting:', error);
    return {
      transcriptText: '',
      summary: '',
      createdIssueKeys: [],
      updatedAt: null
    };
  }
});

/**
 * Save transcript text to meeting state
 * @param {Object} req - Request object containing contentId and transcriptText
 * @returns {Promise<Object>} Updated meeting state
 */
resolver.define('saveTranscript', async (req) => {
  const { contentId, transcriptText } = req.payload;
  
  if (!contentId) {
    throw new Error('contentId is required');
  }

  try {
    const meetingKey = getMeetingKey(contentId);
    const existingMeeting = await storage.get(meetingKey) || {};
    
    const updatedMeeting = {
      ...existingMeeting,
      transcriptText: transcriptText || '',
      updatedAt: new Date().toISOString()
    };
    
    await storage.set(meetingKey, updatedMeeting);
    
    return updatedMeeting;
  } catch (error) {
    console.error('Error saving transcript:', error);
    throw error;
  }
});

/**
 * Save created issue keys to meeting state (merge and dedupe)
 * @param {Object} req - Request object containing contentId and issueKeys
 * @returns {Promise<Object>} Updated meeting state
 */
resolver.define('saveCreatedIssues', async (req) => {
  const { contentId, issueKeys } = req.payload;
  
  if (!contentId) {
    throw new Error('contentId is required');
  }
  
  if (!issueKeys || !Array.isArray(issueKeys)) {
    throw new Error('issueKeys must be an array');
  }

  try {
    const meetingKey = getMeetingKey(contentId);
    const existingMeeting = await storage.get(meetingKey) || {};
    
    // Get existing keys and merge with new ones, dedupe
    const existingKeys = existingMeeting.createdIssueKeys || [];
    const allKeys = [...existingKeys];
    
    // Add new keys that don't already exist
    issueKeys.forEach(key => {
      if (typeof key === 'string' && !allKeys.includes(key)) {
        allKeys.push(key);
      } else if (key && typeof key === 'object' && key.key && !allKeys.includes(key.key)) {
        // Handle case where issueKeys might be objects with .key property
        allKeys.push(key.key);
      }
    });
    
    const updatedMeeting = {
      ...existingMeeting,
      createdIssueKeys: allKeys,
      updatedAt: new Date().toISOString()
    };
    
    await storage.set(meetingKey, updatedMeeting);
    
    return updatedMeeting;
  } catch (error) {
    console.error('Error saving created issues:', error);
    throw error;
  }
});

/**
 * Generate a deterministic summary from transcript and analysis
 * @param {Object} req - Request object containing contentId and transcriptText
 * @returns {Promise<Object>} Summary object with whatWasDiscussed, decisions, actions
 */
resolver.define('generateSummary', async (req) => {
  const { contentId, transcriptText } = req.payload;
  
  if (!contentId) {
    throw new Error('contentId is required');
  }
  
  if (!transcriptText || !transcriptText.trim()) {
    throw new Error('transcriptText is required');
  }

  try {
    // Get existing analysis for this contentId
    const analysisKey = getAnalysisKey(contentId);
    const analysis = await storage.get(analysisKey) || {
      suggestions: [],
      decisions: [],
      actionItems: []
    };
    
    // Extract "What was discussed" - first 2 non-empty lines
    const lines = transcriptText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    const whatWasDiscussed = lines.slice(0, 2).join(' ');
    
    // Use decisions from analysis
    const decisions = analysis.decisions || [];
    
    // Use action items from analysis
    // Format action items for summary display (extract text from objects if needed)
    const actions = (analysis.actionItems || []).map(item => {
      // If it's already a string, return as-is
      if (typeof item === 'string') {
        return item;
      }
      // If it's an object, format it for display
      const actionText = item.text || item.originalLine || String(item);
      const ownerText = item.owner ? ` Owner: ${item.owner}` : '';
      const dueText = item.dueDate ? ` Due: ${item.dueDate}` : '';
      return `${actionText}${ownerText}${dueText}`;
    });
    
    // Build summary object
    const summary = {
      whatWasDiscussed: whatWasDiscussed || 'No discussion summary available.',
      decisions: decisions,
      actions: actions
    };
    
    // Store summary in meeting state
    const meetingKey = getMeetingKey(contentId);
    const existingMeeting = await storage.get(meetingKey) || {};
    
    const updatedMeeting = {
      ...existingMeeting,
      summary: JSON.stringify(summary), // Store as JSON string for consistency
      updatedAt: new Date().toISOString()
    };
    
    await storage.set(meetingKey, updatedMeeting);
    
    return summary;
  } catch (error) {
    console.error('Error generating summary:', error);
    throw error;
  }
});

/**
 * Clear all session data for a page (analysis, meeting, created issues)
 * Useful for starting fresh with a new transcript
 * @param {Object} req - Request object containing contentId
 * @returns {Promise<Object>} Success confirmation
 */
resolver.define('clearSessionData', async (req) => {
  const { contentId } = req.payload;
  
  if (!contentId) {
    throw new Error('contentId is required');
  }

  try {
    // Clear all storage keys for this contentId
    const sessionKey = getSessionKey(contentId);
    const analysisKey = getAnalysisKey(contentId);
    const meetingKey = getMeetingKey(contentId);
    const createdIssuesKey = getCreatedIssuesKey(contentId);
    
    // Delete all keys (storage.delete returns undefined if key doesn't exist, which is fine)
    await Promise.all([
      storage.delete(sessionKey),
      storage.delete(analysisKey),
      storage.delete(meetingKey),
      storage.delete(createdIssuesKey)
    ]);
    
    return { success: true, message: 'Session data cleared successfully' };
  } catch (error) {
    console.error('Error clearing session data:', error);
    throw error;
  }
});

/**
 * Reset meeting data for a page (meeting, analysis, and created issues)
 * Clears transcript, analysis, summary, and created issues for a fresh start
 * @param {Object} req - Request object containing contentId
 * @returns {Promise<Object>} Success confirmation
 */
resolver.define('resetMeeting', async (req) => {
  const { contentId } = req.payload;
  
  if (!contentId) {
    throw new Error('contentId is required');
  }

  try {
    // Clear meeting, analysis, and created issues keys for this contentId
    const analysisKey = getAnalysisKey(contentId);
    const meetingKey = getMeetingKey(contentId);
    const createdIssuesKey = getCreatedIssuesKey(contentId);
    
    // Delete meeting, analysis, and created issues
    await Promise.all([
      storage.delete(analysisKey),
      storage.delete(meetingKey),
      storage.delete(createdIssuesKey)
    ]);
    
    return { success: true, message: 'Meeting data reset successfully' };
  } catch (error) {
    console.error('Error resetting meeting:', error);
    throw error;
  }
});

export const handler = resolver.getDefinitions();
