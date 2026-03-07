import type {Observation, Photo, Place, TaxonAncestor, TaxonSuggestion} from "../types";

const BASE_URL = "https://api.inaturalist.org/v1";

interface ApiResponse {
    results: Record<string, unknown>[];
    total_results?: number;
    page?: number;
    per_page?: number;
}

export function getPhotoUrl(
    url: string,
    size: "square" | "small" | "medium" | "large" | "original" = "medium",
): string {
    return url.replace(/\/square\./, `/${size}.`);
}

export async function searchPlaces(query: string): Promise<Place[]> {
    if (!query.trim()) {
        return [];
    }
    const res = await fetch(`${BASE_URL}/places/autocomplete?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
        throw new Error(`Places search failed: ${res.status}`);
    }
    const data = (await res.json()) as ApiResponse;
    return data.results.map((p) => ({
        id: p.id as number,
        display_name: p.display_name as string,
        admin_level: (p.admin_level as number | null | undefined) ?? null,
        location: (p.location as string | undefined) ?? "",
        bbox_area: p.bbox_area as number | undefined,
        has_geometry: p.geometry_geojson != null,
    }));
}

export async function searchTaxa(query: string, taxonId?: number): Promise<TaxonSuggestion[]> {
    if (!query.trim()) {
        return [];
    }
    const params = new URLSearchParams({q: query, per_page: "15"});
    if (taxonId != null) {
        params.append("taxon_id", String(taxonId));
    }
    const res = await fetch(`${BASE_URL}/taxa/autocomplete?${params}`);
    if (!res.ok) {
        throw new Error(`Taxa search failed: ${res.status}`);
    }
    const data = (await res.json()) as ApiResponse;
    return data.results.map((t) => ({
        id: t.id as number,
        name: t.name as string,
        preferred_common_name: (t.preferred_common_name as string) ?? undefined,
        rank: (t.rank as string) ?? "",
    }));
}

interface FetchObservationsParams {
    place_id?: number;
    lat?: number;
    lng?: number;
    radius?: number;
    taxon_id?: number;
    page?: number;
    per_page?: number;
}

interface FetchObservationsResult {
    observations: Observation[];
    total_results: number;
    page: number;
    per_page: number;
}

async function fetchTaxaByIds(ids: number[]): Promise<Map<number, TaxonAncestor>> {
    const map = new Map<number, TaxonAncestor>();
    if (ids.length === 0) {
        return map;
    }

    // Fetch in chunks of 200 to stay within URL length limits
    for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const p = new URLSearchParams({per_page: "200"});
        chunk.forEach((id) => p.append("id[]", String(id)));
        const res = await fetch(`${BASE_URL}/taxa?${p}`);
        if (!res.ok) {
            continue;
        }
        const data = (await res.json()) as ApiResponse;
        for (const t of data.results) {
            map.set(t.id as number, {
                id: t.id as number,
                name: t.name as string,
                rank: (t.rank as string) ?? "",
                preferred_common_name: (t.preferred_common_name as string) ?? undefined,
            });
        }
    }
    return map;
}

export async function fetchObservations(params: FetchObservationsParams): Promise<FetchObservationsResult> {
    const searchParams = new URLSearchParams({
        quality_grade: "research",
        photos: "true",
        per_page: String(params.per_page ?? 100),
        page: String(params.page ?? 1),
        order: "desc",
        order_by: "observed_on",
    });

    if (params.place_id) {
        searchParams.set("place_id", String(params.place_id));
    } else if (params.lat != null && params.lng != null) {
        searchParams.set("lat", String(params.lat));
        searchParams.set("lng", String(params.lng));
        searchParams.set("radius", String(params.radius ?? 25));
    }

    if (params.taxon_id) {
        searchParams.set("taxon_id", String(params.taxon_id));
    }

    const res = await fetch(`${BASE_URL}/observations?${searchParams}`);
    if (!res.ok) {
        throw new Error(`Observations fetch failed: ${res.status}`);
    }
    const data = (await res.json()) as ApiResponse;

    const observations: Observation[] = data.results.map(mapObservation);

    // Collect all unique ancestor IDs across all observations
    const allAncestorIds = new Set<number>();
    for (const obs of observations) {
        if (obs.taxon?.ancestor_ids) {
            for (const id of obs.taxon.ancestor_ids) {
                allAncestorIds.add(id);
            }
        }
    }

    const taxaMap = await fetchTaxaByIds([...allAncestorIds]);

    // Populate ancestors on each observation's taxon (in ancestor_ids order)
    for (const obs of observations) {
        if (obs.taxon?.ancestor_ids) {
            obs.taxon.ancestors = obs.taxon.ancestor_ids
                .map((id) => taxaMap.get(id))
                .filter((a): a is TaxonAncestor => a != null);
        }
    }

    return {
        observations,
        total_results: data.total_results ?? 0,
        page: data.page ?? params.page ?? 1,
        per_page: data.per_page ?? params.per_page ?? 20,
    };
}

function mapObservation(raw: Record<string, unknown>): Observation {
    const photos = (raw.photos as Record<string, unknown>[]) ?? [];
    const taxon = raw.taxon as Record<string, unknown> | null;
    const user = raw.user as Record<string, unknown> | null;
    return {
        id: raw.id as number,
        photos: photos.map(
            (p): Photo => ({
                id: p.id as number,
                url: p.url as string,
                attribution: (p.attribution as string) ?? "",
                original_dimensions: p.original_dimensions as {width: number; height: number} | undefined,
            }),
        ),
        taxon: taxon
            ? {
                  id: taxon.id as number,
                  name: taxon.name as string,
                  preferred_common_name: (taxon.preferred_common_name as string) ?? undefined,
                  iconic_taxon_name: (taxon.iconic_taxon_name as string) ?? undefined,
                  rank: (taxon.rank as string) ?? "",
                  ancestor_ids: (taxon.ancestor_ids as number[]) ?? undefined,
              }
            : null,
        user: user ? {login: user.login as string, name: (user.name as string) ?? null} : null,
        place_guess: (raw.place_guess as string) ?? null,
        location: (raw.location as string) ?? null,
        observed_on_string: (raw.observed_on_string as string) ?? null,
    };
}
