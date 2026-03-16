import {useCallback, useEffect, useRef, useState} from "react";

import {useObservations} from "../hooks/useObservations";
import type {AppMode, GuessRoundOutcome, SearchParams} from "../types";
import {AboutModal} from "./AboutModal";
import {ObservationMap} from "./ObservationMap";
import {PhotoCarousel} from "./PhotoCarousel";
import {QuizCard} from "./QuizCard";
import {TaxonLineage} from "./TaxonLineage";

interface Props {
    searchParams: SearchParams;
    initialMode?: AppMode;
    onBack: () => void;
}

export function ObservationFeed({searchParams, initialMode = "quiz", onBack}: Props) {
    const {observations, loading, error, hasMore, loadMore} = useObservations(searchParams);
    const containerRef = useRef<HTMLDivElement>(null);

    const [quizMode, setQuizMode] = useState(initialMode === "quiz");
    const [quizIndex, setQuizIndex] = useState(0);
    const [score, setScore] = useState({correct: 0, partial: 0, incorrect: 0, skipped: 0});
    const [showAbout, setShowAbout] = useState(false);
    const [showBrowseMap, setShowBrowseMap] = useState(() => window.matchMedia("(min-width: 1024px)").matches);

    const locationLabel =
        searchParams.type === "place"
            ? searchParams.place_name
            : searchParams.type === "gps"
              ? `${searchParams.lat.toFixed(3)}, ${searchParams.lng.toFixed(3)} (${searchParams.radius} km)`
              : searchParams.type === "bbox"
                ? "Map area"
                : "Worldwide";

    const handleScroll = useCallback(() => {
        if (quizMode) {
            return;
        }
        const el = containerRef.current;
        if (!el || !hasMore || loading) {
            return;
        }

        const cardHeight = el.clientHeight;
        const scrollPos = el.scrollTop;
        const totalHeight = el.scrollHeight;
        const cardsFromEnd = (totalHeight - scrollPos - cardHeight) / cardHeight;

        if (cardsFromEnd < 5) {
            loadMore();
        }
    }, [hasMore, loading, loadMore, quizMode]);

    useEffect(() => {
        if (quizMode) {
            return;
        }
        const el = containerRef.current;
        if (!el) {
            return;
        }
        el.addEventListener("scroll", handleScroll, {passive: true});
        return () => el.removeEventListener("scroll", handleScroll);
    }, [handleScroll, quizMode]);

    // After each load, auto-fetch the next page if filtered results leave fewer
    // than 5 cards from the end (e.g. heavy client-side filtering).
    useEffect(() => {
        if (loading || !hasMore || quizMode) {
            return;
        }
        const el = containerRef.current;
        if (!el) {
            return;
        }
        const cardsFromEnd = (el.scrollHeight - el.scrollTop - el.clientHeight) / el.clientHeight;
        if (cardsFromEnd < 5) {
            loadMore();
        }
    }, [loading, hasMore, loadMore, quizMode]);

    // Keep a ref so the sync effect can read quizIndex without re-running on every advance
    const quizIndexRef = useRef(quizIndex);
    useEffect(() => {
        quizIndexRef.current = quizIndex;
    }, [quizIndex]);

    const handleToggleMode = () => {
        setQuizMode((prev) => {
            const entering = !prev;
            if (entering) {
                // browse -> quiz: read current scroll position and set quizIndex
                const el = containerRef.current;
                if (el && el.clientHeight > 0) {
                    const idx = Math.round(el.scrollTop / el.clientHeight);
                    setQuizIndex(idx);
                    quizIndexRef.current = idx;
                }
            }
            return entering;
        });
    };

    // quiz -> browse: scroll browse view to match quizIndex
    useEffect(() => {
        if (!quizMode) {
            const el = containerRef.current;
            if (el) {
                el.scrollTop = quizIndexRef.current * el.clientHeight;
            }
        }
    }, [quizMode]);

    const handleOutcome = useCallback((outcome: GuessRoundOutcome) => {
        setScore((prev) => ({...prev, [outcome]: prev[outcome] + 1}));
    }, []);

    const handleNext = useCallback(() => {
        setQuizIndex((prev) => {
            const next = prev + 1;
            if (next >= observations.length - 5 && hasMore) {
                loadMore();
            }
            return next;
        });
    }, [observations.length, hasMore, loadMore]);

    const quizObs = observations[quizIndex];
    const quizEnded = quizIndex >= observations.length && !hasMore && !loading;

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-4 px-4 py-3 bg-neutral-900/90 backdrop-blur-sm z-10 shrink-0">
                <button
                    onClick={onBack}
                    className="text-neutral-400 hover:text-white transition-colors cursor-pointer text-2xl leading-none"
                >
                    ←
                </button>
                <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-base text-neutral-300 truncate">{locationLabel}</span>
                    {quizMode && (
                        <span className="flex items-center gap-3 text-sm whitespace-nowrap sm:hidden">
                            <span className="flex items-center gap-1" title="Correct">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-green-500"
                                >
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span className="text-neutral-300">{score.correct}</span>
                            </span>
                            <span className="flex items-center gap-1" title="Incorrect">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-red-500"
                                >
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                                <span className="text-neutral-300">{score.incorrect}</span>
                            </span>
                            <span className="flex items-center gap-1" title="Partial">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-blue-500"
                                >
                                    <line x1="12" y1="19" x2="12" y2="5" />
                                    <polyline points="5 12 12 5 19 12" />
                                </svg>
                                <span className="text-neutral-300">{score.partial}</span>
                            </span>
                            <span className="flex items-center gap-1" title="Skipped">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-yellow-500"
                                >
                                    <polygon points="2 5 12 12 2 19" />
                                    <polygon points="12 5 22 12 12 19" />
                                </svg>
                                <span className="text-neutral-300">{score.skipped}</span>
                            </span>
                        </span>
                    )}
                </div>

                {quizMode && (
                    <span className="hidden sm:flex items-center gap-3 text-sm whitespace-nowrap">
                        <span className="flex items-center gap-1" title="Correct">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-green-500"
                            >
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span className="text-neutral-300">{score.correct}</span>
                        </span>
                        <span className="flex items-center gap-1" title="Incorrect">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-red-500"
                            >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                            <span className="text-neutral-300">{score.incorrect}</span>
                        </span>
                        <span className="flex items-center gap-1" title="Partial">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-blue-500"
                            >
                                <line x1="12" y1="19" x2="12" y2="5" />
                                <polyline points="5 12 12 5 19 12" />
                            </svg>
                            <span className="text-neutral-300">{score.partial}</span>
                        </span>
                        <span className="flex items-center gap-1" title="Skipped">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-yellow-500"
                            >
                                <polygon points="2 5 12 12 2 19" />
                                <polygon points="12 5 22 12 12 19" />
                            </svg>
                            <span className="text-neutral-300">{score.skipped}</span>
                        </span>
                    </span>
                )}

                <div className="flex gap-1 bg-neutral-800 rounded-lg p-1 shrink-0">
                    <button
                        onClick={() => !quizMode && handleToggleMode()}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                            quizMode ? "bg-neutral-600 text-white" : "text-neutral-400 hover:text-white"
                        }`}
                    >
                        Quiz
                    </button>
                    <button
                        onClick={() => quizMode && handleToggleMode()}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                            !quizMode ? "bg-neutral-600 text-white" : "text-neutral-400 hover:text-white"
                        }`}
                    >
                        Browse
                    </button>
                </div>

                <button
                    onClick={() => setShowAbout(true)}
                    className="w-6 h-6 rounded-full border border-neutral-600 hover:border-neutral-400 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer flex items-center justify-center text-xs font-semibold shrink-0"
                    aria-label="About"
                >
                    ?
                </button>
            </div>

            {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

            {/* Body */}
            <div className={`flex-1 overflow-hidden ${quizMode ? "" : "hidden"}`}>
                {error && (
                    <div className="h-full flex items-center justify-center text-red-400 px-4 text-center">{error}</div>
                )}

                {!error && quizEnded && (
                    <div className="h-full flex items-center justify-center text-neutral-500">No more observations</div>
                )}

                {!error && !quizEnded && quizObs && (
                    <QuizCard key={quizObs.id} observation={quizObs} onOutcome={handleOutcome} onNext={handleNext} />
                )}

                {!error && !quizEnded && !quizObs && loading && (
                    <div className="h-full flex items-center justify-center text-neutral-500">
                        <div className="animate-pulse">Loading observations...</div>
                    </div>
                )}
            </div>

            <div
                ref={containerRef}
                className={`flex-1 overflow-y-auto ${quizMode ? "hidden" : ""}`}
                style={{scrollSnapType: "y mandatory"}}
            >
                {error && (
                    <div className="h-full flex items-center justify-center text-red-400 px-4 text-center">{error}</div>
                )}

                {!error && observations.length === 0 && !loading && (
                    <div className="h-full flex items-center justify-center text-neutral-500">
                        No observations found
                    </div>
                )}

                {observations.map((obs) => (
                    <div
                        key={obs.id}
                        className="flex flex-col relative w-full overflow-hidden lg:block"
                        style={{
                            height: "calc(100dvh - 44px)",
                            scrollSnapAlign: "start",
                        }}
                    >
                        {/* Photo carousel */}
                        <div className="flex-1 min-h-0 relative lg:absolute lg:inset-0">
                            <PhotoCarousel photos={obs.photos} />
                        </div>

                        {/* Map overlay — desktop only */}
                        {obs.location && (
                            <div className="hidden lg:block absolute bottom-16 right-3 z-[40]">
                                {showBrowseMap ? (
                                    <div className="relative group/map">
                                        <ObservationMap
                                            observation={obs}
                                            className="h-40 w-48 group-hover/map:h-72 group-hover/map:w-80 transition-all duration-200 rounded-lg border border-neutral-700 shadow-lg"
                                        />
                                        <button
                                            onClick={() => setShowBrowseMap(false)}
                                            className="absolute top-1 right-1 z-[1000] w-6 h-6 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-xs cursor-pointer"
                                            aria-label="Close map"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowBrowseMap(true)}
                                        className="w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center cursor-pointer"
                                        aria-label="Show map"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                        >
                                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Info panel — below photo on mobile, overlay on desktop */}
                        <div
                            className="shrink-0 overflow-y-auto bg-neutral-900 px-4 py-3 pb-6 lg:pb-8 lg:overflow-y-visible lg:absolute lg:bottom-0 lg:left-0 lg:right-0 lg:bg-transparent lg:bg-gradient-to-t lg:from-black/80 lg:via-black/40 lg:to-transparent lg:pt-16"
                            style={{maxHeight: "40dvh"}}
                        >
                            <div className="flex gap-3 items-end">
                                <div className="flex-1 min-w-0">
                                    {obs.taxon && (
                                        <>
                                            {obs.taxon.preferred_common_name && (
                                                <h2 className="text-xl font-bold text-white">
                                                    <a
                                                        href={`https://www.inaturalist.org/observations/${obs.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="hover:text-neutral-200 transition-colors"
                                                    >
                                                        {obs.taxon.preferred_common_name}
                                                    </a>
                                                </h2>
                                            )}
                                            <p className="text-neutral-300 italic text-sm">{obs.taxon.name}</p>
                                            {obs.taxon.ancestors && (
                                                <TaxonLineage
                                                    ancestors={obs.taxon.ancestors}
                                                    className="text-neutral-400 mt-0.5"
                                                />
                                            )}
                                        </>
                                    )}
                                    {obs.place_guess && (
                                        <p className="text-neutral-400 text-xs mt-1">{obs.place_guess}</p>
                                    )}
                                    {obs.user && (
                                        <p className="text-neutral-500 text-xs mt-1 flex items-center gap-2">
                                            <a
                                                href={`https://www.inaturalist.org/people/${obs.user.login}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:text-neutral-300 transition-colors"
                                            >
                                                @{obs.user.login}
                                            </a>
                                            {obs.observed_on_string && <span>{obs.observed_on_string}</span>}
                                        </p>
                                    )}
                                </div>
                                {/* Map — inline on mobile */}
                                {obs.location && showBrowseMap && (
                                    <div className="shrink-0 lg:hidden relative">
                                        <ObservationMap
                                            observation={obs}
                                            className="h-32 w-40 rounded-lg border border-neutral-700 shadow-lg"
                                        />
                                        <button
                                            onClick={() => setShowBrowseMap(false)}
                                            className="absolute top-1 right-1 z-[1000] w-6 h-6 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-xs cursor-pointer"
                                            aria-label="Close map"
                                        >
                                            ×
                                        </button>
                                    </div>
                                )}
                                {obs.location && !showBrowseMap && (
                                    <button
                                        onClick={() => setShowBrowseMap(true)}
                                        className="shrink-0 lg:hidden w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center cursor-pointer"
                                        aria-label="Show map"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                        >
                                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {loading && (
                    <div
                        className="flex items-center justify-center text-neutral-500"
                        style={{height: observations.length === 0 ? "100%" : "80px"}}
                    >
                        <div className="animate-pulse">Loading observations...</div>
                    </div>
                )}
            </div>
        </div>
    );
}
