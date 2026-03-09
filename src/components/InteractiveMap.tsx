import L from "leaflet";
import {useCallback, useEffect, useRef, useState} from "react";
import {Circle, MapContainer, Marker, Rectangle, TileLayer, useMap, useMapEvents} from "react-leaflet";

import type {BoundingBox, Coordinates, MapSelectionMode} from "../types";

interface InteractiveMapProps {
    mode: MapSelectionMode;
    center: Coordinates | null;
    radiusKm: number;
    onCenterChange: (center: Coordinates) => void;
    onRadiusChange: (radiusKm: number) => void;
    bounds: BoundingBox | null;
    onBoundsChange: (bounds: BoundingBox) => void;
    drawingEnabled: boolean;
    onDrawComplete: () => void;
}

const MIN_RADIUS_KM = 5;
const MAX_RADIUS_KM = 1000;

const markerIcon = L.divIcon({
    className: "",
    html: '<div style="width:14px;height:14px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
});

function CircleHandler({onCenterChange}: {onCenterChange: (c: Coordinates) => void}) {
    useMapEvents({
        click(e) {
            onCenterChange({lat: e.latlng.lat, lng: e.latlng.lng});
        },
    });
    return null;
}

function CircleResizeHandler({
    center,
    radiusKm,
    onRadiusChange,
}: {
    center: Coordinates;
    radiusKm: number;
    onRadiusChange: (r: number) => void;
}) {
    const map = useMap();
    const resizing = useRef(false);
    const centerRef = useRef(center);
    const onRadiusChangeRef = useRef(onRadiusChange);

    useEffect(() => {
        centerRef.current = center;
    }, [center]);

    useEffect(() => {
        onRadiusChangeRef.current = onRadiusChange;
    }, [onRadiusChange]);

    const computeRadiusKm = useCallback(
        (clientX: number, clientY: number) => {
            const pt = getContainerPoint(map, clientX, clientY);
            const latlng = map.containerPointToLatLng(pt);
            const centerLatLng = L.latLng(centerRef.current.lat, centerRef.current.lng);
            const distM = centerLatLng.distanceTo(latlng);
            return Math.max(MIN_RADIUS_KM, Math.min(MAX_RADIUS_KM, Math.round(distM / 1000)));
        },
        [map],
    );

    // Attach resize listeners to document so dragging outside the circle still works
    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!resizing.current) {
                return;
            }
            onRadiusChangeRef.current(computeRadiusKm(e.clientX, e.clientY));
        };
        const onMouseUp = () => {
            if (!resizing.current) {
                return;
            }
            resizing.current = false;
            map.dragging.enable();
        };
        const onTouchMove = (e: TouchEvent) => {
            if (!resizing.current) {
                return;
            }
            e.preventDefault();
            const t = e.touches[0];
            onRadiusChangeRef.current(computeRadiusKm(t.clientX, t.clientY));
        };
        const onTouchEnd = () => {
            if (!resizing.current) {
                return;
            }
            resizing.current = false;
            map.dragging.enable();
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        document.addEventListener("touchmove", onTouchMove, {passive: false});
        document.addEventListener("touchend", onTouchEnd);

        return () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.removeEventListener("touchmove", onTouchMove);
            document.removeEventListener("touchend", onTouchEnd);
        };
    }, [map, computeRadiusKm]);

    const startResize = useCallback(() => {
        resizing.current = true;
        map.dragging.disable();
    }, [map]);

    const circleRef = useRef<L.Circle | null>(null);
    const startResizeRef = useRef(startResize);

    useEffect(() => {
        startResizeRef.current = startResize;
    }, [startResize]);

    // Attach native mousedown + touchstart to the SVG element to intercept before Leaflet's drag handler
    useEffect(() => {
        const el = circleRef.current?.getElement() as HTMLElement | undefined;
        if (!el) {
            return;
        }

        const onPointerDown = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            startResizeRef.current();
        };

        el.addEventListener("mousedown", onPointerDown);
        el.addEventListener("touchstart", onPointerDown, {passive: false});
        el.style.cursor = "ew-resize";
        return () => {
            el.removeEventListener("mousedown", onPointerDown);
            el.removeEventListener("touchstart", onPointerDown);
        };
    }, [map]);

    // Invisible wider stroke for easier grabbing
    return (
        <Circle
            ref={circleRef}
            center={[center.lat, center.lng]}
            radius={radiusKm * 1000}
            pathOptions={{color: "transparent", weight: 24, fill: false}}
        />
    );
}

