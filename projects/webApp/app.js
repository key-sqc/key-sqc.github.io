// app.js
class DecentralizedMessenger {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.localId = this.generateId();
        this.remoteId = '';
        this.isConnected = false;
        
        this.initializeApp();
        this.setupEventListeners();
        this.generateQRCode();
    }
    
    // 生成随机ID
    generateId() {
        return Math.random().toString(36).substring(2, 10);
    }
    
    // 初始化应用
    initializeApp() {
        document.getElementById('peer-id').value = this.localId;
        this.updateStatus('离线', false);
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
                this.connectToPeer();
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
            id: this.localId
        }));
        qr.make();
        
        const qrContainer = document.getElementById('qrcode');
        qrContainer.innerHTML = qr.createImgTag(4);
    }
    
    // 连接到对等节点
    connectToPeer() {
        this.showMessage('正在连接...');
        
        // 模拟连接过程
        setTimeout(() => {
            this.switchToChatPanel();
            this.updateStatus('已连接', true);
            this.isConnected = true;
            this.showMessage('连接成功！现在可以开始聊天了');
        }, 1500);
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
    
    // 发送消息
    sendMessage() {
        const input = document.getElementById('message-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        // 在实际实现中，这里会通过WebRTC发送消息
        this.displayMessage(message, 'sent');
        input.value = '';
        
        // 模拟对方回复
        if (this.isConnected) {
            setTimeout(() => {
                this.displayMessage('这是一个模拟回复消息', 'received');
            }, 1000);
        }
    }
    
    // 显示消息
    displayMessage(text, type) {
        const messagesContainer = document.getElementById('messages');
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = text;
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // 断开连接
    disconnect() {
        this.isConnected = false;
        this.updateStatus('离线', false);
        this.switchToConnectPanel();
        this.showMessage('已断开连接');
        
        // 清空消息
        document.getElementById('messages').innerHTML = '';
        document.getElementById('remote-id').value = '';
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
    
    // 复制到剪贴板
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error('复制失败: ', err);
        });
    }
    
    // 显示临时消息
    showMessage(text) {
        // 在实际实现中，这里可以添加一个更优雅的消息提示
        alert(text);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new DecentralizedMessenger();
});