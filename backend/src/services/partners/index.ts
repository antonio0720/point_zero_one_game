/**
 * Point Zero One — Partner Cohorts Service Boundary
 * Path: backend/src/services/partners/cohorts/index.ts
 *
 * Clean-room rebuild for quarantined module.
 *
 * Design goals:
 * - Pure TypeScript, dependency-light, deterministic, and safe to import anywhere.
 * - Encodes partner cohort lifecycle concerns without assuming TypeORM entities or generated DTOs.
 * - Suitable as a service boundary, test fixture, or migration bridge until persistence is wired.
 */

export type PartnerSku = 'employer' | 'bank' | 'eap' | 'community' | 'school';
export type CohortState =
  | 'draft'
  | 'scheduled'
  | 'enrolling'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived';
export type CalendarEventKind = 'orientation' | 'founder-night' | 'session' | 'checkpoint' | 'graduation';
export type MembershipReceiptStatus = 'issued' | 'void';

export interface PartnerSeasonTemplate {
  id: string;
  partnerSku: PartnerSku;
  name: string;
  theme: string;
  arcIds: string[];
  cadencePresetId: string | null;
  founderNightEnabled: boolean;
  meetingIntervalDays: number;
  meetingCount: number;
  checkpointEvery: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SeasonWindow {
  id: string;
  label: string;
  startsAt: string;
  endsAt: string;
  enrollmentClosesAt: string;
}

export interface CohortCalendarEvent {
  id: string;
  cohortId: string;
  windowId: string;
  kind: CalendarEventKind;
  title: string;
  scheduledFor: string;
  durationMinutes: number;
  ordinal: number;
  attendanceCount: number;
  metadata: Record<string, unknown>;
}

export interface CohortMember {
  id: string;
  externalId: string;
  joinedAt: string;
  status: 'invited' | 'active' | 'paused' | 'removed' | 'graduated';
  tags: string[];
  attendedEventIds: string[];
}

export interface MembershipReceipt {
  id: string;
  cohortId: string;
  memberId: string;
  eventId: string;
  amountCents: number;
  currency: string;
  status: MembershipReceiptStatus;
  issuedAt: string;
  voidedAt: string | null;
  reason: string;
  integrityHash: string;
}

export interface PartnerCohort {
  id: string;
  partnerId: string;
  partnerSku: PartnerSku;
  slug: string;
  name: string;
  state: CohortState;
  capacity: number;
  startsAt: string;
  endsAt: string;
  enrollmentClosesAt: string;
  templateId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  windows: SeasonWindow[];
  events: CohortCalendarEvent[];
  members: CohortMember[];
  receipts: MembershipReceipt[];
}

export interface CreateSeasonTemplateInput {
  partnerSku: PartnerSku;
  name: string;
  theme: string;
  arcIds?: string[];
  cadencePresetId?: string | null;
  founderNightEnabled?: boolean;
  meetingIntervalDays?: number;
  meetingCount?: number;
  checkpointEvery?: number;
  tags?: string[];
}

export interface CreateCohortInput {
  partnerId: string;
  partnerSku: PartnerSku;
  slug?: string;
  name: string;
  capacity: number;
  startsAt: string;
  endsAt: string;
  enrollmentClosesAt?: string;
  templateId?: string | null;
  tags?: string[];
}

export interface EnrollMemberInput {
  cohortId: string;
  externalId: string;
  tags?: string[];
  joinedAt?: string;
}

export interface AttendanceInput {
  cohortId: string;
  memberId: string;
  eventId: string;
  amountCents?: number;
  currency?: string;
  reason?: string;
}

export interface PartnerCohortSummary {
  cohortId: string;
  name: string;
  state: CohortState;
  capacity: number;
  activeMembers: number;
  utilizationRatio: number;
  attendanceRatio: number;
  scheduledEvents: number;
  issuedReceiptCount: number;
  issuedReceiptValueCents: number;
  startsAt: string;
  endsAt: string;
  enrollmentClosesAt: string;
}

export interface PartnerCohortsServiceOptions {
  now?: () => Date;
  idPrefix?: string;
}

const DEFAULT_TEMPLATE_SEED: ReadonlyArray<CreateSeasonTemplateInput> = [
  {
    partnerSku: 'employer',
    name: 'Founding Career Mobility',
    theme: 'career-upshift',
    arcIds: ['orientation', 'cashflow', 'debt-control', 'promotion-sprint'],
    cadencePresetId: 'weekly-8',
    founderNightEnabled: true,
    meetingIntervalDays: 7,
    meetingCount: 8,
    checkpointEvery: 2,
    tags: ['founding', 'career'],
  },
  {
    partnerSku: 'bank',
    name: 'Verified Financial Confidence',
    theme: 'confidence-building',
    arcIds: ['onboarding', 'budget', 'savings', 'credit'],
    cadencePresetId: 'weekly-6',
    founderNightEnabled: false,
    meetingIntervalDays: 7,
    meetingCount: 6,
    checkpointEvery: 3,
    tags: ['retention', 'activation'],
  },
  {
    partnerSku: 'eap',
    name: 'Stability Reset',
    theme: 'stabilization',
    arcIds: ['baseline', 'stress-reduction', 'safety-buffer', 'recovery'],
    cadencePresetId: 'biweekly-6',
    founderNightEnabled: false,
    meetingIntervalDays: 14,
    meetingCount: 6,
    checkpointEvery: 2,
    tags: ['wellbeing', 'retention'],
  },
];

export class PartnerCohortsService {
  private readonly now: () => Date;
  private readonly idPrefix: string;
  private readonly templates = new Map<string, PartnerSeasonTemplate>();
  private readonly cohorts = new Map<string, PartnerCohort>();

