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

const R_JOIN = 'rc.rw.join' as RuleCardId
const R_INSIDE = 'rc.rw.inside' as RuleCardId

const RULE_CARDS: RuleCard[] = [
  {
    id: R_JOIN,
    title: 'Joining two independent clauses',
    body: 'Two complete sentences (independent clauses) can be joined in three standard ways: (1) with a period and a capital letter, (2) with a semicolon, or (3) with a comma followed by a coordinating conjunction (for, and, nor, but, or, yet, so). A comma alone is a comma splice; no punctuation at all (or a conjunction with no comma) is a run-on.',
  },
  {
    id: R_INSIDE,
    title: 'Commas inside a clause: paired commas vs. no-comma spots',
    body: 'A nonrestrictive (nonessential) appositive or phrase in the middle of a sentence must be enclosed in a matching pair of commas—both an opening comma and a closing comma. Do not put commas around a restrictive name that identifies who or what is meant, and never put a single comma between a subject and its main verb.',
  },
]

interface JoinPair {
  contextFrames: readonly [string, string, string]
  clause1Prefix: string
  lastWord1: string
  firstWord2Lower: string
  firstWord2Upper: string
  clause2Rest: string
  conj: 'and' | 'but' | 'so'
  adv: 'therefore' | 'however' | 'consequently' | 'moreover'
}

