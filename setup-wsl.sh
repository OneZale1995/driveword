#!/bin/bash
# ============================================================
# DriveWord - WSL 开发环境一键迁移脚本
# 用法：在 WSL 终端中运行 bash setup-wsl.sh
# ============================================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo_step() {
    echo -e "\n${BLUE}[$(date +%H:%M:%S)] $1${NC}"
}
echo_ok() {
    echo -e "${GREEN}  [OK] $1${NC}"
}
echo_warn() {
    echo -e "${YELLOW}  [!] $1${NC}"
}
echo_err() {
    echo -e "${RED}  [X] $1${NC}"
}

# ============================================================
# 1. 确认 WSL 环境
# ============================================================
echo_step "步骤 1/7：检查 WSL 环境"

if [ ! -f /proc/version ] || ! grep -qi microsoft /proc/version; then
    echo_err "当前不在 WSL 环境中！请在 WSL 终端里运行此脚本。"
    exit 1
fi

WSL_DISTRO=$(cat /etc/os-release | grep "^PRETTY_NAME" | cut -d'"' -f2)
echo_ok "WSL 发行版：$WSL_DISTRO"
echo_ok "用户：$(whoami)"
echo_ok "Home 目录：$HOME"

# ============================================================
# 2. 安装 Node.js（通过 nvm）
# ============================================================
echo_step "步骤 2/7：检查 / 安装 Node.js"

export NVM_DIR="$HOME/.nvm"

if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
fi

if command -v node &> /dev/null; then
    NODE_VER=$(node --version)
    NPM_VER=$(npm --version)
    echo_ok "Node.js 已安装：$NODE_VER (npm $NPM_VER)"
else
    echo_warn "Node.js 未安装，正在通过 nvm 安装..."
    
    # 安装 nvm
    if [ ! -s "$NVM_DIR/nvm.sh" ]; then
        echo "  正在下载 nvm..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    fi
    
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    
    # 安装 Node.js 22 LTS
    echo "  正在安装 Node.js 22 LTS..."
    nvm install 22
    nvm use 22
    nvm alias default 22
    
    # 配置 npm 镜像（国内加速）
    npm config set registry https://registry.npmmirror.com
    
    echo_ok "Node.js 安装完成：$(node --version)"
fi

# 确认版本
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo_err "Node.js 版本过低（需要 >= 18），请升级后重试"
    exit 1
fi

# ============================================================
# 3. 复制项目到 WSL 原生文件系统
# ============================================================
echo_step "步骤 3/7：迁移项目到 WSL 文件系统"

PROJECT_DIR="$HOME/projects/driveword"
WIN_APP_PATH="/mnt/c/Users/ThinkPad/WorkBuddy/2026-07-17-08-31-09/app"

if [ ! -d "$WIN_APP_PATH" ]; then
    echo_err "找不到 Windows 项目目录：$WIN_APP_PATH"
    echo "  请确认项目路径是否正确。"
    exit 1
fi

mkdir -p "$HOME/projects"

if [ -d "$PROJECT_DIR" ]; then
    echo_warn "目标目录已存在：$PROJECT_DIR"
    read -p "  是否覆盖？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "  跳过复制，使用现有目录。"
    else
        rm -rf "$PROJECT_DIR"
        echo "  正在复制项目文件..."
        cp -r "$WIN_APP_PATH" "$PROJECT_DIR"
        echo_ok "项目已覆盖复制到 $PROJECT_DIR"
    fi
else
    echo "  正在从 $WIN_APP_PATH 复制到 $PROJECT_DIR ..."
    cp -r "$WIN_APP_PATH" "$PROJECT_DIR"
    echo_ok "项目复制完成"
fi

# 清理 Windows 上的构建产物和依赖（WSL 中重新安装）
cd "$PROJECT_DIR"
rm -rf node_modules dist .vercel
echo_ok "已清理 Windows 构建产物"

# ============================================================
# 4. 安装项目依赖
# ============================================================
echo_step "步骤 4/7：安装 npm 依赖"

