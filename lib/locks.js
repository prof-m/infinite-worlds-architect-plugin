import path from 'path';

const LOCK_TIMEOUT_MS = 30_000;

/**
 * Promise-chain mutex keyed on resolved draft file paths.
 * Prevents TOCTOU lost-update races when multiple MCP handlers concurrently
 * read → mutate → write the same draft file.
 *
 * Each map entry holds the tail of the promise chain for that path.
 * When the last holder releases, the entry is pruned to avoid unbounded growth.
 * @type {Map<string, Promise<void>>}
 */
const locks = new Map();

/**
 * Acquire an exclusive lock on a draft file path.
 * Returns a release function; call it in a `finally` block.
 *
 * Throws if the previous holder does not release within 30 seconds,
 * which indicates a handler hung or threw before calling its own release.
 *
 * @param {string} draftPath - Absolute or relative path to the draft file
 * @returns {Promise<() => void>} Release function — must be called in `finally`
 */
export async function acquireDraftLock(draftPath) {
    const key = path.resolve(draftPath);

    const prev = locks.get(key) ?? Promise.resolve();

    // Build the new tail of the chain: resolves when this holder calls release().
    let release;
    const acquired = new Promise(r => { release = r; });
    const chain = prev.then(() => acquired);
    locks.set(key, chain);

    // Wait for the previous holder to release, with a diagnostic timeout.
    let timeoutId;
    try {
        await Promise.race([
            prev,
            new Promise((_, reject) => {
                timeoutId = setTimeout(
                    () => reject(new Error(
                        `Draft lock timeout: waited ${LOCK_TIMEOUT_MS / 1000}s to acquire lock ` +
                        `on '${key}'. A handler may have hung without releasing its lock.`
                    )),
                    LOCK_TIMEOUT_MS
                );
            }),
        ]);
    } finally {
        clearTimeout(timeoutId);
    }

    return () => {
        release();
        // Prune the map entry when no further waiter has extended the chain.
        if (locks.get(key) === chain) {
            locks.delete(key);
        }
    };
}
