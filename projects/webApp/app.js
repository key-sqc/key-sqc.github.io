// 全局变量
let peerConnection = null;
let dataChannel = null;
let isInitiator = false;
let currentRoomCode = null;
let connectionStartTime = null;
let currentOffer = null;
let qrStream = null;
let currentFacingMode = 'environment';

// DOM元素
const instructionsPanel = document.getElementById('instructionsPanel');
const connectionPanel = document.getElementById('connectionPanel');
const chatContainer = document.getElementById('chatContainer');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const webrtcStatus = document.getElementById('webrtcStatus');
const roomCode = document.getElementById('roomCode');
const createBtn = document.getElementById('createBtn');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const qrPanel = document.getElementById('qrPanel');
const joinPanel = document.getElementById('joinPanel');
const manualInputPanel = document.getElementById('manualInputPanel');
const scanPanel = document.getElementById('scanPanel');
const qrCanvas = document.getElementById('qrCanvas');
const manualCodeDisplay = document.getElementById('manualCodeDisplay');
const connectionInput = document.getElementById('connectionInput');
const scannerVideo = document.getElementById('scannerVideo');
const scannerCanvas = document.getElementById('scannerCanvas');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const logContent = document.getElementById('logContent');
const clearLogBtn = document.getElementById('clearLogBtn');
const startBtn = document.getElementById('startBtn');

// 按钮元素
const copyCodeBtn = document.getElementById('copyCodeBtn');
const refreshQRBtn = document.getElementById('refreshQRBtn');
const closeQRBtn = document.getElementById('closeQRBtn');
const scanQRBtn = document.getElementById('scanQRBtn');
const manualInputBtn = document.getElementById('manualInputBtn');
const cancelJoinBtn = document.getElementById('cancelJoinBtn');
const confirmManualBtn = document.getElementById('confirmManualBtn');
const backToJoinBtn = document.getElementById('backToJoinBtn');
const cancelScanBtn = document.getElementById('cancelScanBtn');
const switchCameraBtn = document.getElementById('switchCameraBtn');

// 初始化
function init() {
    addLog('应用初始化完成', 'success');
    updateStatus('等待连接...', 'disconnected');
    updateDetailedStatus('未连接', '-');
    setupEventListeners();
}

// 设置事件监听器
function setupEventListeners() {
    startBtn.addEventListener('click', startApp);
    createBtn.addEventListener('click', createRoom);
    connectBtn.addEventListener('click', showJoinOptions);
    disconnectBtn.addEventListener('click', disconnect);
    
    // 二维码相关
    copyCodeBtn.addEventListener('click', copyConnectionCode);
    refreshQRBtn.addEventListener('click', refreshQRCode);
    closeQRBtn.addEventListener('click', closeQRPanel);
    
    // 加入相关
    scanQRBtn.addEventListener('click', startQRScan);
    manualInputBtn.addEventListener('click', showManualInput);
    cancelJoinBtn.addEventListener('click', cancelJoin);
    confirmManualBtn.addEventListener('click', confirmManualJoin);
    backToJoinBtn.addEventListener('click', backToJoinOptions);
    cancelScanBtn.addEventListener('click', cancelQRScan);
    switchCameraBtn.addEventListener('click', switchCamera);
    
    // 聊天相关
    sendBtn.addEventListener('click', sendMessage);
    clearLogBtn.addEventListener('click', clearLog);
    
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });
    
    // 页面卸载时清理
    window.addEventListener('beforeunload', cleanup);
}

// 开始使用
function startApp() {
    instructionsPanel.style.display = 'none';
    connectionPanel.style.display = 'block';
    addLog('进入连接界面', 'info');
}

