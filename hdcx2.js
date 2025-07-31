// 配置GitHub仓库信息
const REPO_OWNER = '你的GitHub用户名';
const REPO_NAME = '你的仓库名';

// 当前用户状态
let currentUser = {
    username: null,
    token: null,
    isAuthenticated: false
};

// DOM元素
const authButtons = document.getElementById('authButtons');
const userInfo = document.getElementById('userInfo');
const userAvatar = document.getElementById('userAvatar');
const avatarText = document.getElementById('avatarText');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const postModal = document.getElementById('postModal');
const loginModal = document.getElementById('loginModal');
const postForm = document.getElementById('postForm');
const loginForm = document.getElementById('loginForm');
const newPostBtn = document.getElementById('newPostBtn');
const postsContainer = document.getElementById('postsContainer');
const closeBtns = document.querySelectorAll('.close-btn');

// 初始化函数
function init() {
    setupEventListeners();
    checkLoginStatus();
    loadPosts();
}

// 设置事件监听器
function setupEventListeners() {
    // 登录按钮
    loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(loginModal);
    });

    // 新帖子按钮
    newPostBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!currentUser.isAuthenticated) {
            showNotification('请先登录后再发表帖子');
            openModal(loginModal);
            return;
        }
        openModal(postModal);
    });

    // 关闭按钮
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            closeModal(modal);
        });
    });

    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeAllModals();
        }
    });

    // 登录表单提交
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('loginUsername');
        const token = document.getElementById('loginToken');
        
        // 简单验证
        if (!username.value || !token.value) {
            showNotification('请输入用户名和令牌');
            return;
        }
        
        // 测试令牌有效性
        try {
            const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues`, {
                headers: {
                    'Authorization': `token ${token.value}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) throw new Error('令牌验证失败');
            
            // 更新用户状态
            currentUser = {
                username: username.value,
                token: token.value,
                isAuthenticated: true
            };
            
            // 更新UI
            showUserInfo(currentUser);
            closeModal(loginModal);
            showNotification('登录成功！');
            
            // 重新加载帖子
            loadPosts();
            
        } catch (error) {
            console.error('登录失败:', error);
            showNotification('登录失败，请检查令牌是否正确');
        }
    });

    // 发表帖子表单提交
    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('postTitle');
        const category = document.getElementById('postCategory');
        const content = document.getElementById('postContent');
        
        // 验证表单
        if (!title.value || !category.value || !content.value) {
            showNotification('请填写所有必填字段');
            return;
        }
        
        try {
            // 创建新Issue
            const issue = await createIssue(title.value, content.value, category.value);
            
            if (issue) {
                // 创建关联的Discussion
                await createDiscussion(issue.number, issue.title);
                
                // 更新UI
                addPostToUI(issue);
                
                // 关闭模态框并重置表单
                closeModal(postModal);
                postForm.reset();
                
                showNotification('帖子发布成功！');
            }
        } catch (error) {
            console.error('发布失败:', error);
            showNotification('发布失败，请稍后再试');
        }
    });
}

// 从GitHub获取帖子
async function loadPosts() {
    try {
        postsContainer.innerHTML = '<div class="loading">加载中...</div>';
        
        let issues;
        
        if (currentUser.isAuthenticated) {
            // 使用认证用户获取
            const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues`, {
                headers: {
                    'Authorization': `token ${currentUser.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) throw new Error('获取帖子失败');
            issues = await response.json();
        } else {
            // 未认证用户获取（公开仓库）
            const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues`);
            
            if (!response.ok) throw new Error('获取帖子失败');
            issues = await response.json();
        }
        
        // 过滤掉pull request
        issues = issues.filter(issue => !issue.pull_request);
        
        // 清空容器
        postsContainer.innerHTML = '';
        
        if (issues.length === 0) {
            postsContainer.innerHTML = '<p>暂无帖子，快来发表第一个吧！</p>';
            return;
        }
        
        // 渲染帖子
        issues.forEach(issue => {
            addPostToUI(issue);
        });
        
    } catch (error) {
        console.error('加载帖子失败:', error);
        postsContainer.innerHTML = '<p>加载帖子失败，请刷新重试</p>';
    }
}

// 创建新Issue（帖子）
async function createIssue(title, body, label) {
    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${currentUser.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                body: `**分类**: ${label}\n\n${body}`,
                labels: [label]
            })
        });
        
        if (!response.ok) throw new Error('创建帖子失败');
        return await response.json();
    } catch (error) {
        throw error;
    }
}

// 创建关联的Discussion（用于评论）
async function createDiscussion(issueNumber, issueTitle) {
    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/discussions`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${currentUser.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: `讨论: ${issueTitle}`,
                body: `此讨论关联到Issue #${issueNumber}`,
                category: "General"
            })
        });
        
        if (!response.ok) throw new Error('创建讨论失败');
        return await response.json();
    } catch (error) {
        console.error('创建讨论失败:', error);
        return null;
    }
}

