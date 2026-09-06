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

export type CvProject = {
    name: string
    description: string | null
    startDate: string | null
    endDate: string | null
    link: string | null
}

export type CvCertification = {
    name: string
    issuer: string | null
    year: string | null
}

export type CvExtracted = {
    fullName: string | null
    email: string | null
    phone: string | null
    location: string | null
    designation: string | null
    summary: string | null
    skills: string[]
    experience: CvExperience[]
    projects: CvProject[]
    education: CvEducation[]
    certifications: CvCertification[]
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

/** Raw API shape may include legacy `role` alongside `designation`. */
type RawCvExtracted = Partial<CvExtracted> & { role?: string | null }

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

export function parseExtractedInformation(
    input: CvExtractApiPayload | string | unknown
): CvExtractApiPayload | null {
    if (input == null) return null

    let parsed: unknown = input
    if (typeof input === 'string') {
        try {
            parsed = JSON.parse(input)
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

    const extracted = payload.data.extracted as RawCvExtracted

    return {
        success: true,
        data: {
            fileName: payload.data.fileName ?? '',
            mimeType: payload.data.mimeType ?? '',
            extracted: {
                fullName: extracted.fullName ?? null,
                email: extracted.email ?? null,
                phone: extracted.phone ?? null,
                location: extracted.location ?? null,
                designation: extracted.designation ?? extracted.role ?? null,
                summary: extracted.summary ?? null,
                skills: extracted.skills ?? [],
                experience: extracted.experience ?? [],
                // Dropping these on parse silently deleted them on the next
                // save from the details form, which round-trips whatever it
                // parsed back to the server.
                projects: extracted.projects ?? [],
                education: extracted.education ?? [],
                certifications: extracted.certifications ?? [],
                languages: extracted.languages ?? [],
                links: {
                    linkedin: extracted.links?.linkedin ?? null,
                    github: extracted.links?.github ?? null,
                    portfolio: extracted.links?.portfolio ?? null,
                    other: extracted.links?.other ?? [],
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

        return { error: null }
    } catch (err) {
        return { error: profileErrorMessage(err) }
    }
}
