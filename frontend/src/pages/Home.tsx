import { useNavigate } from "react-router-dom";
import adzuna from '/logos/adzuna.png';
import google from '/logos/google.png';
import himalayas from '/logos/himalayas.ico';
import remotive from '/logos/remotive.svg';

const portals = [
    {
      key: 'adzuna',
      name: 'Adzuna',
      logo: adzuna,
      description:
        'Search millions of jobs with salary insights and market trends.',
    },
    {
      key: 'serp',
      name: 'Google',
      logo: google,
      description:
        'Find jobs from Google search across multiple hiring platforms.',
    },
    {
      key: 'remotive',
      name: 'Remotive',
      logo: remotive,
      description:
        'Browse active remote listings from the Remotive public API.',
    },
    {
      key: 'himalayas',
      name: 'Himalayas',
      logo: himalayas,
      description:
        'Explore verified remote roles from the free Himalayas jobs API.',
    },
  ]

export default function Home() {
    const navigate = useNavigate();
    return (
        <div className="min-h-[calc(100dvh)] bg-white p-5 text-neutral-900 md:px-40 md:py-10">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {
                    portals.map((portal) => (
                        <div key={portal.key} className="flex cursor-pointer flex-col items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-all duration-500 hover:border-neutral-300 hover:ring-2 hover:ring-emerald-400 h-40" onClick={() => navigate(`/portal/${portal.key}`)}>
                            <div className="flex flex-col gap-1 items-center">
                                <img src={portal.logo} alt={portal.name} className="h-12 w-12" />
                                <p className="text-xl font-semibold text-neutral-800">{portal.name}</p>
                            </div>
                            <p className="text-center text-sm text-neutral-600">{portal.description}</p>
                        </div>
                    ))
                }
            </div>
        </div>
    )
}
