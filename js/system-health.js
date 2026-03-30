/**
 * Unique Nano AI - System Health & Auto-Repair Logic
 * Author: Unique Network BD (Cybersecurity & ISP Solutions)
 */

// ১. চেক করার জন্য প্রয়োজনীয় ফাইল এবং তাদের ডিফল্ট কন্টেন্ট (Boilerplate)
const systemStructure = {
    "data/brain.json": {
        content: {
            "brain_version": "1.0.0-Nano",
            "ai_sensitivity": 0.8,
            "knowledge_base": [],
            "default_responses": { "unknown": "দুঃখিত, আমি এটি বুঝতে পারিনি।" }
        },
        message: "Initial Nano Brain Created"
    },
    "bot/requirements.txt": {
        content: "pyTelegramBotAPI\nrequests\npython-dotenv",
        message: "Bot Requirements Initialized"
    },
    "config.json": {
        content: { "bot_name": "Unique AI", "version": "1.0.1", "status": "active" },
        message: "System Config Created"
    },
    "data/users.json": {
        content: [],
        message: "User Registry Initialized"
    }
};

// ২. এনক্রিপশন সাপোর্ট (ড্যাশবোর্ড থেকে টোকেন পড়ার জন্য)
const decodeToken = (s) => s ? decodeURIComponent(escape(atob(s))) : "";

// ৩. গিটহাব থেকে ফাইল চেক করার মেইন ফাংশন
async function checkSystemIntegrity() {
    const config = JSON.parse(localStorage.getItem('un_sys_config') || '{}');
    const token = decodeToken(config.gh);
    const repo = config.repo; // e.g., "username/unique-ai-mini-app"

    if (!token || !repo) {
        alert("প্রথমে Settings ট্যাব থেকে GitHub Token এবং Repo Name সেভ করুন!");
        return;
    }

    const statusDiv = document.getElementById('healthStatus');
    statusDiv.innerHTML = "<p style='color:orange;'>🔍 সিস্টেম স্ক্যান করা হচ্ছে...</p>";
    
    let missingFiles = [];
    let htmlResult = "";

    for (let filePath in systemStructure) {
        try {
            const response = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
                headers: { "Authorization": `token ${token}` }
            });

            if (response.status === 200) {
                htmlResult += `<div class="status-item"><span>${filePath}</span> <b style="color:var(--success)">[OK]</b></div>`;
            } else {
                htmlResult += `<div class="status-item"><span>${filePath}</span> <b style="color:var(--danger)">[MISSING]</b></div>`;
                missingFiles.push(filePath);
            }
        } catch (err) {
            console.error("Check Error:", err);
        }
    }

    statusDiv.innerHTML = htmlResult;

    if (missingFiles.length > 0) {
        localStorage.setItem('pending_repair', JSON.stringify(missingFiles));
        document.getElementById('repairBtn').classList.remove('hidden');
    } else {
        document.getElementById('repairBtn').classList.add('hidden');
        alert("অভিনন্দন! আপনার সিস্টেম স্ট্রাকচার একদম সঠিক আছে।");
    }
}

// ৪. অটো-রিপেয়ার ফাংশন (মিসিং ফাইল তৈরি করা)
async function startRepair() {
    const missing = JSON.parse(localStorage.getItem('pending_repair') || '[]');
    const config = JSON.parse(localStorage.getItem('un_sys_config') || '{}');
    const token = decodeToken(config.gh);
    const repo = config.repo;

    if (missing.length === 0) return;

    document.getElementById('repairBtn').innerHTML = "<i class='fas fa-sync fa-spin'></i> রিপেয়ার হচ্ছে...";
    
    for (let file of missing) {
        const fileMeta = systemStructure[file];
        const contentStr = typeof fileMeta.content === 'object' 
            ? JSON.stringify(fileMeta.content, null, 2) 
            : fileMeta.content;

        try {
            const res = await fetch(`https://api.github.com/repos/${repo}/contents/${file}`, {
                method: "PUT",
                headers: {
                    "Authorization": `token ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: fileMeta.message,
                    content: btoa(unescape(encodeURIComponent(contentStr)))
                })
            });
            
            if(res.ok) console.log(`✅ Fixed: ${file}`);
        } catch (err) {
            console.error(`❌ Repair Failed for ${file}:`, err);
        }
    }

    alert("রিপেয়ার সম্পন্ন হয়েছে! পুনরায় স্ক্যান করা হচ্ছে...");
    localStorage.removeItem('pending_repair');
    document.getElementById('repairBtn').innerHTML = "<i class='fas fa-tools'></i> Auto-Repair missing files";
    checkSystemIntegrity();
      }
