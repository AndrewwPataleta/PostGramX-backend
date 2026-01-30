export function nowMs(): number {
    return Date.now();
}

export function durationMs(startMs: number): number {
    return Date.now() - startMs;
}
