/**
 * Every image goes through here. In the app and on the dev server a path is
 * just a path. The single-file build defines __ASSETS with every image inlined,
 * and a path resolves to its data URI instead — which is why nothing should
 * build an <img src> by hand.
 */
export const asset = (path) => (globalThis.__ASSETS && globalThis.__ASSETS[path]) || path;
