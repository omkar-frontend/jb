import { useEffect, useState, type ReactNode } from 'react'
import {
    AlertCircle,
    CheckCircle2,
    Loader2,
    Plus,
    Save,
    Trash2,
} from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import CreatableSelect from 'react-select/creatable'
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

const inputClass =
    'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'

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
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                {label}
            </label>
            {children}
        </div>
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
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
            {description ? (
                <p className="mt-1 text-sm text-neutral-500">{description}</p>
            ) : null}
            <div className="mt-4 space-y-4">{children}</div>
        </section>
    )
}

export default function Details() {
    const { user, loading: authLoading } = useAuth()
    const [profileId, setProfileId] = useState<string | null>(null)
    const [fileMeta, setFileMeta] = useState({ fileName: '', mimeType: '' })
    const [form, setForm] = useState<CvExtracted | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [hasProfile, setHasProfile] = useState(false)

    useEffect(() => {
        if (authLoading || !user) return

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
                setHasProfile(false)
                setForm(null)
                setLoading(false)
                return
            }

            const parsed = parseExtractedInformation(data.extractedInformation)
            if (!parsed) {
                setError('Could not parse saved CV details.')
                setLoading(false)
                return
            }

            setHasProfile(true)
            setProfileId(data.id)
            setFileMeta({
                fileName: parsed.data.fileName,
                mimeType: parsed.data.mimeType,
            })
            setForm(parsed.data.extracted)
            setLoading(false)
        }

        void load()

        return () => {
            cancelled = true
        }
    }, [authLoading, user])

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
    }

    return (
        <div className="min-h-[calc(100dvh-8rem)] bg-white px-4 py-10 md:px-40">
            <div className="mx-auto max-w-3xl">
                <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-neutral-900">
                            CV details
                        </h1>
                        <p className="mt-1 text-sm text-neutral-600">
                            View and edit information extracted from your resume
                        </p>
                    </div>
                    {form ? (
                        <button
                            type="button"
                            onClick={() => void handleSave()}
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving ? (
                                <>
                                    <Loader2
                                        className="h-4 w-4 animate-spin"
                                        aria-hidden
                                    />
                                    Saving…
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" aria-hidden />
                                    Save changes
                                </>
                            )}
                        </button>
                    ) : null}
                </div>

                {saveSuccess ? (
                    <div className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                        Details saved successfully.
                    </div>
                ) : null}

                {error ? (
                    <div
                        role="alert"
                        className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                    >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        <span>{error}</span>
                    </div>
                ) : null}

                {authLoading || loading ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 py-16 text-neutral-600">
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                        Loading details…
                    </div>
                ) : !form ? (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-12 text-center">
                        <p className="text-neutral-700">
                            No CV details saved yet. Upload and extract your CV on
                            the home page first.
                        </p>
                        <Link
                            to="/"
                            className="mt-4 inline-block font-medium text-emerald-600 hover:text-emerald-700"
                        >
                            Go to home
                        </Link>
                    </div>
                ) : (
                    <form
                        className="space-y-6"
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
                                {profileId ? (
                                    <span className="ml-2 text-neutral-400">
                                        · ID {profileId.slice(0, 8)}…
                                    </span>
                                ) : null}
                            </p>
                        ) : null}

                        <Section title="General" description="Contact and location">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Full name">
                                    <input
                                        className={inputClass}
                                        value={form.fullName ?? ''}
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
                                        onChange={(e) =>
                                            updateForm({
                                                designation: e.target.value || null,
                                            })
                                        }
                                        placeholder="e.g. Software Developer"
                                    />
                                </Field>
                                <Field label="Email">
                                    <input
                                        type="email"
                                        className={inputClass}
                                        value={form.email ?? ''}
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
                                <textarea
                                    className={`${inputClass} resize-none`}
                                    rows={4}
                                    value={listToLines(form.links.other)}
                                    onChange={(e) =>
                                        updateForm({
                                            links: {
                                                ...form.links,
                                                other: linesToList(
                                                    e.target.value
                                                ),
                                            },
                                        })
                                    }
                                />
                            </Field>
                        </Section>

                        <div className="flex justify-end pb-8">
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {saving ? (
                                    <>
                                        <Loader2
                                            className="h-4 w-4 animate-spin"
                                            aria-hidden
                                        />
                                        Saving…
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4" aria-hidden />
                                        Save changes
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