function RectangleHandler({
    drawingEnabled,
    onBoundsChange,
    onDrawComplete,
}: {
    drawingEnabled: boolean;
    onBoundsChange: (b: BoundingBox) => void;
    onDrawComplete: () => void;
}) {
    const map = useMap();
    const drawing = useRef(false);
    const startLatLng = useRef<L.LatLng | null>(null);
    const [preview, setPreview] = useState<L.LatLngBoundsExpression | null>(null);
    const drawingEnabledRef = useRef(drawingEnabled);
    const onBoundsChangeRef = useRef(onBoundsChange);
    const onDrawCompleteRef = useRef(onDrawComplete);

    useEffect(() => {
        drawingEnabledRef.current = drawingEnabled;
    }, [drawingEnabled]);

    useEffect(() => {
        onBoundsChangeRef.current = onBoundsChange;
    }, [onBoundsChange]);

    useEffect(() => {
        onDrawCompleteRef.current = onDrawComplete;
    }, [onDrawComplete]);

    // Disable map dragging (including touch) while draw toggle is on
    useEffect(() => {
        if (drawingEnabled) {
            map.dragging.disable();
        } else {
            map.dragging.enable();
        }
        return () => {
            map.dragging.enable();
        };
    }, [drawingEnabled, map]);

    const startDraw = useCallback(
        (clientX: number, clientY: number, shiftKey: boolean) => {
            if (!drawingEnabledRef.current && !shiftKey) {
                return;
            }
            const containerPoint = getContainerPoint(map, clientX, clientY);
            const latlng = map.containerPointToLatLng(containerPoint);
            drawing.current = true;
            startLatLng.current = latlng;
            if (!drawingEnabledRef.current) {
                // shift+drag: temporarily disable dragging
                map.dragging.disable();
            }
            setPreview(null);
        },
        [map],
    );

    const moveDraw = useCallback(
        (clientX: number, clientY: number) => {
            if (!drawing.current || !startLatLng.current) {
                return;
            }
            const containerPoint = getContainerPoint(map, clientX, clientY);
            const latlng = map.containerPointToLatLng(containerPoint);
            const bounds = L.latLngBounds(startLatLng.current, latlng);
            setPreview(bounds);
        },
        [map],
    );

    const endDraw = useCallback(
        (clientX: number, clientY: number) => {
            if (!drawing.current || !startLatLng.current) {
                return;
            }
            drawing.current = false;
            // Re-enable dragging if it was a shift+drag (toggle wasn't on)
            if (!drawingEnabledRef.current) {
                map.dragging.enable();
            }

            const containerPoint = getContainerPoint(map, clientX, clientY);
            const endLatLng = map.containerPointToLatLng(containerPoint);
            const bounds = L.latLngBounds(startLatLng.current, endLatLng);
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();

            // Ignore tiny drags (likely accidental taps/clicks)
            const pixelStart = map.latLngToContainerPoint(startLatLng.current);
            const dist = pixelStart.distanceTo(containerPoint);
            if (dist < 10) {
                setPreview(null);
                startLatLng.current = null;
                return;
            }

            setPreview(bounds);
            startLatLng.current = null;
            onBoundsChangeRef.current({nelat: ne.lat, nelng: ne.lng, swlat: sw.lat, swlng: sw.lng});
            onDrawCompleteRef.current();
        },
        [map],
    );

    useEffect(() => {
        const container = map.getContainer();

        const onMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) {
                return;
            }
            startDraw(e.clientX, e.clientY, e.shiftKey);
        };
        const onMouseMove = (e: MouseEvent) => moveDraw(e.clientX, e.clientY);
        const onMouseUp = (e: MouseEvent) => endDraw(e.clientX, e.clientY);

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length !== 1) {
                return;
            }
            if (!drawingEnabledRef.current) {
                return;
            }
            e.preventDefault();
            const t = e.touches[0];
            startDraw(t.clientX, t.clientY, false);
        };
        const onTouchMove = (e: TouchEvent) => {
            if (!drawing.current) {
                return;
            }
            e.preventDefault();
            const t = e.touches[0];
            moveDraw(t.clientX, t.clientY);
        };
        const onTouchEnd = (e: TouchEvent) => {
            if (!drawing.current) {
                return;
            }
            const t = e.changedTouches[0];
            endDraw(t.clientX, t.clientY);
        };

        container.addEventListener("mousedown", onMouseDown);
        container.addEventListener("mousemove", onMouseMove);
        container.addEventListener("mouseup", onMouseUp);
        container.addEventListener("touchstart", onTouchStart, {passive: false});
        container.addEventListener("touchmove", onTouchMove, {passive: false});
        container.addEventListener("touchend", onTouchEnd);

        return () => {
            container.removeEventListener("mousedown", onMouseDown);
            container.removeEventListener("mousemove", onMouseMove);
            container.removeEventListener("mouseup", onMouseUp);
            container.removeEventListener("touchstart", onTouchStart);
            container.removeEventListener("touchmove", onTouchMove);
            container.removeEventListener("touchend", onTouchEnd);
        };
    }, [map, startDraw, moveDraw, endDraw]);

    if (!preview) {
        return null;
    }
    return (
        <Rectangle
            bounds={preview}
            pathOptions={{
                color: "#3b82f6",
                weight: 2,
                fillOpacity: 0.15,
            }}
        />
    );
}

