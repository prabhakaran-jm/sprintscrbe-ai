import Resolver from '@forge/resolver';
import { storage } from '@forge/api';

const resolver = new Resolver();

// Storage key for session state
const STORAGE_KEY = 'sprintscrbe.session.state';

/**
 * Get the current session state
 * @returns {Promise<Object>} Session state object
 */
resolver.define('getSessionState', async () => {
  try {
    const sessionData = await storage.get(STORAGE_KEY);
    
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
 * Start a session
 * @returns {Promise<Object>} Updated session state
 */
resolver.define('startSession', async () => {
  try {
    const sessionData = {
      status: 'RUNNING'
    };
    
    await storage.set(STORAGE_KEY, sessionData);
    
    return sessionData;
  } catch (error) {
    console.error('Error starting session:', error);
    throw error;
  }
});

/**
 * Stop a session
 * @returns {Promise<Object>} Updated session state
 */
resolver.define('stopSession', async () => {
  try {
    const sessionData = {
      status: 'IDLE'
    };
    
    await storage.set(STORAGE_KEY, sessionData);
    
    return sessionData;
  } catch (error) {
    console.error('Error stopping session:', error);
    throw error;
  }
});

export const handler = resolver.getDefinitions();
