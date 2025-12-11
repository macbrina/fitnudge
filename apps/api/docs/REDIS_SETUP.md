# Redis Setup Guide

This guide covers setting up Redis for both local development and production environments.

## Table of Contents

- [Local Development Setup](#local-development-setup)
- [Production Setup](#production-setup)
- [Configuration](#configuration)
- [Testing Connection](#testing-connection)
- [Troubleshooting](#troubleshooting)

---

## Local Development Setup

### Option 1: Using Docker (Recommended)

The easiest way to run Redis locally is using Docker:

```bash
# Run Redis without password (default for local development)
docker run -d \
  --name redis-local \
  -p 6379:6379 \
  redis:7-alpine

# Or with a password
docker run -d \
  --name redis-local \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --requirepass your_secure_password
```

### Option 2: Using Homebrew (macOS)

```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis

# Or run Redis manually
redis-server
```

### Option 3: Using apt (Ubuntu/Debian)

```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### Local Configuration

Add these environment variables to your `.env.local` or `.env` file:

```env
# Local Redis Configuration (no password by default)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_SSL=false
```

**Note:** The application will default to `localhost:6379` if no Redis configuration is provided, so these settings are optional for local development.

---

## Production Setup

### Self-Hosted Redis on Linux Server

#### Step 1: Install Redis

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install redis-server -y
```

**CentOS/RHEL:**

```bash
sudo yum install epel-release -y
sudo yum install redis -y
```

**Or compile from source:**

```bash
wget https://download.redis.io/redis-stable.tar.gz
tar xvzf redis-stable.tar.gz
cd redis-stable
make
sudo make install
```

#### Step 2: Configure Redis

Edit the Redis configuration file:

```bash
sudo nano /etc/redis/redis.conf
```

Important settings to configure:

```conf
# Bind to your server's IP or 0.0.0.0 for all interfaces
bind 0.0.0.0

# Set a strong password (required in production)
requirepass your_very_secure_password_here

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""

# Enable persistence (recommended)
save 900 1
save 300 10
save 60 10000

# Set max memory (adjust based on your needs)
maxmemory 256mb
maxmemory-policy allkeys-lru

# Enable logging
loglevel notice
logfile /var/log/redis/redis-server.log
```

#### Step 3: Secure Redis

1. **Firewall Configuration:**

   ```bash
   # Only allow connections from your application server
   sudo ufw allow from YOUR_APP_SERVER_IP to any port 6379
   ```

2. **Disable Protected Mode (only if binding to specific IPs):**
   ```conf
   protected-mode no
   ```

#### Step 4: Enable and Start Redis

```bash
# Create log directory
sudo mkdir -p /var/log/redis
sudo chown redis:redis /var/log/redis

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Check status
sudo systemctl status redis-server
```

#### Step 5: Test Redis Connection

```bash
# Test connection locally
redis-cli ping

# Test with password
redis-cli -a your_very_secure_password_here ping
```

### Production Configuration

Add these environment variables to your production `.env` file or environment:

```env
# Production Redis Configuration
REDIS_HOST=your-redis-server-ip-or-domain
REDIS_PORT=6379
REDIS_PASSWORD=your_very_secure_password_here
REDIS_DB=0
REDIS_SSL=false
```

For SSL/TLS connections:

```env
REDIS_SSL=true
```

---

## Configuration

### Environment Variables

| Variable         | Default     | Description                                      |
| ---------------- | ----------- | ------------------------------------------------ |
| `REDIS_HOST`     | `localhost` | Redis server hostname or IP address              |
| `REDIS_PORT`     | `6379`      | Redis server port                                |
| `REDIS_PASSWORD` | (empty)     | Redis password (required in production)          |
| `REDIS_DB`       | `0`         | Redis database number (0-15)                     |
| `REDIS_SSL`      | `false`     | Enable SSL/TLS connection                        |
| `REDIS_URL`      | (none)      | Legacy: Full Redis URL (takes precedence if set) |

### Legacy Support

If you have an existing `REDIS_URL` environment variable, it will be used instead of the individual components. This allows for backward compatibility.

Example:

```env
REDIS_URL=redis://:password@host:6379/0
```

---

## Testing Connection

### From Application

The application includes a health check endpoint that tests Redis connectivity:

```bash
# Check Redis health
curl http://localhost:8000/health/redis

# Or check all system health
curl http://localhost:8000/health
```

### Using Redis CLI

```bash
# Local connection (no password)
redis-cli

# With password
redis-cli -a your_password

# Remote connection
redis-cli -h your-redis-host -p 6379 -a your_password

# Test commands
> PING
PONG
> SET test "Hello Redis"
OK
> GET test
"Hello Redis"
> DEL test
(integer) 1
```

### Using Python

```python
import redis

# Connect to Redis
client = redis.Redis(
    host='localhost',
    port=6379,
    password='your_password',
    db=0,
    decode_responses=True
)

# Test connection
print(client.ping())  # Should print: True

# Set and get a value
client.set('test_key', 'test_value')
print(client.get('test_key'))  # Should print: test_value
```

---

## Monitoring

### Redis CLI Stats

```bash
redis-cli INFO
redis-cli INFO stats
redis-cli INFO memory
```

### Key Monitoring Commands

```bash
# Monitor all commands in real-time
redis-cli MONITOR

# Get database size
redis-cli DBSIZE

# Get memory usage
redis-cli INFO memory | grep used_memory_human

# List all keys (use with caution in production)
redis-cli KEYS "*"
```

### Recommended Monitoring Tools

1. **redis-stat** - Real-time Redis monitoring

   ```bash
   gem install redis-stat
   redis-stat
   ```

2. **RedisInsight** - Redis GUI (free from Redis)
   - Download: https://redis.com/redis-enterprise/redis-insight/

3. **Prometheus + redis_exporter** - For production monitoring
   ```bash
   # Install redis_exporter
   go install github.com/oliver006/redis_exporter@latest
   ```

---

## Backup and Persistence

### Enable Persistence

Redis supports two persistence options:

1. **RDB (Redis Database Backup)** - Point-in-time snapshots
2. **AOF (Append Only File)** - Log of all write operations

Configure in `/etc/redis/redis.conf`:

```conf
# RDB persistence
save 900 1      # Save after 900 sec if at least 1 key changed
save 300 10     # Save after 300 sec if at least 10 keys changed
save 60 10000   # Save after 60 sec if at least 10000 keys changed

# AOF persistence (more durable)
appendonly yes
appendfsync everysec
```

### Manual Backup

```bash
# Create a backup
redis-cli SAVE

# Backup file location
cp /var/lib/redis/dump.rdb /backup/redis-$(date +%Y%m%d).rdb
```

---

## Troubleshooting

### Connection Issues

**Problem:** Cannot connect to Redis

**Solutions:**

1. Check if Redis is running:

   ```bash
   sudo systemctl status redis-server
   ```

2. Check Redis logs:

   ```bash
   tail -f /var/log/redis/redis-server.log
   ```

3. Verify firewall rules:

   ```bash
   sudo ufw status
   ```

4. Test connection manually:
   ```bash
   redis-cli -h localhost -p 6379 ping
   ```

### Authentication Issues

**Problem:** `NOAUTH Authentication required`

**Solution:** Ensure `REDIS_PASSWORD` matches the password in Redis config:

```bash
# Check Redis password requirement
redis-cli CONFIG GET requirepass
```

### Memory Issues

**Problem:** Redis running out of memory

**Solutions:**

1. Check memory usage:

   ```bash
   redis-cli INFO memory
   ```

2. Set max memory policy:

   ```conf
   maxmemory 1gb
   maxmemory-policy allkeys-lru
   ```

3. Clear old keys if needed:
   ```bash
   # Flush all keys (use with caution!)
   redis-cli FLUSHALL
   ```

### Performance Issues

**Problem:** Slow Redis operations

**Solutions:**

1. Check for slow commands:

   ```bash
   redis-cli SLOWLOG GET 10
   ```

2. Monitor command statistics:

   ```bash
   redis-cli INFO commandstats
   ```

3. Consider increasing memory or optimizing data structures

---

## Security Best Practices

1. **Always use a strong password in production**
2. **Restrict network access** - Only allow connections from your application servers
3. **Disable dangerous commands** - FLUSHDB, FLUSHALL, CONFIG
4. **Use SSL/TLS** for remote connections when possible
5. **Regular updates** - Keep Redis updated to latest stable version
6. **Monitor access logs** - Watch for suspicious activity
7. **Limit memory** - Set maxmemory to prevent DoS attacks

---

## Additional Resources

- [Redis Official Documentation](https://redis.io/documentation)
- [Redis Configuration Guide](https://redis.io/topics/config)
- [Redis Security Guide](https://redis.io/topics/security)
- [Redis Performance Optimization](https://redis.io/topics/benchmarks)
