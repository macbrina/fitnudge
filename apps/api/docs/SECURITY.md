# 🔐 FitNudge API Security Documentation

## Overview

This document outlines the comprehensive security measures implemented in the FitNudge API to protect against common vulnerabilities and ensure data integrity.

## 🛡️ Security Features Implemented

### 1. Authentication & Authorization

#### JWT Token-Based Authentication

- **Access Tokens**: Short-lived (15 minutes) for API access
- **Refresh Tokens**: Long-lived (7 days) with rotation support
- **Token Families**: Prevents token replay attacks
- **Automatic Rotation**: Refresh tokens rotate on each use

#### API Key Authentication

- **Mobile App Support**: Dedicated API keys for mobile applications
- **Permission-Based**: Granular permissions (read, write, admin)
- **Key Rotation**: Support for key rotation and revocation
- **Usage Tracking**: Monitor API key usage and last access

#### Password Security

- **Bcrypt Hashing**: Industry-standard password hashing
- **Strength Validation**: Enforces strong password requirements
- **Common Password Detection**: Blocks commonly used passwords
- **Consecutive Character Limits**: Prevents patterns like "1111"

### 2. Rate Limiting & DDoS Protection

#### Endpoint-Specific Limits

```python
RATE_LIMITS = {
    "auth": {
        "login": {"calls": 5, "period": 300},      # 5 attempts per 5 minutes
        "signup": {"calls": 3, "period": 300},     # 3 attempts per 5 minutes
        "forgot_password": {"calls": 3, "period": 3600},  # 3 attempts per hour
    },
    "api": {
        "default": {"calls": 100, "period": 60},   # 100 requests per minute
        "media_upload": {"calls": 10, "period": 60},  # 10 uploads per minute
    }
}
```

#### IP-Based Rate Limiting

- **Per-IP Limits**: Prevents single IP abuse
- **Redis-Based**: Scalable rate limiting with Redis
- **Graceful Degradation**: Returns 429 status on limit exceeded

### 3. Account Security

#### Account Lockout

- **Failed Attempt Tracking**: Monitors failed login attempts
- **Progressive Lockout**: 5 failed attempts = 30-minute lockout
- **IP-Based Tracking**: Tracks attempts per IP address
- **Automatic Reset**: Lockouts reset after 24 hours

#### Session Management

- **Concurrent Session Limits**: Max 3 sessions per user
- **Session Timeout**: 24-hour session expiration
- **Device Tracking**: Track active sessions per device
- **Logout All Devices**: Option to revoke all sessions

### 4. Input Validation & Sanitization

#### SQL Injection Protection

- **Pattern Detection**: Blocks common SQL injection patterns
- **Input Sanitization**: Removes dangerous characters
- **Parameterized Queries**: Uses Supabase's safe query methods
- **Recursive Validation**: Checks nested objects and arrays

#### XSS Prevention

- **Input Sanitization**: Removes script tags and dangerous characters
- **Content Security Policy**: Strict CSP headers
- **Output Encoding**: Proper encoding of user data

### 5. File Upload Security

#### File Type Validation

- **MIME Type Detection**: Uses python-magic for accurate detection
- **Extension Validation**: Validates file extensions
- **Content Analysis**: Checks file content for malicious patterns
- **Size Limits**: 10MB maximum file size

#### Malware Scanning

- **ClamAV Integration**: Optional malware scanning
- **File Signature Analysis**: Detects malicious file signatures
- **Image Validation**: Validates image files with PIL
- **Video Validation**: Uses ffprobe for video validation

#### Security Checks

```python
# Malicious signature detection
malicious_signatures = [
    b'<script', b'javascript:', b'vbscript:', b'data:text/html',
    b'<?php', b'<%', b'<%=', b'<script language=',
    b'<iframe', b'<object', b'<embed', b'<link',
    b'exec(', b'eval(', b'Function(', b'setTimeout('
]
```

### 6. Network Security

#### Security Headers

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'...
```

#### IP Whitelisting

- **Configurable Whitelist**: Restrict access to specific IPs
- **Geo-Blocking**: Block access from specific countries
- **Suspicious IP Detection**: Detect and block suspicious patterns

### 7. Audit Logging

#### Security Events Tracking

- **Authentication Events**: Login, logout, failed attempts
- **Sensitive Operations**: Password changes, account deletions
- **File Operations**: Uploads, downloads, deletions
- **API Usage**: Track API key usage and endpoints

#### Log Retention

- **90-Day Retention**: Security events kept for 90 days
- **Structured Logging**: JSON format for easy analysis
- **Privacy Protection**: Email addresses hashed in logs

### 8. Database Security

#### Row Level Security (RLS)

```sql
-- Users can only access their own data
CREATE POLICY "Users can only see their own goals" ON goals
    FOR ALL USING (auth.uid() = user_id);
