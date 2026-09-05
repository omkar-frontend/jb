import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
    AlertCircle,
    Loader,
    Plus,
    Trash2,
} from 'lucide-react'
import { Navigate, useBlocker } from 'react-router-dom'
import CreatableSelect from 'react-select/creatable'
import { Back } from '../components/Back'
import ConfirmDialog from '../components/ConfirmDialog'
import { FormSkeleton } from '../components/FormSkeleton'
import { useAuth } from '../context/AuthContext'
import {
    mergeLanguageOptions,
    languagesToSelectValue,
    type LanguageOption,
} from '../data/languageOptions'
import {
    mergeSkillOptions,
    skillsToSelectValue,
    type SkillOption,
} from '../data/skillOptions'
import { multiSelectStyles } from '../lib/multiSelectStyles'
import {
    getCvProfile,
    parseExtractedInformation,
    saveCvExtractToProfile,
    updateCvProfile,
    type CvEducation,
    type CvExperience,
    type CvExtractApiPayload,
    type CvExtracted,
} from '../lib/cvProfile'

const inputClass = 'cmn-field'

function emptyExperience(): CvExperience {
    return {
        title: '',
        company: null,
        startDate: null,
        endDate: null,
        description: null,
    }
}

function emptyEducation(): CvEducation {
    return { degree: null, institution: null, year: null }
}

function emptyExtracted(): CvExtracted {
    return {
        fullName: null,
        email: null,
        phone: null,
        location: null,
        designation: null,
        summary: null,
        skills: [],
        experience: [],
        education: [],
        languages: [],
        links: {
            linkedin: null,
            github: null,
            portfolio: null,
            other: [],
        },
    }
}

function linesToList(value: string): string[] {
    return value
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
}

function listToLines(items: string[]): string {
    return items.join('\n')
}

function Field({
    label,
    children,
}: {
    label: string
    children: ReactNode
}) {
    return (
        <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">
                {label}
            </label>
            {children}
        </div>
    )
}

/**
 * The saved value is a string[], but parsing on every keystroke deletes the
 * newline the user just typed — `linesToList` filters empty lines, so pressing
 * Enter re-rendered the textarea without it and a second line was impossible.
 * Hold the raw text locally while editing and commit the parsed list on blur.
 */
function OtherLinksField({
    value,
    onChange,
}: {
    value: string[]
    onChange: (next: string[]) => void
}) {
    const [text, setText] = useState(() => listToLines(value))
    const [committed, setCommitted] = useState(value)

    // Re-sync when the list is replaced from outside (profile load, or our own
    // commit normalising the text). Adjusting state during render rather than in
    // an effect avoids a second render pass with stale text on screen.
    if (value !== committed) {
        setCommitted(value)
        setText(listToLines(value))
    }

    return (
        <textarea
            className={`${inputClass} resize-none`}
            rows={4}
            value={text}
            placeholder="e.g. https://twitter.com"
            onChange={(e) => setText(e.target.value)}
            onBlur={() => onChange(linesToList(text))}
        />
    )
}

function Section({
    title,
    description,
    children,
}: {
    title: string
    description?: string
    children: ReactNode
}) {
    return (
        <section className="rounded-2xl border border-[#e6e6e6]/75 bg-white p-3 md:p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
            <div className="flex flex-col gap-0">
                <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
                {description ? (
                    <p className="text-[13px] text-neutral-600">{description}</p>
                ) : null}
            </div>
            <div className="mt-4 space-y-4">{children}</div>
        </section>
    )
}

