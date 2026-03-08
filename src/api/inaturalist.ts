import type {GeoJsonObject} from "geojson";

import type {INaturalistUser, Observation, Photo, Place, TaxonAncestor, TaxonSuggestion} from "../types";

const BASE_URL = "https://api.inaturalist.org/v1";
const ALIVE_OR_DEAD_TERM_ID = 17;
const ALIVE_TERM_VALUE_ID = 18;
const EVIDENCE_OF_PRESENCE_TERM_ID = 22;
const ORGANISM_TERM_VALUE_ID = 24;

interface ApiResponse<T> {
    results: T[];
    total_results?: number;
    page?: number;
    per_page?: number;
}

interface ApiPlaceResult {
    id: number;
    display_name: string;
    admin_level?: number;
    location: string;
    bbox_area?: number;
    geometry_geojson?: object;
}

interface ApiTaxonResult {
    id: number;
    name: string;
    preferred_common_name?: string;
    rank: string;
}

interface ApiAnnotation {
    controlled_attribute_id?: number;
    controlled_value_id?: number;
}

interface ApiPhotoResult {
    id: number;
    url: string;
    attribution: string;
    original_dimensions?: {width: number; height: number};
}

interface ApiObservationTaxon extends ApiTaxonResult {
    iconic_taxon_name?: string;
    ancestor_ids?: number[];
}

interface ApiObservationResult {
    id: number;
    photos: ApiPhotoResult[];
    taxon?: ApiObservationTaxon;
    user?: {login: string; name?: string | null};
    place_guess?: string;
    location?: string;
    observed_on_string?: string;
    annotations?: ApiAnnotation[];
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
    const data = (await res.json()) as ApiResponse<ApiPlaceResult>;
    return data.results.map((p) => ({
        id: p.id,
        display_name: p.display_name,
        admin_level: p.admin_level,
        location: p.location ?? "",
        bbox_area: p.bbox_area,
        has_geometry: p.geometry_geojson != null,
        geometry_geojson: p.geometry_geojson as GeoJsonObject | undefined,
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
    const data = (await res.json()) as ApiResponse<ApiTaxonResult>;
    return data.results.map((t) => ({
        id: t.id,
        name: t.name,
        preferred_common_name: t.preferred_common_name,
        rank: t.rank ?? "",
    }));
}

interface ApiUserResult {
    id: number;
    login: string;
    name?: string;
    icon_url?: string;
    observations_count?: number;
}

export async function searchUsers(query: string): Promise<INaturalistUser[]> {
    if (!query.trim()) {
        return [];
    }
    const res = await fetch(`${BASE_URL}/users/autocomplete?q=${encodeURIComponent(query)}&per_page=10`);
    if (!res.ok) {
        throw new Error(`Users search failed: ${res.status}`);
    }
    const data = (await res.json()) as ApiResponse<ApiUserResult>;
    return data.results.map((u) => ({
        id: u.id,
        login: u.login,
        name: u.name ?? undefined,
        icon_url: u.icon_url ?? undefined,
        observations_count: u.observations_count,
    }));
}

interface FetchObservationsParams {
    place_id?: number;
    lat?: number;
    lng?: number;
    radius?: number;
    taxon_id?: number;
    user_id?: string;
    page?: number;
    per_page?: number;
}

interface FetchObservationsResult {
    observations: Observation[];
    total_results: number;
    raw_count: number;
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
        const data = (await res.json()) as ApiResponse<ApiTaxonResult>;
        for (const t of data.results) {
            map.set(t.id, {
                id: t.id,
                name: t.name,
                rank: t.rank ?? "",
                preferred_common_name: t.preferred_common_name,
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
        order_by: "created_at",
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

    if (params.user_id) {
        searchParams.set("user_id", params.user_id);
    }

    const res = await fetch(`${BASE_URL}/observations?${searchParams}`);
    if (!res.ok) {
        throw new Error(`Observations fetch failed: ${res.status}`);
    }
    const data = (await res.json()) as ApiResponse<ApiObservationResult>;

    const liveResults = data.results.filter(
        (raw) =>
            hasAnnotationMatching(raw, ALIVE_OR_DEAD_TERM_ID, isNullOrEqual(ALIVE_TERM_VALUE_ID)) &&
            hasAnnotationMatching(raw, EVIDENCE_OF_PRESENCE_TERM_ID, isNullOrEqual(ORGANISM_TERM_VALUE_ID)),
    );

    const observations: Observation[] = liveResults.map(mapObservation);

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
        raw_count: data.results.length,
        page: data.page ?? params.page ?? 1,
        per_page: data.per_page ?? params.per_page ?? 20,
    };
}

function mapObservation(raw: ApiObservationResult): Observation {
    return {
        id: raw.id,
        photos: (raw.photos ?? []).map(
            (p): Photo => ({
                id: p.id,
                url: p.url,
                attribution: p.attribution ?? "",
                original_dimensions: p.original_dimensions,
            }),
        ),
        taxon: raw.taxon
            ? {
                  id: raw.taxon.id,
                  name: raw.taxon.name,
                  preferred_common_name: raw.taxon.preferred_common_name,
                  iconic_taxon_name: raw.taxon.iconic_taxon_name,
                  rank: raw.taxon.rank ?? "",
                  ancestor_ids: raw.taxon.ancestor_ids,
              }
            : undefined,
        user: raw.user ? {login: raw.user.login, name: raw.user.name ?? undefined} : undefined,
        place_guess: raw.place_guess,
        location: raw.location,
        observed_on_string: raw.observed_on_string,
    };
}

function hasAnnotationMatching(
    observation: ApiObservationResult,
    attr_id: number,
    predicate: (_: number | undefined | null) => boolean,
): boolean {
    const a = observation.annotations?.find((a) => a.controlled_attribute_id === attr_id);
    return predicate(a?.controlled_value_id);
}

function isNullOrEqual(n: number): (_: number | null | undefined) => boolean {
    return (v) => v == null || v == undefined || v == n;
}