```

#### Data Encryption

- **At Rest**: Supabase handles database encryption
- **In Transit**: HTTPS/TLS for all communications
- **Sensitive Fields**: Passwords and tokens are hashed

### 9. API Security

#### Request Validation

- **Pydantic Models**: Automatic request validation
- **Type Checking**: Strict type validation
- **Required Fields**: Enforce required parameters
- **Range Validation**: Validate numeric ranges

#### Response Security

- **Data Sanitization**: Remove sensitive data from responses
- **Error Handling**: Generic error messages to prevent information leakage
- **CORS Configuration**: Restrict cross-origin requests

## 🔧 Configuration

### Environment Variables

```bash
# Security Configuration
SECRET_KEY=your-super-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# Rate Limiting
REDIS_URL=redis://localhost:6379

# File Upload Security
MAX_FILE_SIZE_MB=10
ENABLE_MALWARE_SCANNING=true

# IP Security
ENABLE_IP_WHITELIST=false
ALLOWED_IPS=192.168.1.0/24,10.0.0.0/8

# Audit Logging
ENABLE_AUDIT_LOGGING=true
AUDIT_RETENTION_DAYS=90
```

### Security Middleware Order

The order of security middleware is crucial:

1. **SecurityHeadersMiddleware** - Add security headers
2. **SQLInjectionProtectionMiddleware** - Block SQL injection
3. **IPWhitelistMiddleware** - IP-based access control
4. **AccountLockoutMiddleware** - Account lockout protection
5. **RateLimitMiddleware** - Rate limiting
6. **AuditLoggingMiddleware** - Security event logging
7. **SessionManagementMiddleware** - Session management

## 🚨 Security Monitoring

### Real-time Monitoring

- **Failed Login Attempts**: Track and alert on suspicious activity
- **Rate Limit Violations**: Monitor for DDoS attempts
- **Unusual API Usage**: Detect abnormal patterns
- **File Upload Anomalies**: Monitor for malicious uploads

### Alerting

- **Account Lockouts**: Alert on repeated lockouts
- **High Error Rates**: Monitor API error rates
- **Suspicious IPs**: Alert on blocked IPs
- **Malware Detection**: Immediate alerts on malware

## 🔍 Security Testing

### Automated Security Tests

```bash
# Run security tests
poetry run pytest tests/security/

# Test rate limiting
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}' \
  --repeat 10

# Test SQL injection protection
curl -X GET "http://localhost:8000/api/v1/goals?search='; DROP TABLE users; --"
```

### Manual Security Testing

1. **Authentication Bypass**: Test for authentication vulnerabilities
2. **Authorization Issues**: Verify proper access controls
3. **Input Validation**: Test with malicious inputs
4. **File Upload**: Test with malicious files
5. **Rate Limiting**: Verify rate limits work correctly

## 📊 Security Metrics

### Key Performance Indicators

- **Failed Login Rate**: Should be < 5%
- **Account Lockout Rate**: Should be < 1%
- **Rate Limit Hit Rate**: Should be < 0.1%
- **Malware Detection Rate**: Monitor for trends
- **API Error Rate**: Should be < 1%

### Security Dashboards

- **Real-time Security Events**: Live monitoring
- **Historical Trends**: Long-term security analysis
- **Geographic Distribution**: Track user locations
- **Device Analytics**: Monitor device types and patterns

## 🛠️ Security Maintenance

### Regular Tasks

- **Dependency Updates**: Keep all packages updated
- **Security Patches**: Apply security patches promptly
- **Log Analysis**: Regular review of security logs
- **Access Review**: Periodic review of user access

### Security Audits

- **Quarterly Reviews**: Comprehensive security assessment
- **Penetration Testing**: Annual third-party testing
- **Code Reviews**: Regular security-focused code reviews
- **Compliance Checks**: Ensure regulatory compliance

## 🚀 Deployment Security

### Production Considerations

- **HTTPS Only**: Enforce HTTPS in production
- **Secure Headers**: All security headers enabled
- **Rate Limiting**: Stricter limits in production
- **Monitoring**: Enhanced monitoring and alerting
- **Backup Security**: Encrypted backups

### Environment Separation

- **Development**: Relaxed security for development
- **Staging**: Production-like security settings
- **Production**: Maximum security settings

## 📞 Incident Response

### Security Incident Process

1. **Detection**: Automated monitoring alerts
2. **Assessment**: Evaluate severity and impact
3. **Containment**: Isolate affected systems
4. **Eradication**: Remove threats and vulnerabilities
5. **Recovery**: Restore normal operations
6. **Lessons Learned**: Document and improve

### Emergency Contacts

- **Security Team**: security@fitnudge.app
- **Development Team**: dev@fitnudge.app
- **Infrastructure Team**: infra@fitnudge.app

---

## 🔒 Security Checklist

- [ ] All endpoints require authentication
- [ ] Rate limiting is properly configured
- [ ] Input validation is comprehensive
- [ ] File uploads are secure
- [ ] Security headers are present
- [ ] Audit logging is enabled
- [ ] Database RLS is configured
- [ ] API keys are properly managed
- [ ] Session management is secure
- [ ] Error handling doesn't leak information

---

_This security documentation is regularly updated. Last updated: $(date)_
