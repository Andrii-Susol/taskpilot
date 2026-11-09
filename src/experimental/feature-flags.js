// Experimental: in-memory feature flags.
const flags = new Map();
export const setFlag = (name, on) => flags.set(name, Boolean(on));
export const isEnabled = (name) => flags.get(name) === true;