// 生成4位随机房间号
function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// 日志系统
function addLog(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry`;
    
    const time = new Date().toLocaleTimeString();
    const messageElement = document.createElement('span');
    messageElement.className = `log-${type}`;
    messageElement.textContent = message;
    
    logEntry.innerHTML = `<span class="log-time">[${time}]</span> `;
    logEntry.appendChild(messageElement);
    
    logContent.appendChild(logEntry);
    logContent.scrollTop = logContent.scrollHeight;
}

// 清空日志
function clearLog() {
    logContent.innerHTML = '';
    addLog('日志已清空', 'info');
}

// 更新连接状态
function updateStatus(text, state) {
    statusText.textContent = text;
    
    statusIndicator.className = 'status-indicator';
    
    switch(state) {
        case 'connected':
            statusIndicator.classList.add('connected');
            break;
        case 'connecting':
            statusIndicator.classList.add('connecting');
            break;
        case 'error':
            statusIndicator.classList.add('error');
            break;
        default:
            break;
    }
    
    const isConnected = state === 'connected';
    messageInput.disabled = !isConnected;
    sendBtn.disabled = !isConnected;
    
    disconnectBtn.style.display = (state === 'connected' || state === 'connecting') ? 'block' : 'none';
    chatContainer.style.display = isConnected ? 'block' : 'none';
}

// 更新详细状态
function updateDetailedStatus(connectionState, room) {
    if (connectionState) {
        webrtcStatus.textContent = connectionState;
        webrtcStatus.className = getStatusClass(connectionState);
    }
    
    if (room) {
        roomCode.textContent = room;
    }
}

function getStatusClass(state) {
    if (state.includes('连接') || state.includes('成功') || state.includes('完成')) {
        return 'ready';
    } else if (state.includes('等待') || state.includes('进行中') || state.includes('连接中')) {
        return 'connecting';
    } else if (state.includes('失败') || state.includes('错误') || state.includes('断开')) {
        return 'error';
    }
    return '';
}

// 创建房间
function createRoom() {
    connectionStartTime = Date.now();
    isInitiator = true;
    
    // 生成房间号
    currentRoomCode = generateRoomCode();
    
    addLog(`创建房间: ${currentRoomCode}`, 'info');
    updateStatus('正在创建房间...', 'connecting');
    updateDetailedStatus('创建中', currentRoomCode);
    
    createBtn.disabled = true;
    connectBtn.disabled = true;
    
    try {
        const configuration = getEnhancedConfiguration();
        
        addLog('初始化WebRTC连接', 'info');
        peerConnection = new RTCPeerConnection(configuration);
        
        setupConnectionListeners();
        
        addLog('创建数据通道', 'info');
        dataChannel = peerConnection.createDataChannel('chat');
        setupDataChannel();
        
        addLog('创建连接Offer', 'info');
        peerConnection.createOffer()
            .then(offer => {
                addLog('设置本地描述', 'info');
                return peerConnection.setLocalDescription(offer);
            })
            .then(() => {
                currentOffer = peerConnection.localDescription;
                addLog('房间创建完成，生成二维码', 'success');
                showQRCodePanel();
                updateStatus('等待对方扫描二维码...', 'connecting');
                updateDetailedStatus('等待连接', currentRoomCode);
                
                setTimeout(() => {
                    if (peerConnection && peerConnection.connectionState !== 'connected') {
                        addLog('等待连接中...', 'info');
                    }
                }, 30000);
            })
            .catch(error => {
                addLog(`创建房间失败: ${error.message}`, 'error');
                updateStatus('创建失败', 'error');
                resetConnection();
            });
            
    } catch (error) {
        addLog(`创建房间时发生错误: ${error.message}`, 'error');
        updateStatus('创建失败', 'error');
        resetConnection();
    }
}

// 显示二维码面板
function showQRCodePanel() {
    const connectionData = {
        type: 'offer',
        offer: currentOffer,
        roomCode: currentRoomCode,
        timestamp: Date.now()
    };
    
    const connectionString = JSON.stringify(connectionData);
    manualCodeDisplay.textContent = btoa(connectionString);
    
    // 生成二维码
    SimpleQRCode.generate(connectionString, qrCanvas);
    
    qrPanel.style.display = 'block';
    joinPanel.style.display = 'none';
    manualInputPanel.style.display = 'none';
    scanPanel.style.display = 'none';
}

// 刷新二维码
function refreshQRCode() {
    addLog('刷新二维码', 'info');
    showQRCodePanel();
}

// 关闭二维码面板
function closeQRPanel() {
    qrPanel.style.display = 'none';
    addLog('关闭二维码面板', 'info');
}

// 显示加入选项
function showJoinOptions() {
    joinPanel.style.display = 'block';
    qrPanel.style.display = 'none';
    manualInputPanel.style.display = 'none';
    scanPanel.style.display = 'none';
}

// 显示手动输入
function showManualInput() {
    manualInputPanel.style.display = 'block';
    joinPanel.style.display = 'none';
    connectionInput.value = '';
}

// 开始二维码扫描
async function startQRScan() {
    addLog('启动二维码扫描', 'info');
    scanPanel.style.display = 'block';
    joinPanel.style.display = 'none';
    
    try {
        qrStream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: currentFacingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        
        scannerVideo.srcObject = qrStream;
        scannerVideo.play();
        
        // 开始扫描循环
        startScanLoop();
        
    } catch (error) {
        addLog(`摄像头访问失败: ${error.message}`, 'error');
        alert('无法访问摄像头，请检查权限设置');
        cancelQRScan();
    }
}

// 扫描循环
function startScanLoop() {
    const canvas = scannerCanvas;
    const ctx = canvas.getContext('2d');
    
    function scan() {
        if (scannerVideo.videoWidth > 0 && scannerVideo.videoHeight > 0) {
            canvas.width = scannerVideo.videoWidth;
            canvas.height = scannerVideo.videoHeight;
            
            ctx.drawImage(scannerVideo, 0, 0, canvas.width, canvas.height);
            
            // 简单的二维码识别（在实际应用中应该使用专业的QR码识别库）
            try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const qrText = attemptQRDecode(imageData);
                
                if (qrText) {
                    handleScannedQRCode(qrText);
                    return;
                }
            } catch (error) {
                // 忽略识别错误
            }
        }
        
        if (scanPanel.style.display !== 'none') {
            requestAnimationFrame(scan);
        }
    }
    
    scan();
}

// 简单的QR码解码尝试
function attemptQRDecode(imageData) {
    // 这是一个简化的示例
    // 在实际应用中，您应该使用专业的QR码识别库如jsQR
    return null;
}

// 处理扫描到的二维码
function handleScannedQRCode(qrText) {
    try {
        const connectionData = JSON.parse(qrText);
        processConnectionData(connectionData);
    } catch (error) {
        addLog('无效的二维码格式', 'error');
    }
}

// 取消扫描
function cancelQRScan() {
    if (qrStream) {
        qrStream.getTracks().forEach(track => track.stop());
        qrStream = null;
    }
    scannerVideo.srcObject = null;
    scanPanel.style.display = 'none';
    addLog('取消二维码扫描', 'info');
}

// 切换摄像头
function switchCamera() {
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    cancelQRScan();
    startQRScan();
}

// 确认手动加入
function confirmManualJoin() {
    const code = connectionInput.value.trim();
    if (!code) {
        addLog('请输入连接代码', 'error');
        alert('请输入连接代码');
        return;
    }
    
    try {
        const decoded = atob(code);
        const connectionData = JSON.parse(decoded);
        processConnectionData(connectionData);
    } catch (error) {
        addLog('无效的连接代码: ' + error.message, 'error');
        alert('连接代码格式错误，请检查后重试');
    }
}

// 处理连接数据
function processConnectionData(connectionData) {
    if (connectionData.type === 'offer') {
        currentRoomCode = connectionData.roomCode;
        joinRoom(connectionData.offer);
    }
}

// 加入房间
function joinRoom(offer) {
    connectionStartTime = Date.now();
    isInitiator = false;
    
    addLog(`加入房间: ${currentRoomCode}`, 'info');
    updateStatus('正在加入房间...', 'connecting');
    updateDetailedStatus('连接中', currentRoomCode);
    
    createBtn.disabled = true;
    connectBtn.disabled = true;
    
    // 关闭所有面板
    qrPanel.style.display = 'none';
    joinPanel.style.display = 'none';
    manualInputPanel.style.display = 'none';
    scanPanel.style.display = 'none';
    
    if (qrStream) {
        qrStream.getTracks().forEach(track => track.stop());
        qrStream = null;
    }
    
    try {
        const configuration = getEnhancedConfiguration();
        
        addLog('初始化WebRTC连接', 'info');
        peerConnection = new RTCPeerConnection(configuration);
        
        setupConnectionListeners();
        
        peerConnection.ondatachannel = (event) => {
            addLog('数据通道已建立', 'success');
            dataChannel = event.channel;
            setupDataChannel();
        };
        
        addLog('设置远程描述', 'info');
        peerConnection.setRemoteDescription(offer)
            .then(() => {
                addLog('创建应答', 'info');
                return peerConnection.createAnswer();
            })
            .then(answer => {
                addLog('设置本地描述', 'info');
                return peerConnection.setLocalDescription(answer);
            })
            .then(() => {
                addLog('连接建立中...', 'success');
                updateDetailedStatus('建立连接', currentRoomCode);
            })
            .catch(error => {
                addLog(`加入房间失败: ${error.message}`, 'error');
                updateStatus('加入失败', 'error');
                resetConnection();
            });
            
    } catch (error) {
        addLog(`加入房间时发生错误: ${error.message}`, 'error');
        updateStatus('加入失败', 'error');
        resetConnection();
    }
}

// 获取增强的ICE配置
function getEnhancedConfiguration() {
    return {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            {
                urls: 'turn:numb.viagenie.ca',
                credential: 'muazkh',
                username: 'webrtc@live.com'
            },
            {
                urls: 'turn:openrelay.metered.ca:80',
                credential: 'openrelayproject',
                username: 'openrelayproject'
            }
        ],
        iceCandidatePoolSize: 25,
        iceTransportPolicy: 'all'
    };
}

// 设置连接监听器
function setupConnectionListeners() {
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            addLog('收集网络连接信息...', 'info');
        }
    };
    
    peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        addLog(`网络状态: ${state}`, 'info');
        
        switch(state) {
            case 'checking':
                updateDetailedStatus('建立连接中', currentRoomCode);
                break;
            case 'connected':
            case 'completed':
                updateDetailedStatus('连接成功', currentRoomCode);
                const connectionTime = Date.now() - connectionStartTime;
                addLog(`连接建立成功! 耗时: ${connectionTime}ms`, 'success');
                break;
            case 'disconnected':
                updateDetailedStatus('连接断开', currentRoomCode);
                addLog('网络连接断开', 'warning');
                break;
            case 'failed':
                updateDetailedStatus('连接失败', currentRoomCode);
                addLog('网络连接失败', 'error');
                break;
        }
    };
    
    peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        addLog(`连接状态: ${state}`, 'info');
        
        switch(state) {
            case 'connecting':
                updateStatus('连接建立中...', 'connecting');
                updateDetailedStatus('连接中', currentRoomCode);
                break;
            case 'connected':
                updateStatus('连接成功！', 'connected');
                updateDetailedStatus('已连接', currentRoomCode);
                const totalTime = Date.now() - connectionStartTime;
                addLog(`连接完成! 总耗时: ${totalTime}ms`, 'success');
                addMessage('连接已建立，可以开始私密聊天了！', 'received', '系统消息');
                break;
            case 'disconnected':
                updateStatus('连接断开', 'error');
                updateDetailedStatus('已断开', currentRoomCode);
                addLog('连接已断开', 'warning');
                addMessage('连接已断开', 'received', '系统消息');
                break;
            case 'failed':
                updateStatus('连接失败', 'error');
                updateDetailedStatus('连接失败', currentRoomCode);
                addLog('连接失败', 'error');
                addMessage('连接失败，请重试', 'received', '系统消息');
                break;
        }
    };
}

// 设置数据通道
function setupDataChannel() {
    dataChannel.onopen = () => {
        addLog('数据通道已打开，可以开始聊天', 'success');
        updateDetailedStatus('已连接', currentRoomCode);
        updateStatus('连接成功！', 'connected');
    };
    
    dataChannel.onclose = () => {
        addLog('数据通道已关闭', 'warning');
        updateDetailedStatus('已断开', currentRoomCode);
    };
    
    dataChannel.onmessage = (event) => {
        addLog(`收到消息`, 'info');
        addMessage(event.data, 'received');
    };
    
    dataChannel.onerror = (error) => {
        addLog(`数据通道错误: ${error.message}`, 'error');
        updateDetailedStatus('连接错误', currentRoomCode);
    };
}

// 发送消息
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !dataChannel || dataChannel.readyState !== 'open') {
        addLog('无法发送消息: 连接未就绪', 'warning');
        return;
    }
    
    try {
        dataChannel.send(message);
        addLog(`发送消息`, 'info');
        addMessage(message, 'sent');
        messageInput.value = '';
    } catch (error) {
        addLog(`发送消息失败: ${error.message}`, 'error');
        addMessage('发送失败，连接可能已断开', 'received', '系统消息');
    }
}

// 断开连接
function disconnect() {
    addLog('用户主动断开连接', 'info');
    resetConnection();
    addMessage('连接已断开', 'received', '系统消息');
}

// 重置连接
function resetConnection() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    dataChannel = null;
    currentRoomCode = null;
    currentOffer = null;
    
    // 关闭所有面板
    qrPanel.style.display = 'none';
    joinPanel.style.display = 'none';
    manualInputPanel.style.display = 'none';
    scanPanel.style.display = 'none';
    
    if (qrStream) {
        qrStream.getTracks().forEach(track => track.stop());
        qrStream = null;
    }
    
    createBtn.disabled = false;
    connectBtn.disabled = false;
    
    updateStatus('连接已断开', 'disconnected');
    updateDetailedStatus('未连接', '-');
    addLog('连接已重置', 'info');
}

// 复制连接代码
function copyConnectionCode() {
    const code = manualCodeDisplay.textContent;
    navigator.clipboard.writeText(code).then(() => {
        addLog('连接代码已复制到剪贴板', 'success');
        alert('连接代码已复制到剪贴板！');
    }).catch(err => {
        addLog(`复制失败: ${err.message}`, 'error');
        // 备用方案
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        addLog('连接代码已复制到剪贴板(备用方案)', 'success');
        alert('连接代码已复制到剪贴板！');
    });
}

// 取消加入
function cancelJoin() {
    joinPanel.style.display = 'none';
    addLog('取消加入房间', 'info');
}

// 返回加入选项
function backToJoinOptions() {
    manualInputPanel.style.display = 'none';
    joinPanel.style.display = 'block';
}

// 添加消息到聊天界面
function addMessage(text, type, sender = '') {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', type);
    
    const messageText = document.createElement('div');
    messageText.classList.add('message-text');
    messageText.textContent = text;
    
    const messageTime = document.createElement('div');
    messageTime.classList.add('message-time');
    
    if (sender) {
        messageTime.textContent = sender;
    } else {
        messageTime.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
    
    messageElement.appendChild(messageText);
    messageElement.appendChild(messageTime);
    messagesContainer.appendChild(messageElement);
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 清理资源
function cleanup() {
    if (peerConnection) {
        peerConnection.close();
    }
    if (qrStream) {
        qrStream.getTracks().forEach(track => track.stop());
    }
}

// 初始化应用
init();