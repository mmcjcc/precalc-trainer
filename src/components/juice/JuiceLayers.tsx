import { ConfettiLayer } from './Confetti'
import { MilestoneBanner } from './Milestone'
import { XpFloatLayer } from './XpFloats'

/** The juice drawn over every page (mount once, in the app shell): confetti, the "+10" floats, the milestone banner. */
export function JuiceLayers() {
  return (
    <>
      <XpFloatLayer />
      <ConfettiLayer />
      <MilestoneBanner />
    </>
  )
}
