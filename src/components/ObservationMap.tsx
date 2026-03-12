import L from "leaflet";
import {useEffect, useMemo} from "react";
import {Circle, MapContainer, Marker, TileLayer, useMap} from "react-leaflet";

import type {Observation} from "../types";

interface Props {
    observation: Observation;
    className?: string;
}

function parseLocation(location: string): {lat: number; lng: number} | null {
    const parts = location.split(",");
    if (parts.length !== 2) {
        return null;
    }
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lng)) {
        return null;
    }
    return {lat, lng};
}

const blueDot = L.divIcon({
    className: "",
    html: '<div style="width:12px;height:12px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
});

function MapBoundsUpdater({center, radius}: {center: {lat: number; lng: number}; radius?: number}) {
    const map = useMap();

    useEffect(() => {
        if (radius) {
            const bounds = L.latLng(center.lat, center.lng).toBounds(radius * 2);
            map.fitBounds(bounds, {padding: [20, 20]});
        } else {
            map.setView([center.lat, center.lng], 11);
        }
    }, [map, center.lat, center.lng, radius]);

    // Invalidate size and re-fit bounds when the map container becomes visible after being hidden
    useEffect(() => {
        const container = map.getContainer();
        const observer = new ResizeObserver(() => {
            map.invalidateSize();
            if (radius) {
                const bounds = L.latLng(center.lat, center.lng).toBounds(radius * 2);
                map.fitBounds(bounds, {padding: [20, 20]});
            } else {
                map.setView([center.lat, center.lng], 11);
            }
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, [map, center.lat, center.lng, radius]);

    return null;
}

export function ObservationMap({observation, className}: Props) {
    const coords = useMemo(
        () => (observation.location ? parseLocation(observation.location) : null),
        [observation.location],
    );

    if (!coords) {
        return null;
    }

    const isObscured = observation.obscured === true;
    const accuracy = observation.public_positional_accuracy;

    return (
        <MapContainer
            center={[coords.lat, coords.lng]}
            zoom={11}
            className={className ?? "h-48 w-full rounded-lg border border-neutral-700"}
            zoomControl={false}
            attributionControl={false}
        >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
            {isObscured && accuracy ? (
                <Circle
                    center={[coords.lat, coords.lng]}
                    radius={accuracy}
                    pathOptions={{color: "#f59e0b", weight: 2, fillOpacity: 0.15}}
                />
            ) : (
                <Marker position={[coords.lat, coords.lng]} icon={blueDot} />
            )}
            <MapBoundsUpdater center={coords} radius={isObscured && accuracy ? accuracy : undefined} />
        </MapContainer>
    );
}
