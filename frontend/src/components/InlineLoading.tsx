import { Loader } from 'lucide-react'
import { cn } from '@/lib/utils'

type InlineLoadingProps = {
    label?: string
    className?: string
}

/**
 * Status-line loading indicator, used wherever a list is refreshing in place.
 * Shared so the portals do not each render their own static "Loading…" text.
 */
export default function InlineLoading({
    label = 'Loading…',
    className,
}: InlineLoadingProps) {
    return (
        <p
            role="status"
            className={cn(
                'flex items-center gap-2 text-sm text-neutral-500',
                className,
            )}
        >
            <Loader className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {label}
        </p>
    )
}
