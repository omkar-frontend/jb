'use client';
import axios from "axios";
import Image from "next/image";
import { useEffect } from "react";


const portals = [
  {
    key: 'adzuna',
    name: 'Adzuna',
    logo: '/adzuna.png',
    description: 'Adzuna is a job portal that allows you to search for jobs and apply to them.',
  }
]

export default function Home() {
  const fetchJobs = async (portalKey: string) => {
    const response = await axios.get(`/api/adzuna`);
    console.log(response.data);
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="flex flex-col gap-4 items-center justify-center">
        <h1 className="text-4xl font-bold">Job Boards</h1>
        <div className="flex flex-wrap gap-4">
          {portals.map((portal) => (
            <div key={portal.key} className="flex flex-col items-center justify-center">
              <h2 className="text-2xl font-bold">{portal.name}</h2>
              <p className="text-sm text-gray-500">{portal.description}</p>
              <button className="bg-blue-500 text-white px-4 py-2 rounded-md" onClick={() => fetchJobs(portal.key)}>
                Fetch Jobs
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
