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
const clientDistDir = join(__dirname, '../client/dist');

const app    = express();
const server = http.createServer(app);
const io     = new SocketIOServer(server, { cors: { origin: '*' }, pingTimeout: 60000, pingInterval: 25000 });
const PORT   = process.env.PORT || 3001;

// ─── Constants ────────────────────────────────────────────────────────────────
const ADMIN_CODE         = process.env.ADMIN_CODE || 'ADMIN2025';
const TOKENS_PER_ROUND   = 30;
const ROUND_DURATION_MIN = 40;
const LINES_TO_WIN       = 5;
const TOTAL_ROUNDS       = 2;
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

const q = (id, round, category, prompt, options, answer) => ({
  id,
  round,
  boss:false,
  category,
  prompt,
  options,
  answer,
});

const ROUND_1_QUESTIONS = [
  q('r1q1', 1, 'Case Study', 'A startup spends $2,000 on raw materials, $1,500 on labor, $1,000 on equipment rental, and $500 on marketing. They produce 100 units and sell at $60/unit. What is their profit margin percentage?', ['10%','16.7%','20%','25%'], 1),
  q('r1q2', 1, 'Case Study', 'Company X ships via 3 routes: Route A (40% of 10,000 units, 2% loss), Route B (35%, 5% loss), Route C (25%, 3% loss). How many units are lost in total?', ['300','330','355','400'], 2),
  q('r1q3', 1, 'Case Study', 'A hospital processes 500 patient records daily with a 2% error rate. Quality control catches 95% of errors before they reach patients. How many errors reach patients weekly?', ['3–4','10','20','35'], 0),
  q('r1q4', 1, 'Case Study', 'A marketing campaign targets 50,000 people. Engagement rate is 8%, conversion from engaged is 12%, average order is $150, and 70% of converters actually purchase. What is total revenue?', ['$50,400','$75,000','$100,800','$120,000'], 0),
  q('r1q5', 1, 'Case Study', 'A plant with 200 employees has 85% annual retention. 10% of departing employees are replaced with inexperienced hires who are 40% less productive. What is the total productivity loss percentage?', ['0.6%','0.9%','1.2%','2%'], 1),
  q('r1q6', 1, 'Case Study', 'A bank portfolio is 70% performing with 5% default, 20% subprime with 15% default, and 10% high-risk with 25% default. What is the overall default rate?', ['8%','9%','9.5%','10%'], 1),
  q('r1q7', 1, 'Case Study', 'A customer service team has Morning staff at 40% with 95% satisfaction, Afternoon at 35% with 88%, and Night at 25% with 82%. What is the weighted average satisfaction score?', ['87%','88%','89%','90%'], 2),
  q('r1q8', 1, 'Case Study', 'A campaign grows reach by 20% per week. If Week 1 is 10,000, Week 2 is 12,000, and Week 3 is 14,400, what will reach be in Week 5?', ['18,000','19,500','20,736','22,000'], 2),
  q('r1q9', 1, 'Case Study', 'A pharma company tests 1,000 patients: 60% improve, 25% no change, and 15% have adverse effects at $500 liability each. What is the total liability?', ['$50,000','$60,000','$75,000','$90,000'], 2),
  q('r1q10', 1, 'Case Study', 'An e-commerce platform charges a 2.5% transaction fee plus a 1.5% payment processing fee on all orders. Monthly sales are $100,000. What are total fees collected?', ['$3,000','$3,500','$4,000','$4,500'], 2),
  q('r1q11', 1, 'Case Study', 'A warehouse uses FIFO (30%, 3% obsolescence), LIFO (45%, 5%), and Weighted Average (25%, 2%). What is the average obsolescence rate?', ['3%','3.5%','3.7%','4%'], 2),
  q('r1q12', 1, 'Case Study', 'A consulting firm has Senior consultants at 40% of 2,000 hours billed at $250/hr, Mid-level at 50% billed at $150/hr, and Juniors at 60% billed at $80/hr. What is total monthly revenue?', ['$250,000','$300,000','$400,000','$446,000'], 3),
  q('r1q13', 1, 'Case Study', 'A restaurant has daily costs of 35% food, 25% labor, 15% utilities, 10% rent, and 10% other, with daily revenue of $5,000. What is the profit margin?', ['3%','5%','7%','10%'], 1),
  q('r1q14', 1, 'Case Study', 'A logistics company reports on-time delivery at 92%, damaged goods at 3%, wrong delivery at 1%, and returns at 4%. What percentage of orders are problem-free?', ['90%','92%','94%','96%'], 1),
  q('r1q15', 1, 'Case Study', 'An insurer processes 500 claims weekly: 40% approved in week 1, 35% in week 2, 15% pending, and 10% denied. How many claims are unresolved after 2 weeks?', ['75','100','125','150'], 2),
  q('r1q16', 1, 'Case Study', 'A training program has Beginner learners at 50% enrollment with 90% completion, Intermediate at 30% with 75%, and Advanced at 20% with 60%. What is the overall completion rate?', ['75%','78%','80%','82%'], 2),
  q('r1q17', 1, 'Case Study', 'A retailer inventory mix is Category A at 40% with $50 average value, Category B at 35% with $100, and Category C at 25% with $200. What is the average inventory value per unit?', ['$100','$105','$110','$116'], 1),
  q('r1q18', 1, 'Case Study', 'A mobile app has 65% Android users out of 100,000 with 4% engagement, and 35% iOS users with 6% engagement. How many total engaged users are there?', ['4,500','4,700','4,900','5,000'], 1),
  q('r1q19', 1, 'Case Study', 'A production facility has Morning shift 1,000 units at 1.5% defects, Afternoon 1,000 at 2.5%, and Night 1,000 at 3.5%. How many total defects occur daily?', ['60','70','75','80'], 2),
  q('r1q20', 1, 'Case Study', 'A student loan portfolio has $200M federal loans at 2% default, $150M private at 5%, and $100M international at 8%. What is the total expected default amount?', ['$18M','$18.5M','$19M','$19.5M'], 3),
  q('r1q21', 1, 'Case Study', 'An HR department reviews 5,000 employees: Engineering is 40% with 12% promotion, Sales is 35% with 18%, and Operations is 25% with 10%. How many employees get promoted?', ['650','680','700','720'], 1),
  q('r1q22', 1, 'Case Study', 'A healthcare provider handles 2,000 visits per month, with 78% verified on the first attempt, 15% on the second, and 7% requiring manual review at $50 per review. What is total manual review cost?', ['$700','$2,000','$5,000','$7,000'], 3),
  q('r1q23', 1, 'Case Study', 'A gaming platform with 100,000 users has Casual players at 70% spending $2/month, Regular at 20% spending $8/month, and Hardcore at 10% spending $25/month. What is total monthly revenue?', ['$500,000','$550,000','$600,000','$650,000'], 1),
  q('r1q24', 1, 'Case Study', 'A distribution center ships 10,000 units: Carrier A handles 50% at $5/unit, Carrier B 30% at $7/unit, and Carrier C 20% at $9/unit. What is the average shipping cost per unit?', ['$6.40','$6.80','$7.00','$7.20'], 0),
  q('r1q25', 1, 'Case Study', 'A subscription service has 20,000 users: Free tier is 60% with 5% upgrade, Basic is 25% with 30% upgrade, and Premium is 15% with 50% upgrade. How many users upgrade to paid tiers?', ['2,100','2,800','3,200','3,600'], 3),
];

