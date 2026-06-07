/**
 * 1. استيراد المكتبات الأساسية
 * يسهل إضافة مكتبات جديدة مستقبلاً في مكان واحد
 */
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3-offline').verbose();
const cors = require('cors');
const multer = require('multer'); // استيراد مكتبة رفع الملفات المضافة
const fs = require('fs');

const app = express();
const PORT = 3000;

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
 */
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(uploadDir)); // إتاحة تصفح الملفات المرفوعة قانونياً لاحقاً

/**
 * 4. الاتصال بقاعدة البيانات
 */
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error('خطأ في الاتصال:', err.message);
    else {
        console.log('تم الاتصال بقاعدة البيانات.');
        
        // أ. جدول المستخدمين الأصلي (لم يتم تعديله)
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            phone TEXT,
            email TEXT UNIQUE,
            password TEXT,
            role TEXT,
            id_number TEXT
        )`);

        // ب. إنشاء جدول طلبات الخدمات المطور والاعتمادات المالية تلقائياً
        db.run(`CREATE TABLE IF NOT EXISTS service_orders (
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

        // جـ. 🌟 جديد: إنشاء جدول استقبال طلبات الخبراء المعلقة تلقائياً 🌟
        db.run(`CREATE TABLE IF NOT EXISTS expert_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            specialty TEXT,
            license_number TEXT,
            bio TEXT,
            email TEXT UNIQUE,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

/**
 * 5. تعريف المسارات (Routes)
 */

// مسار: إنشاء حساب جديد
app.post('/register', (req, res) => {
    const { name, phone, email, password, role, adminCode, idNumber } = req.body;

    if (!name || !email || !password || !idNumber) {
        return res.status(400).json({ error: 'يرجى ملء جميع الحقول الإجبارية!' });
    }

    if (role === 'admin' && adminCode !== "041096") {
        return res.status(400).json({ error: 'كود المدير غير صحيح!' });
    }

    const sql = `INSERT INTO users (name, phone, email, password, role, id_number) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [name, phone, email, password, role, idNumber], function(err) {
        if (err) {
            console.error('Database Error:', err.message);
            return res.status(400).json({ error: 'تعذر التسجيل، البريد الإلكتروني مستخدم مسبقاً.' });
        }
        res.json({ message: 'تم إنشاء الحساب بنجاح.' });
    });
});

// مسار: تسجيل الدخول
app.post('/login', (req, res) => {
    const { email, password, role, idNumber } = req.body;
    
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'البريد غير مسجل.' });
        
        if (user.password !== password || user.id_number !== idNumber) 
            return res.status(401).json({ error: 'بيانات الدخول غير صحيحة.' });
            
        res.json({ message: 'تم الدخول', role: user.role , email: user.email });
    });
});

// مسار استقبال وإضافة خبير جديد (يدوياً من قبل الأدمن)
app.post('/add-expert', (req, res) => {
    const { name, specialty, license_number, bio } = req.body;

    if (!name || !specialty) {
        return res.status(400).json({ error: 'يرجى ملء الحقول الإجبارية (الاسم والتخصص)!' });
    }

    const generatedEmail = `expert_${Date.now()}@tahkime.com`;
    const defaultPassword = 'expert_password_123';

    const sql = `INSERT INTO users (name, phone, email, password, role, id_number) VALUES (?, ?, ?, ?, 'expert', ?)`;
    
    db.run(sql, [name, specialty, generatedEmail, defaultPassword, license_number], function(err) {
        if (err) {
            console.error('Database Error:', err.message);
            return res.status(500).json({ error: 'تعذر حفظ بيانات الخبير في قاعدة البيانات.' });
        }
        res.status(200).json({ success: true, message: "تم إضافة الخبير بنجاح" });
    });
});

// مسار جلب قائمة الخبراء لصفحة القائمة
app.get('/get-experts', (req, res) => {
    const sql = `SELECT name, phone as specialty, id_number as license_number FROM users WHERE role = 'expert'`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Database Fetch Error:', err.message);
            return res.status(500).json({ error: 'تعذر جلب قائمة الخبراء.' });
        }
        res.json(rows);
    });
});

