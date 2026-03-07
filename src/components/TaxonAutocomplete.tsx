import {useEffect, useRef, useState} from "react";

import {searchTaxa} from "../api/inaturalist";
import type {TaxonSuggestion} from "../types";

interface Props {
    onSubmit: (suggestion: TaxonSuggestion | null, rawText: string) => void;
    disabled: boolean;
    onShowAnswer?: () => void;
    wrongCount?: number;
    partialCount?: number;
    partialTaxonId?: number;
}

export function TaxonAutocomplete({
    onSubmit,
    disabled,
    onShowAnswer,
    wrongCount = 0,
    partialCount = 0,
    partialTaxonId,
}: Props) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<TaxonSuggestion[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selected, setSelected] = useState<TaxonSuggestion | null>(null);
    const [flashing, setFlashing] = useState(false);
    const [flashingBlue, setFlashingBlue] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!query.trim() || selected) {
            return;
        }

        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            try {
                const taxa = await searchTaxa(query, partialTaxonId);
                setResults(taxa);
                setShowDropdown(taxa.length > 0);
            } catch {
                setResults([]);
                setShowDropdown(false);
            }
        }, 250);

        return () => clearTimeout(debounceRef.current);
    }, [query, selected, partialTaxonId]);

    useEffect(() => {
        if (wrongCount === 0) {
            return;
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFlashing(true);
        const t = setTimeout(() => setFlashing(false), 500);
        return () => clearTimeout(t);
    }, [wrongCount]);

    useEffect(() => {
        if (!partialCount) {
            return;
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFlashingBlue(true);
        const t = setTimeout(() => setFlashingBlue(false), 500);
        return () => clearTimeout(t);
    }, [partialCount]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (taxon: TaxonSuggestion) => {
        setSelected(taxon);
        setQuery(taxon.preferred_common_name ? `${taxon.preferred_common_name} (${taxon.name})` : taxon.name);
        setShowDropdown(false);
    };

    const handleSubmit = () => {
        if (!query.trim()) {
            return;
        }
        onSubmit(selected, query.trim());
        setQuery("");
        setSelected(null);
        setResults([]);
        setShowDropdown(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div ref={containerRef} className="relative w-full">
            <input
                type="text"
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setSelected(null);
                    if (!e.target.value.trim()) {
                        setResults([]);
                        setShowDropdown(false);
                    }
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                    if (results.length > 0 && !selected) {
                        setShowDropdown(true);
                    }
                }}
                placeholder="Guess the species..."
                disabled={disabled}
                className={`w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 text-base disabled:opacity-50 mb-2 ${flashing ? "flash-red" : flashingBlue ? "flash-blue" : ""}`}
            />
            {/* Dropdown below input */}
            {showDropdown && (
                <div className="absolute bottom-full left-0 right-0 mb-1 lg:bottom-auto lg:top-full lg:mb-0 lg:mt-1 z-10 bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    {results.map((taxon) => (
                        <button
                            key={taxon.id}
                            onClick={() => handleSelect(taxon)}
                            className="w-full text-left px-4 py-2.5 hover:bg-neutral-700 transition-colors border-b border-neutral-700/50 last:border-0 cursor-pointer"
                        >
                            <span className="text-white text-base">{taxon.preferred_common_name ?? taxon.name}</span>
                            {taxon.preferred_common_name && (
                                <span className="text-neutral-400 text-sm ml-2 italic">{taxon.name}</span>
                            )}
                            <span className="text-neutral-500 text-sm ml-2">{taxon.rank}</span>
                        </button>
                    ))}
                </div>
            )}
            <div className="flex gap-2">
                {onShowAnswer && (
                    <button
                        onClick={onShowAnswer}
                        className="flex-1 py-3 text-white bg-yellow-700 hover:bg-yellow-600 rounded-lg text-base transition-colors cursor-pointer"
                    >
                        Skip
                    </button>
                )}
                <button
                    onClick={handleSubmit}
                    disabled={disabled || !query.trim()}
                    className="flex-1 py-3 bg-green-700 hover:bg-green-600 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-lg text-base font-medium transition-colors cursor-pointer disabled:cursor-default"
                >
                    Guess
                </button>
            </div>
        </div>
    );
}