cd "$PROJECT_DIR"

# 确保使用国内镜像加速
npm config get registry | grep -q "npmmirror" || npm config set registry https://registry.npmmirror.com

echo "  正在安装依赖（可能需要 1-2 分钟）..."
npm install 2>&1 | tail -5

echo_ok "依赖安装完成"

# 安装 TypeScript（如果构建需要）
if ! npx tsc --version &> /dev/null; then
    echo "  安装 TypeScript..."
    npm install --save-dev typescript
fi

echo_ok "TypeScript 就绪"

# ============================================================
# 5. 验证构建
# ============================================================
echo_step "步骤 5/7：验证项目构建"

cd "$PROJECT_DIR"

echo "  正在构建项目..."
if npm run build 2>&1 | tail -10; then
    echo_ok "构建成功！"
    BUILD_OK=1
else
    echo_err "构建失败，请检查错误信息"
    BUILD_OK=0
fi

# ============================================================
# 6. Git 配置检查
# ============================================================
echo_step "步骤 6/7：检查 Git 配置"

cd "$PROJECT_DIR"

if ! command -v git &> /dev/null; then
    echo_warn "Git 未安装，正在安装..."
    sudo apt-get update -qq && sudo apt-get install -y -qq git
fi

GIT_NAME=$(git config user.name 2>/dev/null || echo "")
GIT_EMAIL=$(git config user.email 2>/dev/null || echo "")

if [ -z "$GIT_NAME" ] || [ -z "$GIT_EMAIL" ]; then
    echo_warn "Git 用户信息未配置"
    read -p "  请输入你的 GitHub 用户名: " GH_NAME
    read -p "  请输入你的 GitHub 邮箱: " GH_EMAIL
    git config user.name "$GH_NAME"
    git config user.email "$GH_EMAIL"
    echo_ok "Git 用户已配置：$GH_NAME <$GH_EMAIL>"
else
    echo_ok "Git 用户：$GIT_NAME <$GIT_EMAIL>"
fi

# 确认 git 仓库
if git log --oneline | head -1 &> /dev/null; then
    echo_ok "Git 历史：$(git log --oneline | wc -l) 个提交"
    git log --oneline | head -3 | while read line; do
        echo "    $line"
    done
else
    echo_warn "Git 仓库为空或不存在"
fi

# 配置 Git 换行符（WSL 中使用 LF）
git config core.autocrlf input
git config core.eol lf
echo_ok "Git 换行符已配置为 LF（Linux 风格）"

# ============================================================
# 7. 启动开发服务器
# ============================================================
echo_step "步骤 7/7：准备就绪"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  DriveWord WSL 环境配置完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  项目路径：  $PROJECT_DIR"
echo "  Node 版本： $(node --version)"
echo "  npm 版本：  $(npm --version)"
echo "  Git 分支：  $(git branch --show-current 2>/dev/null || echo 'main')"
if [ "$BUILD_OK" = "1" ]; then
    echo "  构建状态：  ✅ 通过"
else
    echo "  构建状态：  ❌ 需检查"
fi
echo ""
echo "  ────────────────────────────────────"
echo "  常用命令："
echo "    cd $PROJECT_DIR"
echo "    npm run dev        # 启动开发服务器 (http://localhost:5173)"
echo "    npm run build      # 构建生产版本"
echo "    npm run preview    # 预览构建结果"
echo ""
echo "  部署到 Vercel（需要先注册 vercel.com）："
echo "    npm i -g vercel    # 安装 Vercel CLI"
echo "    vercel login       # 浏览器登录"
echo "    vercel --prod      # 一键部署到生产环境"
echo ""
echo "  推送到 GitHub（需要先创建仓库）："
echo "    git remote add origin git@github.com:你的用户名/driveword.git"
echo "    git push -u origin main"
echo "  ────────────────────────────────────"
echo ""
echo -e "${YELLOW}提示：现在可以启动开发服务器试试：${NC}"
echo -e "  ${BLUE}cd $PROJECT_DIR && npm run dev${NC}"
echo ""
