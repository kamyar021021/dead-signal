#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 *  generate-ai-context.js
 * ═══════════════════════════════════════════════════════════════
 * 
 *  🎯 کاربرد:
 *  کل پروژه Next.js رو اسکن می‌کنه و یه فایل .txt می‌سازه که شامل:
 *    - 🌲 ساختار درختی پروژه
 *    - 🐛 همه خطاهای TypeScript با جزئیات کامل
 *    - 📄 محتوای کامل همه فایل‌های کد
 *  
 *  📌 این فایل رو می‌تونی به هر AI (DeepSeek, ChatGPT, Claude) بدی
 *     تا کل context پروژه رو بفهمه.
 *  
 *  🚀 طریقه استفاده:
 *     cd /path/to/project-root
 *     node generate-ai-context.js
 *     # وقتی پرسید: بنویس template-mui (یا اسم پوشه پروژه فرانت)
 *  
 *  📤 خروجی:
 *     فایل AI_Context_<folder-name>.txt توی root پروژه
 *  
 *  ⚙️ تنظیمات:
 *     - ALLOWED_EXTENSIONS: پسوندهایی که خونده می‌شن
 *     - IGNORED_DIRS: پوشه‌هایی که نادیده گرفته می‌شن
 *     - برای پروژه‌های دیگه، این دو تا رو تنظیم کن
 * ═══════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { execSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ═══════════════════════════════════════════════════════════════
//  تنظیمات — این بخش رو برای پروژه‌های دیگه تنظیم کن
// ═══════════════════════════════════════════════════════════════

// پسوند فایل‌هایی که باید خوانده شوند
const ALLOWED_EXTENSIONS = [
    '.ts', '.tsx', '.js', '.jsx', '.json', '.prisma',
    '.html', '.css', '.scss', '.env'
];

// پوشه‌هایی که باید نادیده گرفته شوند
const IGNORED_DIRS = [
    'node_modules', '.git', 'dist', 'build', '.next', 'coverage'
];

// ═══════════════════════════════════════════════════════════════
//  بخش ۱: پیدا کردن همه فایل‌های مجاز (بازگشتی)
// ═══════════════════════════════════════════════════════════════

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        const fullPath = path.join(dirPath, file);

        if (fs.statSync(fullPath).isDirectory()) {
            // اگه پوشه ignore شده نباشه، داخلش برو
            if (!IGNORED_DIRS.includes(file)) {
                arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
            }
        } else {
            // اگه پسوند مجاز باشه، اضافه کن
            const ext = path.extname(fullPath);
            if (ALLOWED_EXTENSIONS.includes(ext)) {
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

// ═══════════════════════════════════════════════════════════════
//  بخش ۲: ساخت ساختار درختی پروژه
// ═══════════════════════════════════════════════════════════════

function generateTree(dirPath, prefix = '') {
    let tree = '';
    let files = fs.readdirSync(dirPath);

    // فیلتر کردن فایل‌های مجاز و پوشه‌های غیر ignore
    files = files.filter(file => {
        const fullPath = path.join(dirPath, file);
        const isDir = fs.statSync(fullPath).isDirectory();
        if (isDir) return !IGNORED_DIRS.includes(file);
        const ext = path.extname(file);
        return ALLOWED_EXTENSIONS.includes(ext);
    });

    // مرتب‌سازی: پوشه‌ها اول، بعد فایل‌ها الفبایی
    files.sort((a, b) => {
        const aIsDir = fs.statSync(path.join(dirPath, a)).isDirectory();
        const bIsDir = fs.statSync(path.join(dirPath, b)).isDirectory();
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
    });

    files.forEach((file, index) => {
        const fullPath = path.join(dirPath, file);
        const isLast = index === files.length - 1;
        const isDir = fs.statSync(fullPath).isDirectory();

        if (isDir) {
            tree += `${prefix}${isLast ? '└── ' : '├── '}📁 ${file}/\n`;
            tree += generateTree(fullPath, `${prefix}${isLast ? '    ' : '│   '}`);
        } else {
            tree += `${prefix}${isLast ? '└── ' : '├── '}📄 ${file}\n`;
        }
    });

    return tree;
}

// ═══════════════════════════════════════════════════════════════
//  بخش ۳: گرفتن خطاهای TypeScript از داخل پروژه هدف
// ═══════════════════════════════════════════════════════════════

function runTypeScriptCheck(projectDir) {
    let ts;

    // تلاش برای لود typescript از داخل پروژه فرانت
    try {
        const tsPath = require.resolve('typescript', { paths: [projectDir] });
        ts = require(tsPath);
    } catch (_) {
        try {
            ts = require('typescript');
        } catch (__) {
            console.log('⚠ typescript پیدا نشد. استفاده از tsc CLI...');
            return runTscCli(projectDir);
        }
    }

    // پیدا کردن tsconfig.json
    const configPath = ts.findConfigFile(projectDir, ts.sys.fileExists, 'tsconfig.json');
    if (!configPath) {
        console.log('⚠ tsconfig.json پیدا نشد. استفاده از tsc CLI...');
        return runTscCli(projectDir);
    }

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error) return runTscCli(projectDir);

    const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(configPath)
    );

    const program = ts.createProgram(parsed.fileNames, parsed.options);
    const diagnostics = ts.getPreEmitDiagnostics(program);

    // فیلتر کردن خطاهای node_modules
    return diagnostics
        .filter(d => d.file && !d.file.fileName.includes('node_modules'))
        .map(d => {
            const entry = {
                file: '<global>',
                line: 0,
                column: 0,
                code: `TS${d.code}`,
                category: ts.DiagnosticCategory[d.category],
                message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
                related: []
            };

            if (d.file && typeof d.start === 'number') {
                const pos = d.file.getLineAndCharacterOfPosition(d.start);
                entry.file = path.relative(projectDir, d.file.fileName);
                entry.line = pos.line + 1;
                entry.column = pos.character + 1;
            }

            if (d.relatedInformation) {
                entry.related = d.relatedInformation
                    .filter(r => r.messageText)
                    .map(r => {
                        const rel = {
                            file: '<global>',
                            line: 0,
                            column: 0,
                            message: ts.flattenDiagnosticMessageText(r.messageText, '\n')
                        };
                        if (r.file && typeof r.start === 'number') {
                            const p = r.file.getLineAndCharacterOfPosition(r.start);
                            rel.file = path.relative(projectDir, r.file.fileName);
                            rel.line = p.line + 1;
                            rel.column = p.character + 1;
                        }
                        return rel;
                    });
            }

            return entry;
        });
}

function runTscCli(projectDir) {
    console.log(`🔧 اجرای tsc از داخل: ${projectDir}`);
    try {
        execSync('npx --no-install tsc --noEmit --pretty false', {
            cwd: projectDir,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: 50 * 1024 * 1024
        });
        return [];
    } catch (error) {
        const raw = (error.stdout || '') + (error.stderr || '');
        return parseTscCliOutput(raw, projectDir);
    }
}

function parseTscCliOutput(raw, projectDir) {
    const lines = raw.split(/\r?\n/);
    const errors = [];
    const re = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/;

    for (const line of lines) {
        const m = line.match(re);
        if (m) {
            errors.push({
                file: path.relative(projectDir, path.resolve(projectDir, m[1])),
                line: parseInt(m[2], 10),
                column: parseInt(m[3], 10),
                code: m[4],
                category: 'Error',
                message: m[5],
                related: []
            });
        } else if (errors.length && /^\s+/.test(line) && line.trim()) {
            errors[errors.length - 1].message += '\n  ' + line.trim();
        }
    }
    return errors;
}

// ═══════════════════════════════════════════════════════════════
//  بخش ۴: فرمت کردن گزارش خطاها
// ═══════════════════════════════════════════════════════════════

function groupErrorsByFile(errors) {
    const map = new Map();
    for (const err of errors) {
        if (!map.has(err.file)) map.set(err.file, []);
        map.get(err.file).push(err);
    }
    return map;
}

function formatTypeScriptReport(errors) {
    if (!errors.length) return '✅ هیچ خطای TypeScript پیدا نشد.\n';

    let out = '';
    out += `❌ تعداد کل خطاها: ${errors.length}\n`;
    out += `📁 فایل‌های درگیر: ${groupErrorsByFile(errors).size}\n\n`;

    const grouped = groupErrorsByFile(errors);
    const files = [...grouped.keys()].sort();

    for (const file of files) {
        const fileErrors = grouped.get(file).sort((a, b) => a.line - b.line || a.column - b.column);
        out += `${'─'.repeat(60)}\n`;
        out += `📄 ${file}  (${fileErrors.length} خطا)\n`;
        out += `${'─'.repeat(60)}\n`;

        for (const err of fileErrors) {
            out += `  ❌ خط ${err.line}، ستون ${err.column}  [${err.code}]\n`;
            out += `     ${err.message.replace(/\n/g, '\n     ')}\n`;
            if (err.related && err.related.length) {
                for (const rel of err.related) {
                    const loc = rel.line ? `${rel.file}:${rel.line}` : rel.file;
                    out += `     ↳ ${loc} - ${rel.message.replace(/\n/g, '\n       ')}\n`;
                }
            }
            out += '\n';
        }
    }
    return out;
}

// ═══════════════════════════════════════════════════════════════
//  بخش ۵: اجرای اصلی
// ═══════════════════════════════════════════════════════════════

rl.question('نام یا مسیر پوشه رو وارد کن (مثلاً template-mui): ', (folderName) => {
    const targetDir = path.resolve(process.cwd(), folderName);

    if (!fs.existsSync(targetDir)) {
        console.error(`\n❌ خطا: پوشه "${folderName}" پیدا نشد!`);
        rl.close();
        return;
    }

    console.log(`\n⏳ در حال خواندن فایل‌ها از: ${folderName}...`);

    const treeStructure = generateTree(targetDir);
    const allFiles = getAllFiles(targetDir);

    console.log(`🔍 اجرای چک TypeScript از داخل "${folderName}"...`);
    let tsErrors = [];
    try {
        tsErrors = runTypeScriptCheck(targetDir);
        console.log(`✔ چک TypeScript تموم شد. ${tsErrors.length} خطا پیدا شد.`);
    } catch (e) {
        console.log(`⚠ نمی‌توان چک TypeScript رو اجرا کرد: ${e.message}`);
    }

    // اسم فایل خروجی
    const safeName = folderName.replace(/[\/\\]/g, '_');
    const outputFileName = `AI_Context_${safeName}.txt`;

    // ساخت محتوای خروجی
    let outputContent = `# Project Context for AI\n`;
    outputContent += `Folder: ${folderName}\n`;
    outputContent += `Total Files: ${allFiles.length}\n`;
    outputContent += `TypeScript Errors: ${tsErrors.length}\n`;
    outputContent += `==================================================\n\n`;

    // بخش ۱: ساختار درختی
    outputContent += `📁 PROJECT STRUCTURE:\n`;
    outputContent += `${'='.repeat(60)}\n`;
    outputContent += treeStructure;
    outputContent += `\n${'='.repeat(60)}\n\n`;

    // بخش ۲: خطاهای TypeScript
    outputContent += `🐛 TYPESCRIPT DIAGNOSTICS (All errors with file:line:column):\n`;
    outputContent += `${'='.repeat(60)}\n`;
    outputContent += formatTypeScriptReport(tsErrors);
    outputContent += `\n${'='.repeat(60)}\n\n`;

    // بخش ۳: محتوای همه فایل‌ها
    allFiles.forEach((filePath) => {
        const relativePath = path.relative(process.cwd(), filePath);
        const fileContent = fs.readFileSync(filePath, 'utf8');

        outputContent += `\n${'='.repeat(60)}\n`;
        outputContent += `📄 File: ${relativePath}\n`;
        outputContent += `${'='.repeat(60)}\n\n`;

        // تعیین زبان برای syntax highlighting
        const ext = path.extname(filePath).replace('.', '');
        const langMap = { ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx' };
        const lang = langMap[ext] || ext;

        outputContent += `\`\`\`${lang}\n`;
        outputContent += fileContent;
        outputContent += `\n\`\`\`\n\n`;
    });

    fs.writeFileSync(outputFileName, outputContent, 'utf8');

    console.log(`\n✅ عملیات با موفقیت انجام شد!`);
    console.log(`📁 ${allFiles.length} فایل خوانده شد.`);
    console.log(`🐛 ${tsErrors.length} خطای TypeScript پیدا شد.`);
    console.log(`📄 فایل خروجی: ${outputFileName}`);
    console.log(`\nمی‌تونی محتوای این فایل رو به AI بدی.\n`);

    rl.close();
});