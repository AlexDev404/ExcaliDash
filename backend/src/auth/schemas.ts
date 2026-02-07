import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(50).optional(),
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(100),
  name: z.string().trim().min(1).max(100),
});

export const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).max(255).optional(),
    email: z.string().email().toLowerCase().trim().optional(),
    username: z.string().trim().min(1).max(255).optional(),
    password: z.string(),
  })
  .refine((data) => Boolean(data.identifier || data.email || data.username), {
    message: "identifier/email/username is required",
  });

export const registrationToggleSchema = z.object({
  enabled: z.boolean(),
});

export const adminRoleUpdateSchema = z.object({
  identifier: z.string().trim().min(1).max(255),
  role: z.enum(["ADMIN", "USER"]),
});

export const authEnabledToggleSchema = z.object({
  enabled: z.boolean(),
});

export const adminCreateUserSchema = z.object({
  username: z.string().trim().min(3).max(50).optional(),
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(100),
  name: z.string().trim().min(1).max(100),
  role: z.enum(["ADMIN", "USER"]).optional(),
  mustResetPassword: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const adminUpdateUserSchema = z.object({
  username: z.string().trim().min(3).max(50).nullable().optional(),
  name: z.string().trim().min(1).max(100).optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
  mustResetPassword: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const impersonateSchema = z
  .object({
    userId: z.string().trim().min(1).optional(),
    identifier: z.string().trim().min(1).optional(),
  })
  .refine((data) => Boolean(data.userId || data.identifier), {
    message: "userId/identifier is required",
  });

export const loginRateLimitUpdateSchema = z.object({
  enabled: z.boolean(),
  windowMs: z.number().int().min(10_000).max(24 * 60 * 60 * 1000),
  max: z.number().int().min(1).max(10_000),
});

export const loginRateLimitResetSchema = z.object({
  identifier: z.string().trim().min(1).max(255),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const updateEmailSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  currentPassword: z.string().min(1).max(100),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(100),
});

export const mustResetPasswordSchema = z.object({
  newPassword: z.string().min(8).max(100),
});