// 获取帖子的评论
async function fetchComments(issueNumber) {
    try {
        // 首先获取所有讨论
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/discussions`, {
            headers: {
                'Authorization': `token ${currentUser.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) throw new Error('获取讨论失败');
        
        const discussions = await response.json();
        
        // 找到关联的讨论
        const discussion = discussions.find(d => d.body.includes(`Issue #${issueNumber}`));
        
        if (!discussion) return [];
        
        // 获取讨论的评论
        const commentsResponse = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/discussions/${discussion.number}/comments`, {
            headers: {
                'Authorization': `token ${currentUser.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!commentsResponse.ok) throw new Error('获取评论失败');
        return await commentsResponse.json();
    } catch (error) {
        console.error('获取评论失败:', error);
        return [];
    }
}

// 添加评论
async function addComment(issueNumber, commentText) {
    try {
        // 获取所有讨论
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/discussions`, {
            headers: {
                'Authorization': `token ${currentUser.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) throw new Error('获取讨论失败');
        
        const discussions = await response.json();
        
        // 找到关联的讨论
        const discussion = discussions.find(d => d.body.includes(`Issue #${issueNumber}`));
        
        if (!discussion) throw new Error('未找到关联的讨论');
        
        // 添加评论
        const commentResponse = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/discussions/${discussion.number}/comments`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${currentUser.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                body: commentText
            })
        });
        
        if (!commentResponse.ok) throw new Error('添加评论失败');
        return await commentResponse.json();
    } catch (error) {
        throw error;
    }
}

// 将帖子添加到UI
function addPostToUI(issue) {
    const postElement = document.createElement('div');
    postElement.className = 'post';
    postElement.innerHTML = `
        <h2 class="post-title">${issue.title}</h2>
        <div class="post-meta">
            <span>作者: ${issue.user.login}</span>
            <span>发布于: ${formatDate(issue.created_at)}</span>
            <span>分类: ${issue.labels.length > 0 ? issue.labels[0].name : '未分类'}</span>
        </div>
        <div class="post-content">
            ${extractPostContent(issue.body).substring(0, 150)}${extractPostContent(issue.body).length > 150 ? '...' : ''}
        </div>
        <div class="post-actions">
            <a href="${issue.html_url}" target="_blank">阅读更多</a>
            <a href="#" class="show-comments" data-post-id="${issue.number}">评论(${issue.comments})</a>
        </div>
        <div class="comments-section" id="comments-${issue.number}" style="display: none;">
            <!-- 评论将在这里动态加载 -->
        </div>
    `;
    
    postsContainer.insertBefore(postElement, postsContainer.firstChild);
    
    // 添加评论显示/隐藏功能
    const showCommentsBtn = postElement.querySelector('.show-comments');
    showCommentsBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const postId = issue.number;
        const commentsSection = document.getElementById(`comments-${postId}`);
        
        if (commentsSection.style.display === 'none') {
            // 加载评论
            if (!commentsSection.hasChildNodes()) {
                commentsSection.innerHTML = '<div class="loading">加载评论中...</div>';
                
                try {
                    const comments = await fetchComments(postId);
                    
                    commentsSection.innerHTML = '';
                    
                    if (comments.length === 0) {
                        commentsSection.innerHTML = '<p>暂无评论</p>';
                    } else {
                        comments.forEach(comment => {
                            const commentElement = document.createElement('div');
                            commentElement.className = 'comment';
                            commentElement.innerHTML = `
                                <div class="comment-meta">
                                    <span>${comment.user.login}</span>
                                    <span>${formatDate(comment.created_at)}</span>
                                </div>
                                <div class="comment-content">${comment.body}</div>
                            `;
                            commentsSection.appendChild(commentElement);
                        });
                    }
                    
                    // 添加评论表单
                    if (currentUser.isAuthenticated) {
                        addCommentForm(postId, commentsSection);
                    }
                } catch (error) {
                    console.error('加载评论失败:', error);
                    commentsSection.innerHTML = '<p>加载评论失败</p>';
                }
            }
            
            commentsSection.style.display = 'block';
            showCommentsBtn.textContent = `隐藏评论(${issue.comments})`;
        } else {
            commentsSection.style.display = 'none';
            showCommentsBtn.textContent = `评论(${issue.comments})`;
        }
    });
}

// 添加评论表单
function addCommentForm(postId, container) {
    if (container.querySelector('.comment-form')) return;
    
    const commentForm = document.createElement('form');
    commentForm.className = 'comment-form';
    commentForm.innerHTML = `
        <div class="form-group">
            <textarea placeholder="写下你的评论..." required></textarea>
            <div class="error-message">评论不能为空</div>
        </div>
        <button type="submit" class="submit-btn">提交评论</button>
    `;
    
    commentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const textarea = commentForm.querySelector('textarea');
        const commentText = textarea.value.trim();
        
        if (!commentText) {
            commentForm.querySelector('.error-message').style.display = 'block';
            return;
        }
        
        try {
            const comment = await addComment(postId, commentText);
            
            if (comment) {
                // 刷新评论列表
                const comments = await fetchComments(postId);
                const commentsList = container.querySelector('.comment') ? container : container.querySelector('.comments-list');
                
                if (commentsList) {
                    commentsList.innerHTML = '';
                    
                    if (comments.length === 0) {
                        commentsList.innerHTML = '<p>暂无评论</p>';
                    } else {
                        comments.forEach(c => {
                            const commentElement = document.createElement('div');
                            commentElement.className = 'comment';
                            commentElement.innerHTML = `
                                <div class="comment-meta">
                                    <span>${c.user.login}</span>
                                    <span>${formatDate(c.created_at)}</span>
                                </div>
                                <div class="comment-content">${c.body}</div>
                            `;
                            commentsList.appendChild(commentElement);
                        });
                    }
                }
                
                textarea.value = '';
                showNotification('评论发表成功！');
                
                // 更新评论计数
                const showCommentsBtn = document.querySelector(`.show-comments[data-post-id="${postId}"]`);
                if (showCommentsBtn) {
                    showCommentsBtn.textContent = `评论(${comments.length})`;
                }
            }
        } catch (error) {
            console.error('发表评论失败:', error);
            showNotification('评论发表失败');
        }
    });
    
    container.appendChild(commentForm);
}

// 辅助函数：从帖子内容中提取实际内容（去掉分类信息）
function extractPostContent(body) {
    if (!body) return '';
    const parts = body.split('\n\n');
    return parts.length > 1 ? parts.slice(1).join('\n\n') : body;
}

// 辅助函数：格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 显示用户信息
function showUserInfo(user) {
    authButtons.style.display = 'none';
    userInfo.style.display = 'block';
    avatarText.textContent = user.username.charAt(0).toUpperCase();
}

// 显示登录按钮
function showAuthButtons() {
    authButtons.style.display = 'flex';
    userInfo.style.display = 'none';
}

// 检查登录状态
function checkLoginStatus() {
    // 这里可以添加从localStorage或cookie读取登录状态的逻辑
    // 目前只是简单重置
    currentUser = {
        username: null,
        token: null,
        isAuthenticated: false
    };
    showAuthButtons();
}

// 打开模态框
function openModal(modal) {
    document.body.style.overflow = 'hidden';
    modal.classList.add('active');
}

// 关闭模态框
function closeModal(modal) {
    document.body.style.overflow = '';
    modal.classList.remove('active');
}

// 关闭所有模态框
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        closeModal(modal);
    });
}

// 显示通知
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // 显示通知
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // 3秒后移除
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// 初始化应用
document.addEventListener('DOMContentLoaded', init);