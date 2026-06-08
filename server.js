/**
 * 1. استيراد المكتبات الأساسية
 * يسهل إضافة مكتبات جديدة مستقبلاً في مكان واحد
 */
const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const cors = require('cors');
const multer = require('multer'); // استيراد مكتبة رفع الملفات المضافة
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000; // متوافق مع خوادم Render

/**
 * 2. إعدادات الـ Middleware
 * للتحكم في كيفية استقبال ومعالجة البيانات (JSON و CORS)
 */
app.use(cors());
app.use(express.json());

// التأكد من وجود مجلد لحفظ الملفات المرفوعة حتى لا يحدث خطأ أثناء الرفع
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// إعداد خيارات multer لتسمية الملفات المرفوعة بأسماء فريدة دقيقة
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

/**
 * 3. إعداد المجلدات الثابتة (Frontend & Uploads)
 * تم تعديلها لتقرأ كل الملفات (CSS, JS, Images) من المجلد الرئيسي مباشرة
 */
app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadDir)); // إتاحة تصفح الملفات المرفوعة قانونياً لاحقاً

/**
 * 4. الاتصال بقاعدة البيانات وتجهيز الجداول (تم تصحيحها لـ better-sqlite3)
 */
const db = new Database('database.db', { verbose: console.log });

// أ. جدول المستخدمين الأصلي
db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT,
    id_number TEXT
)`);

// ب. إنشاء جدول طلبات الخدمات المطور والاعتمادات المالية تلقائياً
db.exec(`CREATE TABLE IF NOT EXISTS service_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_type TEXT,
    client_name TEXT,
    request_details TEXT,
    user_email TEXT,
    card_number TEXT,
    deposit_amount TEXT,
    attachments TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// جـ. إنشاء جدول استقبال طلبات الخبراء المعلقة تلقائياً
db.exec(`CREATE TABLE IF NOT EXISTS expert_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    specialty TEXT,
    license_number TEXT,
    bio TEXT,
    email TEXT UNIQUE,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

/**
 * 5. تعريف المسارات (Routes)
 */

// الصفحة الرئيسية الافتراضية للموقع
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// مسار: إنشاء حساب جديد
app.post('/register', (req, res) => {
    const { name, phone, email, password, role, adminCode, idNumber } = req.body;

    if (!name || !email || !password || !idNumber) {
        return res.status(400).json({ error: 'يرجى ملء جميع الحقول الإجبارية!' });
    }

    if (role === 'admin' && adminCode !== "041096") {
        return res.status(400).json({ error: 'كود المدير غير صحيح!' });
    }

    try {
        const stmt = db.prepare(`INSERT INTO users (name, phone, email, password, role, id_number) VALUES (?, ?, ?, ?, ?, ?)`);
        stmt.run(name, phone, email, password, role, idNumber);
        res.json({ message: 'تم إنشاء الحساب بنجاح.' });
    } catch (err) {
        console.error('Database Error:', err.message);
        return res.status(400).json({ error: 'تعذر التسجيل، البريد الإلكتروني مستخدم مسبقاً.' });
    }
});

// مسار: تسجيل الدخول
app.post('/login', (req, res) => {
    const { email, password, role, idNumber } = req.body;
    
    try {
        const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
        if (!user) return res.status(401).json({ error: 'البريد غير مسجل.' });
        
        if (user.password !== password || user.id_number !== idNumber) 
            return res.status(401).json({ error: 'بيانات الدخول غير صحيحة.' });
            
        res.json({ message: 'تم الدخول', role: user.role , email: user.email });
    } catch (err) {
        return res.status(500).json({ error: 'خطأ في الخادم الداخلي' });
    }
});

// مسار استقبال وإضافة خبير جديد (يدوياً من قبل الأدمن)
app.post('/add-expert', (req, res) => {
    const { name, specialty, license_number, bio } = req.body;

    if (!name || !specialty) {
        return res.status(400).json({ error: 'يرجى ملء الحقول الإجبارية (الاسم والتخصص)!' });
    }

    const generatedEmail = `expert_${Date.now()}@tahkime.com`;
    const defaultPassword = 'expert_password_123';

    try {
        const stmt = db.prepare(`INSERT INTO users (name, phone, email, password, role, id_number) VALUES (?, ?, ?, ?, 'expert', ?)`);
        stmt.run(name, specialty, generatedEmail, defaultPassword, license_number);
        res.status(200).json({ success: true, message: "تم إضافة الخبير بنجاح" });
    } catch (err) {
        console.error('Database Error:', err.message);
        return res.status(500).json({ error: 'تعذر حفظ بيانات الخبير في قاعدة البيانات.' });
    }
});

// مسار جلب قائمة الخبراء لصفحة القائمة
app.get('/get-experts', (req, res) => {
    try {
        const rows = db.prepare(`SELECT name, phone as specialty, id_number as license_number FROM users WHERE role = 'expert'`).all();
        res.json(rows);
    } catch (err) {
        console.error('Database Fetch Error:', err.message);
        return res.status(500).json({ error: 'تعذر جلب قائمة الخبراء.' });
    }
});

// مسار استقبال طلبات الخدمة والاعتماد المالي الجديد
app.post('/submit-service-order', upload.array('attachments'), (req, res) => {
    const { serviceType, clientName, requestDetails, userEmail, cardNumber, depositAmount } = req.body;
    const fileNames = req.files ? req.files.map(f => f.filename).join(',') : '';

    try {
        const stmt = db.prepare(`INSERT INTO service_orders (service_type, client_name, request_details, user_email, card_number, deposit_amount, attachments) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        stmt.run(serviceType, clientName, requestDetails, userEmail, cardNumber, depositAmount, fileNames);
        res.status(200).json({ success: true, message: 'تم استقبال طلبك بنجاح وحفظ الملفات وقيمة الاعتماد المالي!' });
    } catch (err) {
        console.error('خطأ أثناء حفظ طلب الخدمة:', err.message);
        return res.status(500).json({ error: 'حدث خطأ داخلي في السيرفر أثناء معالجة البيانات الماليّة.' });
    }
});