const JOIN_PAIRS: readonly JoinPair[] = [
  {
    contextFrames: [
      'Acoustic engineers inspected the civic auditorium before the autumn concert series.',
      'Before the autumn symphony season opened, technicians completed a full renovation.',
      'For decades, echoes in the old concert hall had muddled rapid string passages.',
    ],
    clause1Prefix: 'The conservatory restored the nineteenth-century pipe',
    lastWord1: 'organ',
    firstWord2Lower: 'the',
    firstWord2Upper: 'The',
    clause2Rest: 'acoustics in the recital hall improved immediately.',
    conj: 'and',
    adv: 'consequently',
  },
  {
    contextFrames: [
      'High-altitude observatories depend on stable nighttime temperatures for sharp imaging.',
      'Astronomers on the mountain ridge prepared the dome as dusk settled over the valley.',
      'Clear desert air helps ground-based telescopes resolve faint planetary nebulae.',
    ],
    clause1Prefix: 'The primary glass mirror cooled evenly throughout the',
    lastWord1: 'evening',
    firstWord2Lower: 'the',
    firstWord2Upper: 'The',
    clause2Rest: 'research team began recording stellar spectra at midnight.',
    conj: 'so',
    adv: 'therefore',
  },
  {
    contextFrames: [
      'Early naturalists assumed that deep ocean trenches lacked enough energy to support life.',
      'Submersible expeditions in the 1970s transformed marine biology.',
      'Sunlight cannot penetrate more than a few hundred meters below the ocean surface.',
    ],
    clause1Prefix: 'Hydrothermal vents release mineral-rich water across the seafloor',
    lastWord1: 'crust',
    firstWord2Lower: 'dense',
    firstWord2Upper: 'Dense',
    clause2Rest: 'colonies of tube worms thrive there without sunlight.',
    conj: 'and',
    adv: 'consequently',
  },
  {
    contextFrames: [
      'Archivists at the county historical society spent two summers cataloging donated ledgers.',
      'Many nineteenth-century shipping records had been stored in damp harbor warehouses.',
      'Paper conservation requires careful control of both humidity and ultraviolet light.',
    ],
    clause1Prefix: 'The ink on the earliest harbor manifests had faded to a pale',
    lastWord1: 'amber',
    firstWord2Lower: 'multispectral',
    firstWord2Upper: 'Multispectral',
    clause2Rest: 'imaging revealed every cargo entry clearly.',
    conj: 'but',
    adv: 'however',
  },
  {
    contextFrames: [
      'Urban planners studied pedestrian traffic around the central library square.',
      'Narrow brick sidewalks had forced commuters to wait in long queues at intersections.',
      'The municipal transit board tested a new streetscape design during the spring term.',
    ],
    clause1Prefix: 'The city widened the granite walkways along the library',
    lastWord1: 'plaza',
    firstWord2Lower: 'foot',
    firstWord2Upper: 'Foot',
    clause2Rest: 'traffic to the reading rooms rose by twenty percent.',
    conj: 'and',
    adv: 'therefore',
  },
  {
    contextFrames: [
      'Botanists monitored seed germination after a controlled burn in the pine barrens.',
      'Several conifer species seal their seeds inside resinous cones for years.',
      'Periodic low-intensity fires play a vital ecological role in dry woodland habitats.',
    ],
    clause1Prefix: 'Intense heat melted the resin sealing the jack pine',
    lastWord1: 'cones',
    firstWord2Lower: 'thousands',
    firstWord2Upper: 'Thousands',
    clause2Rest: 'of dormant seeds sprouted in the mineral-rich ash.',
    conj: 'so',
    adv: 'consequently',
  },
  {
    contextFrames: [
      'Archaeologists excavated a Bronze Age workshop near the ancient harbor wall.',
      'Trade networks across the eastern Mediterranean moved raw metals over long distances.',
      'Chemical analysis of slag heaps can trace where ancient smiths obtained their ore.',
    ],
    clause1Prefix: 'The local hills contained abundant deposits of copper',
    lastWord1: 'ore',
    firstWord2Lower: 'the',
    firstWord2Upper: 'The',
    clause2Rest: 'tin needed for bronze had to be imported by sea.',
    conj: 'but',
    adv: 'however',
  },
  {
    contextFrames: [
      'Stage designers for the repertory theater built a rotating wooden platform.',
      'The play required rapid transitions between a harbor tavern and a ship deck.',
      'Previously, stagehands needed three full minutes to shift the heavy canvas flats.',
    ],
    clause1Prefix: 'A hidden counterweight turned the circular stage',
    lastWord1: 'floor',
    firstWord2Lower: 'scene',
    firstWord2Upper: 'Scene',
    clause2Rest: 'changes took less than fifteen seconds.',
    conj: 'so',
    adv: 'therefore',
  },
  {
    contextFrames: [
      'Glaciologists drilled ice cores from a high plateau in western Antarctica.',
      'Snowfall accumulates in thin annual layers that trap tiny bubbles of ancient air.',
      'Each meter of deep glacial ice preserves a chemical record of past climates.',
    ],
    clause1Prefix: 'Volcanic eruptions leave microscopic sulfate particles in the',
    lastWord1: 'atmosphere',
    firstWord2Lower: 'those',
    firstWord2Upper: 'Those',
    clause2Rest: 'distinct acidic bands give researchers exact calendar dates.',
    conj: 'and',
    adv: 'moreover',
  },
  {
    contextFrames: [
      'Agricultural researchers compared cover crops on sloped farmland in the river valley.',
      'Heavy autumn rains often wash topsoil from bare fields after the corn harvest.',
      'Plant roots bind loose silt particles together during the winter thaw.',
    ],
    clause1Prefix: 'Winter rye established a dense mat of fibrous',
    lastWord1: 'roots',
    firstWord2Lower: 'runoff',
    firstWord2Upper: 'Runoff',
    clause2Rest: 'from the hillside plots dropped by more than half.',
    conj: 'so',
    adv: 'consequently',
  },
  {
    contextFrames: [
      'Museum conservators examined a painted wooden sarcophagus using X-ray fluorescence.',
      'Ancient artists frequently reused seasoned cedar planks when timber was scarce.',
      'Surface examination alone cannot always detect earlier layers of pigment.',
    ],
    clause1Prefix: 'The outer layer displayed a geometric border in cobalt',
    lastWord1: 'blue',
    firstWord2Lower: 'an',
    firstWord2Upper: 'An',
    clause2Rest: 'older floral motif lay hidden beneath the gesso.',
    conj: 'but',
    adv: 'however',
  },
  {
    contextFrames: [
      'Ornithologists tracked Arctic terns with miniature solar-powered geolocators.',
      'Earlier banding studies had recovered only a handful of birds at winter roosts.',
      'The tiny sensors weigh less than a paper clip and record day length.',
    ],
    clause1Prefix: 'The tags logged sunrise and sunset times throughout the',
    lastWord1: 'voyage',
    firstWord2Lower: 'biologists',
    firstWord2Upper: 'Biologists',
    clause2Rest: 'mapped the complete pole-to-pole migration route.',
    conj: 'and',
    adv: 'therefore',
  },
  {
    contextFrames: [
      'Potters in the river valley prized a gray clay dug from ancient lake beds.',
      'Most earthenware clays crack when fired at stoneware temperatures.',
      'Mineralogical tests explained why the valley vessels were unusually durable.',
    ],
    clause1Prefix: 'The lake-bed clay contained fine grains of feldspathic',
    lastWord1: 'sand',
    firstWord2Lower: 'the',
    firstWord2Upper: 'The',
    clause2Rest: 'vessels vitrified evenly without warping in the kiln.',
    conj: 'so',
    adv: 'consequently',
  },
  {
    contextFrames: [
      'Hydrologists restored a series of beaver meadows along the mountain stream.',
      'Channelized creeks carry snowmelt downhill too quickly to recharge aquifers.',
      'Natural log dams slow the current and spread water across the floodplain.',
    ],
    clause1Prefix: 'The widened ponds stored spring snowmelt well into',
    lastWord1: 'August',
    firstWord2Lower: 'downstream',
    firstWord2Upper: 'Downstream',
    clause2Rest: 'trout habitats remained cool during the late-summer drought.',
    conj: 'and',
    adv: 'therefore',
  },
  {
    contextFrames: [
      'Typographers in the sixteenth century sought typefaces that remained legible in small sizes.',
      'Heavy blackletter fonts crowded the margins of pocket-sized scholarly editions.',
      'Venetian punchcutters redesigned Roman and italic letterforms with open counters.',
    ],
    clause1Prefix: 'The new italic types occupied less horizontal space on the',
    lastWord1: 'page',
    firstWord2Lower: 'printers',
    firstWord2Upper: 'Printers',
    clause2Rest: 'could fit entire classical texts into portable octavo volumes.',
    conj: 'so',
    adv: 'consequently',
  },
  {
    contextFrames: [
      'Solar engineers tested anti-reflective coatings on rooftop photovoltaic panels.',
      'Uncoated glass reflects a noticeable fraction of incoming sunlight at low angles.',
      'Morning and late-afternoon sun strikes fixed panels at a steep slant.',
    ],
    clause1Prefix: 'A microscopic silica film reduced surface glare across the',
    lastWord1: 'array',
    firstWord2Lower: 'daily',
    firstWord2Upper: 'Daily',
    clause2Rest: 'power output increased during winter mornings.',
    conj: 'and',
    adv: 'therefore',
  },
  {
    contextFrames: [
      'Linguists recorded oral histories from elders in three isolated mountain villages.',
      'Standard textbooks had classified the valley speech as a dialect of a neighboring tongue.',
      'Careful comparison of verb morphology revealed a much older divergence.',
    ],
    clause1Prefix: 'The two communities shared dozens of agricultural',
    lastWord1: 'loanwords',
    firstWord2Lower: 'their',
    firstWord2Upper: 'Their',
    clause2Rest: 'core grammatical structures belonged to distinct language families.',
    conj: 'but',
    adv: 'however',
  },
  {
    contextFrames: [
      'Beekeepers planted strips of native clover and phacelia along the orchard perimeter.',
      'Apple blossoms provide abundant nectar for only two weeks in mid-spring.',
      'Pollinator colonies need continuous forage from April through October.',
    ],
    clause1Prefix: 'The wildflower borders bloomed in succession after the',
    lastWord1: 'orchard',
    firstWord2Lower: 'wild',
    firstWord2Upper: 'Wild',
    clause2Rest: 'bumblebee populations remained active on the farm all summer.',
    conj: 'so',
    adv: 'consequently',
  },
  {
    contextFrames: [
      'Structural engineers evaluated a nineteenth-century covered bridge in Vermont.',
      'Wooden lattice trusses distribute vehicle loads across dozens of diagonal oak pins.',
      'Modern traffic is heavier than the wagons the bridge originally carried.',
    ],
    clause1Prefix: 'The hemlock roof had shielded the main timber trusses from',
    lastWord1: 'rain',
    firstWord2Lower: 'the',
    firstWord2Upper: 'The',
    clause2Rest: 'original oak floorbeams were still structurally sound.',
    conj: 'and',
    adv: 'therefore',
  },
  {
    contextFrames: [
      'Paleontologists examined fossilized leaf impressions from the Paleocene quarry.',
      'Leaf margins provide a reliable proxy for ancient mean annual temperatures.',
      'Trees in warm climates typically have smooth-edged leaves rather than toothed ones.',
    ],
    clause1Prefix: 'Nearly eighty percent of the fossil leaves had smooth',
    lastWord1: 'margins',
    firstWord2Lower: 'the',
    firstWord2Upper: 'The',
    clause2Rest: 'ancient basin must have experienced a subtropical climate.',
    conj: 'so',
    adv: 'therefore',
  },
  {
    contextFrames: [
      'Civic historians digitized the municipal streetcar maps from 1912.',
      'Early electric rail lines shaped where residential neighborhoods grew.',
      'Many commuters today assume the outer suburbs developed only after highways were built.',
    ],
    clause1Prefix: 'Trolley tracks once reached twelve miles beyond the downtown',
    lastWord1: 'core',
    firstWord2Lower: 'several',
    firstWord2Upper: 'Several',
    clause2Rest: 'outlying villages grew into streetcar suburbs before 1920.',
    conj: 'and',
    adv: 'consequently',
  },
  {
    contextFrames: [
      'Biochemists studied the luminescent proteins of deep-sea jellyfish.',
      'Most fluorescent dyes fade rapidly when exposed to bright microscope lamps.',
      'Mutated variants of green fluorescent protein solved a longstanding laboratory problem.',
    ],
    clause1Prefix: 'The engineered protein folded reliably at mammalian body',
    lastWord1: 'temperature',
    firstWord2Lower: 'cell',
    firstWord2Upper: 'Cell',
    clause2Rest: 'biologists could watch living proteins move in real time.',
    conj: 'so',
    adv: 'therefore',
  },
  {
    contextFrames: [
      'Restorers cleaned the stained-glass rose window of the gothic chapel.',
      'Centuries of coal soot had darkened the medieval glass to a dull gray.',
      'Soft deionized-water poultices lifted the grime without scratching the enamel.',
    ],
    clause1Prefix: 'The restoration team removed the soot from the ruby',
    lastWord1: 'panes',
    firstWord2Lower: 'morning',
    firstWord2Upper: 'Morning',
    clause2Rest: 'sunlight once again cast vivid crimson patterns across the nave.',
    conj: 'and',
    adv: 'consequently',
  },
  {
    contextFrames: [
      'Seismologists deployed fiber-optic cables across the volcanic caldera.',
      'Conventional borehole sensors are expensive to maintain in acidic geothermal fields.',
      'Laser pulses sent through standard telecom fibers can detect minute ground strains.',
    ],
    clause1Prefix: 'An unused telecommunications cable already crossed the',
    lastWord1: 'basin',
    firstWord2Lower: 'the',
    firstWord2Upper: 'The',
    clause2Rest: 'team converted ten kilometers of fiber into a dense seismic array.',
    conj: 'so',
    adv: 'therefore',
  },
]

