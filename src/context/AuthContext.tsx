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
  // 'confirm' = account made, waiting on the emailed confirmation link
  signUp: (email: string, username: string, password: string) => Promise<'done' | 'confirm' | 'error'>;
  resendConfirmation: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Supabase's raw auth errors, reworded for people signing up
function friendlyAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes('duplicate_inbox') || m.includes('database error saving new user')) {
    return 'That email (or a version of it) already has an account, or the username is taken. Try signing in instead.';
  }
  if (m.includes('already registered')) return 'An account already uses this email. Try signing in instead.';
  if (m.includes('email not confirmed')) {
    return 'Confirm your email first: tap the link we sent you, then sign in.';
  }
  if (m.includes('invalid login credentials')) return 'That email and password don’t match.';
  if (m.includes('rate limit')) return 'Too many tries. Wait a few minutes and try again.';
  return message;
}

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
        setAuthError(friendlyAuthError(error.message));
      }
    } catch (err) {
      console.log('signIn threw:', err);
      setAuthError(err instanceof Error ? err.message : 'Something went wrong. Check your connection.');
    }
  };

  const signUp = async (email: string, username: string, password: string) => {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (error) {
        console.log('signUp error:', error.message);
        setAuthError(friendlyAuthError(error.message));
        return 'error';
      }
      // With email confirmation on, Supabase hides whether an address is
      // taken: it "succeeds" with no identities instead of erroring
      if (data.user && data.user.identities?.length === 0) {
        setAuthError(friendlyAuthError('already registered'));
        return 'error';
      }
      return data.session ? 'done' : 'confirm';
    } catch (err) {
      console.log('signUp threw:', err);
      setAuthError(err instanceof Error ? err.message : 'Something went wrong. Check your connection.');
      return 'error';
    }
  };

  // Returns an error message, or null once the email is on its way
  const resendConfirmation = async (email: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    return error ? friendlyAuthError(error.message) : null;
  };

  const signOut = async () => {
    setAuthError(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, authError, signIn, signUp, resendConfirmation, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}