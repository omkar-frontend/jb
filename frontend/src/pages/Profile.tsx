import { useEffect, useState } from 'react'
import axios from 'axios'
import { AlertCircle, Loader2, User } from 'lucide-react'
import moment from 'moment'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, isApiConfigured } from '../lib/api'

export type ProfileUser = {
    id: string
    email: string | null
    phone: string | null
    role: string | null
    emailConfirmedAt: string | null
    phoneConfirmedAt: string | null
    createdAt: string | null
    lastSignInAt: string | null
    updatedAt: string | null
    metadata: Record<string, unknown>
    providers: Record<string, unknown>
    provider: string | null
}

type MeResponse = {
    success: boolean
    data?: ProfileUser
    error?: string
}

function formatDate(value: string | null) {
    if (!value) return '—'
    const m = moment(value)
    return m.isValid() ? m.format('MMM D, YYYY · h:mm A') : value
}

function ProfileField({ label, value }: { label: string; value: string }) {
    return (
        <div className="border-b border-neutral-100 py-4 last:border-0">
            <dt className="text-sm font-medium text-neutral-500">{label}</dt>
            <dd className="mt-1 break-all text-neutral-900">{value}</dd>
        </div>
    )
}

export default function Profile() {
    const { user, loading: authLoading } = useAuth()
    const [profile, setProfile] = useState<ProfileUser | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (authLoading) return

        if (!user) {
            setLoading(false)
            return
        }

        if (!isApiConfigured()) {
            setError('Backend URL is not configured (VITE_BACKEND_URL).')
            setLoading(false)
            return
        }

        let cancelled = false

        async function loadProfile() {
            setLoading(true)
            setError(null)

            try {
                const response = await api.get<MeResponse>('/auth/me')

                if (cancelled) return

                if (response.data.success && response.data.data) {
                    setProfile(response.data.data)
                } else {
                    setError(response.data.error ?? 'Could not load profile')
                }
            } catch (err) {
                if (cancelled) return
                const message =
                    axios.isAxiosError(err) && err.response?.data?.error
                        ? String(err.response.data.error)
                        : err instanceof Error
                          ? err.message
                          : 'Could not load profile'
                setError(message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        void loadProfile()

        return () => {
            cancelled = true
        }
    }, [authLoading, user])

    if (!authLoading && !user) {
        return <Navigate to="/login" replace state={{ from: '/profile' }} />
    }

    return (
        <div className="min-h-[calc(100dvh-8rem)] bg-white px-4 py-10 md:px-20">
            <div className="mx-auto max-w-2xl">
                <div className="mb-8 flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <User className="h-7 w-7" aria-hidden />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold text-neutral-900">Profile</h1>
                        <p className="mt-1 text-sm text-neutral-600">
                            Account details from the server (verified session)
                        </p>
                    </div>
                </div>

                {authLoading || loading ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 py-16 text-neutral-600">
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                        Loading profile…
                    </div>
                ) : error ? (
                    <div
                        role="alert"
                        className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800"
                    >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        <div>
                            <p>{error}</p>
                            <Link
                                to="/login"
                                className="mt-2 inline-block font-medium text-red-900 underline cursor-default"
                            >
                                Sign in again
                            </Link>
                        </div>
                    </div>
                ) : profile ? (
                    <section className="rounded-xl border border-neutral-200 bg-white px-6 shadow-sm">
                        <dl>
                            <ProfileField label="Email" value={profile.email ?? '—'} />
                            <ProfileField label="User ID" value={profile.id} />
                            <ProfileField label="Role" value={profile.role ?? '—'} />
                            <ProfileField
                                label="Sign-in provider"
                                value={profile.provider ?? '—'}
                            />
                            <ProfileField
                                label="Email confirmed"
                                value={formatDate(profile.emailConfirmedAt)}
                            />
                            <ProfileField
                                label="Account created"
                                value={formatDate(profile.createdAt)}
                            />
                            <ProfileField
                                label="Last sign in"
                                value={formatDate(profile.lastSignInAt)}
                            />
                            {profile.phone ? (
                                <ProfileField label="Phone" value={profile.phone} />
                            ) : null}
                        </dl>

                        {Object.keys(profile.metadata).length > 0 ? (
                            <div className="border-t border-neutral-100 py-4">
                                <h2 className="text-sm font-medium text-neutral-500">
                                    Profile metadata
                                </h2>
                                <pre className="mt-2 overflow-x-auto rounded-lg bg-neutral-50 p-3 text-xs text-neutral-800">
                                    {JSON.stringify(profile.metadata, null, 2)}
                                </pre>
                            </div>
                        ) : null}
                    </section>
                ) : null}
            </div>
        </div>
    )
}
