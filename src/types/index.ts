import type {GeoJsonObject} from "geojson";

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
export type GuessRoundOutcome = "correct" | "partial" | "incorrect" | "skipped";
export type AppMode = "browse" | "quiz";

export interface ObservationUser {
    login: string;
    name?: string;
}

export interface Observation {
    id: number;
    photos: Photo[];
    taxon?: Taxon;
    user?: ObservationUser;
    place_guess?: string;
    location?: string;
    observed_on_string?: string;
}

export interface Place {
    id: number;
    display_name: string;
    admin_level?: number;
    location: string; // "lat,lng"
    bbox_area?: number;
    has_geometry: boolean;
    geometry_geojson?: GeoJsonObject;
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

export interface INaturalistUser {
    id: number;
    login: string;
    name?: string;
    icon_url?: string;
    observations_count?: number;
}

export type SearchParams =
    | {type: "place"; place_id: number; place_name: string; taxon_id?: number; user_ids?: number[]}
    | {type: "gps"; lat: number; lng: number; radius: number; taxon_id?: number; user_ids?: number[]}
    | {type: "worldwide"; taxon_id?: number; user_ids?: number[]};
