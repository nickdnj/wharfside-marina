/**
 * Wharfside Marina — Zod schemas (source of truth for request/response validation).
 *
 * Conventions:
 *   • Database `bigserial` IDs are surfaced as `string` over the wire (BigInt is not JSON-safe).
 *   • Dates: ISO-8601 string (`z.string().date()` for plain dates, `.datetime()` for timestamps).
 *   • `createXxxSchema` omits server-generated fields (id, createdAt, updatedAt).
 *   • Use `z.infer<typeof fooSchema>` to derive TS types.
 *
 * Mirror of `src/db/schema.ts`. Keep in sync when the DB schema changes.
 */

import { z } from "zod";

/* ============================================================
 * Enums (re-export as schemas + literals for narrow typing)
 * ============================================================ */

export const holderTypeEnum = z.enum([
  "resident_owner",
  "resident_renter",
  "non_resident_owner",
  "non_resident",
]);
export type HolderType = z.infer<typeof holderTypeEnum>;

export const slipTierEnum = z.enum(["Premium", "Standard", "Restricted"]);
export type SlipTier = z.infer<typeof slipTierEnum>;

export const slipTypeEnum = z.enum(["covered", "open", "end-tie", "side-tie"]);
export type SlipShape = z.infer<typeof slipTypeEnum>;

export const slipStatusEnum = z.enum(["active", "oos", "restoration-pending"]);
export type SlipStatus = z.infer<typeof slipStatusEnum>;

export const leaseTypeEnum = z.enum([
  "FULL_SEASON",
  "HALF_SEASON_1",
  "HALF_SEASON_2",
  "TRANSIENT",
]);
export type LeaseType = z.infer<typeof leaseTypeEnum>;

export const assignmentStatusEnum = z.enum([
  "proposed",
  "confirmed",
  "closed",
  "canceled",
]);
export type AssignmentStatus = z.infer<typeof assignmentStatusEnum>;

export const transientRequestStatusEnum = z.enum([
  "pending",
  "approved",
  "denied",
  "hold",
  "expired",
]);
export type TransientRequestStatus = z.infer<typeof transientRequestStatusEnum>;

export const docTypeEnum = z.enum([
  "COI",
  "registration",
  "indemnification",
  "captain",
  "survey",
  "RESIDENT_LEASE",
]);
export type DocType = z.infer<typeof docTypeEnum>;

export const docStatusEnum = z.enum(["pending", "approved", "rejected", "expired"]);
export type DocStatus = z.infer<typeof docStatusEnum>;

export const docMimeEnum = z.enum(["application/pdf", "image/jpeg", "image/png"]);
export type DocMime = z.infer<typeof docMimeEnum>;

export const feeScheduleStateEnum = z.enum([
  "draft",
  "submitted",
  "approved",
  "active",
  "archived",
]);
export type FeeScheduleState = z.infer<typeof feeScheduleStateEnum>;

export const scenarioStatusEnum = z.enum([
  "draft",
  "under_review",
  "submitted",
  "approved_superseded",
  "archived",
]);
export type ScenarioStatus = z.infer<typeof scenarioStatusEnum>;

export const userRoleEnum = z.enum(["super_admin", "eci_admin", "board", "holder"]);
export type UserRole = z.infer<typeof userRoleEnum>;

export const holderStatusEnum = z.enum(["active", "inactive", "suspended"]);
export type HolderStatus = z.infer<typeof holderStatusEnum>;

export const appFolioChargeTypeEnum = z.enum([
  "SLIP_FULL_SEASON",
  "SLIP_HALF_SEASON_1",
  "SLIP_HALF_SEASON_2",
  "TRANSIENT_NIGHT",
  "AMENITY_FEE",
  "PREMIUM_SURCHARGE",
]);
export type AppFolioChargeType = z.infer<typeof appFolioChargeTypeEnum>;

/* ============================================================
 * Shared sub-shapes
 * ============================================================ */

export const idString = z.string().min(1);
export const dateString = z.string().date();
export const datetimeString = z.string().datetime();

export const mailingAddressSchema = z.object({
  street: z.string().min(1).max(200),
  city: z.string().min(1).max(120),
  state: z.string().min(2).max(40),
  zip: z.string().min(3).max(20),
});
export type MailingAddress = z.infer<typeof mailingAddressSchema>;

