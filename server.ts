import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import os from 'os';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3030;

// Enable CORS and JSON parsing
app.use(cors({ origin: '*' }));
app.use(express.json());

// Socket.IO setup with permissive CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Device interface
interface ConnectedDevice {
  id: string;
  role: 'tv' | 'remote';
  name: string;
  model: string;
  ip: string;
  connectedAt: number;
  lastAction?: string;
  lastActionAt?: number;
}

// In-memory store
const devices = new Map<string, ConnectedDevice>();

let currentTvState: any = {
  isConnected: false,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  title: 'بانتظار تشغيل محتوى من تطبيق شاشتي...',
  volume: 80,
  isMuted: false,
  currentMode: 'family',
  lastUpdated: Date.now(),
};

// Helper: Get local network IPs
function getLocalIps(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// Helper: Broadcast devices list to all clients
function broadcastDevices() {
  const deviceList = Array.from(devices.values());
  io.emit('devices', deviceList);
}

// ==========================================
// REST API Endpoints
// ==========================================

// 1. Health check
app.get('/api/health', (req, res) => {
  const tvConnected = Array.from(devices.values()).some((d) => d.role === 'tv');
  res.json({
    status: 'ok',
    service: 'Shashaty TV Remote Mini-Service',
    version: '1.0.0',
    port: PORT,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: Date.now(),
    devicesCount: devices.size,
    tvConnected,
    localIps: getLocalIps(),
  });
});

// 2. Connected devices list
app.get('/api/remote/devices', (req, res) => {
  res.json({
    success: true,
    count: devices.size,
    devices: Array.from(devices.values()),
  });
});

// 3. Disconnect a specific device
app.post('/api/remote/devices/:id/disconnect', (req, res) => {
  const { id } = req.params;
  const targetSocket = io.sockets.sockets.get(id);

  if (targetSocket) {
    targetSocket.emit('force_disconnect', { reason: 'Disconnected by admin' });
    targetSocket.disconnect(true);
    devices.delete(id);
    broadcastDevices();
    return res.json({ success: true, message: `Device ${id} disconnected successfully.` });
  }

  if (devices.has(id)) {
    devices.delete(id);
    broadcastDevices();
    return res.json({ success: true, message: `Device record ${id} removed.` });
  }

  return res.status(404).json({ success: false, error: 'Device not found or not connected.' });
});

// 4. Get last known TV state
app.get('/api/state', (req, res) => {
  res.json({
    success: true,
    state: currentTvState,
  });
});

// ==========================================
// Remote Placeholder Web Interface
// ==========================================
app.get(['/', '/remote'], (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>خادم ريموت شاشتي TV - لوحة التحكم والمراقبة</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="/socket.io/socket.io.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Cairo', sans-serif; background-color: #09090b; }
    .mono { font-family: 'JetBrains+Mono', monospace; }
  </style>
</head>
<body class="min-h-screen text-zinc-100 p-4 sm:p-8 flex flex-col items-center justify-start selection:bg-amber-400 selection:text-black">
  <div class="w-full max-w-3xl space-y-6">

    <!-- Header -->
    <header class="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-3xl bg-zinc-900/90 border border-amber-500/20 shadow-2xl backdrop-blur-xl">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 text-2xl font-black">
          📺
        </div>
        <div>
          <h1 class="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            خادم ريموت شاشتي TV
            <span class="text-xs bg-amber-400/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-400/30 font-bold">بورت ${PORT}</span>
          </h1>
          <p class="text-xs text-zinc-400 mt-0.5">المرحلة 1: الخادم الوسيط (Mini-Service) جاهز ويعمل بكفاءة</p>
        </div>
      </div>
      <div id="statusBadge" class="px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
        <span id="statusText">جاري الاتصال بالسيرفر...</span>
      </div>
    </header>

    <!-- TV State Card -->
    <div class="p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800 shadow-xl space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-bold text-zinc-300 flex items-center gap-2">
          <span>🎬 حالة مشغل التلفزيون اللحظية</span>
        </h2>
        <span id="tvOnlineBadge" class="text-xs px-2.5 py-1 rounded-xl bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">
          التطبيق: غير متصل
        </span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
          <span class="text-[11px] text-zinc-400 block mb-1">المحتوى الحالي:</span>
          <span id="tvTitle" class="text-xs font-bold text-zinc-200 truncate block">بانتظار البيانات...</span>
        </div>
        <div class="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
          <span class="text-[11px] text-zinc-400 block mb-1">حالة التشغيل:</span>
          <span id="tvPlayback" class="text-xs font-bold text-zinc-200 block">متوقف</span>
        </div>
        <div class="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
          <span class="text-[11px] text-zinc-400 block mb-1">مستوى الصوت:</span>
          <span id="tvVolume" class="text-xs font-bold text-zinc-200 block">80%</span>
        </div>
      </div>

      <!-- Live Frame Preview Canvas / Image -->
      <div class="mt-2 p-3 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-center min-h-[160px]">
        <span class="text-[11px] text-zinc-500 mb-2">معاينة إطار البث المباشر (screen_frame):</span>
        <img id="liveFrameImg" class="max-h-40 rounded-xl border border-zinc-800 shadow-md hidden" alt="Live TV Frame" />
        <div id="noFramePlaceholder" class="text-xs text-zinc-600 font-medium">لا يوجد بث فيديو مباشر نشط حالياً</div>
      </div>
    </div>

    <!-- Interactive Testing Remote Controls -->
    <div class="p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800 shadow-xl space-y-4">
      <h2 class="text-sm font-bold text-zinc-300 flex items-center gap-2">
        <span>🎮 اختبار إرسال الأوامر (Socket.IO Command Tester)</span>
      </h2>

      <!-- Quick Action Buttons -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button onclick="sendCmd('play_pause')" class="p-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-2xl shadow transition-all active:scale-95">
          ⏯️ تشغيل / إيقاف
        </button>
        <button onclick="sendCmd('toggle_mute')" class="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs rounded-2xl border border-zinc-700 transition-all active:scale-95">
          🔇 كتم / إلغاء الكتم
        </button>
        <button onclick="sendCmd('vol_up')" class="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs rounded-2xl border border-zinc-700 transition-all active:scale-95">
          🔊 رفع الصوت +
        </button>
        <button onclick="sendCmd('vol_down')" class="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs rounded-2xl border border-zinc-700 transition-all active:scale-95">
          🔉 خفض الصوت -
        </button>
      </div>

      <!-- D-Pad Controls -->
      <div class="flex flex-col items-center justify-center pt-2">
        <span class="text-[11px] text-zinc-400 mb-2">عجلة التوجيه (D-Pad):</span>
        <div class="flex flex-col items-center gap-2">
          <button onclick="sendCmd('dpad', 'up')" class="w-14 h-12 rounded-xl bg-zinc-800 hover:bg-amber-500 hover:text-black font-bold text-sm border border-zinc-700 transition-all flex items-center justify-center">▲</button>
          <div class="flex items-center gap-2">
            <button onclick="sendCmd('dpad', 'right')" class="w-14 h-12 rounded-xl bg-zinc-800 hover:bg-amber-500 hover:text-black font-bold text-sm border border-zinc-700 transition-all flex items-center justify-center">►</button>
            <button onclick="sendCmd('dpad', 'ok')" class="w-16 h-12 rounded-xl bg-amber-400 text-black font-black text-xs shadow-lg transition-all flex items-center justify-center">OK</button>
            <button onclick="sendCmd('dpad', 'left')" class="w-14 h-12 rounded-xl bg-zinc-800 hover:bg-amber-500 hover:text-black font-bold text-sm border border-zinc-700 transition-all flex items-center justify-center">◄</button>
          </div>
          <button onclick="sendCmd('dpad', 'down')" class="w-14 h-12 rounded-xl bg-zinc-800 hover:bg-amber-500 hover:text-black font-bold text-sm border border-zinc-700 transition-all flex items-center justify-center">▼</button>
        </div>
      </div>

      <!-- Command Log -->
      <div class="mt-4 p-3 rounded-2xl bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-400 h-24 overflow-y-auto" id="cmdLogs">
        <div>> تم تجهيز واجهة اختبار الأوامر...</div>
      </div>
    </div>

    <!-- Connected Devices List -->
    <div class="p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800 shadow-xl space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-bold text-zinc-300">📱 الأجهزة المتصلة حالياً (<span id="devCount">0</span>)</h2>
        <button onclick="fetchDevices()" class="text-xs text-amber-400 hover:underline">تحديث القائمة 🔄</button>
      </div>
      <div id="devicesContainer" class="space-y-2">
        <div class="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-center text-xs text-zinc-500">
          لا توجد أجهزة متصلة حالياً
        </div>
      </div>
    </div>

  </div>

  <script>
    const socket = io({ transports: ['websocket', 'polling'] });
    const logBox = document.getElementById('cmdLogs');

    function addLog(text) {
      const line = document.createElement('div');
      line.textContent = '[' + new Date().toLocaleTimeString('ar-EG') + '] ' + text;
      logBox.appendChild(line);
      logBox.scrollTop = logBox.scrollHeight;
    }

    socket.on('connect', () => {
      document.getElementById('statusBadge').className = 'px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-2';
      document.getElementById('statusText').textContent = 'متصل بالخادم ✅ (ID: ' + socket.id.substring(0, 6) + ')';
      addLog('تم الاتصال بالخادم بنجاح.');

      // Identify as web remote placeholder
      socket.emit('hello', {
        role: 'remote',
        name: 'Web Remote Tester',
        model: navigator.userAgent.includes('Mobile') ? 'Mobile Browser' : 'Desktop Browser'
      });
    });

    socket.on('disconnect', () => {
      document.getElementById('statusBadge').className = 'px-4 py-2 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 font-bold text-xs flex items-center gap-2';
      document.getElementById('statusText').textContent = 'غير متصل ❌';
      addLog('انقطع الاتصال بالخادم.');
    });

    socket.on('state_update', (state) => {
      addLog('استلام تحديث الحالة من الشاشة: ' + (state.title || ''));
      document.getElementById('tvOnlineBadge').className = 'text-xs px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold';
      document.getElementById('tvOnlineBadge').textContent = 'التطبيق: متصل 🟢';
      if (state.title) document.getElementById('tvTitle').textContent = state.title;
      document.getElementById('tvPlayback').textContent = state.isPlaying ? '▶️ قيد التشغيل' : '⏸️ متوقف مؤقتاً';
      document.getElementById('tvVolume').textContent = (state.isMuted ? '🔇 مكتوم' : '🔊 ' + (state.volume || 80) + '%');
    });

    socket.on('screen_frame', (data) => {
      if (data && data.frame) {
        const img = document.getElementById('liveFrameImg');
        const placeholder = document.getElementById('noFramePlaceholder');
        img.src = data.frame.startsWith('data:') ? data.frame : 'data:image/jpeg;base64,' + data.frame;
        img.classList.remove('hidden');
        placeholder.classList.add('hidden');
      }
    });

    socket.on('devices', (deviceList) => {
      renderDevices(deviceList);
    });

    function sendCmd(action, value) {
      addLog('إرسال أمر: ' + action + (value ? ' -> ' + value : ''));
      socket.emit('command', { action, value });
    }

    function renderDevices(list) {
      document.getElementById('devCount').textContent = list.length;
      const container = document.getElementById('devicesContainer');
      if (list.length === 0) {
        container.innerHTML = '<div class="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-center text-xs text-zinc-500">لا توجد أجهزة متصلة</div>';
        return;
      }
      container.innerHTML = list.map(d => \`
        <div class="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-lg">\${d.role === 'tv' ? '📺' : '📱'}</span>
            <div>
              <div class="text-xs font-bold text-zinc-200">\${d.name || d.id} <span class="text-[10px] text-zinc-500">(\${d.role})</span></div>
              <div class="text-[10px] text-zinc-500 font-mono">\${d.ip || 'Local'} • موديل: \${d.model || 'Unknown'}</div>
            </div>
          </div>
          <button onclick="disconnectDevice('\${d.id}')" class="px-2.5 py-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl hover:bg-rose-500/20 transition-all">
            قطع الاتصال
          </button>
        </div>
      \`).join('');
    }

    async function fetchDevices() {
      try {
        const res = await fetch('/api/remote/devices');
        const data = await res.json();
        if (data.devices) renderDevices(data.devices);
      } catch (e) {
        console.error('Failed to fetch devices:', e);
      }
    }

    async function disconnectDevice(id) {
      if (!confirm('هل أنت متأكد من قطع اتصال هذا الجهاز؟')) return;
      try {
        await fetch('/api/remote/devices/' + id + '/disconnect', { method: 'POST' });
        fetchDevices();
      } catch (e) {
        alert('فشل قطع الاتصال');
      }
    }
  </script>
</body>
</html>
  `;
  res.send(html);
});

// ==========================================
// Socket.IO Connection & Event Handlers
// ==========================================
io.on('connection', (socket: Socket) => {
  const clientIp = socket.handshake.address || socket.conn.remoteAddress || '127.0.0.1';
  console.log(`🔌 New client connected: ${socket.id} from ${clientIp}`);

  // 1. Client identification (hello event)
  socket.on('hello', (payload: { role: 'tv' | 'remote'; name?: string; model?: string }) => {
    const role = payload?.role === 'tv' ? 'tv' : 'remote';
    const device: ConnectedDevice = {
      id: socket.id,
      role,
      name: payload?.name || (role === 'tv' ? 'تطبيق شاشتي TV' : 'ريموت ذكي'),
      model: payload?.model || 'Generic Device',
      ip: clientIp,
      connectedAt: Date.now(),
      lastAction: 'hello',
      lastActionAt: Date.now(),
    };

    devices.set(socket.id, device);

    if (role === 'tv') {
      socket.join('tv_room');
      console.log(`📺 TV App registered: ${socket.id} (${device.name})`);
    } else {
      socket.join('remote_room');
      console.log(`📱 Remote Client registered: ${socket.id} (${device.name})`);
    }

    // Send current TV state to the new client
    socket.emit('state_update', currentTvState);

    // Broadcast updated devices list to everyone
    broadcastDevices();
  });

  // 2. Command received from remote
  socket.on('command', (payload: { action: string; value?: any }) => {
    const dev = devices.get(socket.id);
    if (dev) {
      dev.lastAction = payload?.action || 'unknown_cmd';
      dev.lastActionAt = Date.now();
    }

    console.log(`⚡ [Command] from ${socket.id} (${dev?.name || 'Unknown'}):`, payload);

    // Forward command to the TV room
    io.to('tv_room').emit('command', payload);

    // Update local state preview if mock state applies
    if (payload?.action === 'play_pause') {
      currentTvState.isPlaying = !currentTvState.isPlaying;
      currentTvState.lastUpdated = Date.now();
      io.emit('state_update', currentTvState);
    } else if (payload?.action === 'toggle_mute') {
      currentTvState.isMuted = !currentTvState.isMuted;
      currentTvState.lastUpdated = Date.now();
      io.emit('state_update', currentTvState);
    }
  });

  // 3. State update received from TV app
  socket.on('state_update', (newState: any) => {
    currentTvState = {
      ...currentTvState,
      ...newState,
      isConnected: true,
      lastUpdated: Date.now(),
    };

    const dev = devices.get(socket.id);
    if (dev) {
      dev.lastAction = 'state_update';
      dev.lastActionAt = Date.now();
    }

    // Broadcast state to all remotes
    io.to('remote_room').emit('state_update', currentTvState);
  });

  // 4. Live screen frame received from TV app
  socket.on('screen_frame', (framePayload: { frame: string; time?: number; duration?: number }) => {
    // Broadcast live frame to all remotes
    io.to('remote_room').emit('screen_frame', framePayload);
  });

  // 5. Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`❌ Client disconnected: ${socket.id} (${reason})`);
    devices.delete(socket.id);
    broadcastDevices();
  });
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n======================================================');
  console.log(`🚀 Shashaty TV Remote Mini-Service (Phase 1) is RUNNING`);
  console.log(`📡 Local URL:    http://localhost:${PORT}`);
  const ips = getLocalIps();
  ips.forEach((ip) => {
    console.log(`🌐 Network URL:  http://${ip}:${PORT}`);
  });
  console.log(`🔌 Socket.IO:    ws://0.0.0.0:${PORT}`);
  console.log('======================================================\n');
});
