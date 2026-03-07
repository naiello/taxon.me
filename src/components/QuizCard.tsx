import {useEffect, useState} from "react";

import type {GuessResult, GuessRoundOutcome, Observation, PartialGuessRecord, TaxonSuggestion} from "../types";
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
    const [partialGuesses, setPartialGuesses] = useState<PartialGuessRecord[]>([]);
    const [revealed, setRevealed] = useState(false);
    const [phase, setPhase] = useState<Phase>("guessing");
    const [resultType, setResultType] = useState<GuessRoundOutcome | null>(null);

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

    const checkGuess = (suggestion: TaxonSuggestion | null, rawText: string) => {
        let isCorrect = false;

        if (suggestion !== null) {
            isCorrect = suggestion.id === taxon.id;
        } else {
            const guess = rawText.toLowerCase().trim();
            isCorrect =
                guess === taxon.name.toLowerCase() ||
                (!!taxon.preferred_common_name && guess === taxon.preferred_common_name.toLowerCase());
        }

        if (isCorrect) {
            setGuesses((prev) => [...prev, "correct"]);
            setPhase("done");
            setRevealed(true);
            setResultType("correct");
            onOutcome("correct");
            return;
        }

        const ancestorIds = taxon.ancestor_ids ?? [];
        const ancestorIndex = suggestion !== null ? ancestorIds.indexOf(suggestion.id) : -1;
        const isPartial = ancestorIndex !== -1;

        if (isPartial) {
            const newGuesses: GuessResult[] = [...guesses, "partial"];
            const newPartials: PartialGuessRecord[] = [...partialGuesses, {taxon: suggestion!, ancestorIndex}];
            setGuesses(newGuesses);
            setPartialGuesses(newPartials);
            if (newGuesses.length >= MAX_GUESSES) {
                setPhase("done");
                setRevealed(true);
                setResultType("incorrect");
                onOutcome("incorrect");
            }
        } else {
            const newGuesses: GuessResult[] = [...guesses, "wrong"];
            setGuesses(newGuesses);
            if (newGuesses.length >= MAX_GUESSES) {
                setPhase("done");
                setRevealed(true);
                setResultType("incorrect");
                onOutcome("incorrect");
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
    const showPartialBadge = resultType === "incorrect" && partialGuesses.length > 0;

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
                                {taxon.preferred_common_name && (
                                    <h3 className="text-lg font-bold text-white">
                                        <a
                                            href={`https://www.inaturalist.org/observations/${observation.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:text-neutral-200 transition-colors"
                                        >
                                            {taxon.preferred_common_name}
                                        </a>
                                    </h3>
                                )}
                                <span
                                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                        resultType === "correct"
                                            ? "bg-green-900/70 text-green-400"
                                            : showPartialBadge
                                              ? "bg-blue-900/70 text-blue-400"
                                              : resultType === "incorrect"
                                                ? "bg-red-900/70 text-red-400"
                                                : "bg-yellow-900/70 text-yellow-400"
                                    }`}
                                >
                                    {resultType === "correct"
                                        ? "Correct"
                                        : showPartialBadge
                                          ? "Partial"
                                          : resultType === "incorrect"
                                            ? "Incorrect"
                                            : "Skipped"}
                                </span>
                            </div>
                            <p className="text-neutral-300 italic text-sm">{taxon.name}</p>
                            {taxon.ancestors && (
                                <TaxonLineage
                                    ancestors={taxon.ancestors}
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

                {/* Guess dots */}
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
                </div>

                {/* Observer */}
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
            </div>
        </div>
    );
}
