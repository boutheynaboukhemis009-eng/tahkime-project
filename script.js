/**
 * 1. تهيئة الأحداث (Event Listeners) وحماية الصفحات
 */
document.addEventListener('DOMContentLoaded', () => {
    
    // حماية صفحات الداشبورد
    const currentPath = window.location.pathname;
    const isLoggedIn = localStorage.getItem('isLoggedIn'); 

    if (currentPath.includes('-dashboard.html')) {
        if (isLoggedIn !== 'true') {
            alert('يرجى تسجيل الدخول أولاً للوصول إلى لوحة التحكم!');
            window.location.href = 'login.html'; 
            return; 
        }
    }

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const applyNowBtn = document.getElementById('applyNowBtn'); 

    if (loginForm) loginForm.addEventListener('submit', (e) => handleFormSubmit(e, 'login'));
    if (registerForm) registerForm.addEventListener('submit', (e) => handleFormSubmit(e, 'register'));
    
    const addExpertForm = document.getElementById('addExpertForm');
    if (addExpertForm) addExpertForm.addEventListener('submit', (e) => handleFormSubmit(e, 'add-expert'));

    // ربط حدث زر تسجيل الخروج بشكل آمن ومحدد
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            // 1. إنهاء الجلسة الحالية فقط (حذف حالة الدخول وبيانات الخدمة)
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userRole');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userName');
            
            // 2. تنظيف بيانات الخدمات المعلقة حتى لا تسبب مشكلة التوجيه التلقائي
            sessionStorage.removeItem('selectedServiceName');
            sessionStorage.removeItem('selectedServiceType');

            alert('تم تسجيل الخروج بنجاح.');
            
            // 3. التوجيه لصفحة تسجيل الدخول وليس إنشاء حساب
            window.location.href = 'login.html'; 
        });
    }

    // تأمين فحص الخدمات (يعمل فقط في صفحة تعبئة البيانات لمنع توقف السكريبت في الصفحات الأخرى)
    const serviceTypeInput = document.getElementById('serviceTypeInput');
    if (serviceTypeInput && currentPath.includes('fill-service-data.html')) {
        const selectedService = sessionStorage.getItem('selectedServiceName');
        if (selectedService) {
            serviceTypeInput.value = selectedService; 
        } else {
            alert('يرجى اختيار خدمة أولاً');
            window.location.href = 'services.html';
            return;
        }
    }

    // منطق زر التقديم التفاعلي الذكي (مطور بالكامل ومحمي)
    if (applyNowBtn) {
        applyNowBtn.addEventListener('click', function(e) {
            e.preventDefault(); // إلغاء أي توجيه افتراضي قادم من الـ HTML فوراً
            e.stopPropagation(); // منع انتشار الحدث في المتصفح
            
            const userRole = localStorage.getItem('userRole'); 

            // 1. إذا كان المستخدم غير مسجل الدخول، نقوم بتخييره عبر نافذة تظهر قسراً
            if (localStorage.getItem('isLoggedIn') !== 'true') {
                
                const askExpert = confirm("مرحباً بك! هل ترغب في الانضمام إلى المنصة كـ (خبير/محكم معتمد)؟\n\nاضغط [موافق / OK] للتقديم كخبير.\nاضغط [إلغاء / Cancel] للتسجيل كعميل طالب للخدمة.");
                
                if (askExpert) {
                    window.location.href = 'expert-register.html';
                } else {
                    window.location.href = 'register.html';
                }

            } else {
                // 2. إذا كان مسجلاً دخول بالفعل، يوجه تلقائياً حسب رتبته السابقة كما هي تماماً
                switch (userRole) {
                    case 'admin':
                        window.location.href = 'admin-dashboard.html';
                        break;
                    case 'company': 
                        window.location.href = 'client-dashboard.html';
                        break;
                    case 'expert':
                        window.location.href = 'expert-dashboard.html';
                        break;
                    default:
                        window.location.href = 'login.html';
                        break;
                }
            }
        });
    }

    // استدعاء الدوال الأساسية عند تحميل الصفحة
    fetchAndDisplayUserInfo();
    loadUserData();
    loadExpertsList();
    
    // دوال جلب طلبات الخدمات وقضايا العملاء
    loadClientOrders();
    loadAdminOrders();
    
    // جلب طلبات انضمام الخبراء المعلقة للمدير تلقائياً
    if (typeof loadPendingExpertsRequests === 'function') {
        loadPendingExpertsRequests();
    }
});

