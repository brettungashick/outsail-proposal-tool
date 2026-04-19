import { z } from 'zod';

// ── Shared field schemas ──

export const emailSchema = z.string().email('Invalid email address').transform(s => s.toLowerCase().trim());
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

// ── Auth schemas ──

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

// ── Project schemas ──

export const projectCreateSchema = z.object({
  clientName: z.string().min(1, 'Company name is required'),
  clientEmail: z.string().email().optional().or(z.literal('')),
});

// ── Analysis schemas ──

export const analysisCreateSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
});

export const analysisFinalizeSchema = z.object({
  answers: z.record(z.string(), z.string()).optional().default({}),
});

// ── Share schemas ──

export const shareCreateSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  email: emailSchema,
});

// ── User schemas ──

export const userCreateSchema = z.object({
  email: emailSchema,
  name: z.string().min(1, 'Name is required'),
});

// ── Vendor schemas ──

export const vendorCreateSchema = z.object({
  name: z.string().min(1, 'Vendor name is required').transform(s => s.trim()),
  logoUrl: z.string().url().optional().or(z.literal('')).or(z.null()),
  accentColor: z.string().optional().or(z.null()),
});

export const vendorUpdateSchema = z.object({
  name: z.string().min(1).transform(s => s.trim()).optional(),
  logoUrl: z.string().url().optional().or(z.literal('')).or(z.null()),
  accentColor: z.string().optional().or(z.null()),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field is required' });

// ── Document schemas ──

export const documentUploadSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required'),
  projectId: z.string().min(1, 'Project ID is required'),
  documentType: z.enum(['initial_quote', 'updated_quote', 'supporting_doc']).optional().default('initial_quote'),
  fileName: z.string().optional().default(''),
});

// ── Project update schema ──

export const projectUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  clientName: z.string().min(1).optional(),
  clientEmail: z.string().email().optional().or(z.literal('')).or(z.null()),
  status: z.enum(['draft', 'analyzing', 'clarifying', 'complete']).optional(),
});

// ── Analysis update schema ──

const ALLOWED_FIELD_TYPES = [
  'comparisonData',
  'standardizationNotes',
  'vendorNotes',
  'nextSteps',
  'discountToggles',
  'hiddenRows',
] as const;

export const analysisUpdateSchema = z.object({
  fieldPath: z.string().min(1, 'fieldPath is required'),
  oldValue: z.unknown(),
  newValue: z.unknown(),
  fieldType: z.enum(ALLOWED_FIELD_TYPES, {
    error: `fieldType must be one of: ${ALLOWED_FIELD_TYPES.join(', ')}`,
  }),
});

// ── Document update schema ──

export const documentUpdateSchema = z.object({
  isActive: z.boolean(),
});

// ── Invite accept schema ──

export const inviteAcceptSchema = z.object({
  password: passwordSchema,
});

// ── Learning event schemas ──

export const learningEventCreateSchema = z.object({
  analysisId: z.string().min(1),
  projectId: z.string().min(1),
  vendorName: z.string().min(1),
  rowId: z.string().min(1),
  colId: z.string().optional(),
  sectionName: z.string().min(1),
  vendorIndex: z.number().int().nonnegative().optional().default(0),
  editType: z.enum(['value_change', 'status_change', 'label_change']),
  oldDisplay: z.string().optional().default(''),
  oldAmount: z.number().nullable().optional(),
  oldStatus: z.string().nullable().optional(),
  newDisplay: z.string().optional().default(''),
  newAmount: z.number().nullable().optional(),
  newStatus: z.string().nullable().optional(),
  rowLabel: z.string().min(1),
  reasonTag: z.string().nullable().optional(),
});

export const learningEventPatchSchema = z.object({
  promotedToRuleId: z.string().min(1, 'promotedToRuleId is required'),
});

// ── Playbook schema ──

export const playbookCreateSchema = z.object({
  vendorName: z.string().min(1),
  name: z.string().min(1),
  conditionType: z.enum(['contains', 'regex']),
  conditionValue: z.string().min(1),
  conditionField: z.enum(['label', 'section', 'display']),
  actionType: z.enum(['set_status', 'add_note']),
  actionValue: z.string().min(1).refine((v) => {
    try { JSON.parse(v); return true; } catch { return false; }
  }, 'actionValue must be valid JSON'),
  examples: z.string().nullable().optional(),
  confidence: z.enum(['sure', 'maybe']).optional().default('sure'),
  createdFromEventId: z.string().nullable().optional(),
});

// ── Shared enums ──

export const projectStatusEnum = z.enum(['draft', 'analyzing', 'clarifying', 'complete']);
export const cellStatusEnum = z.enum(['currency', 'included', 'included_in_bundle', 'not_included', 'tbc', 'na', 'hidden']);
export const editTypeEnum = z.enum(['value_change', 'status_change', 'label_change']);

// ── Validation helper ──

import { NextResponse } from 'next/server';

export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown):
  { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Validation error', details: result.error.flatten().fieldErrors },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}
