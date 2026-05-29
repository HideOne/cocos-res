/**
 * Cocos 资源处理服务器
 * 接收网页上传的文件夹或 ZIP 文件，保存到 res 目录并处理
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import { dealRes } from './dealRes';
import { runAstcToPngWorkflow } from './astcToPng';

// 禁用 sharp(libvips) 的文件缓存，防止 Windows 上文件句柄未释放导致 EBUSY
sharp.cache(false);

const app = express();

// 加载配置文件
let CONFIG = {
    MAX_CONCURRENT_TASKS: 6, // 最大并发任务数（默认值） 
    PORT: 3000
};

try {
    const configPath = path.join(__dirname, '..', 'config.json');
    if (fs.existsSync(configPath)) {
        const configFile = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (configFile.server) {
            CONFIG.MAX_CONCURRENT_TASKS = configFile.server.maxConcurrentTasks || 2;
            CONFIG.PORT = configFile.server.port || 3000;
            console.log(`📋 从配置文件加载: 最大并发数 ${CONFIG.MAX_CONCURRENT_TASKS}, 端口 ${CONFIG.PORT}`);
        }
    }
} catch (error) {
    console.warn('⚠️  加载配置文件失败，使用默认配置');
}

// 项目根目录
const ROOT_DIR = path.resolve(__dirname, '..');
const RES_DIR = path.join(ROOT_DIR, 'res');
const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads');
const STATIC_DIR = path.join(ROOT_DIR, 'static');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');

/**
 * 带重试的目录/文件删除，解决 Windows 上 EBUSY 文件句柄未释放问题
 */
function rmSyncRetry(target: string, options?: fs.RmOptions, maxRetries = 5): void {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (fs.existsSync(target)) {
                fs.rmSync(target, options ?? {});
            }
            return;
        } catch (err: any) {
            if ((err.code === 'EBUSY' || err.code === 'EPERM') && attempt < maxRetries) {
                const delayMs = 500 * (attempt + 1);
                console.warn(`⚠️  文件被占用，${delayMs}ms 后重试 (${attempt + 1}/${maxRetries}): ${err.path || target}`);
                // 同步等待一段时间再重试
                const waitUntil = Date.now() + delayMs;
                while (Date.now() < waitUntil) { /* busy wait */ }
            } else {
                throw err;
            }
        }
    }
}

