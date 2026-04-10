const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const REQUEST_FILE = path.join(os.tmpdir(), 'telyai-cli-request.json');
const RESPONSE_FILE = path.join(os.tmpdir(), 'telyai-cli-response.json');

// ---------------------------------------------------------------------------
// App detection & launch
// ---------------------------------------------------------------------------

async function findTelyAIApp() {
  const platform = process.platform;

  const candidates = {
    darwin: [
      '/Applications/TelyAI.app',
      path.join(os.homedir(), 'Applications/TelyAI.app'),
    ],
    win32: [
      path.join(os.homedir(), 'AppData/Local/TelyAI/TelyAI.exe'),
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'TelyAI/TelyAI.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'TelyAI/TelyAI.exe'),
    ],
    linux: [
      '/usr/local/bin/telyai',
      '/usr/bin/telyai',
      path.join(os.homedir(), '.local/bin/telyai'),
      '/opt/TelyAI/telyai',
    ],
  };

  for (const p of candidates[platform] || []) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function isTelyAIRunning() {
  try {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      const { stdout } = await execAsync('pgrep -f "TelyAI"');
      return stdout.trim().length > 0;
    } else if (process.platform === 'win32') {
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq TelyAI.exe" /FO CSV');
      return stdout.includes('TelyAI.exe');
    }
  } catch {
    return false;
  }
  return false;
}

