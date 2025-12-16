import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';

function App() {
  // Session status: 'IDLE' | 'RUNNING'
  const [sessionStatus, setSessionStatus] = useState('IDLE');
  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  // Error state
  const [error, setError] = useState(null);
  // Debug info
  const [debugInfo, setDebugInfo] = useState({
    lastAction: null,
    lastResult: null,
    lastError: null
  });
  const [showDebug, setShowDebug] = useState(false);

  // Load session state on mount
  useEffect(() => {
    const loadSessionState = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const result = await invoke('getSessionState');
        
        if (result && result.status) {
          setSessionStatus(result.status);
          setDebugInfo(prev => ({
            ...prev,
            lastAction: 'getSessionState',
            lastResult: result
          }));
        }
      } catch (err) {
        console.error('Error loading session state:', err);
        setError(`Failed to load session state: ${err.message || err}`);
        setDebugInfo(prev => ({
          ...prev,
          lastAction: 'getSessionState',
          lastError: err.message || String(err)
        }));
      } finally {
        setIsLoading(false);
      }
    };

    loadSessionState();
  }, []);

  // Handler to start the session with optimistic update
  const handleStartSession = async () => {
    // Optimistic update
    const previousStatus = sessionStatus;
    setSessionStatus('RUNNING');
    setError(null);

    try {
      const result = await invoke('startSession');
      
      if (result && result.status) {
        setSessionStatus(result.status);
        setDebugInfo(prev => ({
          ...prev,
          lastAction: 'startSession',
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
        lastAction: 'startSession',
        lastError: err.message || String(err)
      }));
    }
  };

  // Handler to stop the session with optimistic update
  const handleStopSession = async () => {
    // Optimistic update
    const previousStatus = sessionStatus;
    setSessionStatus('IDLE');
    setError(null);

    try {
      const result = await invoke('stopSession');
      
      if (result && result.status) {
        setSessionStatus(result.status);
        setDebugInfo(prev => ({
          ...prev,
          lastAction: 'stopSession',
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
        lastAction: 'stopSession',
        lastError: err.message || String(err)
      }));
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
        gap: '12px'
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
      </div>

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
          <div style={{
            color: '#6B778C',
            fontSize: '14px',
            fontStyle: 'italic'
          }}>
            {/* Empty panel - content will be added later */}
          </div>
        </div>

        {/* AI Suggestions Panel */}
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
            AI Suggestions
          </h2>
          <div style={{
            color: '#6B778C',
            fontSize: '14px',
            fontStyle: 'italic'
          }}>
            {/* Empty panel - content will be added later */}
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
            color: '#6B778C',
            fontSize: '14px',
            fontStyle: 'italic'
          }}>
            {/* Empty panel - content will be added later */}
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
            color: '#6B778C',
            fontSize: '14px',
            fontStyle: 'italic'
          }}>
            {/* Empty panel - content will be added later */}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