// ========================================================
// 🌟 مسار استقبال طلبات الخدمة والاعتماد المالي الجديد 🌟
// ========================================================
app.post('/submit-service-order', upload.array('attachments'), (req, res) => {
    const { serviceType, clientName, requestDetails, userEmail, cardNumber, depositAmount } = req.body;

    // تجميع مسارات الملفات المرفوعة في نص واحد مفصول بفواصل لحفظه في قاعدة البيانات
    const fileNames = req.files ? req.files.map(f => f.filename).join(',') : '';

    const sql = `INSERT INTO service_orders (service_type, client_name, request_details, user_email, card_number, deposit_amount, attachments) VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [serviceType, clientName, requestDetails, userEmail, cardNumber, depositAmount, fileNames], function(err) {
        if (err) {
            console.error('خطأ أثناء حفظ طلب الخدمة:', err.message);
            return res.status(500).json({ error: 'حدث خطأ داخلي في السيرفر أثناء معالجة البيانات الماليّة.' });
        }
        res.status(200).json({ success: true, message: 'تم استقبال طلبك بنجاح وحفظ الملفات وقيمة الاعتماد المالي!' });
    });
});

app.get('/favicon.ico', (req, res) => res.status(204));

app.get('/user-info', (req, res) => {
    const email = req.query.email;
    db.get(`SELECT name, email, role FROM users WHERE email = ?`, [email], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'لم يتم العثور على المستخدم' });
       res.json({ name: user.name, role: user.role });
    });
});

app.get('/admin-stats', (req, res) => {
    db.get(`SELECT COUNT(*) as count FROM users`, [], (err, row) => {
        if (err) return res.status(500).json({ error: "خطأ" });
        res.json({ totalUsers: row.count });
    });
});

// ========================================================
// 🌟 جديد: مسار إرسال طلب انضمام خبير (من صفحة الخبير الخارجية) 🌟
// ========================================================
app.post('/submit-expert-request', (req, res) => {
    const { name, specialty, license_number, bio, email } = req.body;

    if (!name || !specialty || !email) {
        return res.status(400).json({ error: 'يرجى ملء الحقول الإجبارية (الاسم، التخصص، البريد)!' });
    }

    const sql = `INSERT INTO expert_requests (name, specialty, license_number, bio, email) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [name, specialty, license_number, bio, email], function(err) {
        if (err) {
            console.error('Database Error:', err.message);
            return res.status(400).json({ error: 'تم تقديم طلب بهذا البريد الإلكتروني سابقاً وهو قيد المراجعة حالياً.' });
        }
        res.status(200).json({ success: true, message: 'تم إرسال طلب انضمامك بنجاح، وهو قيد الدراسة من طرف الإدارة.' });
    });
});

// ========================================================
// 🌟 جديد: مسار جلب الطلبات المعلقة للخبراء (للمدير) 🌟
// ========================================================
app.get('/get-pending-experts', (req, res) => {
    const sql = `SELECT id, name, specialty, license_number, bio, email FROM expert_requests WHERE status = 'pending' ORDER BY id DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'حدث خطأ أثناء جلب طلبات الخبراء المعلقة.' });
        }
        res.json(rows);
    });
});

// ========================================================
// 🌟 جديد: مسار موافقة وقبول الخبير ونقله للمستخدمين الرسميين 🌟
// ========================================================
app.post('/approve-expert', (req, res) => {
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: "معرف الطلب مطلوب" });

    db.get(`SELECT * FROM expert_requests WHERE id = ?`, [requestId], (err, request) => {
        if (err || !request) return res.status(444).json({ error: "لم يتم العثور على طلب الانضمام المحدد." });

        const defaultPassword = 'expert_password_123';

        // نقل البيانات لجدول المستخدمين (التخصص في حقل phone والرخصة في id_number بالتوافق مع مشروعك)
        const insertUserSql = `INSERT INTO users (name, phone, email, password, role, id_number) VALUES (?, ?, ?, ?, 'expert', ?)`;
        db.run(insertUserSql, [request.name, request.specialty, request.email, defaultPassword, request.license_number], function(err) {
            if (err) {
                console.error(err.message);
                return res.status(400).json({ error: "البريد الإلكتروني لهذا الخبير مسجل بالفعل في النظام." });
            }

            // تحديث حالة الطلب لكي لا يظهر مجدداً في لوحة المدير
            db.run(`UPDATE expert_requests SET status = 'approved' WHERE id = ?`, [requestId], (err) => {
                if (err) console.error(err.message);
                res.status(200).json({ success: true, message: "تم قبول الخبير بنجاح وإضافته لقائمة المنصة الرسمية!" });
            });
        });
    });
});

// ========================================================
// 🌟 مسار جلب الطلبات الخاصة بعميل معين (بناءً على بريده) 🌟
// ========================================================
app.get('/get-client-orders', (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: "البريد الإلكتروني مطلوب" });

    const sql = `SELECT id, service_type, client_name, request_details, deposit_amount, created_at FROM service_orders WHERE user_email = ? ORDER BY id DESC`;
    
    db.all(sql, [email], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: "حدث خطأ أثناء جلب طلبات العميل" });
        }
        res.json(rows);
    });
});

// ========================================================
// 🌟 مسار جلب جميع الطلبات في النظام (خاص بالمدير/الأدمن) 🌟
// ========================================================
app.get('/get-all-orders', (req, res) => {
    const sql = `SELECT id, service_type, client_name, request_details, user_email, deposit_amount, attachments, created_at FROM service_orders ORDER BY id DESC`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: "حدث خطأ أثناء جلب طلبات المدير" });
        }
        res.json(rows);
    });
});

// ⚠️ مسار توجيه الصفحات العام الديناميكي (يجب وضعه في نهاية المسارات دائماً بعد كل مسارات البيانات)
app.get('/:page', (req, res) => {
    const page = req.params.page;
    res.sendFile(path.join(__dirname, '../frontend', page));
});

/**
 * 7. تشغيل السيرفر
 */

app.listen(PORT, () => {
    console.log(`السيرفر يعمل الآن بنجاح على المنفذ: ${PORT}`);

});
