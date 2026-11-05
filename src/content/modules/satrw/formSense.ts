import { registerModule } from '@/content/registry'
import type {
  DifficultyKnobs,
  ModuleDef,
  ProblemInstance,
  ProgressInfo,
  RuleCard,
  RuleCardId,
  SatRwAnswer,
} from '@/content/types'
import type { CalcPanels, ErrorPatternId, GraphSpec, ModuleId } from '@/shared/types'
import { buildSatRwOptions } from './grade'

const GEN_VERSION = 1
const NONE_GRAPH: GraphSpec = { kind: 'none' }
const EMPTY_CALC: CalcPanels = { ti84: [], nspire: [] }

const R_AGREE = 'rc.rw.agree' as RuleCardId
const R_PRONOUN = 'rc.rw.pronoun' as RuleCardId

const RULE_CARDS: RuleCard[] = [
  {
    id: R_AGREE,
    title: 'Subject–verb agreement across interrupting phrases',
    body: 'A verb must agree in number (singular or plural) with its true head subject—never with a noun inside a prepositional phrase or relative clause that comes between the subject and the verb. Mentally cross out the interrupting phrase to test whether the subject is singular or plural.',
  },
  {
    id: R_PRONOUN,
    title: 'Pronoun–antecedent agreement and unambiguous reference',
    body: 'A pronoun must match its antecedent noun in number: use singular "it"/"its" for a singular noun or institution, and plural "they"/"their" for a plural noun. Never confuse the contractions "it\'s" (it is) and "they\'re" (they are) with possessive pronouns, and repeat the noun when two antecedents would make "it" ambiguous.',
  },
]

interface AgreeItem {
  intros: readonly [string, string, string]
  subjectPhrase: string
  headNoun: string
  headNumber: 'singular' | 'plural'
  interrupter: string
  nearbyNoun: string
  verb: {
    sg3: string
    pl: string
    partPast: string
    partPres: string
  }
  predicateRest: string
}

