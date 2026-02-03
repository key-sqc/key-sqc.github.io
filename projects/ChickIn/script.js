/**
 * 智能打卡助手 - 离线优先版
 * 最终修复：正常打卡+补签双功能可用
 * 版本：1.0.5
 */
(function(window, document) {
    'use strict';

    // ========== 1. 环境配置 ==========
    const ENV = {
        isProd: false,
        BASE_URL: 'http://192.168.0.52:3000/api',
        STORAGE_PREFIX: 'smart_checkin_'
    };

    // ========== 2. 全局常量 ==========
    const CONST = {
        USERNAME: 'test',
        TASKS: [
            { id: 'read', name: '读书' },
            { id: 'sport', name: '运动' },
            { id: 'water', name: '喝水' }
        ],
        TASK_TOTAL: 3,
        OFFLINE_TIP_DURATION: 3000,
        TOAST_DURATION: 2000
    };

    // ========== 3. 工具函数封装 ==========
    const Utils = {
        log(type, message) {
            if (!ENV.isProd) {
                console[type](`[${new Date().toLocaleString()}] ${message}`);
            }
        },

        getDom(selector) {
            const el = document.querySelector(selector);
            if (!el) {
                this.log('error', `DOM元素不存在: ${selector}`);
            }
            return el;
        },

        formatDate(date) {
            if (!(date instanceof Date)) {
                this.log('error', 'formatDate参数必须是Date对象');
                return '';
            }
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        },

        formatShowDate(date) {
            if (!(date instanceof Date)) {
                this.log('error', 'formatShowDate参数必须是Date对象');
                return '';
            }
            const week = ['日', '一', '二', '三', '四', '五', '六'];
            return `${date.getMonth() + 1}月${date.getDate()}日 星期${week[date.getDay()]}`;
        },

        showToast(text) {
            const toast = this.getDom('#toast');
            if (!toast) return;
            toast.textContent = text;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, CONST.TOAST_DURATION);
        }
    };

    // ========== 4. 本地存储封装 ==========
    const Storage = {
        getRecords() {
            try {
                const key = `${ENV.STORAGE_PREFIX}records_${CONST.USERNAME}`;
                const data = localStorage.getItem(key);
                const records = data ? JSON.parse(data) : [];
                return Array.isArray(records) ? records : [];
            } catch (error) {
                Utils.log('error', `获取本地存储失败: ${error.message}`);
                return [];
            }
        },

        saveRecord(record) {
            try {
                // 补全必要字段，防止缺失
                const completeRecord = {
                    isSynced: false,
                    isSupplement: false,
                    ...record
                };
                // 校验必填字段
                if (!completeRecord.id || !completeRecord.content || !completeRecord.date) {
                    Utils.log('error', '保存的记录参数不完整');
                    return;
                }
                const records = this.getRecords();
                // 去重逻辑：同一日期+同一任务+同一类型 视为重复
                const isExist = records.some(r => 
                    r.content === completeRecord.content && 
                    r.date === completeRecord.date &&
                    r.isSupplement === completeRecord.isSupplement
                );
                if (isExist) {
                    Utils.log('warn', '该记录已存在，无需重复保存');
                    return;
                }

                records.push(completeRecord);
                const key = `${ENV.STORAGE_PREFIX}records_${CONST.USERNAME}`;
                localStorage.setItem(key, JSON.stringify(records));
                Utils.log('log', `本地记录保存成功: ${JSON.stringify(completeRecord)}`);
            } catch (error) {
                Utils.log('error', `保存本地存储失败: ${error.message}`);
            }
        },

        // 批量保存补签的3个任务记录
        saveSupplementRecords(targetDate) {
            try {
                const records = this.getRecords();
                // 检查该日期是否已有补签记录，避免重复
                const hasSupplement = records.some(r => r.isSupplement && r.targetDate === targetDate);
                if (hasSupplement) {
                    Utils.log('warn', '该日期已补签，无需重复操作');
                    return;
                }

                // 为3个任务分别生成补签记录
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

                Utils.log('log', `补签记录保存成功，目标日期: ${targetDate}`);
            } catch (error) {
                Utils.log('error', `批量保存补签记录失败: ${error.message}`);
            }
        },

        updateSyncStatus(recordId) {
            try {
                const records = Storage.getRecords();
                const index = records.findIndex(r => r.id === recordId);
                if (index === -1) return;
                records[index].isSynced = true;
                const key = `${ENV.STORAGE_PREFIX}records_${CONST.USERNAME}`;
                localStorage.setItem(key, JSON.stringify(records));
            } catch (error) {
                Utils.log('error', `更新同步状态失败: ${error.message}`);
            }
        }
    };

    // ========== 5. 核心业务逻辑（最终修复版） ==========
    const Checkin = {
        todayDate: '',
        yesterdayDate: '',
        completedCount: 0,
        isOnline: true,

        async init() {
            try {
                const today = new Date();
                this.todayDate = Utils.formatDate(today);
                this.yesterdayDate = Utils.formatDate(new Date(today.getTime() - 86400000));
                
                const dateEl = Utils.getDom('#currentDate');
                if (dateEl) dateEl.textContent = Utils.formatShowDate(today);

                this.checkNetworkStatus();
                this.isOnline = await this.checkBackendConn();
                this.renderFromLocalStorage();
                this.bindEvents();

                const loadingEl = Utils.getDom('#loading');
                if (loadingEl) loadingEl.style.display = 'none';

                Utils.log('log', '应用初始化完成');
            } catch (error) {
                Utils.log('error', `应用初始化失败: ${error.message}`);
                Utils.showToast('初始化失败，请刷新页面');
                const loadingEl = Utils.getDom('#loading');
                if (loadingEl) loadingEl.style.display = 'none';
            }
        },

        checkNetworkStatus() {
            window.addEventListener('online', () => {
                this.isOnline = true;
                const offlineTip = Utils.getDom('#offlineTip');
                if (offlineTip) offlineTip.style.display = 'none';
                Utils.showToast('网络已恢复，自动同步中...');
                this.autoSync();
                Utils.log('log', '网络已恢复');
            });

            window.addEventListener('offline', () => {
                this.isOnline = false;
                this.showOfflineTip();
                Utils.log('log', '网络已断开，切换离线模式');
            });
        },

        showOfflineTip() {
            const offlineTip = Utils.getDom('#offlineTip');
            if (!offlineTip) return;
            offlineTip.style.display = 'block';
            offlineTip.style.opacity = '1';
            setTimeout(() => {
                offlineTip.style.opacity = '0';
                setTimeout(() => {
                    offlineTip.style.display = 'none';
                }, 300);
            }, CONST.OFFLINE_TIP_DURATION);
        },

        async checkBackendConn() {
            try {
                const res = await fetch(`${ENV.BASE_URL}/checkins/${CONST.USERNAME}`, {
                    method: 'GET',
                    timeout: 5000
                });
                return res.ok;
            } catch (error) {
                Utils.log('warn', `后端连接失败: ${error.message}`);
                return false;
            }
        },

        async autoSync() {
            try {
                if (!this.isOnline) return;
                const records = Storage.getRecords().filter(r => !r.isSynced);
                if (records.length === 0) {
                    Utils.log('log', '本地无未同步数据');
                    return;
                }

                let successCount = 0;
                for (const record of records) {
                    const url = record.isSupplement 
                        ? `${ENV.BASE_URL}/checkin/supplement` 
                        : `${ENV.BASE_URL}/checkin`;

                    const res = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
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
                }

                if (successCount > 0) {
                    Utils.showToast(`成功同步 ${successCount} 条数据`);
                    this.renderFromLocalStorage();
                } else {
                    Utils.showToast('同步失败，请稍后重试');
                }
            } catch (error) {
                Utils.log('error', `自动同步失败: ${error.message}`);
                Utils.showToast('同步异常，请稍后重试');
            }
        },

        manualSync() {
            if (!this.isOnline) {
                Utils.showToast('当前离线，无法同步');
                return;
            }
            this.autoSync();
        },

        // 修复正常单任务打卡逻辑
        singleCheckin(taskId) {
            try {
                const task = CONST.TASKS.find(t => t.id === taskId);
                if (!task) {
                    Utils.log('error', `任务不存在: ${taskId}`);
                    return;
                }

                const recordId = `${CONST.USERNAME}_${task.id}_${this.todayDate}_${Date.now()}`;
                // 调用saveRecord保存正常打卡记录
                Storage.saveRecord({
                    id: recordId,
                    content: task.name,
                    date: this.todayDate,
                    isSupplement: false
                });

                // 更新按钮状态
                const btnEl = Utils.getDom(`#btn-${taskId}`);
                const statusEl = Utils.getDom(`#status-${taskId}`);
                if (btnEl) btnEl.classList.add('done');
                if (statusEl) statusEl.textContent = '已完成';

                // 更新今日完成数和统计
                this.completedCount++;
                this.updateProgress();
                this.updateAllBtnStatus();
                this.calculateStats();

                Utils.showToast(`✅ ${task.name}打卡成功`);
                Utils.log('log', `单个任务打卡成功: ${task.name}`);

                if (this.isOnline) {
                    setTimeout(() => this.autoSync(), 1000);
                }
            } catch (error) {
                Utils.log('error', `单个打卡失败: ${error.message}`);
                Utils.showToast('打卡失败，请重试');
            }
        },

        // 修复一键全打卡逻辑
        batchCheckin() {
            try {
                if (this.completedCount >= CONST.TASK_TOTAL) {
                    Utils.showToast('今日任务已全部完成');
                    return;
                }

                CONST.TASKS.forEach(task => {
                    const btnEl = Utils.getDom(`#btn-${task.id}`);
                    if (btnEl && !btnEl.classList.contains('done')) {
                        this.singleCheckin(task.id);
                    }
                });
            } catch (error) {
                Utils.log('error', `一键打卡失败: ${error.message}`);
                Utils.showToast('一键打卡失败，请重试');
            }
        },

        // 补签逻辑保持可用
        supplementCheckin() {
            try {
                // 批量保存3个任务的补签记录
                Storage.saveSupplementRecords(this.yesterdayDate);

                // 立即隐藏补签按钮
                const supplementWrap = Utils.getDom('#supplement-wrap');
                if (supplementWrap) supplementWrap.style.display = 'none';

                // 重新计算统计数据
                this.calculateStats();

                Utils.showToast('✅ 补签成功！昨日3个任务已全部打卡');
                Utils.log('log', `补签昨日成功: ${this.yesterdayDate}`);

                // 在线时同步补签记录
                if (this.isOnline) {
                    setTimeout(() => this.autoSync(), 1000);
                }
            } catch (error) {
                Utils.log('error', `补签失败: ${error.message}`);
                Utils.showToast('补签失败，请重试');
            }
        },

        renderFromLocalStorage() {
            try {
                const records = Storage.getRecords();
                // 筛选今日普通打卡记录
                const todayRecords = records.filter(r => 
                    !r.isSupplement && r.date === this.todayDate
                );

                // 初始化今日完成数
                this.completedCount = todayRecords.length;
                // 更新今日任务按钮状态
                todayRecords.forEach(record => {
                    const task = CONST.TASKS.find(t => t.name === record.content);
                    if (task) {
                        const btnEl = Utils.getDom(`#btn-${task.id}`);
                        const statusEl = Utils.getDom(`#status-${task.id}`);
                        if (btnEl) btnEl.classList.add('done');
                        if (statusEl) statusEl.textContent = '已完成';
                    }
                });

                // 更新进度、按钮和统计
                this.updateProgress();
                this.updateAllBtnStatus();
                this.calculateStats();
                this.checkSupplementShow();
            } catch (error) {
                Utils.log('error', `渲染本地数据失败: ${error.message}`);
            }
        },

        // 判定某一天是否全勤
        isDateFullCompleted(targetDate, records) {
            const dayNormalRecords = records.filter(r => 
                !r.isSupplement && r.date === targetDate
            );
            const daySupplementRecords = records.filter(r => 
                r.isSupplement && r.targetDate === targetDate
            );
            return dayNormalRecords.length === CONST.TASK_TOTAL || daySupplementRecords.length > 0;
        },

        checkSupplementShow() {
            try {
                const records = Storage.getRecords();
                const yesterdayHasFullRecord = this.isDateFullCompleted(this.yesterdayDate, records);
                const supplementWrap = Utils.getDom('#supplement-wrap');
                if (supplementWrap) {
                    supplementWrap.style.display = yesterdayHasFullRecord ? 'none' : 'block';
                }
            } catch (error) {
                Utils.log('error', `检查补签入口失败: ${error.message}`);
            }
        },

        updateProgress() {
            const progress = Math.round((this.completedCount / CONST.TASK_TOTAL) * 100);
            const progressFill = Utils.getDom('#progress-fill');
            const progressText = Utils.getDom('#progress-text');
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `${this.completedCount}/${CONST.TASK_TOTAL}`;
        },

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

        // 统计逻辑保持正确
        calculateStats() {
            try {
                const records = Storage.getRecords();
                // 普通打卡记录数 + 补签记录数
                const normalRecords = records.filter(r => !r.isSupplement);
                const supplementRecords = records.filter(r => r.isSupplement);
                const totalCheckinCount = normalRecords.length + supplementRecords.length;

                // 计算全勤天数
                const allDates = [...new Set([
                    ...normalRecords.map(r => r.date),
                    ...supplementRecords.map(r => r.targetDate)
                ])].filter(Boolean);

                let fullDays = 0;
                const fullDayDates = [];
                allDates.forEach(date => {
                    if (this.isDateFullCompleted(date, records)) {
                        fullDays++;
                        fullDayDates.push(date);
                    }
                });

                // 计算连续全勤天数
                let streak = 0;
                const sortedFullDates = fullDayDates.sort((a, b) => new Date(b) - new Date(a));
                let lastDate = null;
                for (const date of sortedFullDates) {
                    if (!lastDate) {
                        lastDate = new Date(date);
                        streak = 1;
                    } else {
                        const currentDate = new Date(date);
                        const diff = (lastDate - currentDate) / 86400000;
                        if (diff === 1) {
                            streak++;
                            lastDate = currentDate;
                        } else {
                            break;
                        }
                    }
                }
                const streakEl = Utils.getDom('#streakNum');
                if (streakEl) streakEl.textContent = streak;

                // 计算月度统计
                const now = new Date();
                const currentMonth = now.getMonth() + 1;
                const currentYear = now.getFullYear();
                const monthTotalDays = new Date(currentYear, currentMonth, 0).getDate();

                // 本月全勤天数
                const monthFullDays = fullDayDates.filter(date => {
                    const recordDate = new Date(date);
                    return recordDate.getFullYear() === currentYear && recordDate.getMonth() + 1 === currentMonth;
                }).length;

                // 本月打卡次数 = 本月普通打卡 + 本月补签打卡
                const monthNormalCount = normalRecords.filter(r => {
                    const recordDate = new Date(r.date);
                    return recordDate.getFullYear() === currentYear && recordDate.getMonth() + 1 === currentMonth;
                }).length;
                const monthSupplementCount = supplementRecords.filter(r => {
                    const recordDate = new Date(r.targetDate);
                    return recordDate.getFullYear() === currentYear && recordDate.getMonth() + 1 === currentMonth;
                }).length;
                const monthTotalCount = monthNormalCount + monthSupplementCount;

                // 完成率 = (本月全勤天数 / 本月总天数) * 100%
                const monthRate = monthTotalDays > 0 ? Math.round((monthFullDays / monthTotalDays) * 100) : 0;

                // 更新UI
                const monthCountEl = Utils.getDom('#month-count');
                const monthFullEl = Utils.getDom('#month-full');
                const monthRateEl = Utils.getDom('#month-rate');
                if (monthCountEl) monthCountEl.textContent = monthTotalCount;
                if (monthFullEl) monthFullEl.textContent = monthFullDays;
                if (monthRateEl) monthRateEl.textContent = `${monthRate}%`;
            } catch (error) {
                Utils.log('error', `计算统计数据失败: ${error.message}`);
            }
        },

        bindEvents() {
            try {
                CONST.TASKS.forEach(task => {
                    const btn = Utils.getDom(`#btn-${task.id}`);
                    if (btn) {
                        btn.addEventListener('click', () => this.singleCheckin(task.id));
                    }
                });

                const allBtn = Utils.getDom('#btn-all');
                if (allBtn) {
                    allBtn.addEventListener('click', () => this.batchCheckin());
                }

                const supplementLink = Utils.getDom('#supplement-link');
                if (supplementLink) {
                    supplementLink.addEventListener('click', () => this.supplementCheckin());
                }

                const syncBtn = Utils.getDom('#btn-sync');
                if (syncBtn) {
                    syncBtn.addEventListener('click', () => this.manualSync());
                }
            } catch (error) {
                Utils.log('error', `绑定事件失败: ${error.message}`);
            }
        }
    };

    // ========== 6. 页面加载初始化 ==========
    document.addEventListener('DOMContentLoaded', () => {
        Checkin.init();
    });

    window.Checkin = Checkin;
    window.Utils = Utils;
})(window, document);
