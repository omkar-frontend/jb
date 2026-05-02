"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CountryContextValue = {
  /** ISO 3166-1 alpha-2 country code, e.g. `"GB"`, or `""` if none selected */
  countryIsoCode: string;
  setCountryIsoCode: (isoCode: string) => void;
};

const CountryContext = createContext<CountryContextValue | null>(null);

export function CountryProvider({ children }: { children: ReactNode }) {
  const [countryIsoCode, setCountryIsoCode] = useState("");

  const value = useMemo(
    () => ({ countryIsoCode, setCountryIsoCode }),
    [countryIsoCode]
  );

  return (
    <CountryContext.Provider value={value}>{children}</CountryContext.Provider>
  );
}

export function useCountry(): CountryContextValue {
  const ctx = useContext(CountryContext);
  if (!ctx) {
    throw new Error("useCountry must be used within a CountryProvider");
  }
  return ctx;
}
