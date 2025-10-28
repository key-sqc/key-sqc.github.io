// app.js - 优化后的WebRTC实现
class DecentralizedMessenger {
    constructor() {
        this.peerConnection = null;
        this.dataChannel = null;
        this.localId = this.generateId();
        this.remoteId = '';
        this.isConnected = false;
        this.connectionStartTime = null;
        this.messageCount = 0;
        this.signalingServer = this.createSignalingServer();
        
        this.initializeApp();
        this.setupEventListeners();
        this.generateQRCode();
        
        // 连接质量监控
        this.connectionQuality = 'unknown';
        this.qualityCheckInterval = null;
    }
    
    // 生成随机ID
    generateId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    
    // 模拟信令服务器
    createSignalingServer() {
        return {
            sendSignal: (to, signal) => {
                this.log(`发送信令到 ${to}: ${signal.type}`, 'info');
                // 模拟网络延迟
                setTimeout(() => {
                    if (typeof window !== 'undefined' && window.receiveSignal) {
                        window.receiveSignal(this.localId, signal);
                    }
                }, 300 + Math.random() * 400);
            },
            
            listen: (callback) => {
                window.receiveSignal = (from, signal) => {
                    this.log(`收到来自 ${from} 的信令: ${signal.type}`, 'info');
                    callback(from, signal);
                };
            }
        };
    }
    
    // 初始化应用
    initializeApp() {
        document.getElementById('peer-id').value = this.localId;
        this.updateStatus('离线', false);
        this.updateInputStatus('等待连接...', false);
    }
    