interface InsideItem {
  intros: readonly [string, string, string]
  rolePhrase: string
  restrictiveName: string
  verb: string
  objectPhrase: string
  nonrestrictiveApp: string
  tail: string
}

const INSIDE_ITEMS: readonly InsideItem[] = [
  {
    intros: [
      'Working from a rooftop observatory on Nantucket in 1847,',
      'During a clear October night on Nantucket Island,',
      'Decades before photography became standard in astronomy,',
    ],
    rolePhrase: 'the astronomer',
    restrictiveName: 'Maria Mitchell',
    verb: 'used',
    objectPhrase: 'a brass refractor',
    nonrestrictiveApp: 'a compact two-inch telescope',
    tail: 'to chart the orbit of a previously unknown comet.',
  },
  {
    intros: [
      'During a botanical expedition through the high Andes in 1928,',
      'Climbing above the timberline in the Ecuadorian highlands,',
      'To expand the herbarium collection at the university,',
    ],
    rolePhrase: 'the botanist',
    restrictiveName: 'Ynes Mexia',
    verb: 'collected',
    objectPhrase: 'the highland shrub Espeletia',
    nonrestrictiveApp: 'a woolly rosette plant',
    tail: 'from windswept slopes twelve thousand feet above sea level.',
  },
  {
    intros: [
      'In a Harlem studio filled with natural skylight,',
      'Working with limited funds during the Great Depression,',
      'Before receiving a commission for the 1939 World’s Fair,',
    ],
    rolePhrase: 'the sculptor',
    restrictiveName: 'Augusta Savage',
    verb: 'modeled',
    objectPhrase: 'the portrait bust Gamin',
    nonrestrictiveApp: 'a painted plaster study of a neighborhood youth',
    tail: 'that earned a fellowship to study in Paris.',
  },
  {
    intros: [
      'Surveying the rugged metamorphic outcrops of eastern Pennsylvania,',
      'As the first woman hired by the United States Geological Survey,',
      'Combining thin-section microscopy with months of fieldwork,',
    ],
    rolePhrase: 'the geologist',
    restrictiveName: 'Florence Bascom',
    verb: 'mapped',
    objectPhrase: 'the Wissahickon schist',
    nonrestrictiveApp: 'a belt of recrystallized mica rock',
    tail: 'across the Piedmont region near Philadelphia.',
  },
  {
    intros: [
      'After the 1906 earthquake damaged dozens of masonry buildings in the Bay Area,',
      'Drawing on her engineering training at the Ecole des Beaux-Arts,',
      'Over a career spanning more than seven hundred California buildings,',
    ],
    rolePhrase: 'the architect',
    restrictiveName: 'Julia Morgan',
    verb: 'specified',
    objectPhrase: 'reinforced concrete',
    nonrestrictiveApp: 'a composite material strengthened with steel bars',
    tail: 'for the bell tower on the Oakland campus.',
  },
  {
    intros: [
      'Kneeling beside tide pools along the rocky coast of Maine,',
      'Long before writing her landmark book on synthetic pesticides,',
      'With a hand lens and a waterproof field notebook,',
    ],
    rolePhrase: 'the marine biologist',
    restrictiveName: 'Rachel Carson',
    verb: 'observed',
    objectPhrase: 'the periwinkle Littorina',
    nonrestrictiveApp: 'a small spiral-shelled snail',
    tail: 'grazing on microscopic algae between high and low tide.',
  },
  {
    intros: [
      'In a laboratory at Washington University in the late 1940s,',
      'Investigating how embryonic nerve fibers find their targets,',
      'Working alongside Viktor Hamburger in St. Louis,',
    ],
    rolePhrase: 'the neurobiologist',
    restrictiveName: 'Rita Levi-Montalcini',
    verb: 'isolated',
    objectPhrase: 'nerve growth factor',
    nonrestrictiveApp: 'a signaling protein essential for neuron survival',
    tail: 'from rapidly dividing tissue cultures.',
  },
  {
    intros: [
      'Analyzing earthquake waves that had traveled through the center of the Earth,',
      'From a seismological station near Copenhagen in 1936,',
      'Comparing arrival times from distant Pacific earthquakes,',
    ],
    rolePhrase: 'the seismologist',
    restrictiveName: 'Inge Lehmann',
    verb: 'identified',
    objectPhrase: 'the inner core',
    nonrestrictiveApp: 'a solid metallic sphere inside the molten outer core',
    tail: 'by tracing reflected primary waves.',
  },
  {
    intros: [
      'At the Tuskegee experimental plots in the early twentieth century,',
      'Seeking practical ways to restore nitrogen to depleted cotton soils,',
      'Through agricultural bulletins written for small family farms,',
    ],
    rolePhrase: 'the agronomist',
    restrictiveName: 'George Washington Carver',
    verb: 'promoted',
    objectPhrase: 'the cowpea',
    nonrestrictiveApp: 'a drought-tolerant legume that enriches soil nitrogen',
    tail: 'as a seasonal rotation crop across the South.',
  },
  {
    intros: [
      'Using X-ray diffraction cameras at King’s College London,',
      'By controlling the humidity inside the specimen chamber,',
      'Before turning her attention to the structure of tobacco mosaic virus,',
    ],
    rolePhrase: 'the physical chemist',
    restrictiveName: 'Rosalind Franklin',
    verb: 'recorded',
    objectPhrase: 'Photograph 51',
    nonrestrictiveApp: 'a sharp X-ray diffraction image of hydrated DNA fibers',
    tail: 'that revealed the helical geometry of the molecule.',
  },
  {
    intros: [
      'At the Harvard College Observatory at the turn of the twentieth century,',
      'Examining photographic glass plates from the Peruvian station,',
      'By comparing the brightness cycle of variable stars in the Magellanic Clouds,',
    ],
    rolePhrase: 'the astronomer',
    restrictiveName: 'Henrietta Swan Leavitt',
    verb: 'established',
    objectPhrase: 'the period-luminosity relation',
    nonrestrictiveApp: 'a rule linking pulsation rate to intrinsic brightness',
    tail: 'for measuring distances across the cosmos.',
  },
  {
    intros: [
      'In a makeshift shed behind the Municipal School of Physics in Paris,',
      'Processing tons of pitchblende residue by hand,',
      'Using a sensitive piezoelectric electrometer built by Pierre Curie,',
    ],
    rolePhrase: 'the physicist',
    restrictiveName: 'Marie Curie',
    verb: 'purified',
    objectPhrase: 'radium chloride',
    nonrestrictiveApp: 'a luminescent salt far more radioactive than uranium',
    tail: 'through repeated fractional crystallization.',
  },
  {
    intros: [
      'Rehearsing her dance company in New York during the 1930s,',
      'Breaking away from the decorative poses of classical ballet,',
      'In collaborations with composer Aaron Copland,',
    ],
    rolePhrase: 'the choreographer',
    restrictiveName: 'Martha Graham',
    verb: 'developed',
    objectPhrase: 'contraction and release',
    nonrestrictiveApp: 'a movement technique grounded in the breath cycle',
    tail: 'to express dramatic tension on the modern stage.',
  },
  {
    intros: [
      'In his workshop in Mainz during the 1450s,',
      'Adapting screw presses used in Rhineland winemaking,',
      'To cast thousands of identical metal letters rapidly,',
    ],
    rolePhrase: 'the craftsman',
    restrictiveName: 'Johannes Gutenberg',
    verb: 'formulated',
    objectPhrase: 'type metal',
    nonrestrictiveApp: 'a durable alloy of lead, tin, and antimony',
    tail: 'that expanded slightly as it cooled in the mold.',
  },
  {
    intros: [
      'Walking the limestone cliffs of Lyme Regis after winter storms,',
      'Before paleontology was recognized as a formal academic discipline,',
      'Chipping away blue lias shale along the English Channel,',
    ],
    rolePhrase: 'the fossilist',
    restrictiveName: 'Mary Anning',
    verb: 'uncovered',
    objectPhrase: 'the marine reptile Plesiosaurus',
    nonrestrictiveApp: 'a long-necked predator of the Jurassic seas',
    tail: 'preserved in near-complete articulation.',
  },
  {
    intros: [
      'In the optics room at Woolsthorpe Manor in 1666,',
      'Allowing a narrow beam of sunlight to enter a darkened chamber,',
      'By placing a second inverted prism in the path of the colored beam,',
    ],
    rolePhrase: 'the natural philosopher',
    restrictiveName: 'Isaac Newton',
    verb: 'demonstrated',
    objectPhrase: 'optical dispersion',
    nonrestrictiveApp: 'the separation of white light into its component colors',
    tail: 'before the Royal Society of London.',
  },
  {
    intros: [
      'While cataloging marine invertebrates at the Naples Zoological Station,',
      'Studying the fertilization of sea urchin and mealworm eggs,',
      'Independently of Walter Sutton’s work on grasshoppers,',
    ],
    rolePhrase: 'the geneticist',
    restrictiveName: 'Nettie Stevens',
    verb: 'traced',
    objectPhrase: 'chromosomal sex determination',
    nonrestrictiveApp: 'the inheritance of X and Y chromosomes during meiosis',
    tail: 'through meticulous light-microscope drawings.',
  },
  {
    intros: [
      'During the construction of the Brooklyn Bridge in the 1870s,',
      'After decompression sickness incapacitated the chief engineer,',
      'Communicating daily with the caisson crews across the East River,',
    ],
    rolePhrase: 'the field engineer',
    restrictiveName: 'Emily Warren Roebling',
    verb: 'supervised',
    objectPhrase: 'the cable spinning',
    nonrestrictiveApp: 'the stringing of galvanized steel wires across the towers',
    tail: 'until the suspension span opened in 1883.',
  },
  {
    intros: [
      'In the greenhouse behind the monastery in Brno,',
      'Tracking seven distinct traits across nearly thirty thousand plants,',
      'By counting the ratio of smooth to wrinkled seeds in each generation,',
    ],
    rolePhrase: 'the researcher',
    restrictiveName: 'Gregor Mendel',
    verb: 'formulated',
    objectPhrase: 'the law of segregation',
    nonrestrictiveApp: 'a principle explaining how recessive traits reappear',
    tail: 'decades before chromosomes were seen under a microscope.',
  },
  {
    intros: [
      'Aboard the research vessel Vema in the mid-twentieth century,',
      'Translating sonar echo soundings into physiographic relief maps,',
      'Working with Bruce Heezen at the Lamont Geological Observatory,',
    ],
    rolePhrase: 'the cartographer',
    restrictiveName: 'Marie Tharp',
    verb: 'charted',
    objectPhrase: 'the Mid-Atlantic Ridge',
    nonrestrictiveApp: 'a continuous underwater mountain chain split by a rift valley',
    tail: 'that provided visual evidence for continental drift.',
  },
]

