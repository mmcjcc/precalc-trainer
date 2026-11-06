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

const R_TRANSITIONS = 'rc.rw.transitions' as RuleCardId

const RULE_CARDS: RuleCard[] = [
  {
    id: R_TRANSITIONS,
    title: 'Choosing the logical transition between sentences',
    body: 'First read both sentences without the transition and name how the second sentence relates to the first: Contrast (opposes or qualifies: "However,", "Nevertheless,"), Cause → effect (states the result: "Therefore,", "Consequently,"), Example (illustrates a general claim: "For instance,", "Specifically,"), Addition (adds a parallel point: "Moreover,", "Furthermore,"), or Sequence (next step in time: "Subsequently,", "Next,"). Then pick the one transition from that family.',
  },
]

export type TransitionRelation = 'contrast' | 'cause' | 'example' | 'addition' | 'sequence'

interface RelationSpec {
  id: TransitionRelation
  label: string
  mistakeId: ErrorPatternId
  words: readonly [string, string, string, string, string]
  whatItSignals: string
}

const RELATIONS: readonly RelationSpec[] = [
  {
    id: 'contrast',
    label: 'contrast',
    mistakeId: 'rw_transition_contrast' as ErrorPatternId,
    words: ['However,', 'Nevertheless,', 'By contrast,', 'On the other hand,', 'Instead,'],
    whatItSignals: 'an opposing or contrasting point',
  },
  {
    id: 'cause',
    label: 'cause→effect',
    mistakeId: 'rw_transition_cause' as ErrorPatternId,
    words: ['Therefore,', 'Consequently,', 'As a result,', 'Thus,', 'Accordingly,'],
    whatItSignals: 'a direct result or consequence',
  },
  {
    id: 'example',
    label: 'example',
    mistakeId: 'rw_transition_example' as ErrorPatternId,
    words: ['For example,', 'For instance,', 'Specifically,', 'In particular,', 'To illustrate,'],
    whatItSignals: 'a specific example of a general claim',
  },
  {
    id: 'addition',
    label: 'addition',
    mistakeId: 'rw_transition_addition' as ErrorPatternId,
    words: ['Furthermore,', 'Moreover,', 'In addition,', 'Additionally,', 'Similarly,'],
    whatItSignals: 'an additional parallel point',
  },
  {
    id: 'sequence',
    label: 'sequence',
    mistakeId: 'rw_transition_sequence' as ErrorPatternId,
    words: ['Subsequently,', 'Afterward,', 'Next,', 'Then,', 'Later,'],
    whatItSignals: 'the next chronological step in a sequence',
  },
]

/** The word bank, for the starter study deck (src/study/starterDecks.ts): every taught word with what it signals. */
export function transitionGlossary(): readonly { relation: TransitionRelation; label: string; words: readonly string[]; signals: string }[] {
  return RELATIONS.map((r) => ({ relation: r.id, label: r.label, words: r.words, signals: r.whatItSignals }))
}

interface SentencePair {
  s1: string
  s2: string
  whyRight: string
}

