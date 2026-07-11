import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import AuthLayout from '../components/AuthLayout'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Signup() {
    const navigate = useNavigate()
    const { user, loading: authLoading } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    if (!authLoading && user) {
        return <Navigate to="/" replace />
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSuccessMessage(null)

        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters')
            return
        }

        setLoading(true)

        const { data, error: signUpError } = await supabase.auth.signUp({
            email: email.trim(),
            password,
        })

        setLoading(false)

        if (signUpError) {
            setError(signUpError.message)
            return
        }

        if (data.session) {
            navigate('/', { replace: true })
            return
        }

        setSuccessMessage(
            'Account created. Check your email for a confirmation link before signing in.'
        )

        setTimeout(() => {
            setSuccessMessage(null)
            navigate('/login')
        }, 5000)
    }

    return (
        <AuthLayout
            title="Create an account"
            subtitle="Sign up to save your preferences and CV data"
            footer={
                <>
                    Already have an account?{' '}
                    <Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-700 cursor-default">
                        Sign in
                    </Link>
                </>
            }
        >
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
                <div>
                    <label htmlFor="email" className="mb-1 block text-xs font-medium text-neutral-700">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="cmn-field"
                        placeholder="you@example.com"
                    />
                </div>
                <div>
                    <label htmlFor="password" className="mb-1 block text-xs font-medium text-neutral-700">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="cmn-field"
                        placeholder="At least 6 characters"
                    />
                </div>
                <div>
                    <label
                        htmlFor="confirmPassword"
                        className="mb-1 block text-xs font-medium text-neutral-700"
                    >
                        Confirm password
                    </label>
                    <input
                        id="confirmPassword"
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
                        className="flex items-start gap-2 font-medium rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
                    >
                        <span>{successMessage}</span>
                    </div>
                ) : null}

                <button
                    type="submit"
                    disabled={loading || authLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                >
                    {loading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            Creating account…
                        </>
                    ) : (
                        'Sign up'
                    )}
                </button>
            </form>
        </AuthLayout>
    )
}
