import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
    AlertCircle,
    CheckCircle2,
    FileText,
    Loader2,
    Save,
    Sparkles,
    Upload,
    X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
    clearPendingCvExtract,
    readPendingCvExtract,
    saveCvExtractToProfile,
    stashPendingCvExtract,
    type CvExtractApiPayload,
    type CvExtracted,
} from "../lib/cvProfile";

export type { CvExtracted, CvExperience, CvEducation } from "../lib/cvProfile";

type ExtractResponse = {
    success: boolean;
    data?: {
        fileName: string;
        mimeType: string;
        extracted: CvExtracted;
    };
    error?: string;
};

const ACCEPT =
    ".pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_MB = 5;

function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type CvUploadProps = {
    onCvUpdated?: (extracted: CvExtracted) => void
}

export default function CvUpload({ onCvUpdated }: CvUploadProps) {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const backendUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [extracted, setExtracted] = useState<CvExtracted | null>(null);
    const [extractApiResponse, setExtractApiResponse] =
        useState<CvExtractApiPayload | null>(null);
    const [uploadedName, setUploadedName] = useState<string | null>(null);

    useEffect(() => {
        const pending = readPendingCvExtract();
        if (!pending) return;

        setExtractApiResponse(pending);
        setExtracted(pending.data.extracted);
        setUploadedName(pending.data.fileName);
        setSaveSuccess(false);
        onCvUpdated?.(pending.data.extracted);
    }, [onCvUpdated]);

    useEffect(() => {
        if (authLoading || !user || !extractApiResponse || saving || saveSuccess) {
            return;
        }

        const apiPayload = extractApiResponse;
        const pending = readPendingCvExtract();
        if (!pending) return;

        let cancelled = false;

        async function resumePendingSave() {
            setSaving(true);
            setError(null);

            const { error: saveError } = await saveCvExtractToProfile(apiPayload);

            if (cancelled) return;

            setSaving(false);

            if (saveError) {
                setError(saveError);
                return;
            }

            setSaveSuccess(true);
            onCvUpdated?.(apiPayload.data.extracted);
        }

        void resumePendingSave();

        return () => {
            cancelled = true;
        };
    }, [authLoading, user, extractApiResponse, saving, saveSuccess]);

    const validateFile = (next: File): string | null => {
        if (next.size > MAX_MB * 1024 * 1024) {
            return `File must be ${MAX_MB} MB or smaller.`;
        }
        const ext = next.name.split(".").pop()?.toLowerCase() ?? "";
        const allowed = ["pdf", "txt", "doc", "docx"];
        if (!allowed.includes(ext)) {
            return "Please upload a PDF, TXT, DOC, or DOCX file.";
        }
        return null;
    };

    const pickFile = (next: File | null) => {
        setError(null);
        setExtracted(null);
        setExtractApiResponse(null);
        setUploadedName(null);
        setSaveSuccess(false);
        clearPendingCvExtract();
        if (!next) {
            setFile(null);
            return;
        }
        const validationError = validateFile(next);
        if (validationError) {
            setError(validationError);
            setFile(null);
            return;
        }
        setFile(next);
    };

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) pickFile(dropped);
    }, []);

    const handleExtract = async () => {
        if (!file) return;
        if (!backendUrl) {
            setError("Backend URL is not configured (VITE_BACKEND_URL).");
            return;
        }

        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append("cv", file);

        try {
            const response = await axios.post<ExtractResponse>(
                `${backendUrl}/cv/extract`,
                formData,
                {
                    headers: { "Content-Type": "multipart/form-data" },
                    timeout: 120_000,
                },
            );

            if (!response.data?.success || !response.data.data?.extracted) {
                setError(response.data?.error ?? "Extraction failed. Please try again.");
                return;
            }

            const payload: CvExtractApiPayload = {
                success: true,
                data: response.data.data,
            };

            setExtractApiResponse(payload);
            setExtracted(response.data.data.extracted);
            setUploadedName(response.data.data.fileName);
            setSaveSuccess(false);
            clearPendingCvExtract();
            onCvUpdated?.(response.data.data.extracted);
        } catch (err) {
            const message =
                axios.isAxiosError(err) &&
                typeof err.response?.data === "object" &&
                err.response.data != null &&
                "error" in err.response.data &&
                typeof (err.response.data as { error?: unknown }).error === "string"
                    ? (err.response.data as { error: string }).error
                    : err instanceof Error
                      ? err.message
                      : "Something went wrong while extracting your CV.";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const clearAll = () => {
        setFile(null);
        setExtracted(null);
        setExtractApiResponse(null);
        setUploadedName(null);
        setSaveSuccess(false);
        setError(null);
        clearPendingCvExtract();
        if (inputRef.current) inputRef.current.value = "";
    };

    const handleSave = async () => {
        if (!extractApiResponse) return;

        if (!user) {
            stashPendingCvExtract(extractApiResponse);
            navigate("/login", {
                state: { from: "/", pendingCvSave: true },
            });
            return;
        }

        setSaving(true);
        setError(null);

        const { error: saveError } = await saveCvExtractToProfile(
            extractApiResponse,
        );

        setSaving(false);

        if (saveError) {
            setError(saveError);
            return;
        }

        setSaveSuccess(true);
        if (extractApiResponse?.data?.extracted) {
            onCvUpdated?.(extractApiResponse.data.extracted);
        }
    };

    return (
        <section className="mb-8 rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-emerald-50/40 p-5 shadow-sm md:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="mb-1 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-emerald-600" aria-hidden />
                        <h2 className="text-lg font-semibold text-neutral-900">
                            Upload your CV
                        </h2>
                    </div>
                    <p className="max-w-xl text-sm text-neutral-600">
                        We&apos;ll read your resume with Gemini and extract skills, experience,
                        and contact details to personalize your job search.
                    </p>
                </div>
                {extracted ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        Profile ready
                    </span>
                ) : null}
            </div>

            {!extracted ? (
                <>
                    <div
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={onDrop}
                        onClick={() => inputRef.current?.click()}
                        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-10 transition-colors ${
                            dragOver
                                ? "border-emerald-500 bg-emerald-50/80"
                                : "border-neutral-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/30"
                        }`}
                    >
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                            <Upload className="h-7 w-7" aria-hidden />
                        </div>
                        <div className="text-center">
                            <p className="font-medium text-neutral-800">
                                Drag & drop your CV here, or click to browse
                            </p>
                            <p className="mt-1 text-sm text-neutral-500">
                                PDF, DOC, DOCX, or TXT — up to {MAX_MB} MB
                            </p>
                        </div>
                        <input
                            ref={inputRef}
                            type="file"
                            accept={ACCEPT}
                            className="hidden"
                            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                        />
                    </div>

                    {file ? (
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <FileText
                                    className="h-8 w-8 shrink-0 text-emerald-600"
                                    aria-hidden
                                />
                                <div className="min-w-0">
                                    <p className="truncate font-medium text-neutral-800">
                                        {file.name}
                                    </p>
                                    <p className="text-sm text-neutral-500">
                                        {formatFileSize(file.size)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={clearAll}
                                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                                    disabled={loading}
                                >
                                    Remove
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleExtract()}
                                    disabled={loading}
                                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2
                                                className="h-4 w-4 animate-spin"
                                                aria-hidden
                                            />
                                            Extracting…
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-4 w-4" aria-hidden />
                                            Extract with Gemini
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : null}
                </>
            ) : (
                <CvExtractedPreview
                    data={extracted}
                    fileName={uploadedName}
                    onClear={clearAll}
                    onSave={() => void handleSave()}
                    saving={saving}
                    saveSuccess={saveSuccess}
                    isLoggedIn={Boolean(user)}
                />
            )}

            {error ? (
                <div
                    role="alert"
                    className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{error}</span>
                </div>
            ) : null}
        </section>
    );
}

function CvExtractedPreview({
    data,
    fileName,
    onClear,
    onSave,
    saving,
    saveSuccess,
    isLoggedIn,
}: {
    data: CvExtracted;
    fileName: string | null;
    onClear: () => void;
    onSave: () => void;
    saving: boolean;
    saveSuccess: boolean;
    isLoggedIn: boolean;
}) {
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-3">
                <div>
                    <p className="text-sm text-neutral-500">Parsed from</p>
                    <p className="font-medium text-neutral-800">{fileName ?? "your CV"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {saveSuccess ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                            Saved to your profile
                        </span>
                    ) : (
                        <button
                            type="button"
                            onClick={onSave}
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                    Saving…
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" aria-hidden />
                                    {isLoggedIn ? "Save to profile" : "Sign in to save"}
                                </>
                            )}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClear}
                        className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                        <X className="h-4 w-4" aria-hidden />
                        Upload another
                    </button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                        Contact
                    </h3>
                    <dl className="space-y-2 text-sm">
                        {data.fullName ? (
                            <div>
                                <dt className="text-neutral-500">Name</dt>
                                <dd className="font-medium text-neutral-900">{data.fullName}</dd>
                            </div>
                        ) : null}
                        {data.email ? (
                            <div>
                                <dt className="text-neutral-500">Email</dt>
                                <dd>{data.email}</dd>
                            </div>
                        ) : null}
                        {data.phone ? (
                            <div>
                                <dt className="text-neutral-500">Phone</dt>
                                <dd>{data.phone}</dd>
                            </div>
                        ) : null}
                        {data.location ? (
                            <div>
                                <dt className="text-neutral-500">Location</dt>
                                <dd>{data.location}</dd>
                            </div>
                        ) : null}
                    </dl>
                </div>

                {data.skills?.length ? (
                    <div className="rounded-xl border border-neutral-200 bg-white p-4">
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                            Skills
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {data.skills.map((skill) => (
                                <span
                                    key={skill}
                                    className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200"
                                >
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>

            {data.summary ? (
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                        Summary
                    </h3>
                    <p className="text-sm leading-relaxed text-neutral-700">{data.summary}</p>
                </div>
            ) : null}

            {data.experience?.length ? (
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                        Experience
                    </h3>
                    <ul className="space-y-4">
                        {data.experience.map((job, i) => (
                            <li
                                key={`${job.title}-${i}`}
                                className="border-b border-neutral-100 pb-4 last:border-0 last:pb-0"
                            >
                                <p className="font-medium text-neutral-900">{job.title}</p>
                                {job.company ? (
                                    <p className="text-sm text-neutral-600">{job.company}</p>
                                ) : null}
                                {(job.startDate || job.endDate) && (
                                    <p className="text-xs text-neutral-500">
                                        {[job.startDate, job.endDate].filter(Boolean).join(" — ")}
                                    </p>
                                )}
                                {job.description ? (
                                    <p className="mt-1 text-sm text-neutral-600">
                                        {job.description}
                                    </p>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {data.education?.length ? (
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                        Education
                    </h3>
                    <ul className="space-y-2 text-sm">
                        {data.education.map((edu, i) => (
                            <li key={i}>
                                <span className="font-medium text-neutral-900">
                                    {[edu.degree, edu.institution].filter(Boolean).join(" · ")}
                                </span>
                                {edu.year ? (
                                    <span className="text-neutral-500"> ({edu.year})</span>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}
