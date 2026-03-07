import type {TaxonAncestor} from "../types";

const KEY_RANKS = new Set(["kingdom", "phylum", "class", "order", "family", "genus"]);

interface Props {
    ancestors: TaxonAncestor[];
    /** If set, only show ancestors up to and including this taxon ID */
    upToId?: number;
    /** If set, this taxon ID is highlighted in blue; all others are gray */
    highlightId?: number;
    className?: string;
}

export function TaxonLineage({ancestors, upToId, highlightId, className = ""}: Props) {
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

    return (
        <p className={`text-xs ${className}`}>
            {filtered.map((a, i) => (
                <span key={a.id}>
                    {i > 0 && <span className="text-neutral-600 mx-0.5">›</span>}
                    <span
                        className={
                            highlightId != null ? (a.id === highlightId ? "text-blue-400" : "text-neutral-500") : ""
                        }
                    >
                        {a.preferred_common_name || a.name}
                    </span>
                </span>
            ))}
        </p>
    );
}
