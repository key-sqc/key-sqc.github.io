// app.js - 完整的WebRTC实现
class DecentralizedMessenger {
    constructor() {
        this.peerConnection = null;
        this.dataChannel = null;
        this.localId = this.generateId();
        this.remoteId = '';
        this.isConnected = false;
        this.signalingServer = this.createSignalingServer();
        
        this.initializeApp();
        this.setupEventListeners();
        this.generateQRCode();
    }
    
    // 生成随机ID
    generateId() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    
    // 模拟信令服务器（在实际应用中需要真实服务器）
    createSignalingServer() {
        // 这里使用localStorage模拟信令交换
        // 在实际部署中，需要使用WebSocket服务器
        return {
            sendSignal: (to, signal) => {
                this.log(`发送信令到 ${to}: ${signal.type}`, 'info');
                // 模拟网络延迟
                setTimeout(() => {
                    if (typeof window !== 'undefined' && window.receiveSignal) {
                        window.receiveSignal(this.localId, signal);
                    }
                }, 500);
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
        
        // 监听信令
        this.signalingServer.listen((from, signal) => {
            this.handleSignaling(from, signal);
        });
    }
    
    // 设置事件监听
    setupEventListeners() {
        document.getElementById('copy-id').addEventListener('click', () => {
            this.copyToClipboard(this.localId);
            this.showMessage('ID已复制到剪贴板');
        });
        
        document.getElementById('connect-btn').addEventListener('click', () => {
            this.remoteId = document.getElementById('remote-id').value.trim();
            if (this.remoteId) {
                this.initiateConnection();
            } else {
                this.showMessage('请输入对方ID');
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
    }
    
    // 生成二维码
    generateQRCode() {
        const qr = qrcode(0, 'M');
        qr.addData(JSON.stringify({
            type: 'decentralized-messenger',
            id: this.localId,
            version: '1.0'
        }));
        qr.make();
        
        const qrContainer = document.getElementById('qrcode');
        qrContainer.innerHTML = qr.createImgTag(4);
    }
    
    // 初始化连接
    async initiateConnection() {
        this.log('开始建立P2P连接...', 'info');
        
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
            
            // 创建offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.signalingServer.sendSignal(this.remoteId, {
                type: 'offer',
                offer: offer
            });
            
            this.log('已发送连接邀请', 'success');
            
        } catch (error) {
            this.log('创建连接失败: ' + error.message, 'error');
            this.showMessage('连接失败: ' + error.message);
        }
    }
    
    // 设置数据通道
    setupDataChannel() {
        // 创建数据通道
        this.dataChannel = this.peerConnection.createDataChannel('chat', {
            ordered: true
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
            this.log('P2P连接已建立!', 'success');
            this.isConnected = true;
            this.updateStatus('已连接', true);
            this.switchToChatPanel();
            this.showMessage('连接成功！现在可以开始聊天了');
        };
        
        channel.onclose = () => {
            this.log('连接已关闭', 'warning');
            this.isConnected = false;
            this.updateStatus('离线', false);
            this.showMessage('连接已断开');
        };
        
        channel.onmessage = (event) => {
            this.displayMessage(event.data, 'received');
        };
        
        channel.onerror = (error) => {
            this.log('数据通道错误: ' + error, 'error');
        };
    }
    
    // 处理信令消息
    async handleSignaling(from, signal) {
        if (!this.peerConnection) {
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
                    this.log('已回复连接请求', 'success');
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
                this.showMessage('未建立连接，无法发送消息');
            }
            return;
        }
        
        try {
            this.dataChannel.send(message);
            this.displayMessage(message, 'sent');
            input.value = '';
        } catch (error) {
            this.log('发送消息失败: ' + error, 'error');
            this.showMessage('发送失败: ' + error.message);
        }
    }
    
    // 显示消息
    displayMessage(text, type) {
        const messagesContainer = document.getElementById('messages');
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = text;
        
        // 添加时间戳
        const timestamp = new Date().toLocaleTimeString();
        const timeElement = document.createElement('div');
        timeElement.className = 'message-time';
        timeElement.textContent = timestamp;
        timeElement.style.fontSize = '0.7rem';
        timeElement.style.opacity = '0.7';
        timeElement.style.marginTop = '5px';
        
        messageElement.appendChild(timeElement);
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // 切换到聊天面板
    switchToChatPanel() {
        document.getElementById('connect-panel').classList.remove('active');
        document.getElementById('chat-panel').classList.add('active');
        document.getElementById('peer-name').textContent = this.remoteId;
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
        
        this.updateStatus('离线', false);
        this.switchToConnectPanel();
        this.showMessage('已断开连接');
        
        // 清空消息
        document.getElementById('messages').innerHTML = '';
        document.getElementById('remote-id').value = '';
        this.log('连接已重置', 'info');
    }
    
    // 更新状态
    updateStatus(text, isConnected) {
        const statusElement = document.getElementById('status');
        statusElement.textContent = text;
        
        if (isConnected) {
            statusElement.classList.add('connected');
        } else {
            statusElement.classList.remove('connected');
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
        navigator.clipboard.writeText(text).catch(err => {
            console.error('复制失败: ', err);
        });
    }
    
    // 显示临时消息
    showMessage(text) {
        // 简单的alert，可以替换为更优雅的toast
        alert(text);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new DecentralizedMessenger();
});