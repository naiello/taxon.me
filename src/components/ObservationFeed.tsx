import {useCallback, useEffect, useRef, useState} from "react";

import {useObservations} from "../hooks/useObservations";
import type {AppMode, GuessRoundOutcome, SearchParams} from "../types";
import {AboutModal} from "./AboutModal";
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
                                <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                                <span className="text-neutral-300">{score.correct}</span>
                            </span>
                            <span className="flex items-center gap-1" title="Incorrect">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                                <span className="text-neutral-300">{score.incorrect}</span>
                            </span>
                            <span className="flex items-center gap-1" title="Partial">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                                <span className="text-neutral-300">{score.partial}</span>
                            </span>
                            <span className="flex items-center gap-1" title="Skipped">
                                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
                                <span className="text-neutral-300">{score.skipped}</span>
                            </span>
                        </span>
                    )}
                </div>

                {quizMode && (
                    <span className="hidden sm:flex items-center gap-3 text-sm whitespace-nowrap">
                        <span className="flex items-center gap-1" title="Correct">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                            <span className="text-neutral-300">{score.correct}</span>
                        </span>
                        <span className="flex items-center gap-1" title="Incorrect">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                            <span className="text-neutral-300">{score.incorrect}</span>
                        </span>
                        <span className="flex items-center gap-1" title="Partial">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                            <span className="text-neutral-300">{score.partial}</span>
                        </span>
                        <span className="flex items-center gap-1" title="Skipped">
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
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

                        {/* Info panel — below photo on mobile, overlay on desktop */}
                        <div
                            className="shrink-0 overflow-y-auto bg-neutral-900 px-4 py-3 pb-6 lg:pb-8 lg:overflow-y-visible lg:absolute lg:bottom-0 lg:left-0 lg:right-0 lg:bg-transparent lg:bg-gradient-to-t lg:from-black/80 lg:via-black/40 lg:to-transparent lg:pt-16"
                            style={{maxHeight: "40dvh"}}
                        >
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
                            {obs.place_guess && <p className="text-neutral-400 text-xs mt-1">{obs.place_guess}</p>}
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
