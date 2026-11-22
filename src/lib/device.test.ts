import { describe, expect, it } from 'vitest'
import { isInAppBrowser } from './device'

const UA = {
  safari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  chrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  instagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.25.101 (iPhone15,2; iOS 18_1; fr_FR; fr; scale=3.00; 1179x2556; 659385385)',
  facebook:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/489.0.0.38.107;FBBV/123;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.1;FBSS/3;FBLC/fr_FR]',
  messengerAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36 [FB_IAB/MESSENGER;FBAV/486.0.0.53.109;]',
}

describe('isInAppBrowser', () => {
  it('reconnaît Instagram, Facebook et Messenger', () => {
    expect(isInAppBrowser(UA.instagram)).toBe(true)
    expect(isInAppBrowser(UA.facebook)).toBe(true)
    expect(isInAppBrowser(UA.messengerAndroid)).toBe(true)
  })
  it('laisse Safari et Chrome tranquilles', () => {
    expect(isInAppBrowser(UA.safari)).toBe(false)
    expect(isInAppBrowser(UA.chrome)).toBe(false)
  })
})
