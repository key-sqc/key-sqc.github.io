// 全局变量
let peerConnection = null;
let dataChannel = null;
let isInitiator = false;
let connectionStartTime = null;

// DOM元素
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const webrtcStatus = document.getElementById('webrtcStatus');
const dataChannelStatus = document.getElementById('dataChannelStatus');
const iceStatus = document.getElementById('iceStatus');
const createBtn = document.getElementById('createBtn');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const connectionCodeContainer = document.getElementById('connectionCodeContainer');
const connectionCode = document.getElementById('connectionCode');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const logContent = document.getElementById('logContent');

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
    
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// 更新连接状态
function updateStatus(text, state) {
    statusText.textContent = text;
    
    // 移除所有状态类
    statusIndicator.className = 'status-indicator';
    
    // 根据状态添加对应的类
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
            // 保持默认的红色状态
            break;
    }
    
    // 启用/禁用输入框和发送按钮
    const isConnected = state === 'connected';
    messageInput.disabled = !isConnected;
    sendBtn.disabled = !isConnected;
    
    // 显示/隐藏断开连接按钮
    disconnectBtn.style.display = (state === 'connected' || state === 'connecting') ? 'block' : 'none';
}

// 更新详细状态
function updateDetailedStatus(webrtcState, dataChannelState, iceState) {
    if (webrtcState) {
        webrtcStatus.textContent = webrtcState;
        webrtcStatus.className = getStatusClass(webrtcState);
    }
    
    if (dataChannelState) {
        dataChannelStatus.textContent = dataChannelState;
        dataChannelStatus.className = getStatusClass(dataChannelState);
    }
    
    if (iceState) {
        iceStatus.textContent = iceState;
        iceStatus.className = getStatusClass(iceState);
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

// 重置连接状态
function resetConnection() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    dataChannel = null;
    connectionCodeContainer.style.display = 'none';
    updateStatus('连接已重置', 'disconnected');
    updateDetailedStatus('未初始化', '未连接', '未开始');
    addLog('连接已重置', 'info');
}

// 创建对等连接
function createConnection() {
    connectionStartTime = Date.now();
    isInitiator = true;
    
    addLog('开始创建连接...', 'info');
    updateStatus('正在创建连接...', 'connecting');
    updateDetailedStatus('初始化中...', '准备创建', '等待开始');
    
    try {
        // 配置STUN服务器
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10
        };
        
        addLog('创建RTCPeerConnection实例', 'info');
        peerConnection = new RTCPeerConnection(configuration);
        
        // 设置连接状态监听
        setupConnectionListeners();
        
        addLog('创建数据通道', 'info');
        dataChannel = peerConnection.createDataChannel('chat', {
            ordered: true
        });
        setupDataChannel();
        
        addLog('创建Offer...', 'info');
        return peerConnection.createOffer()
            .then(offer => {
                addLog('Offer创建成功，设置本地描述', 'success');
                return peerConnection.setLocalDescription(offer);
            })
            .then(() => {
                const offer = peerConnection.localDescription;
                addLog('本地描述设置完成', 'success');
                
                // 显示连接代码
                const code = btoa(JSON.stringify(offer));
                connectionCode.textContent = code;
                connectionCodeContainer.style.display = 'block';
                
                updateStatus('等待对方加入连接...', 'connecting');
                updateDetailedStatus('等待应答', '等待连接', '收集候选');
                
                addLog('连接代码已生成，请分享给对方', 'success');
                addMessage('已创建连接，请将代码分享给对方', 'received', '系统消息');
                
                // 设置超时检查
                setTimeout(() => {
                    if (peerConnection && peerConnection.connectionState !== 'connected') {
                        addLog('连接超时，请检查网络或重新创建连接', 'warning');
                        updateStatus('连接超时', 'error');
                    }
                }, 30000);
            })
            .catch(error => {
                addLog(`创建连接失败: ${error.message}`, 'error');
                updateStatus('创建连接失败', 'error');
                updateDetailedStatus('初始化失败', '创建失败', '错误');
                throw error;
            });
            
    } catch (error) {
        addLog(`创建连接时发生错误: ${error.message}`, 'error');
        updateStatus('创建连接失败', 'error');
        return Promise.reject(error);
    }
}

// 加入连接
function joinConnection() {
    connectionStartTime = Date.now();
    isInitiator = false;
    
    const code = prompt('请输入对方提供的连接代码:');
    if (!code) {
        addLog('用户取消输入连接代码', 'warning');
        return;
    }
    
    addLog('开始加入连接...', 'info');
    updateStatus('正在加入连接...', 'connecting');
    updateDetailedStatus('初始化中...', '等待通道', '等待开始');
    
    try {
        const offer = JSON.parse(atob(code));
        addLog('连接代码解析成功', 'success');
        
        // 配置STUN服务器
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10
        };
        
        addLog('创建RTCPeerConnection实例', 'info');
        peerConnection = new RTCPeerConnection(configuration);
        
        // 设置连接状态监听
        setupConnectionListeners();
        
        // 设置数据通道回调
        peerConnection.ondatachannel = (event) => {
            addLog('数据通道已建立', 'success');
            dataChannel = event.channel;
            setupDataChannel();
        };
        
        addLog('设置远程描述...', 'info');
        return peerConnection.setRemoteDescription(offer)
            .then(() => {
                addLog('远程描述设置成功', 'success');
                updateDetailedStatus('创建应答中...', '等待通道', '收集候选');
                return peerConnection.createAnswer();
            })
            .then(answer => {
                addLog('Answer创建成功', 'success');
                return peerConnection.setLocalDescription(answer);
            })
            .then(() => {
                addLog('本地描述设置完成', 'success');
                updateStatus('连接建立中...', 'connecting');
                updateDetailedStatus('等待连接', '等待打开', '建立连接');
                addMessage('正在建立连接...', 'received', '系统消息');
                
                // 设置超时检查
                setTimeout(() => {
                    if (peerConnection && peerConnection.connectionState !== 'connected') {
                        addLog('连接超时，请检查网络或重新尝试', 'warning');
                        updateStatus('连接超时', 'error');
                    }
                }, 30000);
            })
            .catch(error => {
                addLog(`加入连接失败: ${error.message}`, 'error');
                updateStatus('加入连接失败', 'error');
                updateDetailedStatus('连接失败', '连接失败', '错误');
                throw error;
            });
            
    } catch (error) {
        addLog(`加入连接时发生错误: ${error.message}`, 'error');
        if (error instanceof SyntaxError) {
            addLog('连接代码格式错误，请检查代码是否正确', 'error');
            alert('无效的连接代码！请检查代码是否正确。');
        }
        updateStatus('加入连接失败', 'error');
        return Promise.reject(error);
    }
}

