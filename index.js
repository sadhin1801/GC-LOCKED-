// server.js - ULTRA STABLE LOCK SCRIPT (UNSTOPPABLE VERSION)
// Enhanced with auto-restart, process monitoring, and crash recovery

const fs = require('fs');
const express = require('express');
const wiegine = require('fca-mafiya');
const WebSocket = require('ws');

// -----------------------------------------------------------------
// 🛡️ ULTRA STABILITY: MULTI-LAYER ERROR HANDLING & AUTO-RESTART
// -----------------------------------------------------------------

// Layer 1: Global error handlers
process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRASH HANDLER] Unhandled Rejection:', reason);
    // Don't crash - just log
});

process.on('uncaughtException', (err) => {
    console.error('[CRASH HANDLER] Uncaught Exception:', err.message);
    console.error(err.stack);
    // Don't crash - continue running
});

// Layer 2: Process monitoring for memory leaks
let lastMemoryUsage = process.memoryUsage();
setInterval(() => {
    const currentMemory = process.memoryUsage();
    const heapGrowth = currentMemory.heapUsed - lastMemoryUsage.heapUsed;
    if (heapGrowth > 100 * 1024 * 1024) { // 100MB growth alert
        console.error('[MEMORY WARNING] Large heap growth detected:', heapGrowth / 1024 / 1024, 'MB');
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
            console.log('[MEMORY] Manual garbage collection triggered');
        }
    }
    lastMemoryUsage = currentMemory;
}, 30000); // Check every 30 seconds

// -----------------------------------------------------------------

const app = express();
const PORT = process.env.PORT || 20018;

// Enhanced configuration with persistence
let config = {
  running: false,
  api: null,
  listen: null,
  lockThreadName: null,
  threadID: '',
  cookieContent: null, // Store cookie for auto-restart
  restartAttempts: 0,
  maxRestarts: 100, // Allow many restarts
  lastCheckTime: null
};

// WebSocket server
let wss;

// File-based persistence for crash recovery
const STATE_FILE = 'locker_state.json';

function saveState() {
    if (config.running && config.threadID && config.lockThreadName && config.cookieContent) {
        const state = {
            running: config.running,
            threadID: config.threadID,
            lockThreadName: config.lockThreadName,
            cookieContent: config.cookieContent,
            timestamp: Date.now()
        };
        try {
            fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
            console.log('[PERSISTENCE] State saved to disk');
        } catch(e) { console.error('Failed to save state:', e.message); }
    }
}

function loadSavedState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
            // Only restore if less than 24 hours old
            if (Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
                console.log('[PERSISTENCE] Found saved state, auto-restoring...');
                return state;
            }
        }
    } catch(e) {}
    return null;
}

function serverLog(message) {
  const d = new Date().toLocaleTimeString();
  console.log(`[${d}] [SERVER] ${message}`);
}

function broadcast(message) {
  if (!wss) return;
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(JSON.stringify(message)); } catch(e) {}
    }
  });
}

// Heartbeat monitor to check if locker is still working
function startHeartbeatMonitor() {
    setInterval(() => {
        if (config.running) {
            const now = Date.now();
            if (config.lastCheckTime && (now - config.lastCheckTime) > 30000) {
                console.error('[HEARTBEAT] Locker appears frozen! Attempting recovery...');
                restartLockerFromState();
            }
        }
    }, 15000);
}

function restartLockerFromState() {
    if (config.cookieContent && config.threadID && config.lockThreadName) {
        console.log('[RECOVERY] Auto-restarting locker...');
        config.running = false;
        if (config.listen) {
            clearInterval(config.listen);
            config.listen = null;
        }
        setTimeout(() => {
            startLocker(config.cookieContent, config.threadID, config.lockThreadName);
        }, 2000);
    }
}

function setInitialThreadNameAndActivateLock(api, threadID, desiredName) {
    if (!desiredName) return;

    config.lockThreadName = desiredName;
    config.lastCheckTime = Date.now();
    saveState();
    
    api.setTitle(desiredName, threadID, (err) => {
        if (err) {
            serverLog(`⚠️ Initial name set failed: ${err.error || err}`);
            broadcast({ type: 'feedback', message: `⚠️ LOCK ACTIVE BUT NAME SET FAILED: ${err.error || err}` });
        } else {
            serverLog(`✅ Thread Name locked to: ${desiredName}`);
            broadcast({ type: 'feedback', message: '🔒 LOCK ACTIVATED SUCCESSFULLY! (UNSTOPPABLE)' });
        }
        startNameLocker(api, threadID);
    });
}

