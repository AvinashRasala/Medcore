import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { COUNTRY_CODES, DEFAULT_COUNTRY } from "../utils/countryCodes";

/**
 * A phone number field with a country-code dropdown (flag + dial code).
 * Value/onChange work with a single combined string, e.g. "+91 9000000000",
 * so this drops in anywhere a plain text phone field was used before —
 * no schema or API changes needed.
 *
 * Parses an incoming value like "+91 9000000000" back into country + number
 * on mount, so editing an existing phone number pre-selects the right flag.
 */
export default function PhoneInput({ value, onChange, placeholder = "9000000000" }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const { country, number } = parseValue(value);

  function parseValue(val) {
    if (!val) return { country: DEFAULT_COUNTRY, number: "" };
    const match = COUNTRY_CODES.find((c) => val.startsWith(c.dial));
    if (match) {
      return { country: match, number: val.slice(match.dial.length).trim() };
    }
    return { country: DEFAULT_COUNTRY, number: val };
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectCountry(c) {
    setOpen(false);
    onChange(`${c.dial} ${number}`.trim());
  }

  function handleNumberChange(e) {
    const digitsOnly = e.target.value.replace(/[^\d\s-]/g, "");
    onChange(`${country.dial} ${digitsOnly}`.trim());
  }

  return (
    <div ref={containerRef} className="relative flex gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm hover:bg-ink-50 transition-colors shrink-0"
      >
        <span>{country.flag}</span>
        <span className="text-ink-700">{country.dial}</span>
        <ChevronDown size={14} className="text-ink-400" />
      </button>

      <input
        type="tel"
        value={number}
        onChange={handleNumberChange}
        className="input-field flex-1"
        placeholder={placeholder}
      />

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-64 max-h-72 overflow-y-auto bg-white rounded-lg shadow-cardHover border border-ink-100 z-20 py-1">
          {COUNTRY_CODES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => selectCountry(c)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-ink-50 transition-colors text-left"
            >
              <span>{c.flag}</span>
              <span className="text-ink-800 flex-1 truncate">{c.name}</span>
              <span className="text-ink-500">{c.dial}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