  constructor(options: PartnerCohortsServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.idPrefix = options.idPrefix ?? 'pzo';

    for (const seed of DEFAULT_TEMPLATE_SEED) {
      this.createTemplate(seed);
    }
  }

  createTemplate(input: CreateSeasonTemplateInput): PartnerSeasonTemplate {
    const nowIso = this.now().toISOString();
    const template: PartnerSeasonTemplate = {
      id: this.createId(`template:${input.partnerSku}:${input.name}`),
      partnerSku: input.partnerSku,
      name: normalizeTitle(input.name),
      theme: normalizeSlug(input.theme),
      arcIds: dedupeStrings(input.arcIds ?? []),
      cadencePresetId: input.cadencePresetId ?? null,
      founderNightEnabled: input.founderNightEnabled ?? false,
      meetingIntervalDays: clampInteger(input.meetingIntervalDays ?? 7, 1, 365),
      meetingCount: clampInteger(input.meetingCount ?? 6, 1, 104),
      checkpointEvery: clampInteger(input.checkpointEvery ?? 2, 1, 104),
      tags: dedupeStrings(input.tags ?? []),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.templates.set(template.id, template);
    return deepClone(template);
  }

  listTemplatesBySku(partnerSku?: PartnerSku): PartnerSeasonTemplate[] {
    return [...this.templates.values()]
      .filter((template) => !partnerSku || template.partnerSku === partnerSku)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(deepClone);
  }

  createCohort(input: CreateCohortInput): PartnerCohort {
    const startsAt = normalizeIso(input.startsAt);
    const endsAt = normalizeIso(input.endsAt);
    const enrollmentClosesAt = normalizeIso(input.enrollmentClosesAt ?? startsAt);

    if (Date.parse(endsAt) < Date.parse(startsAt)) {
      throw new Error('Cohort endsAt must be on or after startsAt.');
    }

    const template = input.templateId ? this.requireTemplate(input.templateId) : null;
    const nowIso = this.now().toISOString();
    const cohortId = this.createId(`cohort:${input.partnerId}:${input.name}:${startsAt}`);
    const slug = normalizeSlug(input.slug ?? input.name);

    const windows = this.buildSeasonWindows(cohortId, startsAt, endsAt, enrollmentClosesAt);
    const events = template
      ? this.buildCalendar(cohortId, windows[0].id, startsAt, template)
      : [];

    const cohort: PartnerCohort = {
      id: cohortId,
      partnerId: String(input.partnerId),
      partnerSku: input.partnerSku,
      slug,
      name: normalizeTitle(input.name),
      state: Date.parse(startsAt) <= this.now().getTime() ? 'active' : 'scheduled',
      capacity: clampInteger(input.capacity, 1, 1_000_000),
      startsAt,
      endsAt,
      enrollmentClosesAt,
      templateId: template?.id ?? null,
      tags: dedupeStrings(input.tags ?? []),
      createdAt: nowIso,
      updatedAt: nowIso,
      windows,
      events,
      members: [],
      receipts: [],
    };

    this.cohorts.set(cohort.id, cohort);
    return deepClone(cohort);
  }

  listCohorts(partnerId?: string): PartnerCohort[] {
    return [...this.cohorts.values()]
      .filter((cohort) => !partnerId || cohort.partnerId === String(partnerId))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.name.localeCompare(b.name))
      .map(deepClone);
  }

  findCohortById(cohortId: string): PartnerCohort | null {
    const cohort = this.cohorts.get(cohortId);
    return cohort ? deepClone(cohort) : null;
  }

  transitionCohortState(cohortId: string, nextState: CohortState): PartnerCohort {
    const cohort = this.requireCohort(cohortId);
    cohort.state = nextState;
    cohort.updatedAt = this.now().toISOString();
    this.cohorts.set(cohort.id, cohort);
    return deepClone(cohort);
  }