// 确保必要的目录存在
[RES_DIR, UPLOAD_DIR, OUTPUT_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// 配置文件上传
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // 保持原始文件名，添加时间戳避免冲突
        const timestamp = Date.now();
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, `${timestamp}-${originalName}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 500 * 1024 * 1024 // 限制 500MB
    }
});

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(STATIC_DIR));

// CORS 支持
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// 任务队列
interface Task {
    id: string;
    name: string;
    type: 'folder' | 'zip';
    status: 'queue' | 'processing' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    error?: string;
    outputPath?: string;
    zipPath?: string; // 预生成的ZIP文件路径
    createdAt: Date;
    cancelled?: boolean; // 是否被取消
}

interface TaskQueueItem {
    taskId: string;
    files: Express.Multer.File[];
    isZip: boolean;
    filePathMap?: Map<string, string>;
}

const tasks: Map<string, Task> = new Map();
const taskQueue: TaskQueueItem[] = []; // 等待处理的任务队列
let processingCount = 0; // 当前正在处理的任务数

/**
 * 获取当前正在处理的任务数量
 */
function getProcessingTaskCount(): number {
    return Array.from(tasks.values()).filter(t => t.status === 'processing').length;
}

/**
 * 检查是否可以开始新任务
 */
function canStartNewTask(): boolean {
    return getProcessingTaskCount() < CONFIG.MAX_CONCURRENT_TASKS;
}

/**
 * 尝试启动下一个排队的任务
 */
function tryStartNextTask() {
    if (taskQueue.length === 0) {
        return;
    }

    if (!canStartNewTask()) {
        console.log(`⏸️  达到最大并发数 ${CONFIG.MAX_CONCURRENT_TASKS}，任务排队中...`);
        return;
    }

    const nextItem = taskQueue.shift();
    if (nextItem) {
        console.log(`▶️  开始处理排队任务 (剩余队列: ${taskQueue.length})`);
        processTask(nextItem.taskId, nextItem.files, nextItem.isZip, nextItem.filePathMap);
    }
}

/**
 * 上传文件接口
 */
app.post('/api/upload', upload.array('files'), async (req: Request, res: Response) => {
    try {
        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: '没有上传文件'
            });
        }

        console.log(`\n📤 接收到 ${files.length} 个文件`);

        // 判断是 ZIP 还是文件夹
        const isZip = files.length === 1 && files[0].originalname.endsWith('.zip');
        const taskId = req.body.id || Date.now().toString();

        const task: Task = {
            id: taskId,
            name: isZip ? files[0].originalname : (req.body.folderName || '未命名文件夹'),
            type: isZip ? 'zip' : 'folder',
            status: 'queue',
            progress: 0,
            createdAt: new Date()
        };

        tasks.set(taskId, task);

        // 保存文件路径映射（用于保持目录结构）
        const filePathMap = new Map<string, string>();
        if (!isZip && req.body.pathMap) {
            try {
                const pathMap = JSON.parse(req.body.pathMap);
                console.log(`📋 解析路径映射，共 ${Object.keys(pathMap).length} 个条目`);

                Object.entries(pathMap).forEach(([index, relativePath]) => {
                    const idx = parseInt(index);
                    if (files[idx]) {
                        filePathMap.set(files[idx].filename, relativePath as string);
                        if (idx < 5) { // 只显示前5个
                            console.log(`   [${idx}]: ${files[idx].filename} -> ${relativePath}`);
                        }
                    }
                });

                if (Object.keys(pathMap).length > 5) {
                    console.log(`   ... 还有 ${Object.keys(pathMap).length - 5} 个文件`);
                }

                console.log(`✅ 建立了 ${filePathMap.size} 个路径映射`);
            } catch (error) {
                console.error('❌ 解析路径映射失败:', error);
            }
        }

        // 将任务加入队列
        // 先排除已存在相同 taskId 的任务
        const existIdx = taskQueue.findIndex(item => item.taskId === taskId);
        if (existIdx == -1) {
            // taskQueue.splice(existIdx, 1);
            taskQueue.push({
                taskId,
                files,
                isZip,
                filePathMap
            });
        }


        const currentProcessing = getProcessingTaskCount();
        const queuePosition = taskQueue.length;

        console.log(`📊 当前状态: 处理中 ${currentProcessing}/${CONFIG.MAX_CONCURRENT_TASKS}, 队列中 ${queuePosition}`);

        // 尝试立即启动任务（如果未达到并发限制）
        tryStartNextTask();

        res.json({
            success: true,
            taskId,
            message: canStartNewTask()
                ? (isZip ? 'ZIP 文件已接收，开始处理' : '文件夹已接收，开始处理')
                : `任务已加入队列，当前排队位置: ${queuePosition}`
        });

    } catch (error) {
        console.error('上传失败:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : '上传失败'
        });
    }
});

/**
 * 处理任务
 */
async function processTask(taskId: string, files: Express.Multer.File[], isZip: boolean, filePathMap?: Map<string, string>) {
    const task = tasks.get(taskId);
    if (!task) return;
    let targetDir = '';
    let folderName = ""
    let outPath = ""
    try {
        task.status = 'processing';
        task.progress = 0;
        task.cancelled = false;
        console.log(`\n⚙️  开始处理任务: ${task.name}`);



        // 检查是否已取消
        if (task.cancelled) {
            throw new Error('任务已被取消');
        }

        if (isZip) {
            // 处理 ZIP 文件
            const zipFile = files[0];
            console.log(`📦 解压 ZIP: ${zipFile.originalname}`);

            targetDir = await extractZip(zipFile.path, RES_DIR);
            task.progress = 0;

            // 检查是否已取消
            if (task.cancelled) {
                throw new Error('任务已被取消');
            }

            // 删除原 ZIP 文件
            fs.unlinkSync(zipFile.path);
            console.log(`🗑️  已删除原 ZIP 文件`);

        } else {
            // 处理文件夹
            console.log(`📁 处理文件夹，共 ${files.length} 个文件`);

            // 创建目标目录
            folderName = task.name.replace(/[<>:"/\\|?*]/g, '_');
            targetDir = path.join(RES_DIR, taskId + '', folderName);

            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // 复制所有文件，保持目录结构
            console.log(`\n📂 开始复制文件，保持目录结构...`);

            for (let i = 0; i < files.length; i++) {
                // 每处理100个文件检查一次是否取消
                if (task.cancelled) {
                    throw new Error('任务已被取消');
                }

                const file = files[i];

                // 从映射中获取原始相对路径
                let relativePath = filePathMap?.get(file.filename);

                if (!relativePath) {
                    console.log(`⚠️  警告: 文件 ${file.filename} 没有找到路径映射`);
                    relativePath = file.originalname;
                }


                const targetPath = path.join(targetDir, relativePath);

                // 只显示前10个和后10个文件
                if (i < 10 || i >= files.length - 10) {
                    console.log(`  📄 [${i + 1}/${files.length}] ${relativePath}`);
                } else if (i === 10) {
                    console.log(`  ... 省略 ${files.length - 20} 个文件 ...`);
                }

                // 确保目标目录存在
                const targetFileDir = path.dirname(targetPath);
                if (!fs.existsSync(targetFileDir)) {
                    fs.mkdirSync(targetFileDir, { recursive: true });
                }

                // 移动文件
                try {
                    fs.renameSync(file.path, targetPath);
                } catch {
                    console.warn(`❌ 移动文件失败: ${file.path} -> ${targetPath}`);
                }

                // task.progress = (40 + (i / files.length) * 30);
            }
        }

        // 检查 targetDir 下是否有 config.json 文件
        const configJsonPath = path.join(targetDir, 'config.json');
        if (!fs.existsSync(configJsonPath)) {
            throw new Error(`找不到 config.json，请检查文件夹是否正确`);
        }

        // 检查是否已取消
        if (task.cancelled) {
            throw new Error('任务已被取消');
        }

        task.progress = 10;
        console.log(`✅ 文件已保存到: ${targetDir}`);

        // 调用处理逻辑
        console.log(`🔧 开始处理资源...`);
        outPath = path.join(ROOT_DIR, 'out', folderName);

        // 检查是否已取消
        if (task.cancelled) {
            throw new Error('任务已被取消');
        }

        await runAstcToPngWorkflow(targetDir, (progress) => {
            if (task.cancelled) {
                throw new Error('任务已被取消 runAstcToPngWorkflow');
            }
            task.progress = 10 + Math.floor(progress * 0.4);

        });

        // 检查是否已取消
        if (task.cancelled) {
            throw new Error('任务已被取消');
        }

        await dealRes(targetDir, outPath, (progress) => {
            if (task.cancelled) {
                console.log("任务已经取消")
                throw new Error('任务已被取消');
            }
            task.progress = 40 + Math.floor(progress * 0.5);
        });

        // 检查是否已取消
        if (task.cancelled) {
            throw new Error('任务已被取消');
        }

        task.progress = 90;
        console.log(`📦 开始生成下载压缩包...`);

        // 立即生成ZIP压缩包
        const zipFileName = `${folderName}.zip`;
        const zipPath = path.join(OUTPUT_DIR, zipFileName);

        // try {
        //     const zip = new AdmZip();

        //     if (fs.existsSync(outPath)) {
        //         addFolderToZip(zip, outPath, '');
        //         await zip.writeZipPromise(zipPath);

        //         console.log(`✅ ZIP压缩包已生成: ${zipPath}`);
        //         task.zipPath = zipPath;
        //     } else {
        //         console.warn(`⚠️  输出目录不存在，跳过ZIP生成: ${outPath}`);
        //     }
        // } catch (zipError) {
        //     console.error(`❌ 生成ZIP失败:`, zipError);
        //     // ZIP生成失败不影响任务完成状态
        // }

        task.progress = 100;
        task.status = 'completed';
        task.outputPath = outPath;

        // rmSyncRetry(targetDir, { recursive: true });
        console.log(`✅ 任务完成: ${task.name}\n`);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '处理失败';

        if (task.cancelled || errorMessage.includes('已被取消')) {
            console.log(`🚫 任务已取消: ${task.name}`);
            task.status = 'cancelled';
            task.error = '任务已被用户取消';
        } else {
            console.error(`❌ 任务失败:`, error);
            task.status = 'failed';
            task.error = errorMessage;
        }

        task.progress = 0;
        // rmSyncRetry(targetDir, { recursive: true }); 
        // // 清理临时文件
        // try {
        //     if (files && files.length > 0) {
        //         files.forEach(file => {
        //             if (fs.existsSync(file.path)) {
        //                 fs.unlinkSync(file.path);
        //             }
        //         });
        //     }
        // } catch (cleanupError) {
        //     console.error('清理临时文件失败:', cleanupError);
        // }
    } finally {
        // rmSyncRetry(outPath, { recursive: true });
        // rmSyncRetry(targetDir, { recursive: true });
        // 无论成功、失败还是取消，都尝试启动下一个任务 
        console.log(`\n🔄 任务结束，尝试启动下一个排队任务...`);
        setTimeout(() => {
            tryStartNextTask();
        }, 500); // 延迟500ms，避免资源竞争
    }
}

/**
 * 解压 ZIP 文件
 */
async function extractZip(zipPath: string, targetDir: string): Promise<string> {
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();


    if (zipEntries.length === 0) {
        throw new Error('ZIP 文件为空');
    }

    // 获取根目录名称
    const firstEntry = zipEntries[0];
    let rootFolder = firstEntry.entryName.split('/')[0];

    // 如果 ZIP 内部有根文件夹，使用它；否则用 ZIP 文件名
    const hasRootFolder = zipEntries.every(entry =>
        entry.entryName.startsWith(rootFolder + '/')
    );

    if (!hasRootFolder) {
        rootFolder = path.basename(zipPath, '.zip').replace(/^\d+-/, '');
    }

    const extractPath = path.join(targetDir, rootFolder);

    // 解压
    zip.extractAllTo(targetDir, true);

    return extractPath;
}

/**
 * 获取任务状态
 */
app.get('/api/task/:taskId', (req: Request, res: Response) => {
    const { taskId } = req.params;
    const task = tasks.get(taskId);

    if (!task) {
        return res.status(404).json({
            success: false,
            message: '任务不存在'
        });
    }

    res.json({
        success: true,
        task
    });
});

/**
 * 获取所有任务
 */
app.get('/api/tasks', (req: Request, res: Response) => {
    const taskList = Array.from(tasks.values()).sort((a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime()
    );

    res.json({
        success: true,
        tasks: taskList,
        queue: {
            maxConcurrent: CONFIG.MAX_CONCURRENT_TASKS,
            processing: getProcessingTaskCount(),
            waiting: taskQueue.length
        }
    });
});

/**
 * 获取队列状态
 */
app.get('/api/queue/status', (req: Request, res: Response) => {
    res.json({
        success: true,
        maxConcurrent: CONFIG.MAX_CONCURRENT_TASKS,
        processing: getProcessingTaskCount(),
        waiting: taskQueue.length,
        queueItems: taskQueue.map(item => ({
            taskId: item.taskId,
            taskName: tasks.get(item.taskId)?.name || '未知任务'
        }))
    });
});

/**
 * 删除任务
 */
app.delete('/api/task/:taskId', (req: Request, res: Response) => {
    const { taskId } = req.params;
    const task = tasks.get(taskId);

    console.log("任务删除", taskId)

    if (!task) {
        return res.status(404).json({
            success: false,
            message: '任务不存在'
        });
    }

    // 清理预生成的ZIP文件
    if (task.zipPath && fs.existsSync(task.zipPath)) {
        try {
            fs.unlinkSync(task.zipPath);
            console.log(`🗑️  已删除ZIP文件: ${task.zipPath}`);
        } catch (error) {
            console.error(`❌ 删除ZIP文件失败:`, error);
        }
    }

    // 清理输出目录
    if (task.outputPath && fs.existsSync(task.outputPath)) {
        try {
            rmSyncRetry(task.outputPath, { recursive: true });
            console.log(`🗑️  已删除输出目录: ${task.outputPath}`);
        } catch (error) {
            console.error(`❌ 删除输出目录失败:`, error);
        }
    }

    tasks.delete(taskId);

    res.json({
        success: true,
        message: '任务已删除'
    });
});

/**
 * 取消任务
 */
app.post('/api/task/:taskId/cancel', (req: Request, res: Response) => {
    const { taskId } = req.params;
    const task = tasks.get(taskId);
    console.log("任务取消", taskId)

    if (!task) {
        return res.status(404).json({
            success: false,
            message: '任务不存在'
        });
    }

    if (task.status === 'processing') {
        // 取消正在处理的任务
        task.cancelled = true;
        task.status = 'cancelled';
        task.error = '任务已被取消';
        console.log(`🚫 任务被取消: ${task.name} (ID: ${taskId})`);

        res.json({
            success: true,
            message: '任务已取消'
        });

        // 注意：processTask 的 finally 块会自动触发下一个任务
    } else if (task.status === 'queue') {
        // 从队列中移除任务
        const queueIndex = taskQueue.findIndex(item => item.taskId === taskId);
        if (queueIndex !== -1) {
            taskQueue.splice(queueIndex, 1);
            console.log(`🚫 从队列中移除任务: ${task.name} (ID: ${taskId}), 剩余队列: ${taskQueue.length}`);
        }

        task.status = 'cancelled';
        task.error = '任务已被取消';

        res.json({
            success: true,
            message: '任务已从队列中移除'
        });

        // 尝试启动下一个任务（因为队列有变化）
        tryStartNextTask();
    } else {
        res.json({
            success: false,
            message: `任务状态为 ${task.status}，无法取消`
        });
    }
});

/**
 * 下载处理结果
 */
app.get('/api/download/:taskId', async (req: Request, res: Response) => {
    const { taskId } = req.params;
    let task = tasks.get(taskId);


    console.error("下载任务", taskId, task)
    if (!task) {
        // 按名字直接找zip
        // const zipPath = path.join(OUTPUT_DIR, `${taskId}.zip`);
        // console.log("按名字直接找zip", taskId, zipPath)
        // if (fs.existsSync(zipPath)) {
        //     return res.sendFile(zipPath);
        // } else {
        //     return res.status(404).json({
        //         success: false,
        //         message: '任务未完成或结果不存在'
        //     });
        // }
        task = {
            'id': taskId,
            'name': taskId,
            'type': 'folder',
            'status': 'completed',
            'progress': 100,
            'createdAt': new Date(),
            'outputPath': path.join(OUTPUT_DIR, `${taskId}.zip`),
            'zipPath': path.join(OUTPUT_DIR, `${taskId}.zip`)
        }

    }

    if (!task || task.status !== 'completed' || !task.outputPath) {
        return res.status(404).json({
            success: false,
            message: '任务未完成或结果不存在'
        });
    }

    try {
        const fileName = `${task.name.replace(/\.[^/.]+$/, '')}.zip`;

        // 优先使用预生成的ZIP文件
        console.log("下载任务", task.zipPath)
        if (task.zipPath && fs.existsSync(task.zipPath)) {
            console.log(`📦 使用预生成的ZIP文件: ${task.zipPath}`);

            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

            // 直接发送文件流，更高效
            const fileStream = fs.createReadStream(task.zipPath);
            fileStream.pipe(res);

            fileStream.on('error', (error) => {
                console.error('文件流错误:', error);
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        message: '下载失败'
                    });
                }
            });

            return;
        }

        // 备用方案：实时生成ZIP（如果预生成的文件不存在）
        console.log(`⚠️  预生成ZIP不存在，实时生成...`);
        const zip = new AdmZip();
        const outputPath = task.outputPath;

        if (fs.existsSync(outputPath)) {
            addFolderToZip(zip, outputPath, '');
        } else {
            throw new Error('输出目录不存在');
        }

        const zipBuffer = zip.toBuffer();

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        res.send(zipBuffer);

    } catch (error) {
        console.error('❌ 下载失败:', error);
        res.status(500).json({
            success: false,
            message: '下载失败'
        });
    }
});

/**
 * 递归添加文件夹到 ZIP
 */
function addFolderToZip(zip: AdmZip, folderPath: string, zipPath: string) {
    const files = fs.readdirSync(folderPath);

    for (const file of files) {
        const fullPath = path.join(folderPath, file);
        const stat = fs.statSync(fullPath);
        const zipFilePath = path.join(zipPath, file);

        if (stat.isDirectory()) {
            addFolderToZip(zip, fullPath, zipFilePath);
        } else {
            zip.addLocalFile(fullPath, zipPath);
        }
    }
}

/**
 * 健康检查
 */
app.get('/api/health', (req: Request, res: Response) => {
    res.json({
        success: true,
        message: 'Server is running',
        uptime: process.uptime(),
        resDir: RES_DIR,
        tasksCount: tasks.size
    });
});

/**
 * 根路径重定向到静态页面
 */
app.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

/**
 * 启动服务器
 */
app.listen(CONFIG.PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 Cocos 资源处理服务器已启动');
    console.log('='.repeat(50));
    console.log(`📡 服务地址: http://localhost:${CONFIG.PORT}`);
    console.log(`⚡ 最大并发: ${CONFIG.MAX_CONCURRENT_TASKS} 个任务`);
    console.log(`📁 资源目录: ${RES_DIR}`);
    console.log(`📤 上传目录: ${UPLOAD_DIR}`);
    console.log(`📦 输出目录: ${OUTPUT_DIR}`);
    console.log(`🌐 静态文件: ${STATIC_DIR}`);
    console.log('='.repeat(50) + '\n');

    // if (fs.existsSync(path.join(process.cwd(), 'out'))) {
    //     fs.rmSync(path.join(process.cwd(), 'out'), { recursive: true });
    // }
    if (fs.existsSync(path.join(process.cwd(), 'res'))) {
        fs.rmSync(path.join(process.cwd(), 'res'), { recursive: true });
    }
    // fs.rmSync(path.join(process.cwd(), 'res'), { recursive: true });

});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('\n收到 SIGTERM 信号，正在关闭服务器...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n收到 SIGINT 信号，正在关闭服务器...');
    process.exit(0);
});
