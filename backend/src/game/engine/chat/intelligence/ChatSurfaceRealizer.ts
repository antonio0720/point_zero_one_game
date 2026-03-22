/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT SURFACE REALIZER
 * FILE: backend/src/game/engine/chat/intelligence/ChatSurfaceRealizer.ts
 * VERSION: 2026.03.21-surface-realizer-depth.v16
 * ============================================================================
 *
 * Backend-authoritative realization lane for canonical authored lines.
 *
 * Design doctrine
 * ---------------
 * - Keep the shared contract untouched.
 * - Stay deterministic from line + context.
 * - Deepen transform planning and phrase shaping without importing frontend UI.
 * - Produce richer strategy / rhetorical / semantic / tag surfaces for backend
 *   ranking, auditing, memory, replay, explainability, and scene direction.
 * - Preserve this backend file as a servant to the shared contract instead of
 *   inventing a second incompatible authority lane.
 * ============================================================================
 */

import type {
  SharedCanonicalChatLine,
  SharedChatRealizationContext,
  SharedChatRealizationResult,
  SharedChatRealizationTransform,
} from '../../../../../../shared/contracts/chat/surface-realization';

export const CHAT_SURFACE_REALIZER_VERSION = '2026.03.21-surface-realizer-depth.v16' as const;

type InternalTone = 'ICE' | 'COLD' | 'CONTROLLED' | 'HOT' | 'RITUAL';
type InternalHeatBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type InternalCadence = 'TIGHT' | 'BALANCED' | 'EXPANSIVE';
type InternalPublicness = 'PRIVATE' | 'HYBRID' | 'PUBLIC';
type InternalModeFlavor = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM' | 'GENERIC';
type InternalClauseShape = 'EDGE' | 'BALANCE' | 'SURGE' | 'RECORD' | 'CUT';
type InternalWitnessState = 'THIN' | 'PRESENT' | 'WATCHFUL' | 'TOTAL';

interface SignalVector {
  respect: number;
  contempt: number;
  fear: number;
  fascination: number;
  tone: InternalTone;
  heatBand: InternalHeatBand;
  cadence: InternalCadence;
  publicness: InternalPublicness;
  callbackWeight: number;
  volatility: number;
  intimacy: number;
  formality: number;
  witnessState: InternalWitnessState;
}

interface LexicalDigest {
  tokens: readonly string[];
  topLexemes: readonly string[];
  rareLexemes: readonly string[];
  motifStem: string;
  clauseShape: InternalClauseShape;
  sentenceCount: number;
  questionCount: number;
  exclamationCount: number;
  quotationCount: number;
}

interface SceneDigest {
  sceneFlavor: InternalModeFlavor;
  sceneArchetypeSlug: string;
  sceneRoleSlug: string;
  roleHints: readonly string[];
  archetypeHints: readonly string[];
  tagHints: readonly string[];
}

interface RealizationPlan {
  seed: number;
  explicitTransforms: readonly SharedChatRealizationTransform[];
  inferredTransforms: readonly SharedChatRealizationTransform[];
  transforms: readonly SharedChatRealizationTransform[];
  signals: SignalVector;
  lexical: LexicalDigest;
  scene: SceneDigest;
  motifCluster: string;
  rhetoricalBase: string;
  openingLead: string | null;
  bridgeLead: string | null;
  closingEcho: string | null;
  styleFingerprint: string;
}

interface TransformRuntime {
  line: SharedCanonicalChatLine;
  context: SharedChatRealizationContext;
  plan: RealizationPlan;
}

export interface ChatSurfaceRealizerExplainResult {
  readonly canonicalLineId: string;
  readonly strategy: string;
  readonly seed: number;
  readonly tone: InternalTone;
  readonly heatBand: InternalHeatBand;
  readonly cadence: InternalCadence;
  readonly publicness: InternalPublicness;
  readonly sceneFlavor: InternalModeFlavor;
  readonly motifCluster: string;
  readonly rhetoricalBase: string;
  readonly styleFingerprint: string;
  readonly transformsExplicit: readonly SharedChatRealizationTransform[];
  readonly transformsInferred: readonly SharedChatRealizationTransform[];
  readonly transformsApplied: readonly SharedChatRealizationTransform[];
  readonly roleHints: readonly string[];
  readonly archetypeHints: readonly string[];
  readonly tagHints: readonly string[];
  readonly lexical: Readonly<LexicalDigest>;
}

export interface ChatSurfaceRealizerCandidateScore {
  readonly canonicalLineId: string;
  readonly score: number;
  readonly result: SharedChatRealizationResult;
  readonly explanation: ChatSurfaceRealizerExplainResult;
}

export interface ChatSurfaceRealizerManifest {
  readonly version: typeof CHAT_SURFACE_REALIZER_VERSION;
  readonly supportedTransforms: readonly SharedChatRealizationTransform[];
  readonly sceneFlavors: readonly InternalModeFlavor[];
  readonly tones: readonly InternalTone[];
  readonly heatBands: readonly InternalHeatBand[];
  readonly publicnessModes: readonly InternalPublicness[];
}

const EMPTY_TAGS: readonly string[] = Object.freeze([]);
const EMPTY_TRANSFORMS: readonly SharedChatRealizationTransform[] = Object.freeze([]);

const SUPPORTED_TRANSFORMS: readonly SharedChatRealizationTransform[] = Object.freeze([
  'SHORTER_COLDER',
  'LONGER_CEREMONIAL',
  'MORE_DIRECT',
  'MORE_MOCKING',
  'MORE_INTIMATE',
  'MORE_PUBLIC',
  'MORE_POST_EVENT',
  'MORE_PRE_EVENT',
  'PRESSURE_REWRITE',
  'CALLBACK_REWRITE',
  'PERSONAL_HISTORY_REWRITE',
]);

const PRIORITY: Readonly<Record<SharedChatRealizationTransform, number>> = Object.freeze({
  MORE_PRE_EVENT: 10,
  MORE_POST_EVENT: 20,
  MORE_PUBLIC: 30,
  PERSONAL_HISTORY_REWRITE: 40,
  CALLBACK_REWRITE: 50,
  PRESSURE_REWRITE: 60,
  MORE_INTIMATE: 70,
  MORE_DIRECT: 80,
  MORE_MOCKING: 90,
  SHORTER_COLDER: 100,
  LONGER_CEREMONIAL: 110,
});

const STOPWORDS = new Set<string>([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'if',
  'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'our', 'that', 'the', 'their',
  'there', 'this', 'to', 'was', 'we', 'were', 'with', 'you', 'your', 'they', 'them',
  'those', 'these', 'who', 'whom', 'when', 'where', 'why', 'how', 'than', 'then',
]);



const TONE_FOUNDATION_LEADS = Object.freeze({
  "ICE": Object.freeze([
    "This arrives without warmth and without delay.",
    "No softness belongs to this exchange.",
    "The sentence enters already sharpened.",
    "There is no decorative mercy here.",
    "The answer was colder than the room expected.",
    "This line was built to remove ambiguity.",
    "No one in the room mistook the intention.",
    "The tone already closed one exit.",
  ]),
  "COLD": Object.freeze([
    "The structure is visible if you stop pretending otherwise.",
    "Calm does not mean kind.",
    "The room heard the correction underneath the wording.",
    "This lands with measured contempt, not noise.",
    "Precision can still be hostile.",
    "The distance in the sentence is intentional.",
    "This is the cleaner version of a harsher truth.",
    "The wording is tidy because the judgment already settled.",
  ]),
  "CONTROLLED": Object.freeze([
    "Observe the structure before you react to the surface.",
    "This is still within the frame of deliberate control.",
    "The room is not loud, but it is attentive.",
    "Nothing here is accidental or overheated.",
    "The exchange remains governed even while pressure rises.",
    "The line is balanced enough to remain useful.",
    "This is measured pressure, not random noise.",
    "There is design in how the sentence turns.",
  ]),
  "HOT": Object.freeze([
    "The room felt the temperature change immediately.",
    "Attention moved faster than anyone admitted.",
    "The sentence entered carrying momentum.",
    "The exchange is no longer emotionally neutral.",
    "This is what pressure sounds like when it becomes visible.",
    "The crowd is already leaning toward consequence.",
    "The air around the line is warmer than the wording admits.",
    "The moment gained volatility before the clause ended.",
  ]),
  "RITUAL": Object.freeze([
    "The line enters like a record, not a reaction.",
    "This reads less like chatter and more like inscription.",
    "The room receives the wording as if it matters beyond the beat.",
    "The sentence arrives with ceremonial weight.",
    "This was spoken as though witness itself were listening.",
    "The wording behaves like a declaration under seal.",
    "The exchange sounds authored for memory, not drift.",
    "This carries the gravity of a deliberate mark.",
  ]),
});

const HEAT_BAND_MODIFIERS = Object.freeze({
  "LOW": Object.freeze([
    "The edge is present but controlled.",
    "The room can still absorb this lightly.",
    "The pressure is legible without being terminal.",
    "There is room to redirect if someone acts cleanly.",
  ]),
  "MEDIUM": Object.freeze([
    "The room has started attaching consequence to phrasing.",
    "This is the range where minor mistakes start looking expensive.",
    "The exchange is no longer casual in any meaningful sense.",
    "Momentum can still be redirected, but not ignored.",
  ]),
  "HIGH": Object.freeze([
    "Consequence is now sticking to each clause.",
    "The room has stopped granting cheap interpretations.",
    "Every delay now looks more strategic than innocent.",
    "The sentence is operating inside visible danger.",
  ]),
  "CRITICAL": Object.freeze([
    "Nothing in the room is buffering impact anymore.",
    "Interpretation has narrowed to hard consequence.",
    "The exchange is beyond cosmetic containment.",
    "Every clause now lands under full exposure.",
  ]),
});

