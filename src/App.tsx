import {useState} from "react";

import {LocationPicker} from "./components/LocationPicker";
import {ObservationFeed} from "./components/ObservationFeed";
import type {SearchParams, ViewMode} from "./types";

function App() {
    const [searchParams, setSearchParams] = useState<SearchParams | null>(null);
    const [initialMode, setInitialMode] = useState<ViewMode>("quiz");

    if (searchParams) {
        return (
            <ObservationFeed
                searchParams={searchParams}
                initialMode={initialMode}
                onBack={() => setSearchParams(null)}
            />
        );
    }

    return (
        <LocationPicker
            onSelect={(params, mode) => {
                setInitialMode(mode);
                setSearchParams(params);
            }}
        />
    );
}

export default App;
