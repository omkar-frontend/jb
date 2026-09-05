import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Loader, RefreshCcw } from 'lucide-react'
import AuthDialog from './AuthDialog'
import { useAuth } from '../context/AuthContext'
import {
    getCvProfile,
    parseExtractedInformation
} from '../lib/cvProfile'
import {
    fetchRelevantJobs,
    isRelevantJobsConfigured,
    type RelevantJob,
} from '../lib/relevantJobs'

function JobCard({ job }: { job: RelevantJob }) {
    const cardClassName =
        'block rounded-lg border border-neutral-200 bg-neutral-50/80 p-4 text-left transition-all duration-200 hover:border-emerald-400 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:ring-offset-2 cursor-default'

    const inner = (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {job.logo ? (
                <img
                    src={job.logo}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md border border-neutral-200 object-contain"
                />
            ) : (
                <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-200 text-sm font-semibold text-neutral-700"
                    aria-hidden
                >
                    {(job.company.trim()[0] ?? '?').toUpperCase()}
                </div>
            )}
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-neutral-900 text-base">{job.title}</p>
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                        {job.sourceLabel}
                    </span>
                </div>
                <p className="mt-1 text-sm text-neutral-600">
                    {job.company}
                    {job.location ? ` · ${job.location}` : ''}
                    {job.meta ? ` · ${job.meta}` : ''}
                </p>
                {job.summary ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-700">
                        {job.summary}
                    </p>
                ) : null}
            </div>
        </div>
    )

    if (job.url && job.url !== '#') {
        return (
            <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className={cardClassName}
            >
                {inner}
            </a>
        )
    }

    return <div className={cardClassName}>{inner}</div>
}

type RelevantJobsProps = {
    /** Bumped by the parent when the saved CV changes, so the profile is re-read. */
    refreshKey?: number
}

