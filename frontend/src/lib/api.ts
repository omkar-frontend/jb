import axios from 'axios'
import { supabase } from './supabase'

const backendUrl = import.meta.env.VITE_BACKEND_URL as string | undefined

export const api = axios.create({
    baseURL: backendUrl,
})

/**
 * supabase.auth.getSession() re-reads and re-parses the session from storage on
 * every call, and the interceptor runs on every request — six times for one Home
 * visit. Mirror the token here instead and let onAuthStateChange keep it current.
 */
let cachedToken: string | null = null
let cachedExpiresAt: number | null = null
/** True once onAuthStateChange has told us definitively whether a session exists. */
let sessionResolved = false

/** Refresh slightly early so a token never goes out mid-flight. */
const EXPIRY_MARGIN_SECONDS = 60

function rememberSession(session: { access_token: string; expires_at?: number } | null) {
    cachedToken = session?.access_token ?? null
    cachedExpiresAt = session?.expires_at ?? null
}

// Fires immediately with INITIAL_SESSION, then on sign-in, sign-out and refresh.
supabase.auth.onAuthStateChange((_event, session) => {
    rememberSession(session)
    sessionResolved = true
})

function cachedTokenIsUsable(): boolean {
    if (!cachedToken) return false
    if (!cachedExpiresAt) return false
    return cachedExpiresAt - EXPIRY_MARGIN_SECONDS > Date.now() / 1000
}

async function getAccessToken(): Promise<string | null> {
    if (cachedTokenIsUsable()) return cachedToken

    // Signed out, and we know it — anonymous portal browsing is the common case,
    // so do not pay for a storage read on every request just to confirm.
    if (sessionResolved && cachedToken === null) return null

    // Cold start, or the token is at/near expiry — getSession refreshes it for us.
    const {
        data: { session },
    } = await supabase.auth.getSession()
    rememberSession(session)
    return cachedToken
}

api.interceptors.request.use(async (config) => {
    const token = await getAccessToken()
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }

    return config
})

export function isApiConfigured() {
    return Boolean(backendUrl)
}
