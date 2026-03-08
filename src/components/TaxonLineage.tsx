import type {TaxonAncestor} from "../types";

const KEY_RANKS = new Set(["kingdom", "phylum", "class", "order", "family", "genus"]);

interface Props {
    ancestors: TaxonAncestor[];
    /** If set, only show ancestors up to and including this taxon ID */
    upToId?: number;
    /** If set, this taxon ID is highlighted in blue; all others are gray */
    highlightId?: number;
    /** If set, this taxon ID is blue and all subsequent taxa are red */
    partialId?: number;
    className?: string;
}

export function TaxonLineage({ancestors, upToId, highlightId, partialId, className = ""}: Props) {
    let chain = ancestors;

    if (upToId != null) {
        const cutIdx = ancestors.findIndex((a) => a.id === upToId);
        if (cutIdx !== -1) {
            chain = ancestors.slice(0, cutIdx + 1);
        }
    }

    const filtered = chain.filter((a) => KEY_RANKS.has(a.rank));
    if (filtered.length === 0) {
        return null;
    }

    const partialFilteredIdx = partialId != null ? filtered.findIndex((a) => a.id === partialId) : -1;

    return (
        <p className={`text-xs ${className}`}>
            {filtered.map((a, i) => {
                let colorClass = "";
                if (partialId != null && partialFilteredIdx !== -1) {
                    if (i === partialFilteredIdx) {
                        colorClass = "text-blue-400";
                    } else if (i > partialFilteredIdx) {
                        colorClass = "text-red-400";
                    } else {
                        colorClass = "text-neutral-500";
                    }
                } else if (highlightId != null) {
                    colorClass = a.id === highlightId ? "text-blue-400" : "text-neutral-500";
                }
                return (
                    <span key={a.id}>
                        {i > 0 && <span className="text-neutral-600 mx-0.5">›</span>}
                        <a
                            href={`https://www.inaturalist.org/taxa/${a.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`hover:underline ${colorClass}`}
                        >
                            {a.preferred_common_name || a.name}
                        </a>
                    </span>
                );
            })}
        </p>
    );
}
