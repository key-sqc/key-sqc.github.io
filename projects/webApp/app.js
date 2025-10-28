// app.js - 修复二维码显示问题
class DecentralizedMessenger {
    constructor() {
        this.peerConnection = null;
        this.dataChannel = null;
        this.localId = this.generateId();
        this.remoteId = '';
        this.isConnected = false;
        this.connectionStartTime = null;
        this.messageCount = 0;
        this.connectionQuality = 'unknown';
        this.qualityCheckInterval = null;
        
        this.initializeApp();
        this.setupEventListeners();
        this.generateQRCode(); // 确保调用生成二维码
        this.setupSignaling();
    }
    
    // 生成随机ID
    generateId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    
    // 设置基于 localStorage 的信令系统
    setupSignaling() {
        // 监听 localStorage 变化来接收信令
        window.addEventListener('storage', (e) => {
            if (e.key === 'webrtc-signaling' && e.newValue) {
                try {
                    const signal = JSON.parse(e.newValue);
                    // 只处理发给自己的信令
                    if (signal.to === this.localId || signal.to === 'broadcast') {
                        this.log(`收到来自 ${signal.from} 的信令: ${signal.type}`, 'info');
                        this.handleSignaling(signal.from, signal.data);
                    }
                } catch (error) {
                    console.error('解析信令失败:', error);
                }
            }
        });
    }
    
    // 发送信令
    sendSignal(to, data) {
        const signal = {
            from: this.localId,
            to: to,
            type: data.type,
            data: data,
            timestamp: Date.now()
        };
        
        this.log(`发送信令到 ${to}: ${data.type}`, 'info');
        
        // 使用 localStorage 作为信令通道
        localStorage.setItem('webrtc-signaling', JSON.stringify(signal));
    }
    
    // 初始化应用
    initializeApp() {
        document.getElementById('peer-id').value = this.localId;
        this.updateStatus('离线', false);
        this.updateInputStatus('等待连接...', false);
        
        // 清理之前的信令数据
        localStorage.removeItem('webrtc-signaling');
    }
    
