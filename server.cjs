const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'feedback.json');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Initialize feedback file if not exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
}

// POST /api/feedback — 接收反馈
app.post('/api/feedback', (req, res) => {
  const { content, page } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: '反馈内容不能为空' });
  }
  const list = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  list.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    content: content.trim(),
    page: page || '/',
    time: new Date().toISOString(),
  });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
  res.json({ success: true });
});

// GET /api/feedback — 查看所有反馈（管理端）
app.get('/api/feedback', (req, res) => {
  const list = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  res.json(list);
});

// DELETE /api/feedback/:id — 删除单条反馈
app.delete('/api/feedback/:id', (req, res) => {
  const list = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const idx = list.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '未找到该反馈' });
  list.splice(idx, 1);
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
  res.json({ success: true });
});

// 管理页面
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// 静态文件（前端构建产物）
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