export const polygonPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export const polygonSchema = z.array(polygonPointSchema).min(3);
export type Polygon = z.infer<typeof polygonSchema>;

export const slipAmenitiesSchema = z.object({
  power30A: z.boolean().default(false),
  power50A: z.boolean().default(false),
  water: z.boolean().default(false),
  pumpOutAdjacent: z.boolean().default(false),
});
export type SlipAmenities = z.infer<typeof slipAmenitiesSchema>;

export const fitFailureSchema = z.object({
  dim: z.enum(["LOA", "Beam", "Draft"]),
  vessel: z.number(),
  limit: z.number(),
});
export type FitFailure = z.infer<typeof fitFailureSchema>;

/* ============================================================
 * marina_config
 * ============================================================ */

export const marinaConfigSchema = z.object({
  id: idString,
  name: z.string().min(1).max(120),
  effectiveDate: dateString,
  isActive: z.boolean(),
  notes: z.string().nullable(),

  /* PRD §3.1.A — season parameters (modelable in scenarios) */
  seasonYear: z.number().int().min(2026).max(2100).optional(),
  seasonStartDate: dateString.optional(),
  seasonEndDate: dateString.optional(),
  halfSeasonSplitDate: dateString.optional(),
  residencyLockDate: dateString.optional(),
  defaultResidentDiscountMode: z
    .enum(["multiplier", "flat", "independent_rate"])
    .optional(),
  defaultResidentDiscountValue: z.number().optional(),
  defaultHalfSeasonPricingMode: z
    .enum(["multiplier", "flat", "independent_rate"])
    .optional(),
  defaultHalfSeasonPricingValue: z.number().optional(),

  createdAt: datetimeString,
  createdBy: idString.nullable(),
});
export type MarinaConfig = z.infer<typeof marinaConfigSchema>;

export const createMarinaConfigSchema = marinaConfigSchema.omit({
  id: true,
  createdAt: true,
  createdBy: true,
});
export type CreateMarinaConfig = z.infer<typeof createMarinaConfigSchema>;

/* ============================================================
 * slip
 * ============================================================ */

export const slipSchema = z.object({
  id: idString,
  configId: idString,
  slipNumber: z.string().min(1).max(20),
  positionPolygon: polygonSchema,
  loaLimitFt: z.number().positive().max(99.99),
  beamLimitFt: z.number().positive().max(99.99),
  minDepthAtMlwFt: z.number().positive().max(99.99),
  slipType: slipTypeEnum,
  amenities: slipAmenitiesSchema,
  status: slipStatusEnum,
  tier: slipTierEnum,
  feeModifier: z.number().min(0).max(9.999),
  notes: z.string().nullable(),
  createdAt: datetimeString,
  updatedAt: datetimeString,
});
export type Slip = z.infer<typeof slipSchema>;

export const createSlipSchema = slipSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateSlip = z.infer<typeof createSlipSchema>;

/* ============================================================
 * holder
 * ============================================================ */

export const holderSchema = z
  .object({
    id: idString,
    holderType: holderTypeEnum,
    legalName: z.string().min(1).max(200),
    email: z.string().email().max(254),
    phone: z.string().max(40).nullable(),
    mailingAddress: mailingAddressSchema.nullable(),
    wharfsideUnitNumber: z.string().max(40).nullable(),
    emergencyContactName: z.string().max(200).nullable(),
    emergencyContactPhone: z.string().max(40).nullable(),
    status: holderStatusEnum,
    notes: z.string().nullable(),
    residencyStateForSeasonYear: z.number().int().nullable().optional(),
    residencyStateLockedAt: datetimeString.nullable().optional(),
    leaseDocId: idString.nullable().optional(),
    createdAt: datetimeString,
    updatedAt: datetimeString,
  })
  .superRefine((val, ctx) => {
    /* CHECK from schema.ts: only pure non_resident may omit wharfside_unit_number. */
    if (val.holderType !== "non_resident" && !val.wharfsideUnitNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "wharfsideUnitNumber is required for any WMCA-connected holder type",
        path: ["wharfsideUnitNumber"],
      });
    }
  });
export type Holder = z.infer<typeof holderSchema>;