const ROLE_HINT_BANK = Object.freeze({
  "opener": Object.freeze([
    "As opener, the line enters with measured intent.",
    "As opener, the line enters with visible intent.",
    "As opener, the line enters with deliberate intent.",
    "As opener, the line enters with situational intent.",
    "As opener, the line enters with targeted intent.",
    "As opener, the line enters with theatrical intent.",
    "As opener, the line enters with memory-bearing intent.",
    "As opener, the line enters with constrained intent.",
  ]),
  "closer": Object.freeze([
    "As closer, the line enters with measured intent.",
    "As closer, the line enters with visible intent.",
    "As closer, the line enters with deliberate intent.",
    "As closer, the line enters with situational intent.",
    "As closer, the line enters with targeted intent.",
    "As closer, the line enters with theatrical intent.",
    "As closer, the line enters with memory-bearing intent.",
    "As closer, the line enters with constrained intent.",
  ]),
  "witness": Object.freeze([
    "As witness, the line enters with measured intent.",
    "As witness, the line enters with visible intent.",
    "As witness, the line enters with deliberate intent.",
    "As witness, the line enters with situational intent.",
    "As witness, the line enters with targeted intent.",
    "As witness, the line enters with theatrical intent.",
    "As witness, the line enters with memory-bearing intent.",
    "As witness, the line enters with constrained intent.",
  ]),
  "crowd-witness": Object.freeze([
    "As crowd witness, the line enters with measured intent.",
    "As crowd witness, the line enters with visible intent.",
    "As crowd witness, the line enters with deliberate intent.",
    "As crowd witness, the line enters with situational intent.",
    "As crowd witness, the line enters with targeted intent.",
    "As crowd witness, the line enters with theatrical intent.",
    "As crowd witness, the line enters with memory-bearing intent.",
    "As crowd witness, the line enters with constrained intent.",
  ]),
  "interceptor": Object.freeze([
    "As interceptor, the line enters with measured intent.",
    "As interceptor, the line enters with visible intent.",
    "As interceptor, the line enters with deliberate intent.",
    "As interceptor, the line enters with situational intent.",
    "As interceptor, the line enters with targeted intent.",
    "As interceptor, the line enters with theatrical intent.",
    "As interceptor, the line enters with memory-bearing intent.",
    "As interceptor, the line enters with constrained intent.",
  ]),
  "auditor": Object.freeze([
    "As auditor, the line enters with measured intent.",
    "As auditor, the line enters with visible intent.",
    "As auditor, the line enters with deliberate intent.",
    "As auditor, the line enters with situational intent.",
    "As auditor, the line enters with targeted intent.",
    "As auditor, the line enters with theatrical intent.",
    "As auditor, the line enters with memory-bearing intent.",
    "As auditor, the line enters with constrained intent.",
  ]),
  "archivist": Object.freeze([
    "As archivist, the line enters with measured intent.",
    "As archivist, the line enters with visible intent.",
    "As archivist, the line enters with deliberate intent.",
    "As archivist, the line enters with situational intent.",
    "As archivist, the line enters with targeted intent.",
    "As archivist, the line enters with theatrical intent.",
    "As archivist, the line enters with memory-bearing intent.",
    "As archivist, the line enters with constrained intent.",
  ]),
  "mentor": Object.freeze([
    "As mentor, the line enters with measured intent.",
    "As mentor, the line enters with visible intent.",
    "As mentor, the line enters with deliberate intent.",
    "As mentor, the line enters with situational intent.",
    "As mentor, the line enters with targeted intent.",
    "As mentor, the line enters with theatrical intent.",
    "As mentor, the line enters with memory-bearing intent.",
    "As mentor, the line enters with constrained intent.",
  ]),
  "rival": Object.freeze([
    "As rival, the line enters with measured intent.",
    "As rival, the line enters with visible intent.",
    "As rival, the line enters with deliberate intent.",
    "As rival, the line enters with situational intent.",
    "As rival, the line enters with targeted intent.",
    "As rival, the line enters with theatrical intent.",
    "As rival, the line enters with memory-bearing intent.",
    "As rival, the line enters with constrained intent.",
  ]),
  "helper": Object.freeze([
    "As helper, the line enters with measured intent.",
    "As helper, the line enters with visible intent.",
    "As helper, the line enters with deliberate intent.",
    "As helper, the line enters with situational intent.",
    "As helper, the line enters with targeted intent.",
    "As helper, the line enters with theatrical intent.",
    "As helper, the line enters with memory-bearing intent.",
    "As helper, the line enters with constrained intent.",
  ]),
  "hater": Object.freeze([
    "As hater, the line enters with measured intent.",
    "As hater, the line enters with visible intent.",
    "As hater, the line enters with deliberate intent.",
    "As hater, the line enters with situational intent.",
    "As hater, the line enters with targeted intent.",
    "As hater, the line enters with theatrical intent.",
    "As hater, the line enters with memory-bearing intent.",
    "As hater, the line enters with constrained intent.",
  ]),
  "dealer": Object.freeze([
    "As dealer, the line enters with measured intent.",
    "As dealer, the line enters with visible intent.",
    "As dealer, the line enters with deliberate intent.",
    "As dealer, the line enters with situational intent.",
    "As dealer, the line enters with targeted intent.",
    "As dealer, the line enters with theatrical intent.",
    "As dealer, the line enters with memory-bearing intent.",
    "As dealer, the line enters with constrained intent.",
  ]),
  "broker": Object.freeze([
    "As broker, the line enters with measured intent.",
    "As broker, the line enters with visible intent.",
    "As broker, the line enters with deliberate intent.",
    "As broker, the line enters with situational intent.",
    "As broker, the line enters with targeted intent.",
    "As broker, the line enters with theatrical intent.",
    "As broker, the line enters with memory-bearing intent.",
    "As broker, the line enters with constrained intent.",
  ]),
  "judge": Object.freeze([
    "As judge, the line enters with measured intent.",
    "As judge, the line enters with visible intent.",
    "As judge, the line enters with deliberate intent.",
    "As judge, the line enters with situational intent.",
    "As judge, the line enters with targeted intent.",
    "As judge, the line enters with theatrical intent.",
    "As judge, the line enters with memory-bearing intent.",
    "As judge, the line enters with constrained intent.",
  ]),
  "enforcer": Object.freeze([
    "As enforcer, the line enters with measured intent.",
    "As enforcer, the line enters with visible intent.",
    "As enforcer, the line enters with deliberate intent.",
    "As enforcer, the line enters with situational intent.",
    "As enforcer, the line enters with targeted intent.",
    "As enforcer, the line enters with theatrical intent.",
    "As enforcer, the line enters with memory-bearing intent.",
    "As enforcer, the line enters with constrained intent.",
  ]),
  "saboteur": Object.freeze([
    "As saboteur, the line enters with measured intent.",
    "As saboteur, the line enters with visible intent.",
    "As saboteur, the line enters with deliberate intent.",
    "As saboteur, the line enters with situational intent.",
    "As saboteur, the line enters with targeted intent.",
    "As saboteur, the line enters with theatrical intent.",
    "As saboteur, the line enters with memory-bearing intent.",
    "As saboteur, the line enters with constrained intent.",
  ]),
  "echo": Object.freeze([
    "As echo, the line enters with measured intent.",
    "As echo, the line enters with visible intent.",
    "As echo, the line enters with deliberate intent.",
    "As echo, the line enters with situational intent.",
    "As echo, the line enters with targeted intent.",
    "As echo, the line enters with theatrical intent.",
    "As echo, the line enters with memory-bearing intent.",
    "As echo, the line enters with constrained intent.",
  ]),
  "shadow-marker": Object.freeze([
    "As shadow marker, the line enters with measured intent.",
    "As shadow marker, the line enters with visible intent.",
    "As shadow marker, the line enters with deliberate intent.",
    "As shadow marker, the line enters with situational intent.",
    "As shadow marker, the line enters with targeted intent.",
    "As shadow marker, the line enters with theatrical intent.",
    "As shadow marker, the line enters with memory-bearing intent.",
    "As shadow marker, the line enters with constrained intent.",
  ]),
  "narrator": Object.freeze([
    "As narrator, the line enters with measured intent.",
    "As narrator, the line enters with visible intent.",
    "As narrator, the line enters with deliberate intent.",
    "As narrator, the line enters with situational intent.",
    "As narrator, the line enters with targeted intent.",
    "As narrator, the line enters with theatrical intent.",
    "As narrator, the line enters with memory-bearing intent.",
    "As narrator, the line enters with constrained intent.",
  ]),
  "negotiator": Object.freeze([
    "As negotiator, the line enters with measured intent.",
    "As negotiator, the line enters with visible intent.",
    "As negotiator, the line enters with deliberate intent.",
    "As negotiator, the line enters with situational intent.",
    "As negotiator, the line enters with targeted intent.",
    "As negotiator, the line enters with theatrical intent.",
    "As negotiator, the line enters with memory-bearing intent.",
    "As negotiator, the line enters with constrained intent.",
  ]),
  "rescue": Object.freeze([
    "As rescue, the line enters with measured intent.",
    "As rescue, the line enters with visible intent.",
    "As rescue, the line enters with deliberate intent.",
    "As rescue, the line enters with situational intent.",
    "As rescue, the line enters with targeted intent.",
    "As rescue, the line enters with theatrical intent.",
    "As rescue, the line enters with memory-bearing intent.",
    "As rescue, the line enters with constrained intent.",
  ]),
  "commentator": Object.freeze([
    "As commentator, the line enters with measured intent.",
    "As commentator, the line enters with visible intent.",
    "As commentator, the line enters with deliberate intent.",
    "As commentator, the line enters with situational intent.",
    "As commentator, the line enters with targeted intent.",
    "As commentator, the line enters with theatrical intent.",
    "As commentator, the line enters with memory-bearing intent.",
    "As commentator, the line enters with constrained intent.",
  ]),
  "announcer": Object.freeze([
    "As announcer, the line enters with measured intent.",
    "As announcer, the line enters with visible intent.",
    "As announcer, the line enters with deliberate intent.",
    "As announcer, the line enters with situational intent.",
    "As announcer, the line enters with targeted intent.",
    "As announcer, the line enters with theatrical intent.",
    "As announcer, the line enters with memory-bearing intent.",
    "As announcer, the line enters with constrained intent.",
  ]),
  "observer": Object.freeze([
    "As observer, the line enters with measured intent.",
    "As observer, the line enters with visible intent.",
    "As observer, the line enters with deliberate intent.",
    "As observer, the line enters with situational intent.",
    "As observer, the line enters with targeted intent.",
    "As observer, the line enters with theatrical intent.",
    "As observer, the line enters with memory-bearing intent.",
    "As observer, the line enters with constrained intent.",
  ]),
});

