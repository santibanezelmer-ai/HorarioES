import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/profile.functions";
import { linkPendingInvitations } from "@/lib/tenant.functions";

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  colegio_id: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const withTimeout = <T,>(promise: Promise<T>, ms = 4000): Promise<T | null> =>
  Promise.race([promise, wait(ms).then(() => null)]);

async function fetchProfile(uid: string, fallbackUser?: User, accessToken?: string): Promise<Profile | null> {
  let lastError: unknown = null;

  if (accessToken) {
    try {
      const serverProfile = await withTimeout(getMyProfile({ data: { accessToken } }), 4000);
      if (serverProfile) return serverProfile as Profile | null;
    } catch (error) {
      lastError = error;
    }
  }

  for (let attempt = 0; attempt < 1; attempt += 1) {
    const result = await withTimeout(Promise.resolve(
      supabase
        .from("profiles")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle()
    ), 3000);

    if (!result) break;
    const { data, error } = result;

    if (!error) return data as Profile | null;

    lastError = error;
    await wait(500 * (attempt + 1));
  }

  console.error("No se pudo cargar el perfil", lastError);
  return fallbackUser ? {
    id: fallbackUser.id,
    user_id: fallbackUser.id,
    display_name: fallbackUser.user_metadata?.full_name ?? fallbackUser.user_metadata?.name ?? null,
    email: fallbackUser.email ?? null,
    avatar_url: fallbackUser.user_metadata?.avatar_url ?? null,
    colegio_id: null,
  } : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string, fallbackUser?: User, accessToken?: string) => {
    const nextProfile = await fetchProfile(uid, fallbackUser, accessToken);
    setProfile(nextProfile);
    return nextProfile;
  };

  useEffect(() => {
    let active = true;
    const safetyTimer = window.setTimeout(() => {
      if (active) setLoading(false);
    }, 5000);

    // Listener PRIMERO (regla de oro de Supabase)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setLoading(false);
        // Defer fetch para no bloquear el acceso a la app si el backend responde lento
        window.setTimeout(async () => {
          if (!active) return;
          // Cuando un usuario inicia sesión (o se registra) reclamamos cualquier
          // invitación pendiente vinculada a su correo antes de cargar el perfil,
          // de modo que el colegio_id ya esté seteado al refrescar.
          if (event === "SIGNED_IN" || event === "USER_UPDATED") {
            try {
              await linkPendingInvitations({ data: { accessToken: newSession.access_token } });
            } catch (err) {
              console.error("link_pending_invitations failed", err);
            }
          }
          await loadProfile(newSession.user.id, newSession.user, newSession.access_token);
        }, 0);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // Luego revisar sesión actual
    withTimeout(supabase.auth.getSession()).then(async (result) => {
      if (!active) return;
      const existing = result?.data.session ?? null;
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) void loadProfile(existing.user.id, existing.user, existing.access_token);
      if (active) setLoading(false);
    }).catch(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      window.clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id, user, session?.access_token);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
