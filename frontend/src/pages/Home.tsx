import { useNavigate } from "react-router-dom";

const portals = [
    {
      key: 'adzuna',
      name: 'Adzuna',
      logo: '/adzuna.png',
      description: 'Adzuna is a job portal that allows you to search for jobs and apply to them.',
    }
  ]

export default function Home() {
    const navigate = useNavigate();
    return (
        <div className="bg-black min-h-[calc(100dvh)] md:px-40 md:py-10 p-5 text-white">
            <div className="grid lg:grid-cols-4 sm:grid-cols-3 grid-cols-1 gap-4">
                {
                    portals.map((portal) => (
                        <div key={portal.key} className="border border-neutral-800 p-4 rounded-lg flex flex-col items-center justify-center gap-3 hover:border-neutral-300 transition-all duration-300 cursor-pointer" onClick={() => navigate(`/portal/${portal.key}`)}>
                            <p className="text-2xl font-bold">{portal.name}</p>
                            <p className="text-sm text-neutral-300 text-center">{portal.description}</p>
                        </div>
                    ))
                }
            </div>
        </div>
    )
}