    // 设置事件监听
    setupEventListeners() {
        document.getElementById('copy-id').addEventListener('click', () => {
            this.copyToClipboard(this.localId);
            this.showTemporaryMessage('ID已复制到剪贴板');
        });
        
        document.getElementById('connect-btn').addEventListener('click', () => {
            this.remoteId = document.getElementById('remote-id').value.trim();
            if (this.remoteId) {
                this.initiateConnection();
            } else {
                this.showTemporaryMessage('请输入对方ID');
            }
        });
        
        document.getElementById('disconnect-btn').addEventListener('click', () => {
            this.disconnect();
        });
        
        document.getElementById('message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
        
        document.getElementById('send-btn').addEventListener('click', () => {
            this.sendMessage();
        });
        
        // 输入框状态变化
        document.getElementById('message-input').addEventListener('input', (e) => {
            const sendBtn = document.getElementById('send-btn');
            sendBtn.disabled = !e.target.value.trim() || !this.isConnected;
        });
    }
    
    // 生成二维码
    generateQRCode() {
        const qr = qrcode(0, 'M');
        qr.addData(JSON.stringify({
            type: 'decentralized-messenger',
            id: this.localId,
            version: '1.0',
            timestamp: Date.now()
        }));
        qr.make();
        
        const qrContainer = document.getElementById('qrcode');
        qrContainer.innerHTML = qr.createImgTag(4);
    }
    
    // 初始化连接
    async initiateConnection() {
        this.log('开始建立P2P连接...', 'info');
        this.connectionStartTime = Date.now();
        
        try {
            // 创建RTCPeerConnection
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            });
            
            // 设置数据通道
            this.setupDataChannel();
            
            // 监听ICE候选
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.signalingServer.sendSignal(this.remoteId, {
                        type: 'ice-candidate',
                        candidate: event.candidate
                    });
                }
            };
            
            // 监听连接状态变化
            this.peerConnection.onconnectionstatechange = () => {
                this.log(`连接状态: ${this.peerConnection.connectionState}`, 'info');
                if (this.peerConnection.connectionState === 'connected') {
                    this.startQualityMonitoring();
                }
            };
            
            // 创建offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.signalingServer.sendSignal(this.remoteId, {
                type: 'offer',
                offer: offer
            });
            
            this.log('已发送连接邀请，等待对方接受...', 'success');
            
        } catch (error) {
            this.log('创建连接失败: ' + error.message, 'error');
            this.showTemporaryMessage('连接失败: ' + error.message);
        }
    }
    
    // 设置数据通道
    setupDataChannel() {
        // 创建数据通道
        this.dataChannel = this.peerConnection.createDataChannel('chat', {
            ordered: true,
            maxRetransmits: 3
        });
        
        this.setupDataChannelEvents(this.dataChannel);
        
        // 监听对方创建的数据通道
        this.peerConnection.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this.setupDataChannelEvents(this.dataChannel);
        };
    }
    
    // 设置数据通道事件
    setupDataChannelEvents(channel) {
        channel.onopen = () => {
            const connectionTime = Date.now() - this.connectionStartTime;
            this.log(`P2P连接已建立! 耗时: ${connectionTime}ms`, 'success');
            this.isConnected = true;
            this.updateStatus('已连接', true);
            this.switchToChatPanel();
            this.showConnectionSuccess();
            this.updateInputStatus('可以发送消息了!', true);
            this.playConnectionSound();
            
            // 隐藏欢迎消息
            document.getElementById('welcome-message').style.display = 'none';
        };
        
        channel.onclose = () => {
            this.log('连接已关闭', 'warning');
            this.isConnected = false;
            this.updateStatus('离线', false);
            this.showTemporaryMessage('连接已断开');
            this.updateInputStatus('连接已断开', false);
            this.stopQualityMonitoring();
        };
        
        channel.onmessage = (event) => {
            this.messageCount++;
            this.displayMessage(event.data, 'received');
            this.updateConnectionQuality();
        };
        
        channel.onerror = (error) => {
            this.log('数据通道错误: ' + error, 'error');
        };
    }
    
    // 处理信令消息
    async handleSignaling(from, signal) {
        if (!this.peerConnection) {
            this.connectionStartTime = Date.now();
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            });
            
            this.setupDataChannel();
            
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.signalingServer.sendSignal(from, {
                        type: 'ice-candidate',
                        candidate: event.candidate
                    });
                }
            };
            
            this.peerConnection.onconnectionstatechange = () => {
                this.log(`连接状态: ${this.peerConnection.connectionState}`, 'info');
                if (this.peerConnection.connectionState === 'connected') {
                    this.startQualityMonitoring();
                }
            };
        }
        
        try {
            switch (signal.type) {
                case 'offer':
                    await this.peerConnection.setRemoteDescription(signal.offer);
                    const answer = await this.peerConnection.createAnswer();
                    await this.peerConnection.setLocalDescription(answer);
                    
                    this.signalingServer.sendSignal(from, {
                        type: 'answer',
                        answer: answer
                    });
                    this.remoteId = from;
                    this.log('已接受连接请求', 'success');
                    break;
                    
                case 'answer':
                    await this.peerConnection.setRemoteDescription(signal.answer);
                    this.remoteId = from;
                    break;
                    
                case 'ice-candidate':
                    await this.peerConnection.addIceCandidate(signal.candidate);
                    break;
            }
        } catch (error) {
            this.log('处理信令失败: ' + error.message, 'error');
        }
    }
    
    // 发送消息
    sendMessage() {
        const input = document.getElementById('message-input');
        const message = input.value.trim();
        
        if (!message || !this.isConnected || !this.dataChannel) {
            if (!this.isConnected) {
                this.showTemporaryMessage('未建立连接，无法发送消息');
            }
            return;
        }
        
        try {
            this.dataChannel.send(message);
            this.messageCount++;
            this.displayMessage(message, 'sent');
            input.value = '';
            document.getElementById('send-btn').disabled = true;
            this.updateConnectionQuality();
        } catch (error) {
            this.log('发送消息失败: ' + error, 'error');
            this.showTemporaryMessage('发送失败: ' + error.message);
        }
    }
    
    // 显示消息
    displayMessage(text, type) {
        const messagesContainer = document.getElementById('messages');
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        
        // 添加消息内容
        const textElement = document.createElement('div');
        textElement.textContent = text;
        messageElement.appendChild(textElement);
        
        // 添加时间戳
        const timestamp = new Date().toLocaleTimeString();
        const timeElement = document.createElement('span');
        timeElement.className = 'message-time';
        timeElement.textContent = timestamp;
        messageElement.appendChild(timeElement);
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // 显示连接成功横幅
    showConnectionSuccess() {
        const banner = document.getElementById('connection-success');
        banner.classList.add('show');
        
        // 5秒后自动隐藏
        setTimeout(() => {
            banner.classList.remove('show');
        }, 5000);
    }
    
    // 播放连接成功音效
    playConnectionSound() {
        try {
            // 创建一个简单的提示音
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
            oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
            oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.log('音频播放失败:', error);
        }
    }
    
    // 开始连接质量监控
    startQualityMonitoring() {
        this.qualityCheckInterval = setInterval(() => {
            this.updateConnectionQuality();
        }, 5000);
    }
    
    // 停止连接质量监控
    stopQualityMonitoring() {
        if (this.qualityCheckInterval) {
            clearInterval(this.qualityCheckInterval);
            this.qualityCheckInterval = null;
        }
    }
    
    // 更新连接质量显示
    updateConnectionQuality() {
        if (!this.isConnected) {
            this.connectionQuality = 'unknown';
            document.getElementById('connection-quality').textContent = '连接质量: 未知';
            document.getElementById('connection-quality').className = 'connection-quality';
            return;
        }
        
        // 模拟连接质量评估（在实际应用中应该基于真实指标）
        const qualities = [
            { level: 'excellent', text: '优秀', class: 'excellent' },
            { level: 'good', text: '良好', class: 'good' },
            { level: 'fair', text: '一般', class: 'fair' },
            { level: 'poor', text: '较差', class: 'poor' },
            { level: 'bad', text: '糟糕', class: 'bad' }
        ];
        
        // 基于消息计数简单模拟质量变化
        const qualityIndex = Math.min(Math.floor(this.messageCount / 5), qualities.length - 1);
        const quality = qualities[qualityIndex];
        
        this.connectionQuality = quality.level;
        document.getElementById('connection-quality').textContent = `连接质量: ${quality.text}`;
        document.getElementById('connection-quality').className = `connection-quality ${quality.class}`;
    }
    
    // 切换到聊天面板
    switchToChatPanel() {
        document.getElementById('connect-panel').classList.remove('active');
        document.getElementById('chat-panel').classList.add('active');
        document.getElementById('peer-name').textContent = this.remoteId;
        
        // 启用输入框
        document.getElementById('message-input').disabled = false;
        document.getElementById('send-btn').disabled = true; // 等待输入内容
    }
    
    // 切换到连接面板
    switchToConnectPanel() {
        document.getElementById('chat-panel').classList.remove('active');
        document.getElementById('connect-panel').classList.add('active');
    }
    
    // 断开连接
    disconnect() {
        if (this.dataChannel) {
            this.dataChannel.close();
        }
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        
        this.isConnected = false;
        this.dataChannel = null;
        this.peerConnection = null;
        this.messageCount = 0;
        
        this.updateStatus('离线', false);
        this.switchToConnectPanel();
        this.showTemporaryMessage('已断开连接');
        this.updateInputStatus('等待连接...', false);
        this.stopQualityMonitoring();
        
        // 清空消息并显示欢迎消息
        document.getElementById('messages').innerHTML = 
            '<div class="system-message" id="welcome-message"><p>💬 连接成功后，你可以在这里发送消息</p></div>';
        document.getElementById('remote-id').value = '';
        document.getElementById('connection-success').classList.remove('show');
        
        this.log('连接已重置', 'info');
    }
    
    // 更新状态
    updateStatus(text, isConnected) {
        const statusTextElement = document.getElementById('status-text');
        const statusIndicator = document.getElementById('status-indicator');
        
        statusTextElement.textContent = text;
        
        if (isConnected) {
            statusIndicator.classList.add('connected');
        } else {
            statusIndicator.classList.remove('connected');
        }
    }
    
    // 更新输入状态
    updateInputStatus(text, isReady) {
        const inputStatus = document.getElementById('input-status');
        inputStatus.textContent = text;
        
        if (isReady) {
            inputStatus.classList.add('ready');
        } else {
            inputStatus.classList.remove('ready');
        }
    }
    
    // 记录信令日志
    log(message, type = 'info') {
        const logContainer = document.getElementById('signaling-log');
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }
    
    // 复制到剪贴板
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showTemporaryMessage('ID已复制到剪贴板');
        }).catch(err => {
            console.error('复制失败: ', err);
            this.showTemporaryMessage('复制失败，请手动复制');
        });
    }
    
    // 显示临时消息（替换alert）
    showTemporaryMessage(text) {
        // 创建临时消息元素
        const messageElement = document.createElement('div');
        messageElement.textContent = text;
        messageElement.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000;
            font-size: 0.9rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: fadeInOut 3s ease-in-out;
        `;
        
        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                20% { opacity: 1; transform: translateX(-50%) translateY(0); }
                80% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(messageElement);
        
        // 3秒后移除
        setTimeout(() => {
            document.body.removeChild(messageElement);
            document.head.removeChild(style);
        }, 3000);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new DecentralizedMessenger();
});