function generateJoin(seed: number, knobs: DifficultyKnobs): ProblemInstance {
  const s = ((seed | 0) === 0 ? 1 : Math.abs(seed | 0))
  const pairIdx = (s - 1) % JOIN_PAIRS.length
  const ctxIdx = Math.floor((s - 1) / JOIN_PAIRS.length) % 3
  const rightMode = (s - 1) % 3
  const trapMode = Math.floor((s - 1) / 3) % 2

  const item = JOIN_PAIRS[pairIdx]!
  const context = item.contextFrames[ctxIdx]!

  const statementText = `${context} ${item.clause1Prefix} ______ ${item.clause2Rest}`
  const prompt = 'Which choice completes the text so that it conforms to the conventions of Standard English?'

  let rightText: string
  let rightExplain: string
  if (rightMode === 0) {
    rightText = `${item.lastWord1}. ${item.firstWord2Upper}`
    rightExplain = `A period after "${item.lastWord1}" and a capital "${item.firstWord2Upper}" properly separate the two complete sentences.`
  } else if (rightMode === 1) {
    rightText = `${item.lastWord1}; ${item.firstWord2Lower}`
    rightExplain = `A semicolon after "${item.lastWord1}" properly links the two closely related complete sentences.`
  } else {
    rightText = `${item.lastWord1}, ${item.conj} ${item.firstWord2Lower}`
    rightExplain = `A comma followed by the coordinating conjunction "${item.conj}" properly joins the two complete sentences.`
  }

  const spliceText = `${item.lastWord1}, ${item.firstWord2Lower}`
  const spliceNudge = `Two complete sentences are joined with only a comma after "${item.lastWord1}", creating a comma splice.`

  const runOnText = `${item.lastWord1} ${item.firstWord2Lower}`
  const runOnNudge = `Two complete sentences run together after "${item.lastWord1}" with no punctuation or conjunction between them.`

  const secondWrong: { text: string; mistake: ErrorPatternId; nudge: string } =
    trapMode === 0
      ? {
          text: `${item.lastWord1} ${item.conj} ${item.firstWord2Lower}`,
          mistake: 'rw_run_on' as ErrorPatternId,
          nudge: `Joining two complete sentences with the coordinating conjunction "${item.conj}" requires a comma before "${item.conj}".`,
        }
      : {
          text: `${item.lastWord1}, ${item.adv} ${item.firstWord2Lower}`,
          mistake: 'rw_comma_splice' as ErrorPatternId,
          nudge: `"${item.adv[0]!.toUpperCase() + item.adv.slice(1)}" is a transition word, not a coordinating conjunction, so a comma before it still creates a comma splice.`,
        }

  const { options, correctId, correctText } = buildSatRwOptions(seed, 0x71b1, [
    { text: rightText, correct: true },
    { text: spliceText, correct: false, mistake: 'rw_comma_splice' as ErrorPatternId, nudge: spliceNudge },
    { text: runOnText, correct: false, mistake: 'rw_run_on' as ErrorPatternId, nudge: runOnNudge },
    { text: secondWrong.text, correct: false, mistake: secondWrong.mistake, nudge: secondWrong.nudge },
  ])

  const reveal = [
    `Both parts around the blank are complete sentences (independent clauses): "${item.clause1Prefix} ${item.lastWord1}" and "${item.firstWord2Upper} ${item.clause2Rest}"`,
    rightExplain,
    `Therefore, choice ${correctId} ("${correctText}") is the only grammatically valid boundary.`,
  ]

  const answer: SatRwAnswer = {
    type: 'satrw',
    prompt,
    options,
    correctId,
    correctText,
    nudge: 'Check whether the words before and after the blank can each stand alone as a complete sentence.',
    ruleCard: R_JOIN,
    ruleCards: [R_JOIN],
    reveal,
    correctMessage: `Right — "${correctText}" joins the two independent clauses cleanly.`,
  }

  return {
    id: `rwBoundaries/rb.join@${GEN_VERSION}/${(seed >>> 0).toString(36)}`,
    moduleId: 'rwBoundaries' as ModuleId,
    templateId: 'rb.join',
    skill: 'rb.join',
    genVersion: GEN_VERSION,
    seed,
    knobs,
    kind: 'satrw',
    title: 'Joining clauses: period, semicolon, and conjunctions',
    instructions: prompt,
    statementText,
    vars: [],
    start: null,
    canonical: [],
    answer,
    graph: NONE_GRAPH,
    calc: EMPTY_CALC,
    params: { pairIdx, ctxIdx, rightMode, trapMode },
  }
}