    // 设置事件监听
    setupEventListeners() {
        document.getElementById('copy-id').addEventListener('click', () => {
            this.copyToClipboard(this.localId);
            this.showTemporaryMessage('ID已复制到剪贴板');
        });
        
        document.getElementById('connect-btn').addEventListener('click', () => {
            this.remoteId = document.getElementById('remote-id').value.trim().toUpperCase();
            if (this.remoteId) {
                if (this.remoteId === this.localId) {
                    this.showTemporaryMessage('不能连接自己！');
                    return;
                }
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
    
    // 生成二维码 - 修复这个方法
    generateQRCode() {
        try {
            const qrData = JSON.stringify({
                type: 'decentralized-messenger',
                id: this.localId,
                version: '1.0',
                timestamp: Date.now()
            });
            
            // 使用 qrcode-generator 库
            const typeNumber = 0; // 自动类型
            const errorCorrectionLevel = 'L';
            const qr = qrcode(typeNumber, errorCorrectionLevel);
            qr.addData(qrData);
            qr.make();
            
            const qrContainer = document.getElementById('qrcode');
            if (qrContainer) {
                qrContainer.innerHTML = qr.createImgTag(4, 0); // 大小4px，边距0
                
                // 添加样式让二维码居中
                const qrImage = qrContainer.querySelector('img');
                if (qrImage) {
                    qrImage.style.display = 'block';
                    qrImage.style.margin = '0 auto';
                    qrImage.style.border = '1px solid #ddd';
                    qrImage.style.borderRadius = '8px';
                }
            } else {
                console.error('找不到二维码容器元素');
            }
        } catch (error) {
            console.error('生成二维码失败:', error);
            // 降级方案：显示文本ID
            const qrContainer = document.getElementById('qrcode');
            if (qrContainer) {
                qrContainer.innerHTML = `
                    <div style="text-align: center; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                        <p>ID: <strong>${this.localId}</strong></p>
                        <p style="color: #666; font-size: 0.9em;">二维码生成失败</p>
                    </div>
                `;
            }
        }
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
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }
                ]
            });
            
            // 设置数据通道
            this.setupDataChannel();
            
            // 监听ICE候选
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.sendSignal(this.remoteId, {
                        type: 'ice-candidate',
                        candidate: event.candidate
                    });
                }
            };
            
            // 监听连接状态变化
            this.peerConnection.onconnectionstatechange = () => {
                const state = this.peerConnection.connectionState;
                this.log(`连接状态: ${state}`, 'info');
                
                if (state === 'connected') {
                    this.handleConnectionSuccess();
                } else if (state === 'failed' || state === 'disconnected') {
                    this.log('连接失败，尝试重新连接...', 'warning');
                    setTimeout(() => {
                        if (!this.isConnected) {
                            this.initiateConnection();
                        }
                    }, 2000);
                }
            };
            
            // 创建offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.sendSignal(this.remoteId, {
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
            this.log('已接受对方的数据通道', 'success');
        };
    }
    
    // 设置数据通道事件
    setupDataChannelEvents(channel) {
        channel.onopen = () => {
            this.handleConnectionSuccess();
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
            this.updateStats();
        };
        
        channel.onerror = (error) => {
            this.log('数据通道错误: ' + error, 'error');
        };
    }
    
    // 处理连接成功
    handleConnectionSuccess() {
        const connectionTime = Date.now() - this.connectionStartTime;
        this.log(`P2P连接已建立! 耗时: ${connectionTime}ms`, 'success');
        this.isConnected = true;
        this.updateStatus('已连接', true);
        this.switchToChatPanel();
        this.showConnectionSuccess();
        this.updateInputStatus('可以发送消息了!', true);
        this.playConnectionSound();
        this.startQualityMonitoring();
        
        // 隐藏欢迎消息
        const welcomeMessage = document.getElementById('welcome-message');
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }
    }
    
    // 处理信令消息
    async handleSignaling(from, signal) {
        // 如果是连接请求，设置远程ID
        if (signal.type === 'offer' && !this.remoteId) {
            this.remoteId = from;
            this.log(`收到来自 ${from} 的连接请求`, 'success');
        }
        
        if (!this.peerConnection) {
            this.connectionStartTime = Date.now();
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }
                ]
            });
            
            this.setupDataChannel();
            
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.sendSignal(from, {
                        type: 'ice-candidate',
                        candidate: event.candidate
                    });
                }
            };
            
            this.peerConnection.onconnectionstatechange = () => {
                this.log(`连接状态: ${this.peerConnection.connectionState}`, 'info');
                if (this.peerConnection.connectionState === 'connected') {
                    this.handleConnectionSuccess();
                }
            };
        }
        
        try {
            switch (signal.type) {
                case 'offer':
                    await this.peerConnection.setRemoteDescription(signal.offer);
                    const answer = await this.peerConnection.createAnswer();
                    await this.peerConnection.setLocalDescription(answer);
                    
                    this.sendSignal(from, {
                        type: 'answer',
                        answer: answer
                    });
                    this.log('已回复连接请求', 'success');
                    break;
                    
                case 'answer':
                    await this.peerConnection.setRemoteDescription(signal.answer);
                    this.log('已处理连接应答', 'success');
                    break;
                    
                case 'ice-candidate':
                    await this.peerConnection.addIceCandidate(signal.candidate);
                    this.log('已添加ICE候选', 'info');
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
            this.updateStats();
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
        textElement.className = 'message-text';
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
        if (banner) {
            banner.classList.add('show');
            
            // 5秒后自动隐藏
            setTimeout(() => {
                banner.classList.remove('show');
            }, 5000);
        }
    }
    
    // 播放连接成功音效
    playConnectionSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);
            
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
            const qualityElement = document.getElementById('connection-quality');
            if (qualityElement) {
                qualityElement.className = 'quality-indicator';
            }
            return;
        }
        
        // 简单的连接质量评估
        let qualityClass = 'quality-poor';
        
        if (this.messageCount > 20) {
            qualityClass = 'quality-good';
        } else if (this.messageCount > 10) {
            qualityClass = 'quality-medium';
        }
        
        this.connectionQuality = qualityClass;
        const qualityElement = document.getElementById('connection-quality');
        if (qualityElement) {
            qualityElement.className = `quality-indicator ${qualityClass}`;
        }
    }
    
    // 更新统计信息
    updateStats() {
        const messageCountElement = document.getElementById('message-count');
        if (messageCountElement) {
            messageCountElement.textContent = this.messageCount;
        }
        
        const connectionTimeElement = document.getElementById('connection-time');
        if (connectionTimeElement && this.connectionStartTime) {
            const seconds = Math.floor((Date.now() - this.connectionStartTime) / 1000);
            connectionTimeElement.textContent = `${seconds}s`;
        }
    }
    
    // 切换到聊天面板
    switchToChatPanel() {
        document.getElementById('connection-panel').classList.add('hidden');
        document.getElementById('chat-panel').classList.remove('hidden');
        document.getElementById('remote-peer-id').textContent = this.remoteId;
        
        // 启用输入框
        const messageInput = document.getElementById('message-input');
        messageInput.disabled = false;
        messageInput.focus();
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
        this.remoteId = '';
        this.messageCount = 0;
        
        this.updateStatus('离线', false);
        document.getElementById('connection-panel').classList.remove('hidden');
        document.getElementById('chat-panel').classList.add('hidden');
        this.showTemporaryMessage('已断开连接');
        this.updateInputStatus('等待连接...', false);
        this.stopQualityMonitoring();
        this.updateStats();
        
        // 显示欢迎消息
        const welcomeMessage = document.getElementById('welcome-message');
        if (welcomeMessage) {
            welcomeMessage.style.display = 'block';
        }
        
        document.getElementById('remote-id').value = '';
        const successBanner = document.getElementById('connection-success');
        if (successBanner) {
            successBanner.classList.remove('show');
        }
        
        this.log('连接已重置', 'info');
    }
    
    // 更新状态
    updateStatus(text, isConnected) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = text;
            
            if (isConnected) {
                statusElement.className = 'status-connected';
            } else {
                statusElement.className = 'status-offline';
            }
        }
    }
    
    // 更新输入状态
    updateInputStatus(text, isReady) {
        const inputStatus = document.getElementById('input-status');
        if (inputStatus) {
            inputStatus.textContent = text;
            
            if (isReady) {
                inputStatus.style.color = '#2ecc71';
            } else {
                inputStatus.style.color = '#e74c3c';
            }
        }
    }
    
    // 记录日志
    log(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
    
    // 复制到剪贴板
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showTemporaryMessage('ID已复制到剪贴板');
        }).catch(err => {
            console.error('复制失败: ', err);
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showTemporaryMessage('ID已复制到剪贴板');
        });
    }
    
    // 显示临时消息
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
        
        document.body.appendChild(messageElement);
        
        // 3秒后移除
        setTimeout(() => {
            if (document.body.contains(messageElement)) {
                document.body.removeChild(messageElement);
            }
        }, 3000);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new DecentralizedMessenger();
});