const AGREE_ITEMS: readonly AgreeItem[] = [
  {
    intros: [
      'In the botanical library’s rare-book room,',
      'Preserved in climate-controlled folios since 1890,',
      'Consulted frequently by historians of alpine taxonomy,',
    ],
    subjectPhrase: 'the catalog',
    headNoun: 'catalog',
    headNumber: 'singular',
    interrupter: 'of hand-colored wildflower illustrations',
    nearbyNoun: 'illustrations',
    verb: { sg3: 'reveals', pl: 'reveal', partPast: 'revealed', partPres: 'revealing' },
    predicateRest: 'how nineteenth-century naturalists classified high-altitude plants.',
  },
  {
    intros: [
      'Published in this month’s geophysics journal,',
      'After three years of laboratory calibration,',
      'Combining neutron radiography with X-ray tomography,',
    ],
    subjectPhrase: 'recent analyses',
    headNoun: 'analyses',
    headNumber: 'plural',
    interrupter: 'of the bronze astrolabe recovered from the shipwreck',
    nearbyNoun: 'shipwreck',
    verb: { sg3: 'confirms', pl: 'confirm', partPast: 'confirmed', partPres: 'confirming' },
    predicateRest: 'that the instrument tracked both solar and lunar cycles.',
  },
  {
    intros: [
      'Across the tidal marshes of the Chesapeake bay,',
      'During the late-summer migration along the Atlantic flyway,',
      'According to forty years of coastal Audubon surveys,',
    ],
    subjectPhrase: 'the presence',
    headNoun: 'presence',
    headNumber: 'singular',
    interrupter: 'of dense cordgrass meadows and shallow mudflats',
    nearbyNoun: 'mudflats',
    verb: { sg3: 'protects', pl: 'protect', partPast: 'protected', partPres: 'protecting' },
    predicateRest: 'nesting shorebirds from storm surges and strong tides.',
  },
  {
    intros: [
      'In the museum’s textile conservation studio,',
      'Under low-intensity fiber-optic illumination,',
      'Compiled before the tapestry was mounted for exhibition,',
    ],
    subjectPhrase: 'microscopic photographs',
    headNoun: 'photographs',
    headNumber: 'plural',
    interrupter: 'of each silver-wrapped silk thread in the border',
    nearbyNoun: 'border',
    verb: { sg3: 'shows', pl: 'show', partPast: 'shown', partPres: 'showing' },
    predicateRest: 'where natural madder dye has faded over four centuries.',
  },
  {
    intros: [
      'In classical orchestral halls with high plaster ceilings,',
      'As acoustic models of rectangular concert rooms demonstrate,',
      'Even when every seat in the auditorium is filled,',
    ],
    subjectPhrase: 'the arrangement',
    headNoun: 'arrangement',
    headNumber: 'singular',
    interrupter: 'of carved wooden balconies and side niches',
    nearbyNoun: 'niches',
    verb: { sg3: 'scatters', pl: 'scatter', partPast: 'scattered', partPres: 'scattering' },
    predicateRest: 'high-frequency sound waves evenly toward the rear rows.',
  },
  {
    intros: [
      'Along the windward slopes of the Cascade Range,',
      'Collected from twenty weather stations above five thousand feet,',
      'Spanning more than six decades of winter observations,',
    ],
    subjectPhrase: 'measurements',
    headNoun: 'measurements',
    headNumber: 'plural',
    interrupter: 'of the spring snowpack in the upper basin',
    nearbyNoun: 'basin',
    verb: { sg3: 'indicates', pl: 'indicate', partPast: 'indicated', partPres: 'indicating' },
    predicateRest: 'when mountain reservoirs will reach peak capacity.',
  },
  {
    intros: [
      'In the monastery scriptorium at Lindisfarne,',
      'Surviving on calfskin parchment for over a millennium,',
      'Examined with non-invasive Raman spectroscopy,',
    ],
    subjectPhrase: 'the blend',
    headNoun: 'blend',
    headNumber: 'singular',
    interrupter: 'of crushed lapis lazuli and local mineral pigments',
    nearbyNoun: 'pigments',
    verb: { sg3: 'retains', pl: 'retain', partPast: 'retained', partPres: 'retaining' },
    predicateRest: 'its vivid ultramarine luster without flaking.',
  },
  {
    intros: [
      'In early Renaissance treatises on perspective,',
      'Drawn with a straightedge and a pair of brass dividers,',
      'Preserved in the workshop notebooks of Florentine architects,',
    ],
    subjectPhrase: 'diagrams',
    headNoun: 'diagrams',
    headNumber: 'plural',
    interrupter: 'of a vaulted octagonal baptistery ceiling',
    nearbyNoun: 'ceiling',
    verb: { sg3: 'illustrates', pl: 'illustrate', partPast: 'illustrated', partPres: 'illustrating' },
    predicateRest: 'how receding lines converge at a single vanishing point.',
  },
  {
    intros: [
      'Beneath the granite cobblestones of the old market square,',
      'Uncovered when crews repaired the nineteenth-century water main,',
      'Mapped by ground-penetrating radar last autumn,',
    ],
    subjectPhrase: 'a network',
    headNoun: 'network',
    headNumber: 'singular',
    interrupter: 'of terracotta drainage pipes and stone cisterns',
    nearbyNoun: 'cisterns',
    verb: { sg3: 'channels', pl: 'channel', partPast: 'channeled', partPres: 'channeling' },
    predicateRest: 'stormwater away from the cathedral foundations.',
  },
  {
    intros: [
      'In cold subarctic bogs where oxygen levels stay low,',
      'Extracted from three meters beneath the sphagnum moss,',
      'Analyzed by palynologists studying post-glacial forests,',
    ],
    subjectPhrase: 'core samples',
    headNoun: 'samples',
    headNumber: 'plural',
    interrupter: 'of the ancient peat deposit near the lake',
    nearbyNoun: 'lake',
    verb: { sg3: 'preserves', pl: 'preserve', partPast: 'preserved', partPres: 'preserving' },
    predicateRest: 'birch and pine pollen grains in remarkable detail.',
  },
  {
    intros: [
      'Inside the horological gallery of the maritime museum,',
      'Designed by John Harrison to withstand rolling ocean swells,',
      'Tested on two transatlantic voyages in the 1760s,',
    ],
    subjectPhrase: 'the mechanism',
    headNoun: 'mechanism',
    headNumber: 'singular',
    interrupter: 'of counterbalanced brass springs and jeweled bearings',
    nearbyNoun: 'bearings',
    verb: { sg3: 'compensates', pl: 'compensate', partPast: 'compensated', partPres: 'compensating' },
    predicateRest: 'for sudden changes in shipboard temperature.',
  },
  {
    intros: [
      'In the municipal archive’s cartographic collection,',
      'Engraved on copperplates before the canal was widened,',
      'Compared side by side with modern satellite imagery,',
    ],
    subjectPhrase: 'seventeenth-century maps',
    headNoun: 'maps',
    headNumber: 'plural',
    interrupter: 'of the meandering river delta',
    nearbyNoun: 'delta',
    verb: { sg3: 'documents', pl: 'document', partPast: 'documented', partPres: 'documenting' },
    predicateRest: 'how winter floods shifted the main navigation channel.',
  },
  {
    intros: [
      'In high-elevation bristlecone pine groves,',
      'Because arid mountain air slows wood decay for millennia,',
      'Cross-dated by dendrochronologists at the tree-ring laboratory,',
    ],
    subjectPhrase: 'the sequence',
    headNoun: 'sequence',
    headNumber: 'singular',
    interrupter: 'of narrow frost rings and wide summer growth bands',
    nearbyNoun: 'bands',
    verb: { sg3: 'records', pl: 'record', partPast: 'recorded', partPres: 'recording' },
    predicateRest: 'volcanic cooling events from the Bronze Age.',
  },
  {
    intros: [
      'During the restoration of the civic opera house,',
      'Discovered inside a sealed tin box behind the proscenium arch,',
      'Written in violet ink by the company’s first stage manager,',
    ],
    subjectPhrase: 'rehearsal notes',
    headNoun: 'notes',
    headNumber: 'plural',
    interrupter: 'for the opening-night performance of the symphony',
    nearbyNoun: 'symphony',
    verb: { sg3: 'describes', pl: 'describe', partPast: 'described', partPres: 'describing' },
    predicateRest: 'how offstage brass instruments were positioned in the balcony.',
  },
  {
    intros: [
      'In desert glassblowing workshops of the Roman Levant,',
      'Melted in wood-fired tank furnaces along the coast,',
      'As chemical trace-element profiles of museum shards show,',
    ],
    subjectPhrase: 'the addition',
    headNoun: 'addition',
    headNumber: 'singular',
    interrupter: 'of manganese oxides and crushed shells',
    nearbyNoun: 'shells',
    verb: { sg3: 'neutralizes', pl: 'neutralize', partPast: 'neutralized', partPres: 'neutralizing' },
    predicateRest: 'the greenish tint caused by iron impurities in the sand.',
  },
  {
    intros: [
      'In tropical canopy walkways suspended forty meters above the ground,',
      'Triggered automatically whenever a pollinator visits an orchid,',
      'Operating continuously throughout the rainy season,',
    ],
    subjectPhrase: 'infrared cameras',
    headNoun: 'cameras',
    headNumber: 'plural',
    interrupter: 'mounted along the emergent kapok tree',
    nearbyNoun: 'tree',
    verb: { sg3: 'captures', pl: 'capture', partPast: 'captured', partPres: 'capturing' },
    predicateRest: 'nocturnal hawkmoths hovering at the blossoms.',
  },
  {
    intros: [
      'In the ceramics studio at the art institute,',
      'Applied before the stoneware bowls enter the reduction kiln,',
      'Formulated from wood ash and local river clay,',
    ],
    subjectPhrase: 'a suspension',
    headNoun: 'suspension',
    headNumber: 'singular',
    interrupter: 'of finely ground feldspars and iron oxides',
    nearbyNoun: 'oxides',
    verb: { sg3: 'produces', pl: 'produce', partPast: 'produced', partPres: 'producing' },
    predicateRest: 'a warm celadon glaze when fired in a low-oxygen atmosphere.',
  },
  {
    intros: [
      'Across the limestone plateau of southern France,',
      'Protected from surface weathering by stable cave humidity,',
      'Dated by uranium-thorium analysis of overlying calcite crusts,',
    ],
    subjectPhrase: 'charcoal drawings',
    headNoun: 'drawings',
    headNumber: 'plural',
    interrupter: 'on the recessed ceiling of the cavern',
    nearbyNoun: 'cavern',
    verb: { sg3: 'depicts', pl: 'depict', partPast: 'depicted', partPres: 'depicting' },
    predicateRest: 'herds of steppe bison and wild horses in motion.',
  },
  {
    intros: [
      'In modern wind-tunnel tests of bird flight,',
      'Measured with high-speed particle image velocimetry,',
      'When a swift glides through turbulent air currents,',
    ],
    subjectPhrase: 'the curvature',
    headNoun: 'curvature',
    headNumber: 'singular',
    interrupter: 'of the primary wing feathers and wingtip slots',
    nearbyNoun: 'slots',
    verb: { sg3: 'reduces', pl: 'reduce', partPast: 'reduced', partPres: 'reducing' },
    predicateRest: 'aerodynamic drag during steep turns.',
  },
  {
    intros: [
      'In the university’s papyrology seminar,',
      'Pieced together from fragments found in an Egyptian granary,',
      'Translated by graduate students last semester,',
    ],
    subjectPhrase: 'receipts',
    headNoun: 'receipts',
    headNumber: 'plural',
    interrupter: 'from the provincial grain warehouse on the Nile',
    nearbyNoun: 'Nile',
    verb: { sg3: 'lists', pl: 'list', partPast: 'listed', partPres: 'listing' },
    predicateRest: 'barley rations paid to canal maintenance crews.',
  },
]

