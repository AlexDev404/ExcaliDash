# Fork Summary

This fork adds optional security features and UX improvements with **zero breaking changes** and **minimal migration overhead**. All security features are **disabled by default** via feature flags.

## Security Features Added

1. **Password Reset** - Token-based password reset flow (`/auth/password-reset-request`, `/auth/password-reset-confirm`)
2. **Refresh Token Rotation** - Prevents token reuse by rotating refresh tokens on each use
3. **Audit Logging** - Logs security events (logins, password changes, deletions) for compliance

## UX Improvements Added

1. **Profile Page** - View and edit personal information, change password (`/profile`)
2. **Select All Button** - Quick selection of all drawings in current view
3. **Sort Dropdown** - Improved sort controls with icons and separate direction toggle
4. **Auto-hide Header** - Editor header auto-hides to maximize drawing space (with toggle)

## Backward Compatibility

✅ All security features disabled by default  
✅ No breaking changes to existing code  
✅ Graceful degradation (missing tables don't cause errors)  
✅ Optional database migration  

## Enable Security Features

Set in `backend/.env`:
```bash
ENABLE_PASSWORD_RESET=true
ENABLE_REFRESH_TOKEN_ROTATION=true
ENABLE_AUDIT_LOGGING=true
```

Then run migration:
```bash
cd backend && npx prisma migrate deploy
```

## Migration Strategy

**For base project:** Keep features disabled (default) - no migration needed, zero risk.

**For this fork:** Enable features via environment variables when ready.

## Database Changes

Migration adds 3 optional tables (only used when features enabled):
- `PasswordResetToken` - For password reset flow
- `RefreshToken` - For token rotation tracking
- `AuditLog` - For security event logging

## Code Changes

### Backend
- Feature flags in `backend/src/config.ts`
- Conditional logic in auth endpoints
- Graceful error handling for missing tables
- New endpoints: `/auth/profile` (PUT), `/auth/change-password` (POST)
- Audit logging utility (`backend/src/utils/audit.ts`)

### Frontend
- Password reset pages (`/reset-password`, `/reset-password-confirm`)
- Profile page (`/profile`)
- Select All button in Dashboard
- Sort dropdown with icons
- Auto-hide header in Editor with toggle
- Updated API client for token rotation

All changes are backward compatible and optional.