const ARCHETYPE_HINT_BANK = Object.freeze({
  "empire": Object.freeze([
    "In empire, the room reads this through mode-specific pressure.",
    "In empire, the room reads this through social pressure.",
    "In empire, the room reads this through economic pressure.",
    "In empire, the room reads this through witnessed pressure.",
    "In empire, the room reads this through structured pressure.",
    "In empire, the room reads this through escalating pressure.",
    "In empire, the room reads this through contained pressure.",
    "In empire, the room reads this through reputational pressure.",
  ]),
  "predator": Object.freeze([
    "In predator, the room reads this through mode-specific pressure.",
    "In predator, the room reads this through social pressure.",
    "In predator, the room reads this through economic pressure.",
    "In predator, the room reads this through witnessed pressure.",
    "In predator, the room reads this through structured pressure.",
    "In predator, the room reads this through escalating pressure.",
    "In predator, the room reads this through contained pressure.",
    "In predator, the room reads this through reputational pressure.",
  ]),
  "syndicate": Object.freeze([
    "In syndicate, the room reads this through mode-specific pressure.",
    "In syndicate, the room reads this through social pressure.",
    "In syndicate, the room reads this through economic pressure.",
    "In syndicate, the room reads this through witnessed pressure.",
    "In syndicate, the room reads this through structured pressure.",
    "In syndicate, the room reads this through escalating pressure.",
    "In syndicate, the room reads this through contained pressure.",
    "In syndicate, the room reads this through reputational pressure.",
  ]),
  "phantom": Object.freeze([
    "In phantom, the room reads this through mode-specific pressure.",
    "In phantom, the room reads this through social pressure.",
    "In phantom, the room reads this through economic pressure.",
    "In phantom, the room reads this through witnessed pressure.",
    "In phantom, the room reads this through structured pressure.",
    "In phantom, the room reads this through escalating pressure.",
    "In phantom, the room reads this through contained pressure.",
    "In phantom, the room reads this through reputational pressure.",
  ]),
  "lobby": Object.freeze([
    "In lobby, the room reads this through mode-specific pressure.",
    "In lobby, the room reads this through social pressure.",
    "In lobby, the room reads this through economic pressure.",
    "In lobby, the room reads this through witnessed pressure.",
    "In lobby, the room reads this through structured pressure.",
    "In lobby, the room reads this through escalating pressure.",
    "In lobby, the room reads this through contained pressure.",
    "In lobby, the room reads this through reputational pressure.",
  ]),
  "deal-room": Object.freeze([
    "In deal room, the room reads this through mode-specific pressure.",
    "In deal room, the room reads this through social pressure.",
    "In deal room, the room reads this through economic pressure.",
    "In deal room, the room reads this through witnessed pressure.",
    "In deal room, the room reads this through structured pressure.",
    "In deal room, the room reads this through escalating pressure.",
    "In deal room, the room reads this through contained pressure.",
    "In deal room, the room reads this through reputational pressure.",
  ]),
  "showdown": Object.freeze([
    "In showdown, the room reads this through mode-specific pressure.",
    "In showdown, the room reads this through social pressure.",
    "In showdown, the room reads this through economic pressure.",
    "In showdown, the room reads this through witnessed pressure.",
    "In showdown, the room reads this through structured pressure.",
    "In showdown, the room reads this through escalating pressure.",
    "In showdown, the room reads this through contained pressure.",
    "In showdown, the room reads this through reputational pressure.",
  ]),
  "war-room": Object.freeze([
    "In war room, the room reads this through mode-specific pressure.",
    "In war room, the room reads this through social pressure.",
    "In war room, the room reads this through economic pressure.",
    "In war room, the room reads this through witnessed pressure.",
    "In war room, the room reads this through structured pressure.",
    "In war room, the room reads this through escalating pressure.",
    "In war room, the room reads this through contained pressure.",
    "In war room, the room reads this through reputational pressure.",
  ]),
  "recovery": Object.freeze([
    "In recovery, the room reads this through mode-specific pressure.",
    "In recovery, the room reads this through social pressure.",
    "In recovery, the room reads this through economic pressure.",
    "In recovery, the room reads this through witnessed pressure.",
    "In recovery, the room reads this through structured pressure.",
    "In recovery, the room reads this through escalating pressure.",
    "In recovery, the room reads this through contained pressure.",
    "In recovery, the room reads this through reputational pressure.",
  ]),
  "collapse": Object.freeze([
    "In collapse, the room reads this through mode-specific pressure.",
    "In collapse, the room reads this through social pressure.",
    "In collapse, the room reads this through economic pressure.",
    "In collapse, the room reads this through witnessed pressure.",
    "In collapse, the room reads this through structured pressure.",
    "In collapse, the room reads this through escalating pressure.",
    "In collapse, the room reads this through contained pressure.",
    "In collapse, the room reads this through reputational pressure.",
  ]),
  "momentum": Object.freeze([
    "In momentum, the room reads this through mode-specific pressure.",
    "In momentum, the room reads this through social pressure.",
    "In momentum, the room reads this through economic pressure.",
    "In momentum, the room reads this through witnessed pressure.",
    "In momentum, the room reads this through structured pressure.",
    "In momentum, the room reads this through escalating pressure.",
    "In momentum, the room reads this through contained pressure.",
    "In momentum, the room reads this through reputational pressure.",
  ]),
  "telegraph": Object.freeze([
    "In telegraph, the room reads this through mode-specific pressure.",
    "In telegraph, the room reads this through social pressure.",
    "In telegraph, the room reads this through economic pressure.",
    "In telegraph, the room reads this through witnessed pressure.",
    "In telegraph, the room reads this through structured pressure.",
    "In telegraph, the room reads this through escalating pressure.",
    "In telegraph, the room reads this through contained pressure.",
    "In telegraph, the room reads this through reputational pressure.",
  ]),
  "setup": Object.freeze([
    "In setup, the room reads this through mode-specific pressure.",
    "In setup, the room reads this through social pressure.",
    "In setup, the room reads this through economic pressure.",
    "In setup, the room reads this through witnessed pressure.",
    "In setup, the room reads this through structured pressure.",
    "In setup, the room reads this through escalating pressure.",
    "In setup, the room reads this through contained pressure.",
    "In setup, the room reads this through reputational pressure.",
  ]),
  "aftermath": Object.freeze([
    "In aftermath, the room reads this through mode-specific pressure.",
    "In aftermath, the room reads this through social pressure.",
    "In aftermath, the room reads this through economic pressure.",
    "In aftermath, the room reads this through witnessed pressure.",
    "In aftermath, the room reads this through structured pressure.",
    "In aftermath, the room reads this through escalating pressure.",
    "In aftermath, the room reads this through contained pressure.",
    "In aftermath, the room reads this through reputational pressure.",
  ]),
  "witness-circle": Object.freeze([
    "In witness circle, the room reads this through mode-specific pressure.",
    "In witness circle, the room reads this through social pressure.",
    "In witness circle, the room reads this through economic pressure.",
    "In witness circle, the room reads this through witnessed pressure.",
    "In witness circle, the room reads this through structured pressure.",
    "In witness circle, the room reads this through escalating pressure.",
    "In witness circle, the room reads this through contained pressure.",
    "In witness circle, the room reads this through reputational pressure.",
  ]),
  "legend": Object.freeze([
    "In legend, the room reads this through mode-specific pressure.",
    "In legend, the room reads this through social pressure.",
    "In legend, the room reads this through economic pressure.",
    "In legend, the room reads this through witnessed pressure.",
    "In legend, the room reads this through structured pressure.",
    "In legend, the room reads this through escalating pressure.",
    "In legend, the room reads this through contained pressure.",
    "In legend, the room reads this through reputational pressure.",
  ]),
  "audit": Object.freeze([
    "In audit, the room reads this through mode-specific pressure.",
    "In audit, the room reads this through social pressure.",
    "In audit, the room reads this through economic pressure.",
    "In audit, the room reads this through witnessed pressure.",
    "In audit, the room reads this through structured pressure.",
    "In audit, the room reads this through escalating pressure.",
    "In audit, the room reads this through contained pressure.",
    "In audit, the room reads this through reputational pressure.",
  ]),
  "proveout": Object.freeze([
    "In proveout, the room reads this through mode-specific pressure.",
    "In proveout, the room reads this through social pressure.",
    "In proveout, the room reads this through economic pressure.",
    "In proveout, the room reads this through witnessed pressure.",
    "In proveout, the room reads this through structured pressure.",
    "In proveout, the room reads this through escalating pressure.",
    "In proveout, the room reads this through contained pressure.",
    "In proveout, the room reads this through reputational pressure.",
  ]),
  "rescue-window": Object.freeze([
    "In rescue window, the room reads this through mode-specific pressure.",
    "In rescue window, the room reads this through social pressure.",
    "In rescue window, the room reads this through economic pressure.",
    "In rescue window, the room reads this through witnessed pressure.",
    "In rescue window, the room reads this through structured pressure.",
    "In rescue window, the room reads this through escalating pressure.",
    "In rescue window, the room reads this through contained pressure.",
    "In rescue window, the room reads this through reputational pressure.",
  ]),
  "negotiation": Object.freeze([
    "In negotiation, the room reads this through mode-specific pressure.",
    "In negotiation, the room reads this through social pressure.",
    "In negotiation, the room reads this through economic pressure.",
    "In negotiation, the room reads this through witnessed pressure.",
    "In negotiation, the room reads this through structured pressure.",
    "In negotiation, the room reads this through escalating pressure.",
    "In negotiation, the room reads this through contained pressure.",
    "In negotiation, the room reads this through reputational pressure.",
  ]),
  "ambush": Object.freeze([
    "In ambush, the room reads this through mode-specific pressure.",
    "In ambush, the room reads this through social pressure.",
    "In ambush, the room reads this through economic pressure.",
    "In ambush, the room reads this through witnessed pressure.",
    "In ambush, the room reads this through structured pressure.",
    "In ambush, the room reads this through escalating pressure.",
    "In ambush, the room reads this through contained pressure.",
    "In ambush, the room reads this through reputational pressure.",
  ]),
  "heat-spike": Object.freeze([
    "In heat spike, the room reads this through mode-specific pressure.",
    "In heat spike, the room reads this through social pressure.",
    "In heat spike, the room reads this through economic pressure.",
    "In heat spike, the room reads this through witnessed pressure.",
    "In heat spike, the room reads this through structured pressure.",
    "In heat spike, the room reads this through escalating pressure.",
    "In heat spike, the room reads this through contained pressure.",
    "In heat spike, the room reads this through reputational pressure.",
  ]),
  "slow-burn": Object.freeze([
    "In slow burn, the room reads this through mode-specific pressure.",
    "In slow burn, the room reads this through social pressure.",
    "In slow burn, the room reads this through economic pressure.",
    "In slow burn, the room reads this through witnessed pressure.",
    "In slow burn, the room reads this through structured pressure.",
    "In slow burn, the room reads this through escalating pressure.",
    "In slow burn, the room reads this through contained pressure.",
    "In slow burn, the room reads this through reputational pressure.",
  ]),
  "trial": Object.freeze([
    "In trial, the room reads this through mode-specific pressure.",
    "In trial, the room reads this through social pressure.",
    "In trial, the room reads this through economic pressure.",
    "In trial, the room reads this through witnessed pressure.",
    "In trial, the room reads this through structured pressure.",
    "In trial, the room reads this through escalating pressure.",
    "In trial, the room reads this through contained pressure.",
    "In trial, the room reads this through reputational pressure.",
  ]),
});

