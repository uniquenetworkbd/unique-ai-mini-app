// আপনার আগের ফাংশনগুলো (askAI, generatePass ইত্যাদি) এখানে থাকবে...

// Advanced Bkash Calculator
function calculateBkash() {
    let amount = parseFloat(document.getElementById('bkashAmount').value);
    if (!amount || amount <= 0) {
        alert("দয়া করে সঠিক টাকার পরিমাণ লিখুন।");
        return;
    }

    let appCharge = (amount * 17.5) / 1000;
    let ussdCharge = (amount * 18.5) / 1000;

    let resultHtml = `
        <div style="text-align:left; font-size:14px; background:#fff3f8; padding:12px; border-radius:10px; border:1px solid #e2136e;">
            <b style="color:#e2136e;">রেজাল্ট:</b><br>
            অ্যাপ চার্জ: ৳${appCharge.toFixed(2)}<br>
            ম্যানুয়াল (USSD): ৳${ussdCharge.toFixed(2)}<br>
            <hr style="border: 0.5px solid #e2136e;">
            <b>টোটাল ক্যাশ-ইন (App): ৳${(amount + appCharge).toFixed(2)}</b>
        </div>
    `;
    document.getElementById('bkashResult').innerHTML = resultHtml;
}
