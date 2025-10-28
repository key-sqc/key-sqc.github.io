// 全局变量
let peerConnection = null;
let dataChannel = null;
let isInitiator = false;
let currentRoomCode = null;
let connectionStartTime = null;
let currentOffer = null;
let qrStream = null;
let currentFacingMode = 'environment';
let collectedIceCandidates = [];

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
const fileInput = document.getElementById('fileInput');

// 按钮元素
const copyCodeBtn = document.getElementById('copyCodeBtn');
const refreshQRBtn = document.getElementById('refreshQRBtn');
const closeQRBtn = document.getElementById('closeQRBtn');
const scanQRBtn = document.getElementById('scanQRBtn');
const galleryQRBtn = document.getElementById('galleryQRBtn');
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
    galleryQRBtn.addEventListener('click', () => fileInput.click());
    manualInputBtn.addEventListener('click', showManualInput);
    cancelJoinBtn.addEventListener('click', cancelJoin);
    confirmManualBtn.addEventListener('click', confirmManualJoin);
    backToJoinBtn.addEventListener('click', backToJoinOptions);
    cancelScanBtn.addEventListener('click', cancelQRScan);
    switchCameraBtn.addEventListener('click', switchCamera);
    
    // 文件选择
    fileInput.addEventListener('change', handleFileSelect);
    
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

// 创建房间 - 修复版本
function createRoom() {
    connectionStartTime = Date.now();
    isInitiator = true;
    collectedIceCandidates = [];
    
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
        
        // 设置ICE候选收集
        let iceGatheringComplete = false;
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                collectedIceCandidates.push(event.candidate);
                addLog(`收集到ICE候选`, 'info');
            } else {
                addLog('ICE候选收集完成', 'success');
                iceGatheringComplete = true;
                // 立即生成二维码
                generateFinalQRCode();
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
        
        addLog('创建数据通道', 'info');
        dataChannel = peerConnection.createDataChannel('chat');
        setupDataChannel();
        
        addLog('创建连接Offer', 'info');
        peerConnection.createOffer()
            .then(offer => {
                addLog('设置本地描述', 'info');
                currentOffer = offer;
                return peerConnection.setLocalDescription(offer);
            })
            .then(() => {
                addLog('等待ICE候选收集...', 'info');
                
                // 设置超时，防止ICE收集卡住
                setTimeout(() => {
                    if (!iceGatheringComplete) {
                        addLog('ICE收集超时，使用当前收集的候选生成二维码', 'warning');
                        generateFinalQRCode();
                    }
                }, 3000);
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

// 生成最终的二维码 - 修复版本
function generateFinalQRCode() {
    if (!currentOffer) {
        addLog('等待Offer准备完成...', 'info');
        setTimeout(generateFinalQRCode, 500);
        return;
    }
    
    const connectionData = {
        type: 'offer',
        offer: currentOffer,
        iceCandidates: collectedIceCandidates,
        roomCode: currentRoomCode,
        timestamp: Date.now()
    };
    
    const connectionString = JSON.stringify(connectionData);
    const base64Code = btoa(unescape(encodeURIComponent(connectionString)));
    
    // 显示手动输入代码
    manualCodeDisplay.textContent = base64Code;
    manualCodeDisplay.style.display = 'block';
    
    // 生成二维码
    try {
        SimpleQRCode.generate(connectionString, qrCanvas, 200);
        addLog('二维码生成成功', 'success');
    } catch (error) {
        addLog(`二维码生成失败: ${error.message}`, 'error');
        // 即使二维码生成失败，也要显示手动输入代码
    }
    
    // 显示二维码面板
    showQRCodePanel();
    updateStatus('等待对方扫描二维码...', 'connecting');
    updateDetailedStatus('等待连接', currentRoomCode);
    addLog('连接信息已准备就绪，可以分享二维码或代码', 'success');
}

// 显示二维码面板
function showQRCodePanel() {
    qrPanel.style.display = 'block';
    joinPanel.style.display = 'none';
    manualInputPanel.style.display = 'none';
    scanPanel.style.display = 'none';
}

// 刷新二维码
function refreshQRCode() {
    addLog('刷新二维码', 'info');
    createRoom(); // 重新创建房间和二维码
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
        await scannerVideo.play();
        
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
    let scanCount = 0;
    
    function scan() {
        if (scannerVideo.videoWidth > 0 && scannerVideo.videoHeight > 0) {
            canvas.width = scannerVideo.videoWidth;
            canvas.height = scannerVideo.videoHeight;
            
            ctx.drawImage(scannerVideo, 0, 0, canvas.width, canvas.height);
            
            // 简化的二维码识别（在实际应用中应该使用专业的QR码识别库）
            scanCount++;
            if (scanCount % 10 === 0) { // 每10帧尝试识别一次
                try {
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    // 这里可以集成专业的QR码识别库
                    // 暂时使用模拟识别
                    if (Math.random() < 0.01) { // 1%的几率"识别"到二维码
                        simulateQRDetection();
                        return;
                    }
                } catch (error) {
                    // 忽略识别错误
                }
            }
        }
        
        if (scanPanel.style.display !== 'none') {
            requestAnimationFrame(scan);
        }
    }
    
    scan();
}

// 模拟二维码识别（用于演示）
function simulateQRDetection() {
    addLog('请使用真实QR码识别库替换此功能', 'warning');
    // 在实际应用中，这里应该使用如jsQR等专业库
}

// 处理文件选择
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        addLog('请选择图片文件', 'error');
        return;
    }
    
    addLog('正在解析图片中的二维码...', 'info');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // 在实际应用中，这里应该使用专业的QR码识别库
            // 暂时显示提示信息
            addLog('图片加载成功，请使用专业QR码识别库解析', 'info');
            alert('图库扫描功能需要集成专业QR码识别库（如jsQR）。当前为演示版本。');
        };
        img.onerror = function() {
            addLog('图片加载失败', 'error');
        };
        img.src = e.target.result;
    };
    reader.onerror = function() {
        addLog('文件读取失败', 'error');
    };
    reader.readAsDataURL(file);
    
    // 重置文件输入
    event.target.value = '';
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
        // 解码base64
        const decodedString = decodeURIComponent(escape(atob(code)));
        const connectionData = JSON.parse(decodedString);
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
        joinRoom(connectionData);
    }
}

