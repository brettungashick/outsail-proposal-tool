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
