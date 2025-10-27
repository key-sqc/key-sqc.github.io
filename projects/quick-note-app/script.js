class QuickNoteApp {
    constructor() {
        this.noteArea = document.getElementById('noteArea');
        this.editorPage = document.getElementById('editorPage');
        this.historyPage = document.getElementById('historyPage');
        this.historyList = document.getElementById('historyList');
        this.togglePageBtn = document.getElementById('togglePageBtn');
        this.saveBtn = document.getElementById('saveBtn');
        
        this.CURRENT_NOTE_KEY = 'currentNote';
        this.HISTORY_KEY = 'noteHistory';
        this.editingIndex = null;
        this.isHistoryVisible = false;
        
        // 滑动删除相关变量
        this.touchStartX = 0;
        this.isSwiping = false;
        this.swipeThreshold = 60;
        
        this.init();
    }
    
    init() {
        // 加载当前编辑内容和历史记录
        this.loadCurrentNote();
        this.loadHistory();
        
        // 绑定事件
        this.togglePageBtn.addEventListener('click', () => this.togglePage());
        this.saveBtn.addEventListener('click', () => this.saveNow());
        
        // 自动聚焦
        this.autoFocus();
        
        // 页面事件监听
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveOnLeave();
            }
        });
        
        window.addEventListener('beforeunload', () => this.saveOnLeave());
        
        console.log('便签应用已初始化');
    }
    
    autoFocus() {
        setTimeout(() => {
            this.noteArea.focus();
            const length = this.noteArea.value.length;
            this.noteArea.setSelectionRange(length, length);
        }, 400);
    }
    
    togglePage() {
        if (this.isHistoryVisible) {
            // 切换到输入页面
            this.showEditorPage();
        } else {
            // 切换到历史页面
            this.showHistoryPage();
        }
    }
    
    showEditorPage() {
        this.editorPage.classList.remove('hidden');
        this.editorPage.classList.add('sliding-down');
        this.togglePageBtn.textContent = '灵感';
        this.isHistoryVisible = false;
        
        // 动画结束后移除动画类
        setTimeout(() => {
            this.editorPage.classList.remove('sliding-down');
            this.noteArea.focus();
        }, 400);
    }
    
    showHistoryPage() {
        this.editorPage.classList.add('sliding-up');
        this.togglePageBtn.textContent = '返回';
        this.isHistoryVisible = true;
        
        // 动画结束后隐藏输入页面
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
    
    loadCurrentNote() {
        try {
            const current = localStorage.getItem(this.CURRENT_NOTE_KEY);
            if (current) {
                this.noteArea.value = current;
            }
        } catch (error) {
            console.error('加载当前内容失败:', error);
        }
    }
    
    loadHistory() {
        try {
            const history = localStorage.getItem(this.HISTORY_KEY);
            const historyArray = history ? JSON.parse(history) : [];
            this.renderHistory(historyArray);
        } catch (error) {
            console.error('加载历史记录失败:', error);
        }
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
        
        // 添加触摸事件
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
                
                // 切换回输入页面
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

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    app = new QuickNoteApp();
});