const PAIRS_BY_RELATION: Record<TransitionRelation, readonly SentencePair[]> = {
  contrast: [
    {
      s1: 'Early nineteenth-century maps depicted the high desert plateau as completely waterless.',
      s2: 'archaeological surveys later uncovered stone-lined canals fed by perennial mountain springs.',
      whyRight: 'the second sentence contradicts the early maps’ depiction of a waterless plateau',
    },
    {
      s1: 'Most deciduous trees in temperate forests shed their leaves before the first hard autumn frost.',
      s2: 'young American beech trees often retain their dried bronze foliage until new buds open in April.',
      whyRight: 'the second sentence contrasts young beech trees with most deciduous trees',
    },
    {
      s1: 'Acoustic engineers predicted that the vaulted stone ceiling would blur rapid harpsichord passages.',
      s2: 'the carved limestone ribs diffused the sound so evenly that every note remained crisp in the back row.',
      whyRight: 'the actual acoustic outcome opposed the engineers’ prediction',
    },
    {
      s1: 'Traditional fresco painters applied pigments directly onto wet lime plaster so the colors bonded chemically with the wall.',
      s2: 'tempera panel painters worked on dry gessoed wood and bound their pigments with egg yolk.',
      whyRight: 'the second sentence contrasts tempera panel methods with wet-plaster fresco technique',
    },
    {
      s1: 'Many marine crustaceans rely on heavy calcified shells to deter reef predators.',
      s2: 'decorator crabs have relatively soft carapaces and conceal themselves by attaching living sponges and kelp to their backs.',
      whyRight: 'decorator crabs use camouflage rather than the heavy shells used by most crustaceans',
    },
    {
      s1: 'Initial wind-tunnel trials suggested that the swept-back wingtip would increase drag at low speeds.',
      s2: 'full-scale flight tests showed that the curved tip reduced vortex turbulence during takeoff.',
      whyRight: 'the full-scale flight results reversed the initial wind-tunnel expectation',
    },
    {
      s1: 'Sixteenth-century guild statutes strictly forbade apothecaries from publishing their distillation formulas.',
      s2: 'several Venetian master glassmakers printed illustrated manuals sharing their furnace designs openly.',
      whyRight: 'the glassmakers’ open manuals contrast with the apothecaries’ secrecy rules',
    },
    {
      s1: 'Surface water in the subtropical gyre contains very low concentrations of dissolved iron and nitrate.',
      s2: 'deep upwelling currents along the continental shelf carry abundant nutrients to coastal kelp beds.',
      whyRight: 'nutrient-rich coastal upwelling contrasts with nutrient-poor gyre surface water',
    },
    {
      s1: 'Historians long assumed that the medieval bridge was financed entirely by royal tolls.',
      s2: 'newly translated parish ledgers show that local wool merchants paid for four of the six stone piers.',
      whyRight: 'the parish ledgers overturn the long-held assumption about royal financing',
    },
    {
      s1: 'Pure copper conducts heat and electricity exceptionally well but bends easily under load.',
      s2: 'bronze alloyed with ten percent tin sacrifices conductivity yet resists deformation far better.',
      whyRight: 'the properties of bronze contrast directly with those of pure copper',
    },
    {
      s1: 'Most songbirds migrate at night when cooler air and calmer winds reduce the risk of overheating.',
      s2: 'broad-winged hawks travel during midday so they can glide on rising columns of sun-warmed air.',
      whyRight: 'daytime hawk migration contrasts with the nighttime migration of most songbirds',
    },
    {
      s1: 'Critics in 1889 complained that the exposed iron lattice of the exhibition tower looked unfinished.',
      s2: 'within a decade, architects across Europe praised the structure as a masterpiece of modern engineering.',
      whyRight: 'later architectural praise contrasts sharply with the initial 1889 criticism',
    },
  ],
  cause: [
    {
      s1: 'Fine volcanic ash from the 1815 eruption reflected a significant fraction of incoming solar radiation back into space.',
      s2: 'summer temperatures across New England and western Europe dropped sharply the following year.',
      whyRight: 'the drop in summer temperatures was the direct consequence of the reflective volcanic ash',
    },
    {
      s1: 'The city library eliminated overdue fines on children’s picture books and juvenile chapter books last autumn.',
      s2: 'circulation in the youth reading room rose by thirty-four percent over the next six months.',
      whyRight: 'rising youth circulation was the result of eliminating overdue fines',
    },
    {
      s1: 'Saltmarsh cordgrass excretes excess sea salt through specialized glands along its blades.',
      s2: 'the grass can thrive in brackish tidal estuaries where most terrestrial plants would dehydrate.',
      whyRight: 'surviving in salty estuaries is the direct result of the plant’s salt-excreting glands',
    },
    {
      s1: 'Nineteenth-century paper mills switched from linen rag fibers to acidic groundwood pulp in the 1860s.',
      s2: 'many newspapers printed during that era have turned brittle and brown in library archives.',
      whyRight: 'the brittleness of post-1860 newsprint was caused by acidic groundwood pulp',
    },
    {
      s1: 'The municipal water authority replaced leaking cast-iron mains beneath the historic district.',
      s2: 'unaccounted water loss in the downtown sector fell to its lowest level in forty years.',
      whyRight: 'reduced water loss resulted directly from replacing the leaking cast-iron mains',
    },
    {
      s1: 'High-elevation observatories sit above most of the atmospheric water vapor that absorbs infrared light.',
      s2: 'astronomers place major infrared telescopes on dry mountain peaks in Chile and Hawaii.',
      whyRight: 'siting infrared telescopes on dry peaks is the direct result of needing to get above water vapor',
    },
    {
      s1: 'Dense beaver ponds slow spring snowmelt and allow water to percolate into floodplain soils.',
      s2: 'streams with active beaver meadows maintain steadier base flows during late-summer droughts.',
      whyRight: 'steadier late-summer stream flow is the consequence of water stored by beaver ponds',
    },
    {
      s1: 'Iron-gall ink contains sulfuric acid compounds that gradually corrode cellulose fibers.',
      s2: 'conservators treat fragile seventeenth-century letters with alkaline calcium phytate baths.',
      whyRight: 'conservators use alkaline baths because the acidic ink corrodes the paper',
    },
    {
      s1: 'The theater’s new LED fresnel spotlights generate far less radiant heat than tungsten lamps.',
      s2: 'the cooling fans above the stage grid can run at half speed during performances.',
      whyRight: 'running the cooling fans slower is a direct result of the cooler LED lights',
    },
    {
      s1: 'Sea otters prey heavily on purple sea urchins that would otherwise graze down giant kelp holdfasts.',
      s2: 'coastal coves with recovering otter populations support much denser underwater kelp forests.',
      whyRight: 'denser kelp forests result from sea otters keeping sea urchin grazing in check',
    },
    {
      s1: 'The ancient kiln was built into a steep hillside that created a natural upward chimney draft.',
      s2: 'potters could reach stoneware firing temperatures without mechanical bellows.',
      whyRight: 'reaching high temperatures without bellows was made possible by the hillside draft',
    },
    {
      s1: 'Microscopic air pockets trapped inside cork cells impede both thermal conduction and sound vibration.',
      s2: 'builders use cork panels to insulate recording studios and concert rehearsal rooms.',
      whyRight: 'using cork in studios is a direct consequence of its heat- and sound-insulating structure',
    },
  ],
  example: [
    {
      s1: 'Many alpine plants have evolved compact growth forms that trap a layer of sun-warmed air near the ground.',
      s2: 'moss campion grows in dense, hemispherical cushions only a few centimeters tall that stay several degrees warmer than the mountain wind.',
      whyRight: 'moss campion is a concrete example illustrating how alpine plants use compact forms to trap warmth',
    },
    {
      s1: 'Several Renaissance paintings include optical instruments that highlight the sitter’s scholarly pursuits.',
      s2: 'Hans Holbein’s 1533 double portrait displays cylindrical sundials, a celestial globe, and a quadrant on the central table.',
      whyRight: 'Holbein’s 1533 portrait is a specific instance of a Renaissance painting featuring scientific instruments',
    },
    {
      s1: 'Bivalve mollusks filter suspended algae and organic particles from estuarine waters at impressive rates.',
      s2: 'a single adult eastern oyster can clarify up to fifty gallons of bay water in a twenty-four-hour period.',
      whyRight: 'the eastern oyster’s fifty-gallon filtration rate illustrates the general claim about bivalve mollusks',
    },
    {
      s1: 'Public transit agencies have increasingly repurposed abandoned rail corridors as multi-use greenways.',
      s2: 'a former freight spur in central Virginia now serves as a shaded bicycle and pedestrian trail linking four rural towns.',
      whyRight: 'the Virginia trail is a specific example of an abandoned rail corridor converted into a greenway',
    },
    {
      s1: 'Certain desert beetles harvest drinking water directly from coastal fog using textured wing covers.',
      s2: 'the Namib Desert beetle tilts its bumpy carapace into the morning breeze so microscopic droplets coalesce and roll toward its mouth.',
      whyRight: 'the Namib Desert beetle illustrates the broader claim about fog-harvesting desert beetles',
    },
    {
      s1: 'Orchestral composers in the twentieth century occasionally scored works for unconventional percussion instruments.',
      s2: 'George Antheil’s 1924 score calls for electric doorbells, airplane propellers, and multiple player pianos.',
      whyRight: 'Antheil’s 1924 score provides a specific example of unconventional twentieth-century percussion scoring',
    },
    {
      s1: 'Symbiotic fungi often supply forest trees with mineral nutrients in exchange for photosynthetic sugars.',
      s2: 'mycorrhizal networks beneath Douglas fir stands transfer phosphorus from decaying rock directly into the trees’ fine root tips.',
      whyRight: 'the Douglas fir mycorrhizal network illustrates the general claim about symbiotic forest fungi',
    },
    {
      s1: 'Vernacular architecture in hot, dry climates relies on passive cooling features rather than mechanical air conditioning.',
      s2: 'traditional mud-brick courtyard houses in Yazd use tall windcatchers to channel breezes across underground water basins.',
      whyRight: 'the windcatcher houses of Yazd exemplify passive cooling in hot, dry vernacular architecture',
    },
    {
      s1: 'Seed dispersal by ants—known to botanists as myrmecochory—is common among spring woodland wildflowers.',
      s2: 'bloodroot seeds bear a lipid-rich appendage that worker ants carry back to their underground nests before discarding the intact seed in fertile soil.',
      whyRight: 'bloodroot is a specific example of a spring woodland wildflower dispersed by ants',
    },
    {
      s1: 'Medieval trade guilds often left lasting marks on the street names of European market towns.',
      s2: 'lanes named Cordwainer Street and Tenterhooks Alley in York recall the leatherworkers and cloth stretchers who once worked there.',
      whyRight: 'the York street names illustrate how medieval trade guilds shaped urban toponyms',
    },
    {
      s1: 'Extreme pressure and heat deep within the crust can transform sedimentary rocks into durable metamorphic stone.',
      s2: 'fine-grained marine shale recrystallizes under tectonic compression to form splitting slate and mica-rich phyllite.',
      whyRight: 'the transformation of shale into slate illustrates how sedimentary rock becomes metamorphic stone',
    },
    {
      s1: 'Acoustic mimicry allows several harmless insect species to startle predators that avoid stinging wasps.',
      s2: 'clearwing hoverflies beat their wings at the exact frequency of yellowjacket wasps when cornered by insectivorous birds.',
      whyRight: 'clearwing hoverflies provide a concrete instance of harmless insects mimicking wasp wing-beat sounds',
    },
  ],
  addition: [
    {
      s1: 'Planting native willow stakes along eroded streambanks anchors loose soil with a dense mesh of roots.',
      s2: 'the overhanging willow branches shade the water and keep summer stream temperatures cool enough for native trout.',
      whyRight: 'the second sentence adds a second ecological benefit of streamside willows alongside bank stabilization',
    },
    {
      s1: 'Digitizing the historical society’s glass-plate negatives allows scholars around the world to search the collection online.',
      s2: 'the digital surrogates reduce how often archivists must handle the fragile original emulsion plates.',
      whyRight: 'preserving the fragile originals is a second parallel benefit of digitization',
    },
    {
      s1: 'Seagrass meadows trap suspended sediment before it can cloud offshore coral reefs.',
      s2: 'their tangled rhizomes store carbon in oxygen-poor seabed mud for centuries.',
      whyRight: 'the second sentence adds another important ecological function of seagrass meadows',
    },
    {
      s1: 'Switching the ferry fleet to battery-electric propulsion eliminated diesel exhaust along the harbor promenade.',
      s2: 'the quiet electric motors reduced underwater noise near the porpoise foraging grounds.',
      whyRight: 'quieter underwater operation is an additional environmental advantage of the electric ferries',
    },
    {
      s1: 'Intercropping pole beans with sweet corn provides the climbing bean vines with sturdy natural trellises.',
      s2: 'nitrogen-fixing bacteria on the bean roots enrich the soil for the heavy-feeding corn stalks.',
      whyRight: 'soil nitrogen enrichment is a second complementary benefit of intercropping beans and corn',
    },
    {
      s1: 'Lime mortar is softer and more vapor-permeable than modern Portland cement, allowing historic brick walls to dry after rain.',
      s2: 'it flexes slightly under thermal expansion so hairline cracks can self-heal as rainwater dissolves and re-deposits calcium carbonate.',
      whyRight: 'flexibility and self-healing add a second reason conservators prefer lime mortar on historic masonry',
    },
    {
      s1: 'Permeable interlocking pavers in the school parking lot allow rainwater to infiltrate directly into the gravel subbase.',
      s2: 'the light-colored granite blocks reflect summer sunlight and lower pavement surface temperatures.',
      whyRight: 'cooling the pavement surface is an additional benefit of the permeable granite pavers',
    },
    {
      s1: 'Studying a composer’s early sketchbooks reveals how a symphonic theme evolved through multiple revisions.',
      s2: 'watermarks and staff-ruling patterns in the sketch paper help musicologists date undated fragments.',
      whyRight: 'dating fragments from paper watermarks is a second research value of studying musical sketchbooks',
    },
    {
      s1: 'Hedgerows of hawthorn and elderberry around crop fields shelter predatory beetles that feed on aphids.',
      s2: 'the woody shrubs act as windbreaks that reduce moisture loss from the adjacent soil.',
      whyRight: 'acting as a moisture-saving windbreak adds a second agricultural benefit of hedgerows',
    },
    {
      s1: 'Cross-laminated timber panels can be prefabricated to exact window and door dimensions before arriving at the building site.',
      s2: 'the engineered wood assemblies weigh significantly less than poured concrete slabs of comparable strength.',
      whyRight: 'lighter structural weight is a second advantage of cross-laminated timber panels',
    },
    {
      s1: 'Nighttime dark-sky ordinances cut energy costs by shielding streetlamps so light is directed only toward the pavement.',
      s2: 'reducing upward skyglow prevents disorientation in nocturnally migrating warblers and thrushes.',
      whyRight: 'protecting migrating songbirds adds a second benefit of shielded dark-sky streetlighting',
    },
    {
      s1: 'Rotating potatoes with mustard cover crops suppresses soil-borne nematodes naturally.',
      s2: 'incorporating the chopped mustard greens into the topsoil adds organic matter that improves water retention.',
      whyRight: 'improving soil organic matter and water retention is an additional benefit of the mustard rotation',
    },
  ],
  sequence: [
    {
      s1: 'To prepare a copperplate for etching, the printmaker first coats the polished metal with an acid-resistant wax ground and draws through the wax with a steel needle.',
      s2: 'the artist immerses the plate in a bath of ferric chloride so the acid bites into the exposed copper lines.',
      whyRight: 'immersing the plate in the acid bath is the next chronological step after coating and drawing through the wax',
    },
    {
      s1: 'In traditional papermaking, artisans beat soaked mulberry bark fibers into a watery slurry inside a wooden vat.',
      s2: 'they dip a bamboo screen into the vat to lift a thin, matted sheet of wet fibers.',
      whyRight: 'lifting the sheet on a bamboo screen happens next in time after beating the bark fibers into a slurry',
    },
    {
      s1: 'Before relocating the historic lighthouse, engineers excavated beneath the granite foundation and inserted hydraulic steel beams.',
      s2: 'computer-synchronized jacks lifted the tower onto roller tracks and moved it three hundred meters inland.',
      whyRight: 'jacking and rolling the lighthouse inland followed the initial excavation and beam insertion',
    },
    {
      s1: 'During dendrochronological sampling, a forester bores into the trunk with a hollow increment corer to extract a pencil-thin cylinder of wood.',
      s2: 'the core is glued into a grooved wooden mount and sanded until individual spring and summer cell walls are visible under a microscope.',
      whyRight: 'mounting and sanding the wood core is the procedural step that follows extracting it from the tree',
    },
    {
      s1: 'In lost-wax bronze casting, the sculptor encases a detailed wax model in heat-resistant investment plaster and heats the mold until the wax melts out.',
      s2: 'molten bronze is poured into the hollow cavity left behind by the melted wax.',
      whyRight: 'pouring molten bronze into the cavity takes place after the wax model has been encased and melted out',
    },
    {
      s1: 'When restoring a torn parchment map, the conservator first humidifies the stiff skin in a mist chamber until the creases relax.',
      s2: 'the flattened sheet is dried under gentle tension between felts and mended with translucent wheat-starch strips.',
      whyRight: 'flattening, drying, and mending the parchment follow the initial humidification step',
    },
    {
      s1: 'To calibrate the ocean-bottom seismometer, technicians synchronize its internal atomic clock with satellite time signals on the ship’s deck.',
      s2: 'a crane lowers the instrument package four thousand meters to the abyssal plain.',
      whyRight: 'lowering the seismometer to the seafloor occurs after its clock is synchronized on deck',
    },
    {
      s1: 'In sourdough bread production, the baker mixes flour and water with a live starter culture and lets the dough ferment for several hours.',
      s2: 'the risen loaves are shaped, scored with a razor blade, and baked on a heated hearthstone.',
      whyRight: 'shaping, scoring, and baking follow the mixing and fermentation stage',
    },
    {
      s1: 'Archaeobotanists pump river water through a soil sample in a flotation tank so charred seeds and wood fragments float to the top.',
      s2: 'the floating botanical remains are skimmed off with fine bronze mesh sieves and dried in shaded trays for identification.',
      whyRight: 'skimming and drying the floating seeds is the step that follows floating them in the tank',
    },
    {
      s1: 'Before painting on a linen canvas, the artist stretches the raw fabric taut over beveled wooden stretcher bars.',
      s2: 'two coats of rabbit-skin glue and titanium-white gesso are brushed across the weave to seal the fibers.',
      whyRight: 'sizing and priming the canvas with gesso comes after stretching the raw linen over the bars',
    },
    {
      s1: 'To extract ancient pollen from lake-bed sediment, lab technicians first dissolve carbonate and silicate minerals out of the mud sample.',
      s2: 'they mount a drop of the concentrated organic residue on a glass slide and count the pollen grains at four hundred power.',
      whyRight: 'mounting and counting the pollen on a slide follows dissolving away the mineral sediment',
    },
    {
      s1: 'In wool dyeing with natural indigo, weavers submerge the clean skeins in a warm, oxygen-free fermentation vat where the dye appears pale yellow-green.',
      s2: 'they lift the yarn into the open air, where reaction with atmospheric oxygen turns the fibers deep blue.',
      whyRight: 'lifting the yarn into the air to oxidize turns it blue after its immersion in the dye vat',
    },
  ],
}