function generateInside(seed: number, knobs: DifficultyKnobs): ProblemInstance {
  const s = ((seed | 0) === 0 ? 1 : Math.abs(seed | 0))
  const itemIdx = (s - 1) % INSIDE_ITEMS.length
  const introIdx = Math.floor((s - 1) / INSIDE_ITEMS.length) % 3
  const halfSide = (s - 1) % 2

  const item = INSIDE_ITEMS[itemIdx]!
  const intro = item.intros[introIdx]!

  const statementText = `${intro} ______ ${item.tail}`
  const prompt = 'Which choice completes the text so that it conforms to the conventions of Standard English?'

  const rightText = `${item.rolePhrase} ${item.restrictiveName} ${item.verb} ${item.objectPhrase}, ${item.nonrestrictiveApp},`

  const halfText =
    halfSide === 0
      ? `${item.rolePhrase} ${item.restrictiveName} ${item.verb} ${item.objectPhrase}, ${item.nonrestrictiveApp}`
      : `${item.rolePhrase} ${item.restrictiveName} ${item.verb} ${item.objectPhrase} ${item.nonrestrictiveApp},`
  const halfNudge =
    halfSide === 0
      ? `The nonessential phrase "${item.nonrestrictiveApp}" opens with a comma after "${item.objectPhrase}" but drops the closing comma.`
      : `The nonessential phrase "${item.nonrestrictiveApp}" has a closing comma but drops the opening comma after "${item.objectPhrase}".`

  const restrictiveText = `${item.rolePhrase}, ${item.restrictiveName}, ${item.verb} ${item.objectPhrase}, ${item.nonrestrictiveApp},`
  const restrictiveNudge = `The name "${item.restrictiveName}" is a restrictive identifier telling which ${item.rolePhrase.replace(/^the\s+/i, '')} is meant, so it must not be set off with commas.`

  const svText = `${item.rolePhrase} ${item.restrictiveName}, ${item.verb} ${item.objectPhrase}, ${item.nonrestrictiveApp},`
  const svNudge = `A single comma after "${item.restrictiveName}" wrongly separates the subject "${item.rolePhrase} ${item.restrictiveName}" from its verb "${item.verb}".`

  const { options, correctId, correctText } = buildSatRwOptions(seed, 0x71b2, [
    { text: rightText, correct: true },
    { text: halfText, correct: false, mistake: 'rw_half_pair' as ErrorPatternId, nudge: halfNudge },
    { text: restrictiveText, correct: false, mistake: 'rw_restrictive_commas' as ErrorPatternId, nudge: restrictiveNudge },
    { text: svText, correct: false, mistake: 'rw_subject_verb_comma' as ErrorPatternId, nudge: svNudge },
  ])

  const reveal = [
    `"${item.restrictiveName}" is a restrictive identifier specifying which ${item.rolePhrase.replace(/^the\s+/i, '')} is meant, so no commas go around "${item.restrictiveName}" and no comma separates the subject from its verb "${item.verb}".`,
    `"${item.nonrestrictiveApp}" is a nonessential appositive describing "${item.objectPhrase}", so it must be enclosed in a matching pair of commas.`,
    `Choice ${correctId} ("${correctText}") is the only option with paired commas around the appositive and no unnecessary commas in the subject.`,
  ]

  const answer: SatRwAnswer = {
    type: 'satrw',
    prompt,
    options,
    correctId,
    correctText,
    nudge: 'Check which phrase adds nonessential extra description (needs a pair of commas) and which name is essential to identify the subject (needs no commas).',
    ruleCard: R_INSIDE,
    ruleCards: [R_INSIDE],
    reveal,
    correctMessage: `Right — paired commas set off "${item.nonrestrictiveApp}" while keeping the subject and verb unbroken.`,
  }

  return {
    id: `rwBoundaries/rb.inside@${GEN_VERSION}/${(seed >>> 0).toString(36)}`,
    moduleId: 'rwBoundaries' as ModuleId,
    templateId: 'rb.inside',
    skill: 'rb.inside',
    genVersion: GEN_VERSION,
    seed,
    knobs,
    kind: 'satrw',
    title: 'Commas inside a clause: appositives and nonrestrictive phrases',
    instructions: prompt,
    statementText,
    vars: [],
    start: null,
    canonical: [],
    answer,
    graph: NONE_GRAPH,
    calc: EMPTY_CALC,
    params: { itemIdx, introIdx, halfSide },
  }
}

