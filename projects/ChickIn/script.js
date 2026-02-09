/**
 * 智能打卡助手 - 修复数据库删除后同步失败
 * 版本：1.0.19
 * 修复点：1. 同步失败自动重试 2. 清除无效同步状态 3. 优化后端错误反馈 4. 数据库重建后强制同步
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
        OFFLINE_TIP_DURATION: 3000,
        TOAST_DURATION: 2500, // 延长提示时间
        LOADING_TIMEOUT: 800,
        SYNC_DELAY: 500,
        FETCH_TIMEOUT: 8000, // 延长请求超时时间
        SYNC_RETRY_COUNT: 2 // 同步失败重试次数
    };
    CONST.TASK_TOTAL = CONST.TASKS.length;

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
        },
        fetchWithTimeout(url, options = {}) {
            return new Promise((resolve, reject) => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                    controller.abort();
                    reject(new Error('请求超时'));
                }, CONST.FETCH_TIMEOUT);
                fetch(url, { ...options, signal: controller.signal })
                    .then(res => {
                        clearTimeout(timeoutId);
                        resolve(res);
                    })
                    .catch(err => {
                        clearTimeout(timeoutId);
                        reject(err);
                    });
            });
        }
    };

    const Storage = {
        _cache: null,
        getRecords(forceRefresh = false) {
            if (forceRefresh) this._cache = null;
            if (this._cache) return [...this._cache];
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
                r.username === CONST.USERNAME &&
                r.content === completeRecord.content && 
                r.date === completeRecord.date && 
                r.isSupplement === completeRecord.isSupplement &&
                r.targetDate === completeRecord.targetDate
            );
            if (isDuplicate) return;

            this._cache.push(completeRecord);
            this._setItem(`${ENV.STORAGE_PREFIX}records_${CONST.USERNAME}`, JSON.stringify(this._cache));
        },
        _setItem(key, value) {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (e) {
                Utils.log('error', '存储溢出：', e);
                Utils.showToast('本地存储已满，无法保存新记录');
                return false;
            }
        },
        saveSupplementRecords(targetDate) {
            const hasSupplement = this.getRecords().some(r => 
                r.username === CONST.USERNAME && r.isSupplement && r.targetDate === targetDate
            );
            if (hasSupplement) return;

            CONST.TASKS.forEach(task => {
                const recordId = `${CONST.USERNAME}_supplement_${task.id}_${targetDate}_${Date.now()}`;
                this.saveRecord({
                    id: recordId,
                    username: CONST.USERNAME,
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
            this._setItem(`${ENV.STORAGE_PREFIX}records_${CONST.USERNAME}`, JSON.stringify(this._cache));
        },
        // 新增：清除所有同步状态（数据库删除后调用）
        clearAllSyncStatus() {
            this._cache.forEach(record => record.isSynced = false);
            this._setItem(`${ENV.STORAGE_PREFIX}records_${CONST.USERNAME}`, JSON.stringify(this._cache));
            Utils.showToast('已重置同步状态，将重新同步所有数据');
        }
    };

    const Checkin = {
        todayDate: '',
        yesterdayDate: '',
        completedCount: 0,
        isOnline: false,
        loadingTimer: null,
        hasInitedSync: false,
        isSyncing: false,

        async init() {
            const startTime = Date.now();
            const today = new Date();
            this.todayDate = Utils.formatDate(today);
            this.yesterdayDate = Utils.formatDate(new Date(today - 86400000));
            const isGithubPages = window.location.host.includes('github.io');
            
            const dateEl = Utils.getDom('#currentDate');
            dateEl && (dateEl.textContent = Utils.formatShowDate(today));

            const records = Storage.getRecords();
            this.renderBasicUI(records);
            this.renderComplexStats(records);
            this.bindEvents();

            let loadingShown = false;
            this.loadingTimer = setTimeout(() => {
                if (!isGithubPages) {
                    Utils.showLoading();
                    loadingShown = true;
                }
            }, CONST.LOADING_TIMEOUT);

            try {
                this.isOnline = await this.checkBackendConn();
                this.checkNetworkStatus();

                // 数据库删除后，首次同步失败时自动重置同步状态
                if (this.isOnline && !this.hasInitedSync) {
                    const testRes = await Utils.fetchWithTimeout(`${ENV.BASE_URL}/checkins/${CONST.USERNAME}`);
                    if (!testRes.ok) {
                        Storage.clearAllSyncStatus();
                    }
                    Utils.showToast('已连接云端，自动同步历史数据');
                    await this.autoSync();
                    this.hasInitedSync = true;
                    const newRecords = Storage.getRecords(true);
                    this.renderBasicUI(newRecords);
                    this.renderComplexStats(newRecords);
                } else if (this.isOnline) {
                    Utils.showToast('云端已连接，打卡将自动同步');
                } else {
                    Utils.showToast('本地模式，数据仅存设备');
                }
            } catch (e) {
                this.isOnline = false;
                Utils.log('error', '云端连接检测失败：', e);
                Utils.showToast('本地模式，数据仅存设备');
            } finally {
                clearTimeout(this.loadingTimer);
                if (loadingShown) {
                    Utils.hideLoading();
                }
            }

            Utils.log('log', `初始化完成，耗时 ${Date.now() - startTime}ms`);
        },

        renderBasicUI(records) {
            const todayDoneTasks = records
                .filter(r => !r.isSupplement && r.date === this.todayDate && r.username === CONST.USERNAME)
                .map(r => r.content);
            
            this.completedCount = todayDoneTasks.length;

            CONST.TASKS.forEach(task => {
                const isDone = todayDoneTasks.includes(task.name);
                const btn = Utils.getDom(`#btn-${task.id}`);
                const status = Utils.getDom(`#status-${task.id}`);
                if (btn) {
                    isDone ? btn.classList.add('done') : btn.classList.remove('done');
                    btn.disabled = isDone;
                }
                if (status) status.textContent = isDone ? '已完成' : '待完成';
            });

            const progress = Math.round((this.completedCount / CONST.TASK_TOTAL) * 100);
            const progressFill = Utils.getDom('#progress-fill');
            const progressText = Utils.getDom('#progress-text');
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `${this.completedCount}/${CONST.TASK_TOTAL}`;

            this.updateAllBtnStatus();
            this.judgeSupplementShow(records);
        },

        renderComplexStats(records) {
            const stats = this.calculateStats(records);
            const streakEl = Utils.getDom('#streakNum');
            const monthFullEl = Utils.getDom('#month-full');
            const monthCountEl = Utils.getDom('#month-count');
            const monthRateEl = Utils.getDom('#month-rate');
            
            streakEl && (streakEl.textContent = stats.streak);
            monthFullEl && (monthFullEl.textContent = stats.monthFullDays);
            monthCountEl && (monthCountEl.textContent = stats.monthTotalCount);
            monthRateEl && (monthRateEl.textContent = `${stats.monthRate}%`);
        },

        calculateStats(records) {
            const userRecords = records.filter(r => r.username === CONST.USERNAME);
            const normalRecords = userRecords.filter(r => !r.isSupplement);
            const supplementRecords = userRecords.filter(r => r.isSupplement);
            const allDates = [...new Set([...normalRecords.map(r => r.date), ...supplementRecords.map(r => r.targetDate)])].filter(Boolean);

            const fullDayDates = allDates.filter(date => {
                const normalDone = normalRecords.filter(r => r.date === date).length === CONST.TASK_TOTAL;
                const supplementDone = supplementRecords.some(r => r.targetDate === date);
                return normalDone || supplementDone;
            });

            let streak = 0;
            if (fullDayDates.length === 0) {
                return { streak: 0, monthFullDays: 0, monthTotalCount: 0, monthRate: 0 };
            }
            const sortedDates = fullDayDates.sort((a,b) => new Date(b) - new Date(a));
            let lastDate = new Date(sortedDates[0]);
            streak = 1;
            for (let i = 1; i < sortedDates.length; i++) {
                const currentDate = new Date(sortedDates[i]);
                const diff = (lastDate - currentDate) / 86400000;
                if (diff === 1) {
                    streak++;
                    lastDate = currentDate;
                } else break;
            }

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

        checkBackendConn() {
            return new Promise((resolve) => {
                Utils.fetchWithTimeout(`${ENV.BASE_URL}/checkins/${CONST.USERNAME}`, { method: 'GET' })
                    .then(res => resolve(res.ok))
                    .catch(() => {
                        // 重试1次避免偶发波动
                        Utils.fetchWithTimeout(`${ENV.BASE_URL}/checkins/${CONST.USERNAME}`, { method: 'GET' })
                            .then(res => resolve(res.ok))
                            .catch(() => resolve(false));
                    });
            });
        },

        checkNetworkStatus() {
            window.addEventListener('online', () => {
                this.isOnline = true;
                const offlineTip = Utils.getDom('#offlineTip');
                offlineTip && (offlineTip.style.display = 'none');
                if (!this.hasInitedSync) {
                    Utils.showToast('网络恢复，自动同步本地数据');
                    this.autoSync();
                    this.hasInitedSync = true;
                } else if (!this.isSyncing) {
                    Utils.showToast('网络恢复，打卡将自动同步');
                    this.autoSync();
                }
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
                Utils.showToast('网络断开，仅本地存储');
            });
        },

        // 新增：单个记录同步（支持重试）
        async syncSingleRecord(record, retryCount = 0) {
            const url = record.isSupplement 
                ? `${ENV.BASE_URL}/checkin/supplement` 
                : `${ENV.BASE_URL}/checkin`;
            try {
                const res = await Utils.fetchWithTimeout(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: CONST.USERNAME,
                        content: record.content,
                        date: record.date,
                        targetDate: record.targetDate
                    })
                });
                const result = await res.json();
                if (res.ok && result.success) {
                    Storage.updateSyncStatus(record.id);
                    return true;
                } else {
                    // 后端返回错误（如集合不存在），重试
                    if (retryCount < CONST.SYNC_RETRY_COUNT) {
                        Utils.log('warn', `同步重试 ${retryCount+1} 次: ${record.content}`);
                        return this.syncSingleRecord(record, retryCount + 1);
                    } else {
                        Utils.log('error', `同步失败（后端错误）: ${JSON.stringify(result)}`);
                        Utils.showToast(`同步失败：${result.message || '后端服务异常'}`);
                        return false;
                    }
                }
            } catch (e) {
                // 网络异常，重试
                if (retryCount < CONST.SYNC_RETRY_COUNT) {
                    Utils.log('warn', `同步重试 ${retryCount+1} 次（网络异常）: ${record.content}`);
                    return this.syncSingleRecord(record, retryCount + 1);
                } else {
                    Utils.log('error', `同步失败（网络异常）: ${e.message}`);
                    return false;
                }
            }
        },

        async autoSync() {
            if (!this.isOnline || this.isSyncing) return;
            this.isSyncing = true;
            // 数据库删除后，强制同步所有本地记录（不管之前是否标记为已同步）
            const records = Storage.getRecords().filter(r => r.username === CONST.USERNAME);
            if (!records.length) {
                Utils.showToast('无本地数据可同步');
                this.isSyncing = false;
                return;
            }

            let successCount = 0;
            for (const record of records) {
                const isSuccess = await this.syncSingleRecord(record);
                if (isSuccess) successCount++;
            }

            if (successCount > 0) {
                Utils.showToast(`成功同步 ${successCount}/${records.length} 条数据`);
            } else {
                Utils.showToast('所有数据同步失败，请检查后端服务');
            }
            this.renderBasicUI(Storage.getRecords(true));
            this.renderComplexStats(Storage.getRecords(true));
            this.isSyncing = false;
        },

        manualSync() {
            // 手动同步时，先检测后端是否正常
            this.checkBackendConn().then((isRealOnline) => {
                if (isRealOnline) {
                    this.isOnline = true;
                    Utils.showLoading();
                    // 数据库删除后，手动同步强制重置所有同步状态
                    Storage.clearAllSyncStatus();
                    this.autoSync().finally(() => {
                        Utils.hideLoading();
                    });
                } else {
                    Utils.showToast('当前离线，无法同步');
                }
            });
        },

        singleCheckin(taskId) {
            const btn = Utils.getDom(`#btn-${taskId}`);
            if (btn && (btn.classList.contains('done') || btn.disabled)) return;
            btn.disabled = true;
            const task = CONST.TASKS.find(t => t.id === taskId);
            if (!task) return;

            const recordId = `${CONST.USERNAME}_${task.id}_${this.todayDate}_${Date.now()}`;
            Storage.saveRecord({
                id: recordId,
                username: CONST.USERNAME,
                content: task.name,
                date: this.todayDate,
                isSupplement: false
            });

            btn.classList.add('done');
            const status = Utils.getDom(`#status-${taskId}`);
            status && (status.textContent = '已完成');

            this.completedCount++;
            const progress = Math.round((this.completedCount / CONST.TASK_TOTAL) * 100);
            const progressFill = Utils.getDom('#progress-fill');
            const progressText = Utils.getDom('#progress-text');
            progressFill && (progressFill.style.width = `${progress}%`);
            progressText && (progressText.textContent = `${this.completedCount}/${CONST.TASK_TOTAL}`);

            this.updateAllBtnStatus();
            this.renderComplexStats(Storage.getRecords(true));

            Utils.showToast(`✅ ${task.name}打卡成功`);
            setTimeout(() => btn.disabled = false, 800);

            if (this.isOnline && !this.isSyncing) {
                setTimeout(() => this.autoSync(), CONST.SYNC_DELAY);
            }
        },

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

        supplementCheckin() {
            Storage.saveSupplementRecords(this.yesterdayDate);
            
            const supplementWrap = Utils.getDom('#supplement-wrap');
            supplementWrap && (supplementWrap.style.display = 'none');

            this.renderComplexStats(Storage.getRecords(true));
            Utils.showToast('✅ 补签成功！昨日任务已全部打卡');

            if (this.isOnline && !this.isSyncing) {
                setTimeout(() => this.autoSync(), CONST.SYNC_DELAY);
            }
        },

        updateAllBtnStatus() {
            const allBtn = Utils.getDom('#btn-all');
            if (!allBtn) return;
            if (this.completedCount >= CONST.TASK_TOTAL) {
                allBtn.textContent = '✅ 今日已打卡';
                allBtn.classList.add('done');
                allBtn.disabled = true;
            } else {
                allBtn.textContent = '✨ 一键全打卡';
                allBtn.classList.remove('done');
                allBtn.disabled = false;
            }
        },

        judgeSupplementShow(records) {
            const supplementWrap = Utils.getDom('#supplement-wrap');
            if (!supplementWrap) return;
            const userRecords = records.filter(r => r.username === CONST.USERNAME);
            
            const yesterdayNormalDone = userRecords.filter(
                r => !r.isSupplement && r.date === this.yesterdayDate
            ).length === CONST.TASK_TOTAL;
            const yesterdayHasSupplement = userRecords.some(
                r => r.isSupplement && r.targetDate === this.yesterdayDate
            );
            const needSupplement = !yesterdayNormalDone && !yesterdayHasSupplement;
            supplementWrap.style.display = needSupplement ? 'block' : 'none';
        },

        bindEvents() {
            CONST.TASKS.forEach(task => {
                const btn = Utils.getDom(`#btn-${task.id}`);
                btn && btn.addEventListener('click', () => this.singleCheckin(task.id));
            });

            const allBtn = Utils.getDom('#btn-all');
            allBtn && allBtn.addEventListener('click', () => this.batchCheckin());

            const supplementLink = Utils.getDom('#supplement-link');
            supplementLink && supplementLink.addEventListener('click', () => this.supplementCheckin());

            const syncBtn = Utils.getDom('#btn-sync');
            syncBtn && syncBtn.addEventListener('click', () => this.manualSync());
        }
    };

    document.addEventListener('DOMContentLoaded', () => Checkin.init());
    window.Checkin = Checkin;
    window.Utils = Utils;
})(window, document);
