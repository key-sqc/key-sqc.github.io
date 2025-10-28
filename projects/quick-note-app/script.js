/**
 * 精致便签应用 - 简化滑动交互版本
 * 只通过颜色变化提示操作，不移动列表项
 */
class ElegantNoteApp {
    constructor() {
        this.performance = {
            lastSave: 0,
            saveThreshold: 800
        };
        
        this.cache = {
            history: null,
            currentNote: ''
        };
        
        this.init();
    }
    
    init() {
        // 立即缓存DOM
        this.cacheDOM();
        
        // 显示骨架屏
        this.showSkeleton();
        
        // 使用微任务初始化
        Promise.resolve().then(() => {
            this.initializeApp();
            setTimeout(() => this.hideSkeleton(), 600);
        }).catch(error => {
            console.error('初始化失败:', error);
            this.handleInitError();
        });
    }
    
    cacheDOM() {
        // 一次性缓存所有DOM元素
        this.elements = {
            noteArea: document.getElementById('noteArea'),
            editorPage: document.getElementById('editorPage'),
            historyPage: document.getElementById('historyPage'),
            historyList: document.getElementById('historyList'),
            historyCount: document.getElementById('historyCount'),
            characterCount: document.getElementById('characterCount'),
            togglePageBtn: document.getElementById('togglePageBtn'),
            saveBtn: document.getElementById('saveBtn'),
            appContainer: document.getElementById('appContainer'),
            skeleton: document.getElementById('skeleton')
        };
    }
    
    initializeApp() {
        // 初始化状态
        this.CURRENT_NOTE_KEY = 'currentNote';
        this.HISTORY_KEY = 'noteHistory';
        this.editingIndex = null;
        this.isHistoryVisible = false;
        this.swipeThreshold = 60; // 降低阈值，更容易触发
        
        // 设置初始页面状态
        this.elements.editorPage.classList.add('active');
        
        // 加载数据
        this.loadData();
        
        // 绑定事件
        this.bindEvents();
        
        // 自动聚焦
        this.autoFocus();
    }
    
    loadData() {
        // 并行加载数据
        Promise.all([
            this.loadCurrentNote(),
            this.loadHistory()
        ]).catch(error => {
            console.error('数据加载失败:', error);
        });
    }
    
    showSkeleton() {
        if (this.elements.skeleton) {
            this.elements.skeleton.style.display = 'flex';
        }
    }
    
    hideSkeleton() {
        if (this.elements.skeleton) {
            this.elements.skeleton.style.display = 'none';
        }
        if (this.elements.appContainer) {
            this.elements.appContainer.style.opacity = '1';
        }
    }
    
