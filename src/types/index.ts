export interface Photo {
    id: number;
    url: string;
    attribution: string;
    original_dimensions?: {width: number; height: number};
}

export interface TaxonAncestor {
    id: number;
    name: string;
    rank: string;
    preferred_common_name?: string;
}

export interface Taxon {
    id: number;
    name: string;
    preferred_common_name?: string;
    iconic_taxon_name?: string;
    rank: string;
    ancestor_ids?: number[];
    ancestors?: TaxonAncestor[];
}

export type GuessResult = "correct" | "wrong" | "partial";

export interface ObservationUser {
    login: string;
    name: string | null;
}

export interface Observation {
    id: number;
    photos: Photo[];
    taxon: Taxon | null;
    user: ObservationUser | null;
    place_guess: string | null;
    location: string | null;
    observed_on_string: string | null;
}

export interface Place {
    id: number;
    display_name: string;
    admin_level: number | null;
    location: string; // "lat,lng"
    bbox_area?: number;
    has_geometry: boolean;
}

export interface TaxonSuggestion {
    id: number;
    name: string;
    preferred_common_name?: string;
    rank: string;
}

export interface PartialGuessRecord {
    taxon: TaxonSuggestion;
    ancestorIndex: number;
}

export type SearchParams =
    | {type: "place"; place_id: number; place_name: string; taxon_id?: number}
    | {type: "gps"; lat: number; lng: number; radius: number; taxon_id?: number};