function progress(): ProgressInfo {
  return { stage: 0, total: 1, label: 'Choose the option that follows Standard English conventions', anchorIndex: -1, path: 'none' }
}

export const rwBoundariesModule: ModuleDef = {
  id: 'rwBoundaries' as ModuleId,
  subject: 'English',
  title: 'Boundaries: joining and punctuating clauses',
  blurb: 'Join complete sentences with periods, semicolons, or comma + conjunction, and punctuate nonessential phrases with paired commas without splitting subjects from verbs.',
  order: 50,
  templates: [
    {
      id: 'rb.join',
      title: 'Joining clauses: period, semicolon, and conjunctions',
      description: 'Connect two independent clauses using a period, a semicolon, or a comma plus a coordinating conjunction while avoiding comma splices and run-ons.',
      version: GEN_VERSION,
      knobs: [],
      generate: generateJoin,
    },
    {
      id: 'rb.inside',
      title: 'Commas inside a clause: appositives and nonrestrictive phrases',
      description: 'Enclose nonrestrictive appositives in paired commas while keeping restrictive identifiers and the subject–verb link free of stray commas.',
      version: GEN_VERSION,
      knobs: [],
      generate: generateInside,
    },
  ],
  ruleCards: RULE_CARDS,
  progress,
  nextStep: () => null,
}

registerModule(rwBoundariesModule)
