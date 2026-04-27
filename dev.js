import { spawn } from 'node:child_process';
import process from 'node:process';

function start(label, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: false,
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`);
  });

  return child;
}

const server = start('server', 'npm', ['run', 'dev'], new URL('./server', import.meta.url).pathname);
const client = start('client', 'npm', ['run', 'dev'], new URL('./client', import.meta.url).pathname);

const children = [server, client];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  process.exit(code);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(0));
}

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const exitCode = typeof code === 'number' ? code : 1;
    console.error(`[${child === server ? 'server' : 'client'}] exited${signal ? ` via ${signal}` : ''} with code ${exitCode}`);
    shutdown(exitCode);
  });
}