function generateTransitionPick(seed: number, knobs: DifficultyKnobs): ProblemInstance {
  const s = ((seed | 0) === 0 ? 1 : Math.abs(seed | 0))
  const relIdx = (s - 1) % RELATIONS.length
  const rightRel = RELATIONS[relIdx]!
  const pairs = PAIRS_BY_RELATION[rightRel.id]
  const pairIdx = Math.floor((s - 1) / RELATIONS.length) % pairs.length
  const wordVariant = Math.floor((s - 1) / (RELATIONS.length * pairs.length))

  const pair = pairs[pairIdx]!
  const rightWord = rightRel.words[(s + wordVariant) % rightRel.words.length]!

  // Pick 3 distinct OTHER relations from the remaining 4 relations
  const otherRels = RELATIONS.filter((_, idx) => idx !== relIdx)
  const omitIdx = (s + pairIdx) % otherRels.length
  const wrongRels = otherRels.filter((_, idx) => idx !== omitIdx) as [RelationSpec, RelationSpec, RelationSpec]

  const wrongCandidates = wrongRels.map((wRel, i) => {
    const wWord = wRel.words[(s + i + wordVariant) % wRel.words.length]!
    const nudge = `"${wWord}" signals ${wRel.whatItSignals}, whereas here ${pair.whyRight} (${rightRel.label}).`
    return {
      text: wWord,
      correct: false as const,
      mistake: wRel.mistakeId,
      nudge,
    }
  })

  const statementText = `${pair.s1} ______ ${pair.s2}`
  const prompt = 'Which choice completes the text with the most logical transition?'

  const { options, correctId, correctText } = buildSatRwOptions(seed, 0x73c1, [
    { text: rightWord, correct: true },
    wrongCandidates[0]!,
    wrongCandidates[1]!,
    wrongCandidates[2]!,
  ])

  const reveal = [
    `Read the two sentences together: ${pair.whyRight}.`,
    `That relationship is ${rightRel.label} (${rightRel.whatItSignals}).`,
    `Choice ${correctId} ("${correctText}") is the only transition from the ${rightRel.label} family.`,
  ]

  const answer: SatRwAnswer = {
    type: 'satrw',
    prompt,
    options,
    correctId,
    correctText,
    nudge: 'Read the first sentence and the second sentence without the blank, then decide whether the second sentence contrasts with, results from, illustrates, adds to, or follows in time after the first.',
    ruleCard: R_TRANSITIONS,
    ruleCards: [R_TRANSITIONS],
    reveal,
    correctMessage: `Right — "${correctText}" signals ${rightRel.whatItSignals}.`,
  }

  return {
    id: `rwTransitions/rt.pick@${GEN_VERSION}/${(seed >>> 0).toString(36)}`,
    moduleId: 'rwTransitions' as ModuleId,
    templateId: 'rt.pick',
    skill: 'rt.pick',
    genVersion: GEN_VERSION,
    seed,
    knobs,
    kind: 'satrw',
    title: 'Choosing the logical transition',
    instructions: prompt,
    statementText,
    vars: [],
    start: null,
    canonical: [],
    answer,
    graph: NONE_GRAPH,
    calc: EMPTY_CALC,
    params: { relation: rightRel.id, pairIdx, wordVariant },
  }
}

function progress(): ProgressInfo {
  return { stage: 0, total: 1, label: 'Identify the logical relation between the two sentences and choose the matching transition', anchorIndex: -1, path: 'none' }
}

export const rwTransitionsModule: ModuleDef = {
  id: 'rwTransitions' as ModuleId,
  subject: 'English',
  title: 'Transitions: connecting ideas',
  blurb: 'Determine how two sentences relate—contrast, cause and effect, example, addition, or sequence—and pick the transition that signals that relation.',
  order: 49,
  templates: [
    {
      id: 'rt.pick',
      title: 'Choosing the logical transition',
      description: 'Connect two sentences by identifying whether the second contrasts with, results from, illustrates, adds to, or follows in sequence after the first.',
      version: GEN_VERSION,
      knobs: [],
      generate: generateTransitionPick,
    },
  ],
  ruleCards: RULE_CARDS,
  progress,
  nextStep: () => null,
}

registerModule(rwTransitionsModule)
