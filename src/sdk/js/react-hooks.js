/**
 * React Hooks for LATIF
 */

import { useState, useEffect, useCallback } from 'react';

export function useLatifChat(client) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(async (content) => {
    setLoading(true);
    try {
      const newMessages = [...messages, { role: 'user', content }];
      const response = await client.chat(newMessages);
      setMessages([...newMessages, response]);
    } finally {
      setLoading(false);
    }
  }, [client, messages]);

  return { messages, loading, sendMessage };
}

export function useLatifModels(client) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.request('/api/models').then(setModels).finally(() => setLoading(false));
  }, [client]);

  return { models, loading };
}