// 加入房间 - 修复版本
function joinRoom(connectionData) {
    connectionStartTime = Date.now();
    isInitiator = false;
    
    addLog(`加入房间: ${connectionData.roomCode}`, 'info');
    updateStatus('正在加入房间...', 'connecting');
    updateDetailedStatus('连接中', connectionData.roomCode);
    
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
        
        // 设置连接状态监听
        peerConnection.oniceconnectionstatechange = () => {
            const state = peerConnection.iceConnectionState;
            addLog(`网络状态: ${state}`, 'info');
        };
        
        peerConnection.onconnectionstatechange = () => {
            const state = peerConnection.connectionState;
            addLog(`连接状态: ${state}`, 'info');
            
            switch(state) {
                case 'connecting':
                    updateStatus('连接建立中...', 'connecting');
                    break;
                case 'connected':
                    updateStatus('连接成功！', 'connected');
                    const totalTime = Date.now() - connectionStartTime;
                    addLog(`连接完成! 总耗时: ${totalTime}ms`, 'success');
                    addMessage('连接已建立，可以开始私密聊天了！', 'received', '系统消息');
                    break;
                case 'disconnected':
                    updateStatus('连接断开', 'error');
                    addLog('连接已断开', 'warning');
                    break;
                case 'failed':
                    updateStatus('连接失败', 'error');
                    addLog('连接失败', 'error');
                    break;
            }
        };
        
        // 设置数据通道回调
        peerConnection.ondatachannel = (event) => {
            addLog('数据通道已建立', 'success');
            dataChannel = event.channel;
            setupDataChannel();
        };
        
        addLog('设置远程描述和ICE候选', 'info');
        peerConnection.setRemoteDescription(connectionData.offer)
            .then(() => {
                // 添加所有ICE候选
                if (connectionData.iceCandidates && connectionData.iceCandidates.length > 0) {
                    addLog(`添加 ${connectionData.iceCandidates.length} 个ICE候选`, 'info');
                    const icePromises = connectionData.iceCandidates.map(candidate =>
                        peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                    );
                    return Promise.all(icePromises);
                } else {
                    addLog('没有ICE候选信息', 'warning');
                    return Promise.resolve();
                }
            })
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
                updateDetailedStatus('建立连接', connectionData.roomCode);
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
    collectedIceCandidates = [];
    
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