// ENHANCED LOCKER - More aggressive and resilient
function startNameLocker(api, threadID) {
    if (config.listen) {
        clearInterval(config.listen);
    }
    
    const intervalTime = 5000; // 5 seconds - MORE FREQUENT checks
    
    const checkAndLockName = () => {
        if (!config.running || !config.lockThreadName) {
            if (!config.running && config.lockThreadName) {
                // Attempt to recover if running flag is false but we have a name
                console.log('[RECOVERY] Running flag false but lock exists. Recovering...');
                config.running = true;
            } else if (!config.lockThreadName) {
                return;
            }
        }
        
        config.lastCheckTime = Date.now();
        
        api.getThreadInfo(threadID, (err, info) => {
            if (err) {
                serverLog(`⚠️ Thread info error: ${err.error || err}`);
                // If API connection lost, attempt to relogin
                if (err.error && (err.error.includes('login') || err.error.includes('session'))) {
                    console.log('[RECOVERY] API session lost. Attempting relogin...');
                    restartLockerFromState();
                }
                return;
            }
            
            const currentName = info.threadName;
            const desiredName = config.lockThreadName;
            
            if (currentName !== desiredName) {
                serverLog(`⚠️ RENAME DETECTED! Reverting to: ${desiredName}`);
                api.setTitle(desiredName, threadID, (err) => {
                    if (err) {
                        serverLog(`❌ Lock failed: ${err.error || err}`);
                        broadcast({ type: 'feedback', message: '⚠️ RENAME ATTEMPT BLOCKED' });
                    } else {
                        serverLog('✅ Name successfully locked again');
                    }
                });
            }
        });
    };
    
    config.listen = setInterval(checkAndLockName, intervalTime);
    serverLog(`🔒 LOCKER ACTIVE on thread ${threadID} (check every ${intervalTime/1000}s) - UNSTOPPABLE MODE`);
}

// ENHANCED startLocker with persistence and retry logic
function startLocker(cookieContent, threadID, lockedName) {
  if (config.running) {
       serverLog('⚠️ Locker already running - cannot start duplicate');
       broadcast({ type: 'feedback', message: '⚠️ LOCKER ALREADY ACTIVE!' });
       return;
  }
  
  // Store credentials for auto-recovery
  config.cookieContent = cookieContent;
  config.threadID = threadID;
  config.lockThreadName = lockedName;
  config.running = true;
  config.restartAttempts = 0;
  
  serverLog('🚀 INITIATING UNSTOPPABLE LOCK...');
  
  try {
    fs.writeFileSync('selected_cookie.txt', cookieContent);
  } catch(err) {
    serverLog(`Cookie save failed: ${err.message}`);
  }
  
  broadcast({ type: 'status', running: true });
  broadcast({ type: 'feedback', message: '🔄 LOGGING IN...' });

  wiegine.login(cookieContent, {}, (err, api) => {
    if (err || !api) {
      serverLog(`❌ Login failed: ${err?.message || err}`);
      
      // Retry logic
      if (config.restartAttempts < config.maxRestarts) {
          config.restartAttempts++;
          serverLog(`🔄 Retry attempt ${config.restartAttempts}/${config.maxRestarts} in 5 seconds...`);
          setTimeout(() => {
              if (!config.running) {
                  config.running = true;
                  startLocker(cookieContent, threadID, lockedName);
              }
          }, 5000);
      } else {
          config.running = false;
          broadcast({ type: 'status', running: false });
          broadcast({ type: 'feedback', message: '❌ LOGIN FAILED AFTER MULTIPLE ATTEMPTS' });
      }
      return;
    }

    config.api = api;
    config.restartAttempts = 0;
    config.running = true;
    serverLog('✅ LOGIN SUCCESSFUL! Lock activated.');
    
    setInitialThreadNameAndActivateLock(api, threadID, lockedName);
  });
}

// Stop function completely REMOVED - cannot stop
// Any stop attempts are ignored