  enrollMember(input: EnrollMemberInput): PartnerCohort {
    const cohort = this.requireCohort(input.cohortId);
    const externalId = String(input.externalId).trim();

    if (!externalId) {
      throw new Error('externalId is required.');
    }

    const activeMembers = cohort.members.filter((member) => member.status === 'active').length;
    const existing = cohort.members.find((member) => member.externalId === externalId);

    if (!existing && activeMembers >= cohort.capacity) {
      throw new Error('Cohort capacity exceeded.');
    }

    if (existing) {
      existing.status = 'active';
      existing.tags = dedupeStrings([...existing.tags, ...(input.tags ?? [])]);
      cohort.updatedAt = this.now().toISOString();
      return this.persistCohort(cohort);
    }

    cohort.members.push({
      id: this.createId(`member:${cohort.id}:${externalId}`),
      externalId,
      joinedAt: normalizeIso(input.joinedAt ?? this.now().toISOString()),
      status: 'active',
      tags: dedupeStrings(input.tags ?? []),
      attendedEventIds: [],
    });

    cohort.updatedAt = this.now().toISOString();
    return this.persistCohort(cohort);
  }

  removeMember(cohortId: string, memberId: string): PartnerCohort {
    const cohort = this.requireCohort(cohortId);
    const member = cohort.members.find((entry) => entry.id === memberId);

    if (!member) {
      throw new Error(`Member not found for cohort ${cohortId}.`);
    }

    member.status = 'removed';
    cohort.updatedAt = this.now().toISOString();
    return this.persistCohort(cohort);
  }

  recordAttendance(input: AttendanceInput): MembershipReceipt {
    const cohort = this.requireCohort(input.cohortId);
    const member = cohort.members.find((entry) => entry.id === input.memberId);
    const event = cohort.events.find((entry) => entry.id === input.eventId);

    if (!member) {
      throw new Error(`Member ${input.memberId} not found.`);
    }

    if (!event) {
      throw new Error(`Event ${input.eventId} not found.`);
    }

    if (!member.attendedEventIds.includes(event.id)) {
      member.attendedEventIds.push(event.id);
      event.attendanceCount += 1;
    }

    const nowIso = this.now().toISOString();
    const amountCents = clampInteger(input.amountCents ?? 0, 0, 10_000_000);
    const reason = input.reason?.trim() || `${event.kind} attendance`;
    const receipt: MembershipReceipt = {
      id: this.createId(`receipt:${cohort.id}:${member.id}:${event.id}:${nowIso}`),
      cohortId: cohort.id,
      memberId: member.id,
      eventId: event.id,
      amountCents,
      currency: (input.currency ?? 'USD').trim().toUpperCase(),
      status: 'issued',
      issuedAt: nowIso,
      voidedAt: null,
      reason,
      integrityHash: createIntegrityHash({
        cohortId: cohort.id,
        memberId: member.id,
        eventId: event.id,
        amountCents,
        currency: input.currency ?? 'USD',
        issuedAt: nowIso,
        reason,
      }),
    };

    cohort.receipts.push(receipt);
    cohort.updatedAt = nowIso;
    this.cohorts.set(cohort.id, cohort);
    return deepClone(receipt);
  }

  reconcileCapacity(cohortId: string): {
    cohortId: string;
    capacity: number;
    activeMembers: number;
    remainingSeats: number;
    overCapacityBy: number;
  } {
    const cohort = this.requireCohort(cohortId);
    const activeMembers = cohort.members.filter((member) => member.status === 'active').length;
    const remainingSeats = Math.max(0, cohort.capacity - activeMembers);
    const overCapacityBy = Math.max(0, activeMembers - cohort.capacity);

    return {
      cohortId,
      capacity: cohort.capacity,
      activeMembers,
      remainingSeats,
      overCapacityBy,
    };
  }

  summarizeCohort(cohortId: string): PartnerCohortSummary {
    const cohort = this.requireCohort(cohortId);
    const activeMembers = cohort.members.filter((member) => member.status === 'active').length;
    const possibleAttendances = Math.max(1, activeMembers * Math.max(1, cohort.events.length));
    const totalAttendance = cohort.members.reduce(
      (sum, member) => sum + member.attendedEventIds.length,
      0,
    );
    const issuedReceipts = cohort.receipts.filter((receipt) => receipt.status === 'issued');
    const issuedReceiptValueCents = issuedReceipts.reduce(
      (sum, receipt) => sum + receipt.amountCents,
      0,
    );

    return {
      cohortId: cohort.id,
      name: cohort.name,
      state: cohort.state,
      capacity: cohort.capacity,
      activeMembers,
      utilizationRatio: round(activeMembers / cohort.capacity, 4),
      attendanceRatio: round(totalAttendance / possibleAttendances, 4),
      scheduledEvents: cohort.events.length,
      issuedReceiptCount: issuedReceipts.length,
      issuedReceiptValueCents,
      startsAt: cohort.startsAt,
      endsAt: cohort.endsAt,
      enrollmentClosesAt: cohort.enrollmentClosesAt,
    };
  }