app.get('/favicon.ico', (req, res) => res.status(204));

app.get('/user-info', (req, res) => {
    const email = req.query.email;
    try {
        const user = db.prepare(`SELECT name, email, role FROM users WHERE email = ?`).get(email);
        if (!user) return res.status(404).json({ error: 'لم يتم العثور على المستخدم' });
        res.json({ name: user.name, role: user.role });
    } catch (err) {
        return res.status(500).json({ error: 'خطأ في السيرفر' });
    }
});

app.get('/admin-stats', (req, res) => {
    try {
        const row = db.prepare(`SELECT COUNT(*) as count FROM users`).get();
        res.json({ totalUsers: row.count });
    } catch (err) {
        return res.status(500).json({ error: "خطأ" });
    }
});

// مسار إرسال طلب انضمام خبير (من صفحة الخبير الخارجية)
app.post('/submit-expert-request', (req, res) => {
    const { name, specialty, license_number, bio, email } = req.body;

    if (!name || !specialty || !email) {
        return res.status(400).json({ error: 'يرجى ملء الحقول الإجبارية (الاسم، التخصص، البريد)!' });
    }

    try {
        const stmt = db.prepare(`INSERT INTO expert_requests (name, specialty, license_number, bio, email) VALUES (?, ?, ?, ?, ?)`);
        stmt.run(name, specialty, license_number, bio, email);
        res.status(200).json({ success: true, message: 'تم إرسال طلب انضمامك بنجاح، وهو قيد الدراسة من طرف الإدارة.' });
    } catch (err) {
        console.error('Database Error:', err.message);
        return res.status(400).json({ error: 'تم تقديم طلب بهذا البريد الإلكتروني سابقاً وهو قيد المراجعة حالياً.' });
    }
});

// مسار جلب الطلبات المعلقة للخبراء (للمدير)
app.get('/get-pending-experts', (req, res) => {
    try {
        const rows = db.prepare(`SELECT id, name, specialty, license_number, bio, email FROM expert_requests WHERE status = 'pending' ORDER BY id DESC`).all();
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'حدث خطأ أثناء جلب طلبات الخبراء المعلقة.' });
    }
});

// مسار موافقة وقبول الخبير ونقله للمستخدمين الرسميين
app.post('/approve-expert', (req, res) => {
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: "معرف الطلب مطلوب" });

    try {
        const request = db.prepare(`SELECT * FROM expert_requests WHERE id = ?`).get(requestId);
        if (!request) return res.status(444).json({ error: "لم يتم العثور على طلب الانضمام المحدد." });

        const defaultPassword = 'expert_password_123';

        // نقل البيانات لجدول المستخدمين
        const stmtInsert = db.prepare(`INSERT INTO users (name, phone, email, password, role, id_number) VALUES (?, ?, ?, ?, 'expert', ?)`);
        stmtInsert.run(request.name, request.specialty, request.email, defaultPassword, request.license_number);

        // تحديث حالة الطلب
        db.prepare(`UPDATE expert_requests SET status = 'approved' WHERE id = ?`).run(requestId);
        res.status(200).json({ success: true, message: "تم قبول الخبير بنجاح وإضافته لقائمة المنصة الرسمية!" });
    } catch (err) {
        console.error(err.message);
        return res.status(400).json({ error: "البريد الإلكتروني لهذا الخبير مسجل بالفعل في النظام، أو حدث خطأ." });
    }
});

// مسار جلب الطلبات الخاصة بعميل معين
app.get('/get-client-orders', (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: "البريد الإلكتروني مطلوب" });

    try {
        const rows = db.prepare(`SELECT id, service_type, client_name, request_details, deposit_amount, created_at FROM service_orders WHERE user_email = ? ORDER BY id DESC`).all(email);
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: "حدث خطأ أثناء جلب طلبات العميل" });
    }
});

// مسار جلب جميع الطلبات في النظام (خاص بالمدير/الأدمن)
app.get('/get-all-orders', (req, res) => {
    try {
        const rows = db.prepare(`SELECT id, service_type, client_name, request_details, user_email, deposit_amount, attachments, created_at FROM service_orders ORDER BY id DESC`).all();
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: "حدث خطأ أثناء جلب طلبات المدير" });
    }
});

// مسار توجيه الصفحات العام الديناميكي المتوافق مع رفع الملفات مباشرة بجانب السيرفر
app.get('/:page', (req, res) => {
    const page = req.params.page;
    res.sendFile(path.join(__dirname, page));
});

/**
 * 6. تشغيل السيرفر
 */
app.listen(PORT, () => {
    console.log(`السيرفر يعمل الآن بنجاح على المنفذ: ${PORT}`);
});