const TAG_HINT_BANK = Object.freeze({
  "record": Object.freeze([
    "The record signal remains active in this wording.",
    "The record signal remains active in this wording.",
    "Record logic is still shaping the sentence.",
    "The line carries a record trace the room can feel.",
    "Record stays present even when the wording stays calm.",
    "The record layer is doing more work than the surface admits.",
  ]),
  "ledger": Object.freeze([
    "The ledger signal remains active in this wording.",
    "The ledger signal remains active in this wording.",
    "Ledger logic is still shaping the sentence.",
    "The line carries a ledger trace the room can feel.",
    "Ledger stays present even when the wording stays calm.",
    "The ledger layer is doing more work than the surface admits.",
  ]),
  "proof": Object.freeze([
    "The proof signal remains active in this wording.",
    "The proof signal remains active in this wording.",
    "Proof logic is still shaping the sentence.",
    "The line carries a proof trace the room can feel.",
    "Proof stays present even when the wording stays calm.",
    "The proof layer is doing more work than the surface admits.",
  ]),
  "witness": Object.freeze([
    "The witness signal remains active in this wording.",
    "The witness signal remains active in this wording.",
    "Witness logic is still shaping the sentence.",
    "The line carries a witness trace the room can feel.",
    "Witness stays present even when the wording stays calm.",
    "The witness layer is doing more work than the surface admits.",
  ]),
  "rescue": Object.freeze([
    "The rescue signal remains active in this wording.",
    "The rescue signal remains active in this wording.",
    "Rescue logic is still shaping the sentence.",
    "The line carries a rescue trace the room can feel.",
    "Rescue stays present even when the wording stays calm.",
    "The rescue layer is doing more work than the surface admits.",
  ]),
  "warning": Object.freeze([
    "The warning signal remains active in this wording.",
    "The warning signal remains active in this wording.",
    "Warning logic is still shaping the sentence.",
    "The line carries a warning trace the room can feel.",
    "Warning stays present even when the wording stays calm.",
    "The warning layer is doing more work than the surface admits.",
  ]),
  "telegraph": Object.freeze([
    "The telegraph signal remains active in this wording.",
    "The telegraph signal remains active in this wording.",
    "Telegraph logic is still shaping the sentence.",
    "The line carries a telegraph trace the room can feel.",
    "Telegraph stays present even when the wording stays calm.",
    "The telegraph layer is doing more work than the surface admits.",
  ]),
  "setup": Object.freeze([
    "The setup signal remains active in this wording.",
    "The setup signal remains active in this wording.",
    "Setup logic is still shaping the sentence.",
    "The line carries a setup trace the room can feel.",
    "Setup stays present even when the wording stays calm.",
    "The setup layer is doing more work than the surface admits.",
  ]),
  "aftermath": Object.freeze([
    "The aftermath signal remains active in this wording.",
    "The aftermath signal remains active in this wording.",
    "Aftermath logic is still shaping the sentence.",
    "The line carries a aftermath trace the room can feel.",
    "Aftermath stays present even when the wording stays calm.",
    "The aftermath layer is doing more work than the surface admits.",
  ]),
  "pressure": Object.freeze([
    "The pressure signal remains active in this wording.",
    "The pressure signal remains active in this wording.",
    "Pressure logic is still shaping the sentence.",
    "The line carries a pressure trace the room can feel.",
    "Pressure stays present even when the wording stays calm.",
    "The pressure layer is doing more work than the surface admits.",
  ]),
  "public": Object.freeze([
    "The public signal remains active in this wording.",
    "The public signal remains active in this wording.",
    "Public logic is still shaping the sentence.",
    "The line carries a public trace the room can feel.",
    "Public stays present even when the wording stays calm.",
    "The public layer is doing more work than the surface admits.",
  ]),
  "private": Object.freeze([
    "The private signal remains active in this wording.",
    "The private signal remains active in this wording.",
    "Private logic is still shaping the sentence.",
    "The line carries a private trace the room can feel.",
    "Private stays present even when the wording stays calm.",
    "The private layer is doing more work than the surface admits.",
  ]),
  "callback": Object.freeze([
    "The callback signal remains active in this wording.",
    "The callback signal remains active in this wording.",
    "Callback logic is still shaping the sentence.",
    "The line carries a callback trace the room can feel.",
    "Callback stays present even when the wording stays calm.",
    "The callback layer is doing more work than the surface admits.",
  ]),
  "history": Object.freeze([
    "The history signal remains active in this wording.",
    "The history signal remains active in this wording.",
    "History logic is still shaping the sentence.",
    "The line carries a history trace the room can feel.",
    "History stays present even when the wording stays calm.",
    "The history layer is doing more work than the surface admits.",
  ]),
  "mocking": Object.freeze([
    "The mocking signal remains active in this wording.",
    "The mocking signal remains active in this wording.",
    "Mocking logic is still shaping the sentence.",
    "The line carries a mocking trace the room can feel.",
    "Mocking stays present even when the wording stays calm.",
    "The mocking layer is doing more work than the surface admits.",
  ]),
  "intimate": Object.freeze([
    "The intimate signal remains active in this wording.",
    "The intimate signal remains active in this wording.",
    "Intimate logic is still shaping the sentence.",
    "The line carries a intimate trace the room can feel.",
    "Intimate stays present even when the wording stays calm.",
    "The intimate layer is doing more work than the surface admits.",
  ]),
  "direct": Object.freeze([
    "The direct signal remains active in this wording.",
    "The direct signal remains active in this wording.",
    "Direct logic is still shaping the sentence.",
    "The line carries a direct trace the room can feel.",
    "Direct stays present even when the wording stays calm.",
    "The direct layer is doing more work than the surface admits.",
  ]),
  "ceremonial": Object.freeze([
    "The ceremonial signal remains active in this wording.",
    "The ceremonial signal remains active in this wording.",
    "Ceremonial logic is still shaping the sentence.",
    "The line carries a ceremonial trace the room can feel.",
    "Ceremonial stays present even when the wording stays calm.",
    "The ceremonial layer is doing more work than the surface admits.",
  ]),
  "heat": Object.freeze([
    "The heat signal remains active in this wording.",
    "The heat signal remains active in this wording.",
    "Heat logic is still shaping the sentence.",
    "The line carries a heat trace the room can feel.",
    "Heat stays present even when the wording stays calm.",
    "The heat layer is doing more work than the surface admits.",
  ]),
  "cold": Object.freeze([
    "The cold signal remains active in this wording.",
    "The cold signal remains active in this wording.",
    "Cold logic is still shaping the sentence.",
    "The line carries a cold trace the room can feel.",
    "Cold stays present even when the wording stays calm.",
    "The cold layer is doing more work than the surface admits.",
  ]),
  "syndicate": Object.freeze([
    "The syndicate signal remains active in this wording.",
    "The syndicate signal remains active in this wording.",
    "Syndicate logic is still shaping the sentence.",
    "The line carries a syndicate trace the room can feel.",
    "Syndicate stays present even when the wording stays calm.",
    "The syndicate layer is doing more work than the surface admits.",
  ]),
  "deal": Object.freeze([
    "The deal signal remains active in this wording.",
    "The deal signal remains active in this wording.",
    "Deal logic is still shaping the sentence.",
    "The line carries a deal trace the room can feel.",
    "Deal stays present even when the wording stays calm.",
    "The deal layer is doing more work than the surface admits.",
  ]),
  "predator": Object.freeze([
    "The predator signal remains active in this wording.",
    "The predator signal remains active in this wording.",
    "Predator logic is still shaping the sentence.",
    "The line carries a predator trace the room can feel.",
    "Predator stays present even when the wording stays calm.",
    "The predator layer is doing more work than the surface admits.",
  ]),
  "phantom": Object.freeze([
    "The phantom signal remains active in this wording.",
    "The phantom signal remains active in this wording.",
    "Phantom logic is still shaping the sentence.",
    "The line carries a phantom trace the room can feel.",
    "Phantom stays present even when the wording stays calm.",
    "The phantom layer is doing more work than the surface admits.",
  ]),
  "empire": Object.freeze([
    "The empire signal remains active in this wording.",
    "The empire signal remains active in this wording.",
    "Empire logic is still shaping the sentence.",
    "The line carries a empire trace the room can feel.",
    "Empire stays present even when the wording stays calm.",
    "The empire layer is doing more work than the surface admits.",
  ]),
  "legend": Object.freeze([
    "The legend signal remains active in this wording.",
    "The legend signal remains active in this wording.",
    "Legend logic is still shaping the sentence.",
    "The line carries a legend trace the room can feel.",
    "Legend stays present even when the wording stays calm.",
    "The legend layer is doing more work than the surface admits.",
  ]),
  "audit": Object.freeze([
    "The audit signal remains active in this wording.",
    "The audit signal remains active in this wording.",
    "Audit logic is still shaping the sentence.",
    "The line carries a audit trace the room can feel.",
    "Audit stays present even when the wording stays calm.",
    "The audit layer is doing more work than the surface admits.",
  ]),
  "rivalry": Object.freeze([
    "The rivalry signal remains active in this wording.",
    "The rivalry signal remains active in this wording.",
    "Rivalry logic is still shaping the sentence.",
    "The line carries a rivalry trace the room can feel.",
    "Rivalry stays present even when the wording stays calm.",
    "The rivalry layer is doing more work than the surface admits.",
  ]),
  "helper": Object.freeze([
    "The helper signal remains active in this wording.",
    "The helper signal remains active in this wording.",
    "Helper logic is still shaping the sentence.",
    "The line carries a helper trace the room can feel.",
    "Helper stays present even when the wording stays calm.",
    "The helper layer is doing more work than the surface admits.",
  ]),
  "hater": Object.freeze([
    "The hater signal remains active in this wording.",
    "The hater signal remains active in this wording.",
    "Hater logic is still shaping the sentence.",
    "The line carries a hater trace the room can feel.",
    "Hater stays present even when the wording stays calm.",
    "The hater layer is doing more work than the surface admits.",
  ]),
  "negotiation": Object.freeze([
    "The negotiation signal remains active in this wording.",
    "The negotiation signal remains active in this wording.",
    "Negotiation logic is still shaping the sentence.",
    "The line carries a negotiation trace the room can feel.",
    "Negotiation stays present even when the wording stays calm.",
    "The negotiation layer is doing more work than the surface admits.",
  ]),
  "shadow": Object.freeze([
    "The shadow signal remains active in this wording.",
    "The shadow signal remains active in this wording.",
    "Shadow logic is still shaping the sentence.",
    "The line carries a shadow trace the room can feel.",
    "Shadow stays present even when the wording stays calm.",
    "The shadow layer is doing more work than the surface admits.",
  ]),
  "echo": Object.freeze([
    "The echo signal remains active in this wording.",
    "The echo signal remains active in this wording.",
    "Echo logic is still shaping the sentence.",
    "The line carries a echo trace the room can feel.",
    "Echo stays present even when the wording stays calm.",
    "The echo layer is doing more work than the surface admits.",
  ]),
  "momentum": Object.freeze([
    "The momentum signal remains active in this wording.",
    "The momentum signal remains active in this wording.",
    "Momentum logic is still shaping the sentence.",
    "The line carries a momentum trace the room can feel.",
    "Momentum stays present even when the wording stays calm.",
    "The momentum layer is doing more work than the surface admits.",
  ]),
  "comeback": Object.freeze([
    "The comeback signal remains active in this wording.",
    "The comeback signal remains active in this wording.",
    "Comeback logic is still shaping the sentence.",
    "The line carries a comeback trace the room can feel.",
    "Comeback stays present even when the wording stays calm.",
    "The comeback layer is doing more work than the surface admits.",
  ]),
  "collapse": Object.freeze([
    "The collapse signal remains active in this wording.",
    "The collapse signal remains active in this wording.",
    "Collapse logic is still shaping the sentence.",
    "The line carries a collapse trace the room can feel.",
    "Collapse stays present even when the wording stays calm.",
    "The collapse layer is doing more work than the surface admits.",
  ]),
});

const SCENE_FLAVOR_LEXICON = Object.freeze({
  "EMPIRE": Object.freeze([
    "hierarchy",
    "seat",
    "throne",
    "board",
    "crown",
    "mandate",
    "authority",
    "ledger",
    "posture",
    "order",
    "rank",
    "dominion",
    "decree",
    "command",
    "standard",
    "measure",
  ]),
  "PREDATOR": Object.freeze([
    "price",
    "bluff",
    "leverage",
    "spread",
    "exit",
    "timing",
    "fill",
    "liquidity",
    "hunger",
    "margin",
    "slippage",
    "angle",
    "pressure",
    "predation",
    "trap",
    "execution",
  ]),
  "SYNDICATE": Object.freeze([
    "trust",
    "signal",
    "formation",
    "cell",
    "ally",
    "stack",
    "cohort",
    "war-room",
    "verification",
    "coordination",
    "cover",
    "response",
    "debt",
    "bond",
    "proof",
    "handoff",
  ]),
  "PHANTOM": Object.freeze([
    "memory",
    "legend",
    "shadow",
    "echo",
    "archive",
    "haunt",
    "trace",
    "ghost",
    "witness",
    "afterimage",
    "burial",
    "return",
    "record",
    "myth",
    "silence",
    "residue",
  ]),
  "GENERIC": Object.freeze([
    "room",
    "line",
    "pressure",
    "structure",
    "choice",
    "timing",
    "heat",
    "reading",
    "tone",
    "surface",
    "witness",
    "consequence",
    "sequence",
    "frame",
    "signal",
    "turn",
  ]),
});

const PUBLIC_OPENERS = Object.freeze({
  "LOW": Object.freeze([
    "The room saw enough to remember.",
    "That did not stay private.",
    "A witness exists now whether anyone likes it or not.",
    "The room logged the movement immediately.",
    "Public memory has already started forming around this.",
    "The exchange crossed the private threshold cleanly.",
  ]),
  "MEDIUM": Object.freeze([
    "No one present can honestly say they missed that.",
    "The room is already reading motive into the wording.",
    "This entered shared memory at once.",
    "Everyone heard the choice behind the phrasing.",
    "Public interpretation is already hardening.",
    "The room is building consensus around what that meant.",
  ]),
  "HIGH": Object.freeze([
    "This is fully public now and therefore more expensive.",
    "The room is translating every clause into consequence.",
    "The exchange has become crowd property.",
    "Witness has thickened around the sentence.",
    "No version of this remains contained anymore.",
    "The room has become an active judge of tone and timing.",
  ]),
  "CRITICAL": Object.freeze([
    "Nothing about this remained sealed.",
    "Public memory just calcified around the move.",
    "Every observer now holds a sharper copy of what happened.",
    "The room is no longer a backdrop; it is an instrument.",
    "Witness has become pressure in its own right.",
    "Containment failed the moment the wording landed.",
  ]),
});

const PRIVATE_OPENERS = Object.freeze({
  "LOW": Object.freeze([
    "Away from the room, the structure is easier to read.",
    "Without audience distortion, the line stays cleaner.",
    "In private, the sentence has less costume on it.",
    "Without the crowd, motive stops hiding as well.",
    "In the quieter chamber, the wording gets more honest.",
    "This lands differently once public theater is removed.",
  ]),
  "MEDIUM": Object.freeze([
    "Private air makes the leverage more obvious.",
    "Without witnesses to decorate it, the sentence turns harder.",
    "The room is gone, so the structure is clearer now.",
    "In private, there is less place to hide behind style.",
    "The line loses audience padding the moment the chamber narrows.",
    "Without a crowd, pressure becomes cleaner and less forgiving.",
  ]),
  "HIGH": Object.freeze([
    "In private, the exchange cuts closer to intent.",
    "Audience absence stripped away the last polite layer.",
    "Without witnesses, the sentence stops performing and starts aiming.",
    "Private framing makes the leverage unmistakable.",
    "What remains here is function, not theater.",
    "The quiet has made the line more dangerous, not less.",
  ]),
  "CRITICAL": Object.freeze([
    "Without witnesses, the structure is harsher and more exact.",
    "Private air removed every last excuse for misreading intent.",
    "This is what the line sounds like when spectacle is gone.",
    "No crowd remains to dilute the edge.",
    "In private, the sentence narrows to consequence alone.",
    "The chamber is small enough now for the truth to carry full weight.",
  ]),
});

const CALLBACK_BRIDGES = Object.freeze({
  "LOW": Object.freeze([
    "An earlier thread remains unfinished.",
    "The room still carries residue from what was said before.",
    "Your previous language did not disappear when the moment changed.",
    "A prior line is still leaning on this exchange.",
    "The earlier wording stayed active in the background.",
    "Something previously said is still doing work here.",
  ]),
  "MEDIUM": Object.freeze([
    "The callback is now relevant instead of decorative.",
    "The room did not forget the earlier wording.",
    "Your prior sentence has started collecting interest.",
    "The older claim is back inside the new pressure.",
    "What was said before is no longer safely in the past.",
    "The previous line matured into leverage.",
  ]),
  "HIGH": Object.freeze([
    "Your own language is now testifying against your timing.",
    "The callback has become evidence instead of texture.",
    "The earlier sentence returned carrying more force than before.",
    "What you said previously now frames what you say next.",
    "The room is using your earlier wording as a measuring stick.",
    "The callback is now actively shaping interpretation.",
  ]),
  "CRITICAL": Object.freeze([
    "The previous sentence has become proof under heat.",
    "Your earlier wording is now closing around the present exchange.",
    "The callback hardened into evidence the moment pressure rose.",
    "What you said before is now the room's preferred lens.",
    "The past clause is actively constraining this one.",
    "The callback is no longer optional context; it is binding pressure.",
  ]),
});

