import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

type AuthLayoutProps = {
    title: string
    subtitle: string
    children: ReactNode
    footer: ReactNode
}

export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
    return (
        <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-12">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <Link to="/" className="inline-block text-xl font-semibold text-neutral-900">
                        Jobs <span className="text-emerald-600">Board</span>
                    </Link>
                    <h1 className="mt-6 text-2xl font-semibold text-neutral-900">{title}</h1>
                    <p className="mt-2 text-sm text-neutral-600">{subtitle}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm md:p-8">
                    {children}
                </div>
                <p className="mt-6 text-center text-sm text-neutral-600">{footer}</p>
            </div>
        </div>
    )
}