const ROUND_2_QUESTIONS = [
  q('r2q1', 2, 'Zero Trust', 'In a Zero Trust Architecture, which component is responsible for evaluating policy and granting or denying access to resources?', ['Identity Provider (IdP)','Policy Enforcement Point (PEP)','Policy Decision Point (PDP)','Security Information and Event Management (SIEM)'], 2),
  q('r2q2', 2, 'Identity', 'Which attack technique specifically targets the SAML assertion flow to impersonate any user, including admins, without knowing their password?', ['Pass-the-Hash','Golden Ticket Attack','XML Signature Wrapping (XSW)','CSRF token forgery'], 2),
  q('r2q3', 2, 'Secrets', 'A DevOps team rotates secrets every 24 hours using Vault dynamic secrets. An attacker compromises a service account token with a 6-hour TTL. What is the maximum blast radius window?', ['24 hours','6 hours','30 minutes (Vault default lease)','Until manual revocation'], 1),
  q('r2q4', 2, 'Identity', 'Which OIDC claim is used to prevent replay attacks in the authorization code flow?', ['sub','iat','nonce','jti'], 2),
  q('r2q5', 2, 'Kubernetes', 'In a Kubernetes environment, which admission controller should be enabled to enforce that pods cannot run as root and must drop all Linux capabilities?', ['PodSecurityPolicy (deprecated)','OPA Gatekeeper with a ConstraintTemplate','NetworkPolicy controller','ResourceQuota admission controller'], 1),
  q('r2q6', 2, 'CI/CD', 'A malicious pull request modifies a GitHub Actions workflow file to exfiltrate GITHUB_TOKEN. Which control most directly prevents this?', ['Require signed commits on main','Use pull_request_target trigger with explicit checkout of base ref','Set GITHUB_TOKEN permissions to read-only in workflow','Enable branch protection rules'], 2),
  q('r2q7', 2, 'CI/CD', 'What does SLSA Level 3 specifically guarantee about a build that Level 2 does not?', ['The build runs on ephemeral, isolated infrastructure','Source is version controlled','Provenance is signed by the build service','Two-party review of all changes'], 0),
  q('r2q8', 2, 'CI/CD', 'In a blue/green deployment, traffic cutover fails and you need to roll back. Which metric should trigger an automatic rollback in a well-configured deployment pipeline?', ['CPU utilisation exceeds 80%','Error rate on the new green environment exceeds the SLO threshold within the canary window','Memory usage doubles compared to blue','Response time increases by 10ms'], 1),
  q('r2q9', 2, 'Supply Chain', 'Which technique does a threat actor use when they compromise a legitimate package in a public registry rather than creating a typosquatted fake?', ['Dependency confusion','Supply chain poisoning','Typosquatting','DLL sideloading'], 1),
  q('r2q10', 2, 'Containers', 'A Dockerfile uses RUN apt-get install curl without pinning a version. Beyond reproducibility issues, what specific security risk does this introduce in a CI pipeline?', ['Cache poisoning via layer reuse','Dependency confusion between internal mirrors','Version rollback attacks if the registry is compromised','Increased image size causing OOM in build runners'], 0),
  q('r2q11', 2, 'ICS/OT', 'The Purdue Enterprise Reference Architecture separates ICS into levels. At which level do Distributed Control Systems and SCADA servers typically reside?', ['Level 0 — Field devices','Level 1 — Basic control','Level 2 — Supervisory control','Level 3 — Manufacturing operations'], 2),
  q('r2q12', 2, 'ICS/OT', 'Modbus TCP has no authentication or encryption by default. Which mitigation is most operationally feasible in a legacy brownfield ICS environment without replacing PLCs?', ['Deploy TLS 1.3 on all Modbus endpoints','Implement a unidirectional security gateway (data diode) for historian traffic','Replace Modbus with DNP3 Secure Authentication v5','Enable IPsec tunnel between all Level 1 and Level 2 devices'], 1),
  q('r2q13', 2, 'ICS/OT', 'In a CPS attack, an adversary manipulates sensor readings fed to a PID controller to cause an unsafe physical state while the controller believes it is operating normally. This is called:', ['Replay attack on the control loop','False Data Injection (FDI) attack','Man-in-the-Middle on the historian','Denial-of-Service on the HMI'], 1),
  q('r2q14', 2, 'ICS/OT', 'Which protocol, commonly used in smart grid Advanced Metering Infrastructure, uses symmetric AES encryption but is vulnerable to key management attacks if the utility head-end system is compromised?', ['DNP3','IEC 61850 GOOSE','ANSI C12.22','Zigbee (IEEE 802.15.4)'], 2),
  q('r2q15', 2, 'ICS/OT', 'A safety instrumented system in a chemical plant is supposed to be physically isolated from the DCS. The Triton/TRISIS malware compromised Schneider Triconex SIS controllers. What was its primary capability that made it uniquely dangerous?', ['It could overwrite PLC ladder logic to cause incorrect valve positions','It could disable or manipulate safety functions, allowing physical damage without triggering automatic shutdowns','It encrypted historian data and demanded ransom before allowing operator visibility','It caused the SIS to generate false alarms, fatiguing operators into disabling alerts'], 1),
  q('r2q16', 2, 'Cloud', 'An attacker gains code execution inside a Kubernetes pod. Which sequence of steps represents a successful container escape to node compromise?', ['Read /etc/passwd → pivot to etcd → dump cluster secrets','Exploit misconfigured hostPath volume → write cron job on the node → escalate to root','Exfiltrate KUBECONFIG from the pod → kubectl exec into another pod → lateral movement','SSRF to metadata service → steal node IAM role → create privileged pod'], 1),
  q('r2q17', 2, 'Cloud', 'AWS IAM has a permissions boundary set on a role. The role identity policy allows s3:* on all resources, while the permissions boundary allows only s3:GetObject. What actions can the role actually perform?', ['All s3:* actions — identity policy takes precedence','Only s3:GetObject — permissions boundary is the effective ceiling','No actions — conflicting policies result in implicit deny','s3:GetObject and s3:ListBucket — AWS always grants List alongside Get'], 1),
  q('r2q18', 2, 'Cloud', 'Terraform plan shows a resource will be replaced destroy-then-create. In a production pipeline, what risk does this pose and how should it be mitigated?', ['No risk — Terraform handles ordering; use create_before_destroy = true','Data loss risk on stateful resources — use prevent_destroy = true and manual migration for stateful resources','State lock contention — run terraform force-unlock before applying','Plan drift — always use terraform refresh to sync state before plan'], 1),
  q('r2q19', 2, 'Cloud', 'In a service mesh using mutual TLS, what additional security property does mTLS provide over standard TLS that is critical for zero trust service-to-service communication?', ['Encrypted payloads between services','Certificate pinning preventing MITM at the ingress gateway','Cryptographic proof of service identity in both directions','Automatic secret rotation using SPIFFE/SPIRE'], 2),
  q('r2q20', 2, 'Cloud', 'A Lambda function uses an execution role with s3:GetObject on a specific bucket. An attacker exploits SSRF in the function to reach the AWS metadata endpoint. What is the attacker’s most impactful next step?', ['Exfiltrate the Lambda deployment package from S3','Retrieve temporary credentials from the metadata service and assume the execution role outside Lambda','Modify the Lambda environment variables to inject a backdoor','Invoke other Lambda functions using the stolen token'], 1),
  q('r2q21', 2, 'Incident Response', 'During a live forensic investigation of a Linux system, which of the following should be collected last to preserve volatile data ordering?', ['Running processes (ps aux)','Network connections (ss -antp)','Disk image of the root filesystem','ARP cache and routing table'], 2),
  q('r2q22', 2, 'Incident Response', 'An ICS historian server shows legitimate Modbus traffic at 2:47 AM when no engineers are on shift. Which log source would most definitively confirm whether this was operator-initiated or adversarial?', ['Firewall session logs for the historian IP','Windows Security Event Log on the historian for authentication at that time','Modbus function code logs from the network TAP','SCADA HMI audit trail for operator actions at 2:47 AM'], 3),
  q('r2q23', 2, 'Incident Response', 'A ransomware group uses living-off-the-land techniques. Which Windows built-in tool is most commonly abused for lateral movement to execute commands on remote hosts without dropping a binary?', ['powershell.exe with -EncodedCommand','wmic.exe /node: process call create','psexec.exe from Sysinternals','mshta.exe with a remote HTA payload'], 1),
  q('r2q24', 2, 'Incident Response', 'In a cloud-native incident, an attacker creates a new IAM user with admin rights during a 4-minute window before GuardDuty alerts. Which AWS service log would show the CreateUser API call with the source IP and user-agent?', ['VPC Flow Logs','AWS CloudTrail','AWS Config','CloudWatch Metrics'], 1),
  q('r2q25', 2, 'Incident Response', 'A CPS red team exercise discovers that a PLC engineering workstation communicates using an unencrypted vendor-specific protocol on TCP/44818. What is this protocol and what specific risk does its default configuration pose?', ['EtherNet/IP — allows unauthenticated read/write of PLC output coils via CIP commands','OPC-UA — allows unauthenticated subscription to all process variables','Profinet — allows firmware replacement without authentication on Siemens S7 PLCs','BACnet/IP — allows arbitrary HVAC setpoint changes without authentication'], 0),
];

