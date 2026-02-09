// 引入依赖
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// 初始化应用
const app = express();
app.use(cors()); // 允许跨域请求
app.use(express.json()); // 解析JSON请求体

// 连接MongoDB
mongoose.connect('mongodb://localhost:27017/checkin_app')
    .then(() => console.log('✅ MongoDB 已成功连接'))
    .catch(err => console.error('MongoDB连接失败:', err));

// 定义打卡记录模型
const checkinSchema = new mongoose.Schema({
    username: String,
    content: String,
    date: String,
    isSupplement: Boolean,
    targetDate: String
});
// 唯一索引（避免重复记录）
checkinSchema.index({ username: 1, content: 1, date: 1, isSupplement: 1, targetDate: 1 }, { unique: true });
const Checkin = mongoose.model('Checkin', checkinSchema);

// 接口1：获取用户的所有打卡记录
app.get('/api/checkins/:username', async (req, res) => {
    try {
        const records = await Checkin.find({ username: req.params.username });
        res.json({ success: true, data: records });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 接口2：新增正常打卡记录
app.post('/api/checkin', async (req, res) => {
    try {
        const newCheckin = new Checkin({
            username: req.body.username,
            content: req.body.content,
            date: req.body.date,
            isSupplement: false,
            targetDate: req.body.date
        });
        await newCheckin.save();
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// 接口3：新增补签打卡记录
app.post('/api/checkin/supplement', async (req, res) => {
    try {
        const newCheckin = new Checkin({
            username: req.body.username,
            content: req.body.content,
            date: req.body.date, // 补签的当前日期
            isSupplement: true,
            targetDate: req.body.targetDate // 补签的目标日期
        });
        await newCheckin.save();
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// 新增接口4：检查记录是否已存在（解决重复同步问题）
app.post('/api/checkin/exists', async (req, res) => {
    try {
        const { username, content, date, isSupplement, targetDate } = req.body;
        const record = await Checkin.findOne({
            username,
            content,
            date,
            isSupplement,
            targetDate
        });
        res.json({ success: true, exists: !!record });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 启动服务
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`服务运行在 http://192.168.0.52:${PORT}`);
});
