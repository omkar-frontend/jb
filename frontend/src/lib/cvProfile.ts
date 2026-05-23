import axios from 'axios'
import { api, isApiConfigured } from './api'

export type CvExperience = {
    title: string
    company: string | null
    startDate: string | null
    endDate: string | null
    description: string | null
}

export type CvEducation = {
    degree: string | null
    institution: string | null
    year: string | null
}

export type CvExtracted = {
    fullName: string | null
    email: string | null
    phone: string | null
    location: string | null
    summary: string | null
    skills: string[]
    experience: CvExperience[]
    education: CvEducation[]
    languages: string[]
    links: {
        linkedin: string | null
        github: string | null
        portfolio: string | null
        other: string[]
    }
}

export type CvExtractApiPayload = {
    success: boolean
    data: {
        fileName: string
        mimeType: string
        extracted: CvExtracted
    }
}

export type CvProfileRow = {
    id: string
    extractedInformation: CvExtractApiPayload | null
    createdAt: string | null
    updatedAt: string | null
    createdBy: string | null
    updatedBy: string | null
}

type ProfileApiResponse = {
    success: boolean
    data?: CvProfileRow | null
    error?: string
}

export const PENDING_CV_EXTRACT_KEY = 'jb_pending_cv_extract'

export function stashPendingCvExtract(payload: CvExtractApiPayload) {
    sessionStorage.setItem(PENDING_CV_EXTRACT_KEY, JSON.stringify(payload))
}

export function readPendingCvExtract(): CvExtractApiPayload | null {
    const raw = sessionStorage.getItem(PENDING_CV_EXTRACT_KEY)
    if (!raw) return null
    try {
        const parsed = JSON.parse(raw) as CvExtractApiPayload
        if (parsed?.success && parsed?.data?.extracted) return parsed
    } catch {
        /* ignore */
    }
    return null
}

export function clearPendingCvExtract() {
    sessionStorage.removeItem(PENDING_CV_EXTRACT_KEY)
}

export function parseExtractedInformation(
    raw: CvExtractApiPayload | string | unknown
): CvExtractApiPayload | null {
    if (raw == null) return null

    let parsed: unknown = raw
    if (typeof raw === 'string') {
        try {
            parsed = JSON.parse(raw)
        } catch {
            return null
        }
    }

    if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('success' in parsed) ||
        !('data' in parsed)
    ) {
        return null
    }

    const payload = parsed as CvExtractApiPayload
    if (!payload.data?.extracted) return null

    return {
        success: true,
        data: {
            fileName: payload.data.fileName ?? '',
            mimeType: payload.data.mimeType ?? '',
            extracted: {
                fullName: payload.data.extracted.fullName ?? null,
                email: payload.data.extracted.email ?? null,
                phone: payload.data.extracted.phone ?? null,
                location: payload.data.extracted.location ?? null,
                summary: payload.data.extracted.summary ?? null,
                skills: payload.data.extracted.skills ?? [],
                experience: payload.data.extracted.experience ?? [],
                education: payload.data.extracted.education ?? [],
                languages: payload.data.extracted.languages ?? [],
                links: {
                    linkedin: payload.data.extracted.links?.linkedin ?? null,
                    github: payload.data.extracted.links?.github ?? null,
                    portfolio: payload.data.extracted.links?.portfolio ?? null,
                    other: payload.data.extracted.links?.other ?? [],
                },
            },
        },
    }
}

function profileErrorMessage(err: unknown): string {
    if (
        axios.isAxiosError(err) &&
        typeof err.response?.data === 'object' &&
        err.response.data != null &&
        'error' in err.response.data &&
        typeof (err.response.data as { error?: unknown }).error === 'string'
    ) {
        return (err.response.data as { error: string }).error
    }
    return err instanceof Error ? err.message : 'Could not save CV profile'
}

export async function getCvProfile(): Promise<{
    data: CvProfileRow | null
    error: string | null
}> {
    if (!isApiConfigured()) {
        return { data: null, error: 'Backend URL is not configured (VITE_BACKEND_URL).' }
    }

    try {
        const response = await api.get<ProfileApiResponse>('/cv/profile')
        if (!response.data.success) {
            return {
                data: null,
                error: response.data.error ?? 'Could not load CV profile',
            }
        }
        return { data: response.data.data ?? null, error: null }
    } catch (err) {
        return { data: null, error: profileErrorMessage(err) }
    }
}

export async function saveCvExtractToProfile(
    apiResponse: CvExtractApiPayload
): Promise<{ error: string | null }> {
    if (!isApiConfigured()) {
        return { error: 'Backend URL is not configured (VITE_BACKEND_URL).' }
    }

    try {
        const response = await api.post<ProfileApiResponse>('/cv/profile', {
            extractedInformation: JSON.stringify(apiResponse),
        })

        if (!response.data.success) {
            return { error: response.data.error ?? 'Could not save CV profile' }
        }

        clearPendingCvExtract()
        return { error: null }
    } catch (err) {
        return { error: profileErrorMessage(err) }
    }
}

export async function updateCvProfile(
    apiResponse: CvExtractApiPayload
): Promise<{ error: string | null }> {
    if (!isApiConfigured()) {
        return { error: 'Backend URL is not configured (VITE_BACKEND_URL).' }
    }

    try {
        const response = await api.put<ProfileApiResponse>('/cv/profile', {
            extractedInformation: JSON.stringify(apiResponse),
        })

        if (!response.data.success) {
            return { error: response.data.error ?? 'Could not update CV profile' }
        }

        clearPendingCvExtract()
        return { error: null }
    } catch (err) {
        return { error: profileErrorMessage(err) }
    }
}
