class QuickNoteApp {
    constructor() {
        this.noteArea = document.getElementById('noteArea');
        this.status = document.getElementById('status');
        this.clearBtn = document.getElementById('clearBtn');
        this.saveBtn = document.getElementById('saveBtn');
        this.charCount = document.getElementById('charCount');
        this.wordCount = document.getElementById('wordCount');
        
        this.STORAGE_KEY = 'quickNoteData';
        this.autoSaveTimer = null;
        
        this.init();
    }
    
    init() {
        // 加载保存的内容
        this.loadNote();
        
        // 绑定事件
        this.noteArea.addEventListener('input', () => {
            this.updateStats();
            this.autoSave();
        });
        
        this.clearBtn.addEventListener('click', () => this.clearNote());
        this.saveBtn.addEventListener('click', () => this.saveNote());
        
        // 自动聚焦并弹出键盘
        this.autoFocus();
        
        // 页面可见性变化时保存（切换应用时）
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveNote();
            } else {
                // 当页面重新可见时，重新聚焦
                setTimeout(() => this.noteArea.focus(), 100);
            }
        });
        
        // 页面卸载前保存
        window.addEventListener('beforeunload', () => this.saveNote());
        
        // 点击页面任意位置都聚焦到输入框
        document.addEventListener('click', (e) => {
            if (e.target !== this.noteArea && e.target !== this.clearBtn && e.target !== this.saveBtn) {
                this.noteArea.focus();
            }
        });
        
        // 初始化统计
        this.updateStats();
        this.updateStatus('应用已就绪', 'success');
        
        console.log('快速便签应用已初始化');
    }
    
    autoFocus() {
        // 延迟聚焦确保页面完全加载
        setTimeout(() => {
            this.noteArea.focus();
            
            // 移动端特殊处理：尝试触发键盘
            if ('virtualKeyboard' in navigator) {
                // 新的虚拟键盘API
                navigator.virtualKeyboard.show();
            }
            
            // 强制滚动到输入框（移动端优化）
            this.noteArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // 设置光标到文本末尾
            const length = this.noteArea.value.length;
            this.noteArea.setSelectionRange(length, length);
            
            console.log('输入框已自动聚焦');
        }, 300); // 适当延迟确保页面渲染完成
    }
    
    loadNote() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                this.noteArea.value = saved;
                this.updateStatus('已加载保存的内容', 'success');
            }
        } catch (error) {
            this.updateStatus('加载失败', 'error');
            console.error('加载错误:', error);
        }
    }
    
    saveNote() {
        try {
            const content = this.noteArea.value;
            localStorage.setItem(this.STORAGE_KEY, content);
            this.updateStatus(`已保存 ${new Date().toLocaleTimeString()}`, 'success');
            return true;
        } catch (error) {
            this.updateStatus('保存失败', 'error');
            console.error('保存错误:', error);
            return false;
        }
    }
    
    autoSave() {
        // 清除之前的定时器
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }
        
        this.updateStatus('正在保存...', 'info');
        
        // 设置新的定时器（2秒后保存）
        this.autoSaveTimer = setTimeout(() => {
            this.saveNote();
        }, 2000);
    }
    
    clearNote() {
        if (this.noteArea.value && !confirm('确定要清空所有内容吗？此操作不可撤销。')) {
            return;
        }
        
        this.noteArea.value = '';
        localStorage.removeItem(this.STORAGE_KEY);
        this.updateStats();
        this.updateStatus('内容已清空', 'info');
        
        // 清空后重新聚焦
        setTimeout(() => this.noteArea.focus(), 100);
    }
    
    updateStats() {
        const content = this.noteArea.value;
        const chars = content.length;
        const words = content.trim() ? content.trim().split(/\s+/).length : 0;
        
        this.charCount.textContent = chars;
        this.wordCount.textContent = words;
    }
    
    updateStatus(message, type = 'info') {
        const colors = {
            success: '#4CAF50',
            error: '#ff6b6b', 
            info: '#2196F3'
        };
        
        this.status.textContent = message;
        this.status.style.color = colors[type] || colors.info;
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new QuickNoteApp();
});

// 添加页面加载完成的额外聚焦保障
window.addEventListener('load', () => {
    // 双重保障：确保页面完全加载后再次聚焦
    setTimeout(() => {
        const noteArea = document.getElementById('noteArea');
        if (noteArea) {
            noteArea.focus();
            
            // 移动端：尝试通过点击事件触发键盘
            const event = new Event('touchstart', { bubbles: true });
            noteArea.dispatchEvent(event);
        }
    }, 500);
});

// 服务工作者支持（PWA功能）
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        const cacheName = 'quick-note-v1';
        const filesToCache = [
            './',
            './index.html',
            './style.css',
            './script.js'
        ];
        
        caches.open(cacheName).then(function(cache) {
            return cache.addAll(filesToCache);
        }).catch(function(error) {
            console.log('缓存失败:', error);
        });
    });
}