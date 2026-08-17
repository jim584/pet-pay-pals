import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "pet_owner" | "vet" | "admin" | "content_editor";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  roleLoading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectRole: (role: "pet_owner" | "vet") => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const explicitSignOutRef = useRef(false);

  const fetchRole = async (userId: string) => {
    setRoleLoading(true);
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      setRole((data?.role as AppRole) ?? null);
    } finally {
      setRoleLoading(false);
    }
  };

  useEffect(() => {
    let initialLoadDone = false;
    let mounted = true;

    // Set up listener first, but DON'T resolve loading from it during initial load.
    // Only getSession() below should flip loading to false, preventing flash redirects.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        if (event === 'TOKEN_REFRESHED' && !newSession) {
          console.warn('Token refresh returned no session — keeping current state');
          return;
        }

        if (event === 'SIGNED_OUT') {
          if (explicitSignOutRef.current) {
            explicitSignOutRef.current = false;
            setSession(null);
            setUser(null);
            setRole(null);
          } else {
            console.warn('Unexpected SIGNED_OUT event — attempting session recovery');
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              setSession(data.session);
              setUser(data.session.user);
              setTimeout(() => { if (mounted) fetchRole(data.session!.user.id); }, 0);
            } else {
              setSession(null);
              setUser(null);
              setRole(null);
            }
          }
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          setRoleLoading(true);
          setTimeout(() => { if (mounted) fetchRole(newSession.user.id); }, 0);
        } else {
          setRole(null);
          setRoleLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setRoleLoading(true);
        fetchRole(s.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // Proactively refresh session when tab becomes visible after idle
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          if (!mounted) return;
          if (s) {
            setSession(s);
            setUser(s.user);
          }
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    explicitSignOutRef.current = true;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const selectRole = async (selectedRole: "pet_owner" | "vet") => {
    if (!user) throw new Error("Not authenticated");
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role: selectedRole });
    if (error) throw error;
    setRole(selectedRole);
  };

  const refreshRole = async () => {
    if (user) await fetchRole(user.id);
  };

  return (
    <AuthContext.Provider
      value={{ session, user, role, loading, roleLoading, signUp, signIn, signOut, selectRole, refreshRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