// 设置连接监听器
function setupConnectionListeners() {
    // 处理ICE候选
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            addLog(`ICE候选收集: ${event.candidate.type}`, 'info');
            updateDetailedStatus(null, null, '收集候选中');
        } else {
            addLog('ICE候选收集完成', 'success');
            updateDetailedStatus(null, null, '候选收集完成');
        }
    };
    
    // ICE连接状态
    peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        addLog(`ICE连接状态: ${state}`, 'info');
        
        switch(state) {
            case 'checking':
                updateDetailedStatus(null, null, '检查连接中');
                break;
            case 'connected':
            case 'completed':
                updateDetailedStatus(null, null, '连接成功');
                const connectionTime = Date.now() - connectionStartTime;
                addLog(`ICE连接建立成功，耗时: ${connectionTime}ms`, 'success');
                break;
            case 'disconnected':
                updateDetailedStatus(null, null, '连接断开');
                addLog('ICE连接断开', 'warning');
                break;
            case 'failed':
                updateDetailedStatus(null, null, '连接失败');
                addLog('ICE连接失败', 'error');
                break;
        }
    };
    
    // 连接状态
    peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        addLog(`WebRTC连接状态: ${state}`, 'info');
        
        switch(state) {
            case 'connecting':
                updateStatus('连接建立中...', 'connecting');
                updateDetailedStatus('连接中', null, null);
                break;
            case 'connected':
                updateStatus('连接成功！', 'connected');
                updateDetailedStatus('已连接', null, null);
                const totalTime = Date.now() - connectionStartTime;
                addLog(`连接建立完成！总耗时: ${totalTime}ms`, 'success');
                addMessage('连接已建立，可以开始聊天了', 'received', '系统消息');
                break;
            case 'disconnected':
                updateStatus('连接断开', 'error');
                updateDetailedStatus('已断开', '已关闭', '已断开');
                addLog('连接已断开', 'warning');
                addMessage('连接已断开', 'received', '系统消息');
                break;
            case 'failed':
                updateStatus('连接失败', 'error');
                updateDetailedStatus('连接失败', '连接失败', '连接失败');
                addLog('连接失败', 'error');
                addMessage('连接失败，请重试', 'received', '系统消息');
                break;
        }
    };
    
    // ICE收集状态
    peerConnection.onicegatheringstatechange = () => {
        const state = peerConnection.iceGatheringState;
        addLog(`ICE收集状态: ${state}`, 'info');
    };
}

// 设置数据通道
function setupDataChannel() {
    dataChannel.onopen = () => {
        addLog('数据通道已打开', 'success');
        updateDetailedStatus(null, '已连接', null);
        updateStatus('连接成功！', 'connected');
    };
    
    dataChannel.onclose = () => {
        addLog('数据通道已关闭', 'warning');
        updateDetailedStatus(null, '已关闭', null);
    };
    
    dataChannel.onmessage = (event) => {
        addLog(`收到消息: ${event.data}`, 'info');
        addMessage(event.data, 'received');
    };
    
    dataChannel.onerror = (error) => {
        addLog(`数据通道错误: ${error.message}`, 'error');
        updateDetailedStatus(null, '错误', null);
    };
    
    // 监听数据通道状态
    const checkDataChannelState = () => {
        if (dataChannel) {
            const state = dataChannel.readyState;
            if (state === 'connecting') {
                updateDetailedStatus(null, '连接中', null);
            } else if (state === 'open') {
                updateDetailedStatus(null, '已连接', null);
            }
        }
    };
    
    // 初始检查
    checkDataChannelState();
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
        addLog(`发送消息: ${message}`, 'info');
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

// 复制连接代码
function copyConnectionCode() {
    const code = connectionCode.textContent;
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

// 事件监听
createBtn.addEventListener('click', createConnection);
connectBtn.addEventListener('click', joinConnection);
disconnectBtn.addEventListener('click', disconnect);
sendBtn.addEventListener('click', sendMessage);
copyCodeBtn.addEventListener('click', copyConnectionCode);

messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (peerConnection) {
        peerConnection.close();
    }
});

// 初始状态
addLog('应用初始化完成', 'success');
updateStatus('等待连接...', 'disconnected');
updateDetailedStatus('未初始化', '未连接', '未开始');