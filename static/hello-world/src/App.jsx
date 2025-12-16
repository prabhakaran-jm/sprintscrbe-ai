import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import { view } from '@forge/bridge';

function App() {
  // Session status: 'IDLE' | 'RUNNING'
  const [sessionStatus, setSessionStatus] = useState('IDLE');
  // Content ID from context
  const [contentId, setContentId] = useState(null);
  // Transcript text
  const [transcriptText, setTranscriptText] = useState('');
  // Analysis results
  const [analysis, setAnalysis] = useState({
    suggestions: [],
    decisions: [],
    actionItems: []
  });
  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  // Analyzing state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // Error state
  const [error, setError] = useState(null);
  // Debug info
  const [debugInfo, setDebugInfo] = useState({
    lastAction: null,
    lastResult: null,
    lastError: null
  });
  const [showDebug, setShowDebug] = useState(false);

  // Load contentId, session state, and analysis on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Get contentId from context
        const context = await view.getContext();
        const contentIdValue = context?.extension?.content?.id || context?.content?.id;
        
        if (contentIdValue) {
          setContentId(contentIdValue);
          
          // Load session state (per-page)
          const sessionResult = await invoke('getSessionState', { contentId: contentIdValue });
          if (sessionResult && sessionResult.status) {
            setSessionStatus(sessionResult.status);
          }
          
          // Load analysis
          const analysisResult = await invoke('getAnalysis', { contentId: contentIdValue });
          if (analysisResult) {
            setAnalysis({
              suggestions: analysisResult.suggestions || [],
              decisions: analysisResult.decisions || [],
              actionItems: analysisResult.actionItems || []
            });
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
        setError(`Failed to load data: ${err.message || err}`);
        setDebugInfo(prev => ({
          ...prev,
          lastAction: 'loadInitialData',
          lastError: err.message || String(err)
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
          <div><strong>Content ID:</strong> {contentId || 'Not available'}</div>
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
          <button
            onClick={handleAnalyze}
            disabled={sessionStatus !== 'RUNNING' || !transcriptText.trim() || isAnalyzing}
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#FFFFFF',
              backgroundColor: (sessionStatus !== 'RUNNING' || !transcriptText.trim() || isAnalyzing) ? '#C1C7D0' : '#0052CC',
              border: 'none',
              borderRadius: '3px',
              cursor: (sessionStatus !== 'RUNNING' || !transcriptText.trim() || isAnalyzing) ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze'}
          </button>
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
            {analysis.actionItems.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {analysis.actionItems.map((item, index) => (
                  <li key={index} style={{ marginBottom: '8px' }}>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: '#6B778C', fontStyle: 'italic' }}>
                No action items found yet. Analyze a transcript to extract action items.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
