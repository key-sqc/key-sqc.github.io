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
        
        // 页面可见性变化时保存（切换应用时）
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveNote();
            }
        });
        
        // 页面卸载前保存
        window.addEventListener('beforeunload', () => this.saveNote());
        
        // 初始化统计
        this.updateStats();
        this.updateStatus('应用已就绪', 'success');
        
        console.log('快速便签应用已初始化');
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
        this.noteArea.focus();
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

// 添加服务工作者支持（PWA功能）
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        // 简单的服务工作者缓存
        const cacheName = 'quick-note-v1';
        const filesToCache = [
            './',
            './index.html',
            './style.css',
            './script.js'
        ];
        
        // 创建简单的缓存逻辑
        caches.open(cacheName).then(function(cache) {
            return cache.addAll(filesToCache);
        }).catch(function(error) {
            console.log('缓存失败:', error);
        });
    });
}