    bindEvents() {
        const { togglePageBtn, saveBtn, noteArea, historyList } = this.elements;
        
        // 按钮事件
        togglePageBtn.addEventListener('click', () => this.togglePage());
        saveBtn.addEventListener('click', () => this.saveNow());
        
        // 输入事件 - 实时更新字符计数
        noteArea.addEventListener('input', () => {
            this.updateCharacterCount();
            this.debouncedSave();
        });
        
        // 页面事件
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.saveOnLeave();
        });
        
        // 触摸事件委托 - 简化滑动交互
        historyList.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        historyList.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        historyList.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
        
        // 鼠标事件支持（桌面端调试）
        historyList.addEventListener('mousedown', (e) => this.handleMouseStart(e));
        historyList.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        historyList.addEventListener('mouseup', (e) => this.handleMouseEnd(e));
        historyList.addEventListener('mouseleave', (e) => this.handleMouseEnd(e));
    }
    
    // 更新字符计数
    updateCharacterCount() {
        const length = this.elements.noteArea.value.length;
        this.elements.characterCount.textContent = `${length}字`;
        
        // 根据长度改变颜色
        if (length > 200) {
            this.elements.characterCount.style.color = '#f56565';
        } else if (length > 100) {
            this.elements.characterCount.style.color = '#ed8936';
        } else {
            this.elements.characterCount.style.color = '';
        }
    }
    
    // 性能优化的防抖函数
    debouncedSave = this.debounce(() => {
        this.saveCurrentNote();
    }, 500);
    
    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    // 触摸事件处理 - 简化滑动逻辑，只改变颜色
    handleTouchStart(e) {
        const item = e.target.closest('.history-item');
        if (!item) return;
        
        // 阻止事件冒泡，避免与点击事件冲突
        e.stopPropagation();
        
        this.currentSwipeItem = {
            element: item,
            startX: e.touches[0].clientX,
            startY: e.touches[0].clientY,
            currentX: e.touches[0].clientX,
            isSwiping: false,
            distance: 0,
            direction: null,
            startTime: Date.now()
        };
        
        // 重置状态
        item.classList.remove('swiping-left', 'swiping-right');
        item.style.transition = 'none';
    }
    
    handleTouchMove(e) {
        if (!this.currentSwipeItem) return;
        
        const { element, startX, startY } = this.currentSwipeItem;
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - startX;
        const diffY = currentY - startY;
        
        // 如果垂直滚动距离大于水平距离，则不处理滑动（允许滚动）
        if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 10) {
            this.currentSwipeItem = null;
            return;
        }
        
        this.currentSwipeItem.currentX = currentX;
        this.currentSwipeItem.distance = diffX;
        
        // 确定滑动方向
        if (Math.abs(diffX) > 10 && !this.currentSwipeItem.isSwiping) {
            this.currentSwipeItem.isSwiping = true;
            this.currentSwipeItem.direction = diffX > 0 ? 'right' : 'left';
            e.preventDefault(); // 阻止滚动
        }
        
        if (this.currentSwipeItem.isSwiping) {
            // 只改变颜色，不移动位置
            if (this.currentSwipeItem.direction === 'left') {
                // 左滑删除 - 红色背景
                element.classList.add('swiping-left');
                element.classList.remove('swiping-right');
                
            } else if (this.currentSwipeItem.direction === 'right') {
                // 右滑置顶 - 黄色背景
                element.classList.add('swiping-right');
                element.classList.remove('swiping-left');
            }
        }
    }
    
    handleTouchEnd(e) {
        if (!this.currentSwipeItem) return;
        
        const { element, isSwiping, distance, direction, startTime } = this.currentSwipeItem;
        const swipeDuration = Date.now() - startTime;
        
        if (isSwiping && Math.abs(distance) > this.swipeThreshold && swipeDuration < 500) {
            if (direction === 'left') {
                // 左滑删除
                this.deleteHistoryItemWithAnimation(element);
            } else if (direction === 'right') {
                // 右滑置顶/取消置顶
                this.togglePinHistoryItemWithAnimation(element);
            }
        } else {
            // 恢复颜色
            this.resetSwipePosition(element);
            
            // 如果没有滑动，则视为点击
            if (!isSwiping || Math.abs(distance) < 10) {
                const index = parseInt(element.dataset.index);
                this.startEditingHistory(index);
            }
        }
        
        this.currentSwipeItem = null;
    }
    
    // 鼠标事件支持（用于桌面调试）
    handleMouseStart(e) {
        if (e.button !== 0) return; // 只处理左键
        const item = e.target.closest('.history-item');
        if (!item) return;
        
        this.currentSwipeItem = {
            element: item,
            startX: e.clientX,
            startY: e.clientY,
            currentX: e.clientX,
            isSwiping: false,
            distance: 0,
            direction: null,
            startTime: Date.now(),
            isMouse: true
        };
        
        item.classList.remove('swiping-left', 'swiping-right');
        item.style.transition = 'none';
    }
    
    handleMouseMove(e) {
        if (!this.currentSwipeItem || !this.currentSwipeItem.isMouse) return;
        
        const { element, startX } = this.currentSwipeItem;
        const currentX = e.clientX;
        const diffX = currentX - startX;
        
        this.currentSwipeItem.currentX = currentX;
        this.currentSwipeItem.distance = diffX;
        
        if (Math.abs(diffX) > 10 && !this.currentSwipeItem.isSwiping) {
            this.currentSwipeItem.isSwiping = true;
            this.currentSwipeItem.direction = diffX > 0 ? 'right' : 'left';
        }
        
        if (this.currentSwipeItem.isSwiping) {
            if (this.currentSwipeItem.direction === 'left') {
                element.classList.add('swiping-left');
                element.classList.remove('swiping-right');
            } else if (this.currentSwipeItem.direction === 'right') {
                element.classList.add('swiping-right');
                element.classList.remove('swiping-left');
            }
        }
    }
    
    handleMouseEnd(e) {
        if (!this.currentSwipeItem || !this.currentSwipeItem.isMouse) return;
        
        const { element, isSwiping, distance, direction, startTime } = this.currentSwipeItem;
        const swipeDuration = Date.now() - startTime;
        
        if (isSwiping && Math.abs(distance) > this.swipeThreshold && swipeDuration < 500) {
            if (direction === 'left') {
                this.deleteHistoryItemWithAnimation(element);
            } else if (direction === 'right') {
                this.togglePinHistoryItemWithAnimation(element);
            }
        } else {
            this.resetSwipePosition(element);
            if (!isSwiping || Math.abs(distance) < 10) {
                const index = parseInt(element.dataset.index);
                this.startEditingHistory(index);
            }
        }
        
        this.currentSwipeItem = null;
    }
    
    // 重置滑动位置
    resetSwipePosition(element) {
        element.style.transition = 'background 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        element.classList.remove('swiping-left', 'swiping-right');
    }
    
    autoFocus() {
        setTimeout(() => {
            this.elements.noteArea.focus();
            const length = this.elements.noteArea.value.length;
            this.elements.noteArea.setSelectionRange(length, length);
            this.updateCharacterCount();
        }, 800);
    }
    
    togglePage() {
        this.isHistoryVisible ? this.showEditorPage() : this.showHistoryPage();
    }
    
    showEditorPage() {
        const { editorPage, historyPage, togglePageBtn, noteArea } = this.elements;
        
        historyPage.classList.remove('active');
        historyPage.classList.add('slide-out-right');
        
        editorPage.classList.remove('hidden');
        editorPage.classList.add('slide-in-left', 'active');
        
        togglePageBtn.innerHTML = '<span class="btn-icon">📚</span><span class="btn-text">笔记</span>';
        this.isHistoryVisible = false;
        
        setTimeout(() => {
            editorPage.classList.remove('slide-in-left');
            historyPage.classList.remove('slide-out-right', 'active');
            noteArea.focus();
        }, 400);
    }
    
    showHistoryPage() {
        const { editorPage, historyPage, togglePageBtn } = this.elements;
        
        this.saveCurrentContent();
        
        editorPage.classList.add('slide-out-left');
        editorPage.classList.remove('active');
        
        historyPage.classList.add('slide-in-right', 'active');
        
        togglePageBtn.innerHTML = '<span class="btn-icon">📝</span><span class="btn-text">返回</span>';
        this.isHistoryVisible = true;
        
        setTimeout(() => {
            editorPage.classList.add('hidden');
            editorPage.classList.remove('slide-out-left');
            historyPage.classList.remove('slide-in-right');
        }, 400);
    }
    
    saveCurrentContent() {
        const content = this.elements.noteArea.value.trim();
        if (!content) return;
        
        const now = Date.now();
        if (now - this.performance.lastSave < this.performance.saveThreshold) return;
        this.performance.lastSave = now;
        
        try {
            let historyArray = this.cache.history || [];
            
            if (this.editingIndex !== null) {
                // 更新现有笔记时保持置顶状态
                const wasPinned = historyArray[this.editingIndex]?.pinned || false;
                historyArray[this.editingIndex] = { 
                    content, 
                    timestamp: now,
                    pinned: wasPinned
                };
            } else {
                // 新笔记默认不置顶
                historyArray.unshift({ 
                    content, 
                    timestamp: now,
                    pinned: false
                });
                // 限制记录数量
                if (historyArray.length > 100) historyArray.length = 100;
            }
            
            // 更新缓存和存储
            this.cache.history = historyArray;
            localStorage.setItem(this.HISTORY_KEY, JSON.stringify(historyArray));
            
            this.elements.noteArea.value = '';
            this.editingIndex = null;
            this.saveCurrentNote();
            this.updateCharacterCount();
            
            this.renderHistory(historyArray);
            
        } catch (error) {
            console.error('保存失败:', error);
        }
    }
    
    saveNow() {
        const content = this.elements.noteArea.value.trim();
        if (content) {
            this.saveCurrentContent();
            this.showSaveFeedback();
        } else {
            this.showEmptyWarning();
        }
    }
    
    showSaveFeedback() {
        const originalHTML = this.elements.saveBtn.innerHTML;
        this.elements.saveBtn.innerHTML = '<span class="btn-icon">✅</span><span class="btn-text">已保存</span>';
        this.elements.saveBtn.classList.add('save-feedback');
        
        setTimeout(() => {
            this.elements.saveBtn.innerHTML = originalHTML;
            this.elements.saveBtn.classList.remove('save-feedback');
        }, 1500);
    }
    
    showEmptyWarning() {
        const originalHTML = this.elements.saveBtn.innerHTML;
        this.elements.saveBtn.innerHTML = '<span class="btn-icon">💭</span><span class="btn-text">写点什么吧</span>';
        this.elements.saveBtn.style.background = 'var(--secondary-gradient)';
        
        setTimeout(() => {
            this.elements.saveBtn.innerHTML = originalHTML;
            this.elements.saveBtn.style.background = 'var(--success-gradient)';
        }, 1200);
    }
    
    loadCurrentNote() {
        try {
            const current = localStorage.getItem(this.CURRENT_NOTE_KEY);
            if (current) {
                this.elements.noteArea.value = current;
                this.cache.currentNote = current;
            }
        } catch (error) {
            console.error('加载当前内容失败:', error);
        }
    }
    
    loadHistory() {
        try {
            const history = localStorage.getItem(this.HISTORY_KEY);
            const historyArray = history ? JSON.parse(history) : [];
            this.cache.history = historyArray;
            this.renderHistory(historyArray);
        } catch (error) {
            console.error('加载历史记录失败:', error);
        }
    }
    
    renderHistory(historyArray) {
        const { historyList, historyCount } = this.elements;
        
        // 更新计数
        const pinnedCount = historyArray.filter(item => item.pinned).length;
        const totalCount = historyArray.length;
        historyCount.textContent = `${totalCount}条记录${pinnedCount > 0 ? ` (${pinnedCount}置顶)` : ''}`;
        
        if (historyArray.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <div>还没有任何笔记记录</div>
                    <div class="hint">点击下方按钮开始记录您的第一个灵感</div>
                </div>
            `;
            return;
        }
        
        // 排序：置顶的在前，然后按时间倒序
        const sortedArray = [...historyArray].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return b.timestamp - a.timestamp;
        });
        
        // 使用DocumentFragment进行批量DOM操作
        const fragment = document.createDocumentFragment();
        
        sortedArray.forEach((item, index) => {
            const originalIndex = historyArray.findIndex(originalItem => 
                originalItem.content === item.content && originalItem.timestamp === item.timestamp
            );
            
            const div = document.createElement('div');
            div.className = `history-item ${item.pinned ? 'pinned' : ''} ${originalIndex === this.editingIndex ? 'active' : ''}`;
            div.setAttribute('data-index', originalIndex);
            
            div.innerHTML = `
                <div class="history-content">${this.escapeHtml(item.content)}</div>
                <div class="history-time">${this.formatCreateTime(item.timestamp)}</div>
            `;
            
            fragment.appendChild(div);
        });
        
        historyList.innerHTML = '';
        historyList.appendChild(fragment);
    }
    
    deleteHistoryItemWithAnimation(item) {
        const index = parseInt(item.dataset.index);
        
        item.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        item.classList.add('deleting');
        
        setTimeout(() => {
            this.deleteHistoryItem(index);
        }, 400);
    }
    
    togglePinHistoryItemWithAnimation(item) {
        const index = parseInt(item.dataset.index);
        
        item.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        item.classList.add('pinning');
        item.classList.add('pin-feedback');
        
        setTimeout(() => {
            this.togglePinHistoryItem(index);
            setTimeout(() => {
                item.classList.remove('pin-feedback');
            }, 600);
        }, 400);
    }
    
    togglePinHistoryItem(index) {
        try {
            let historyArray = this.cache.history || [];
            
            if (historyArray[index]) {
                // 切换置顶状态
                historyArray[index].pinned = !historyArray[index].pinned;
                
                this.cache.history = historyArray;
                localStorage.setItem(this.HISTORY_KEY, JSON.stringify(historyArray));
                
                this.renderHistory(historyArray);
            }
        } catch (error) {
            console.error('切换置顶状态失败:', error);
        }
    }
    
    startEditingHistory(index) {
        try {
            const historyArray = this.cache.history || [];
            
            if (historyArray[index]) {
                const item = historyArray[index];
                this.elements.noteArea.value = item.content;
                this.editingIndex = index;
                this.saveCurrentNote();
                this.updateCharacterCount();
                this.showEditorPage();
                this.renderHistory(historyArray);
            }
        } catch (error) {
            console.error('加载历史记录项失败:', error);
        }
    }
    
    saveCurrentNote() {
        try {
            const content = this.elements.noteArea.value;
            localStorage.setItem(this.CURRENT_NOTE_KEY, content);
            this.cache.currentNote = content;
        } catch (error) {
            console.error('保存当前内容失败:', error);
        }
    }
    
    saveOnLeave() {
        const content = this.elements.noteArea.value.trim();
        if (!content) return;
        
        try {
            let historyArray = this.cache.history || [];
            
            if (this.editingIndex !== null) {
                // 更新时保持置顶状态
                const wasPinned = historyArray[this.editingIndex]?.pinned || false;
                historyArray[this.editingIndex] = { 
                    content, 
                    timestamp: Date.now(),
                    pinned: wasPinned
                };
            } else {
                historyArray.unshift({ 
                    content, 
                    timestamp: Date.now(),
                    pinned: false
                });
                if (historyArray.length > 100) historyArray.length = 100;
            }
            
            this.cache.history = historyArray;
            localStorage.setItem(this.HISTORY_KEY, JSON.stringify(historyArray));
            
            this.elements.noteArea.value = '';
            this.editingIndex = null;
            this.saveCurrentNote();
            this.updateCharacterCount();
            
        } catch (error) {
            console.error('离开页面时保存失败:', error);
        }
    }
    
    deleteHistoryItem(index) {
        try {
            let historyArray = this.cache.history || [];
            historyArray.splice(index, 1);
            
            this.cache.history = historyArray;
            localStorage.setItem(this.HISTORY_KEY, JSON.stringify(historyArray));
            
            if (this.editingIndex === index) {
                this.elements.noteArea.value = '';
                this.editingIndex = null;
                this.saveCurrentNote();
                this.updateCharacterCount();
            } else if (this.editingIndex > index) {
                this.editingIndex--;
            }
            
            this.renderHistory(historyArray);
            
        } catch (error) {
            console.error('删除记录失败:', error);
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatCreateTime(timestamp) {
        const createDate = new Date(timestamp);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const createDay = new Date(createDate.getFullYear(), createDate.getMonth(), createDate.getDate());
        
        // 时间部分始终显示
        const timeStr = createDate.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        
        // 判断日期部分
        if (createDay.getTime() === today.getTime()) {
            return `今天 ${timeStr}`;
        } else if (createDay.getTime() === yesterday.getTime()) {
            return `昨天 ${timeStr}`;
        } else if (now - createDate < 7 * 24 * 60 * 60 * 1000) {
            // 一周内显示星期几
            const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            const weekday = weekdays[createDate.getDay()];
            return `周${weekday} ${timeStr}`;
        } else if (createDate.getFullYear() === now.getFullYear()) {
            // 今年显示月日
            const month = createDate.getMonth() + 1;
            const day = createDate.getDate();
            return `${month}月${day}日 ${timeStr}`;
        } else {
            // 其他年份显示完整日期
            const year = createDate.getFullYear();
            const month = createDate.getMonth() + 1;
            const day = createDate.getDate();
            return `${year}年${month}月${day}日 ${timeStr}`;
        }
    }
    
    handleInitError() {
        if (this.elements.skeleton) {
            this.elements.skeleton.innerHTML = `
                <div style="padding: 60px 28px; text-align: center; background: white; border-radius: 24px;">
                    <div style="font-size: 64px; margin-bottom: 20px;">😔</div>
                    <div style="color: #2d3748; font-size: 18px; margin-bottom: 8px;">加载失败</div>
                    <div style="color: #718096; font-size: 15px; margin-bottom: 24px;">请刷新页面重试</div>
                    <button onclick="window.location.reload()" style="padding: 14px 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 16px; cursor: pointer; font-size: 16px; font-weight: 600;">
                        重新加载
                    </button>
                </div>
            `;
        }
    }
}

// 错误边界
window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
});

// 使用DOMContentLoaded确保DOM就绪
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ElegantNoteApp();
    });
} else {
    new ElegantNoteApp();
}