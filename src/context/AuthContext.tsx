import { createContext, useContext, useState, ReactNode } from 'react';

type User = {
  email: string;
  username: string;
};

type AuthContextValue = {
  user: User | null;
  signIn: (email: string, password: string) => void;
  signUp: (email: string, username: string, password: string) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // TEMP: local-only auth. Replace with supabase.auth.signInWithPassword /
  // supabase.auth.signUp once the Supabase project is connected.
  const signIn = (email: string, _password: string) => {
    setUser({ email, username: email.split('@')[0] });
  };

  const signUp = (email: string, username: string, _password: string) => {
    setUser({ email, username });
  };

  const signOut = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
