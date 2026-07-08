import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import AuthLayout from '../components/AuthLayout'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type LoginLocationState = {
    from?: string
    pendingCvSave?: boolean
}

export default function Login() {
    const navigate = useNavigate()
    const location = useLocation()
    const redirectState = (location.state as LoginLocationState | null) ?? {}
    const redirectTo = redirectState.from ?? '/'
    const { user, loading: authLoading } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    if (!authLoading && user) {
        return <Navigate to={redirectTo} replace />
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setLoading(true)

        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
        })

        setLoading(false)

        if (signInError) {
            setError(signInError.message)
            return
        }

        navigate(redirectTo, { replace: true })
    }

    return (
        <AuthLayout
            title="Welcome back"
            subtitle="Sign in to your account to continue"
            footer={
                <>
                    Don&apos;t have an account?{' '}
                    <Link to="/signup" className="font-medium text-emerald-600 hover:text-emerald-700 cursor-default">
                        Sign up
                    </Link>
                </>
            }
        >
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
                <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-700">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="you@example.com"
                    />
                </div>
                <div>
                    <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-700">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="••••••••"
                    />
                </div>

                {error ? (
                    <div
                        role="alert"
                        className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                    >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        <span>{error}</span>
                    </div>
                ) : null}

                <button
                    type="submit"
                    disabled={loading || authLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            Signing in…
                        </>
                    ) : (
                        'Sign in'
                    )}
                </button>
            </form>
        </AuthLayout>
    )
}
