import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AuthContextValue = {
    user: User | null
    session: Session | null
    loading: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * supabase re-reads and re-parses the session from storage on every access, so a
 * value-identical session arrives as a fresh object. Left alone, that makes
 * `user` a new reference on each read and re-runs every effect keyed on it —
 * `getSession()` and the `INITIAL_SESSION` event alone fire twice on mount.
 */
function isSameSession(a: Session | null, b: Session | null) {
    if (a === b) return true
    if (!a || !b) return false
    return a.access_token === b.access_token && a.user.id === b.user.id
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)

    // Returning `prev` lets React bail out of the render entirely.
    const applySession = useCallback((next: Session | null) => {
        setSession((prev) => (isSameSession(prev, next) ? prev : next))
        setLoading(false)
    }, [])

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session: current } }) => {
            applySession(current)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            applySession(nextSession)
        })

        return () => subscription.unsubscribe()
    }, [applySession])

    const signOut = useCallback(async () => {
        await supabase.auth.signOut()
    }, [])

    const value = useMemo<AuthContextValue>(
        () => ({
            user: session?.user ?? null,
            session,
            loading,
            signOut,
        }),
        [session, loading, signOut]
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return ctx
}
