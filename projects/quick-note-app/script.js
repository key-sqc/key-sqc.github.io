class QuickNoteApp {
    constructor() {
        this.noteArea = document.getElementById('noteArea');
        this.editorPage = document.getElementById('editorPage');
        this.historyPage = document.getElementById('historyPage');
        this.historyList = document.getElementById('historyList');
        this.togglePageBtn = document.getElementById('togglePageBtn');
        this.saveBtn = document.getElementById('saveBtn');
        this.loadingElement = document.getElementById('loading');
        this.appContent = document.querySelector('.app-content');
        
        this.CURRENT_NOTE_KEY = 'currentNote';
        this.HISTORY_KEY = 'noteHistory';
        this.editingIndex = null;
        this.isHistoryVisible = false;
        
        this.touchStartX = 0;
        this.isSwiping = false;
        this.swipeThreshold = 60;
        
        // 预加载数据
        this.preloadData().then(() => {
            this.init();
        });
    }
    
    // 预加载数据
    async preloadData() {
        try {
            // 并行加载所有数据
            await Promise.all([
                this.loadCurrentNote(),
                this.loadHistory()
            ]);
        } catch (error) {
            console.error('预加载数据失败:', error);
        }
    }
    
    async loadCurrentNote() {
        return new Promise((resolve) => {
            try {
                const current = localStorage.getItem(this.CURRENT_NOTE_KEY);
                if (current) {
                    this.noteArea.value = current;
                }
                resolve();
            } catch (error) {
                console.error('加载当前内容失败:', error);
                resolve();
            }
        });
    }
    
    async loadHistory() {
        return new Promise((resolve) => {
            try {
                const history = localStorage.getItem(this.HISTORY_KEY);
                const historyArray = history ? JSON.parse(history) : [];
                this.renderHistory(historyArray);
                resolve();
            } catch (error) {
                console.error('加载历史记录失败:', error);
                resolve();
            }
        });
    }
    
    init() {
        // 隐藏加载动画，显示内容
        this.hideLoading();
        
        // 绑定事件
        this.togglePageBtn.addEventListener('click', () => this.togglePage());
        this.saveBtn.addEventListener('click', () => this.saveNow());
        
        // 首次进入时强制弹出键盘
        this.forceShowKeyboard();
        
        // 页面事件监听
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveOnLeave();
            } else {
                // 当页面重新可见时，重新聚焦
                setTimeout(() => {
                    if (!this.isHistoryVisible) {
                        this.noteArea.focus();
                    }
                }, 100);
            }
        });
        
        window.addEventListener('beforeunload', () => this.saveOnLeave());
        
        console.log('便签应用已初始化');
    }
    
    hideLoading() {
        if (this.loadingElement && this.appContent) {
            setTimeout(() => {
                this.loadingElement.style.opacity = '0';
                this.appContent.classList.add('loaded');
                
                setTimeout(() => {
                    this.loadingElement.style.display = 'none';
                    // 加载完成后确保键盘弹出
                    if (!this.isHistoryVisible) {
                        this.forceShowKeyboard();
                    }
                }, 300);
            }, 500);
        }
    }
    
    // 强制显示键盘的方法
    forceShowKeyboard() {
        if (this.isHistoryVisible) return;
        
        console.log('强制显示键盘');
        
        // 方法1: 直接聚焦并触发点击
        this.noteArea.focus();
        
        // 方法2: 设置光标位置
        const length = this.noteArea.value.length;
        this.noteArea.setSelectionRange(length, length);
        
        // 方法3: 触发虚拟键盘（如果支持）
        this.triggerKeyboard();
        
        // 方法4: 延迟再次尝试（应对某些浏览器的限制）
        setTimeout(() => {
            this.noteArea.focus();
            this.noteArea.click();
        }, 800);
    }
    
    // 触发键盘显示
    triggerKeyboard() {
        // 尝试使用虚拟键盘 API
        if ('virtualKeyboard' in navigator) {
            try {
                navigator.virtualKeyboard.show();
                console.log('使用虚拟键盘 API');
            } catch (e) {
                console.log('虚拟键盘 API 不可用');
            }
        }
        
        // 尝试通过创建临时输入框来触发键盘
        this.createTempInput();
    }
    
    // 创建临时输入框来触发键盘
    createTempInput() {
        const tempInput = document.createElement('input');
        tempInput.style.position = 'absolute';
        tempInput.style.top = '-100px';
        tempInput.style.left = '0';
        tempInput.style.height = '0';
        tempInput.style.opacity = '0';
        document.body.appendChild(tempInput);
        
        tempInput.focus();
        
        setTimeout(() => {
            this.noteArea.focus();
            document.body.removeChild(tempInput);
        }, 100);
    }
    
    togglePage() {
        if (this.isHistoryVisible) {
            this.showEditorPage();
        } else {
            this.showHistoryPage();
        }
    }
    
    showEditorPage() {
        this.editorPage.classList.remove('hidden');
        this.editorPage.classList.add('sliding-down');
        this.togglePageBtn.textContent = '灵感';
        this.isHistoryVisible = false;
        
        setTimeout(() => {
            this.editorPage.classList.remove('sliding-down');
            // 返回编辑页面时强制弹出键盘
            this.forceShowKeyboard();
        }, 400);
    }
    
    showHistoryPage() {
        this.editorPage.classList.add('sliding-up');
        this.togglePageBtn.textContent = '返回';
        this.isHistoryVisible = true;
        
        setTimeout(() => {
            this.editorPage.classList.add('hidden');
            this.editorPage.classList.remove('sliding-up');
        }, 400);
    }
    
    saveNow() {
        const content = this.noteArea.value.trim();
        if (content) {
            this.saveOnLeave();
            this.showSaveFeedback();
        }
    }
    
    showSaveFeedback() {
        const originalText = this.saveBtn.textContent;
        this.saveBtn.textContent = '已保存';
        this.saveBtn.style.background = '#52c41a';
        
        setTimeout(() => {
            this.saveBtn.textContent = originalText;
            this.saveBtn.style.background = '#007bff';
        }, 1500);
    }
    
    renderHistory(historyArray) {
        if (historyArray.length === 0) {
            this.historyList.innerHTML = '<div class="empty-state">暂无灵感记录</div>';
            return;
        }
        
        this.historyList.innerHTML = historyArray.map((item, index) => `
            <div class="history-item ${index === this.editingIndex ? 'active' : ''}" data-index="${index}">
                <div class="history-content">${this.escapeHtml(item.content)}</div>
                <div class="history-time">${this.formatTime(item.timestamp)}</div>
                <div class="delete-hint">删除</div>
            </div>
        `).join('');
        
        this.addSwipeEvents();
    }
    
    addSwipeEvents() {
        const items = this.historyList.querySelectorAll('.history-item');
        
        items.forEach(item => {
            let startX = 0;
            let currentX = 0;
            let isSwiping = false;
            
            const onTouchStart = (e) => {
                startX = e.touches[0].clientX;
                currentX = startX;
                isSwiping = false;
                item.classList.remove('swiping');
            };
            
            const onTouchMove = (e) => {
                if (!startX) return;
                
                currentX = e.touches[0].clientX;
                const diffX = startX - currentX;
                
                if (Math.abs(diffX) > 10) {
                    e.preventDefault();
                    isSwiping = true;
                    
                    if (diffX > 0) {
                        const translateX = Math.min(diffX, 100);
                        item.style.transform = `translateX(-${translateX}px)`;
                        
                        if (diffX > this.swipeThreshold) {
                            item.classList.add('swiping');
                        } else {
                            item.classList.remove('swiping');
                        }
                    }
                }
            };
            
            const onTouchEnd = (e) => {
                if (!startX) return;
                
                const diffX = startX - currentX;
                
                if (isSwiping && diffX > this.swipeThreshold) {
                    this.deleteHistoryItemWithAnimation(item);
                } else {
                    item.style.transform = 'translateX(0)';
                    item.classList.remove('swiping');
                    
                    if (!isSwiping) {
                        const index = parseInt(item.dataset.index);
                        this.startEditingHistory(index);
                    }
                }
                
                startX = 0;
                isSwiping = false;
            };
            
            item.addEventListener('touchstart', onTouchStart, { passive: true });
            item.addEventListener('touchmove', onTouchMove, { passive: false });
            item.addEventListener('touchend', onTouchEnd, { passive: true });
        });
    }
    
    deleteHistoryItemWithAnimation(item) {
        const index = parseInt(item.dataset.index);
        
        item.classList.add('deleting');
        
        setTimeout(() => {
            this.deleteHistoryItem(index);
        }, 300);
    }
    
    startEditingHistory(index) {
        try {
            const history = localStorage.getItem(this.HISTORY_KEY);
            const historyArray = history ? JSON.parse(history) : [];
            
            if (historyArray[index]) {
                const item = historyArray[index];
                
                this.noteArea.value = item.content;
                this.editingIndex = index;
                this.saveCurrentNote();
                
                this.showEditorPage();
                
                this.renderHistory(historyArray);
            }
        } catch (error) {
            console.error('加载历史记录项失败:', error);
        }
    }
    
    saveCurrentNote() {
        try {
            const content = this.noteArea.value;
            localStorage.setItem(this.CURRENT_NOTE_KEY, content);
        } catch (error) {
            console.error('保存当前内容失败:', error);
        }
    }
    
    saveOnLeave() {
        const content = this.noteArea.value.trim();
        if (!content) return;
        
        try {
            const history = localStorage.getItem(this.HISTORY_KEY);
            const historyArray = history ? JSON.parse(history) : [];
            
            if (this.editingIndex !== null) {
                historyArray[this.editingIndex] = {
                    content: content,
                    timestamp: Date.now()
                };
                console.log('已更新记录');
            } else {
                const newRecord = {
                    content: content,
                    timestamp: Date.now()
                };
                
                historyArray.unshift(newRecord);
                
                if (historyArray.length > 50) {
                    historyArray.splice(50);
                }
                console.log('已创建新记录');
            }
            
            localStorage.setItem(this.HISTORY_KEY, JSON.stringify(historyArray));
            
            this.noteArea.value = '';
            this.editingIndex = null;
            this.saveCurrentNote();
            
            this.renderHistory(historyArray);
            
        } catch (error) {
            console.error('保存内容失败:', error);
        }
    }
    
    deleteHistoryItem(index) {
        try {
            const history = localStorage.getItem(this.HISTORY_KEY);
            const historyArray = history ? JSON.parse(history) : [];
            
            historyArray.splice(index, 1);
            
            localStorage.setItem(this.HISTORY_KEY, JSON.stringify(historyArray));
            
            if (this.editingIndex === index) {
                this.noteArea.value = '';
                this.editingIndex = null;
                this.saveCurrentNote();
            } else if (this.editingIndex > index) {
                this.editingIndex--;
            }
            
            this.renderHistory(historyArray);
            
            console.log('已删除记录');
        } catch (error) {
            console.error('删除记录失败:', error);
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) {
            return '刚刚';
        } else if (diff < 3600000) {
            return `${Math.floor(diff / 60000)}分钟前`;
        } else if (diff < 86400000) {
            return `${Math.floor(diff / 3600000)}小时前`;
        } else {
            return date.toLocaleDateString();
        }
    }
}

// 全局实例
let app;

// 使用最快的初始化方式
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new QuickNoteApp();
    });
} else {
    // DOM 已经就绪，立即初始化
    app = new QuickNoteApp();
}