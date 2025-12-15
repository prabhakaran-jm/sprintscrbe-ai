import React, { useEffect, useState } from 'react';
import { view } from '@forge/bridge';
import { useConfig } from '@forge/react';

const useSubmit = () => {
  const [error, setError] = useState();
  const [message, setMessage] = useState('');

  const submit = async (fields) => {
    const payload = { config: fields };

    try {
      await view.submit(payload);
      setError(false);
      setMessage(`Submitted successfully.`);
    } catch (error) {
      setError(true);
      setMessage(`${error.code}: ${error.message}`);
    }
  };

  return {
    error,
    message,
    submit
  };
};

const Config = () => {
  const [value, setValue] = useState('');
  const { error, message, submit } = useSubmit();
  
  // Safely get config with error handling
  let config;
  try {
    config = useConfig();
  } catch (err) {
    console.error('Error getting config:', err);
    config = null;
  }

  useEffect(() => {
    if (config?.myField !== undefined) {
      setValue(config.myField);
    }
  }, [config?.myField]);

  return (
    <div style={{ padding: '20px' }}>
      <label htmlFor="myField" style={{ display: 'block', marginBottom: '8px' }}>
        Config field:
      </label>
      <input 
        type="text" 
        id="myField" 
        value={value} 
        onChange={(e) => setValue(e.target.value)}
        style={{ 
          width: '100%', 
          padding: '8px', 
          marginBottom: '12px',
          border: '1px solid #ccc',
          borderRadius: '3px'
        }}
      />
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => view.close()}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6B778C',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Close
        </button>
        <button 
          onClick={() => submit({ myField: value })}
          style={{
            padding: '8px 16px',
            backgroundColor: '#0052CC',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Submit
        </button>
      </div>
      {typeof error !== 'undefined' && (
        <p style={{ 
          marginTop: '12px', 
          color: error ? '#DE350B' : '#00875A' 
        }}>
          {message}
        </p>
      )}
    </div>
  );
};

export default Config;
