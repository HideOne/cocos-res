let httpUrl = 'http://192.168.0.100:12580';
httpUrl = "";
// 任务管理
class TaskManager {
    constructor() {
        this.tasks = [];
        this.taskIdCounter = 1;
        this.serverQueueStatus = null; // 存储服务器队列状态
        this.init();
    }

    init() {
        this.setupDragAndDrop();
        this.loadTasks();
        this.updateStats();
        this.setupBeforeUnload();
        this.startQueueStatusPolling();
    }

    // 刷新队列状态（可被手动调用）
    async refreshQueueStatus() {
        try {
            const response = await fetch(httpUrl + '/api/queue/status');
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.updateQueueStatus(result);
                }
            }
        } catch (error) {
            // 静默失败，不影响用户体验
            console.debug('获取队列状态失败:', error);
        }
    }

    // 启动队列状态轮询
    startQueueStatusPolling() {
        // 立即执行一次
        this.refreshQueueStatus();

        // 每2秒更新一次队列状态
        setInterval(() => {
            this.refreshQueueStatus();
        }, 2000);
    }

    // 更新队列状态显示
    updateQueueStatus(queueStatus) {
        // 保存服务器队列状态
        this.serverQueueStatus = queueStatus;

        // 更新并发状态（如果存在）
        const concurrentStatus = document.getElementById('concurrentStatus');
        if (concurrentStatus) {
            concurrentStatus.textContent = `${queueStatus.processing}/${queueStatus.maxConcurrent}`;

            // 根据并发状态改变颜色
            const statCard = concurrentStatus.closest('.stat-card');
            if (queueStatus.processing >= queueStatus.maxConcurrent) {
                statCard.classList.add('stat-card-full');
            } else {
                statCard.classList.remove('stat-card-full');
            }
        }

        // 更新排队中的任务数（使用服务器数据）
        const queueCount = document.getElementById('queueCount');
        if (queueCount) {
            queueCount.textContent = queueStatus.waiting;
        }

        // 更新处理中的任务数（使用服务器数据）
        const processingCount = document.getElementById('processingCount');
        if (processingCount) {
            processingCount.textContent = queueStatus.processing;
        }
    }

    // 设置页面关闭前的处理
    setupBeforeUnload() {
        // 监听页面关闭事件
        window.addEventListener('beforeunload', (e) => {
            const processingTasks = this.tasks.filter(t => t.status === 'processing' && t.serverId);

            if (processingTasks.length > 0) {
                // 显示确认对话框
                e.preventDefault();
                e.returnValue = '有任务正在处理中，确定要离开吗？';

                // 异步取消任务（使用 sendBeacon 确保请求发送）
                this.cancelProcessingTasks(processingTasks);

                return '有任务正在处理中，确定要离开吗？';
            }
        });

        // 监听页面可见性变化（用户切换标签页）
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // 页面隐藏时保存状态
                this.saveTasks();
            }
        });

        // 监听页面卸载事件
        window.addEventListener('unload', () => {
            const processingTasks = this.tasks.filter(t => t.status === 'processing' && t.serverId);
            this.cancelProcessingTasks(processingTasks);
        });
    }

    // 取消正在处理的任务
    cancelProcessingTasks(tasks) {
        tasks.forEach(task => {
            if (task.serverId) {
                // 使用 sendBeacon 确保请求在页面关闭时也能发送
                const url = `${httpUrl}/api/task/${task.serverId}/cancel`;
                const success = navigator.sendBeacon(url, JSON.stringify({ reason: 'page_closed' }));

                if (!success) {
                    // 如果 sendBeacon 失败，尝试同步 fetch
                    try {
                        fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ reason: 'page_closed' }),
                            keepalive: true // 确保请求在页面关闭后继续
                        });
                    } catch (error) {
                        console.error('取消任务失败:', error);
                    }
                }
            }
        });
    }

    // 设置拖拽上传
    setupDragAndDrop() {
        const uploadZone = document.getElementById('uploadZone');

        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('drag-over');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');

            const items = e.dataTransfer.items;
            this.handleDrop(items);
        });

        uploadZone.addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
    }

    // 处理拖拽文件
    async handleDrop(items) {
        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry();

                if (entry.isDirectory) {
                    await this.handleDirectory(entry);
                } else if (entry.isFile) {
                    const file = item.getAsFile();
                    if (file.name.endsWith('.zip')) {
                        this.handleZipFile(file);
                    }
                }
            }
        }
    }

    // 处理文件夹
    async handleDirectory(dirEntry) {
        const files = await this.readDirectory(dirEntry);

        if (files.length > 0) {
            const task = {
                id: this.taskIdCounter++,
                name: dirEntry.name,
                type: 'folder',
                status: 'queue', // queue, processing, completed, failed
                progress: 0,
                files: files,
                createdAt: new Date(),
                result: null
            };

            this.addTask(task);
            showToast('success', '任务已添加', `文件夹 "${dirEntry.name}" 已加入队列`);
        }
    }

    // 读取文件夹内容
    async readDirectory(dirEntry, basePath = '') {
        const files = [];
        const reader = dirEntry.createReader();

        return new Promise((resolve) => {
            const readEntries = () => {
                reader.readEntries(async (entries) => {
                    if (entries.length === 0) {
                        resolve(files);
                        return;
                    }

                    for (const entry of entries) {
                        if (entry.isFile) {
                            const file = await new Promise((resolve) => {
                                entry.file(resolve);
                            });
                            // 手动添加完整路径信息
                            const fullPath = basePath ? `${basePath}/${entry.name}` : entry.name;
                            file.fullPath = fullPath; // 保存完整相对路径
                            files.push(file);
                        } else if (entry.isDirectory) {
                            const newBasePath = basePath ? `${basePath}/${entry.name}` : entry.name;
                            const subFiles = await this.readDirectory(entry, newBasePath);
                            files.push(...subFiles);
                        }
                    }

                    readEntries();
                });
            };

            readEntries();
        });
    }

    // 处理 ZIP 文件
    handleZipFile(file) {
        const task = {
            id: this.taskIdCounter++,
            name: file.name,
            type: 'zip',
            status: 'queue',
            progress: 0,
            file: file,
            createdAt: new Date(),
            result: null
        };

        this.addTask(task);
        showToast('success', '任务已添加', `ZIP 文件 "${file.name}" 已加入队列`);
    }

    // 添加任务
    addTask(task) {
        this.tasks.push(task);
        this.saveTasks();
        this.renderTasks();
        this.updateStats();

        // 自动开始处理
        if (this.getProcessingCount() === 0) {
            this.processNextTask();
        }
    }

    // 处理下一个任务
    async processNextTask() {
        const queuedTask = this.tasks.find(t => t.status === 'queue');

        if (!queuedTask) {
            return;
        }

        queuedTask.status = 'processing';
        this.renderTasks();
        this.updateStats();

        try {
            // 模拟处理过程（这里之后接入真实的处理逻辑）
            await this.processTask(queuedTask);

            // 检查任务是否在处理过程中被取消
            if (queuedTask.status === 'cancelled') {
                showToast('info', '任务已取消', `"${queuedTask.name}" 已被取消`);
            } else {
                queuedTask.status = 'completed';
                queuedTask.progress = 100;
                showToast('success', '处理完成', `"${queuedTask.name}" 处理成功`);
            }
        } catch (error) {
            // 检查是否是取消导致的错误
            if (error.message.includes('已被取消') || queuedTask.status === 'cancelled') {
                showToast('info', '任务已取消', `"${queuedTask.name}" 已被取消`);
            } else {
                queuedTask.status = 'failed';
                showToast('error', '处理失败', `"${queuedTask.name}" 处理出错: ${error.message}`);
            }
        }

        this.saveTasks();
        this.renderTasks();
        this.updateStats();

        // 继续处理下一个任务
        this.processNextTask();
    }

    // 处理任务
    async processTask(task) {
        try {
            // 准备上传数据
            const formData = new FormData();

            if (task.type === 'folder') {
                // 上传文件夹中的所有文件
                // 先添加所有文件
                task.files.forEach((file, index) => {
                    formData.append('files', file);
                });

                // 然后添加路径映射（作为一个 JSON 字符串）
                const pathMap = {};
                task.files.forEach((file, index) => {
                    // 使用我们保存的完整路径，或回退到 webkitRelativePath
                    const relativePath = file.fullPath || file.webkitRelativePath || file.name;
                    pathMap[index] = relativePath;
                });

                formData.append('pathMap', JSON.stringify(pathMap));
                formData.append('folderName', task.name);
                formData.append('fileCount', task.files.length.toString());

                console.log('📤 上传路径映射 (前5个):',
                    Object.entries(pathMap).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join('\n  '));
            } else {
                // 上传 ZIP 文件
                formData.append('files', task.file);
            }

            // 上传到服务器
            const uploadResponse = await fetch(httpUrl + '/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                throw new Error('上传失败');
            }

            const uploadResult = await uploadResponse.json();
            const taskId = uploadResult.taskId;
            task.serverId = taskId;
            // 轮询获取任务状态
            let completed = false;
            while (!completed) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await fetch(httpUrl + `/api/task/${taskId}`);
                if (!statusResponse.ok) {
                    throw new Error('获取任务状态失败');
                }

                const statusResult = await statusResponse.json();
                const serverTask = statusResult.task;

                task.progress = serverTask.progress;
                task.status = serverTask.status;

                this.renderTasks();

                if (serverTask.status === 'completed' || serverTask.status === 'failed' || serverTask.status === 'cancelled') {
                    completed = true;

                    // 任务完成，刷新队列状态
                    this.refreshQueueStatus();

                    if (serverTask.status === 'failed') {
                        throw new Error(serverTask.error || '处理失败');
                    }

                    if (serverTask.status === 'cancelled') {
                        throw new Error('任务已被取消');
                    }


                }
            }

        } catch (error) {
            throw error;
        }
    }

    // 删除任务
    deleteTask(taskId) {
        const index = this.tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            const task = this.tasks[index];
            this.tasks.splice(index, 1);
            this.saveTasks();
            this.renderTasks();
            this.updateStats();
            showToast('info', '任务已删除', `"${task.name}" 已从列表中移除`);
        }
    }

    // 取消任务
    async cancelTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) {
            return;
        }

        // 确认取消
        if (!confirm(`确定要取消任务 "${task.name}" 吗？`)) {
            return;
        }

        console.log("取消任务", task.serverId)
        try {
            if (task.serverId) {
                // 如果任务已经在服务器上处理，调用取消 API
                const response = await fetch(httpUrl + `/api/task/${task.serverId}/cancel`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ reason: 'user_cancelled' })
                });

                if (!response.ok) {
                    throw new Error('取消任务失败');
                }

                const result = await response.json();
                if (result.success) {
                    task.status = 'cancelled';
                    task.error = '任务已被用户取消';
                    this.saveTasks();
                    this.renderTasks();
                    this.updateStats();
                    showToast('success', '任务已取消', `"${task.name}" 已停止处理`);

                    // 刷新队列状态
                    this.refreshQueueStatus();

                    // 开始处理下一个排队的任务
                    setTimeout(() => {
                        this.processNextTask();
                    }, 100);
                } else {
                    showToast('error', '取消失败', result.message || '无法取消任务');
                }
            } else if (task.status === 'queue') {
                // 如果任务还在队列中，直接从队列中移除
                task.status = 'cancelled';
                task.error = '任务已被用户取消';
                this.saveTasks();
                this.renderTasks();
                this.updateStats();
                showToast('success', '任务已取消', `"${task.name}" 已从队列中移除`);

                // 刷新队列状态
                this.refreshQueueStatus();

                // 如果没有其他任务在处理，开始处理下一个
                if (this.getProcessingCount() === 0) {
                    this.processNextTask();
                }
            }
        } catch (error) {
            console.error('取消任务失败:', error);
            showToast('error', '取消失败', '无法取消任务，请稍后重试');
        }
    }

    // 下载结果
    async downloadResult(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task && task.status === 'completed' && task.serverId) {
            // 显示全屏加载动画
            showFullscreenLoader('正在准备下载...', '请稍候，文件正在打包中');

            try {
                // 先检查下载是否准备好
                const checkResponse = await fetch(httpUrl + `/api/task/${task.serverId}`);
                if (!checkResponse.ok) {
                    throw new Error('任务不存在');
                }

                // 显示Toast提示
                showToast('info', '开始下载', `正在下载 "${task.name}" 的处理结果`);

                // 使用隐藏的iframe进行下载，这样可以在下载开始后隐藏加载动画
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.src = httpUrl + `/api/download/${task.serverId}`;
                document.body.appendChild(iframe);

                // 延迟隐藏加载动画（给服务器一些准备时间）
                setTimeout(() => {
                    hideFullscreenLoader();
                    // 清理iframe
                    setTimeout(() => {
                        document.body.removeChild(iframe);
                    }, 5000);
                }, 3000);

            } catch (error) {
                hideFullscreenLoader();
                showToast('error', '下载失败', '无法下载文件，请重试');
                console.error('下载失败:', error);
            }
        }
    }

    // 清除已完成任务
    clearCompleted() {
        const completedCount = this.tasks.filter(t => t.status === 'completed').length;
        this.tasks = this.tasks.filter(t => t.status !== 'completed');
        this.saveTasks();
        this.renderTasks();
        this.updateStats();

        if (completedCount > 0) {
            showToast('info', '已清除', `清除了 ${completedCount} 个已完成任务`);
        }
    }

    // 清除所有任务
    clearAll() {
        if (this.tasks.length === 0) {
            return;
        }

        if (confirm('确定要清除所有任务吗？进行中的任务也会被清除。')) {
            const count = this.tasks.length;
            this.tasks = [];
            this.saveTasks();
            this.renderTasks();
            this.updateStats();
            showToast('info', '已清除', `清除了 ${count} 个任务`);
        }
    }

    // 渲染任务列表
    renderTasks() {
        const container = document.getElementById('tasksContainer');

        if (this.tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p class="empty-text">暂无任务</p>
                    <p class="empty-hint">拖拽文件到上方区域开始处理</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.tasks.map(task => this.renderTask(task)).join('');
    }

    // 渲染单个任务
    renderTask(task) {
        const statusClass = `status-${task.status}`;
        const statusText = {
            queue: '排队中',
            processing: '处理中',
            completed: '已完成',
            failed: '失败',
            cancelled: '已取消'
        }[task.status];

        const typeIcon = task.type === 'folder' ? '📁' : '📦';
        const time = this.formatTime(task.createdAt);

        let progressHtml = '';
        if (task.status === 'processing') {
            progressHtml = `
                <div class="task-progress">
                    <div class="progress-info">
                        <span class="progress-text">处理进度</span>
                        <span class="progress-percent">${task.progress}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${task.progress}%"></div>
                    </div>
                </div>
            `;
        }

        let actionsHtml = '';
        if (task.status === 'completed') {
            actionsHtml = `
                <div class="task-actions">
                    <button class="task-btn task-btn-download" onclick="taskManager.downloadResult(${task.id})">
                        📥 下载结果
                    </button>
                    <button class="task-btn task-btn-delete" onclick="taskManager.deleteTask(${task.id})">
                        🗑️ 删除
                    </button>
                </div>
            `;
        } else if (task.status === 'failed' || task.status === 'cancelled') {
            actionsHtml = `
                <div class="task-actions">
                    <button class="task-btn task-btn-delete" onclick="taskManager.deleteTask(${task.id})">
                        🗑️ 删除
                    </button>
                </div>
            `;
        } else if (task.status === 'processing' || task.status === 'queue') {
            actionsHtml = `
                <div class="task-actions">
                    <button class="task-btn task-btn-cancel" onclick="taskManager.cancelTask(${task.id})">
                        ⛔ 取消任务
                    </button>
                </div>
            `;
        }

        return `
            <div class="task-item">
                <div class="task-header">
                    <div class="task-info">
                        <div class="task-name">${typeIcon} ${task.name}</div>
                        <div class="task-meta">创建时间: ${time}</div>
                    </div>
                    <div class="task-status ${statusClass}">${statusText}</div>
                </div>
                ${progressHtml}
                ${actionsHtml}
            </div>
        `;
    }

    // 更新统计信息
    updateStats() {
        // 排队中和处理中的数据优先使用服务器数据（如果可用）
        if (this.serverQueueStatus) {
            document.getElementById('queueCount').textContent = this.serverQueueStatus.waiting;
            console.log("排队中", this.serverQueueStatus.waiting)
            document.getElementById('processingCount').textContent = this.serverQueueStatus.processing;
        } else {
            // 备用方案：使用本地数据
            document.getElementById('queueCount').textContent = this.getQueueCount();
            document.getElementById('processingCount').textContent = this.getProcessingCount();
        }

        // 已完成和失败的数据使用本地统计
        document.getElementById('completedCount').textContent = this.getCompletedCount();
        document.getElementById('failedCount').textContent = this.getFailedCount();
    }

    getQueueCount() {
        return this.tasks.filter(t => t.status === 'queue').length;
    }

    getProcessingCount() {
        return this.tasks.filter(t => t.status === 'processing').length;
    }

    getCompletedCount() {
        return this.tasks.filter(t => t.status === 'completed').length;
    }

    getFailedCount() {
        return this.tasks.filter(t => t.status === 'failed').length;
    }

    // 格式化时间
    formatTime(date) {
        const d = new Date(date);
        return d.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 保存任务到本地存储
    saveTasks() {
        const tasksToSave = this.tasks.map(task => ({
            ...task,
            files: undefined, // 不保存文件对象
            file: undefined
        }));
        localStorage.setItem('cocos-tasks', JSON.stringify(tasksToSave));
    }

    // 加载任务
    loadTasks() {
        const saved = localStorage.getItem('cocos-tasks');
        if (saved) {
            try {
                const tasks = JSON.parse(saved);
                // 只加载已完成和失败的任务
                this.tasks = tasks.filter(t => t.status === 'completed' || t.status === 'failed');
                this.renderTasks();
            } catch (e) {
                console.error('加载任务失败:', e);
            }
        }
    }
}

// Toast 通知
function showToast(type, title, message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    }[type] || 'ℹ️';

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // 3秒后自动移除
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(400px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 全屏加载动画
function showFullscreenLoader(text = '正在处理...', hint = '请稍候') {
    const loader = document.getElementById('fullscreenLoader');
    const loaderText = loader.querySelector('.loader-text');
    const loaderHint = loader.querySelector('.loader-hint');

    if (loaderText) loaderText.textContent = text;
    if (loaderHint) loaderHint.textContent = hint;

    loader.classList.add('active');
}

function hideFullscreenLoader() {
    const loader = document.getElementById('fullscreenLoader');
    loader.classList.remove('active');
}

// 全局函数
function selectFolder() {
    const input = document.getElementById('fileInput');
    input.click();

    input.onchange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            const folderName = files[0].webkitRelativePath.split('/')[0];
            const task = {
                id: taskManager.taskIdCounter++,
                name: folderName,
                type: 'folder',
                status: 'queue',
                progress: 0,
                files: files,
                createdAt: new Date(),
                result: null
            };
            taskManager.addTask(task);
        }
    };
}

function selectZip() {
    const input = document.getElementById('zipInput');
    input.click();

    input.onchange = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (file.name.endsWith('.zip')) {
                taskManager.handleZipFile(file);
            }
        });
    };
}

function clearCompleted() {
    taskManager.clearCompleted();
}

function clearAll() {
    taskManager.clearAll();
}

// 初始化
const taskManager = new TaskManager();

// 页面加载完成提示
window.addEventListener('load', () => {
    showToast('info', '欢迎使用', 'Cocos 资源处理中心已就绪');
});
