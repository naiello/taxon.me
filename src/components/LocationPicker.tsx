import {useEffect, useRef, useState} from "react";

import {searchPlaces} from "../api/inaturalist";
import type {AppMode, BoundingBox, Coordinates, INaturalistUser, MapSelectionMode, Place, SearchParams} from "../types";
import {AboutModal} from "./AboutModal";
import {InteractiveMap} from "./InteractiveMap";
import {LocationMap} from "./LocationMap";
import {UserAutocomplete} from "./UserAutocomplete";

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
    const [mode, setMode] = useState<"search" | "map" | "worldwide">("search");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Place[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const [radius, setRadius] = useState(25);
    const [gpsStatus, setGpsStatus] = useState<"idle" | "locating" | "ready" | "error">("idle");
    const [coords, setCoords] = useState<Coordinates | null>(null);
    const [gpsError, setGpsError] = useState<string | null>(null);
    const [taxonId, setTaxonId] = useState<number | undefined>(undefined);
    const [selectedUsers, setSelectedUsers] = useState<INaturalistUser[]>([]);
    const [appMode, setAppMode] = useState<AppMode>("quiz");
    const [showAbout, setShowAbout] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Map tab state
    const [mapSelectionMode, setMapSelectionMode] = useState<MapSelectionMode>("circle");
    const [mapCenter, setMapCenter] = useState<Coordinates | null>(null);
    const [mapBounds, setMapBounds] = useState<BoundingBox | null>(null);
    const [drawingEnabled, setDrawingEnabled] = useState(false);

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

    // When GPS becomes ready, auto-set map center and switch to circle mode
    useEffect(() => {
        if (gpsStatus === "ready" && coords && mode === "map") {
            setMapCenter(coords);
            setMapSelectionMode("circle");
        }
    }, [gpsStatus, coords, mode]);

    const canSubmit =
        mode === "worldwide" ||
        (mode === "search" && selectedPlace !== null) ||
        (mode == "map" &&
            ((mapSelectionMode == "circle" && mapCenter !== null) ||
                (mapSelectionMode == "rectangle" && mapBounds !== null)));

    const handleSubmit = () => {
        if (!canSubmit) {
            return;
        }
        const userIds = selectedUsers.length > 0 ? selectedUsers.map((u) => u.id) : undefined;
        if (mode === "worldwide") {
            onSelect({type: "worldwide", taxon_id: taxonId, user_ids: userIds}, appMode);
        } else if (mode === "search" && selectedPlace) {
            if (selectedPlace.has_geometry) {
                onSelect(
                    {
                        type: "place",
                        place_id: selectedPlace.id,
                        place_name: selectedPlace.display_name,
                        taxon_id: taxonId,
                        user_ids: userIds,
                    },
                    appMode,
                );
            } else {
                const [lat, lng] = selectedPlace.location.split(",").map(Number);
                onSelect({type: "gps", lat, lng, radius: 25, taxon_id: taxonId, user_ids: userIds}, appMode);
            }
        } else if (mode === "map") {
            if (mapSelectionMode === "circle" && mapCenter) {
                onSelect(
                    {type: "gps", lat: mapCenter.lat, lng: mapCenter.lng, radius, taxon_id: taxonId, user_ids: userIds},
                    appMode,
                );
            } else if (mapSelectionMode === "rectangle" && mapBounds) {
                onSelect({type: "bbox", ...mapBounds, taxon_id: taxonId, user_ids: userIds}, appMode);
            }
        }
    };

    return (
        <div className="flex flex-col items-center w-full h-full overflow-y-auto px-5 py-8 md:justify-center">
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
                    onClick={() => setMode("map")}
                    className={`px-4 py-2.5 rounded-md text-base font-medium transition-colors cursor-pointer ${
                        mode === "map" ? "bg-neutral-600 text-white" : "text-neutral-400 hover:text-white"
                    }`}
                >
                    Map
                </button>
                <button
                    onClick={() => setMode("worldwide")}
                    className={`px-4 py-2.5 rounded-md text-base font-medium transition-colors cursor-pointer ${
                        mode === "worldwide" ? "bg-neutral-600 text-white" : "text-neutral-400 hover:text-white"
                    }`}
                >
                    Worldwide
                </button>
            </div>

            <div className="w-full max-w-md">
                {mode === "worldwide" ? (
                    <p className="text-neutral-400 text-center">Observations from anywhere</p>
                ) : mode === "search" ? (
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
                    <div className="space-y-4">
                        {/* Map selection mode toggle + Use My Location */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex gap-1 bg-neutral-800 rounded-lg p-1">
                                <button
                                    onClick={() => {
                                        setMapSelectionMode("circle");
                                        setDrawingEnabled(false);
                                    }}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                                        mapSelectionMode === "circle"
                                            ? "bg-neutral-600 text-white"
                                            : "text-neutral-400 hover:text-white"
                                    }`}
                                >
                                    Circle
                                </button>
                                <button
                                    onClick={() => {
                                        setMapSelectionMode("rectangle");
                                        setDrawingEnabled(true);
                                    }}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                                        mapSelectionMode === "rectangle"
                                            ? "bg-neutral-600 text-white"
                                            : "text-neutral-400 hover:text-white"
                                    }`}
                                >
                                    Rectangle
                                </button>
                            </div>
                            <button
                                onClick={handleGps}
                                disabled={gpsStatus === "locating"}
                                className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:cursor-default"
                            >
                                {gpsStatus === "locating" ? "Locating..." : "Use My Location"}
                            </button>
                        </div>

                        {/* GPS error */}
                        {gpsStatus === "error" && <p className="text-red-400 text-sm">{gpsError}</p>}

                        {/* Draw/Pan toggle for rectangle mode */}
                        {mapSelectionMode === "rectangle" && (
                            <div className="flex items-center gap-2">
                                <div className="flex gap-1 bg-neutral-800 rounded-lg p-1">
                                    <button
                                        onClick={() => setDrawingEnabled(true)}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                                            drawingEnabled
                                                ? "bg-blue-600 text-white"
                                                : "text-neutral-400 hover:text-white"
                                        }`}
                                    >
                                        Draw
                                    </button>
                                    <button
                                        onClick={() => setDrawingEnabled(false)}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                                            !drawingEnabled
                                                ? "bg-blue-600 text-white"
                                                : "text-neutral-400 hover:text-white"
                                        }`}
                                    >
                                        Pan
                                    </button>
                                </div>
                                <span className="text-neutral-500 text-xs">
                                    {drawingEnabled
                                        ? "Drag to draw a rectangle"
                                        : "Drag to move the map. Shift+drag to draw a rectangle"}
                                </span>
                            </div>
                        )}

                        {/* Hint text (circle mode only — rectangle hints are next to the Draw/Pan toggle) */}
                        {mapSelectionMode === "circle" && (
                            <p className="text-neutral-500 text-xs text-center">Click the map to set a center point</p>
                        )}

                        {/* Interactive map */}
                        <InteractiveMap
                            mode={mapSelectionMode}
                            center={mapCenter}
                            radiusKm={radius}
                            onCenterChange={setMapCenter}
                            onRadiusChange={setRadius}
                            bounds={mapBounds}
                            onBoundsChange={setMapBounds}
                            drawingEnabled={drawingEnabled}
                            onDrawComplete={() => setDrawingEnabled(false)}
                        />

                        {/* Radius slider (circle mode only) */}
                        {mapSelectionMode === "circle" && (
                            <div>
                                <label className="block text-sm text-neutral-400 mb-1">Radius: {radius} km</label>
                                <input
                                    type="range"
                                    min={5}
                                    max={1000}
                                    value={radius}
                                    onChange={(e) => setRadius(Number(e.target.value))}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-xs text-neutral-500">
                                    <span>5 km</span>
                                    <span>1000 km</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Map preview for Search Place */}
            {!showAbout && mode === "search" && selectedPlace && (
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

            {/* User filter */}
            <div className="w-full max-w-md mt-4">
                <p className="text-sm text-neutral-400 mb-2">Filter by observer</p>
                <UserAutocomplete selectedUsers={selectedUsers} onChange={setSelectedUsers} />
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

            {/* About button */}
            <div className="w-full max-w-md mt-2 flex justify-end">
                <button
                    onClick={() => setShowAbout(true)}
                    className="w-6 h-6 rounded-full border border-neutral-600 hover:border-neutral-400 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer flex items-center justify-center text-xs font-semibold"
                    aria-label="About"
                >
                    ?
                </button>
            </div>

            {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
        </div>
    );
}
