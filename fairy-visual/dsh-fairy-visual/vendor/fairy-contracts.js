// Runtime-free by design. Client plugins must not share mutable browser
// singletons; this package is a place for schemas and test fixtures only.
import clientDomContracts from './client-dom.cjs';

export const { FAIRY_VOICE_CONTROL_ATTRIBUTE } = clientDomContracts;
export const FAIRY_VISUAL_SETTINGS_NAMESPACE = 'fairy-visual';
export const FAIRY_IDENTITY_SETTINGS_NAMESPACE = 'fairy-identity';
export const FAIRY_VISUAL_SETTINGS_VERSION = 2;
export const FAIRY_VISUAL_THEMES = Object.freeze(['dark', 'light']);
export const FAIRY_VISUAL_POWER_MODES = Object.freeze(['normal', 'low-power']);
export const FAIRY_VISUAL_ACTIVITY = Object.freeze(['normal', 'thinking', 'comforting']);
export const FAIRY_VISUAL_LIFECYCLE = Object.freeze(['idle', 'preparing', 'running', 'interrupted', 'completed', 'failed', 'disposed']);
export { FAIRY_LOG_PREFIX, FAIRY_LOG_SCHEMA_VERSION, createFairyDiagnostics, normalizeFairyError } from './diagnostics.js';
