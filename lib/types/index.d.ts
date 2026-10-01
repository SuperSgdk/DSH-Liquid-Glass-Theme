/**
 * Host registration for the liquid glass settings card.
 * Modified by SuperSgdk on 2026-10-01. The visual preferences remain in
 * browser storage; the empty Host schema makes the card discoverable.
 */
import type { Context } from '@deepseek-ai/cordis';
import { AQUA_SETTINGS_NAMESPACE } from './settings-namespace.ts';
export declare function apply(ctx: Context): void;
export { AQUA_SETTINGS_NAMESPACE };