export const createHolderSchema = z
  .object({
    holderType: holderTypeEnum,
    legalName: z.string().min(1).max(200),
    email: z.string().email().max(254),
    phone: z.string().max(40).optional(),
    mailingAddress: mailingAddressSchema.optional(),
    wharfsideUnitNumber: z.string().max(40).optional(),
    emergencyContactName: z.string().max(200).optional(),
    emergencyContactPhone: z.string().max(40).optional(),
    status: holderStatusEnum.default("active"),
    notes: z.string().max(2000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.holderType !== "non_resident" && !val.wharfsideUnitNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "wharfsideUnitNumber is required for any WMCA-connected holder type",
        path: ["wharfsideUnitNumber"],
      });
    }
  });
export type CreateHolder = z.infer<typeof createHolderSchema>;

/* ============================================================
 * vessel
 * ============================================================ */

export const vesselSchema = z.object({
  id: idString,
  holderId: idString,
  name: z.string().min(1).max(120),
  loaFt: z.number().positive().max(99.99),
  beamFt: z.number().positive().max(99.99),
  draftFt: z.number().positive().max(99.99),
  hullColor: z.string().max(60).nullable(),
  propulsion: z.string().max(60).nullable(),
  registration: z.string().max(60).nullable(),
  status: z.enum(["active", "archived"]),
  createdAt: datetimeString,
  updatedAt: datetimeString,
});
export type Vessel = z.infer<typeof vesselSchema>;

export const createVesselSchema = vesselSchema.omit({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateVessel = z.infer<typeof createVesselSchema>;

/* ============================================================
 * assignment
 * ============================================================ */

export const assignmentSchema = z
  .object({
    id: idString,
    slipId: idString,
    holderId: idString.nullable(),
    vesselId: idString.nullable(),
    leaseType: leaseTypeEnum,
    startDate: dateString,
    endDate: dateString,
    seasonYear: z.number().int().min(2026).max(2100),
    status: assignmentStatusEnum,
    overrideReason: z.string().min(20).max(500).nullable(),
    transientRequestId: idString.nullable(),
    createdAt: datetimeString,
    updatedAt: datetimeString,
  })
  .superRefine((val, ctx) => {
    if (val.endDate < val.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endDate must be >= startDate",
        path: ["endDate"],
      });
    }
  });
export type Assignment = z.infer<typeof assignmentSchema>;

export const createAssignmentSchema = z
  .object({
    slipId: idString,
    holderId: idString.optional(),
    vesselId: idString.optional(),
    leaseType: leaseTypeEnum,
    startDate: dateString,
    endDate: dateString,
    seasonYear: z.number().int().min(2026).max(2100),
    status: assignmentStatusEnum.default("confirmed"),
    transientRequestId: idString.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.endDate < val.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endDate must be >= startDate",
        path: ["endDate"],
      });
    }
    /* Full/half assignments must have a holder + vessel. */
    if (val.leaseType !== "TRANSIENT") {
      if (!val.holderId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "holderId required for non-transient assignments",
          path: ["holderId"],
        });
      }
      if (!val.vesselId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "vesselId required for non-transient assignments",
          path: ["vesselId"],
        });
      }
    }
  });
export type CreateAssignment = z.infer<typeof createAssignmentSchema>;

/* ============================================================
 * transient_request
 * ============================================================ */

export const transientRequestSchema = z.object({
  id: idString,
  requesterName: z.string().min(1).max(200),
  requesterEmail: z.string().email().max(254),
  requesterPhone: z.string().max(40).nullable(),
  vesselName: z.string().max(120).nullable(),
  vesselLoaFt: z.number().positive().max(99.99).nullable(),
  vesselBeamFt: z.number().positive().max(99.99).nullable(),
  vesselDraftFt: z.number().positive().max(99.99).nullable(),
  requestedStart: dateString,
  requestedEnd: dateString,
  purpose: z.string().max(2000).nullable(),
  status: transientRequestStatusEnum,
  decisionReason: z.string().nullable(),
  decidedBy: idString.nullable(),
  decidedAt: datetimeString.nullable(),
  uploadToken: z.string().nullable(),
  uploadExpiresAt: datetimeString.nullable(),
  createdAt: datetimeString,
});
export type TransientRequest = z.infer<typeof transientRequestSchema>;

