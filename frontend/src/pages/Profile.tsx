import { useEffect, useState } from 'react'
import axios from 'axios'
import { AlertCircle, Calendar, Clock, Mail } from 'lucide-react'
import moment from 'moment'
import { Link, Navigate } from 'react-router-dom'
import { Back } from '../components/Back'
import { FormSkeleton } from '../components/FormSkeleton'
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

/** Parse a UTC ISO timestamp and format it in the user's local timezone. */
function formatLocalDate(value: string | null) {
    if (!value) return '—'
    const m = moment.utc(value).local()
    return m.isValid() ? m.format('MMM D, YYYY · h:mm A') : value
}

function ProfileRow({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof Mail
    label: string
    value: string
}) {
    return (
        <div className="flex items-start gap-3 border-b border-neutral-100 py-4 last:border-0 last:pb-0 first:pt-0">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                <Icon className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
                <dt className="text-xs font-medium text-neutral-500">{label}</dt>
                <dd className="mt-0.5 break-all text-sm font-medium text-neutral-900">
                    {value}
                </dd>
            </div>
        </div>
    )
}

export default function Profile() {
    const { user, loading: authLoading } = useAuth()
    const userId = user?.id ?? null
    const [profile, setProfile] = useState<ProfileUser | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    // Constant for the app's lifetime, so it is derived rather than pushed into
    // state from inside the effect.
    const apiConfigured = isApiConfigured()
    const configError = apiConfigured
        ? null
        : 'Backend URL is not configured (VITE_BACKEND_URL).'

    useEffect(() => {
        // Signed out the component redirects to /login before rendering the
        // skeleton, so `loading` staying true is never observed.
        if (authLoading || !userId || !apiConfigured) return

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
    }, [authLoading, userId, apiConfigured])

    if (!authLoading && !user) {
        return <Navigate to="/login" replace state={{ from: '/profile' }} />
    }

    return (
        <div className="min-h-[calc(100dvh-8rem)] w-full bg-white">
            <div className="w-full">
                <div className="sticky top-17.5 z-10 flex flex-wrap items-start justify-between gap-4 bg-white/80 px-4 py-5 backdrop-blur-sm lg:px-60">
                    <div className="flex items-center gap-5">
                        <Back />
                        <div>
                            <h1 className="text-base font-semibold text-neutral-900">
                                Profile
                            </h1>
                            <p className="text-[13px] text-neutral-600">
                                Your account details
                            </p>
                        </div>
                    </div>
                </div>

                {error ?? configError ? (
                    <div className="px-4 lg:px-60">
                        <div
                            role="alert"
                            className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                        >
                            <AlertCircle
                                className="mt-0.5 h-4 w-4 shrink-0"
                                aria-hidden
                            />
                            <div>
                                <p>{error ?? configError}</p>
                                <Link
                                    to="/login"
                                    className="mt-2 inline-block font-medium text-red-900 underline"
                                >
                                    Sign in again
                                </Link>
                            </div>
                        </div>
                    </div>
                ) : null}

                {authLoading || (apiConfigured && loading) ? (
                    <FormSkeleton
                        className="px-4 pb-10 lg:px-60"
                        sections={1}
                        fields={3}
                        showTextarea={false}
                    />
                ) : profile ? (
                    <div className="space-y-6 px-4 pb-10 lg:px-60">
                        <section className="rounded-2xl border border-[#e6e6e6]/75 bg-white p-3 shadow-[0_1px_8px_rgba(0,0,0,0.05)] md:p-4">
                            <div className="flex flex-col gap-0">
                                <h2 className="text-base font-semibold text-neutral-900">
                                    Account
                                </h2>
                                <p className="text-[13px] text-neutral-600">
                                    Email and activity timestamps
                                </p>
                            </div>
                            <dl className="mt-4">
                                <ProfileRow
                                    icon={Mail}
                                    label="Email"
                                    value={profile.email ?? '—'}
                                />
                                <ProfileRow
                                    icon={Calendar}
                                    label="Account created"
                                    value={formatLocalDate(profile.createdAt)}
                                />
                                <ProfileRow
                                    icon={Clock}
                                    label="Last sign in"
                                    value={formatLocalDate(profile.lastSignInAt)}
                                />
                            </dl>
                        </section>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
