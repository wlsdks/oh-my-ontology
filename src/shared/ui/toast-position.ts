/**
 * Where the toaster stands.
 *
 * Toasts are top-centred (owner, 2026-09-06): the bottom-right corner was behind the
 * agent dock and outside the person's attention, while the map's toolbar at the top
 * centre is where the eye already goes. `ToastProvider` reads
 * `--app-toast-top-offset` (default 16px, the plain edge gap); the map plants this
 * value while mounted so the box clears its toolbar. The toaster is centred on the
 * viewport (owner, 2026-09-07); it no longer shifts left by half of the agent dock's
 * width, which on the Library had stood it over the index column.
 *
 * 24px chrome inset + 36px toolbar tile + 12px breathing room.
 */
export const TOAST_TOP_OFFSET_UNDER_MAP_TOOLBAR_PX = 72;
