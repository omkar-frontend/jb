import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type FormSkeletonProps = {
    className?: string
    /** Number of card sections to render. Defaults to 4. */
    sections?: number
    /** Fields in the first (grid) section. Defaults to 5. */
    fields?: number
    /** Show a taller block in the second section (e.g. summary). Defaults to true. */
    showTextarea?: boolean
}

function FieldSkeleton() {
    return (
        <div className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-full rounded-lg" />
        </div>
    )
}

function SectionShell({ children }: { children: ReactNode }) {
    return (
        <section className="rounded-2xl border border-[#e6e6e6]/75 bg-white p-3 md:p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="mt-2 h-3.5 w-44" />
            <div className="mt-4">{children}</div>
        </section>
    )
}

export function FormSkeleton({
    className,
    sections = 4,
    fields = 5,
    showTextarea = true,
}: FormSkeletonProps) {
    return (
        <div
            className={cn('space-y-6', className)}
            role="status"
            aria-busy="true"
            aria-label="Loading"
        >
            {Array.from({ length: sections }, (_, index) => {
                if (index === 0) {
                    return (
                        <SectionShell key={index}>
                            <div className="grid gap-4 sm:grid-cols-2">
                                {Array.from({ length: fields }, (_, fieldIndex) => (
                                    <FieldSkeleton key={fieldIndex} />
                                ))}
                            </div>
                        </SectionShell>
                    )
                }

                if (index === 1 && showTextarea) {
                    return (
                        <SectionShell key={index}>
                            <Skeleton className="h-24 w-full rounded-lg" />
                        </SectionShell>
                    )
                }

                return (
                    <SectionShell key={index}>
                        <div className="space-y-3">
                            <Skeleton className="h-9 w-full rounded-lg" />
                            <Skeleton className="h-9 w-3/4 rounded-lg" />
                        </div>
                    </SectionShell>
                )
            })}
            <span className="sr-only">Loading…</span>
        </div>
    )
}