interface PronounItem {
  intros: readonly [string, string, string]
  kind: 'sg-poss' | 'pl-poss' | 'two-nouns'
  clauseBeforeBlank: string
  clauseAfterBlank: string
  antecedent: string
  distractorNoun: string
  rightText: string
  wrongNumberText: string
  wrongNumberNudge: string
  wrongAmbig1Text: string
  wrongAmbig1Nudge: string
  wrongAmbig2Text: string
  wrongAmbig2Nudge: string
  revealExplain: string
}

const PRONOUN_ITEMS: readonly PronounItem[] = [
  {
    intros: [
      'During the summer acoustic renovation,',
      'Before the autumn chamber music festival began,',
      'Funded by a municipal historic-preservation grant,',
    ],
    kind: 'sg-poss',
    clauseBeforeBlank: 'when the regional conservatory refurbished the recital rooms, ______',
    clauseAfterBlank: 'pine soundboards were resealed with natural oil varnish.',
    antecedent: 'the regional conservatory',
    distractorNoun: 'the recital rooms',
    rightText: 'its',
    wrongNumberText: 'their',
    wrongNumberNudge: '"Their" is plural, but the owner of the soundboards is the singular noun "the regional conservatory".',
    wrongAmbig1Text: "it's",
    wrongAmbig1Nudge: '"It\'s" is the contraction for "it is" or "it has", not the singular possessive pronoun "its".',
    wrongAmbig2Text: "one's",
    wrongAmbig2Nudge: '"One\'s" refers to an unnamed generic person rather than the specific institution "the regional conservatory".',
    revealExplain: 'The singular noun phrase "the regional conservatory" requires the singular possessive pronoun "its".',
  },
  {
    intros: [
      'In high-altitude fog zones of the coastal mountains,',
      'Unlike vascular plants that draw water through deep roots,',
      'Studied by ecologists as bioindicators of clean air,',
    ],
    kind: 'pl-poss',
    clauseBeforeBlank: 'because alpine lichens absorb moisture directly from passing clouds, ______',
    clauseAfterBlank: 'delicate tissues react quickly to airborne sulfur compounds.',
    antecedent: 'alpine lichens',
    distractorNoun: 'moisture',
    rightText: 'their',
    wrongNumberText: 'its',
    wrongNumberNudge: '"Its" is singular, but the antecedent is the plural noun phrase "alpine lichens".',
    wrongAmbig1Text: "they're",
    wrongAmbig1Nudge: '"They\'re" is the contraction for "they are", not the plural possessive pronoun "their".',
    wrongAmbig2Text: "one's",
    wrongAmbig2Nudge: '"One\'s" is a singular generic pronoun and does not match the plural antecedent "alpine lichens".',
    revealExplain: 'The plural subject "alpine lichens" requires the plural possessive pronoun "their".',
  },
  {
    intros: [
      'In the museum’s imaging laboratory,',
      'Before the Renaissance exhibition catalog went to press,',
      'Using infrared reflectography to peer beneath surface varnish,',
    ],
    kind: 'two-nouns',
    clauseBeforeBlank: 'when the conservators compared the oil portrait with the charcoal sketch, ______',
    clauseAfterBlank: 'revealed faint perspective grid lines beneath the pigment.',
    antecedent: 'the oil portrait',
    distractorNoun: 'the charcoal sketch',
    rightText: 'the portrait',
    wrongNumberText: 'they',
    wrongNumberNudge: '"They" is plural, whereas only the single painted work had grid lines beneath its pigment.',
    wrongAmbig1Text: 'it',
    wrongAmbig1Nudge: 'Because both "the oil portrait" and "the charcoal sketch" are singular nouns, the bare pronoun "it" is ambiguous.',
    wrongAmbig2Text: 'that work',
    wrongAmbig2Nudge: '"That work" still leaves unclear whether the oil portrait or the charcoal sketch contained the grid lines.',
    revealExplain: 'Because two singular artworks are mentioned ("the oil portrait" and "the charcoal sketch"), repeating "the portrait" removes ambiguity.',
  },
  {
    intros: [
      'After five years of continuous orbital operation,',
      'Following a scheduled software update from ground control,',
      'To calibrate the onboard infrared spectrometers,',
    ],
    kind: 'sg-poss',
    clauseBeforeBlank: 'although the solar observatory tracked dozens of coronal loops, ______',
    clauseAfterBlank: 'primary mirror remained shielded behind a carbon-fiber sunshade.',
    antecedent: 'the solar observatory',
    distractorNoun: 'coronal loops',
    rightText: 'its',
    wrongNumberText: 'their',
    wrongNumberNudge: '"Their" is plural (matching nearby "coronal loops"), but the mirror belongs to the singular noun "the solar observatory".',
    wrongAmbig1Text: "it's",
    wrongAmbig1Nudge: '"It\'s" is the contraction for "it is", whereas the sentence needs the possessive determiner "its".',
    wrongAmbig2Text: 'that',
    wrongAmbig2Nudge: '"That" does not express possession linking the primary mirror back to "the solar observatory".',
    revealExplain: 'The singular antecedent "the solar observatory" owns the primary mirror, so singular possessive "its" is required.',
  },
  {
    intros: [
      'Along the rocky headlands of the North Atlantic,',
      'Returning to the same cliffside burrows each May,',
      'Observed by seabird researchers on Machias Seal Island,',
    ],
    kind: 'pl-poss',
    clauseBeforeBlank: 'when Atlantic puffins dive into cold coastal currents for sand eels, ______',
    clauseAfterBlank: 'short wings beat underwater like flippers.',
    antecedent: 'Atlantic puffins',
    distractorNoun: 'each May',
    rightText: 'their',
    wrongNumberText: 'its',
    wrongNumberNudge: '"Its" is singular, but the antecedent is the plural noun phrase "Atlantic puffins".',
    wrongAmbig1Text: "they're",
    wrongAmbig1Nudge: '"They\'re" means "they are", which creates a grammatical error before the noun phrase "short wings".',
    wrongAmbig2Text: 'his or her',
    wrongAmbig2Nudge: '"His or her" is singular and person-specific, mismatching the plural animal noun "Atlantic puffins".',
    revealExplain: 'The plural antecedent "Atlantic puffins" requires the plural possessive pronoun "their".',
  },
  {
    intros: [
      'During the pre-concert sound check in the chapel,',
      'While the luthier adjusted the soundpost in the greenroom,',
      'Testing how the two Baroque instruments projected in the hall,',
    ],
    kind: 'two-nouns',
    clauseBeforeBlank: 'although the cellist tuned the baroque cello beside the viola da gamba, ______',
    clauseAfterBlank: 'needed a fresh gut C-string before the downbeat.',
    antecedent: 'the baroque cello',
    distractorNoun: 'the viola da gamba',
    rightText: 'the cello',
    wrongNumberText: 'they',
    wrongNumberNudge: '"They" is plural, but the phrase "a fresh gut C-string" indicates that a single instrument needed the string.',
    wrongAmbig1Text: 'it',
    wrongAmbig1Nudge: 'With two singular instruments ("the baroque cello" and "the viola da gamba"), "it" leaves unclear which one needed the string.',
    wrongAmbig2Text: 'this instrument',
    wrongAmbig2Nudge: '"This instrument" is still ambiguous because two singular instruments were just named.',
    revealExplain: 'Repeating the specific noun "the cello" makes clear which of the two singular instruments needed the string.',
  },
  {
    intros: [
      'Founded in Florence during the fourteenth century,',
      'According to tax rolls preserved in the municipal archive,',
      'Regulating dye quality across dozens of neighborhood workshops,',
    ],
    kind: 'sg-poss',
    clauseBeforeBlank: 'before the wool-weavers’ guild approved imported bolts of cloth, ______',
    clauseAfterBlank: 'inspectors stamped a lead seal onto the selvage edge.',
    antecedent: 'the wool-weavers’ guild',
    distractorNoun: 'bolts of cloth',
    rightText: 'its',
    wrongNumberText: 'their',
    wrongNumberNudge: '"Their" is plural, but "the wool-weavers\' guild" is a single collective institution acting as a unit.',
    wrongAmbig1Text: "it's",
    wrongAmbig1Nudge: '"It\'s" is a contraction for "it is", not the possessive pronoun needed before "inspectors".',
    wrongAmbig2Text: "one's",
    wrongAmbig2Nudge: '"One\'s" is a generic personal pronoun and cannot refer back to "the wool-weavers\' guild".',
    revealExplain: 'Collective institutions like "the wool-weavers\' guild" take the singular possessive pronoun "its" in Standard English.',
  },
  {
    intros: [
      'In arid canyons of the American Southwest,',
      'Opening their white funnel-shaped corollas only after dusk,',
      'Pollinated by nocturnal bats and sphinx moths,',
    ],
    kind: 'pl-poss',
    clauseBeforeBlank: 'after saguaro cacti store rainwater from brief summer monsoons, ______',
    clauseAfterBlank: 'pleated ribs expand like the folds of an accordion.',
    antecedent: 'saguaro cacti',
    distractorNoun: 'rainwater',
    rightText: 'their',
    wrongNumberText: 'its',
    wrongNumberNudge: '"Its" is singular, which mismatches the plural subject "saguaro cacti".',
    wrongAmbig1Text: "they're",
    wrongAmbig1Nudge: '"They\'re" is the contraction "they are", not the possessive determiner "their".',
    wrongAmbig2Text: 'those',
    wrongAmbig2Nudge: '"Those" is a demonstrative determiner that fails to link the pleated ribs back to "saguaro cacti" as their owner.',
    revealExplain: 'Because "saguaro cacti" is plural, the plural possessive pronoun "their" is required.',
  },
  {
    intros: [
      'In the rare-manuscript vault of the state library,',
      'Resting on acid-free linen cushions for the visiting scholars,',
      'Cataloged side by side after the estate donation,',
    ],
    kind: 'two-nouns',
    clauseBeforeBlank: 'when the archivist placed the royal charter beside the parish register, ______',
    clauseAfterBlank: 'still bore an unbroken red wax seal on a silk ribbon.',
    antecedent: 'the royal charter',
    distractorNoun: 'the parish register',
    rightText: 'the charter',
    wrongNumberText: 'they',
    wrongNumberNudge: '"They" is plural, whereas "an unbroken red wax seal" belongs to a single document.',
    wrongAmbig1Text: 'it',
    wrongAmbig1Nudge: 'Because both "the royal charter" and "the parish register" are singular documents, "it" is ambiguous.',
    wrongAmbig2Text: 'that document',
    wrongAmbig2Nudge: '"That document" does not specify whether the charter or the register bore the wax seal.',
    revealExplain: 'Naming "the charter" directly resolves the ambiguity between the two singular documents.',
  },
  {
    intros: [
      'During the winter residency at the glassworks,',
      'Operating three electric annealing ovens in the studio,',
      'Known for supporting emerging ceramic and glass artists,',
    ],
    kind: 'sg-poss',
    clauseBeforeBlank: 'when the craft cooperative redesigned the exhibition gallery, ______',
    clauseAfterBlank: 'skylights were fitted with ultraviolet-filtering panes.',
    antecedent: 'the craft cooperative',
    distractorNoun: 'emerging artists',
    rightText: 'its',
    wrongNumberText: 'their',
    wrongNumberNudge: '"Their" is plural, but "the craft cooperative" and "the exhibition gallery" are both singular.',
    wrongAmbig1Text: "it's",
    wrongAmbig1Nudge: '"It\'s" means "it is", not the possessive pronoun "its".',
    wrongAmbig2Text: "one's",
    wrongAmbig2Nudge: '"One\'s" refers to a generic person rather than the singular cooperative or gallery.',
    revealExplain: 'The singular noun requires the singular possessive pronoun "its".',
  },
  {
    intros: [
      'In temperate kelp forests along the Pacific coast,',
      'Anchored to rocky reefs by rootlike structures called holdfasts,',
      'Growing up to two feet per day in nutrient-rich upwellings,',
    ],
    kind: 'pl-poss',
    clauseBeforeBlank: 'because giant kelp fronds contain gas-filled bladders at the base of each blade, ______',
    clauseAfterBlank: 'leafy canopies float upright toward the sunlit surface.',
    antecedent: 'giant kelp fronds',
    distractorNoun: 'each blade',
    rightText: 'their',
    wrongNumberText: 'its',
    wrongNumberNudge: '"Its" is singular (matching nearby "each blade"), but the canopies belong to the plural subject "giant kelp fronds".',
    wrongAmbig1Text: "they're",
    wrongAmbig1Nudge: '"They\'re" is the contraction "they are", not the possessive pronoun "their".',
    wrongAmbig2Text: "one's",
    wrongAmbig2Nudge: '"One\'s" is a singular personal pronoun and cannot refer to "giant kelp fronds".',
    revealExplain: 'The plural subject "giant kelp fronds" requires the plural possessive pronoun "their".',
  },
  {
    intros: [
      'At the high-altitude physics station in the Alps,',
      'Calibrated before the winter atmospheric campaign,',
      'Mounted on the same stabilized aluminum platform,',
    ],
    kind: 'two-nouns',
    clauseBeforeBlank: 'although the lidar receiver operated alongside the radar dish all night, ______',
    clauseAfterBlank: 'required a replacement cooling fan before sunrise.',
    antecedent: 'the lidar receiver',
    distractorNoun: 'the radar dish',
    rightText: 'the receiver',
    wrongNumberText: 'they',
    wrongNumberNudge: '"They" is plural, but "a replacement cooling fan" indicates that one specific instrument needed the part.',
    wrongAmbig1Text: 'it',
    wrongAmbig1Nudge: 'Because "the lidar receiver" and "the radar dish" are both singular nouns, "it" could refer to either instrument.',
    wrongAmbig2Text: 'that unit',
    wrongAmbig2Nudge: '"That unit" remains ambiguous because two singular instruments were just mentioned.',
    revealExplain: 'Repeating "the receiver" specifies which of the two singular instruments needed the cooling fan.',
  },
  {
    intros: [
      'In the harbor town’s nineteenth-century customs house,',
      'After digitizing twelve thousand immigration ledger pages,',
      'Open to genealogists and maritime historians on weekdays,',
    ],
    kind: 'sg-poss',
    clauseBeforeBlank: 'when the maritime museum expanded the reading room, ______',
    clauseAfterBlank: 'microfilm machines were replaced with high-resolution scanners.',
    antecedent: 'the maritime museum',
    distractorNoun: 'ledger pages',
    rightText: 'its',
    wrongNumberText: 'their',
    wrongNumberNudge: '"Their" is plural, but the antecedent "the maritime museum" (and "the reading room") is singular.',
    wrongAmbig1Text: "it's",
    wrongAmbig1Nudge: '"It\'s" is the contraction for "it is", not the possessive pronoun "its".',
    wrongAmbig2Text: 'your',
    wrongAmbig2Nudge: '"Your" shifts to the second person instead of referring to the third-person singular museum.',
    revealExplain: 'The singular antecedent "the maritime museum" takes the singular possessive pronoun "its".',
  },
  {
    intros: [
      'In sixteenth-century Venetian printing houses,',
      'Working beside wooden composing cases sorted by letter frequency,',
      'Before locking the inked metal forms into the bed of the press,',
    ],
    kind: 'pl-poss',
    clauseBeforeBlank: 'when Renaissance typesetters assembled lines of movable metal type, ______',
    clauseAfterBlank: 'composing sticks held each word upside down and in reverse.',
    antecedent: 'Renaissance typesetters',
    distractorNoun: 'movable metal type',
    rightText: 'their',
    wrongNumberText: 'its',
    wrongNumberNudge: '"Its" is singular (matching nearby "type"), but the composing sticks belonged to the plural subject "Renaissance typesetters".',
    wrongAmbig1Text: "they're",
    wrongAmbig1Nudge: '"They\'re" is the contraction "they are", not the possessive pronoun "their".',
    wrongAmbig2Text: 'his',
    wrongAmbig2Nudge: '"His" is singular, which mismatches the plural antecedent "Renaissance typesetters".',
    revealExplain: 'The plural antecedent "Renaissance typesetters" requires the plural possessive pronoun "their".',
  },
  {
    intros: [
      'In the university’s botanical conservatory,',
      'Watered with rainwater collected from the glass roof,',
      'Planted in adjacent cedar tubs in the subtropical wing,',
    ],
    kind: 'two-nouns',
    clauseBeforeBlank: 'even though the dwarf pomegranate received the same sunlight as the Meyer lemon, ______',
    clauseAfterBlank: 'produced blossoms three weeks earlier in the spring.',
    antecedent: 'the dwarf pomegranate',
    distractorNoun: 'the Meyer lemon',
    rightText: 'the pomegranate',
    wrongNumberText: 'they',
    wrongNumberNudge: '"They" is plural, which contradicts the comparison showing that one tree bloomed earlier than the other.',
    wrongAmbig1Text: 'it',
    wrongAmbig1Nudge: 'Because both "the dwarf pomegranate" and "the Meyer lemon" are singular, the pronoun "it" is ambiguous.',
    wrongAmbig2Text: 'this tree',
    wrongAmbig2Nudge: '"This tree" does not clarify whether the pomegranate or the lemon bloomed first.',
    revealExplain: 'Repeating "the pomegranate" makes clear which of the two singular trees bloomed three weeks earlier.',
  },
  {
    intros: [
      'Established along the fall line of the river in 1824,',
      'Powered originally by a thirty-foot breastshot waterwheel,',
      'After converting the brick spinning sheds into classrooms,',
    ],
    kind: 'sg-poss',
    clauseBeforeBlank: 'although the textile mill sold the surrounding pastures, ______',
    clauseAfterBlank: 'granite dam remained in place to regulate river levels.',
    antecedent: 'the textile mill',
    distractorNoun: 'the surrounding pastures',
    rightText: 'its',
    wrongNumberText: 'their',
    wrongNumberNudge: '"Their" is plural (matching nearby "pastures"), but the dam belonged to the singular noun "the textile mill".',
    wrongAmbig1Text: "it's",
    wrongAmbig1Nudge: '"It\'s" is the contraction "it is", not the possessive pronoun "its".',
    wrongAmbig2Text: "one's",
    wrongAmbig2Nudge: '"One\'s" is a generic human possessive and cannot refer to "the textile mill".',
    revealExplain: 'The singular noun "the textile mill" requires the singular possessive pronoun "its".',
  },
  {
    intros: [
      'In subterranean limestone caverns of the Ozarks,',
      'Living in perpetual darkness where green plants cannot grow,',
      'Studied by evolutionary biologists for their sensory adaptations,',
    ],
    kind: 'pl-poss',
    clauseBeforeBlank: 'because blind cavefish navigate muddy currents without functional eyes, ______',
    clauseAfterBlank: 'lateral-line organs detect minute pressure ripples in the water.',
    antecedent: 'blind cavefish',
    distractorNoun: 'perpetual darkness',
    rightText: 'their',
    wrongNumberText: 'its',
    wrongNumberNudge: '"Its" is singular, whereas "blind cavefish" (with plural verb "navigate") is plural.',
    wrongAmbig1Text: "they're",
    wrongAmbig1Nudge: '"They\'re" is the contraction for "they are", not the possessive pronoun "their".',
    wrongAmbig2Text: 'your',
    wrongAmbig2Nudge: '"Your" shifts to the second person instead of matching the third-person plural noun "blind cavefish".',
    revealExplain: 'The plural clause "blind cavefish navigate" establishes a plural antecedent, requiring "their".',
  },
  {
    intros: [
      'During the archaeological survey of the Roman villa,',
      'Cleaned with soft bamboo picks in the field tent,',
      'Found in the same collapsed storage jar near the courtyard,',
    ],
    kind: 'two-nouns',
    clauseBeforeBlank: 'when the ceramicist examined the terracotta oil lamp alongside the glass unguent bottle, ______',
    clauseAfterBlank: 'displayed a maker’s stamp pressed into the base.',
    antecedent: 'the terracotta oil lamp',
    distractorNoun: 'the glass unguent bottle',
    rightText: 'the lamp',
    wrongNumberText: 'they',
    wrongNumberNudge: '"They" is plural, whereas "a maker\'s stamp" on "the base" refers to one specific vessel.',
    wrongAmbig1Text: 'it',
    wrongAmbig1Nudge: 'With two singular artifacts ("the terracotta oil lamp" and "the glass unguent bottle"), "it" is ambiguous.',
    wrongAmbig2Text: 'that vessel',
    wrongAmbig2Nudge: '"That vessel" leaves unclear whether the terracotta lamp or the glass bottle carried the stamp.',
    revealExplain: 'Naming "the lamp" removes the ambiguity between the two singular artifacts.',
  },
  {
    intros: [
      'In the northern reaches of the boreal forest,',
      'Monitored by satellite altimetry since the late 1990s,',
      'Feeding meltwater into three major river valleys,',
    ],
    kind: 'sg-poss',
    clauseBeforeBlank: 'as the valley glacier retreated past the terminal moraine boulders, ______',
    clauseAfterBlank: 'meltwater stream carved a new channel through the gravel flat.',
    antecedent: 'the valley glacier',
    distractorNoun: 'moraine boulders',
    rightText: 'its',
    wrongNumberText: 'their',
    wrongNumberNudge: '"Their" is plural (matching nearby "boulders"), but the stream belongs to the singular noun "the valley glacier".',
    wrongAmbig1Text: "it's",
    wrongAmbig1Nudge: '"It\'s" is the contraction for "it is", not the possessive determiner "its".',
    wrongAmbig2Text: 'your',
    wrongAmbig2Nudge: '"Your" is a second-person pronoun and cannot refer to "the valley glacier".',
    revealExplain: 'The singular antecedent "the valley glacier" requires the singular possessive pronoun "its".',
  },
  {
    intros: [
      'In traditional Japanese timber joinery,',
      'Carved with chisels and wooden mallets to exact tolerances,',
      'Allowing temple roofs to flex during seismic tremors,',
    ],
    kind: 'pl-poss',
    clauseBeforeBlank: 'because mortise-and-tenon joints lock wooden beams together without iron nails, ______',
    clauseAfterBlank: 'interlocking wedges can be disassembled for repairs centuries later.',
    antecedent: 'mortise-and-tenon joints',
    distractorNoun: 'traditional joinery',
    rightText: 'their',
    wrongNumberText: 'its',
    wrongNumberNudge: '"Its" is singular, but the antecedent is the plural noun phrase "mortise-and-tenon joints".',
    wrongAmbig1Text: "they're",
    wrongAmbig1Nudge: '"They\'re" means "they are", not the possessive pronoun "their".',
    wrongAmbig2Text: "one's",
    wrongAmbig2Nudge: '"One\'s" is a singular personal pronoun and does not match the plural noun "mortise-and-tenon joints".',
    revealExplain: 'The plural subject "mortise-and-tenon joints" requires the plural possessive pronoun "their".',
  },
]

