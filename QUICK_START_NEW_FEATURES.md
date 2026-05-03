# Quick Start - New Features

## For Admins

### Viewing Audit Logs
1. Go to Admin Panel
2. Click "Logs" tab
3. Filter by action type or refresh to see latest changes
4. Click "refresh" button to update

### Exporting Data
- **Equipment**: `GET /export/equipment` → Downloads CSV
- **Audit Logs**: `GET /export/audit-logs` → Downloads CSV

### Managing Users
1. Go to Admin Panel → Users tab
2. Create user with strong password (must have uppercase, lowercase, number, 8+ chars)
3. Set role (admin or user)
4. Can reset passwords anytime

## For Users

### Password Recovery
1. On login page, cannot log in?
2. Click "Forgot password"
3. Enter your email address
4. Check email for reset link (valid for 24 hours)
5. Set new password (must have uppercase, lowercase, number, 8+ chars)

## New API Endpoints

```bash
# Password management
POST /auth/forgot-password       # Request reset email
POST /auth/reset-password        # Reset with token

# Audit logs (admin only)
GET /audit-logs                  # All audit logs
GET /equipment/:id/audit         # Changes to specific equipment

# Data export (admin only)
GET /export/equipment            # CSV export
GET /export/audit-logs           # Audit CSV export

# Health check
GET /health                      # API and database status
```

## Security Notes

- Audit logs track: who changed what, when, and from which IP
- All passwords must be strong (uppercase, lowercase, number, 8+ chars)
- Maximum 5 login attempts per 15 minutes per IP
- Password reset tokens expire after 24 hours
- User content is HTML-escaped to prevent XSS
- Database errors are logged but not exposed to users

## Monitoring

### Login Issues
If you see "Too many login attempts":
- Wait 15 minutes
- Rate limiting resets per IP address

### Password Strength
If password is rejected:
- Must be 8+ characters
- Must have uppercase letter (A-Z)
- Must have lowercase letter (a-z)  
- Must have number (0-9)

### Data Loss Prevention
- Daily backups recommended (via Proxmox if using LXC)
- Use `/export/equipment` for compliance documentation
- Audit logs never deleted (immutable trail)

## Support

For issues, check:
1. `/health` endpoint - verify API and database are working
2. Audit logs - see what was attempted
3. Docker logs - `docker logs <container-name>`
