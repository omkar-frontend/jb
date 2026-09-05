import { Link } from 'react-router-dom'

type NotFoundProps = {
    title?: string
    description?: string
}

export default function NotFound({
    title = 'Page not found',
    description = 'The page you are looking for does not exist or has moved.',
}: NotFoundProps) {
    return (
        <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-12">
            <div className="w-full max-w-md text-center">
                <p className="text-sm font-semibold text-emerald-600">404</p>
                <h1 className="mt-2 text-2xl font-semibold text-neutral-900">{title}</h1>
                <p className="mt-2 text-sm text-neutral-600">{description}</p>
                <Link to="/" className="cmn-button mt-6">
                    Back to job portals
                </Link>
            </div>
        </div>
    )
}
