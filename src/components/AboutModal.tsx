declare const __COMMIT_HASH__: string;

interface Props {
    onClose: () => void;
}

export function AboutModal({onClose}: Props) {
    const timestamp = new Date().toISOString();
    const commitHash = __COMMIT_HASH__;
    const commitUrl = `https://github.com/naiello/taxon.me/commit/${commitHash}`;

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-lg w-full p-6 text-sm text-neutral-300 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-white font-semibold text-base">About</h2>
                    <button
                        onClick={onClose}
                        className="text-neutral-500 hover:text-white transition-colors cursor-pointer text-xl leading-none"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                <p>
                    <a href="https://taxon.me" className="text-green-400 hover:underline">
                        taxon.me
                    </a>{" "}
                    is an open-source project. You can find the source code{" "}
                    <a
                        href="https://github.com/naiello/taxon.me"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-400 hover:underline"
                    >
                        on GitHub
                    </a>
                    .
                </p>

                <p>
                    This site uses data from{" "}
                    <a
                        href="https://inaturalist.org"
                        target="_blank"
                        rel="noopener"
                        className="text-green-400 hover:underline"
                    >
                        iNaturalist
                    </a>
                    , but it is not affiliated with iNaturalist. If you like this project, consider{" "}
                    <a
                        href="https://www.inaturalist.org/pages/giving"
                        target="_blank"
                        rel="noopener"
                        className="text-green-400 hover:underline"
                    >
                        donating to iNaturalist
                    </a>{" "}
                    to support their work.
                </p>

                <p>
                    This site does not collect or store any user data. This game runs entirely within your browser. If
                    you choose to search using your current location, the webpage will send it to iNaturalist's search
                    function in order to retrieve observations near you, but it will not store or log it. Location
                    permissions are not required to use the website and you may revoke them at any time.
                </p>

                <p>
                    If you find a bug, feel free to{" "}
                    <a
                        href="https://github.com/naiello/taxon.me/issues"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-400 hover:underline"
                    >
                        open an issue on GitHub.
                    </a>{" "}
                    Please include the following information:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>
                        Commit:{" "}
                        <a
                            href={commitUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-green-400 hover:underline"
                        >
                            {commitHash}
                        </a>
                        .
                    </li>
                    <li>
                        Current time: <span className="font-mono">{timestamp}</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}
