import Resolver from '@forge/resolver';
import { storage } from '@forge/api';

const resolver = new Resolver();

// Storage key prefix for session data
const SESSION_KEY_PREFIX = 'sprintscrbe:session:';

/**
 * Get the current session status for a page
 * @param {Object} req - Request object containing pageId
 * @returns {Promise<Object>} Session status object
 */
resolver.define('getSessionStatus', async (req) => {
  const { pageId } = req.payload;
  
  if (!pageId) {
    return { status: 'IDLE', updatedAt: null };
  }

  try {
    const storageKey = `${SESSION_KEY_PREFIX}${pageId}`;
    const sessionData = await storage.get(storageKey);
    
    if (sessionData) {
      return sessionData;
    }
    
    // Default to IDLE if no session exists
    return { status: 'IDLE', updatedAt: null };
  } catch (error) {
    console.error('Error getting session status:', error);
    // Return IDLE on error to avoid breaking the UI
    return { status: 'IDLE', updatedAt: null };
  }
});

/**
 * Start a session for a page
 * @param {Object} req - Request object containing pageId
 * @returns {Promise<Object>} Updated session status
 */
resolver.define('startSession', async (req) => {
  const { pageId } = req.payload;
  
  if (!pageId) {
    throw new Error('pageId is required');
  }

  try {
    const storageKey = `${SESSION_KEY_PREFIX}${pageId}`;
    const sessionData = {
      status: 'LIVE',
      updatedAt: new Date().toISOString()
    };
    
    await storage.set(storageKey, sessionData);
    
    return sessionData;
  } catch (error) {
    console.error('Error starting session:', error);
    throw error;
  }
});

/**
 * Stop a session for a page
 * @param {Object} req - Request object containing pageId
 * @returns {Promise<Object>} Updated session status
 */
resolver.define('stopSession', async (req) => {
  const { pageId } = req.payload;
  
  if (!pageId) {
    throw new Error('pageId is required');
  }

  try {
    const storageKey = `${SESSION_KEY_PREFIX}${pageId}`;
    const sessionData = {
      status: 'IDLE',
      updatedAt: new Date().toISOString()
    };
    
    await storage.set(storageKey, sessionData);
    
    return sessionData;
  } catch (error) {
    console.error('Error stopping session:', error);
    throw error;
  }
});

export const handler = resolver.getDefinitions();
