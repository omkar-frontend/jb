import { useState } from 'react'
import { AlertCircle, Loader } from 'lucide-react'
import { supabase } from '../lib/supabase'

export type AuthMode = 'login' | 'signup'

type AuthFormProps = {
    mode: AuthMode
    /** Called once a session exists. Not called when signup needs email confirmation. */
    onSuccess?: () => void
    autoFocus?: boolean
}

/**
 * Shared credential form behind both the /login and /signup routes and the
 * sign-in dialog, so the dialog cannot drift from the pages.
 */
export default function AuthForm({ mode, onSuccess, autoFocus = false }: AuthFormProps) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const isSignup = mode === 'signup'

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSuccessMessage(null)

        if (isSignup) {
            if (password !== confirmPassword) {
                setError('Passwords do not match')
                return
            }
            if (password.length < 6) {
                setError('Password must be at least 6 characters')
                return
            }
        }

        setLoading(true)

        const { data, error: authError } = isSignup
            ? await supabase.auth.signUp({ email: email.trim(), password })
            : await supabase.auth.signInWithPassword({ email: email.trim(), password })

        setLoading(false)

        if (authError) {
            setError(authError.message)
            return
        }

        // Signup with email confirmation enabled returns no session yet.
        if (!data.session) {
            setSuccessMessage(
                'Account created. Check your email for a confirmation link before signing in.'
            )
            return
        }

        onSuccess?.()
    }

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
            <div>
                <label htmlFor={`${mode}-email`} className="mb-1 block text-xs font-medium text-neutral-700">
                    Email
                </label>
                <input
                    id={`${mode}-email`}
                    type="email"
                    autoComplete="email"
                    required
                    autoFocus={autoFocus}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="cmn-field"
                    placeholder="you@example.com"
                />
            </div>
            <div>
                <label htmlFor={`${mode}-password`} className="mb-1 block text-xs font-medium text-neutral-700">
                    Password
                </label>
                <input
                    id={`${mode}-password`}
                    type="password"
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    required
                    minLength={isSignup ? 6 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="cmn-field"
                    placeholder={isSignup ? 'At least 6 characters' : '••••••••'}
                />
            </div>
            {isSignup ? (
                <div>
                    <label
                        htmlFor="signup-confirm-password"
                        className="mb-1 block text-xs font-medium text-neutral-700"
                    >
                        Confirm password
                    </label>
                    <input
                        id="signup-confirm-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="cmn-field"
                        placeholder="Repeat your password"
                    />
                </div>
            ) : null}

            {error ? (
                <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{error}</span>
                </div>
            ) : null}

            {successMessage ? (
                <div
                    role="status"
                    className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
                >
                    <span>{successMessage}</span>
                </div>
            ) : null}

            <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {loading ? (
                    <>
                        <Loader className="h-4 w-4 animate-spin" aria-hidden />
                        {isSignup ? 'Creating account…' : 'Signing in…'}
                    </>
                ) : isSignup ? (
                    'Sign up'
                ) : (
                    'Sign in'
                )}
            </button>
        </form>
    )
}
