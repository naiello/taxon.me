import {useRef, useState} from "react";

import {getPhotoUrl} from "../api/inaturalist";
import type {Photo} from "../types";

interface Props {
    photos: Photo[];
}

export function PhotoCarousel({photos}: Props) {
    const [current, setCurrent] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef(0);
    const touchDeltaX = useRef(0);

    const goTo = (index: number) => {
        setCurrent(Math.max(0, Math.min(index, photos.length - 1)));
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchDeltaX.current = 0;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
    };

    const handleTouchEnd = () => {
        if (Math.abs(touchDeltaX.current) > 50) {
            if (touchDeltaX.current < 0) {
                goTo(current + 1);
            } else {
                goTo(current - 1);
            }
        }
        touchDeltaX.current = 0;
    };

    if (photos.length === 0) {
        return null;
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Photos */}
            <div
                className="flex h-full transition-transform duration-300 ease-out"
                style={{transform: `translateX(-${current * 100}%)`}}
            >
                {photos.map((photo, i) => (
                    <div key={photo.id} className="w-full h-full flex-shrink-0 bg-black">
                        {Math.abs(i - current) <= 1 ? (
                            <img
                                src={getPhotoUrl(photo.url, "large")}
                                alt=""
                                className="w-full h-full object-contain"
                                loading={i === 0 ? "eager" : "lazy"}
                            />
                        ) : (
                            <div className="w-full h-full bg-neutral-900" />
                        )}
                    </div>
                ))}
            </div>

            {/* Arrow buttons (desktop) */}
            {photos.length > 1 && (
                <>
                    {current > 0 && (
                        <button
                            onClick={() => goTo(current - 1)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl backdrop-blur-sm cursor-pointer"
                        >
                            ‹
                        </button>
                    )}
                    {current < photos.length - 1 && (
                        <button
                            onClick={() => goTo(current + 1)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl backdrop-blur-sm cursor-pointer"
                        >
                            ›
                        </button>
                    )}
                </>
            )}

            {/* Dot indicators */}
            {photos.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {photos.map((photo, i) => (
                        <button
                            key={photo.id}
                            onClick={() => goTo(i)}
                            className={`w-2 h-2 rounded-full transition-colors cursor-pointer ${
                                i === current ? "bg-white" : "bg-white/40"
                            }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