export default function RelevantJobs({ refreshKey = 0 }: RelevantJobsProps) {
    const { user, loading: authLoading } = useAuth()
    // Effects key on the id so a token refresh does not refetch everything.
    const userId = user?.id ?? null
    const [designation, setDesignation] = useState<string | null>(null)
    const [location, setLocation] = useState<string | null>(null)
    const [profileLoading, setProfileLoading] = useState(true)
    const [jobs, setJobs] = useState<RelevantJob[]>([])
    const [jobsLoading, setJobsLoading] = useState(false)
    const [jobsError, setJobsError] = useState<string | null>(null)
    const [failedSources, setFailedSources] = useState<string[]>([])
    const [jobsRefreshKey, setJobsRefreshKey] = useState(0)
    const [authDialogOpen, setAuthDialogOpen] = useState(false)

    const fetchProfile = useCallback(async () => {
        try {
            const { data, error } = await getCvProfile()
            if (error || !data?.extractedInformation) {
                return null
            }
            return parseExtractedInformation(data.extractedInformation)
        } catch (error) {
            console.error('Error fetching profile', error)
            return null
        }
    }, [])

    const applyProfile = useCallback((parsed: Awaited<ReturnType<typeof fetchProfile>>) => {
        const extracted = parsed?.data?.extracted
        const nextDesignation = extracted?.designation?.trim() || null

        setDesignation(nextDesignation)
        setLocation(extracted?.location?.trim() || null)

        // Raised in the same batch as the profile finishing. The jobs effect only
        // runs on the next commit, so without this the empty state would flash
        // for a frame between "profile loaded" and "search started".
        if (nextDesignation && isRelevantJobsConfigured()) {
            setJobsLoading(true)
        }
    }, [])

    const handleRefresh = useCallback(async () => {
        const parsed = await fetchProfile()
        applyProfile(parsed)
        setJobsRefreshKey((key) => key + 1)
    }, [fetchProfile, applyProfile])

    useEffect(() => {
        if (authLoading) return

        // Signed out: the logged-out branch renders below regardless of these,
        // and signing in re-runs this effect, so there is nothing to reset.
        if (!userId) return

        let cancelled = false

        void (async () => {
            setProfileLoading(true)
            const parsed = await fetchProfile()
            if (cancelled) return
            applyProfile(parsed)
            setProfileLoading(false)
        })()

        return () => {
            cancelled = true
        }
        // refreshKey re-reads the profile after a CV upload. Jobs refetch only if
        // that actually changed the designation or location, so an unchanged CV
        // costs one cheap GET rather than five provider calls.
    }, [authLoading, userId, refreshKey, fetchProfile, applyProfile])

    const hasQuery = Boolean(designation) && isRelevantJobsConfigured()

    useEffect(() => {
        // `designation` repeated for the type narrowing hasQuery cannot provide.
        if (!hasQuery || !designation) return

        const ctrl = new AbortController()

        void (async () => {
            setJobsLoading(true)
            setJobsError(null)
            setFailedSources([])

            try {
                const { jobs: fetched, sourceErrors } = await fetchRelevantJobs(
                    designation,
                    location,
                    ctrl.signal
                )

                if (ctrl.signal.aborted) return

                setJobs(fetched)
                setFailedSources(
                    Object.values(sourceErrors).filter(
                        (message): message is string => Boolean(message)
                    )
                )

                if (fetched.length === 0 && Object.keys(sourceErrors).length > 0) {
                    setJobsError('Could not load jobs from any provider.')
                }
            } catch (err) {
                if (ctrl.signal.aborted) return
                setJobsError(
                    err instanceof Error
                        ? err.message
                        : 'Could not load relevant jobs'
                )
                setJobs([])
            } finally {
                if (!ctrl.signal.aborted) setJobsLoading(false)
            }
        })()

        return () => ctrl.abort()
    }, [hasQuery, designation, location, jobsRefreshKey])

    if (authLoading) {
        return null
    }

    // Signed out is its own terminal state — no profile to read, nothing to search.
    if (!user) {
        return (
            <>
                <section className="mb-8 rounded-2xl border border-[#e6e6e6]/75 bg-white px-6 py-10 text-center shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
                    <h2 className="text-base font-semibold text-neutral-900">
                        Relevant jobs
                    </h2>
                    <p className="mx-auto mt-1 max-w-md text-[13px] text-neutral-600">
                        Sign in and save your CV details to see roles matched to your
                        designation, pulled from every provider at once.
                    </p>
                    <button
                        type="button"
                        onClick={() => setAuthDialogOpen(true)}
                        className="cmn-button mt-4"
                    >
                        Sign in
                    </button>
                </section>

                {/* Signing in here keeps the visitor on the page — the same reason
                    the CV upload uses a dialog rather than routing to /login. */}
                <AuthDialog
                    open={authDialogOpen}
                    onOpenChange={setAuthDialogOpen}
                    description="Sign in to see jobs matched to your CV."
                />
            </>
        )
    }

    // Without a designation there is nothing to search, so show nothing rather
    // than results left over from a previous one.
    const visibleJobs = hasQuery ? jobs : []
    const visibleError = hasQuery ? jobsError : null
    const visibleFailedSources = hasQuery ? failedSources : []

    // The profile read and the job search are one wait as far as the user is
    // concerned; the section stays on screen for both rather than appearing late.
    const isSearching = profileLoading || jobsLoading

    return (
        <section className="mb-8 rounded-2xl border border-[#e6e6e6]/75 bg-white p-3 md:p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold text-neutral-900">
                            Relevant jobs
                        </h2>
                    </div>
                    <p className="text-[13px] text-neutral-600">
                        {profileLoading ? (
                            'Matching open roles to your CV…'
                        ) : designation ? (
                            <>
                                Listings matched to your designation{' '}
                                <span className="font-medium text-neutral-800">
                                    {designation}
                                </span>
                                {location ? (
                                    <>
                                        {' '}
                                        in{' '}
                                        <span className="font-medium text-neutral-800">
                                            {location}
                                        </span>
                                    </>
                                ) : null}
                            </>
                        ) : (
                            'Add a designation on the CV details page to see matched roles.'
                        )}
                    </p>
                </div>
                {/* Refresh button */}
                <button className="cmn-button-secondary" disabled={isSearching} onClick={handleRefresh}>
                    <RefreshCcw className={`${isSearching ? 'animate-spin' : ''} h-3 w-3`} aria-hidden />
                    {isSearching ? 'Refreshing' : 'Refresh'}
                </button>
            </div>

            {isSearching ? (
                <div className="flex flex-col text-sm items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 py-12 text-neutral-600">
                    <Loader className="h-5 w-5 animate-spin" aria-hidden />
                    Searching jobs
                </div>
            ) : visibleError ? (
                <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{visibleError}</span>
                </div>
            ) : visibleJobs.length === 0 ? (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-10 text-center text-sm text-neutral-600">
                    No matching jobs found right now. Try updating your designation on the details page.
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {visibleJobs.map((job) => (
                        <JobCard key={job.id} job={job} />
                    ))}
                </div>
            )}

            {!isSearching && visibleFailedSources.length > 0 && visibleJobs.length > 0 ? (
                <p className="mt-3 text-xs text-neutral-500">
                    Some providers could not be reached; showing results from
                    others.
                </p>
            ) : null}
        </section>
    )
}
