import {useEffect, useRef, useState} from "react";

import {searchUsers} from "../api/inaturalist";
import type {INaturalistUser} from "../types";

interface Props {
    selectedUsers: INaturalistUser[];
    onChange: (users: INaturalistUser[]) => void;
}

export function UserAutocomplete({selectedUsers, onChange}: Props) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<INaturalistUser[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!query.trim()) {
            return;
        }

        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            try {
                const users = await searchUsers(query);
                const selectedIds = new Set(selectedUsers.map((u) => u.id));
                const filtered = users.filter((u) => !selectedIds.has(u.id));
                setResults(filtered);
                setShowDropdown(filtered.length > 0);
            } catch {
                setResults([]);
                setShowDropdown(false);
            }
        }, 300);

        return () => clearTimeout(debounceRef.current);
    }, [query, selectedUsers]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (user: INaturalistUser) => {
        onChange([...selectedUsers, user]);
        setQuery("");
        setResults([]);
        setShowDropdown(false);
    };

    const handleRemove = (userId: number) => {
        onChange(selectedUsers.filter((u) => u.id !== userId));
    };

    return (
        <div ref={containerRef} className="relative">
            {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {selectedUsers.map((user) => (
                        <span
                            key={user.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-700 text-white text-sm rounded-full"
                        >
                            {user.icon_url && <img src={user.icon_url} alt="" className="w-4 h-4 rounded-full" />}@
                            {user.login}
                            <button
                                onClick={() => handleRemove(user.id)}
                                className="text-neutral-400 hover:text-white transition-colors cursor-pointer ml-0.5"
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <input
                type="text"
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    if (!e.target.value.trim()) {
                        setResults([]);
                        setShowDropdown(false);
                    }
                }}
                onFocus={() => {
                    if (results.length > 0) {
                        setShowDropdown(true);
                    }
                }}
                placeholder="Search iNaturalist users..."
                className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 text-sm"
            />

            {showDropdown && (
                <ul className="absolute top-full left-0 right-0 mt-1 z-10 bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    {results.map((user) => (
                        <li key={user.id}>
                            <button
                                onClick={() => handleSelect(user)}
                                className="w-full text-left px-4 py-2.5 hover:bg-neutral-700 transition-colors border-b border-neutral-700/50 last:border-0 cursor-pointer flex items-center gap-3"
                            >
                                {user.icon_url ? (
                                    <img src={user.icon_url} alt="" className="w-8 h-8 rounded-full shrink-0" />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-neutral-600 shrink-0" />
                                )}
                                <div className="min-w-0">
                                    <span className="text-white text-sm">@{user.login}</span>
                                    {user.name && <span className="text-neutral-400 text-sm ml-2">{user.name}</span>}
                                    {user.observations_count != null && (
                                        <span className="text-neutral-500 text-xs ml-2">
                                            {user.observations_count.toLocaleString()} obs
                                        </span>
                                    )}
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
