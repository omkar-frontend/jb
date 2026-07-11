import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type BackProps = {
    className?: string
    label?: string
}

export function Back({ className, label = 'Go back' }: BackProps) {
    const navigate = useNavigate()

    return (
        <button
            type="button"
            aria-label={label}
            className={
                className ??
                'group overflow-hidden rounded-full border border-neutral-200 p-2 text-neutral-600 transition-colors duration-200 bg-neutral-100/50 hover:text-neutral-700'
            }
            onClick={() => navigate(-1)}
        >
            <span className="relative block h-4 w-4 overflow-hidden">
                <ChevronLeft
                    className="absolute inset-0 h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-[-150%]"
                    aria-hidden
                />
                <ChevronLeft
                    className="absolute inset-0 h-4 w-4 translate-x-[150%] transition-transform duration-300 ease-out group-hover:translate-x-0"
                    aria-hidden
                />
            </span>
        </button>
    )
}