function getContainerPoint(map: L.Map, clientX: number, clientY: number): L.Point {
    const rect = map.getContainer().getBoundingClientRect();
    return L.point(clientX - rect.left, clientY - rect.top);
}

function FitToCircle({center, radiusKm}: {center: Coordinates; radiusKm: number}) {
    const map = useMap();
    const prevCenter = useRef<string>("");

    useEffect(() => {
        const key = `${center.lat},${center.lng}`;
        if (key !== prevCenter.current) {
            prevCenter.current = key;
            const bounds = L.latLng(center.lat, center.lng).toBounds(radiusKm * 2000);
            map.fitBounds(bounds, {padding: [20, 20]});
        }
    }, [map, center, radiusKm]);

    return null;
}

function FitToBounds({bounds}: {bounds: BoundingBox}) {
    const map = useMap();
    const prevRef = useRef<string>("");

    useEffect(() => {
        const key = `${bounds.nelat},${bounds.nelng},${bounds.swlat},${bounds.swlng}`;
        if (key !== prevRef.current) {
            prevRef.current = key;
            const leafletBounds = L.latLngBounds([bounds.swlat, bounds.swlng], [bounds.nelat, bounds.nelng]);
            map.fitBounds(leafletBounds, {padding: [20, 20]});
        }
    }, [map, bounds]);

    return null;
}

export function InteractiveMap({
    mode,
    center,
    radiusKm,
    onCenterChange,
    onRadiusChange,
    bounds,
    onBoundsChange,
    drawingEnabled,
    onDrawComplete,
}: InteractiveMapProps) {
    const [mapReady, setMapReady] = useState(false);
    const handleReady = useCallback(() => setMapReady(true), []);

    const useCrosshair = mode === "circle" || (mode === "rectangle" && drawingEnabled);

    return (
        <MapContainer
            center={center ? [center.lat, center.lng] : [20, 0]}
            zoom={center ? 10 : 2}
            className="h-80 sm:h-96 w-full rounded-lg border border-neutral-700"
            style={{cursor: useCrosshair ? "crosshair" : undefined}}
            zoomControl={true}
            attributionControl={false}
            whenReady={handleReady}
        >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />

            {mapReady && mode === "circle" && <CircleHandler onCenterChange={onCenterChange} />}
            {mapReady && mode === "rectangle" && (
                <RectangleHandler
                    drawingEnabled={drawingEnabled}
                    onBoundsChange={onBoundsChange}
                    onDrawComplete={onDrawComplete}
                />
            )}

            {mode === "circle" && center && (
                <>
                    <Marker position={[center.lat, center.lng]} icon={markerIcon} />
                    <Circle
                        center={[center.lat, center.lng]}
                        radius={radiusKm * 1000}
                        pathOptions={{color: "#3b82f6", weight: 2, fillOpacity: 0.15}}
                    />
                    <CircleResizeHandler center={center} radiusKm={radiusKm} onRadiusChange={onRadiusChange} />
                    <FitToCircle center={center} radiusKm={radiusKm} />
                </>
            )}

            {mode === "rectangle" && bounds && (
                <>
                    <Rectangle
                        bounds={[
                            [bounds.swlat, bounds.swlng],
                            [bounds.nelat, bounds.nelng],
                        ]}
                        pathOptions={{color: "#3b82f6", weight: 2, fillOpacity: 0.15}}
                    />
                    <FitToBounds bounds={bounds} />
                </>
            )}
        </MapContainer>
    );
}
