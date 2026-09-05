import { useState } from "react";
import { Link } from "react-router-dom";
import CvUpload from "../components/CvUpload";
import RelevantJobs from "../components/RelevantJobs";
import adzuna from '/logos/adzuna.png';
import google from '/logos/google.png';
import himalayas from '/logos/himalayas.ico';
import jsearch from '/logos/jsearch.svg';
import remotive from '/logos/remotive.svg';

const portals: {
  key: string;
  name: string;
  logo?: string;
  description: string;
  comingSoon?: boolean;
}[] = [
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
    {
      key: 'jsearch',
      name: 'JSearch',
      logo: jsearch,
      description:
        'Real-time job listings and filters via OpenWeb Ninja JSearch.',
    },
    {
      key: 'loopcv',
      name: 'LoopCV',
      comingSoon: true,
      description:
        'Find remote jobs from LoopCV with real-time job listings and filters.',
    },
  ]

export default function Home() {
    // CvUpload and RelevantJobs are siblings; this is how the upload tells the
    // job list that the saved CV changed.
    const [cvVersion, setCvVersion] = useState(0);

    return (
        <div className="min-h-[calc(100dvh)] bg-white p-5 text-neutral-900 md:px-40 md:py-10">
            <div className="flex flex-col gap-4">
                <CvUpload onCvUpdated={() => setCvVersion((v) => v + 1)} />
                {/* Relevant jobs */}
                <RelevantJobs refreshKey={cvVersion} />
                {/* Job portals */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {
                        portals.map((portal) => {
                            const cardClassName = `relative flex h-40 flex-col items-center justify-between gap-3 rounded-2xl border border-[#e6e6e6]/75 bg-white p-4 transition-all duration-500 ${
                                portal.comingSoon
                                    ? 'cursor-not-allowed opacity-95'
                                    : 'cursor-default hover:border-emerald-300 hover:ring-2 hover:ring-emerald-100 focus:outline-none focus-visible:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/40'
                            }`;

                            const content = (
                                <>
                                    {portal.comingSoon ? (
                                        <span className="absolute right-1 top-1 rounded-full bg-neutral-400 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white">
                                            Coming soon
                                        </span>
                                    ) : null}
                                    {/* Logo — decorative, the name is spelled out below */}
                                    {portal.logo ? (
                                        <img
                                            src={portal.logo}
                                            alt=""
                                            className="h-12 w-12 object-contain"
                                        />
                                    ) : (
                                        <div
                                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-neutral-200 text-xl font-semibold text-neutral-700"
                                            aria-hidden
                                        >
                                            {portal.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    {/* Name and description */}
                                    <div className="flex flex-col items-center">
                                        <p className="text-base font-semibold text-neutral-800">{portal.name}</p>
                                        <p className="text-center text-sm text-neutral-600">{portal.description}</p>
                                    </div>
                                </>
                            );

                            // Not a link: nothing to navigate to yet, so it must not
                            // be focusable or announced as actionable.
                            if (portal.comingSoon) {
                                return (
                                    <div key={portal.key} className={cardClassName} aria-disabled="true">
                                        {content}
                                    </div>
                                );
                            }

                            return (
                                <Link
                                    key={portal.key}
                                    to={`/portal/${portal.key}`}
                                    className={cardClassName}
                                >
                                    {content}
                                </Link>
                            );
                        })
                    }
                </div>
            </div>
        </div>
    )
}