/* Public form posts a subset (no decision fields, no tokens, requester typed). */
export const publicTransientRequestSchema = z
  .object({
    requesterName: z.string().min(1).max(200),
    requesterEmail: z.string().email().max(254),
    requesterPhone: z.string().min(7).max(40),
    vesselName: z.string().min(1).max(120),
    vesselLoaFt: z.number().positive().max(99.99),
    vesselBeamFt: z.number().positive().max(99.99),
    vesselDraftFt: z.number().positive().max(99.99),
    requestedStart: dateString,
    requestedEnd: dateString,
    purpose: z.string().max(2000).optional(),
    acknowledgedRules: z.literal(true),
  })
  .superRefine((val, ctx) => {
    if (val.requestedEnd < val.requestedStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "requestedEnd must be >= requestedStart",
        path: ["requestedEnd"],
      });
    }
  });
export type PublicTransientRequest = z.infer<typeof publicTransientRequestSchema>;

/* ============================================================
 * document
 * ============================================================ */

export const documentSchema = z
  .object({
    id: idString,
    holderId: idString.nullable(),
    vesselId: idString.nullable(),
    docType: docTypeEnum,
    fileKey: z.string().min(1),
    fileName: z.string().min(1).max(255),
    fileSizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
    mimeType: docMimeEnum,
    expirationDate: dateString.nullable(),
    status: docStatusEnum,
    reviewNotes: z.string().nullable(),
    reviewerId: idString.nullable(),
    reviewedAt: datetimeString.nullable(),
    version: z.number().int().positive(),
    createdAt: datetimeString,
    updatedAt: datetimeString,
  })
  .superRefine((val, ctx) => {
    const targetsCount = (val.holderId ? 1 : 0) + (val.vesselId ? 1 : 0);
    if (targetsCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exactly one of holderId or vesselId must be set (XOR)",
        path: ["holderId"],
      });
    }
  });
export type DocumentEntity = z.infer<typeof documentSchema>;

export const documentUploadSchema = z
  .object({
    holderId: idString.optional(),
    vesselId: idString.optional(),
    docType: docTypeEnum,
    fileKey: z.string().min(1),
    fileName: z.string().min(1).max(255),
    fileSizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
    mimeType: docMimeEnum,
    expirationDate: dateString.optional(),
  })
  .superRefine((val, ctx) => {
    const targetsCount = (val.holderId ? 1 : 0) + (val.vesselId ? 1 : 0);
    if (targetsCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exactly one of holderId or vesselId must be set (XOR)",
        path: ["holderId"],
      });
    }
  });
export type DocumentUpload = z.infer<typeof documentUploadSchema>;

/* ============================================================
 * fee_schedule
 *
 * `base_config` is JSONB and structurally mirrors
 * `docs/pricing/fee-schedule-fy26-seed.json` (ARCH §7.2).
 * ============================================================ */

export const feeBaseConfigSchema = z.object({
  model: z.enum(["tier_based", "per_foot"]),
  base_rates_by_tier: z.object({
    Premium: z.object({ annual: z.number().nonnegative() }),
    Standard: z.object({ annual: z.number().nonnegative() }),
    Restricted: z.object({ annual: z.number().nonnegative() }),
  }),
  holder_multipliers: z.object({
    resident: z.number().nonnegative(),
    non_resident_owner: z.number().nonnegative(),
    non_resident: z.number().nonnegative(),
  }),
  lease_type_multipliers: z.object({
    FULL_SEASON: z.number().nonnegative(),
    HALF_SEASON_1: z.number().nonnegative(),
    HALF_SEASON_2: z.number().nonnegative(),
    TRANSIENT: z.number().nullable(),
  }),
  transient_per_foot_per_night: z.number().nonnegative(),
  amenity_fee: z.object({
    annual: z.number().nonnegative(),
    waived_for_resident: z.boolean(),
    half_season_proration: z.number().nonnegative().default(0.5),
  }),
  buy_in: z.object({
    amount: z.number().nonnegative(),
    applies_to: z.array(
      z.enum(["resident", "non_resident_owner", "non_resident"]),
    ),
  }),
  premium_surcharge_uses_slip_fee_modifier: z.boolean(),
  _holder_state_mapping: z
    .object({
      "resident-owner": z.literal("resident"),
      "resident-renter": z.literal("resident"),
      "non-resident-owner": z.literal("non_resident_owner"),
      "non-resident": z.literal("non_resident"),
    })
    .partial()
    .optional(),
});
export type FeeBaseConfig = z.infer<typeof feeBaseConfigSchema>;

