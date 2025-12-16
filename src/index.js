import Resolver from '@forge/resolver';
import { storage } from '@forge/api';

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
    
    // Extract suggestions (bullet-style insights)
    // Look for lines starting with bullet points, dashes, or numbered lists
    lines.forEach((line, index) => {
      const bulletPattern = /^[-•*]\s+(.+)$/i;
      const numberedPattern = /^\d+[.)]\s+(.+)$/;
      
      if (bulletPattern.test(line) || numberedPattern.test(line)) {
        const match = line.match(bulletPattern) || line.match(numberedPattern);
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
    
    // Extract action items
    // Look for patterns like "X will Y by Z", "Action:", "owner", "due", "assign"
    const actionPatterns = [
      /(?:action|task|todo|action item)\s*:/i,
      /\b(?:will|should|must|needs to)\s+(?:do|complete|finish|deliver|implement)/i,
      /\b(?:owner|assigned to|assignee|responsible)\s*:/i,
      /\b(?:due|deadline|by|target)\s*(?:date|date:|on)?\s*:?/i,
      /\b(?:by|before|until)\s+\d{1,2}[\/\-]\d{1,2}/i // dates like "by 12/31" or "before 12-31"
    ];
    
    lines.forEach((line) => {
      const lowerLine = line.toLowerCase();
      let isActionItem = false;
      
      // Check for explicit action markers
      if (/action\s*:/i.test(lowerLine) || /task\s*:/i.test(lowerLine)) {
        isActionItem = true;
      }
      
      // Check for "will/should/must" patterns
      if (/\b(?:will|should|must|needs to)\s+(?:do|complete|finish|deliver|implement|create|update|fix)/i.test(lowerLine)) {
        isActionItem = true;
      }
      
      // Check for owner/assignee patterns
      if (/\b(?:owner|assigned to|assignee|responsible)\s*:/i.test(lowerLine)) {
        isActionItem = true;
      }
      
      // Check for due date patterns
      if (/\b(?:due|deadline|by|before|until)\s*(?:date|date:|on)?\s*:?\s*\d/i.test(lowerLine)) {
        isActionItem = true;
      }
      
      if (isActionItem) {
        actionItems.push(line);
      }
    });
    
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

export const handler = resolver.getDefinitions();
