// 应用核心模块
class HabitFlowApp {
    constructor() {
        this.habits = [];
        this.selectedHabit = null;
        this.currentPage = 'main';
        this.settings = {};
        this.habitToDelete = null;
        this.init();
    }

    // 初始化应用
    async init() {
        try {
            this.showLoading();
            await this.loadData();
            this.setupEventListeners();
            this.render();
            this.hideLoading();
            this.showNotification('应用加载成功', 'success');
        } catch (error) {
            console.error('应用初始化失败:', error);
            this.showNotification('应用加载失败，请刷新页面', 'error');
        }
    }

    // 显示加载界面
    showLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.classList.remove('hidden');
    }

    // 隐藏加载界面
    hideLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
            }, 500);
        }
    }

    // 加载数据
    async loadData() {
        return new Promise((resolve) => {
            setTimeout(() => {
                try {
                    // 加载习惯数据
                    const habitsData = localStorage.getItem('habits');
                    this.habits = habitsData ? JSON.parse(habitsData) : [];

                    // 加载设置
                    const settingsData = localStorage.getItem('settings');
                    this.settings = settingsData ? JSON.parse(settingsData) : {
                        darkMode: false,
                        notifications: true
                    };

                    resolve();
                } catch (error) {
                    console.error('数据加载错误:', error);
                    // 使用默认数据
                    this.habits = [];
                    this.settings = {
                        darkMode: false,
                        notifications: true
                    };
                    resolve();
                }
            }, 1000);
        });
    }

    // 保存数据
    saveData() {
        try {
            localStorage.setItem('habits', JSON.stringify(this.habits));
            localStorage.setItem('settings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('数据保存失败:', error);
            this.showNotification('数据保存失败', 'error');
        }
    }

    // 设置事件监听器
    setupEventListeners() {
        // 页面导航
        document.getElementById('add-habit-btn').addEventListener('click', () => this.showPage('add-habit'));
        document.getElementById('back-from-add-btn').addEventListener('click', () => this.showPage('main'));
        document.getElementById('back-from-stats-btn').addEventListener('click', () => this.showPage('main'));
        document.getElementById('back-from-settings-btn').addEventListener('click', () => this.showPage('main'));
        document.getElementById('stats-btn').addEventListener('click', () => this.showPage('stats'));
        document.getElementById('settings-btn').addEventListener('click', () => this.showPage('settings'));

        // 习惯操作
        document.getElementById('check-all-btn').addEventListener('click', () => this.checkAllHabits());
        document.getElementById('save-habit-btn').addEventListener('click', () => this.saveHabit());

        // 设置操作
        document.getElementById('export-data-btn').addEventListener('click', () => this.exportData());
        document.getElementById('import-data-btn').addEventListener('click', () => this.importData());
        document.getElementById('clear-data-btn').addEventListener('click', () => this.clearData());
        document.getElementById('export-btn').addEventListener('click', () => this.exportData());

        // 设置切换
        document.getElementById('dark-mode-toggle').addEventListener('change', (e) => this.toggleDarkMode(e.target.checked));

        // 表单交互
        document.getElementById('habit-name').addEventListener('input', (e) => this.updateCharCount(e.target.value));

        // 文件导入
        document.getElementById('import-file-input').addEventListener('change', (e) => this.handleFileImport(e));

        // 删除对话框
        document.getElementById('cancel-delete-btn').addEventListener('click', () => this.hideDeleteDialog());
        document.getElementById('confirm-delete-btn').addEventListener('click', () => this.confirmDeleteHabit());
    }

    // 显示页面
    showPage(pageName) {
        // 隐藏所有页面
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // 显示目标页面
        const targetPage = document.getElementById(`${pageName}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageName;

            // 页面特定的初始化
            if (pageName === 'stats') {
                this.updateStats();
            } else if (pageName === 'add-habit') {
                this.initAddHabitPage();
            }
        }
    }

    // 渲染应用
    render() {
        this.updateDateDisplay();
        this.renderHabits();
        this.updateCompletionCount();
        this.applySettings();
    }

    // 更新日期显示
    updateDateDisplay() {
        const now = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        const dateText = now.toLocaleDateString('zh-CN', options);
        const dayText = now.toLocaleDateString('zh-CN', { weekday: 'long' });

        document.getElementById('current-date').textContent = dateText;
        document.getElementById('current-day').textContent = dayText;

        // 更新激励文本
        this.updateMotivationText();
    }

    // 更新激励文本
    updateMotivationText() {
        const motivations = [
            '每一天都是新的开始！',
            '坚持就是胜利！',
            '小小的习惯，大大的改变！',
            '今天也要加油！',
            '进步从每一步开始！',
            '您正在变得更好！'
        ];
        const randomMotivation = motivations[Math.floor(Math.random() * motivations.length)];
        document.getElementById('motivation-text').textContent = randomMotivation;
    }

    // 渲染习惯
    renderHabits() {
        const habitsGrid = document.getElementById('habits-grid');
        const emptyState = document.getElementById('empty-state');

        if (!habitsGrid) return;

        habitsGrid.innerHTML = '';

        if (this.habits.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        this.habits.forEach((habit, index) => {
            const isCompletedToday = this.isHabitCompletedToday(habit);
            const habitElement = this.createHabitElement(habit, index, isCompletedToday);
            habitsGrid.appendChild(habitElement);
        });
    }

    // 创建习惯元素 - 修复颜色bug和添加删除功能
    createHabitElement(habit, index, isCompleted) {
        const habitDiv = document.createElement('div');
        habitDiv.className = `habit-circle ${isCompleted ? 'completed' : ''}`;
        habitDiv.setAttribute('data-index', index);
        habitDiv.setAttribute('role', 'button');
        habitDiv.setAttribute('tabindex', '0');
        habitDiv.setAttribute('aria-label', `${habit.name}习惯，${isCompleted ? '已完成' : '未完成'}`);

        // 修复颜色bug：未完成状态也显示颜色但透明度较低，完成状态显示完整颜色
        if (isCompleted && habit.color) {
            habitDiv.style.background = habit.color;
            habitDiv.style.color = 'white';
            habitDiv.style.borderColor = 'transparent';
        } else if (habit.color) {
            // 未完成状态显示浅色版本
            habitDiv.style.background = this.getLightColor(habit.color);
            habitDiv.style.color = this.getTextColor(habit.color);
            habitDiv.style.borderColor = habit.color;
        }

        habitDiv.innerHTML = `
            <button class="habit-delete-btn" data-index="${index}" aria-label="删除${habit.name}习惯">
                <i class="fas fa-times"></i>
            </button>
            <div class="habit-icon">
                <i class="fas fa-${habit.icon}"></i>
            </div>
            <div class="habit-name">${habit.name}</div>
        `;

        // 打卡事件
        habitDiv.addEventListener('click', (e) => {
            if (!e.target.closest('.habit-delete-btn')) {
                this.toggleHabitCompletion(index);
            }
        });

        habitDiv.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                this.toggleHabitCompletion(index);
            }
        });

        // 删除事件
        const deleteBtn = habitDiv.querySelector('.habit-delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showDeleteDialog(index, habit.name);
        });

        return habitDiv;
    }

    // 获取浅色版本的颜色
    getLightColor(color) {
        // 简单的颜色变浅逻辑
        return color + '20'; // 添加透明度
    }

    // 根据背景色获取合适的文字颜色
    getTextColor(backgroundColor) {
        // 简单的亮度计算
        const hex = backgroundColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 128 ? 'var(--text-primary)' : 'var(--text-primary)';
    }

    // 显示删除对话框
    showDeleteDialog(index, habitName) {
        this.habitToDelete = index;
        document.getElementById('delete-habit-name').textContent = habitName;
        document.getElementById('delete-dialog').style.display = 'flex';
    }

    // 隐藏删除对话框
    hideDeleteDialog() {
        this.habitToDelete = null;
        document.getElementById('delete-dialog').style.display = 'none';
    }

    // 确认删除习惯
    confirmDeleteHabit() {
        if (this.habitToDelete !== null) {
            const habitName = this.habits[this.habitToDelete].name;
            this.habits.splice(this.habitToDelete, 1);
            this.saveData();
            this.render();
            this.hideDeleteDialog();
            this.showNotification(`习惯 "${habitName}" 已删除`, 'info');
        }
    }

    // 检查习惯今天是否已完成
    isHabitCompletedToday(habit) {
        const today = new Date().toDateString();
        return habit.completions.some(completion => 
            new Date(completion).toDateString() === today
        );
    }

    // 切换习惯完成状态 - 修复颜色问题
    toggleHabitCompletion(index) {
        if (index < 0 || index >= this.habits.length) return;

        const habit = this.habits[index];
        const today = new Date().toDateString();
        const completionIndex = habit.completions.findIndex(completion => 
            new Date(completion).toDateString() === today
        );

        if (completionIndex >= 0) {
            habit.completions.splice(completionIndex, 1);
            this.showNotification(`${habit.name} 已取消打卡`, 'info');
        } else {
            habit.completions.push(new Date().toISOString());
            this.showNotification(`${habit.name} 打卡成功！`, 'success');
        }

        this.saveData();
        this.renderHabits(); // 重新渲染确保颜色正确更新
        this.updateCompletionCount();
    }

    // 一键打卡所有习惯 - 修复颜色问题
    checkAllHabits() {
        const today = new Date().toDateString();
        let completedCount = 0;

        this.habits.forEach(habit => {
            const isCompletedToday = habit.completions.some(completion => 
                new Date(completion).toDateString() === today
            );

            if (!isCompletedToday) {
                habit.completions.push(new Date().toISOString());
                completedCount++;
            }
        });

        this.saveData();
        this.renderHabits(); // 重新渲染确保颜色正确
        this.updateCompletionCount();

        if (completedCount > 0) {
            this.showNotification(`成功完成 ${completedCount} 个习惯打卡！`, 'success');
        } else {
            this.showNotification('所有习惯已完成打卡', 'info');
        }
    }

    // 更新完成计数
    updateCompletionCount() {
        const completedToday = this.habits.filter(habit => 
            this.isHabitCompletedToday(habit)
        ).length;

        const countElement = document.getElementById('completion-count');
        if (countElement) {
            countElement.textContent = `${completedToday}/${this.habits.length}`;
        }
    }

    // 初始化添加习惯页面
    initAddHabitPage() {
        this.selectedHabit = null;
        this.resetAddHabitForm();
        this.renderIconOptions();
        this.renderColorOptions();
    }

    // 重置添加习惯表单
    resetAddHabitForm() {
        document.getElementById('habit-name').value = '';
        document.getElementById('habit-category').value = 'health';
        document.getElementById('save-habit-btn').disabled = true;
        this.updateCharCount('');
        
        // 重置图标和颜色选择
        document.querySelectorAll('.icon-option, .color-option').forEach(option => {
            option.classList.remove('selected');
        });
    }

    // 更新字符计数
    updateCharCount(text) {
        const charCount = document.getElementById('char-count');
        const saveButton = document.getElementById('save-habit-btn');
        
        if (charCount) {
            charCount.textContent = text.length;
        }
        
        if (saveButton) {
            saveButton.disabled = text.length === 0 || !this.selectedHabit;
        }
    }

    // 渲染图标选项
    renderIconOptions() {
        const iconOptions = document.getElementById('icon-options');
        if (!iconOptions) return;

        const icons = ['running', 'book', 'brain', 'sun', 'moon', 'apple-alt', 'dumbbell', 'pen', 'graduation-cap', 'music', 'utensils', 'bed'];
        
        iconOptions.innerHTML = icons.map(icon => `
            <div class="icon-option" data-icon="${icon}">
                <i class="fas fa-${icon}"></i>
            </div>
        `).join('');

        // 添加图标选择事件
        iconOptions.querySelectorAll('.icon-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.icon-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                option.classList.add('selected');
                
                if (!this.selectedHabit) {
                    this.selectedHabit = {};
                }
                this.selectedHabit.icon = option.getAttribute('data-icon');
                this.updateSaveButtonState();
            });
        });
    }

    // 渲染颜色选项
    renderColorOptions() {
        const colorOptions = document.getElementById('color-options');
        if (!colorOptions) return;

        const colors = [
            '#4361ee', '#7209b7', '#06d6a0', '#ef476f', 
            '#ffd166', '#118ab2', '#8338ec', '#fb5607',
            '#3a86ff', '#ff006e', '#fb5607', '#ffbe0b'
        ];
        
        colorOptions.innerHTML = colors.map(color => `
            <div class="color-option" data-color="${color}" style="background: ${color}"></div>
        `).join('');

        // 添加颜色选择事件
        colorOptions.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                option.classList.add('selected');
                
                if (!this.selectedHabit) {
                    this.selectedHabit = {};
                }
                this.selectedHabit.color = option.getAttribute('data-color');
                this.updateSaveButtonState();
            });
        });
    }

    // 更新保存按钮状态
    updateSaveButtonState() {
        const habitName = document.getElementById('habit-name').value.trim();
        const saveButton = document.getElementById('save-habit-btn');
        
        if (saveButton) {
            saveButton.disabled = !(habitName && this.selectedHabit && this.selectedHabit.icon && this.selectedHabit.color);
        }
    }

    // 保存习惯
    saveHabit() {
        const name = document.getElementById('habit-name').value.trim();
        const category = document.getElementById('habit-category').value;

        if (!name || !this.selectedHabit) {
            this.showNotification('请填写习惯名称并选择图标和颜色', 'error');
            return;
        }

        const newHabit = {
            id: Date.now(),
            name,
            icon: this.selectedHabit.icon,
            color: this.selectedHabit.color,
            category,
            completions: [],
            createdAt: new Date().toISOString(),
            streak: 0
        };

        this.habits.push(newHabit);
        this.saveData();
        this.showPage('main');
        this.render();
        this.showNotification(`习惯 "${name}" 添加成功！`, 'success');
    }

    // 更新统计
    updateStats() {
        this.updateStatsOverview();
        this.renderHabitsStats();
        this.renderWeekChart();
    }

    // 更新统计概览
    updateStatsOverview() {
        if (this.habits.length === 0) {
            document.getElementById('total-completed').textContent = '0';
            document.getElementById('completion-rate').textContent = '0%';
            document.getElementById('current-streak').textContent = '0';
            return;
        }

        // 总完成次数
        const totalCompletions = this.habits.reduce((sum, habit) => sum + habit.completions.length, 0);
        document.getElementById('total-completed').textContent = totalCompletions;

        // 平均完成率
        const completionRate = this.calculateAverageCompletionRate();
        document.getElementById('completion-rate').textContent = `${completionRate}%`;

        // 最长连续天数
        const maxStreak = Math.max(...this.habits.map(habit => this.calculateHabitStreak(habit)));
        document.getElementById('current-streak').textContent = maxStreak;
    }

    // 计算平均完成率
    calculateAverageCompletionRate() {
        if (this.habits.length === 0) return 0;

        const totalRates = this.habits.reduce((sum, habit) => {
            return sum + this.calculateHabitCompletionRate(habit);
        }, 0);

        return Math.round(totalRates / this.habits.length);
    }

    // 渲染习惯统计
    renderHabitsStats() {
        const habitsList = document.getElementById('habits-stats-list');
        if (!habitsList) return;

        if (this.habits.length === 0) {
            habitsList.innerHTML = '<div class="empty-state">暂无习惯数据</div>';
            return;
        }

        habitsList.innerHTML = this.habits.map((habit, index) => {
            const streak = this.calculateHabitStreak(habit);
            const completionRate = this.calculateHabitCompletionRate(habit);

            return `
                <div class="habit-stat-item">
                    <button class="habit-stat-delete" data-index="${index}" aria-label="删除${habit.name}">
                        <i class="fas fa-trash"></i>
                    </button>
                    <div class="habit-stat-info">
                        <div class="habit-stat-icon" style="background: ${habit.color}">
                            <i class="fas fa-${habit.icon}"></i>
                        </div>
                        <div class="habit-stat-name">${habit.name}</div>
                    </div>
                    <div class="habit-stat-details">
                        <div class="habit-stat-streak">${streak} 天</div>
                        <div class="habit-stat-completion">${completionRate}% 完成率</div>
                    </div>
                </div>
            `;
        }).join('');

        // 为统计页面的删除按钮添加事件
        habitsList.querySelectorAll('.habit-stat-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(btn.getAttribute('data-index'));
                const habitName = this.habits[index].name;
                this.showDeleteDialog(index, habitName);
            });
        });
    }

    // 渲染周统计图表
    renderWeekChart() {
        const weekChart = document.getElementById('week-chart');
        if (!weekChart) return;

        const weekData = this.getWeekCompletionData();
        const maxCompletions = Math.max(...weekData.map(day => day.completions), 1);

        weekChart.innerHTML = `
            <div class="week-bars">
                ${weekData.map(day => `
                    <div class="week-bar">
                        <div class="bar" style="height: ${(day.completions / maxCompletions) * 100}%"></div>
                        <div class="bar-label">${day.label}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // 获取周完成数据
    getWeekCompletionData() {
        const days = ['日', '一', '二', '三', '四', '五', '六'];
        const today = new Date();
        const weekData = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dayKey = date.toDateString();

            const completions = this.habits.reduce((sum, habit) => {
                const hasCompletion = habit.completions.some(completion => 
                    new Date(completion).toDateString() === dayKey
                );
                return sum + (hasCompletion ? 1 : 0);
            }, 0);

            weekData.push({
                label: days[date.getDay()],
                completions
            });
        }

        return weekData;
    }

    // 计算习惯连续天数
    calculateHabitStreak(habit) {
        if (habit.completions.length === 0) return 0;

        const completions = [...habit.completions]
            .map(c => new Date(c))
            .sort((a, b) => b - a);

        let streak = 0;
        let currentDate = new Date();
        const today = new Date().toDateString();

        // 检查今天是否打卡
        if (completions[0].toDateString() === today) {
            streak = 1;
            currentDate.setDate(currentDate.getDate() - 1);
        }

        // 检查之前的连续天数
        for (let i = streak > 0 ? 1 : 0; i < completions.length; i++) {
            const prevDate = new Date(currentDate);
            prevDate.setDate(currentDate.getDate() - 1);
            
            if (completions[i].toDateString() === prevDate.toDateString()) {
                streak++;
                currentDate = prevDate;
            } else {
                break;
            }
        }

        return streak;
    }

    // 计算习惯完成率
    calculateHabitCompletionRate(habit) {
        if (habit.completions.length === 0) return 0;

        const firstCompletion = new Date(Math.min(...habit.completions.map(c => new Date(c))));
        const daysSinceStart = Math.max(1, Math.ceil((new Date() - firstCompletion) / (1000 * 60 * 60 * 24)));
        
        return Math.round((habit.completions.length / daysSinceStart) * 100);
    }

    // 导出数据
    exportData() {
        const data = {
            habits: this.habits,
            settings: this.settings,
            exportDate: new Date().toISOString(),
            version: '2.1.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `habitflow-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('数据导出成功', 'success');
    }

    // 导入数据
    importData() {
        document.getElementById('import-file-input').click();
    }

    // 处理文件导入
    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (this.validateImportData(data)) {
                    if (confirm('导入数据将覆盖当前数据，确定要继续吗？')) {
                        this.habits = data.habits || [];
                        this.settings = data.settings || {};
                        this.saveData();
                        this.render();
                        this.showNotification('数据导入成功', 'success');
                    }
                } else {
                    this.showNotification('数据文件格式不正确', 'error');
                }
            } catch (error) {
                console.error('数据导入错误:', error);
                this.showNotification('数据文件读取失败', 'error');
            }
        };
        reader.readAsText(file);
        
        // 重置文件输入
        event.target.value = '';
    }

    // 验证导入数据
    validateImportData(data) {
        return data && 
               Array.isArray(data.habits) && 
               typeof data.settings === 'object';
    }

    // 清空数据
    clearData() {
        if (confirm('确定要清空所有数据吗？此操作不可撤销！')) {
            this.habits = [];
            this.settings = {
                darkMode: false,
                notifications: true
            };
            this.saveData();
            this.render();
            this.showNotification('数据已清空', 'info');
        }
    }

    // 切换深色模式
    toggleDarkMode(enabled) {
        this.settings.darkMode = enabled;
        this.saveData();
        this.applySettings();
        this.showNotification(
            enabled ? '深色模式已开启' : '深色模式已关闭', 
            'info'
        );
    }

    // 应用设置
    applySettings() {
        // 应用深色模式
        if (this.settings.darkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        // 更新设置控件状态
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        if (darkModeToggle) darkModeToggle.checked = this.settings.darkMode;
    }

    // 显示通知
    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        container.appendChild(notification);

        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
}

// 应用初始化
document.addEventListener('DOMContentLoaded', () => {
    window.habitFlowApp = new HabitFlowApp();
});

// 错误边界
window.addEventListener('error', (event) => {
    console.error('应用错误:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
});