const HISTORY_BRIDGES = Object.freeze({
  "LOW": Object.freeze([
    "This is not the first unfinished exchange.",
    "There is already context under the sentence.",
    "The line lands on ground that was prepared earlier.",
    "History remains present even if no one names it.",
    "The exchange sits on older residue.",
    "Previous contact is quietly shaping this moment.",
  ]),
  "MEDIUM": Object.freeze([
    "Patterns have become easier to see over time.",
    "History is leaning forward inside the line.",
    "This does not land on empty air anymore.",
    "Repeated behavior has made the shape easier to read.",
    "Prior contact has started acting like structure.",
    "The past is no longer separate from the sentence.",
  ]),
  "HIGH": Object.freeze([
    "History has enough mass now to alter tone on contact.",
    "The past is pressing into the present wording.",
    "Older patterns are now visible at sentence level.",
    "This exchange is being read against accumulated memory.",
    "History has sharpened the edge of the line.",
    "The room has a longer memory than the wording would prefer.",
  ]),
  "CRITICAL": Object.freeze([
    "The past has become active pressure here.",
    "History is now closing its hand around the moment.",
    "Accumulated memory is doing part of the speaking.",
    "The line is arriving under the weight of everything before it.",
    "The sentence cannot separate itself from previous evidence anymore.",
    "The past is now inside the clause rather than behind it.",
  ]),
});

const PRE_EVENT_OPENERS = Object.freeze({
  "LOW": Object.freeze([
    "Before the room commits to a reading,",
    "Before this widens,",
    "While the moment is still negotiable,",
    "Before the sentence becomes heavier than intended,",
    "Before interpretation closes,",
    "While a cleaner turn still exists,",
  ]),
  "MEDIUM": Object.freeze([
    "Before the structure closes around the choice,",
    "Before the room prices this correctly,",
    "While there is still a narrow redirect,",
    "Before pressure decides the framing for you,",
    "Before the line becomes harder to revise in memory,",
    "While the opening remains only partly narrowed,",
  ]),
  "HIGH": Object.freeze([
    "Before collapse becomes grammar,",
    "Before the room sharpens beyond negotiation,",
    "While there is still one usable exit,",
    "Before witness turns fully hostile,",
    "Before the sentence settles as consequence,",
    "While reversal remains expensive but possible,",
  ]),
  "CRITICAL": Object.freeze([
    "Before the last clean exit folds,",
    "Before the room seals its judgment,",
    "While consequence is still arriving rather than complete,",
    "Before this becomes the version everyone keeps,",
    "Before pressure hardens beyond revision,",
    "While the narrowing has not yet become absolute,",
  ]),
});

const POST_EVENT_OPENERS = Object.freeze({
  "LOW": Object.freeze([
    "After that,",
    "Now that the move has landed,",
    "With the action already visible,",
    "Once the sentence has crossed the room,",
    "After the first impact,",
    "Now that the moment has registered,",
  ]),
  "MEDIUM": Object.freeze([
    "After what just settled into the room,",
    "With the impact still warm,",
    "Now that consequence has started to attach,",
    "After the room's first reading,",
    "With witness already underway,",
    "Once the clause has begun to echo,",
  ]),
  "HIGH": Object.freeze([
    "After what just broke open,",
    "With the consequences already visible,",
    "Now that the room has sharpened around it,",
    "After the sentence forced a harder reading,",
    "With the crowd already translating it into cost,",
    "Now that the moment has become more than a moment,",
  ]),
  "CRITICAL": Object.freeze([
    "After the structure gave way,",
    "With the event still cutting through the air,",
    "Now that witness has become pressure,",
    "After the room accepted the harsher interpretation,",
    "With consequence fully attached to phrasing,",
    "Now that the sentence belongs to memory as much as the present,",
  ]),
});

const CLOSER_BANK = Object.freeze({
  "LOW": Object.freeze([
    "That was enough.",
    "Read it once and keep it.",
    "No extra explanation is required.",
    "The room does not need a softer duplicate.",
    "The point survives without more decoration.",
    "The sentence already completed its work.",
  ]),
  "MEDIUM": Object.freeze([
    "The room will keep the shape of that sentence.",
    "Nothing useful is added by pretending it landed lighter.",
    "The line is complete enough to remain in memory.",
    "There is no benefit in over-explaining what already stuck.",
    "The room has what it needs from that wording.",
    "No second pass will make the implication smaller.",
  ]),
  "HIGH": Object.freeze([
    "That enters memory with the edge intact.",
    "The room will remember the pressure, not just the words.",
    "The sentence keeps its teeth on replay.",
    "Nothing after this will make the first impact vanish.",
    "The line is now part of how the room reads you.",
    "The exchange is unlikely to leave witnesses unchanged.",
  ]),
  "CRITICAL": Object.freeze([
    "That is now part of the record.",
    "This enters memory exactly as spoken.",
    "The room will keep the consequence as well as the clause.",
    "The line will outlast the comfort of the moment.",
    "Witness has already archived the harsher reading.",
    "The record now carries both language and pressure together.",
  ]),
});


const DIRECT_REPLACEMENTS: ReadonlyArray<readonly [RegExp, readonly string[]]> = Object.freeze([
  [/\bI think\b/g, Object.freeze(['I know', 'I have already measured', 'I am not guessing'])],
  [/\bmaybe\b/gi, Object.freeze(['plainly', 'more exactly', 'in practice'])],
  [/\bperhaps\b/gi, Object.freeze(['plainly', 'without romance', 'under record'])],
  [/\bI guess\b/gi, Object.freeze(['I conclude', 'I can already see', 'the structure shows'])],
  [/\bYou are not\b/g, Object.freeze(['You are no longer', 'You do not remain', 'You are not meaningfully'])],
  [/\bWe should\b/g, Object.freeze(['We will', 'The correct move is to', 'The structure requires us to'])],
]);

const MOCKING_REPLACEMENTS: ReadonlyArray<readonly [RegExp, readonly string[]]> = Object.freeze([
  [/\bInteresting\./g, Object.freeze(['Cute.', 'Predictable.', 'Convenient.', 'Adorable.', 'Noted.'])],
  [/\bVery well\./g, Object.freeze(['Sure.', 'Of course.', 'Fine.', 'As expected.', 'Naturally.'])],
  [/\bI see\./g, Object.freeze(['I noticed.', 'I clocked that.', 'I saw enough.', 'I saw the angle.', 'I caught it.'])],
]);

const INTIMACY_RULES = Object.freeze([
  { pattern: /\bYou are\b/g, apply: (alias: string) => `${alias} is` },
  { pattern: /\bYou were\b/g, apply: (alias: string) => `${alias} was` },
  { pattern: /\bYou have\b/g, apply: (alias: string) => `${alias} has` },
  { pattern: /\bYou\b/g, apply: (alias: string) => alias },
  { pattern: /\byour\b/g, apply: (alias: string) => `${alias}'s` },
]);



function clamp01(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if ((value as number) <= 0) {
    return 0;
  }
  if ((value as number) >= 1) {
    return 1;
  }
  return value as number;
}

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizePunctuation(value: string): string {
  return normalizeSpace(
    value
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/([,.;:!?])(\S)/g, '$1 $2')
      .replace(/\s{2,}/g, ' '),
  );
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededIndex(length: number, seed: number): number {
  if (length <= 0) {
    return 0;
  }
  return Math.abs(seed) % length;
}

