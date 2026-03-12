import {useEffect, useState} from "react";

import type {GuessResult, GuessRoundOutcome, Observation, PartialGuessRecord, TaxonSuggestion} from "../types";
import {ObservationMap} from "./ObservationMap";
import {PhotoCarousel} from "./PhotoCarousel";
import {TaxonAutocomplete} from "./TaxonAutocomplete";
import {TaxonLineage} from "./TaxonLineage";

type Phase = "guessing" | "done";

interface Props {
    observation: Observation;
    onOutcome: (outcome: GuessRoundOutcome) => void;
    onNext: () => void;
}

const MAX_GUESSES = 5;
const GUESS_SLOT_KEYS = Array.from({length: MAX_GUESSES}, (_, i) => `guess-slot-${i}`);

export function QuizCard({observation, onOutcome, onNext}: Props) {
    const [guesses, setGuesses] = useState<GuessResult[]>([]);
    const [guessLabels, setGuessLabels] = useState<string[]>([]);
    const [partialGuesses, setPartialGuesses] = useState<PartialGuessRecord[]>([]);
    const [revealed, setRevealed] = useState(false);
    const [phase, setPhase] = useState<Phase>("guessing");
    const [resultType, setResultType] = useState<GuessRoundOutcome | null>(null);
    const [historyExpanded, setHistoryExpanded] = useState(false);
    const [showMap, setShowMap] = useState(() => window.matchMedia("(min-width: 1024px)").matches);

    // Skip observations with no taxon
    useEffect(() => {
        if (!observation.taxon) {
            onOutcome("skipped");
            onNext();
        }
    }, [observation, onOutcome, onNext]);

    if (!observation.taxon) {
        return null;
    }

    const taxon = observation.taxon;

    const acceptableTaxa = taxon.ancestors?.filter((t) => t.rank === "species").map((t) => t.id) ?? [];
    acceptableTaxa.push(taxon.id); // make sure the taxon itself is always accepted even if ancestors is empty

    const resolveTaxon = (suggestion: TaxonSuggestion | null, rawText: string): TaxonSuggestion | null => {
        if (suggestion !== null) {
            return suggestion;
        }
        const guess = rawText.toLowerCase().trim();
        const allTaxa: TaxonSuggestion[] = [taxon, ...(taxon.ancestors ?? [])];
        return (
            allTaxa.find(
                (t) =>
                    t.name.toLowerCase() === guess ||
                    (t.preferred_common_name && t.preferred_common_name.toLowerCase() === guess),
            ) ?? null
        );
    };

    const checkGuess = (suggestion: TaxonSuggestion | null, rawText: string) => {
        const resolved = resolveTaxon(suggestion, rawText);
        const label = resolved ? resolved.preferred_common_name || resolved.name : rawText.trim();

        const isCorrect = resolved !== null && acceptableTaxa.includes(resolved.id);

        if (isCorrect) {
            setGuesses((prev) => [...prev, "correct"]);
            setGuessLabels((prev) => [...prev, label]);
            setPhase("done");
            setRevealed(true);
            setResultType("correct");
            onOutcome("correct");
            return;
        }

        const ancestorIds = taxon.ancestor_ids ?? [];
        const ancestorIndex = resolved !== null ? ancestorIds.indexOf(resolved.id) : -1;
        const isPartial = ancestorIndex !== -1;

        if (isPartial) {
            const newGuesses: GuessResult[] = [...guesses, "partial"];
            const newPartials: PartialGuessRecord[] = [...partialGuesses, {taxon: resolved!, ancestorIndex}];
            setGuesses(newGuesses);
            setGuessLabels((prev) => [...prev, label]);
            setPartialGuesses(newPartials);
            if (newGuesses.length >= MAX_GUESSES) {
                setPhase("done");
                setRevealed(true);
                setResultType("partial");
                onOutcome("partial");
            }
        } else {
            const newGuesses: GuessResult[] = [...guesses, "wrong"];
            setGuesses(newGuesses);
            setGuessLabels((prev) => [...prev, label]);
            if (newGuesses.length >= MAX_GUESSES) {
                const outcome = partialGuesses.length > 0 ? "partial" : "incorrect";
                setPhase("done");
                setRevealed(true);
                setResultType(outcome);
                onOutcome(outcome);
            }
        }
    };

    const handleShowAnswer = () => {
        setPhase("done");
        setRevealed(true);
        setResultType("skipped");
        onOutcome("skipped");
    };

    const mostSpecificPartial =
        partialGuesses.length === 0
            ? null
            : partialGuesses.reduce((best, cur) => (cur.ancestorIndex > best.ancestorIndex ? cur : best));

    const partialTaxonId = mostSpecificPartial?.taxon.id;
    const partialCount = partialGuesses.length;
    const taxonDisplayedName = taxon.preferred_common_name ?? taxon.name;

    return (
        <div className="h-full flex flex-col lg:flex-row">
            {/* Photo area */}
            <div className="flex-1 min-h-0 relative overflow-hidden">
                <PhotoCarousel photos={observation.photos} />
            </div>

            {/* Controls panel — bottom bar on mobile, sidebar on desktop */}
            <div className="shrink-0 bg-neutral-900 px-5 py-4 flex flex-col gap-4 lg:w-96 lg:h-full lg:overflow-y-auto lg:justify-center">
                {phase === "guessing" && (
                    <>
                        <TaxonAutocomplete
                            onSubmit={checkGuess}
                            disabled={false}
                            onShowAnswer={handleShowAnswer}
                            wrongCount={guesses.filter((g) => g === "wrong").length}
                            partialCount={partialCount}
                            partialTaxonId={partialTaxonId}
                        />
                        {mostSpecificPartial && taxon.ancestors && (
                            <TaxonLineage
                                ancestors={taxon.ancestors}
                                upToId={mostSpecificPartial.taxon.id}
                                highlightId={mostSpecificPartial.taxon.id}
                                className="text-center"
                            />
                        )}
                    </>
                )}

                {phase === "done" && revealed && (
                    <>
                        {/* Species info with result badge */}
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                                {taxonDisplayedName && (
                                    <h3 className="text-lg font-bold text-white">
                                        <a
                                            href={`https://www.inaturalist.org/observations/${observation.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:text-neutral-200 transition-colors"
                                        >
                                            {taxonDisplayedName}
                                        </a>
                                    </h3>
                                )}
                                <span
                                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                        resultType === "correct"
                                            ? "bg-green-900/70 text-green-400"
                                            : resultType === "partial"
                                              ? "bg-blue-900/70 text-blue-400"
                                              : resultType === "incorrect"
                                                ? "bg-red-900/70 text-red-400"
                                                : "bg-yellow-900/70 text-yellow-400"
                                    }`}
                                >
                                    {resultType === "correct"
                                        ? "Correct"
                                        : resultType === "partial"
                                          ? "Partial"
                                          : resultType === "incorrect"
                                            ? "Incorrect"
                                            : "Skipped"}
                                </span>
                            </div>
                            <p className="text-neutral-300 italic text-sm">
                                <a
                                    href={`https://www.inaturalist.org/taxa/${taxon.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-neutral-100 transition-colors"
                                >
                                    {taxon.name}
                                </a>
                            </p>
                            {taxon.ancestors && (
                                <TaxonLineage
                                    ancestors={taxon.ancestors}
                                    partialId={resultType === "partial" ? mostSpecificPartial?.taxon.id : undefined}
                                    className="text-neutral-400 text-center mt-0.5"
                                />
                            )}
                        </div>

                        <button
                            onClick={onNext}
                            className="w-full py-3 bg-green-700 hover:bg-green-600 text-white rounded-lg font-medium text-base transition-colors cursor-pointer"
                        >
                            Next
                        </button>
                    </>
                )}

                {/* Guess history */}
                <div>
                    {/* Dots row + mobile toggle */}
                    <div className="flex gap-3 items-center justify-center">
                        <span className="text-neutral-400 text-sm">Guesses:</span>
                        {GUESS_SLOT_KEYS.map((slotKey, i) => {
                            const guess = guesses[i];
                            let color = "bg-neutral-600";
                            if (guess === "correct") {
                                color = "bg-green-500";
                            } else if (guess === "wrong") {
                                color = "bg-red-500";
                            } else if (guess === "partial") {
                                color = "bg-blue-500";
                            }
                            return <div key={slotKey} className={`w-4 h-4 rounded-full ${color}`} />;
                        })}
                        {guesses.length > 0 && (
                            <button
                                className="lg:hidden text-neutral-400 hover:text-neutral-200 transition-colors ml-1"
                                onClick={() => setHistoryExpanded((e) => !e)}
                                aria-label={historyExpanded ? "Hide guess history" : "Show guess history"}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className={`transition-transform ${historyExpanded ? "rotate-180" : ""}`}
                                >
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Guess list — always visible on desktop, collapsible on mobile */}
                    {guesses.length > 0 && (
                        <div className={`mt-2 flex justify-center ${historyExpanded ? "" : "hidden"} lg:flex`}>
                            <div className="flex flex-col gap-1">
                                {guesses.map((guess, i) => {
                                    let dotColor = "bg-red-500";
                                    if (guess === "correct") {
                                        dotColor = "bg-green-500";
                                    } else if (guess === "partial") {
                                        dotColor = "bg-blue-500";
                                    }
                                    return (
                                        <div key={GUESS_SLOT_KEYS[i]} className="flex items-center gap-2 text-sm">
                                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
                                            <span className="text-neutral-300 truncate">{guessLabels[i]}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Observer + location + map */}
                <div className="flex flex-col gap-2">
                    {observation.user && (
                        <p className="text-neutral-500 text-xs text-center flex items-center justify-center gap-2">
                            <a
                                href={`https://www.inaturalist.org/people/${observation.user.login}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-neutral-300 transition-colors"
                            >
                                @{observation.user.login}
                            </a>
                            {observation.observed_on_string && <span>{observation.observed_on_string}</span>}
                        </p>
                    )}
                    {observation.location && (
                        <div className="flex flex-col items-center gap-1">
                            <button
                                onClick={() => setShowMap((s) => !s)}
                                className="text-neutral-500 hover:text-neutral-300 text-xs transition-colors cursor-pointer flex items-center gap-1"
                            >
                                {showMap ? "Hide location" : "Show location"}
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className={`transition-transform ${showMap ? "rotate-180" : ""}`}
                                >
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </button>
                            {showMap && (
                                <>
                                    {observation.place_guess && (
                                        <p className="text-neutral-500 text-xs text-center">
                                            {observation.place_guess}
                                        </p>
                                    )}
                                    <ObservationMap
                                        observation={observation}
                                        className="h-40 w-full lg:aspect-square lg:h-auto rounded-lg border border-neutral-700"
                                    />
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
