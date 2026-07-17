# DriveWord · 开车背单词

开车通勤时自动播放英语单词，纯听觉背单词，不用看屏幕。

## 功能

- **三种学习模式**：
  - 🧠 记忆模式：分组循环 + 多轮重复 + 间隔复习
  - 👂 回忆模式：先读中文 → 沉默回忆 → 公布英文
  - ▶️ 顺序模式：逐个播放
- 4 个词库 700+ 词条：四级核心、六级核心、高频短语、商务英语
- 语音逐字母拼读，开车时纯听觉学习
- 深色护眼主题，大字号显示
- 键盘快捷键：空格播放/暂停，←→ 切换单词
- 纯前端，基于浏览器 Web Speech API，无需后端

## 技术栈

- Vite 7 + React 19 + TypeScript
- Tailwind CSS + shadcn/ui + Lucide Icons

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

构建产物在 `dist/` 目录，纯静态文件，可部署到任意静态托管平台。

## 部署

### Vercel
```bash
npx vercel --prod
```

### Netlify
```bash
npx netlify deploy --prod --dir=dist
```

### GitHub Pages
将 `dist/` 推送到 `gh-pages` 分支即可。