const ALL_QUESTIONS = [...ROUND_1_QUESTIONS, ...ROUND_2_QUESTIONS];
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
  try{
    const loaded={...createInitialState(),...JSON.parse(readFileSync(stateFile,'utf8'))};
    // Keep token baseline consistent across server restarts in local/dev usage.
    if(Array.isArray(loaded.teams)){
      loaded.teams=loaded.teams.map(t=>({...t,tokens:TOKENS_PER_ROUND}));
    }
    return loaded;
  }
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
  announce('start','🎰 Grid Gambit Begins!',`${state.teams.length} teams · ${TOTAL_ROUNDS} rounds · May the best team take the grid.`);
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
    if(team){team.tokens=Math.min(team.tokens+2,TOKENS_PER_ROUND);announce('hack_solve',`⚡ ${team.name} cracked it!`,`+2 tokens! (${state.globalHack.solvers.length}/3)`);}
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

if(existsSync(clientDistDir)){
  app.use(express.static(clientDistDir));
  app.get('*',(_,res)=>res.sendFile(join(clientDistDir,'index.html')));
}

saveState();
if(state.phase==='round_active')startTimer();
server.listen(PORT,()=>{console.log(`\n🎰 Grid Gambit  →  http://localhost:${PORT}\n   Admin: ${ADMIN_CODE} | Phase: ${state.phase} | Round: ${state.currentRound}\n`);});
