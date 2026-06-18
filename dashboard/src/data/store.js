/* ------------------------------------------------------------------ *
 *  Compat barrel — re-exports the PURE helpers (config, formatters,
 *  date utils). DATA now flows through the async layer:
 *    source/localSource.js  ->  dataset.js  ->  DataContext (useData()).
 *  Components import pure helpers from here and data from useData().
 * ------------------------------------------------------------------ */
export * from './helpers'
