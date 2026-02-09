const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Checkin = require('./models/Checkin.js');

const app = express();
const port = 3000;

// 开发环境跨域
app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

// 正常打卡接口
app.post('/api/checkin', async (req, res) => {
    try {
        const { username, content, date } = req.body;
        const checkin = new Checkin({ username, content, date });
        await checkin.save();
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// 补签接口
app.post('/api/checkin/supplement', async (req, res) => {
    try {
        const { username, content, date, targetDate } = req.body;
        const checkin = new Checkin({ 
            username, content, date, 
            isSupplement: true, targetDate 
        });
        await checkin.save();
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// 查询接口
app.get('/api/checkins/:username', async (req, res) => {
    try {
        const data = await Checkin.find({ username: req.params.username });
        res.json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`服务运行在 http://192.168.0.52:${port}`);
});
