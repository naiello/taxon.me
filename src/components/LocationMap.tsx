import type {GeoJsonObject} from "geojson";
import L from "leaflet";
import {useEffect} from "react";
import {Circle, GeoJSON, MapContainer, TileLayer, useMap} from "react-leaflet";

interface Props {
    geojson?: GeoJsonObject;
    center?: {lat: number; lng: number};
    radiusKm?: number;
}

function MapBoundsUpdater({geojson, center, radiusKm}: Props) {
    const map = useMap();

    useEffect(() => {
        if (geojson) {
            const layer = L.geoJSON(geojson);
            const bounds = layer.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds, {padding: [20, 20]});
            }
        } else if (center) {
            if (radiusKm) {
                const bounds = L.latLng(center.lat, center.lng).toBounds(radiusKm * 2000);
                map.fitBounds(bounds, {padding: [20, 20]});
            } else {
                map.setView([center.lat, center.lng], 10);
            }
        }
    }, [map, geojson, center, radiusKm]);

    return null;
}

export function LocationMap({geojson, center, radiusKm}: Props) {
    const defaultCenter: [number, number] = center ? [center.lat, center.lng] : [0, 0];

    return (
        <MapContainer
            center={defaultCenter}
            zoom={4}
            className="h-72 w-full rounded-lg border border-neutral-700"
            zoomControl={false}
            attributionControl={false}
        >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
            {geojson && (
                <GeoJSON
                    key={JSON.stringify(geojson)}
                    data={geojson}
                    style={{color: "#22c55e", weight: 2, fillOpacity: 0.15}}
                />
            )}
            {!geojson && center && (
                <Circle
                    center={[center.lat, center.lng]}
                    radius={(radiusKm ?? 25) * 1000}
                    pathOptions={{color: "#3b82f6", weight: 2, fillOpacity: 0.15}}
                />
            )}
            <MapBoundsUpdater geojson={geojson} center={center} radiusKm={radiusKm} />
        </MapContainer>
    );
}
