import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type User = {
  id: string;
  email: string;
  username: string;
};

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function userFromSession(session: Session | null): User | null {
  if (!session?.user) return null;
  const { id, email, user_metadata } = session.user;
  return {
    id,
    email: email ?? '',
    username: (user_metadata?.username as string) ?? (email?.split('@')[0] ?? 'user'),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Check for an existing session on app launch (keeps you signed in
    // across app restarts, since Supabase persists sessions in AsyncStorage).
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(userFromSession(session));
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(userFromSession(session));
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.log('signIn error:', error.message);
        setAuthError(error.message);
      }
    } catch (err) {
      console.log('signIn threw:', err);
      setAuthError(err instanceof Error ? err.message : 'Something went wrong. Check your connection.');
    }
  };

  const signUp = async (email: string, username: string, password: string) => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (error) {
        console.log('signUp error:', error.message);
        setAuthError(error.message);
      }
    } catch (err) {
      console.log('signUp threw:', err);
      setAuthError(err instanceof Error ? err.message : 'Something went wrong. Check your connection.');
    }
  };

  const signOut = async () => {
    setAuthError(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, authError, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}