async function startTelyAI() {
  const appPath = await findTelyAIApp();
  if (!appPath) {
    throw new Error('TelyAI application not found. Please install TelyAI first.');
  }

  console.log('Starting TelyAI application...');

  if (process.platform === 'darwin') {
    if (appPath.endsWith('.app')) {
      await execAsync(`open "${appPath}"`);
    } else {
      spawn(appPath, [], { detached: true, stdio: 'ignore' }).unref();
    }
  } else {
    spawn(appPath, [], { detached: true, stdio: 'ignore' }).unref();
  }

  console.log('Waiting for application to start...');
  for (let i = 0; i < 30; i++) {
    if (await isTelyAIRunning()) {
      console.log('TelyAI is now running');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Failed to start TelyAI application');
}

async function ensureTelyAIRunning() {
  if (!(await isTelyAIRunning())) {
    console.log('TelyAI is not running. Attempting to start it...');
    await startTelyAI();
  }
}

// ---------------------------------------------------------------------------
// IPC helpers
// ---------------------------------------------------------------------------

async function sendRequest(request, timeoutSeconds = 30) {
  if (fs.existsSync(RESPONSE_FILE)) fs.unlinkSync(RESPONSE_FILE);
  fs.writeFileSync(REQUEST_FILE, JSON.stringify(request, null, 2));

  const deadline = Date.now() + timeoutSeconds * 1000;

  return new Promise((resolve, reject) => {
    const poll = () => {
      if (fs.existsSync(RESPONSE_FILE)) {
        try {
          const response = JSON.parse(fs.readFileSync(RESPONSE_FILE, 'utf8'));
          fs.unlinkSync(RESPONSE_FILE);
          resolve(response);
        } catch (err) {
          reject(new Error('Failed to parse response: ' + err.message));
        }
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error(
          `Timeout: No response after ${timeoutSeconds}s. Make sure TelyAI is running and the chat is loaded.`
        ));
        return;
      }
      setTimeout(poll, 500);
    };
    poll();
  });
}

// ---------------------------------------------------------------------------
// chat-list
// ---------------------------------------------------------------------------

async function runChatList() {
  await ensureTelyAIRunning();
  console.log('Fetching chat list...');

  const response = await sendRequest({ action: 'chat-list', timestamp: Date.now() });

  if (response.success) {
    try {
      const list = JSON.parse(response.result || '[]');
      console.log(`Found ${list.length} chats:\n`);
      list.forEach(({ chatId, title }) => {
        console.log(`  ${chatId}\t${title}`);
      });
    } catch {
      console.log(response.result);
    }
  } else {
    throw new Error(response.error || 'Unknown error');
  }
}

// ---------------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------------

async function runSummary(chatId, timeoutSeconds = 30) {
  await ensureTelyAIRunning();
  console.log(`Requesting summary for chat: ${chatId}`);

  const response = await sendRequest(
    { action: 'summary', chatId, timestamp: Date.now() },
    timeoutSeconds,
  );

  if (response.success) {
    console.log('Summary:');
    console.log(response.summary || '(no content)');
  } else {
    throw new Error(response.error || 'Unknown error');
  }

  return response.summary;
}

// ---------------------------------------------------------------------------
// urgent-check
// ---------------------------------------------------------------------------

async function runUrgentCheck(chatId, rule) {
  await ensureTelyAIRunning();

  const response = await sendRequest({
    action: 'urgent-check',
    chatId,
    rule,
    timestamp: Date.now(),
  });

  if (response.success) {
    console.log(response.result || 'No result.');
  } else {
    throw new Error(response.error || 'Unknown error');
  }

  return response;
}

// ---------------------------------------------------------------------------
// get-contacts
// ---------------------------------------------------------------------------

async function runGetContacts() {
  await ensureTelyAIRunning();
  console.log('Fetching contacts...');

  const response = await sendRequest({ action: 'get-contacts', timestamp: Date.now() });

  if (response.success) {
    try {
      const contacts = JSON.parse(response.result || '[]');
      console.log(JSON.stringify(contacts, null, 2));
    } catch {
      console.log(response.result);
    }
  } else {
    throw new Error(response.error || 'Unknown error');
  }
}

// ---------------------------------------------------------------------------
// send-message
// ---------------------------------------------------------------------------

async function runSendMessage(chatId, text, threadId) {
  await ensureTelyAIRunning();
  console.log(`Sending message to chat ${chatId}...`);

  const request = { action: 'send-message', chatId, text, timestamp: Date.now() };
  if (threadId !== undefined) request.threadId = threadId;

  const response = await sendRequest(request);

  if (response.success) {
    console.log(response.result || 'Message sent successfully');
  } else {
    throw new Error(response.error || 'Unknown error');
  }
}

// ---------------------------------------------------------------------------
// get-group-members
// ---------------------------------------------------------------------------

async function runGetGroupMembers(chatId) {
  await ensureTelyAIRunning();
  console.log(`Fetching members for chat ${chatId}...`);

  const response = await sendRequest({ action: 'get-group-members', chatId, timestamp: Date.now() });

  if (response.success) {
    try {
      const members = JSON.parse(response.result || '[]');
      console.log(JSON.stringify(members, null, 2));
    } catch {
      console.log(response.result);
    }
  } else {
    throw new Error(response.error || 'Unknown error');
  }
}

// ---------------------------------------------------------------------------
// global-summary
// ---------------------------------------------------------------------------

async function runGlobalSummary(opts, timeoutSeconds = 120) {
  await ensureTelyAIRunning();
  console.log('Fetching global chat summary...');

  const request = { action: 'global-summary', timestamp: Date.now() };
  if (opts.startTime !== undefined) request.startTime = opts.startTime;
  if (opts.endTime !== undefined) request.endTime = opts.endTime;
  if (opts.maxChats !== undefined) request.maxChats = opts.maxChats;
  if (opts.maxMessagesPerChat !== undefined) request.maxMessagesPerChat = opts.maxMessagesPerChat;
  if (opts.ignoredChatIds !== undefined) request.ignoredChatIds = opts.ignoredChatIds;

  const response = await sendRequest(request, timeoutSeconds);

  if (response.success) {
    if (response.summaryInfo) {
      const info = response.summaryInfo;
      console.log(`Summarized ${info.summaryMessageCount} messages from ${info.summaryChatIds.length} chats`);
    }
    try {
      const data = typeof response.result === 'string' ? JSON.parse(response.result) : response.result;
      console.log(JSON.stringify(data, null, 2));
    } catch {
      console.log(response.result);
    }
  } else {
    throw new Error(response.error || 'Unknown error');
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function parseArgs(args) {
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--yesterday') {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      opts.startTime = yesterday.getTime();
      opts.endTime = opts.startTime + 24 * 60 * 60 * 1000;
      continue;
    }
    const next = args[i + 1];
    switch (a) {
      case '--chatid': case '-c': opts.chatId = next; i++; break;
      case '--rule': case '-r': opts.rule = next; i++; break;
      case '--text': opts.text = next; i++; break;
      case '--threadid': opts.threadId = parseInt(next, 10); i++; break;
      case '--timeout': case '-t': opts.timeout = parseInt(next, 10); i++; break;
      case '--start': opts.startTime = parseInt(next, 10); i++; break;
      case '--end': opts.endTime = parseInt(next, 10); i++; break;
      case '--max-chats': opts.maxChats = parseInt(next, 10); i++; break;
      case '--max-messages': opts.maxMessagesPerChat = parseInt(next, 10); i++; break;
      case '--ignore': opts.ignoredChatIds = next.split(',').map(id => id.trim()); i++; break;
      case '--hours': {
        const hours = parseFloat(next);
        opts.endTime = Date.now();
        opts.startTime = opts.endTime - hours * 60 * 60 * 1000;
        i++;
        break;
      }
    }
  }
  return opts;
}

async function main(args) {
  const [subcommand, ...rest] = args;

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    console.log('Usage: /telyai <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  chat-list          List all chats in TelyAI');
    console.log('  summary            Generate an AI summary of a chat');
    console.log('  urgent-check       Check chat messages against a keyword rule');
    console.log('  get-contacts       Get your Telegram contacts list');
    console.log('  send-message       Send a message to a chat');
    console.log('  get-group-members  Get members of a group or channel');
    console.log('  global-summary     Summarize messages across all chats');
    console.log('');
    console.log('Examples:');
    console.log('  /telyai chat-list');
    console.log('  /telyai summary --chatid -1001234567890');
    console.log('  /telyai urgent-check --chatid -1001234567890 --rule "price drop"');
    console.log('  /telyai get-contacts');
    console.log('  /telyai send-message --chatid 5974693797 --text "Hello!"');
    console.log('  /telyai get-group-members --chatid -1001234567890');
    console.log('  /telyai global-summary --hours 24');
    console.log('  /telyai global-summary --yesterday');
    return;
  }

  const opts = parseArgs(rest);

  if (subcommand === 'chat-list') {
    return runChatList();
  }

  if (subcommand === 'summary') {
    if (!opts.chatId) throw new Error('--chatid is required');
    return runSummary(opts.chatId, opts.timeout || 30);
  }

  if (subcommand === 'urgent-check') {
    if (!opts.chatId) throw new Error('--chatid is required');
    if (opts.rule === undefined) throw new Error('--rule is required');
    return runUrgentCheck(opts.chatId, opts.rule);
  }

  if (subcommand === 'get-contacts') {
    return runGetContacts();
  }

  if (subcommand === 'send-message') {
    if (!opts.chatId) throw new Error('--chatid is required');
    if (!opts.text) throw new Error('--text is required');
    return runSendMessage(opts.chatId, opts.text, opts.threadId);
  }

  if (subcommand === 'get-group-members') {
    if (!opts.chatId) throw new Error('--chatid is required');
    return runGetGroupMembers(opts.chatId);
  }

  if (subcommand === 'global-summary') {
    return runGlobalSummary(opts, opts.timeout || 120);
  }

  throw new Error(`Unknown command: ${subcommand}. Use --help to see available commands.`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

module.exports = { main, runChatList, runSummary, runUrgentCheck, runGetContacts, runSendMessage, runGetGroupMembers, runGlobalSummary, isTelyAIRunning, startTelyAI };
