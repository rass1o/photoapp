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
  // 'unconfirmed' = right password, but the email hasn't been verified yet
  signIn: (email: string, password: string) => Promise<'done' | 'unconfirmed' | 'error'>;
  // 'confirm' = account made, waiting on the emailed 6-digit code
  signUp: (email: string, username: string, password: string) => Promise<'done' | 'confirm' | 'error'>;
  resendConfirmation: (email: string) => Promise<string | null>;
  // Checks the emailed sign-up code; signs in on success. Returns an error or null
  verifySignupCode: (email: string, code: string) => Promise<string | null>;
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
    return 'Confirm your email first: enter the code we sent you.';
  }
  if ((m.includes('token') || m.includes('otp')) && (m.includes('expired') || m.includes('invalid'))) {
    return 'That code is wrong or has expired. Check it, or send a new one.';
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
        // the screen switches to code entry instead of showing an error
        if (error.message.toLowerCase().includes('email not confirmed')) return 'unconfirmed';
        setAuthError(friendlyAuthError(error.message));
        return 'error';
      }
      return 'done';
    } catch (err) {
      console.log('signIn threw:', err);
      setAuthError(err instanceof Error ? err.message : 'Something went wrong. Check your connection.');
      return 'error';
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

  const verifySignupCode = async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
    return error ? friendlyAuthError(error.message) : null;
  };

  const signOut = async () => {
    setAuthError(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, authError, signIn, signUp, resendConfirmation, verifySignupCode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}