/**
 * 智能打卡助手 - 最终优化版
 * 核心优化：1. 本地数据优先渲染，云端检查后置 2. 点击按钮实时更新UI 3. 无感知加载
 * 版本：1.0.9
 */
(function(window, document) {
    'use strict';

    const ENV = {
        isProd: false,
        BASE_URL: 'http://192.168.0.52:3000/api',
        STORAGE_PREFIX: 'smart_checkin_'
    };

    const CONST = {
        USERNAME: 'test',
        TASKS: [
            { id: 'read', name: '读书' },
            { id: 'sport', name: '运动' },
            { id: 'water', name: '喝水' }
        ],
        TASK_TOTAL: 3,
        OFFLINE_TIP_DURATION: 3000,
        TOAST_DURATION: 2000,
        LOADING_TIMEOUT: 300 // 超过300ms才显示加载动画
    };

    const Utils = {
        log(type, message) {
            !ENV.isProd && console[type](`[${new Date().toLocaleString()}] ${message}`);
        },
        getDom(selector) {
            const el = document.querySelector(selector);
            !el && this.log('error', `DOM不存在: ${selector}`);
            return el;
        },
        formatDate(date) {
            return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,0)}-${String(date.getDate()).padStart(2,0)}`;
        },
        formatShowDate(date) {
            const week = ['日','一','二','三','四','五','六'];
            return `${date.getMonth()+1}月${date.getDate()}日 星期${week[date.getDay()]}`;
        },
        showToast(text) {
            const toast = this.getDom('#toast');
            if (!toast) return;
            toast.textContent = text;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), CONST.TOAST_DURATION);
        },
        showLoading() {
            const loading = this.getDom('#loadingWrap');
            loading && (loading.style.display = 'flex');
        },
        hideLoading() {
            const loading = this.getDom('#loadingWrap');
            loading && (loading.style.display = 'none');
        }
    };

    // 本地存储：单次读取+缓存
    const Storage = {
        _cache: null,
        getRecords() {
            if (this._cache) return [...this._cache]; // 返回副本避免污染缓存
            try {
                const key = `${ENV.STORAGE_PREFIX}records_${CONST.USERNAME}`;
                const data = localStorage.getItem(key);
                this._cache = data ? JSON.parse(data) : [];
                return Array.isArray(this._cache) ? this._cache : [];
            } catch (e) {
                Utils.log('error', `读取存储失败: ${e.message}`);
                this._cache = [];
                return [];
            }
        },
        saveRecord(record) {
            const completeRecord = { isSynced: false, isSupplement: false, ...record };
            if (!completeRecord.id || !completeRecord.content || !completeRecord.date) return;
            
            const isDuplicate = this.getRecords().some(r => 
                r.content === completeRecord.content && r.date === completeRecord.date && r.isSupplement === completeRecord.isSupplement
            );
            if (isDuplicate) return;

            this._cache.push(completeRecord);
            localStorage.setItem(`${ENV.STORAGE_PREFIX}records_${CONST.USERNAME}`, JSON.stringify(this._cache));
        },
        saveSupplementRecords(targetDate) {
            const hasSupplement = this.getRecords().some(r => r.isSupplement && r.targetDate === targetDate);
            if (hasSupplement) return;

            CONST.TASKS.forEach(task => {
                const recordId = `${CONST.USERNAME}_supplement_${task.id}_${targetDate}_${Date.now()}`;
                this.saveRecord({
                    id: recordId,
                    content: task.name,
                    date: Utils.formatDate(new Date()),
                    targetDate: targetDate,
                    isSupplement: true
                });
            });
        },
        updateSyncStatus(recordId) {
            const index = this._cache.findIndex(r => r.id === recordId);
            if (index === -1) return;
            this._cache[index].isSynced = true;
            localStorage.setItem(`${ENV.STORAGE_PREFIX}records_${CONST.USERNAME}`, JSON.stringify(this._cache));
        }
    };

    const Checkin = {
        todayDate: '',
        yesterdayDate: '',
        completedCount: 0,
        isOnline: false, // 默认离线
        loadingTimer: null,

        async init() {
            const startTime = Date.now();
            const today = new Date();
            this.todayDate = Utils.formatDate(today);
            this.yesterdayDate = Utils.formatDate(new Date(today - 86400000));
            
            // 1. 优先渲染静态日期，避免页面空白
            const dateEl = Utils.getDom('#currentDate');
            dateEl && (dateEl.textContent = Utils.formatShowDate(today));
            
            // 2. 启动加载超时兜底
            this.loadingTimer = setTimeout(() => {
                Utils.showLoading();
            }, CONST.LOADING_TIMEOUT);

            // 3. 本地数据优先读取+渲染，不等待云端
            const records = Storage.getRecords();
            this.renderBasicUI(records);
            this.renderComplexStats(records);

            // 4. 立即绑定核心事件，用户可直接操作
            this.bindEvents();

            // 5. 后台异步检查云端，不阻塞UI
            this.checkBackendConn().then(isOnline => {
                this.isOnline = isOnline;
                this.checkNetworkStatus(); // 绑定网络状态监听
                this.isOnline && Utils.showToast('已连接云端，可同步数据');
            }).catch(() => {
                this.isOnline = false;
                Utils.showToast('云端未连接，仅本地模式');
            });

            // 6. 立即隐藏加载动画（本地渲染完成）
            clearTimeout(this.loadingTimer);
            Utils.hideLoading();

            Utils.log('log', `初始化完成，耗时 ${Date.now() - startTime}ms`);
        },

        // 渲染基础UI：任务状态+进度条（最快响应）
        renderBasicUI(records) {
            const todayDoneTasks = records
                .filter(r => !r.isSupplement && r.date === this.todayDate)
                .map(r => r.content);
            
            this.completedCount = todayDoneTasks.length;

            // 批量更新任务按钮和状态
            CONST.TASKS.forEach(task => {
                const isDone = todayDoneTasks.includes(task.name);
                const btn = Utils.getDom(`#btn-${task.id}`);
                const status = Utils.getDom(`#status-${task.id}`);
                if (btn) isDone ? btn.classList.add('done') : btn.classList.remove('done');
                if (status) status.textContent = isDone ? '已完成' : '待完成';
            });

            // 更新进度条
            const progress = Math.round((this.completedCount / CONST.TASK_TOTAL) * 100);
            const progressFill = Utils.getDom('#progress-fill');
            const progressText = Utils.getDom('#progress-text');
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `${this.completedCount}/${CONST.TASK_TOTAL}`;

            // 更新一键打卡按钮状态
            this.updateAllBtnStatus();

            // 检查补签按钮显示状态
            const hasYesterdayFull = records.some(r => 
                (r.date === this.yesterdayDate && !r.isSupplement && records.filter(x => x.date === this.yesterdayDate).length === CONST.TASK_TOTAL) ||
                (r.targetDate === this.yesterdayDate && r.isSupplement)
            );
            const supplementWrap = Utils.getDom('#supplement-wrap');
            if (supplementWrap) supplementWrap.style.display = hasYesterdayFull ? 'none' : 'block';
        },

        // 异步渲染复杂统计：连续天数+月度数据（不阻塞基础UI）
        renderComplexStats(records) {
            setTimeout(() => {
                const stats = this.calculateStats(records);
                const streakEl = Utils.getDom('#streakNum');
                const monthFullEl = Utils.getDom('#month-full');
                const monthCountEl = Utils.getDom('#month-count');
                const monthRateEl = Utils.getDom('#month-rate');
                
                streakEl && (streakEl.textContent = stats.streak);
                monthFullEl && (monthFullEl.textContent = stats.monthFullDays);
                monthCountEl && (monthCountEl.textContent = stats.monthTotalCount);
                monthRateEl && (monthRateEl.textContent = `${stats.monthRate}%`);
            }, 0);
        },

        // 统计计算逻辑
        calculateStats(records) {
            const normalRecords = records.filter(r => !r.isSupplement);
            const supplementRecords = records.filter(r => r.isSupplement);
            const allDates = [...new Set([...normalRecords.map(r => r.date), ...supplementRecords.map(r => r.targetDate)])].filter(Boolean);

            // 计算全勤天数
            const fullDayDates = allDates.filter(date => {
                const normalDone = records.filter(r => r.date === date && !r.isSupplement).length === CONST.TASK_TOTAL;
                const supplementDone = records.some(r => r.targetDate === date && r.isSupplement);
                return normalDone || supplementDone;
            });

            // 计算连续打卡天数
            let streak = 0;
            const sortedDates = fullDayDates.sort((a,b) => new Date(b) - new Date(a));
            let lastDate = null;
            for (const date of sortedDates) {
                if (!lastDate) {
                    lastDate = new Date(date);
                    streak = 1;
                } else {
                    const diff = (lastDate - new Date(date)) / 86400000;
                    if (diff === 1) {
                        streak++;
                        lastDate = new Date(date);
                    } else break;
                }
            }

            // 计算月度统计
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const monthTotalDays = new Date(year, month, 0).getDate();
            const monthFullDays = fullDayDates.filter(date => {
                const d = new Date(date);
                return d.getFullYear() === year && d.getMonth() + 1 === month;
            }).length;
            const monthNormal = normalRecords.filter(r => {
                const d = new Date(r.date);
                return d.getFullYear() === year && d.getMonth() + 1 === month;
            }).length;
            const monthSupplement = supplementRecords.filter(r => {
                const d = new Date(r.targetDate);
                return d.getFullYear() === year && d.getMonth() + 1 === month;
            }).length;
            const monthTotalCount = monthNormal + monthSupplement;
            const monthRate = monthTotalDays ? Math.round((monthFullDays / monthTotalDays) * 100) : 0;

            return { streak, monthFullDays, monthTotalCount, monthRate };
        },

        // 异步检查云端连接
        checkBackendConn() {
            return new Promise((resolve) => {
                fetch(`${ENV.BASE_URL}/checkins/${CONST.USERNAME}`, {
                    method: 'GET',
                    timeout: 5000
                }).then(res => resolve(res.ok)).catch(() => resolve(false));
            });
        },

        // 网络状态监听
        checkNetworkStatus() {
            window.addEventListener('online', () => {
                this.isOnline = true;
                const offlineTip = Utils.getDom('#offlineTip');
                offlineTip && (offlineTip.style.display = 'none');
                Utils.showToast('网络已恢复，自动同步中...');
                setTimeout(() => this.autoSync(), 1000); // 后台同步
            });

            window.addEventListener('offline', () => {
                this.isOnline = false;
                const offlineTip = Utils.getDom('#offlineTip');
                if (offlineTip) {
                    offlineTip.style.display = 'block';
                    offlineTip.style.opacity = '1';
                    setTimeout(() => {
                        offlineTip.style.opacity = '0';
                        setTimeout(() => offlineTip.style.display = 'none', 300);
                    }, CONST.OFFLINE_TIP_DURATION);
                }
                Utils.showToast('已切换至本地模式，数据不会同步');
            });
        },

        // 后台同步数据
        autoSync() {
            if (!this.isOnline) return;
            const records = Storage.getRecords().filter(r => !r.isSynced);
            if (!records.length) return;

            let successCount = 0;
            records.forEach(async record => {
                const url = record.isSupplement 
                    ? `${ENV.BASE_URL}/checkin/supplement` 
                    : `${ENV.BASE_URL}/checkin`;
                try {
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username: CONST.USERNAME,
                            content: record.content,
                            date: record.date,
                            targetDate: record.targetDate
                        })
                    });
                    if (res.ok) {
                        successCount++;
                        Storage.updateSyncStatus(record.id);
                    }
                } catch (e) {
                    Utils.log('error', `同步失败: ${e.message}`);
                }
            });

            if (successCount > 0) {
                Utils.showToast(`成功同步 ${successCount} 条数据`);
            }
        },

        // 手动同步触发
        manualSync() {
            if (this.isOnline) {
                this.autoSync();
            } else {
                Utils.showToast('当前离线，无法同步');
            }
        },

        // 单个任务打卡（实时更新UI）
        singleCheckin(taskId) {
            const task = CONST.TASKS.find(t => t.id === taskId);
            if (!task) return;

            // 保存打卡记录
            const recordId = `${CONST.USERNAME}_${task.id}_${this.todayDate}_${Date.now()}`;
            Storage.saveRecord({
                id: recordId,
                content: task.name,
                date: this.todayDate,
                isSupplement: false
            });

            // 立即更新按钮和状态
            const btn = Utils.getDom(`#btn-${taskId}`);
            const status = Utils.getDom(`#status-${taskId}`);
            btn && btn.classList.add('done');
            status && (status.textContent = '已完成');

            // 更新完成数和进度条
            this.completedCount++;
            const progress = Math.round((this.completedCount / CONST.TASK_TOTAL) * 100);
            const progressFill = Utils.getDom('#progress-fill');
            const progressText = Utils.getDom('#progress-text');
            progressFill && (progressFill.style.width = `${progress}%`);
            progressText && (progressText.textContent = `${this.completedCount}/${CONST.TASK_TOTAL}`);

            // 更新一键打卡按钮状态
            this.updateAllBtnStatus();

            // 重新计算统计数据
            const records = Storage.getRecords();
            this.renderComplexStats(records);

            // 提示用户
            Utils.showToast(`✅ ${task.name}打卡成功`);

            // 后台同步（如果在线）
            this.isOnline && setTimeout(() => this.autoSync(), 1000);
        },

        // 一键打卡（批量触发单个打卡）
        batchCheckin() {
            if (this.completedCount >= CONST.TASK_TOTAL) {
                Utils.showToast('今日任务已全部完成');
                return;
            }

            CONST.TASKS.forEach(task => {
                const btn = Utils.getDom(`#btn-${task.id}`);
                if (btn && !btn.classList.contains('done')) {
                    this.singleCheckin(task.id);
                }
            });
        },

        // 补签昨日任务（实时更新统计）
        supplementCheckin() {
            Storage.saveSupplementRecords(this.yesterdayDate);
            
            // 隐藏补签按钮
            const supplementWrap = Utils.getDom('#supplement-wrap');
            supplementWrap && (supplementWrap.style.display = 'none');

            // 重新计算统计数据
            const records = Storage.getRecords();
            this.renderComplexStats(records);

            // 提示用户
            Utils.showToast('✅ 补签成功！昨日3个任务已全部打卡');

            // 后台同步（如果在线）
            this.isOnline && setTimeout(() => this.autoSync(), 1000);
        },

        // 更新一键打卡按钮状态
        updateAllBtnStatus() {
            const allBtn = Utils.getDom('#btn-all');
            if (!allBtn) return;
            if (this.completedCount >= CONST.TASK_TOTAL) {
                allBtn.textContent = '✅ 今日已打卡';
                allBtn.classList.add('done');
            } else {
                allBtn.textContent = '✨ 一键全打卡';
                allBtn.classList.remove('done');
            }
        },

        // 绑定所有事件
        bindEvents() {
            // 单个任务打卡事件
            CONST.TASKS.forEach(task => {
                const btn = Utils.getDom(`#btn-${task.id}`);
                btn && btn.addEventListener('click', () => this.singleCheckin(task.id));
            });

            // 一键打卡事件
            const allBtn = Utils.getDom('#btn-all');
            allBtn && allBtn.addEventListener('click', () => this.batchCheckin());

            // 补签事件
            const supplementLink = Utils.getDom('#supplement-link');
            supplementLink && supplementLink.addEventListener('click', () => this.supplementCheckin());

            // 手动同步事件
            const syncBtn = Utils.getDom('#btn-sync');
            syncBtn && syncBtn.addEventListener('click', () => this.manualSync());
        }
    };

    // 页面加载完成后初始化
    document.addEventListener('DOMContentLoaded', () => Checkin.init());

    // 暴露全局方法（方便调试）
    window.Checkin = Checkin;
    window.Utils = Utils;
})(window, document);
