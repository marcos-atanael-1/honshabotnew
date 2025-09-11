import { useContext } from 'react';
import { CustomAuthContext } from '../contexts/CustomAuthContext';

export function useCustomAuth() {
  const context = useContext(CustomAuthContext);
  if (context === undefined) {
    throw new Error('useCustomAuth must be used within a CustomAuthProvider. Make sure your component is wrapped with CustomAuthProvider.');
  }
  return context;
}
