import React, { useState } from 'react';

function App() {
  // State to track if session is active
  const [isSessionActive, setIsSessionActive] = useState(false);

  // Handler to start the session
  const handleStartSession = () => {
    setIsSessionActive(true);
  };

  // Handler to stop the session
  const handleStopSession = () => {
    setIsSessionActive(false);
  };

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      {/* Header Section */}
      <div style={{ 
        marginBottom: '24px',
        borderBottom: '2px solid #e3e5e9',
        paddingBottom: '16px'
      }}>
        <h1 style={{ 
          margin: '0 0 12px 0',
          fontSize: '24px',
          fontWeight: '600',
          color: '#172B4D'
        }}>
          SprintScribe AI — Pit Crew Console
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '3px',
            backgroundColor: '#DFE1E6',
            color: '#42526E',
            fontSize: '12px',
            fontWeight: '600',
            textTransform: 'uppercase'
          }}>
            Idle
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
          disabled={isSessionActive}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#FFFFFF',
            backgroundColor: isSessionActive ? '#C1C7D0' : '#0052CC',
            border: 'none',
            borderRadius: '3px',
            cursor: isSessionActive ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => {
            if (!isSessionActive) {
              e.target.style.backgroundColor = '#0065FF';
            }
          }}
          onMouseOut={(e) => {
            if (!isSessionActive) {
              e.target.style.backgroundColor = '#0052CC';
            }
          }}
        >
          Start Session
        </button>
        <button
          onClick={handleStopSession}
          disabled={!isSessionActive}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#FFFFFF',
            backgroundColor: !isSessionActive ? '#C1C7D0' : '#DE350B',
            border: 'none',
            borderRadius: '3px',
            cursor: !isSessionActive ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => {
            if (isSessionActive) {
              e.target.style.backgroundColor = '#FF5630';
            }
          }}
          onMouseOut={(e) => {
            if (isSessionActive) {
              e.target.style.backgroundColor = '#DE350B';
            }
          }}
        >
          Stop Session
        </button>
      </div>

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