function generateAgree(seed: number, knobs: DifficultyKnobs): ProblemInstance {
  const s = ((seed | 0) === 0 ? 1 : Math.abs(seed | 0))
  const itemIdx = (s - 1) % AGREE_ITEMS.length
  const introIdx = Math.floor((s - 1) / AGREE_ITEMS.length) % 3

  const item = AGREE_ITEMS[itemIdx]!
  const intro = item.intros[introIdx]!

  const statementText = `${intro} ${item.subjectPhrase} ${item.interrupter} ______ ${item.predicateRest}`
  const prompt = 'Which choice completes the text so that it conforms to the conventions of Standard English?'

  const isSingular = item.headNumber === 'singular'
  const rightText = isSingular ? item.verb.sg3 : item.verb.pl
  const wrongSimple = isSingular ? item.verb.pl : item.verb.sg3
  const wrongPerf = isSingular ? `have ${item.verb.partPast}` : `has ${item.verb.partPast}`
  const wrongProg = isSingular ? `are ${item.verb.partPres}` : `is ${item.verb.partPres}`

  const wrongNumberWord = isSingular ? 'plural' : 'singular'
  const rightNumberWord = isSingular ? 'singular' : 'plural'

  const nudgeSimple = `The ${wrongNumberWord} verb "${wrongSimple}" agrees with the nearby ${wrongNumberWord} noun "${item.nearbyNoun}" instead of the true ${rightNumberWord} subject "${item.headNoun}".`
  const nudgePerf = `The ${wrongNumberWord} helping verb in "${wrongPerf}" agrees with the nearby ${wrongNumberWord} noun "${item.nearbyNoun}" instead of the true ${rightNumberWord} subject "${item.headNoun}".`
  const nudgeProg = `The ${wrongNumberWord} helping verb in "${wrongProg}" agrees with the nearby ${wrongNumberWord} noun "${item.nearbyNoun}" instead of the true ${rightNumberWord} subject "${item.headNoun}".`

  const { options, correctId, correctText } = buildSatRwOptions(seed, 0x72a1, [
    { text: rightText, correct: true },
    { text: wrongSimple, correct: false, mistake: 'rw_nearest_noun' as ErrorPatternId, nudge: nudgeSimple },
    { text: wrongPerf, correct: false, mistake: 'rw_nearest_noun' as ErrorPatternId, nudge: nudgePerf },
    { text: wrongProg, correct: false, mistake: 'rw_nearest_noun' as ErrorPatternId, nudge: nudgeProg },
  ])

  const reveal = [
    `Cross out the interrupting phrase "${item.interrupter}": the true head subject of the clause is "${item.subjectPhrase}" (${rightNumberWord}).`,
    `The nearby noun "${item.nearbyNoun}" is ${wrongNumberWord}, which is a trap for the ear; the main verb must agree with the ${rightNumberWord} head noun "${item.headNoun}".`,
    `Choice ${correctId} ("${correctText}") is the only ${rightNumberWord} verb that agrees with "${item.headNoun}".`,
  ]

  const answer: SatRwAnswer = {
    type: 'satrw',
    prompt,
    options,
    correctId,
    correctText,
    nudge: `Look past the prepositional phrase "${item.interrupter}" to find the true head noun of the subject and check whether it is singular or plural.`,
    ruleCard: R_AGREE,
    ruleCards: [R_AGREE],
    reveal,
    correctMessage: `Right — "${correctText}" agrees with the ${rightNumberWord} subject "${item.headNoun}".`,
  }

  return {
    id: `rwFormSense/rf.agree@${GEN_VERSION}/${(seed >>> 0).toString(36)}`,
    moduleId: 'rwFormSense' as ModuleId,
    templateId: 'rf.agree',
    skill: 'rf.agree',
    genVersion: GEN_VERSION,
    seed,
    knobs,
    kind: 'satrw',
    title: 'Subject–verb agreement across interrupting phrases',
    instructions: prompt,
    statementText,
    vars: [],
    start: null,
    canonical: [],
    answer,
    graph: NONE_GRAPH,
    calc: EMPTY_CALC,
    params: { itemIdx, introIdx, headNumber: item.headNumber },
  }
}