export default function Details() {
    const { user, loading: authLoading } = useAuth()
    const userId = user?.id ?? null
    const [fileMeta, setFileMeta] = useState({ fileName: '', mimeType: '' })
    const [form, setForm] = useState<CvExtracted | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [hasProfile, setHasProfile] = useState(false)
    /** Serialised form as last loaded or saved; anything else means unsaved edits. */
    const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)

    useEffect(() => {
        if (authLoading || !userId) return

        let cancelled = false

        async function load() {
            setLoading(true)
            setError(null)

            const { data, error: loadError } = await getCvProfile()

            if (cancelled) return

            if (loadError) {
                setError(loadError)
                setLoading(false)
                return
            }

            if (!data?.extractedInformation) {
                const blank = emptyExtracted()
                setHasProfile(false)
                setFileMeta({ fileName: '', mimeType: '' })
                setForm(blank)
                setSavedSnapshot(JSON.stringify(blank))
                setLoading(false)
                return
            }

            const parsed = parseExtractedInformation(data.extractedInformation)
            if (!parsed) {
                const blank = emptyExtracted()
                setError('Could not parse saved CV details. You can fill them in manually.')
                setHasProfile(false)
                setForm(blank)
                setSavedSnapshot(JSON.stringify(blank))
                setLoading(false)
                return
            }

            setHasProfile(true)
            setFileMeta({
                fileName: parsed.data.fileName,
                mimeType: parsed.data.mimeType,
            })
            setForm(parsed.data.extracted)
            setSavedSnapshot(JSON.stringify(parsed.data.extracted))
            setLoading(false)
        }

        void load()

        return () => {
            cancelled = true
        }
    }, [authLoading, userId])

    const isDirty =
        form !== null && savedSnapshot !== null && JSON.stringify(form) !== savedSnapshot

    // In-app navigation: Back, the header links, browser back/forward.
    // Memoised: useBlocker re-registers with the router whenever this function's
    // identity changes, which an inline arrow would do on every render.
    const shouldBlockNavigation = useCallback(
        ({
            currentLocation,
            nextLocation,
        }: {
            currentLocation: { pathname: string }
            nextLocation: { pathname: string }
        }) => isDirty && currentLocation.pathname !== nextLocation.pathname,
        [isDirty],
    )
    const blocker = useBlocker(shouldBlockNavigation)

    // Tab close, reload, or a link out of the app. The browser shows its own
    // generic prompt here — the wording is not ours to choose.
    useEffect(() => {
        if (!isDirty) return

        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            event.returnValue = ''
        }

        window.addEventListener('beforeunload', onBeforeUnload)
        return () => window.removeEventListener('beforeunload', onBeforeUnload)
    }, [isDirty])

    if (!authLoading && !user) {
        return <Navigate to="/login" replace state={{ from: '/details' }} />
    }

    const updateForm = (patch: Partial<CvExtracted>) => {
        setForm((prev) => (prev ? { ...prev, ...patch } : prev))
        setSaveSuccess(false)
    }

    const buildPayload = (): CvExtractApiPayload | null => {
        if (!form) return null
        return {
            success: true,
            data: {
                fileName: fileMeta.fileName,
                mimeType: fileMeta.mimeType,
                extracted: form,
            },
        }
    }

    const handleSave = async () => {
        const payload = buildPayload()
        if (!payload) return

        setSaving(true)
        setError(null)
        setSaveSuccess(false)

        const { error: saveError } = hasProfile
            ? await updateCvProfile(payload)
            : await saveCvExtractToProfile(payload)

        setSaving(false)

        if (saveError) {
            setError(saveError)
            return
        }

        setHasProfile(true)
        setSaveSuccess(true)
        setSavedSnapshot(JSON.stringify(payload.data.extracted))
    }

    return (
        <div className="min-h-[calc(100dvh-8rem)] bg-white w-full">
            <div className=" w-full">
                <div className="flex flex-wrap items-start lg:px-60 px-4 justify-between gap-4 sticky py-5 md:top-17.5 top-14.5 bg-white/80 backdrop-blur-sm z-10">
                    <div className="flex items-center gap-5">
                        <Back />
                        <div>
                            <h1 className="text-base font-semibold text-neutral-900">
                                CV details
                            </h1>
                            <p className="text-[13px] text-neutral-600">
                                View and edit information
                            </p>
                        </div>
                    </div>
                    {form ? (
                        <button
                            type="button"
                            onClick={() => void handleSave()}
                            disabled={saving}
                            className="cmn-button"
                        >
                            {saving ? (
                                <>
                                    <Loader
                                        className="h-4 w-4 animate-spin"
                                        aria-hidden
                                    />
                                    Saving…
                                </>
                            ) : (
                                <>
                                    Save changes
                                </>
                            )}
                        </button>
                    ) : null}
                </div>

                {saveSuccess ? (
                    <div className='lg:px-60 px-4'>
                        <div className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            Details saved successfully.
                        </div>
                    </div>
                ) : null}

                {error ? (
                    <div className='lg:px-60 px-4'>
                        <div
                            role="alert"
                            className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                        >
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                            <span>{error}</span>
                        </div>
                    </div>
                ) : null}

                {authLoading || loading ? (
                    <FormSkeleton className="px-4 pb-10 lg:px-60" />
                ) : form ? (
                    <form
                        className="space-y-6 px-4 pb-10 lg:px-60"
                        onSubmit={(e) => {
                            e.preventDefault()
                            void handleSave()
                        }}
                    >
                        {fileMeta.fileName ? (
                            <p className="text-sm text-neutral-500">
                                Source file:{' '}
                                <span className="font-medium text-neutral-700">
                                    {fileMeta.fileName}
                                </span>
                            </p>
                        ) : null}

                        <Section title="General" description="Contact and location">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Full name">
                                    <input
                                        className={inputClass}
                                        value={form.fullName ?? ''}
                                        placeholder="e.g. John Doe"
                                        onChange={(e) =>
                                            updateForm({
                                                fullName: e.target.value || null,
                                            })
                                        }
                                    />
                                </Field>
                                <Field label="Designation">
                                    <input
                                        className={inputClass}
                                        value={form.designation ?? ''}
                                        placeholder="e.g. Software Developer"
                                        onChange={(e) =>
                                            updateForm({
                                                designation: e.target.value || null,
                                            })
                                        }
                                    />
                                </Field>
                                <Field label="Email">
                                    <input
                                        type="email"
                                        className={inputClass}
                                        value={form.email ?? ''}
                                        placeholder="e.g. john.doe@example.com"
                                        onChange={(e) =>
                                            updateForm({
                                                email: e.target.value || null,
                                            })
                                        }
                                    />
                                </Field>
                                <Field label="Phone">
                                    <input
                                        className={inputClass}
                                        value={form.phone ?? ''}
                                        placeholder="e.g. +1234567890"
                                        onChange={(e) =>
                                            updateForm({
                                                phone: e.target.value || null,
                                            })
                                        }
                                    />
                                </Field>
                                <Field label="Location">
                                    <input
                                        className={inputClass}
                                        value={form.location ?? ''}
                                        placeholder="e.g. New York, NY"
                                        onChange={(e) =>
                                            updateForm({
                                                location: e.target.value || null,
                                            })
                                        }
                                    />
                                </Field>
                            </div>
                        </Section>

                        <Section title="Summary">
                            <textarea
                                className={`${inputClass} resize-none `}
                                value={form.summary ?? ''}
                                rows={4}
                                onChange={(e) =>
                                    updateForm({
                                        summary: e.target.value || null,
                                    })
                                }
                                placeholder="Professional summary"
                            />
                        </Section>

                        <Section
                            title="Skills"
                            description="Search and select skills, or type to add your own"
                        >
                            <CreatableSelect<SkillOption, true>
                                isMulti
                                isClearable
                                isSearchable
                                options={mergeSkillOptions(form.skills)}
                                value={skillsToSelectValue(form.skills)}
                                onChange={(selected) =>
                                    updateForm({
                                        skills: (selected ?? []).map(
                                            (option) => option.value
                                        ),
                                    })
                                }
                                styles={multiSelectStyles}
                                placeholder="Select or type skills…"
                                formatCreateLabel={(input) =>
                                    `Add "${input}"`
                                }
                                noOptionsMessage={() =>
                                    'Type to add a custom skill'
                                }
                                classNamePrefix="skills-select"
                            />
                        </Section>

                        <Section
                            title="Experience"
                            description="Work history from your CV"
                        >
                            <div className="space-y-6">
                                {form.experience.map((job, index) => (
                                    <div
                                        key={index}
                                        className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4"
                                    >
                                        <div className="mb-3 flex items-center justify-between">
                                            <span className="text-sm font-medium text-neutral-600">
                                                Role {index + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    updateForm({
                                                        experience:
                                                            form.experience.filter(
                                                                (_, i) =>
                                                                    i !== index
                                                            ),
                                                    })
                                                }
                                                className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                                            >
                                                <Trash2
                                                    className="h-3.5 w-3.5"
                                                    aria-hidden
                                                />
                                                Remove
                                            </button>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <Field label="Title">
                                                <input
                                                    className={inputClass}
                                                    value={job.title}
                                                    placeholder="e.g. Senior Software Engineer"
                                                    onChange={(e) => {
                                                        const next = [
                                                            ...form.experience,
                                                        ]
                                                        next[index] = {
                                                            ...job,
                                                            title: e.target.value,
                                                        }
                                                        updateForm({
                                                            experience: next,
                                                        })
                                                    }}
                                                />
                                            </Field>
                                            <Field label="Company">
                                                <input
                                                    className={inputClass}
                                                    value={job.company ?? ''}
                                                    placeholder="e.g. Acme Inc."
                                                    onChange={(e) => {
                                                        const next = [
                                                            ...form.experience,
                                                        ]
                                                        next[index] = {
                                                            ...job,
                                                            company:
                                                                e.target.value ||
                                                                null,
                                                        }
                                                        updateForm({
                                                            experience: next,
                                                        })
                                                    }}
                                                />
                                            </Field>
                                            <Field label="Start date">
                                                <input
                                                    className={inputClass}
                                                    value={job.startDate ?? ''}
                                                    placeholder="e.g. Jan 2020"
                                                    onChange={(e) => {
                                                        const next = [
                                                            ...form.experience,
                                                        ]
                                                        next[index] = {
                                                            ...job,
                                                            startDate:
                                                                e.target.value ||
                                                                null,
                                                        }
                                                        updateForm({
                                                            experience: next,
                                                        })
                                                    }}
                                                />
                                            </Field>
                                            <Field label="End date">
                                                <input
                                                    className={inputClass}
                                                    value={job.endDate ?? ''}
                                                    placeholder="e.g. Present"
                                                    onChange={(e) => {
                                                        const next = [
                                                            ...form.experience,
                                                        ]
                                                        next[index] = {
                                                            ...job,
                                                            endDate:
                                                                e.target.value ||
                                                                null,
                                                        }
                                                        updateForm({
                                                            experience: next,
                                                        })
                                                    }}
                                                />
                                            </Field>
                                        </div>
                                        <div className="mt-3">
                                            <Field label="Description">
                                                <textarea
                                                    className={`${inputClass} resize-none`}
                                                    rows={6}
                                                    value={job.description ?? ''}
                                                    placeholder="Key responsibilities and achievements"
                                                    onChange={(e) => {
                                                        const next = [
                                                            ...form.experience,
                                                        ]
                                                        next[index] = {
                                                            ...job,
                                                            description:
                                                                e.target.value ||
                                                                null,
                                                        }
                                                        updateForm({
                                                            experience: next,
                                                        })
                                                    }}
                                                />
                                            </Field>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() =>
                                        updateForm({
                                            experience: [
                                                ...form.experience,
                                                emptyExperience(),
                                            ],
                                        })
                                    }
                                    className="inline-flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:border-emerald-400 hover:bg-emerald-50/50"
                                >
                                    <Plus className="h-4 w-4" aria-hidden />
                                    Add experience
                                </button>
                            </div>
                        </Section>

                        <Section title="Education">
                            <div className="space-y-6">
                                {form.education.map((edu, index) => (
                                    <div
                                        key={index}
                                        className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4"
                                    >
                                        <div className="mb-3 flex items-center justify-between">
                                            <span className="text-sm font-medium text-neutral-600">
                                                Entry {index + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    updateForm({
                                                        education:
                                                            form.education.filter(
                                                                (_, i) =>
                                                                    i !== index
                                                            ),
                                                    })
                                                }
                                                className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                                            >
                                                <Trash2
                                                    className="h-3.5 w-3.5"
                                                    aria-hidden
                                                />
                                                Remove
                                            </button>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            <Field label="Degree">
                                                <input
                                                    className={inputClass}
                                                    value={edu.degree ?? ''}
                                                    placeholder="e.g. B.S. Computer Science"
                                                    onChange={(e) => {
                                                        const next = [
                                                            ...form.education,
                                                        ]
                                                        next[index] = {
                                                            ...edu,
                                                            degree:
                                                                e.target.value ||
                                                                null,
                                                        }
                                                        updateForm({
                                                            education: next,
                                                        })
                                                    }}
                                                />
                                            </Field>
                                            <Field label="Institution">
                                                <input
                                                    className={inputClass}
                                                    value={
                                                        edu.institution ?? ''
                                                    }
                                                    placeholder="e.g. Stanford University"
                                                    onChange={(e) => {
                                                        const next = [
                                                            ...form.education,
                                                        ]
                                                        next[index] = {
                                                            ...edu,
                                                            institution:
                                                                e.target.value ||
                                                                null,
                                                        }
                                                        updateForm({
                                                            education: next,
                                                        })
                                                    }}
                                                />
                                            </Field>
                                            <Field label="Year / period">
                                                <input
                                                    className={inputClass}
                                                    value={edu.year ?? ''}
                                                    placeholder="e.g. 2016 – 2020"
                                                    onChange={(e) => {
                                                        const next = [
                                                            ...form.education,
                                                        ]
                                                        next[index] = {
                                                            ...edu,
                                                            year:
                                                                e.target.value ||
                                                                null,
                                                        }
                                                        updateForm({
                                                            education: next,
                                                        })
                                                    }}
                                                />
                                            </Field>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() =>
                                        updateForm({
                                            education: [
                                                ...form.education,
                                                emptyEducation(),
                                            ],
                                        })
                                    }
                                    className="inline-flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:border-emerald-400 hover:bg-emerald-50/50"
                                >
                                    <Plus className="h-4 w-4" aria-hidden />
                                    Add education
                                </button>
                            </div>
                        </Section>

                        <Section
                            title="Languages"
                            description="Spoken languages — search, select, or add your own"
                        >
                            <CreatableSelect<LanguageOption, true>
                                isMulti
                                isClearable
                                isSearchable
                                options={mergeLanguageOptions(form.languages)}
                                value={languagesToSelectValue(form.languages)}
                                onChange={(selected) =>
                                    updateForm({
                                        languages: (selected ?? []).map(
                                            (option) => option.value
                                        ),
                                    })
                                }
                                styles={multiSelectStyles}
                                placeholder="Select or type languages…"
                                formatCreateLabel={(input) =>
                                    `Add "${input}"`
                                }
                                noOptionsMessage={() =>
                                    'Type to add a custom language'
                                }
                                classNamePrefix="languages-select"
                            />
                        </Section>

                        <Section title="Links">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="LinkedIn">
                                    <input
                                        className={inputClass}
                                        value={form.links.linkedin ?? ''}
                                        placeholder="e.g. https://linkedin.com"
                                        onChange={(e) =>
                                            updateForm({
                                                links: {
                                                    ...form.links,
                                                    linkedin:
                                                        e.target.value || null,
                                                },
                                            })
                                        }
                                    />
                                </Field>
                                <Field label="GitHub">
                                    <input
                                        className={inputClass}
                                        value={form.links.github ?? ''}
                                        placeholder="e.g. https://github.com"
                                        onChange={(e) =>
                                            updateForm({
                                                links: {
                                                    ...form.links,
                                                    github:
                                                        e.target.value || null,
                                                },
                                            })
                                        }
                                    />
                                </Field>
                                <Field label="Portfolio">
                                    <input
                                        className={inputClass}
                                        value={form.links.portfolio ?? ''}
                                        placeholder="e.g. https://your-portfolio.com"
                                        onChange={(e) =>
                                            updateForm({
                                                links: {
                                                    ...form.links,
                                                    portfolio:
                                                        e.target.value || null,
                                                },
                                            })
                                        }
                                    />
                                </Field>
                            </div>
                            <Field label="Other links (one per line)">
                                <OtherLinksField
                                    value={form.links.other}
                                    onChange={(other) =>
                                        updateForm({
                                            links: { ...form.links, other },
                                        })
                                    }
                                />
                            </Field>
                        </Section>
                    </form>
                ) : null}
            </div>

            <ConfirmDialog
                open={blocker.state === 'blocked'}
                onOpenChange={(open) => {
                    // Sole cancel path — Escape, backdrop and the cancel button
                    // all arrive here, so reset() is never called twice.
                    if (!open) blocker.reset?.()
                }}
                tone="danger"
                title="Discard unsaved changes?"
                description="Your edits to these CV details have not been saved. Leaving now will lose them."
                confirmLabel="Discard changes"
                cancelLabel="Keep editing"
                onConfirm={() => blocker.proceed?.()}
            />
        </div>
    )
}
