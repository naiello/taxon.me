import {useEffect, useRef, useState} from "react";

import {searchPlaces} from "../api/inaturalist";
import type {AppMode, Place, SearchParams} from "../types";
import {LocationMap} from "./LocationMap";

const TAXON_OPTIONS = [
    {label: "All", taxon_id: undefined},
    {label: "Birds", taxon_id: 3},
    {label: "Mammals", taxon_id: 40151},
    {label: "Plants", taxon_id: 47126},
    {label: "Insects", taxon_id: 47158},
    {label: "Fungi", taxon_id: 47170},
    {label: "Reptiles", taxon_id: 26036},
    {label: "Amphibians", taxon_id: 20978},
    {label: "Fish", taxon_id: 47178},
    {label: "Spiders", taxon_id: 47119},
    {label: "Molluscs", taxon_id: 47115},
];

interface Props {
    onSelect: (params: SearchParams, mode: AppMode) => void;
}

export function LocationPicker({onSelect}: Props) {
    const [mode, setMode] = useState<"search" | "gps">("search");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Place[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const [radius, setRadius] = useState(25);
    const [gpsStatus, setGpsStatus] = useState<"idle" | "locating" | "ready" | "error">("idle");
    const [coords, setCoords] = useState<{lat: number; lng: number} | null>(null);
    const [gpsError, setGpsError] = useState<string | null>(null);
    const [taxonId, setTaxonId] = useState<number | undefined>(undefined);
    const [appMode, setAppMode] = useState<AppMode>("quiz");
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const places = await searchPlaces(query);
                setResults(places);
            } catch {
                setResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);

        return () => clearTimeout(debounceRef.current);
    }, [query]);

    const handleGps = () => {
        if (!navigator.geolocation) {
            setGpsError("Geolocation is not supported by your browser");
            setGpsStatus("error");
            return;
        }

        setGpsStatus("locating");
        setGpsError(null);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setCoords({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
                setGpsStatus("ready");
            },
            (err) => {
                setGpsError(err.message);
                setGpsStatus("error");
            },
            {enableHighAccuracy: false, timeout: 10000},
        );
    };

    const canSubmit = mode === "search" ? selectedPlace !== null : coords !== null;

    const handleSubmit = () => {
        if (!canSubmit) {
            return;
        }
        if (mode === "search" && selectedPlace) {
            if (selectedPlace.has_geometry) {
                onSelect(
                    {
                        type: "place",
                        place_id: selectedPlace.id,
                        place_name: selectedPlace.display_name,
                        taxon_id: taxonId,
                    },
                    appMode,
                );
            } else {
                // Place has no geometry on iNaturalist — fall back to coordinate search
                const [lat, lng] = selectedPlace.location.split(",").map(Number);
                onSelect({type: "gps", lat, lng, radius: 25, taxon_id: taxonId}, appMode);
            }
        } else if (mode === "gps" && coords) {
            onSelect({type: "gps", lat: coords.lat, lng: coords.lng, radius, taxon_id: taxonId}, appMode);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full px-5">
            <h1 className="text-3xl font-bold mb-2">taxon.me</h1>
            <p className="text-neutral-400 mb-8 text-center">Test your knowledge of your local ecosystem</p>

            {/* Mode tabs */}
            <div className="flex gap-1 mb-6 bg-neutral-800 rounded-lg p-1">
                <button
                    onClick={() => setMode("search")}
                    className={`px-4 py-2.5 rounded-md text-base font-medium transition-colors cursor-pointer ${
                        mode === "search" ? "bg-neutral-600 text-white" : "text-neutral-400 hover:text-white"
                    }`}
                >
                    Search Place
                </button>
                <button
                    onClick={() => setMode("gps")}
                    className={`px-4 py-2.5 rounded-md text-base font-medium transition-colors cursor-pointer ${
                        mode === "gps" ? "bg-neutral-600 text-white" : "text-neutral-400 hover:text-white"
                    }`}
                >
                    Nearby
                </button>
            </div>

            <div className="w-full max-w-md">
                {mode === "search" ? (
                    <div className="relative">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setSelectedPlace(null);
                            }}
                            placeholder="Search for a place..."
                            className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 text-lg"
                            autoFocus
                        />
                        {searching && <p className="text-neutral-500 text-sm mt-2 px-1">Searching...</p>}
                        {results.length > 0 && !selectedPlace && (
                            <ul className="absolute top-full left-0 right-0 mt-2 z-10 bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden">
                                {results.slice(0, 8).map((place) => (
                                    <li key={place.id}>
                                        <button
                                            onClick={() => {
                                                setSelectedPlace(place);
                                                setQuery(place.display_name);
                                                setResults([]);
                                            }}
                                            className="w-full text-left px-4 py-3 hover:bg-neutral-700 transition-colors border-b border-neutral-700/50 last:border-0 cursor-pointer"
                                        >
                                            <span className="text-white">{place.display_name}</span>
                                            {place.admin_level != null && (
                                                <span className="text-neutral-500 text-sm ml-2">
                                                    (level {place.admin_level})
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4">
                        {gpsStatus === "idle" && (
                            <button
                                onClick={handleGps}
                                className="px-6 py-3 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg font-medium text-base transition-colors cursor-pointer"
                            >
                                Use My Location
                            </button>
                        )}
                        {gpsStatus === "locating" && <p className="text-neutral-400">Getting your location...</p>}
                        {gpsStatus === "error" && (
                            <div className="text-center">
                                <p className="text-red-400 mb-2">{gpsError}</p>
                                <button
                                    onClick={handleGps}
                                    className="px-5 py-2.5 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg text-base cursor-pointer"
                                >
                                    Try Again
                                </button>
                            </div>
                        )}
                        {gpsStatus === "ready" && coords && (
                            <div className="w-full space-y-4">
                                <p className="text-neutral-400 text-center text-sm">
                                    {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                                </p>
                                <div>
                                    <label className="block text-sm text-neutral-400 mb-1">Radius: {radius} km</label>
                                    <input
                                        type="range"
                                        min={5}
                                        max={100}
                                        value={radius}
                                        onChange={(e) => setRadius(Number(e.target.value))}
                                        className="w-full"
                                    />
                                    <div className="flex justify-between text-xs text-neutral-500">
                                        <span>5 km</span>
                                        <span>100 km</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Map preview */}
            {mode === "search" && selectedPlace && (
                <div className="w-full max-w-md mt-4">
                    <LocationMap
                        geojson={selectedPlace.geometry_geojson}
                        center={
                            !selectedPlace.geometry_geojson && selectedPlace.location
                                ? {
                                      lat: Number(selectedPlace.location.split(",")[0]),
                                      lng: Number(selectedPlace.location.split(",")[1]),
                                  }
                                : undefined
                        }
                        radiusKm={!selectedPlace.geometry_geojson ? 25 : undefined}
                    />
                </div>
            )}
            {mode === "gps" && coords && (
                <div className="w-full max-w-md mt-4">
                    <LocationMap center={coords} radiusKm={radius} />
                </div>
            )}

            {/* App mode */}
            <div className="w-full max-w-md mt-6">
                <p className="text-sm text-neutral-400 mb-2">Mode</p>
                <div className="flex gap-1 bg-neutral-800 rounded-lg p-1 w-fit">
                    <button
                        onClick={() => setAppMode("quiz")}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                            appMode === "quiz" ? "bg-neutral-600 text-white" : "text-neutral-400 hover:text-white"
                        }`}
                    >
                        Quiz
                    </button>
                    <button
                        onClick={() => setAppMode("browse")}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                            appMode === "browse" ? "bg-neutral-600 text-white" : "text-neutral-400 hover:text-white"
                        }`}
                    >
                        Browse
                    </button>
                </div>
            </div>

            {/* Taxon filter */}
            <div className="w-full max-w-md mt-4">
                <p className="text-sm text-neutral-400 mb-2">Filter by group</p>
                <div className="flex flex-wrap gap-2">
                    {TAXON_OPTIONS.map((opt) => (
                        <button
                            key={opt.label}
                            onClick={() => setTaxonId(opt.taxon_id)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                                taxonId === opt.taxon_id
                                    ? "bg-neutral-600 text-white"
                                    : "bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700"
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Submit */}
            <div className="w-full max-w-md mt-6">
                <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="w-full px-6 py-3 bg-green-700 hover:bg-green-600 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-lg font-medium text-base transition-colors cursor-pointer disabled:cursor-default"
                >
                    Browse Observations
                </button>
            </div>
        </div>
    );
}
