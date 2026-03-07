import {useCallback, useEffect, useRef, useState} from "react";

import {useObservations} from "../hooks/useObservations";
import type {GuessRoundOutcome, SearchParams, ViewMode} from "../types";
import {PhotoCarousel} from "./PhotoCarousel";
import {QuizCard} from "./QuizCard";
import {TaxonLineage} from "./TaxonLineage";

interface Props {
    searchParams: SearchParams;
    initialMode?: ViewMode;
    onBack: () => void;
}

export function ObservationFeed({searchParams, initialMode = "browse", onBack}: Props) {
    const {observations, loading, error, hasMore, loadMore} = useObservations(searchParams);
    const containerRef = useRef<HTMLDivElement>(null);

    const [quizMode, setQuizMode] = useState(initialMode === "quiz");
    const [quizIndex, setQuizIndex] = useState(0);
    const [score, setScore] = useState({correct: 0, incorrect: 0, skipped: 0});

    const locationLabel =
        searchParams.type === "place"
            ? searchParams.place_name
            : `${searchParams.lat.toFixed(3)}, ${searchParams.lng.toFixed(3)} (${searchParams.radius} km)`;

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

    const scored = score.correct + score.incorrect;
    const pct = scored > 0 ? Math.round((score.correct / scored) * 100) : 0;
    const quizObs = observations[quizIndex];
    const quizEnded = quizIndex >= observations.length && !hasMore;

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
                <span className="text-base text-neutral-300 truncate flex-1">{locationLabel}</span>

                {quizMode && scored > 0 && (
                    <span className="text-sm text-neutral-400 whitespace-nowrap">
                        <span className="text-green-400">✓{score.correct}</span>{" "}
                        <span className="text-red-400">✗{score.incorrect}</span>{" "}
                        <span className="text-yellow-400">—{score.skipped}</span>{" "}
                        <span className="text-white">{pct}%</span>
                    </span>
                )}

                <div className="flex gap-1 bg-neutral-800 rounded-lg p-1 shrink-0">
                    <button
                        onClick={() => quizMode && handleToggleMode()}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                            !quizMode ? "bg-neutral-600 text-white" : "text-neutral-400 hover:text-white"
                        }`}
                    >
                        Browse
                    </button>
                    <button
                        onClick={() => !quizMode && handleToggleMode()}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                            quizMode ? "bg-neutral-600 text-white" : "text-neutral-400 hover:text-white"
                        }`}
                    >
                        Quiz
                    </button>
                </div>
            </div>

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
                        className="relative w-full"
                        style={{
                            height: "calc(100vh - 44px)",
                            scrollSnapAlign: "start",
                        }}
                    >
                        {/* Photo carousel */}
                        <PhotoCarousel photos={obs.photos} />

                        {/* Info overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pb-8 pt-16 pointer-events-none">
                            {obs.taxon && (
                                <>
                                    {obs.taxon.preferred_common_name && (
                                        <h2 className="text-xl font-bold text-white">
                                            <a
                                                href={`https://www.inaturalist.org/observations/${obs.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="pointer-events-auto hover:text-neutral-200 transition-colors"
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
                                        className="pointer-events-auto hover:text-neutral-300 transition-colors"
                                    >
                                        @{obs.user.login}
                                    </a>
                                    {obs.observed_on_string && <span>{obs.observed_on_string}</span>}
                                </p>
                            )}
                            {obs.photos.length > 1 && (
                                <p className="text-neutral-500 text-xs mt-1">{obs.photos.length} photos</p>
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
