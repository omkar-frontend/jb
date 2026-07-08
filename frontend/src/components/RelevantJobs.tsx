import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Briefcase, Loader, Loader2, RefreshCcw } from 'lucide-react'
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

export default function RelevantJobs() {
    const { user, loading: authLoading } = useAuth()
    const [designation, setDesignation] = useState<string | null>(null)
    const [location, setLocation] = useState<string | null>(null)
    const [profileLoading, setProfileLoading] = useState(true)
    const [jobs, setJobs] = useState<RelevantJob[]>([])
    const [jobsLoading, setJobsLoading] = useState(false)
    const [jobsError, setJobsError] = useState<string | null>(null)
    const [failedSources, setFailedSources] = useState<string[]>([])
    const [jobsRefreshKey, setJobsRefreshKey] = useState(0)

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
        if (!parsed) {
            setDesignation(null)
            setLocation(null)
            return
        }

        const extracted = parsed.data?.extracted
        setDesignation(extracted?.designation?.trim() || null)
        setLocation(extracted?.location?.trim() || null)
    }, [])

    const handleRefresh = useCallback(async () => {
        const parsed = await fetchProfile()
        applyProfile(parsed)
        setJobsRefreshKey((key) => key + 1)
    }, [fetchProfile, applyProfile])

    useEffect(() => {
        if (authLoading) return

        if (!user) {
            setDesignation(null)
            setLocation(null)
            setProfileLoading(false)
            return
        }

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
    }, [authLoading, user, fetchProfile, applyProfile])

    useEffect(() => {
        if (!designation || !isRelevantJobsConfigured()) {
            setJobs([])
            setFailedSources([])
            setJobsError(null)
            return
        }

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
    }, [designation, location, jobsRefreshKey])

    if (authLoading || profileLoading) {
        return null
    }

    return (
        <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="lex items-center gap-2">
                        <h2 className="text-base font-semibold text-neutral-900">
                            Relevant jobs
                        </h2>
                    </div>
                    <p className="text-[13px] text-neutral-600">
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
                    </p>
                </div>
                {/* Refresh button */}
                <button className="cmn-button-secondary" disabled={jobsLoading} onClick={handleRefresh}>
                    <RefreshCcw className={`${jobsLoading ? 'animate-spin' : ''} h-4 w-4`} aria-hidden />
                    {jobsLoading ? 'Refreshing' : 'Refresh'}
                </button>
            </div>

            {jobsLoading ? (
                <div className="flex flex-col text-sm items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 py-12 text-neutral-600">
                    <Loader className="h-5 w-5 animate-spin" aria-hidden />
                    Searching jobs
                </div>
            ) : jobsError ? (
                <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{jobsError}</span>
                </div>
            ) : jobs.length === 0 ? (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-10 text-center text-sm text-neutral-600">
                    No matching jobs found right now. Try updating your designation
                    on the details page.
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {jobs.map((job) => (
                        <JobCard key={job.id} job={job} />
                    ))}
                </div>
            )}

            {!jobsLoading && failedSources.length > 0 && jobs.length > 0 ? (
                <p className="mt-3 text-xs text-neutral-500">
                    Some providers could not be reached; showing results from
                    others.
                </p>
            ) : null}
        </section>
    )
}