  createDefaultTemplates(): PartnerSeasonTemplate[] {
    return DEFAULT_TEMPLATE_SEED.map((input) => this.createTemplate(input));
  }

  private persistCohort(cohort: PartnerCohort): PartnerCohort {
    this.cohorts.set(cohort.id, cohort);
    return deepClone(cohort);
  }

  private requireTemplate(templateId: string): PartnerSeasonTemplate {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found.`);
    }
    return template;
  }

  private requireCohort(cohortId: string): PartnerCohort {
    const cohort = this.cohorts.get(cohortId);
    if (!cohort) {
      throw new Error(`Cohort ${cohortId} not found.`);
    }
    return cohort;
  }

  private buildSeasonWindows(
    cohortId: string,
    startsAt: string,
    endsAt: string,
    enrollmentClosesAt: string,
  ): SeasonWindow[] {
    return [
      {
        id: this.createId(`window:${cohortId}:${startsAt}`),
        label: 'primary-season-window',
        startsAt,
        endsAt,
        enrollmentClosesAt,
      },
    ];
  }

  private buildCalendar(
    cohortId: string,
    windowId: string,
    startsAt: string,
    template: PartnerSeasonTemplate,
  ): CohortCalendarEvent[] {
    const events: CohortCalendarEvent[] = [];
    const base = new Date(startsAt).getTime();
    let ordinal = 1;

    events.push({
      id: this.createId(`event:${cohortId}:orientation`),
      cohortId,
      windowId,
      kind: 'orientation',
      title: 'Orientation',
      scheduledFor: new Date(base).toISOString(),
      durationMinutes: 60,
      ordinal: ordinal++,
      attendanceCount: 0,
      metadata: { required: true },
    });

    if (template.founderNightEnabled) {
      events.push({
        id: this.createId(`event:${cohortId}:founder-night`),
        cohortId,
        windowId,
        kind: 'founder-night',
        title: 'Founder Night',
        scheduledFor: new Date(base + 24 * 60 * 60 * 1000).toISOString(),
        durationMinutes: 90,
        ordinal: ordinal++,
        attendanceCount: 0,
        metadata: { founderNight: true },
      });
    }

    for (let i = 0; i < template.meetingCount; i += 1) {
      const scheduledFor = new Date(
        base + i * template.meetingIntervalDays * 24 * 60 * 60 * 1000,
      ).toISOString();

      events.push({
        id: this.createId(`event:${cohortId}:session:${i + 1}`),
        cohortId,
        windowId,
        kind: 'session',
        title: `Session ${i + 1}`,
        scheduledFor,
        durationMinutes: 75,
        ordinal: ordinal++,
        attendanceCount: 0,
        metadata: {
          arcId: template.arcIds[i] ?? null,
          theme: template.theme,
        },
      });

      if ((i + 1) % template.checkpointEvery === 0) {
        events.push({
          id: this.createId(`event:${cohortId}:checkpoint:${i + 1}`),
          cohortId,
          windowId,
          kind: 'checkpoint',
          title: `Checkpoint ${i + 1}`,
          scheduledFor,
          durationMinutes: 30,
          ordinal: ordinal++,
          attendanceCount: 0,
          metadata: { checkpointOf: i + 1 },
        });
      }
    }

    events.push({
      id: this.createId(`event:${cohortId}:graduation`),
      cohortId,
      windowId,
      kind: 'graduation',
      title: 'Graduation',
      scheduledFor: new Date(
        base + template.meetingCount * template.meetingIntervalDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
      durationMinutes: 60,
      ordinal,
      attendanceCount: 0,
      metadata: { celebratory: true },
    });

    return events;
  }

  private createId(seed: string): string {
    return `${this.idPrefix}_${createIntegrityHash(seed).slice(0, 18)}`;
  }
}

export function createDefaultPartnerSeasonTemplates(): PartnerSeasonTemplate[] {
  return new PartnerCohortsService().listTemplatesBySku();
}

function normalizeIso(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO date: ${input}`);
  }
  return date.toISOString();
}

function normalizeSlug(input: string): string {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'unnamed';
}

function normalizeTitle(input: string): string {
  return String(input).trim().replace(/\s+/g, ' ').slice(0, 160) || 'Untitled';
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function clampInteger(value: number, min: number, max: number): number {
  const safe = Math.trunc(Number(value));
  if (!Number.isFinite(safe)) {
    return min;
  }
  return Math.max(min, Math.min(max, safe));
}

function round(value: number, scale: number): number {
  const factor = 10 ** scale;
  return Math.round(value * factor) / factor;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function createIntegrityHash(payload: unknown): string {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
