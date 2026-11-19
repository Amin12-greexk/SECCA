'use client';

/**
 * AmbientBlobs — CSS-only floating gradient shapes for background ambiance.
 * GPU-composited, disabled when reduce-motion is enabled per device (lib/motion).
 */
export default function AmbientBlobs() {
    return (
        <div className="ambient-blobs-container" aria-hidden="true">
            <div
                className="ambient-blob ambient-blob-1"
                style={{
                    background: 'radial-gradient(circle, rgba(5,152,51,0.12) 0%, transparent 70%)',
                }}
            />
            <div
                className="ambient-blob ambient-blob-2"
                style={{
                    background: 'radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 70%)',
                }}
            />
            <div
                className="ambient-blob ambient-blob-3"
                style={{
                    background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)',
                }}
            />
        </div>
    );
}