function chooseSeeded<T>(items: readonly T[], seed: number): T {
  return items[seededIndex(items.length, seed)];
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function hasText(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toSlug(value: string): string {
  return normalizeSpace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function tokenize(value: string): string[] {
  return normalizeSpace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function countMatches(value: string, pattern: RegExp): number {
  const matches = value.match(pattern);
  return matches ? matches.length : 0;
}

function topTokens(value: string, limit: number): string[] {
  const counts = new Map<string, number>();
  for (const token of tokenize(value)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

function rareTokens(value: string): string[] {
  return tokenize(value)
    .filter((token) => token.length >= 7)
    .filter((token, index, list) => list.indexOf(token) === index)
    .slice(0, 6);
}

function prependLead(text: string, lead: string): string {
  const normalizedLead = normalizeSpace(lead);
  if (!normalizedLead) {
    return text;
  }
  const spacer = /[,.:;]$/.test(normalizedLead) ? '' : ' ';
  return normalizePunctuation(`${normalizedLead}${spacer}${text}`);
}

function appendTail(text: string, tail: string): string {
  const normalizedTail = normalizeSpace(tail);
  if (!normalizedTail) {
    return text;
  }
  const base = /[.?!]$/.test(text) ? text : `${text}.`;
  return normalizePunctuation(`${base} ${normalizedTail}`);
}

function uniqueStrings(values: readonly string[]): string[] {
  return unique(values.filter((value) => normalizeSpace(value).length > 0).map((value) => normalizeSpace(value)));
}

function phraseFromBand(
  bank: Readonly<Record<InternalHeatBand, readonly string[]>>,
  band: InternalHeatBand,
  seed: number,
): string {
  return chooseSeeded(bank[band], seed);
}

function phraseFromStringRecord(
  bank: Readonly<Record<string, readonly string[]>>,
  key: string,
  seed: number,
): string | null {
  const entry = bank[key];
  return entry && entry.length > 0 ? chooseSeeded(entry, seed) : null;
}

function computeTone(respect: number, contempt: number, fear: number, fascination: number): InternalTone {
  if (respect >= 0.74 && contempt <= 0.28) {
    return 'RITUAL';
  }
  if (contempt >= 0.78 || fear >= 0.78) {
    return 'ICE';
  }
  if (contempt >= 0.58) {
    return 'COLD';
  }
  if (fear >= 0.6 || fascination >= 0.74) {
    return 'HOT';
  }
  return 'CONTROLLED';
}

function computeHeatBand(respect: number, contempt: number, fear: number, fascination: number): InternalHeatBand {
  const score = (contempt * 0.38) + (fear * 0.31) + (fascination * 0.18) + (respect * 0.13);
  if (score >= 0.86) {
    return 'CRITICAL';
  }
  if (score >= 0.64) {
    return 'HIGH';
  }
  if (score >= 0.34) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function computeCadence(tone: InternalTone, heatBand: InternalHeatBand): InternalCadence {
  if (tone === 'RITUAL') {
    return 'EXPANSIVE';
  }
  if (tone === 'ICE' || heatBand === 'CRITICAL') {
    return 'TIGHT';
  }
  return 'BALANCED';
}

function computePublicness(context: SharedChatRealizationContext): InternalPublicness {
  if (context.publicFacing === true) {
    return 'PUBLIC';
  }
  if (context.publicFacing === false) {
    return 'PRIVATE';
  }
  return 'HYBRID';
}

function computeWitnessState(publicness: InternalPublicness, heatBand: InternalHeatBand): InternalWitnessState {
  if (publicness === 'PUBLIC' && heatBand === 'CRITICAL') {
    return 'TOTAL';
  }
  if (publicness === 'PUBLIC' || heatBand === 'HIGH' || heatBand === 'CRITICAL') {
    return 'WATCHFUL';
  }
  if (publicness === 'HYBRID' || heatBand === 'MEDIUM') {
    return 'PRESENT';
  }
  return 'THIN';
}

function buildSignals(context: SharedChatRealizationContext): SignalVector {
  const respect = clamp01(context.respect);
  const contempt = clamp01(context.contempt);
  const fear = clamp01(context.fear);
  const fascination = clamp01(context.fascination);
  const tone = computeTone(respect, contempt, fear, fascination);
  const heatBand = computeHeatBand(respect, contempt, fear, fascination);
  const cadence = computeCadence(tone, heatBand);
  const publicness = computePublicness(context);
  const callbackWeight = hasText(context.callbackText)
    ? Math.max(fascination, contempt * 0.7, respect * 0.55)
    : 0;
  const volatility = clamp01((fear * 0.45) + (contempt * 0.3) + (fascination * 0.25));
  const intimacy = clamp01((respect * 0.48) + (fascination * 0.32) + (context.playerAlias ? 0.2 : 0));
  const formality = clamp01((respect * 0.5) + (context.publicFacing ? 0.2 : 0.1) + (tone === 'RITUAL' ? 0.3 : 0));
  const witnessState = computeWitnessState(publicness, heatBand);

  return {
    respect,
    contempt,
    fear,
    fascination,
    tone,
    heatBand,
    cadence,
    publicness,
    callbackWeight,
    volatility,
    intimacy,
    formality,
    witnessState,
  };
}

function computeClauseShape(text: string, signals: SignalVector): InternalClauseShape {
  const normalized = normalizePunctuation(text);
  if (signals.tone === 'RITUAL' || /record|ledger|memory|witness/i.test(normalized)) {
    return 'RECORD';
  }
  if (signals.tone === 'ICE' || signals.cadence === 'TIGHT') {
    return 'CUT';
  }
  if (signals.tone === 'HOT' || /crowd|room|heat|blood/i.test(normalized)) {
    return 'SURGE';
  }
  if (signals.tone === 'COLD' || /precise|clean|correct|structure/i.test(normalized)) {
    return 'EDGE';
  }
  return 'BALANCE';
}

function computeModeFlavor(line: SharedCanonicalChatLine, context: SharedChatRealizationContext): InternalModeFlavor {
  const source = [
    line.botId,
    line.category,
    line.tags?.join(' ') ?? '',
    line.sceneRoles?.join(' ') ?? '',
    context.sceneArchetype ?? '',
    context.sceneRole ?? '',
  ].join(' ').toLowerCase();

  if (/predator|deal|broker|negotiat|bluff|liquidity/.test(source)) {
    return 'PREDATOR';
  }
  if (/syndicate|ally|war|team|guild|cell/.test(source)) {
    return 'SYNDICATE';
  }
  if (/phantom|legend|ghost|archive|haunt|memory/.test(source)) {
    return 'PHANTOM';
  }
  if (/empire|board|throne|crown|kingdom|seat/.test(source)) {
    return 'EMPIRE';
  }
  return 'GENERIC';
}

function computeLexicalDigest(line: SharedCanonicalChatLine, signals: SignalVector): LexicalDigest {
  const text = normalizePunctuation(line.text);
  const tokens = tokenize(text);
  const topLexemes = topTokens(text, 5);
  const rareLexemes = rareTokens(text);
  const motifStem = hasText(line.motifId)
    ? line.motifId
    : topLexemes.length > 0
      ? topLexemes.slice(0, 2).join('-')
      : toSlug(line.category) || 'generic';
  const clauseShape = computeClauseShape(text, signals);

  return Object.freeze({
    tokens: Object.freeze(tokens),
    topLexemes: Object.freeze(topLexemes),
    rareLexemes: Object.freeze(rareLexemes),
    motifStem,
    clauseShape,
    sentenceCount: Math.max(1, text.split(/(?<=[.?!])\s+/).filter(Boolean).length),
    questionCount: countMatches(text, /\?/g),
    exclamationCount: countMatches(text, /!/g),
    quotationCount: countMatches(text, /"/g),
  });
}

function collectTaggedHints(tags: readonly string[], seed: number): string[] {
  const hints: string[] = [];
  for (const tag of tags) {
    const slug = toSlug(tag);
    const hint = phraseFromStringRecord(TAG_HINT_BANK, slug, seed ^ hashSeed(slug));
    if (hint) {
      hints.push(hint);
    }
  }
  return uniqueStrings(hints).slice(0, 4);
}

function collectRoleHints(line: SharedCanonicalChatLine, context: SharedChatRealizationContext, seed: number): string[] {
  const values = uniqueStrings([
    ...(line.sceneRoles ?? EMPTY_TAGS),
    context.sceneRole ?? '',
  ]);
  const hints: string[] = [];
  for (const value of values) {
    const hint = phraseFromStringRecord(ROLE_HINT_BANK, toSlug(value), seed ^ hashSeed(value));
    if (hint) {
      hints.push(hint);
    }
  }
  return uniqueStrings(hints).slice(0, 4);
}

function collectArchetypeHints(
  line: SharedCanonicalChatLine,
  context: SharedChatRealizationContext,
  flavor: InternalModeFlavor,
  seed: number,
): string[] {
  const values = uniqueStrings([
    context.sceneArchetype ?? '',
    flavor.toLowerCase(),
    ...(line.tags ?? EMPTY_TAGS),
  ]);
  const hints: string[] = [];
  for (const value of values) {
    const hint = phraseFromStringRecord(ARCHETYPE_HINT_BANK, toSlug(value), seed ^ hashSeed(value));
    if (hint) {
      hints.push(hint);
    }
  }
  return uniqueStrings(hints).slice(0, 5);
}

function computeSceneDigest(
  line: SharedCanonicalChatLine,
  context: SharedChatRealizationContext,
  seed: number,
): SceneDigest {
  const sceneFlavor = computeModeFlavor(line, context);
  const sceneArchetypeSlug = toSlug(context.sceneArchetype ?? '') || 'freeplay';
  const sceneRoleSlug = toSlug(context.sceneRole ?? '') || 'line';
  const roleHints = collectRoleHints(line, context, seed);
  const archetypeHints = collectArchetypeHints(line, context, sceneFlavor, seed);
  const tagHints = collectTaggedHints([...(line.tags ?? EMPTY_TAGS), ...(line.sceneRoles ?? EMPTY_TAGS)], seed);

  return Object.freeze({
    sceneFlavor,
    sceneArchetypeSlug,
    sceneRoleSlug,
    roleHints: Object.freeze(roleHints),
    archetypeHints: Object.freeze(archetypeHints),
    tagHints: Object.freeze(tagHints),
  });
}

function inferTransforms(
  line: SharedCanonicalChatLine,
  context: SharedChatRealizationContext,
  signals: SignalVector,
  lexical: LexicalDigest,
  scene: SceneDigest,
): SharedChatRealizationTransform[] {
  const inferred: SharedChatRealizationTransform[] = [];

  if (signals.publicness === 'PUBLIC' || signals.witnessState === 'TOTAL') {
    inferred.push('MORE_PUBLIC');
  }
  if (hasText(context.callbackText) && signals.callbackWeight >= 0.24) {
    inferred.push('CALLBACK_REWRITE');
  }
  if ((signals.contempt >= 0.48 || signals.fear >= 0.56 || signals.volatility >= 0.6) && !/calm/i.test(context.pressureBand ?? '')) {
    inferred.push('PRESSURE_REWRITE');
  }
  if (hasText(context.playerAlias) && (signals.intimacy >= 0.35 || signals.respect >= 0.2 || signals.fascination >= 0.22)) {
    inferred.push('MORE_INTIMATE');
  }
  if (signals.tone === 'ICE' || signals.cadence === 'TIGHT' || lexical.sentenceCount >= 3) {
    inferred.push('SHORTER_COLDER', 'MORE_DIRECT');
  }
  if (signals.tone === 'RITUAL' || signals.formality >= 0.72 || lexical.clauseShape === 'RECORD') {
    inferred.push('LONGER_CEREMONIAL');
  }
  if (signals.contempt >= 0.72 || scene.sceneFlavor === 'PREDATOR') {
    inferred.push('MORE_MOCKING');
  }
  if (hasText(context.callbackAnchorId) && (signals.respect + signals.fascination >= 0.95)) {
    inferred.push('PERSONAL_HISTORY_REWRITE');
  }
  if (/pre|open|warning|telegraph|setup|rescue-window/.test(scene.sceneArchetypeSlug)) {
    inferred.push('MORE_PRE_EVENT');
  }
  if (/post|after|aftermath|recovery|fallout/.test(scene.sceneArchetypeSlug)) {
    inferred.push('MORE_POST_EVENT');
  }
  if ((line.sceneRoles ?? EMPTY_TAGS).some((role) => /witness|crowd|public|announcer/i.test(role))) {
    inferred.push('MORE_PUBLIC');
  }
  if ((line.tags ?? EMPTY_TAGS).some((tag) => /intimate|confessional|private/i.test(tag))) {
    inferred.push('MORE_INTIMATE');
  }

  return inferred;
}

function sortTransforms(values: readonly SharedChatRealizationTransform[]): SharedChatRealizationTransform[] {
  return [...values].sort((left, right) => {
    const byPriority = PRIORITY[left] - PRIORITY[right];
    if (byPriority !== 0) {
      return byPriority;
    }
    return left.localeCompare(right);
  });
}

function computeMotifCluster(line: SharedCanonicalChatLine, lexical: LexicalDigest, scene: SceneDigest): string {
  if (hasText(line.motifId)) {
    return line.motifId;
  }
  if (lexical.topLexemes.length > 0) {
    return `${scene.sceneFlavor.toLowerCase()}:${lexical.topLexemes.slice(0, 2).join('-')}`;
  }
  return `${scene.sceneFlavor.toLowerCase()}:${toSlug(line.category) || 'generic'}`;
}

function computeRhetoricalBase(
  line: SharedCanonicalChatLine,
  signals: SignalVector,
  lexical: LexicalDigest,
  scene: SceneDigest,
): string {
  if (hasText(line.rhetoricalForm)) {
    return line.rhetoricalForm;
  }
  if (signals.tone === 'RITUAL') {
    return 'ritual-pronouncement';
  }
  if (signals.contempt >= 0.62 && scene.sceneFlavor === 'PREDATOR') {
    return 'predatory-assertion';
  }
  if (signals.contempt >= 0.62) {
    return 'cutting-assertion';
  }
  if (signals.fear >= 0.58 || lexical.clauseShape === 'SURGE') {
    return 'pressure-escalation';
  }
  if (signals.fascination >= 0.56) {
    return 'controlled-observation';
  }
  if (scene.sceneFlavor === 'PHANTOM') {
    return 'haunted-witness';
  }
  if (scene.sceneFlavor === 'SYNDICATE') {
    return 'cohort-pressure';
  }
  if (scene.sceneFlavor === 'EMPIRE') {
    return 'sovereign-judgment';
  }
  return 'authored-base';
}

function buildLeadCandidates(
  line: SharedCanonicalChatLine,
  context: SharedChatRealizationContext,
  signals: SignalVector,
  scene: SceneDigest,
  seed: number,
): string[] {
  const leads: string[] = [];
  leads.push(chooseSeeded(TONE_FOUNDATION_LEADS[signals.tone], seed ^ 101));
  leads.push(chooseSeeded(HEAT_BAND_MODIFIERS[signals.heatBand], seed ^ 102));

  if (signals.publicness === 'PUBLIC') {
    leads.push(phraseFromBand(PUBLIC_OPENERS, signals.heatBand, seed ^ 201));
  }
  if (signals.publicness === 'PRIVATE') {
    leads.push(phraseFromBand(PRIVATE_OPENERS, signals.heatBand, seed ^ 202));
  }
  if (hasText(context.callbackText)) {
    leads.push(phraseFromBand(CALLBACK_BRIDGES, signals.heatBand, seed ^ 203));
  }
  if (hasText(context.callbackAnchorId)) {
    leads.push(phraseFromBand(HISTORY_BRIDGES, signals.heatBand, seed ^ 204));
  }
  if ((line.tags ?? EMPTY_TAGS).some((tag) => /warning|telegraph|setup|pre/i.test(tag))) {
    leads.push(phraseFromBand(PRE_EVENT_OPENERS, signals.heatBand, seed ^ 205));
  }
  if ((line.tags ?? EMPTY_TAGS).some((tag) => /fallout|aftermath|post|witness|result/i.test(tag))) {
    leads.push(phraseFromBand(POST_EVENT_OPENERS, signals.heatBand, seed ^ 206));
  }
  leads.push(...scene.roleHints);
  leads.push(...scene.archetypeHints);
  leads.push(...scene.tagHints);

  return uniqueStrings(leads);
}

function chooseOpeningLead(candidates: readonly string[], signals: SignalVector, seed: number): string | null {
  if (candidates.length === 0) {
    return null;
  }
  if (signals.tone === 'RITUAL' || signals.publicness !== 'HYBRID') {
    return candidates[seededIndex(candidates.length, seed)] ?? null;
  }
  return candidates[seededIndex(Math.max(1, Math.min(candidates.length, 4)), seed)] ?? null;
}

function computeBridgeLead(signals: SignalVector, scene: SceneDigest, seed: number): string | null {
  const bridgeOptions: string[] = [];
  if (signals.heatBand === 'CRITICAL' || signals.heatBand === 'HIGH') {
    bridgeOptions.push('Consequence is already attaching to the phrasing.');
    bridgeOptions.push('The room is converting wording into cost in real time.');
  }
  if (scene.sceneFlavor === 'PREDATOR') {
    bridgeOptions.push('Negotiation pressure is reading every hesitation as a price signal.');
  }
  if (scene.sceneFlavor === 'SYNDICATE') {
    bridgeOptions.push('Trust architecture is quietly evaluating every clause.');
  }
  if (scene.sceneFlavor === 'PHANTOM') {
    bridgeOptions.push('Memory is present in the room even when no one names it.');
  }
  if (scene.sceneFlavor === 'EMPIRE') {
    bridgeOptions.push('Hierarchy is reading tone as policy, not personality.');
  }
  return bridgeOptions.length > 0 ? bridgeOptions[seededIndex(bridgeOptions.length, seed)] ?? null : null;
}

function computeClosingEcho(
  line: SharedCanonicalChatLine,
  signals: SignalVector,
  scene: SceneDigest,
  seed: number,
): string | null {
  const forcedRecord = (line.tags ?? EMPTY_TAGS).some((tag) => /record|ledger|proof|witness/i.test(tag))
    || scene.sceneFlavor === 'PHANTOM'
    || scene.sceneFlavor === 'EMPIRE';

  if (forcedRecord || signals.tone === 'RITUAL') {
    return phraseFromBand(CLOSER_BANK, signals.heatBand, seed ^ 401);
  }
  if (signals.tone === 'ICE' || signals.cadence === 'TIGHT' || scene.sceneFlavor === 'PREDATOR') {
    return phraseFromBand(CLOSER_BANK, signals.heatBand, seed ^ 402);
  }
  if (signals.publicness === 'PUBLIC' && signals.heatBand !== 'LOW') {
    return phraseFromBand(CLOSER_BANK, signals.heatBand, seed ^ 403);
  }
  return null;
}

function applySeededReplacements(
  text: string,
  replacements: ReadonlyArray<readonly [RegExp, readonly string[]]>,
  seed: number,
): string {
  let output = text;
  for (const [pattern, options] of replacements) {
    output = output.replace(pattern, chooseSeeded(options, seed ^ hashSeed(pattern.source)));
  }
  return output;
}

function replacePersonalPronouns(text: string, alias: string): string {
  let output = text;
  for (const rule of INTIMACY_RULES) {
    output = output.replace(rule.pattern, rule.apply(alias));
  }
  return output;
}

function styleFingerprint(
  line: SharedCanonicalChatLine,
  context: SharedChatRealizationContext,
  signals: SignalVector,
  lexical: LexicalDigest,
  scene: SceneDigest,
): string {
  return [
    `bot:${toSlug(line.botId) || 'unknown'}`,
    `flavor:${scene.sceneFlavor.toLowerCase()}`,
    `tone:${signals.tone.toLowerCase()}`,
    `heat:${signals.heatBand.toLowerCase()}`,
    `cadence:${signals.cadence.toLowerCase()}`,
    `public:${signals.publicness.toLowerCase()}`,
    `shape:${lexical.clauseShape.toLowerCase()}`,
    `motif:${toSlug(lexical.motifStem) || 'generic'}`,
    `scene:${scene.sceneArchetypeSlug}`,
    `role:${scene.sceneRoleSlug}`,
    `pressure:${toSlug(context.pressureBand ?? 'calm') || 'calm'}`,
  ].join('|');
}

function buildPlan(line: SharedCanonicalChatLine, context: SharedChatRealizationContext): RealizationPlan {
  const seed = hashSeed([
    line.canonicalLineId,
    line.botId,
    line.category,
    line.text,
    context.sceneId ?? '',
    context.sceneArchetype ?? '',
    context.sceneRole ?? '',
    context.pressureBand ?? '',
    context.relationshipEscalationTier ?? '',
    context.callbackAnchorId ?? '',
    context.playerAlias ?? '',
    `${context.now}`,
  ].join('|'));

  const signals = buildSignals(context);
  const lexical = computeLexicalDigest(line, signals);
  const scene = computeSceneDigest(line, context, seed);
  const explicitTransforms = unique(context.transforms ?? EMPTY_TRANSFORMS);
  const inferredTransforms = unique(inferTransforms(line, context, signals, lexical, scene));
  const transforms = sortTransforms(unique([...explicitTransforms, ...inferredTransforms]));
  const motifCluster = computeMotifCluster(line, lexical, scene);
  const rhetoricalBase = computeRhetoricalBase(line, signals, lexical, scene);
  const leadCandidates = buildLeadCandidates(line, context, signals, scene, seed);

  return {
    seed,
    explicitTransforms: Object.freeze(sortTransforms(explicitTransforms)),
    inferredTransforms: Object.freeze(sortTransforms(inferredTransforms)),
    transforms: Object.freeze(transforms),
    signals,
    lexical,
    scene,
    motifCluster,
    rhetoricalBase,
    openingLead: chooseOpeningLead(leadCandidates, signals, seed ^ 301),
    bridgeLead: computeBridgeLead(signals, scene, seed ^ 302),
    closingEcho: computeClosingEcho(line, signals, scene, seed ^ 303),
    styleFingerprint: styleFingerprint(line, context, signals, lexical, scene),
  };
}



function realizeCallback(text: string, runtime: TransformRuntime): string {
  const callback = normalizePunctuation(runtime.context.callbackText ?? '');
  if (!callback) {
    return text;
  }

  const lead = phraseFromBand(CALLBACK_BRIDGES, runtime.plan.signals.heatBand, runtime.plan.seed ^ 501);
  const tail = chooseSeeded([
    `You said "${callback}." The room kept that.`,
    `Your earlier words — "${callback}." — remained active.`,
    `The callback is simple: "${callback}." It never left the room.`,
    `The room stored "${callback}." and waited for this sentence to arrive.`,
    `That earlier line — "${callback}." — is still shaping the room's reading.`,
    `The previous wording "${callback}." has now become leverage.`,
  ], runtime.plan.seed ^ 502);

  return appendTail(prependLead(text, lead), tail);
}

function realizePressure(text: string, runtime: TransformRuntime): string {
  const band = normalizeSpace(runtime.context.pressureBand ?? '').toUpperCase() || runtime.plan.signals.heatBand;
  const lead = chooseSeeded([
    `Pressure tier ${band}.`,
    'The structure is tightening.',
    'Nothing in the room is relaxing around this choice.',
    'Pressure is now doing visible work inside the sentence.',
    'The exchange has entered a narrower risk band.',
    'The room is reading this under accelerated consequence.',
  ], runtime.plan.seed ^ 601);

  const tail = runtime.plan.signals.heatBand === 'HIGH' || runtime.plan.signals.heatBand === 'CRITICAL'
    ? chooseSeeded([
      'Every witness is adjusting for consequence now.',
      'The sentence should be read with less optimism than it first invites.',
      'The room is already repricing what this means.',
      'The line no longer arrives in a forgiving environment.',
      'Interpretation has tightened around the harsher option.',
      'The pressure field is stronger than the wording admits.',
    ], runtime.plan.seed ^ 602)
    : chooseSeeded([
      'The room can still redirect, but not pretend.',
      'There is still some slack left, but less than the line suggests.',
      'This remains recoverable only if the next choice is cleaner.',
    ], runtime.plan.seed ^ 603);

  return appendTail(prependLead(text, lead), tail);
}

function realizeHistory(text: string, runtime: TransformRuntime): string {
  const lead = phraseFromBand(HISTORY_BRIDGES, runtime.plan.signals.heatBand, runtime.plan.seed ^ 701);
  const tail = chooseSeeded([
    'This lands against previous contact, not empty air.',
    'History removes the luxury of pretending this is isolated.',
    'The past is doing some of the speaking here.',
    'Repeated contact has sharpened the room’s reading.',
    'The line is being interpreted through accumulated memory.',
    'The room heard the old pattern inside the new sentence.',
  ], runtime.plan.seed ^ 702);

  return appendTail(prependLead(text, lead), tail);
}

function realizePublic(text: string, runtime: TransformRuntime): string {
  return prependLead(text, phraseFromBand(PUBLIC_OPENERS, runtime.plan.signals.heatBand, runtime.plan.seed ^ 801));
}

function realizePreEvent(text: string, runtime: TransformRuntime): string {
  return prependLead(text, phraseFromBand(PRE_EVENT_OPENERS, runtime.plan.signals.heatBand, runtime.plan.seed ^ 901));
}

function realizePostEvent(text: string, runtime: TransformRuntime): string {
  return prependLead(text, phraseFromBand(POST_EVENT_OPENERS, runtime.plan.signals.heatBand, runtime.plan.seed ^ 902));
}

function realizeDirect(text: string, runtime: TransformRuntime): string {
  let output = applySeededReplacements(text, DIRECT_REPLACEMENTS, runtime.plan.seed ^ 1001);
  if (runtime.plan.signals.cadence === 'TIGHT') {
    output = output.replace(/\breally\b/gi, '').replace(/\bjust\b/gi, '');
  }
  return normalizePunctuation(output);
}

function realizeMocking(text: string, runtime: TransformRuntime): string {
  let output = applySeededReplacements(text, MOCKING_REPLACEMENTS, runtime.plan.seed ^ 1101);
  if (!/[.?!]$/.test(output)) {
    output = `${output}.`;
  }
  return normalizePunctuation(output);
}

function realizeIntimate(text: string, runtime: TransformRuntime): string {
  const alias = normalizeSpace(runtime.context.playerAlias ?? '');
  return alias ? replacePersonalPronouns(text, alias) : text;
}

function realizeShorterColder(text: string, runtime: TransformRuntime): string {
  const fragments = normalizePunctuation(text)
    .split(/(?<=[.?!])\s+/)
    .map((fragment) => normalizeSpace(fragment))
    .filter(Boolean);

  let selected = fragments;
  if (fragments.length >= 3) {
    selected = [fragments[0], fragments[fragments.length - 1]];
  } else if (fragments.length === 2 && runtime.plan.signals.heatBand !== 'LOW') {
    selected = [fragments[1]];
  }

  let output = normalizePunctuation(selected.join(' '));
  output = output
    .replace(/\bVery well\.\s*/gi, '')
    .replace(/\bInteresting\.\s*/gi, '')
    .replace(/\bFor the record,\s*/gi, '')
    .replace(/\bLet the room hear this plainly,\s*/gi, '')
    .replace(/\bObserve the structure before you react to the surface\.\s*/gi, '');

  output = normalizePunctuation(output);
  return /[.?!]$/.test(output) ? output : `${output}.`;
}

function realizeLongerCeremonial(text: string, runtime: TransformRuntime): string {
  const lead = chooseSeeded(TONE_FOUNDATION_LEADS.RITUAL, runtime.plan.seed ^ 1201);
  const middle = runtime.plan.bridgeLead ?? chooseSeeded([
    'The room receives the line as though witness matters.',
    'The exchange behaves more like inscription than chatter.',
    'This sentence carries a memory-bearing cadence.',
  ], runtime.plan.seed ^ 1202);
  const tail = phraseFromBand(CLOSER_BANK, runtime.plan.signals.heatBand, runtime.plan.seed ^ 1203);
  return appendTail(prependLead(prependLead(text, lead), middle), tail);
}

function applyTransform(transform: SharedChatRealizationTransform, text: string, runtime: TransformRuntime): string {
  switch (transform) {
    case 'MORE_PUBLIC':
      return realizePublic(text, runtime);
    case 'CALLBACK_REWRITE':
      return realizeCallback(text, runtime);
    case 'PRESSURE_REWRITE':
      return realizePressure(text, runtime);
    case 'MORE_DIRECT':
      return realizeDirect(text, runtime);
    case 'MORE_MOCKING':
      return realizeMocking(text, runtime);
    case 'PERSONAL_HISTORY_REWRITE':
      return realizeHistory(text, runtime);
    case 'SHORTER_COLDER':
      return realizeShorterColder(text, runtime);
    case 'LONGER_CEREMONIAL':
      return realizeLongerCeremonial(text, runtime);
    case 'MORE_INTIMATE':
      return realizeIntimate(text, runtime);
    case 'MORE_POST_EVENT':
      return realizePostEvent(text, runtime);
    case 'MORE_PRE_EVENT':
      return realizePreEvent(text, runtime);
    default:
      return text;
  }
}

function maybeLayerOpening(text: string, plan: RealizationPlan): string {
  let output = text;
  if (plan.openingLead && (plan.signals.publicness !== 'HYBRID' || plan.signals.tone === 'RITUAL')) {
    output = prependLead(output, plan.openingLead);
  }
  if (plan.bridgeLead && (plan.signals.heatBand === 'HIGH' || plan.signals.heatBand === 'CRITICAL')) {
    output = prependLead(output, plan.bridgeLead);
  }
  return output;
}

function finalizeText(text: string, line: SharedCanonicalChatLine, plan: RealizationPlan): string {
  let output = normalizePunctuation(text);
  output = maybeLayerOpening(output, plan);

  const shouldClose =
    Boolean(plan.closingEcho)
    && (
      plan.signals.tone === 'RITUAL'
      || plan.signals.heatBand === 'HIGH'
      || plan.signals.heatBand === 'CRITICAL'
      || (line.tags ?? EMPTY_TAGS).some((tag) => /record|ledger|proof|witness|legend/i.test(tag))
    );

  if (shouldClose && plan.closingEcho) {
    output = appendTail(output, plan.closingEcho);
  }

  if (!/[.?!]$/.test(output)) {
    output = `${output}.`;
  }

  return normalizePunctuation(output);
}

function strategyString(line: SharedCanonicalChatLine, context: SharedChatRealizationContext, plan: RealizationPlan): string {
  return [
    `arch:${plan.scene.sceneArchetypeSlug}`,
    `role:${plan.scene.sceneRoleSlug}`,
    `pressure:${toSlug(context.pressureBand ?? 'calm') || 'calm'}`,
    `escalation:${toSlug(context.relationshipEscalationTier ?? 'none') || 'none'}`,
    `tone:${plan.signals.tone.toLowerCase()}`,
    `heat:${plan.signals.heatBand.toLowerCase()}`,
    `cadence:${plan.signals.cadence.toLowerCase()}`,
    `public:${plan.signals.publicness.toLowerCase()}`,
    `witness:${plan.signals.witnessState.toLowerCase()}`,
    `flavor:${plan.scene.sceneFlavor.toLowerCase()}`,
    `motif:${toSlug(plan.motifCluster) || 'generic'}`,
    `category:${toSlug(line.category) || 'generic'}`,
    `shape:${plan.lexical.clauseShape.toLowerCase()}`,
  ].join('|');
}

function rhetoricalIds(
  line: SharedCanonicalChatLine,
  context: SharedChatRealizationContext,
  plan: RealizationPlan,
): string[] {
  const ids: string[] = [
    plan.rhetoricalBase,
    `tone:${plan.signals.tone.toLowerCase()}`,
    `cadence:${plan.signals.cadence.toLowerCase()}`,
    `heat:${plan.signals.heatBand.toLowerCase()}`,
    `public:${plan.signals.publicness.toLowerCase()}`,
    `flavor:${plan.scene.sceneFlavor.toLowerCase()}`,
    `shape:${plan.lexical.clauseShape.toLowerCase()}`,
  ];

  if (hasText(context.sceneRole)) {
    ids.push(`scene-role:${toSlug(context.sceneRole ?? '')}`);
  }
  if (hasText(context.sceneArchetype)) {
    ids.push(`scene-archetype:${toSlug(context.sceneArchetype ?? '')}`);
  }
  for (const transform of plan.transforms) {
    ids.push(`transform:${transform.toLowerCase()}`);
  }
  for (const role of line.sceneRoles ?? EMPTY_TAGS) {
    ids.push(`line-scene-role:${toSlug(role)}`);
  }
  for (const token of plan.lexical.topLexemes.slice(0, 3)) {
    ids.push(`lex:${token}`);
  }

  return uniqueStrings(ids);
}

function semanticIds(
  line: SharedCanonicalChatLine,
  context: SharedChatRealizationContext,
  plan: RealizationPlan,
  realizedText: string,
): string[] {
  const ids: string[] = [
    plan.motifCluster,
    hasText(context.sceneArchetype) ? context.sceneArchetype! : 'scene-generic',
    hasText(context.sceneRole) ? context.sceneRole! : 'role-generic',
    `bot:${toSlug(line.botId) || 'unknown'}`,
    `category:${toSlug(line.category) || 'generic'}`,
    `tone:${plan.signals.tone.toLowerCase()}`,
    `flavor:${plan.scene.sceneFlavor.toLowerCase()}`,
    `shape:${plan.lexical.clauseShape.toLowerCase()}`,
  ];

  for (const token of topTokens(realizedText, 6)) {
    ids.push(`lex:${token}`);
  }
  for (const token of plan.lexical.rareLexemes.slice(0, 4)) {
    ids.push(`rare:${token}`);
  }
  if (hasText(line.targetPlayerTrait)) {
    ids.push(`trait:${toSlug(line.targetPlayerTrait ?? '')}`);
  }
  if (hasText(line.botObjective)) {
    ids.push(`objective:${toSlug(line.botObjective ?? '')}`);
  }
  if (hasText(line.emotionPayload)) {
    ids.push(`emotion:${toSlug(line.emotionPayload ?? '')}`);
  }

  return uniqueStrings(ids);
}

function resultTags(
  line: SharedCanonicalChatLine,
  context: SharedChatRealizationContext,
  plan: RealizationPlan,
): string[] {
  const tags: string[] = [...(line.tags ?? EMPTY_TAGS)];
  tags.push(
    `surface-realizer:${CHAT_SURFACE_REALIZER_VERSION}`,
    `tone:${plan.signals.tone.toLowerCase()}`,
    `heat:${plan.signals.heatBand.toLowerCase()}`,
    `cadence:${plan.signals.cadence.toLowerCase()}`,
    `publicness:${plan.signals.publicness.toLowerCase()}`,
    `witness:${plan.signals.witnessState.toLowerCase()}`,
    `scene-flavor:${plan.scene.sceneFlavor.toLowerCase()}`,
    `shape:${plan.lexical.clauseShape.toLowerCase()}`,
  );

  if (hasText(context.pressureBand)) {
    tags.push(`pressure:${toSlug(context.pressureBand ?? '')}`);
  }
  if (hasText(context.relationshipEscalationTier)) {
    tags.push(`relationship-escalation:${toSlug(context.relationshipEscalationTier ?? '')}`);
  }
  if (hasText(context.sceneArchetype)) {
    tags.push(`scene-archetype:${toSlug(context.sceneArchetype ?? '')}`);
  }
  if (hasText(context.sceneRole)) {
    tags.push(`scene-role:${toSlug(context.sceneRole ?? '')}`);
  }
  if (hasText(context.playerAlias)) {
    tags.push('player-alias-bound');
  }
  if (hasText(context.callbackText)) {
    tags.push('callback-active');
  }
  if (hasText(context.callbackAnchorId)) {
    tags.push('callback-anchor-bound');
  }
  for (const transform of plan.transforms) {
    tags.push(`transform-applied:${transform.toLowerCase()}`);
  }
  for (const hint of [...plan.scene.roleHints, ...plan.scene.archetypeHints, ...plan.scene.tagHints]) {
    tags.push(`hint:${toSlug(hint).slice(0, 48)}`);
  }

  return uniqueStrings(tags);
}

function surfaceVariantId(
  line: SharedCanonicalChatLine,
  strategy: string,
  realizedText: string,
  plan: RealizationPlan,
  context: SharedChatRealizationContext,
): string {
  const signature = [
    line.canonicalLineId,
    line.botId,
    strategy,
    realizedText,
    `${context.now}`,
    `${plan.seed}`,
    plan.styleFingerprint,
  ].join('|');

  return `${line.canonicalLineId}:${hashSeed(signature).toString(16)}`;
}

function explain(
  line: SharedCanonicalChatLine,
  context: SharedChatRealizationContext,
  plan: RealizationPlan,
): ChatSurfaceRealizerExplainResult {
  return Object.freeze({
    canonicalLineId: line.canonicalLineId,
    strategy: strategyString(line, context, plan),
    seed: plan.seed,
    tone: plan.signals.tone,
    heatBand: plan.signals.heatBand,
    cadence: plan.signals.cadence,
    publicness: plan.signals.publicness,
    sceneFlavor: plan.scene.sceneFlavor,
    motifCluster: plan.motifCluster,
    rhetoricalBase: plan.rhetoricalBase,
    styleFingerprint: plan.styleFingerprint,
    transformsExplicit: plan.explicitTransforms,
    transformsInferred: plan.inferredTransforms,
    transformsApplied: plan.transforms,
    roleHints: plan.scene.roleHints,
    archetypeHints: plan.scene.archetypeHints,
    tagHints: plan.scene.tagHints,
    lexical: plan.lexical,
  });
}

function lexicalOverlap(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  const leftSet = new Set(left);
  let shared = 0;
  for (const token of right) {
    if (leftSet.has(token)) {
      shared += 1;
    }
  }
  return shared / Math.max(left.length, right.length);
}

function candidateScore(
  line: SharedCanonicalChatLine,
  result: SharedChatRealizationResult,
  explanation: ChatSurfaceRealizerExplainResult,
  context: SharedChatRealizationContext,
): number {
  let score = 0;
  score += explanation.transformsApplied.length * 0.15;
  score += explanation.tone === 'RITUAL' ? 0.18 : 0;
  score += explanation.heatBand === 'CRITICAL' ? 0.24 : explanation.heatBand === 'HIGH' ? 0.18 : explanation.heatBand === 'MEDIUM' ? 0.1 : 0.04;
  score += explanation.publicness === 'PUBLIC' && context.publicFacing === true ? 0.12 : 0;
  score += explanation.sceneFlavor !== 'GENERIC' ? 0.09 : 0;
  score += explanation.lexical.rareLexemes.length * 0.03;
  score += explanation.roleHints.length * 0.02;
  score += explanation.archetypeHints.length * 0.02;
  score += explanation.tagHints.length * 0.015;
  score += lexicalOverlap(explanation.lexical.topLexemes, topTokens(result.realizedText, 5)) * 0.1;
  score += hasText(line.botObjective) ? 0.03 : 0;
  score += hasText(line.targetPlayerTrait) ? 0.02 : 0;
  return Number(score.toFixed(6));
}



export class ChatSurfaceRealizer {
  public readonly version = CHAT_SURFACE_REALIZER_VERSION;

  public realize(
    line: SharedCanonicalChatLine,
    context: SharedChatRealizationContext,
  ): SharedChatRealizationResult {
    const plan = buildPlan(line, context);
    const runtime: TransformRuntime = { line, context, plan };

    let text = normalizePunctuation(normalizeSpace(line.text));
    for (const transform of plan.transforms) {
      text = normalizePunctuation(applyTransform(transform, text, runtime));
    }
    text = finalizeText(text, line, plan);

    const strategy = strategyString(line, context, plan);
    const rhetoricalTemplateIds = rhetoricalIds(line, context, plan);
    const semanticClusterIds = semanticIds(line, context, plan, text);
    const tags = resultTags(line, context, plan);

    return Object.freeze({
      canonicalLineId: line.canonicalLineId,
      surfaceVariantId: surfaceVariantId(line, strategy, text, plan, context),
      strategy,
      realizedText: text,
      transformsApplied: plan.transforms,
      rhetoricalTemplateIds,
      semanticClusterIds,
      tags,
    });
  }

  public realizeMany(
    lines: readonly SharedCanonicalChatLine[],
    context: SharedChatRealizationContext,
  ): SharedChatRealizationResult[] {
    return lines.map((line) => this.realize(line, context));
  }

  public explain(
    line: SharedCanonicalChatLine,
    context: SharedChatRealizationContext,
  ): ChatSurfaceRealizerExplainResult {
    return explain(line, context, buildPlan(line, context));
  }

  public previewStrategy(
    line: SharedCanonicalChatLine,
    context: SharedChatRealizationContext,
  ): string {
    return strategyString(line, context, buildPlan(line, context));
  }

  public planTransforms(
    line: SharedCanonicalChatLine,
    context: SharedChatRealizationContext,
  ): readonly SharedChatRealizationTransform[] {
    return buildPlan(line, context).transforms;
  }

  public rankCandidates(
    lines: readonly SharedCanonicalChatLine[],
    context: SharedChatRealizationContext,
  ): readonly ChatSurfaceRealizerCandidateScore[] {
    const scores = lines.map((line) => {
      const plan = buildPlan(line, context);
      const result = this.realize(line, context);
      const explanation = explain(line, context, plan);
      return Object.freeze({
        canonicalLineId: line.canonicalLineId,
        score: candidateScore(line, result, explanation, context),
        result,
        explanation,
      });
    });

    return Object.freeze(
      [...scores].sort((left, right) => {
        const byScore = right.score - left.score;
        if (byScore !== 0) {
          return byScore;
        }
        return left.canonicalLineId.localeCompare(right.canonicalLineId);
      }),
    );
  }

  public realizeBest(
    lines: readonly SharedCanonicalChatLine[],
    context: SharedChatRealizationContext,
  ): SharedChatRealizationResult | null {
    const ranked = this.rankCandidates(lines, context);
    return ranked.length > 0 ? ranked[0]?.result ?? null : null;
  }

  public exportManifest(): ChatSurfaceRealizerManifest {
    return Object.freeze({
      version: CHAT_SURFACE_REALIZER_VERSION,
      supportedTransforms: SUPPORTED_TRANSFORMS,
      sceneFlavors: Object.freeze(['EMPIRE', 'PREDATOR', 'SYNDICATE', 'PHANTOM', 'GENERIC'] as const),
      tones: Object.freeze(['ICE', 'COLD', 'CONTROLLED', 'HOT', 'RITUAL'] as const),
      heatBands: Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const),
      publicnessModes: Object.freeze(['PRIVATE', 'HYBRID', 'PUBLIC'] as const),
    });
  }
}

export function createChatSurfaceRealizer(): ChatSurfaceRealizer {
  return new ChatSurfaceRealizer();
}
