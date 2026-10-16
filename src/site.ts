/** Volley's home page (the /about/ page next to the app), as a full link. Works wherever the app is hosted. */
export const siteUrl = () => new URL('about/', document.baseURI).href

/** Short form for print: "jneyra6.github.io/volley/about". */
export const siteLabel = () => siteUrl().replace(/^https?:\/\//, '').replace(/\/$/, '')

/** Share the home page with another coach: the phone's share sheet, or copy the link. */
export async function shareVolley(): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const url = siteUrl()
  const text = 'Volley: free volleyball rotations and live stats for coaches, with MaxPreps export.'
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Volley', text, url })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