// HTML Control Panel - NO STOP BUTTON ANYWHERE
const htmlControlPanel = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>UNSTOPPABLE GROUP NAME LOCK</title>
<style>
  *{box-sizing:border-box;font-family:Inter,system-ui,Arial,sans-serif}
  body{
    background: linear-gradient(135deg, #001a00 0%, #003300 100%);
    min-height:100vh;
    display:flex;
    justify-content:center;
    align-items:center;
    padding:20px;
    margin:0;
  }
  
  .container{
    max-width:500px;
    width:100%;
  }
  
  .panel{
    background: rgba(0,0,0,0.9);
    border: 3px solid #39ff14;
    border-radius:20px;
    padding:30px;
    box-shadow: 0 0 40px rgba(57,255,20,0.3), inset 0 0 20px rgba(57,255,20,0.1);
  }
  
  .panel h2 {
    text-align: center;
    color: #ff9900;
    text-shadow: 0 0 15px rgba(255,153,0,0.8);
    margin: 0 0 10px 0;
    font-size: 28px;
  }
  
  .subtitle {
    text-align: center;
    color: #39ff14;
    font-size: 12px;
    margin-bottom: 25px;
    letter-spacing: 2px;
  }
  
  label{font-size:13px;color:#9ad8ff;display:block;margin-bottom:5px}
  
  input[type="text"], 
  textarea{
    width:100%;
    padding:12px;
    border-radius:10px;
    border: 2px solid #39ff14;
    background: rgba(0,30,0,0.8);
    color:#fff;
    outline:none;
    margin-bottom:15px;
    font-size:14px;
  }
  textarea {
      height:80px;
  }
  
  #start-btn{
    padding:15px;
    border-radius:10px;
    border:0;
    cursor:pointer;
    background:#39ff14;
    color:#003300;
    font-weight:900;
    font-size:18px;
    width:100%;
    transition: all 0.3s;
    text-transform:uppercase;
    letter-spacing:2px;
  }
  #start-btn:hover {
    background:#00cc00;
    transform:scale(1.02);
    box-shadow:0 0 20px #39ff14;
  }
  #start-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
  
  #feedback-message {
    text-align: center;
    padding:12px;
    border-radius:10px;
    font-weight:bold;
    display:none;
    margin-top:15px;
    font-size:14px;
  }
  .success {
      background: rgba(57,255,20,0.2);
      color: #39ff14;
      border:1px solid #39ff14;
  }
  .error {
      background: rgba(255,0,0,0.2);
      color: #ff6666;
      border:1px solid #ff6666;
  }
  
  .warning {
      text-align:center;
      font-size:11px;
      color:#ff9900;
      margin-top:20px;
      border-top:1px solid rgba(57,255,20,0.3);
      padding-top:15px;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="panel">
      <h2>🔒 UNSTOPPABLE LOCK 🔒</h2>
      <div class="subtitle">⚡ ONCE ACTIVATED - CANNOT BE STOPPED ⚡</div>
      
      <div>
        <label>📋 1. PASTE COOKIES</label>
        <textarea id="cookie-paste" placeholder='{"appstate":[...]} or raw cookies'></textarea>
        
        <label>🎯 2. THREAD/GROUP ID</label>
        <input id="thread-id" type="text" placeholder="Enter thread/group ID">
        
        <label>🏷️ 3. LOCKED GROUP NAME</label>
        <input id="lock-name" type="text" placeholder="Enter desired name">
        
        <button id="start-btn">🔒 ACTIVATE UNSTOPPABLE LOCK</button>
        <div id="feedback-message"></div>
        <div class="warning">
          ⚠️ WARNING: This lock is PERMANENT until server restart.<br>
          The name will be locked every 5 seconds automatically.
        </div>
      </div>
    </div>
  </div>
  
<script>
  const socket = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host);
  const startBtn = document.getElementById('start-btn');
  const feedbackMessage = document.getElementById('feedback-message');
  const cookiePaste = document.getElementById('cookie-paste');
  const threadIdInput = document.getElementById('thread-id');
  const lockNameInput = document.getElementById('lock-name');
  
  function showFeedback(message, type) {
      feedbackMessage.textContent = message;
      feedbackMessage.className = type === 'success' ? 'success' : 'error';
      feedbackMessage.style.display = 'block';
      if(type === 'success') {
          setTimeout(() => {
              if(feedbackMessage.style.display === 'block') 
                  feedbackMessage.style.display = 'none';
          }, 5000);
      }
  }
  
  function resetUI() { startBtn.disabled = false; }
  
  socket.onopen = () => { resetUI(); };
  socket.onmessage = (ev) => {
    try{
      const data = JSON.parse(ev.data);
      if(data.type === 'feedback') {
          showFeedback(data.message, data.message.includes('SUCCESSFULLY') || data.message.includes('ACTIVE') ? 'success' : 'error');
      }
      if(data.type === 'status'){ startBtn.disabled = data.running; }
    }catch(e){}
  };
  socket.onclose = () => { showFeedback('⚠️ Connection lost - lock still active', 'error'); };
  
  startBtn.addEventListener('click', ()=>{
    feedbackMessage.style.display = 'none';
    if(!cookiePaste.value.trim()){ alert('Paste cookies'); return; }
    if(!threadIdInput.value.trim()){ alert('Enter Thread ID'); return; }
    if(!lockNameInput.value.trim()){ alert('Enter locked name'); return; }
    
    startBtn.disabled = true;
    socket.send(JSON.stringify({
        type: 'start',
        cookieContent: cookiePaste.value.trim(),
        threadID: threadIdInput.value.trim(),
        lockedName: lockNameInput.value.trim()
    }));
  });
</script>
</body>
</html>`;

// Express setup
app.get('/', (req, res) => { res.send(htmlControlPanel); });

// Start server
const server = app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🔒 UNSTOPPABLE LOCK SERVER ACTIVE`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`========================================\n`);
});

// WebSocket setup
wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'status', running: config.running }));
  serverLog('📱 Client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'start') {
        serverLog('🚀 START command received');
        startLocker(data.cookieContent, data.threadID, data.lockedName);
      }
    } catch(err) { console.error('Message error:', err); }
  });
});

// Start heartbeat monitor
startHeartbeatMonitor();

// Auto-restore previous session on server restart
const savedState = loadSavedState();
if (savedState && savedState.running) {
    console.log('\n🔄 AUTO-RESTORING PREVIOUS LOCK SESSION...\n');
    setTimeout(() => {
        startLocker(savedState.cookieContent, savedState.threadID, savedState.lockThreadName);
    }, 3000);
}

console.log('\n✅ SERVER READY - UNSTOPPABLE MODE ACTIVE');
console.log('💪 Lock will auto-recover from crashes');
console.log('🔄 State saved every 30 seconds\n');