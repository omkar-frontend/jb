import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
    AlertCircle,
    CheckCircle2,
    FileText,
    Loader,
} from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { api, isApiConfigured } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
    saveCvExtractToProfile,
    type CvExtractApiPayload,
    type CvExtracted,
} from "../lib/cvProfile";
import AuthDialog from "./AuthDialog";

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
    const { user, loading: authLoading } = useAuth();
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [extracted, setExtracted] = useState<CvExtracted | null>(null);
    const [extractApiResponse, setExtractApiResponse] =
        useState<CvExtractApiPayload | null>(null);
    const [uploadedName, setUploadedName] = useState<string | null>(null);
    const [profileSaved, setProfileSaved] = useState(false);
    const [authDialogOpen, setAuthDialogOpen] = useState(false);
    // Set when the user asked to save while signed out: the parsed CV stays in
    // this component's state while they authenticate in the dialog.
    const [saveAfterAuth, setSaveAfterAuth] = useState(false);
    const onCvUpdatedRef = useRef(onCvUpdated);
    // Synced in an effect, not during render: mutating a ref while rendering is
    // unsafe once React can render speculatively.
    useEffect(() => {
        onCvUpdatedRef.current = onCvUpdated;
    }, [onCvUpdated]);
    const autoSaveAttemptedRef = useRef(false);

    const dismissPreviewAfterSave = (savedExtracted: CvExtracted) => {
        onCvUpdatedRef.current?.(savedExtracted);
        setFile(null);
        setExtracted(null);
        setExtractApiResponse(null);
        setUploadedName(null);
        setSaving(false);
        setProfileSaved(true);
        autoSaveAttemptedRef.current = false;
        if (inputRef.current) inputRef.current.value = "";
    };

    // Finishes the save the user asked for before signing in.
    useEffect(() => {
        if (authLoading || !user || !extractApiResponse || !saveAfterAuth) {
            return;
        }

        if (autoSaveAttemptedRef.current) return;
        autoSaveAttemptedRef.current = true;

        const apiPayload = extractApiResponse;

        void (async () => {
            setSaving(true);
            setError(null);

            const { error: saveError } = await saveCvExtractToProfile(apiPayload);

            setSaving(false);
            setSaveAfterAuth(false);

            if (saveError) {
                autoSaveAttemptedRef.current = false;
                setError(saveError);
                return;
            }

            dismissPreviewAfterSave(apiPayload.data.extracted);
        })();
    }, [authLoading, user, extractApiResponse, saveAfterAuth]);

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
        setProfileSaved(false);
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
        if (!isApiConfigured()) {
            setError("Backend URL is not configured (VITE_BACKEND_URL).");
            return;
        }

        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append("cv", file);

        try {
            const response = await api.post<ExtractResponse>(
                "/cv/extract",
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
        setProfileSaved(false);
        setError(null);
        autoSaveAttemptedRef.current = false;
        setSaveAfterAuth(false);
        if (inputRef.current) inputRef.current.value = "";
    };

    const handleSave = async () => {
        if (!extractApiResponse) return;

        if (!user) {
            // Stay on the page: the payload lives in state, not storage.
            setSaveAfterAuth(true);
            setAuthDialogOpen(true);
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

        if (extractApiResponse?.data?.extracted) {
            dismissPreviewAfterSave(extractApiResponse.data.extracted);
        }
    };

    return (
        <section className="rounded-2xl border border-[#e6e6e6]/75 bg-linear-to-br from-white to-emerald-50/40 shadow-[0_1px_8px_rgba(0,0,0,0.05)] p-4">
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-1">
                    <div>
                        <div className="mb-1 flex items-center gap-2">
                            <h2 className="text-sm font-semibold text-neutral-900">
                                Upload your CV
                            </h2>
                            {profileSaved ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
                                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                                    Saved to profile
                                </span>
                            ) : null}
                        </div>
                        <p className="text-xs text-neutral-600">
                            {profileSaved
                                ? "Your CV is saved. Browse relevant jobs below or upload a new one anytime."
                                : "We'll read your resume with Gemini and extract skills, experience, and contact details to personalize your job search."}
                        </p>
                    </div>
                    {!extracted && !file ? (
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
                            className={` ${
                                dragOver
                                    ? "border-emerald-500 bg-emerald-50/80"
                                    : "border-neutral-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/30"
                            }`}
                        >
                            <div className="text-center cursor-default">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger
                                            render={
                                                <button type="button" className="cmn-button">
                                                    Upload CV
                                                </button>
                                            }
                                        />
                                        <TooltipContent side="bottom" className="max-w-56 text-left">
                                            <p className="mt-1 text-background/80">
                                                PDF, TXT, DOC, or DOCX · max {MAX_MB} MB
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <input
                                ref={inputRef}
                                type="file"
                                accept={ACCEPT}
                                className="hidden"
                                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                            />
                        </div>
                    ) : null}
                </div>

                {!extracted ? (
                    <>
                        {file ? (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <FileText
                                        className="h-5 w-5 shrink-0 text-emerald-600"
                                        aria-hidden
                                    />
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-neutral-800 text-xs">
                                            {file.name}
                                        </p>
                                        <p className="text-xs text-neutral-500">
                                            {formatFileSize(file.size)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 justify-end">
                                    <button
                                        type="button"
                                        onClick={clearAll}
                                        className="cmn-button-secondary"
                                        disabled={loading}
                                    >
                                        Remove
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleExtract()}
                                        disabled={loading}
                                        className="cmn-button"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader
                                                    className="h-4 w-4 animate-spin"
                                                    aria-hidden
                                                />
                                                Extracting…
                                            </>
                                        ) : (
                                            <>
                                                Extract
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
                        isLoggedIn={Boolean(user)}
                    />
                )}
            </div>

            {error ? (
                <div
                    role="alert"
                    className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800"
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {/* The actual reason, not a fixed line: this banner also
                        reports the size and file-type checks that run on
                        selection, long before there is an extraction to fail. */}
                    <span>{error}</span>
                </div>
            ) : null}

            <AuthDialog
                open={authDialogOpen}
                onOpenChange={(open) => {
                    setAuthDialogOpen(open);
                    // Cancelled the dialog — drop the pending intent, keep the preview.
                    if (!open) setSaveAfterAuth(false);
                }}
                description="Sign in to save your parsed CV to your profile."
            />
        </section>
    );
}

function CvExtractedPreview({
    data,
    fileName,
    onClear,
    onSave,
    saving,
    isLoggedIn,
}: {
    data: CvExtracted;
    fileName: string | null;
    onClear: () => void;
    onSave: () => void;
    saving: boolean;
    isLoggedIn: boolean;
}) {
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-3 sticky top-20">
                <div>
                    <p className="text-xs text-neutral-500">Parsed from</p>
                    <p className="text-xs font-medium text-neutral-800">{fileName ?? "your CV"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={saving}
                        className="cmn-button"
                    >
                        {saving ? (
                            <>
                                <Loader className="h-4 w-4 animate-spin" aria-hidden />
                                Saving…
                            </>
                        ) : (
                            <>{isLoggedIn ? "Save to profile" : "Sign in to save"}</>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={onClear}
                        className="cmn-button-secondary"
                    >
                        Upload another
                    </button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-medium text-neutral-500">
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
                        <h3 className="mb-3 text-sm font-medium text-neutral-500">
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
                    <h3 className="mb-2 text-sm font-medium text-neutral-500">
                        Summary
                    </h3>
                    <p className="text-sm leading-relaxed text-neutral-700">{data.summary}</p>
                </div>
            ) : null}

            {data.experience?.length ? (
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-medium text-neutral-500">
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

            {data.projects?.length ? (
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-medium text-neutral-500">
                        Projects
                    </h3>
                    <ul className="space-y-4">
                        {data.projects.map((project, i) => (
                            <li
                                key={`${project.name}-${i}`}
                                className="border-b border-neutral-100 pb-4 last:border-0 last:pb-0"
                            >
                                <p className="font-medium text-neutral-900">{project.name}</p>
                                {project.startDate || project.endDate ? (
                                    <p className="text-xs text-neutral-500">
                                        {[project.startDate, project.endDate]
                                            .filter(Boolean)
                                            .join(" — ")}
                                    </p>
                                ) : null}
                                {project.link ? (
                                    <p className="truncate text-xs text-emerald-700">
                                        {project.link}
                                    </p>
                                ) : null}
                                {project.description ? (
                                    <p className="mt-1 text-sm text-neutral-600">
                                        {project.description}
                                    </p>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {data.education?.length ? (
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-medium text-neutral-500">
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

            {data.certifications?.length ? (
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-medium text-neutral-500">
                        Certifications
                    </h3>
                    <ul className="space-y-2 text-sm">
                        {data.certifications.map((cert, i) => (
                            <li key={`${cert.name}-${i}`}>
                                <span className="font-medium text-neutral-900">
                                    {[cert.name, cert.issuer].filter(Boolean).join(" · ")}
                                </span>
                                {cert.year ? (
                                    <span className="text-neutral-500"> ({cert.year})</span>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}
