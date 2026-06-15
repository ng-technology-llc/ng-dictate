# Keep Upstream Mirror Separate From Product Line

We keep `main` as an Upstream Mirror of the original Handy repository and put company-owned functionality, branding, and release decisions on `product/main`. Remote Transcription Provider work is a Product Line capability unless it is accepted upstream, because mixing company changes into the mirror would make upstream updates harder to evaluate and merge.

By default, `product/main` absorbs upstream updates by merging the updated Upstream Mirror. If an upstream change conflicts with the Product Line direction, that merge can be paused and replaced with selective cherry-picks.

The Product Line uses the Company Brand for user-visible product identity. The Handy name and original copyright remain in license and attribution materials, but not as the downstream product's public brand.
