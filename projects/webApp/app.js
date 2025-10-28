// 全局变量
let peerConnection = null;
let dataChannel = null;
let isInitiator = false;
let currentRoomCode = null;
let connectionStartTime = null;

// DOM元素
const instructionsPanel = document.getElementById('instructionsPanel');
const connectionPanel = document.getElementById('connectionPanel');
const chatContainer = document.getElementById('chatContainer');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const webrtcStatus = document.getElementById('webrtcStatus');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const roomCode = document.getElementById('roomCode');
const createBtn = document.getElementById('createBtn');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const roomCodePanel = document.getElementById('roomCodePanel');
const joinRoomPanel = document.getElementById('joinRoomPanel');
const roomInput = document.getElementById('roomInput');
const confirmJoinBtn = document.getElementById('confirmJoinBtn');
const cancelJoinBtn = document.getElementById('cancelJoinBtn');
const copyRoomBtn = document.getElementById('copyRoomBtn');
const shareRoomBtn = document.getElementById('shareRoomBtn');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const logContent = document.getElementById('logContent');
const clearLogBtn = document.getElementById('clearLogBtn');
const startBtn = document.getElementById('startBtn');

// 初始化
function init() {
    addLog('应用初始化完成', 'success');
    updateStatus('等待连接...', 'disconnected');
    updateDetailedStatus('未连接', '-');
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
    
    // 移除所有状态类
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
    
    // 启用/禁用聊天功能
    const isConnected = state === 'connected';
    messageInput.disabled = !isConnected;
    sendBtn.disabled = !isConnected;
    
    // 显示/隐藏断开连接按钮
    disconnectBtn.style.display = (state === 'connected' || state === 'connecting') ? 'block' : 'none';
    
    // 显示/隐藏聊天界面
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
    roomCodeDisplay.textContent = currentRoomCode;
    
    addLog(`创建房间: ${currentRoomCode}`, 'info');
    updateStatus('正在创建房间...', 'connecting');
    updateDetailedStatus('创建中', currentRoomCode);
    
    // 显示房间代码面板
    roomCodePanel.style.display = 'block';
    joinRoomPanel.style.display = 'none';
    
    // 禁用创建/加入按钮
    createBtn.disabled = true;
    connectBtn.disabled = true;
    
    try {
        // 配置STUN服务器
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        addLog('初始化WebRTC连接', 'info');
        peerConnection = new RTCPeerConnection(configuration);
        
        // 设置连接监听器
        setupConnectionListeners();
        
        addLog('创建数据通道', 'info');
        dataChannel = peerConnection.createDataChannel('chat');
        setupDataChannel();
        
        addLog('创建连接Offer', 'info');
        return peerConnection.createOffer()
            .then(offer => {
                addLog('设置本地描述', 'info');
                return peerConnection.setLocalDescription(offer);
            })
            .then(() => {
                addLog('房间创建完成，等待对方加入', 'success');
                updateStatus('等待对方加入...', 'connecting');
                updateDetailedStatus('等待连接', currentRoomCode);
                
                // 设置连接超时
                setTimeout(() => {
                    if (peerConnection && peerConnection.connectionState !== 'connected') {
                        addLog('连接超时，请检查网络或重新创建房间', 'warning');
                        updateStatus('连接超时', 'error');
                    }
                }, 45000);
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

// 加入房间
function joinRoom() {
    // 显示加入房间输入面板
    joinRoomPanel.style.display = 'block';
    roomCodePanel.style.display = 'none';
}

// 确认加入房间
function confirmJoinRoom() {
    const code = roomInput.value.trim();
    
    if (!code || code.length !== 4 || !/^\d+$/.test(code)) {
        addLog('请输入有效的4位数字房间号', 'error');
        alert('请输入有效的4位数字房间号');
        return;
    }
    
    currentRoomCode = code;
    joinRoomPanel.style.display = 'none';
    createBtn.disabled = true;
    connectBtn.disabled = true;
    
    startJoiningRoom();
}

// 开始加入房间流程
function startJoiningRoom() {
    connectionStartTime = Date.now();
    isInitiator = false;
    
    addLog(`加入房间: ${currentRoomCode}`, 'info');
    updateStatus('正在加入房间...', 'connecting');
    updateDetailedStatus('连接中', currentRoomCode);
    
    try {
        // 配置STUN服务器
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        addLog('初始化WebRTC连接', 'info');
        peerConnection = new RTCPeerConnection(configuration);
        
        // 设置连接监听器
        setupConnectionListeners();
        
        // 设置数据通道回调
        peerConnection.ondatachannel = (event) => {
            addLog('数据通道已建立', 'success');
            dataChannel = event.channel;
            setupDataChannel();
        };
        
        addLog('等待连接建立...', 'info');
        updateDetailedStatus('等待连接', currentRoomCode);
        
        // 设置连接超时
        setTimeout(() => {
            if (peerConnection && peerConnection.connectionState !== 'connected') {
                addLog('连接超时，请检查房间号或网络', 'warning');
                updateStatus('连接超时', 'error');
            }
        }, 45000);
        
    } catch (error) {
        addLog(`加入房间时发生错误: ${error.message}`, 'error');
        updateStatus('加入失败', 'error');
        resetConnection();
    }
}

// 设置连接监听器
function setupConnectionListeners() {
    // 处理ICE候选
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            addLog('收集网络连接信息...', 'info');
        }
    };
    
    // ICE连接状态
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
    
    // 连接状态
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
    
    roomCodePanel.style.display = 'none';
    joinRoomPanel.style.display = 'none';
    roomInput.value = '';
    
    createBtn.disabled = false;
    connectBtn.disabled = false;
    
    updateStatus('连接已断开', 'disconnected');
    updateDetailedStatus('未连接', '-');
    addLog('连接已重置', 'info');
}

// 复制房间号
function copyRoomCode() {
    navigator.clipboard.writeText(currentRoomCode).then(() => {
        addLog('房间号已复制到剪贴板', 'success');
        alert('房间号已复制到剪贴板！');
    }).catch(err => {
        addLog(`复制失败: ${err.message}`, 'error');
        // 备用方案
        const textArea = document.createElement('textarea');
        textArea.value = currentRoomCode;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        addLog('房间号已复制到剪贴板(备用方案)', 'success');
        alert('房间号已复制到剪贴板！');
    });
}

// 分享房间号
function shareRoomCode() {
    if (navigator.share) {
        navigator.share({
            title: '加入我的聊天房间',
            text: `使用房间号 ${currentRoomCode} 加入我的私密聊天`,
        }).then(() => {
            addLog('房间号分享成功', 'success');
        }).catch(error => {
            addLog(`分享失败: ${error.message}`, 'error');
            copyRoomCode(); // 分享失败时 fallback 到复制
        });
    } else {
        copyRoomCode(); // 不支持分享时 fallback 到复制
    }
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
    
    // 滚动到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 事件监听
startBtn.addEventListener('click', startApp);
createBtn.addEventListener('click', createRoom);
connectBtn.addEventListener('click', joinRoom);
disconnectBtn.addEventListener('click', disconnect);
confirmJoinBtn.addEventListener('click', confirmJoinRoom);
cancelJoinBtn.addEventListener('click', () => {
    joinRoomPanel.style.display = 'none';
    addLog('取消加入房间', 'info');
});
copyRoomBtn.addEventListener('click', copyRoomCode);
shareRoomBtn.addEventListener('click', shareRoomCode);
sendBtn.addEventListener('click', sendMessage);
clearLogBtn.addEventListener('click', clearLog);

messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

// 房间号输入限制
roomInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (peerConnection) {
        peerConnection.close();
    }
});

// 初始化应用
init();