function generatePronoun(seed: number, knobs: DifficultyKnobs): ProblemInstance {
  const s = ((seed | 0) === 0 ? 1 : Math.abs(seed | 0))
  const itemIdx = (s - 1) % PRONOUN_ITEMS.length
  const introIdx = Math.floor((s - 1) / PRONOUN_ITEMS.length) % 3

  const item = PRONOUN_ITEMS[itemIdx]!
  const intro = item.intros[introIdx]!

  const statementText = `${intro} ${item.clauseBeforeBlank} ${item.clauseAfterBlank}`
  const prompt = 'Which choice completes the text so that it conforms to the conventions of Standard English?'

  const { options, correctId, correctText } = buildSatRwOptions(seed, 0x72a2, [
    { text: item.rightText, correct: true },
    {
      text: item.wrongNumberText,
      correct: false,
      mistake: 'rw_pronoun_number' as ErrorPatternId,
      nudge: item.wrongNumberNudge,
    },
    {
      text: item.wrongAmbig1Text,
      correct: false,
      mistake: 'rw_pronoun_ambiguous' as ErrorPatternId,
      nudge: item.wrongAmbig1Nudge,
    },
    {
      text: item.wrongAmbig2Text,
      correct: false,
      mistake: 'rw_pronoun_ambiguous' as ErrorPatternId,
      nudge: item.wrongAmbig2Nudge,
    },
  ])

  const reveal = [
    item.revealExplain,
    `The other choices either mismatch the antecedent "${item.antecedent}" in number ("${item.wrongNumberText}") or create an ambiguous/non-possessive reference ("${item.wrongAmbig1Text}", "${item.wrongAmbig2Text}").`,
    `Therefore, choice ${correctId} ("${correctText}") is the only clear, grammatically matching choice.`,
  ]

  const answer: SatRwAnswer = {
    type: 'satrw',
    prompt,
    options,
    correctId,
    correctText,
    nudge: 'Identify the exact noun that the blank refers back to, then check whether it is singular, plural, or one of two competing nouns.',
    ruleCard: R_PRONOUN,
    ruleCards: [R_PRONOUN],
    reveal,
    correctMessage: `Right — "${correctText}" clearly and accurately refers to "${item.antecedent}".`,
  }

  return {
    id: `rwFormSense/rf.pronoun@${GEN_VERSION}/${(seed >>> 0).toString(36)}`,
    moduleId: 'rwFormSense' as ModuleId,
    templateId: 'rf.pronoun',
    skill: 'rf.pronoun',
    genVersion: GEN_VERSION,
    seed,
    knobs,
    kind: 'satrw',
    title: 'Pronoun–antecedent agreement and clarity',
    instructions: prompt,
    statementText,
    vars: [],
    start: null,
    canonical: [],
    answer,
    graph: NONE_GRAPH,
    calc: EMPTY_CALC,
    params: { itemIdx, introIdx, kind: item.kind },
  }
}

function progress(): ProgressInfo {
  return { stage: 0, total: 1, label: 'Match the verb or pronoun to its true grammatical subject or antecedent', anchorIndex: -1, path: 'none' }
}

export const rwFormSenseModule: ModuleDef = {
  id: 'rwFormSense' as ModuleId,
  subject: 'English',
  title: 'Form, structure, and sense: agreement',
  blurb: 'Match verbs to their true head subjects across interrupting prepositional phrases, and match pronouns to clear antecedents in number.',
  order: 51,
  templates: [
    {
      id: 'rf.agree',
      title: 'Subject–verb agreement across interrupting phrases',
      description: 'Match the main verb in number to the true head noun of the subject rather than a closer noun inside an interrupting phrase.',
      version: GEN_VERSION,
      knobs: [],
      generate: generateAgree,
    },
    {
      id: 'rf.pronoun',
      title: 'Pronoun–antecedent agreement and clarity',
      description: 'Choose a pronoun (or specific noun) that matches its antecedent in number and avoids ambiguity when two nouns are present.',
      version: GEN_VERSION,
      knobs: [],
      generate: generatePronoun,
    },
  ],
  ruleCards: RULE_CARDS,
  progress,
  nextStep: () => null,
}

registerModule(rwFormSenseModule)
