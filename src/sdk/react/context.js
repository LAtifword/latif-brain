import { createContext } from 'react';

export const LatifContext = createContext(null);

export function LatifProvider({ children, client }) {
  return (
    <LatifContext.Provider value={{ client }}>
      {children}
    </LatifContext.Provider>
  );
}
