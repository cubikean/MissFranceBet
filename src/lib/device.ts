// Détections liées au navigateur (sans Firebase, testables).

/**
 * Navigateur intégré d'Instagram, Messenger ou Facebook : Google y refuse la connexion
 * (erreur disallowed_useragent). On invite alors à ouvrir le lien dans Safari ou Chrome.
 */
export function isInAppBrowser(userAgent: string): boolean {
  return /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger/i.test(userAgent)
}

/** true si l'utilisateur a demandé à réduire les animations. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}
