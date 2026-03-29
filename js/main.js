let tg = window.Telegram.WebApp;
tg.expand();

function openLink(url) { tg.openLink(url); }

function askAI() {
    let query = document.getElementById('aiQuery').value;
    if(query) {
        tg.sendData(query);
        alert("আপনার প্রশ্নটি জমা হয়েছে। এআই শীঘ্রই উত্তর দেবে।");
    } else {
        alert("দয়া করে কিছু লিখুন।");
    }
}

function calculateBill() {
    let speed = prompt("কত Mbps ইন্টারনেট প্রয়োজন?");
    if(speed) alert(speed + " Mbps এর আনুমানিক বিল " + (speed * 100) + " টাকা।");
}

function toggleDarkMode() {
    document.body.style.backgroundColor = (document.body.style.backgroundColor === 'rgb(34, 34, 34)') ? '#f4f7f6' : '#222';
    document.body.style.color = (document.body.style.color === 'white') ? '#333' : 'white';
}

function generatePass() {
    let pass = Math.random().toString(36).slice(-10);
    alert("আপনার সিকিউর পাসওয়ার্ড: " + pass);
}
