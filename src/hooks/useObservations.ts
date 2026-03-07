import _ from "lodash";
import {useCallback, useState} from "react";

import {fetchObservations} from "../api/inaturalist";
import type {Observation, SearchParams} from "../types";

interface UseObservationsReturn {
    observations: Observation[];
    loading: boolean;
    error: string | null;
    hasMore: boolean;
    loadMore: () => void;
}

export function useObservations(searchParams: SearchParams | null): UseObservationsReturn {
    const [observations, setObservations] = useState<Observation[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const [fetchedCount, setFetchedCount] = useState(0);
    const [initialized, setInitialized] = useState(false);
    const [currentParams, setCurrentParams] = useState<SearchParams | null>(null);

    // Reset when searchParams changes
    if (searchParams !== currentParams) {
        if (JSON.stringify(searchParams) !== JSON.stringify(currentParams)) {
            setCurrentParams(searchParams);
            setObservations([]);
            setPage(1);
            setTotalResults(0);
            setFetchedCount(0);
            setInitialized(false);
            setError(null);
        }
    }

    const load = useCallback(
        async (pageNum: number, append: boolean) => {
            if (!searchParams || loading) {
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const apiParams =
                    searchParams.type === "place"
                        ? {place_id: searchParams.place_id, taxon_id: searchParams.taxon_id, page: pageNum}
                        : {
                              lat: searchParams.lat,
                              lng: searchParams.lng,
                              radius: searchParams.radius,
                              taxon_id: searchParams.taxon_id,
                              page: pageNum,
                          };

                const result = await fetchObservations(apiParams);
                setObservations((prev) =>
                    append ? [...prev, ..._.shuffle(result.observations)] : _.shuffle(result.observations),
                );
                setTotalResults(result.total_results);
                setFetchedCount((prev) => (append ? prev + result.raw_count : result.raw_count));
                setPage(pageNum);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to fetch observations");
            } finally {
                setLoading(false);
            }
        },
        [searchParams, loading],
    );

    // Initial load
    if (searchParams && !initialized && !loading) {
        setInitialized(true);
        void load(1, false);
    }

    const hasMore = fetchedCount < totalResults;

    const loadMore = useCallback(() => {
        if (hasMore && !loading) {
            void load(page + 1, true);
        }
    }, [hasMore, loading, load, page]);

    return {observations, loading, error, hasMore, loadMore};
}
