"use client";

import { useCountry } from "@/context/CountryContext";

const selectClass =
  "rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500";

const countryOptions = [
  { code: "gb", name: "United Kingdom" },
  { code: "us", name: "United States" },
  { code: "at", name: "Austria" },
  { code: "au", name: "Australia" },
  { code: "be", name: "Belgium" },
  { code: "br", name: "Brazil" },
  { code: "ca", name: "Canada" },
  { code: "ch", name: "Switzerland" },
  { code: "de", name: "Germany" },
  { code: "es", name: "Spain" },
  { code: "fr", name: "France" },
  { code: "in", name: "India" },
  { code: "it", name: "Italy" },
  { code: "mx", name: "Mexico" },
  { code: "nl", name: "Netherlands" },
  { code: "nz", name: "New Zealand" },
  { code: "pl", name: "Poland" },
  { code: "sg", name: "Singapore" },
  { code: "za", name: "South Africa" },
];

export default function Navbar() {
  const { countryIsoCode, setCountryIsoCode } = useCountry();

  return (
    <div className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-gray-900 bg-black p-4">
      <h1 className="text-lg font-semibold text-zinc-100">Navbar</h1>
      <label className="flex flex-col gap-1 text-xs text-zinc-400">
        Country
        <select
          className={selectClass}
          value={countryIsoCode}
          onChange={(e) => setCountryIsoCode(e.target.value)}
        >
          <option value="">Select country</option>
          {countryOptions.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
