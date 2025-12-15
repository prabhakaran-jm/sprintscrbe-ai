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
  const config = useConfig();

  useEffect(() => {
    setValue(config?.myField);
  }, [config?.myField]);

  return (
    <div>
      <label for="myField">Config field:</label>
      <input type="text" id="myField" value={value} onChange={(e) => setValue(e.target.value)} />
      <button onClick={() => view.close()}>Close</button>
      <button onClick={() => submit({ myField: value })}>Submit</button>
      {typeof error !== 'undefined' && <p>{message}</p>}
    </div>
  );
};

export default Config;