export const feeScheduleSchema = z.object({
  id: idString,
  name: z.string().min(1).max(160),
  state: feeScheduleStateEnum,
  baseConfig: feeBaseConfigSchema,
  effectiveStart: dateString.nullable(),
  effectiveEnd: dateString.nullable(),
  approvalReference: z.string().nullable(),
  submittedAt: datetimeString.nullable(),
  approvedAt: datetimeString.nullable(),
  activatedAt: datetimeString.nullable(),
  archivedAt: datetimeString.nullable(),
  createdBy: idString.nullable(),
  createdAt: datetimeString,
  updatedAt: datetimeString,
});
export type FeeSchedule = z.infer<typeof feeScheduleSchema>;

/**
 * State-transition payload. Each `to` requires distinct metadata.
 * The Server Action checks the legality of (current state → to) and the metadata shape.
 */
export const feeScheduleStateTransitionSchema = z.discriminatedUnion("to", [
  z.object({
    feeScheduleId: idString,
    to: z.literal("submitted"),
    note: z.string().min(20).max(1000).optional(),
  }),
  z.object({
    feeScheduleId: idString,
    to: z.literal("approved"),
    approvalReference: z.string().min(3).max(500),
  }),
  z.object({
    feeScheduleId: idString,
    to: z.literal("active"),
    effectiveStart: dateString,
    effectiveEnd: dateString.optional(),
    confirmationPhrase: z.literal("APPROVED"),
  }),
  z.object({
    feeScheduleId: idString,
    to: z.literal("archived"),
    reason: z.string().max(500).optional(),
  }),
]);
export type FeeScheduleStateTransition = z.infer<typeof feeScheduleStateTransitionSchema>;

/* ============================================================
 * scenario
 * ============================================================ */

export const scenarioOccupancyAssumptionsSchema = z.object({
  fullSeasonPct: z.number().min(0).max(100).default(100),
  halfSeason1Pct: z.number().min(0).max(100).default(92),
  halfSeason2Pct: z.number().min(0).max(100).default(88),
  transientNightsPerSlipPerYear: z.number().min(0).max(365).default(22),
});

export const scenarioSeasonOverridesSchema = z.object({
  seasonStartDate: dateString.optional(),
  seasonEndDate: dateString.optional(),
  halfSeasonSplitDate: dateString.optional(),
  occupancyAssumptions: scenarioOccupancyAssumptionsSchema.optional(),
});
export type ScenarioSeasonOverrides = z.infer<typeof scenarioSeasonOverridesSchema>;

export const scenarioSchema = z.object({
  id: idString,
  name: z.string().min(1).max(160),
  feeScheduleId: idString,
  seasonOverrides: scenarioSeasonOverridesSchema.nullable(),
  projectedRevenue: z.number().nullable(),
  computedAt: datetimeString.nullable(),
  notes: z.string().nullable(),
  status: scenarioStatusEnum,
  createdBy: idString.nullable(),
  createdAt: datetimeString,
  updatedAt: datetimeString,
});
export type Scenario = z.infer<typeof scenarioSchema>;

/* ============================================================
 * app_user (read-only outward shape — no password_hash, no totp_secret)
 * ============================================================ */

export const appUserPublicSchema = z.object({
  id: idString,
  email: z.string().email(),
  name: z.string().nullable(),
  role: userRoleEnum,
  holderId: idString.nullable(),
  lastLoginAt: datetimeString.nullable(),
  status: z.enum(["active", "suspended"]),
});
export type AppUserPublic = z.infer<typeof appUserPublicSchema>;

/* ============================================================
 * Pricing line item — the resolver output unit
 * ============================================================ */

export const lineItemSchema = z.object({
  chargeType: appFolioChargeTypeEnum,
  description: z.string(),
  amount: z.number(),
});
export type LineItem = z.infer<typeof lineItemSchema>;