/**
 * 2. مدير الطلبات (Request Handler)
 */
async function handleFormSubmit(e, type) {
    e.preventDefault();
    const formData = gatherFormData(type);
    if (type === 'register' && !validateForm(formData)) return;
    
    try {
        const response = await fetch(`http://localhost:3000/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            handleSuccess(type, data);
        } else {
            alert(data.error || 'حدث خطأ ما');
        }
    } catch (error) {
        console.error("خطأ في الاتصال بالسيرفر:", error);
        alert("لا يمكن الاتصال بالسيرفر.");
    }
}

/**
 * وحدة التحقق من المدخلات (Validation Module)
 */
function validateForm(data) {
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (password !== confirmPassword) {
        alert('خطأ: كلمة المرور غير متطابقة!');
        return false;
    }
    if (password.length < 6) {
        alert('كلمة المرور يجب أن تكون 6 خانات على الأقل.');
        return false;
    }
    if (data.phone && !/^\d{10}$/.test(data.phone)) {
        alert('يرجى إدخال رقم هاتف صحيح مكون من 10 أرقام.');
        return false;
    }
    if (data.role === 'admin' && !data.adminCode) {
        alert('يجب إدخال كود المدير!');
        return false;
    }
    return true;
}

/**
 * 3. وحدة جمع البيانات (Data Collector)
 */
function gatherFormData(type) {
    if (type === 'login') {
        return {
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
            role: document.getElementById('loginType').value,
            idNumber: document.getElementById('idNumber').value
        };
    } else if (type === 'add-expert') {
        return {
            name: document.getElementById('name').value,
            specialty: document.getElementById('specialization').value,
            license_number: document.getElementById('license_number').value,
            bio: document.getElementById('bio').value
        };
    } else {
        return {
            name: document.getElementById('fullName').value,
            phone: document.getElementById('phone').value,
            email: document.getElementById('email').value,
            role: document.getElementById('userType').value,
            password: document.getElementById('password').value,
            adminCode: document.getElementById('adminCode')?.value || "",
            idNumber: document.getElementById('idNumber').value
        };
    }
}

/**
 * 4. حماية الصفحات والبيانات المتقدمة
 */
function protectPage(allowedRoles = []) {
    const userRole = localStorage.getItem('userRole');
    const isLoggedIn = localStorage.getItem('isLoggedIn');

    if (isLoggedIn !== 'true' || !userRole) {
        alert('يرجى تسجيل الدخول أولاً!');
        window.location.href = 'login.html';
        return;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
        alert('ليس لديك صلاحية للوصول إلى هذه الصفحة!');
        window.location.href = 'index.html';
    }
}

async function fetchAndDisplayUserInfo() {
    const userNameElement = document.getElementById('userName');
    const userRoleElement = document.getElementById('userRole');
    const email = localStorage.getItem('userEmail');

    if (!userNameElement || !email) return;

    try {
        const response = await fetch(`http://localhost:3000/user-info?email=${encodeURIComponent(email)}`);
        if (!response.ok) return;
        const user = await response.json();
        userNameElement.innerText = user.name || "مستخدم";
        if (userRoleElement) userRoleElement.innerText = user.role || "غير محدد";
    } catch (error) {
        console.error("خطأ:", error);
    }
}

async function fetchAdminStats() {
    try {
        const response = await fetch('http://localhost:3000/admin-stats');
        const data = await response.json();
        const element = document.getElementById('userCount');
        if (element) element.innerText = data.totalUsers;
    } catch (err) {
        console.error("خطأ في جلب الإحصائيات");
    }
}

/**
 * 5. وحدة النجاح والتوجيه
 */
function handleSuccess(type, data) {
    if (type === 'login') {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userRole', data.role);
        localStorage.setItem('userEmail', data.email);
        localStorage.setItem('userName', data.name || "مستخدم");
        
        alert('تم تسجيل الدخول بنجاح!');

        if (data.role === 'company') {
            window.location.href = 'client-dashboard.html';
        } else {
            window.location.href = data.role + '-dashboard.html';
        }
        
    } else if (type === 'register') {
        alert('تم التسجيل بنجاح!');
        window.location.href = 'login.html';
    } else if (type === 'add-expert') {
        alert('تم إضافة الخبير بنجاح!');
        window.location.href = 'experts.html';
    }
}

/**
 * 6. وظائف الواجهة (UI Helpers)
 */
function toggleFields() {
    const userType = document.getElementById('userType')?.value;
    const adminGroup = document.getElementById('adminCodeGroup');
    const idLabel = document.getElementById('idLabel');
    
    if (adminGroup) adminGroup.style.display = (userType === 'admin') ? 'block' : 'none';
    if (idLabel) idLabel.innerText = (userType === 'company') ? 'رقم السجل التجاري' : 'رقم التعريف الوطني';
}

function showSection(sectionId) {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(s => s.style.display = 'none');
    const target = document.getElementById(sectionId);
    if (target) target.style.display = 'block';
}

/**
/**
 * 8. منطق أزرار "طلب الخدمة" داخل مجلد service-details
 */
document.addEventListener('click', (e) => {
    // استخدام .closest للتأكد من التقاط الزر حتى لو ضغط المستخدم على الـ span أو الـ svg بالداخل
    const requestBtn = e.target.closest('.service-request-btn');
    
    if (requestBtn) {
        
        // 🌟 إذا كان هذا الزر هو زر التقديم التفاعلي الذكي (applyNowBtn)، نوقفه هنا تماماً ليتولى أمره المنطق الأول في السكريبت
        if (requestBtn.id === 'applyNowBtn') {
            return; 
        }

        e.preventDefault();
        const isLoggedIn = localStorage.getItem('isLoggedIn');

        if (isLoggedIn !== 'true') {
            alert('أنت لست مسجل ولا تملك صلاحية الاستفادة من الخدمة. يرجى إنشاء حساب أولاً.');
            window.location.href = 'register.html'; // تعديل المسار ليتناسب مع الصفحة الرئيسية
        } else {
            const serviceName = requestBtn.getAttribute('data-service-name') || 'خدمة غير محددة';
            const serviceType = requestBtn.getAttribute('data-service-type') || 'general';

            sessionStorage.setItem('selectedServiceName', serviceName);
            sessionStorage.setItem('selectedServiceType', serviceType);

            window.location.href = 'fill-service-data.html'; // تعديل المسار ليتناسب مع الصفحة الرئيسية
        }
    }
});

/**
 * 9. معالجة نموذج طلب الخدمة المطور (البيانات + الملفات + الدفع المالي)
 */
document.addEventListener('submit', async (e) => {
    if (e.target && e.target.id === 'secureServiceOrderForm') {
        e.preventDefault();
        
        const serviceTypeEl = document.getElementById('serviceTypeInput');
        const clientNameEl = document.getElementById('clientName');
        const requestDetailsEl = document.getElementById('requestDetails');
        const cardNumberEl = document.getElementById('cardNumber');
        
        const formData = new FormData();
        formData.append('serviceType', serviceTypeEl ? serviceTypeEl.value : 'عامة');
        formData.append('clientName', clientNameEl ? clientNameEl.value : 'مستند فارغ');
        formData.append('requestDetails', requestDetailsEl ? requestDetailsEl.value : '');
        formData.append('userEmail', localStorage.getItem('userEmail') || 'guest@example.com');
        formData.append('cardNumber', cardNumberEl ? cardNumberEl.value : '');
        formData.append('depositAmount', '250'); 

        const fileInput = document.getElementById('serviceFiles');
        if (fileInput && fileInput.files.length > 0) {
            for (let i = 0; i < fileInput.files.length; i++) {
                formData.append('attachments', fileInput.files[i]);
            }
        }

        try {
            const response = await fetch('http://localhost:3000/submit-service-order', {
                method: 'POST',
                body: formData 
            });

            if (response.ok) {
                const result = await response.json();
                alert('تمت عملية معالجة العربون بنجاح، ورفع المستندات الثبوتية. طلبك قيد المراجعة الرسمية الآن.');
                
                sessionStorage.removeItem('selectedServiceName');
                sessionStorage.removeItem('selectedServiceType');

                window.location.href = 'client-dashboard.html';
            } else {
                const errorResult = await response.json().catch(() => ({}));
                alert(errorResult.error || 'رفض السيرفر العملية، يرجى التحقق من صحة بيانات البطاقة.');
            }
        } catch (error) {
            console.error("خطأ تقني أثناء معالجة الطلب المالي:", error);
            alert("فشل الإرسال: تأكد من تشغيل خادم Node.js المحلي (server.js) على المنفذ 3000 أولاً.");
        }
    }
});

/**
 * 10. وظائف جلب البيانات والعرض (إظهار اسم المستخدم الحالي)
 */
async function loadUserData() {
    const nameElement = document.getElementById('expertName');
    if (!nameElement) return;

    const savedName = localStorage.getItem('userName');
    
    if (savedName && savedName !== 'undefined') {
        nameElement.textContent = savedName;
    } else {
        const email = localStorage.getItem('userEmail');
        if (email) {
            try {
                const response = await fetch(`http://localhost:3000/user-info?email=${encodeURIComponent(email)}`);
                const user = await response.json();
                
                if (user.name) {
                    nameElement.textContent = user.name;
                    localStorage.setItem('userName', user.name);
                } else {
                    nameElement.textContent = "خبيرنا";
                }
            } catch (err) {
                nameElement.textContent = "خبيرنا";
            }
        }
    }
}

/**
 * 11. جلب وعرض الخبراء ديناميكياً مع تفعيل الصور الذكية
 */
async function loadExpertsList() {
    const container = document.getElementById('expertsContainer') || document.querySelector('.experts-grid');
    if (!container) return; 

    try {
        const response = await fetch('http://localhost:3000/get-experts');
        if (!response.ok) return;
        
        const experts = await response.json();
        
        if (experts.length > 0) {
            container.innerHTML = experts.map(exp => {
                const expertPhotoUrl = `/assets/photos/${exp.name}.jpg`; 
                const defaultPhotoUrl = `/assets/photos/default.jpg`;
                return `
                    <div class="expert-card" style="
                        background: #ffffff;
                        border: 1px solid #eef2f5;
                        border-radius: 12px;
                        padding: 24px;
                        margin: 15px;
                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
                        transition: transform 0.3s ease, box-shadow 0.3s ease;
                        text-align: right;
                        border-top: 4px solid #007bff;
                    ">
                        <div style="text-align: center; margin-bottom: 15px;">
                            <img src="${expertPhotoUrl}" 
                                 alt="${exp.name}" 
                                 onerror="this.onerror=null; this.src='${defaultPhotoUrl}';" 
                                 style="
                                     width: 90px; 
                                     height: 90px; 
                                     border-radius: 50%; 
                                     object-fit: cover; 
                                     border: 3px solid #eef2f5;
                                     box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                                 "
                            />
                        </div>

                        <h3 style="
                            margin-top: 0;
                            color: #2d3748;
                            font-size: 20px;
                            margin-bottom: 12px;
                            text-align: center;
                        ">👨‍⚖️ ${exp.name}</h3>
                        
                        <div style="text-align: center; margin-bottom: 10px;">
                            <p class="specialty" style="
                                color: #4a5568;
                                font-size: 15px;
                                margin: 8px 0;
                                background: #f7fafc;
                                padding: 8px 12px;
                                border-radius: 6px;
                                display: inline-block;
                            ">
                                <strong>التخصص:</strong> ${exp.specialty}
                            </p>
                        </div>
                        
                        <p class="license" style="
                            color: #718096;
                            font-size: 14px;
                            margin: 8px 0;
                            text-align: center;
                        ">
                            <strong>رقم الرخصة:</strong> 
                            <span style="color: #2b6cb0; font-weight: bold;">${exp.license_number || 'غير مسجل'}</span>
                        </p>
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        console.error("خطأ أثناء تحديث واجهة الخبراء مع الصور:", err);
    }
}

/**
 * 12. جلب وعرض طلبات الخدمة الخاصة بالعميل الحالي في الداشبورد
 */
async function loadClientOrders() {
    const container = document.getElementById('clientOrdersTableBody'); 
    if (!container) return;

    const email = localStorage.getItem('userEmail');
    if (!email) return;

    try {
        const response = await fetch(`http://localhost:3000/get-client-orders?email=${encodeURIComponent(email)}`);
        if (!response.ok) return;

        const orders = await response.json();
        if (orders.length === 0) {
            container.innerHTML = `<tr><td colspan="5" style="text-align:center;">لا توجد طلبات مقدمة حالياً.</td></tr>`;
            return;
        }

        container.innerHTML = orders.map(order => `
            <tr>
                <td>#${order.id}</td>
                <td>${order.service_type}</td>
                <td>${order.request_details.substring(0, 50)}...</td>
                <td style="color: green; font-weight: bold;">${order.deposit_amount} DA</td>
                <td>${new Date(order.created_at).toLocaleDateString('ar-EG')}</td>
            </tr>
        `).join('');

    } catch (err) {
        console.error("خطأ in جلب طلبات العميل:", err);
    }
}

/**
 * 13. جلب وعرض كافة طلبات النظام لمدير المنصة (لوحة تحكم الأدمن)
 */
async function loadAdminOrders() {
    const container = document.getElementById('adminOrdersTableBody'); 
    if (!container) return;

    try {
        const response = await fetch('http://localhost:3000/get-all-orders');
        if (!response.ok) return;

        const orders = await response.json();
        if (orders.length === 0) {
            container.innerHTML = `<tr><td colspan="7" style="text-align:center;">لا توجد طلبات جديدة في النظام.</td></tr>`;
            return;
        }

        container.innerHTML = orders.map(order => {
            const fileLink = order.attachments 
                ? `<a href="http://localhost:3000/uploads/${order.attachments.split(',')[0]}" target="_blank" style="color: #2b6cb0; font-weight:bold;">عرض المستند</a>` 
                : 'لا يوجد مرفقات';

            return `
                <tr>
                    <td>#${order.id}</td>
                    <td><b>${order.client_name}</b><br><small style="color:#718096;">${order.user_email}</small></td>
                    <td>${order.service_type}</td>
                    <td>${order.request_details}</td>
                    <td>${fileLink}</td>
                    <td style="color: #e53e3e; font-weight: bold;">${order.deposit_amount} DA</td>
                    <td><span style="background: #feebc8; color: #c05621; padding: 4px 8px; border-radius: 4px; font-size: 13px;">قيد المراجعة</span></td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("خطأ في جلب طلبات المدير:", err);
    }
}

/**
 * 14. إرسال طلب انضمام الخبير من الاستمارة
 */
async function submitExpertJoinRequest(event) {
    event.preventDefault();
    
    const name = document.getElementById('expName').value;
    const specialty = document.getElementById('expSpecialty').value;
    const license = document.getElementById('expLicense').value;
    const email = document.getElementById('expEmail').value;
    const bio = document.getElementById('expBio').value;

    try {
        const response = await fetch('http://localhost:3000/submit-expert-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, specialty, license_number: license, bio, email })
        });

        const data = await response.json();
        if (response.ok) {
            alert(data.message);
            document.getElementById('expertJoinForm').reset();
        } else {
            alert(data.error || "حدث خطأ ما");
        }
    } catch (err) {
        console.error("خطأ أثناء إرسال طلب الخبير:", err);
    }
}

/**
 * 15. جلب وعرض طلبات الخبراء المعلقة للمدير
 */
async function loadPendingExpertsRequests() {
    const container = document.getElementById('pendingExpertsTableBody');
    if (!container) return;

    try {
        const response = await fetch('http://localhost:3000/get-pending-experts');
        if (!response.ok) return;

        const requests = await response.json();
        if (requests.length === 0) {
            container.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#718096;">لا توجد طلبات انضمام معلقة حالياً.</td></tr>`;
            return;
        }

        container.innerHTML = requests.map(req => `
            <tr>
                <td><b>${req.name}</b></td>
                <td>${req.email}</td>
                <td><span style="background:#e2e8f0; padding:3px 8px; border-radius:4px;">${req.specialty}</span></td>
                <td>${req.license_number || 'غير متوفر'}</td>
                <td>${req.bio || 'لا يوجد نبذة'}</td>
                <td>
                    <button onclick="approveExpertRequest(${req.id})" style="background:#28a745; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold;">✅ قبول وإضافة</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error("خطأ في جلب طلبات الخبراء:", err);
    }
}

/**
 * 16. تنفيذ إجراء الموافقة على الخبير من قبل المدير
 */
async function approveExpertRequest(requestId) {
    if (!confirm("هل أنت متأكد من قبول هذا الخبير وضمه رسمياً للمنصة؟")) return;

    try {
        const response = await fetch('http://localhost:3000/approve-expert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId })
        });

        const data = await response.json();
        alert(data.message || data.error);
        if (response.ok) {
            loadPendingExpertsRequests(); 
            if (typeof loadExpertsList === 'function') loadExpertsList(); 
        }
    } catch (err) {
        console.error("خطأ أثناء تفعيل الخبير:", err);
    }
}
/**
 * إرسال طلبات صفحة "تواصل معنا" المحدثة مباشرة إلى جدول طلبات المدير
 */
async function submitContactMessage(event) {
    event.preventDefault();
    
    // جلب قيم المدخلات من المعرفات التي أضفناها للـ HTML
    const clientName = document.getElementById('contactName').value;
    const phone = document.getElementById('contactPhone').value;
    const userEmail = document.getElementById('contactEmail').value;
    const selectType = document.getElementById('contactType').value;
    const details = document.getElementById('contactMessage').value;

    // دمج نوع الاستشارة، رقم الهاتف والتفاصيل داخل حقل التفاصيل الموجه للمدير ليرى الصورة كاملة
    const requestDetails = `[نوع الاستشارة: ${selectType}] [هاتف العميل: ${phone}] - ${details}`;

    // إعداد كائن FormData ليمر عبر السيرفر بأمان بدون كسر التحقق (Validation)
    const formData = new FormData();
    formData.append('serviceType', '📞 طلب استشارة فورية');
    formData.append('clientName', clientName);
    formData.append('requestDetails', requestDetails);
    formData.append('userEmail', userEmail);
    formData.append('cardNumber', 'مستند تواصل'); 
    formData.append('depositAmount', '0'); 

    try {
        const response = await fetch('http://localhost:3000/submit-service-order', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            alert('تم إرسال طلب الاستشارة بنجاح إلى الإدارة والمدير! ستظهر فوراً في لوحة التحكم لمراجعتها.');
            document.getElementById('contactForm').reset();
        } else {
            const errorResult = await response.json().catch(() => ({}));
            alert(errorResult.error || 'عذراً، فشل إرسال الاستشارة حالياً، يرجى إعادة المحاولة.');
        }
    } catch (error) {
        console.error("خطأ أثناء إرسال طلب الاستشارة:", error);
        alert("فشل الاتصال: يرجى التأكد من تشغيل خادم Node.js المحلي المحلي (server.js).");
    }
}