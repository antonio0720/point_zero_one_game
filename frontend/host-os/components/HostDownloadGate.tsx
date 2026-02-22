/**
 * Component for handling email capture and kit download triggering.
 */

import React, { FormEvent, useState } from 'react';
import axios from 'axios';

type Props = {};

const HostDownloadGate: React.FC<Props> = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    try {
      await axios.post('/api/kit-download', { name, email });
      // Trigger GHL webhook here
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="name">Name:</label>
      <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} />

      <label htmlFor="email">Email:</label>
      <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} />

      <button type="submit">Download Kit</button>
    </form>
  );
};

export default HostDownloadGate;
