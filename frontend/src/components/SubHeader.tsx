import { Back } from './Back'

type SubHeaderProps = {
    title: string
}

export default function SubHeader({ title }: SubHeaderProps) {
    return (
        <div className="flex items-center gap-4">
            <Back />
            <p className="text-xl font-semibold text-neutral-900">{title}</p>
        </div>
    )
}
