// Render original vector artwork and typography to the locally bundled share image.
import { readFile } from "node:fs/promises";
const { chromium } = await import(process.env.DESK_PLAYWRIGHT || "playwright");
const font = await readFile("public/fonts/manrope-latin.woff2");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html><html><head><style>
 @font-face{font-family:Manrope;src:url(data:font/woff2;base64,${font.toString("base64")}) format('woff2');font-weight:200 800}
 *{box-sizing:border-box}body{margin:0;width:1200px;height:630px;background:#10120f;color:#f1f0e5;font-family:Manrope,Arial,sans-serif;padding:58px 64px;position:relative;overflow:hidden}.brand{display:flex;align-items:center;gap:15px;font-size:26px;font-weight:700}.brand span{color:#a7ad9d;font-weight:400}h1{font-size:68px;line-height:1.1;letter-spacing:-3px;font-weight:600;margin:64px 0 24px;max-width:700px}p{font-size:22px;color:#a7ad9d;line-height:1.5;margin:0}.bottom{position:absolute;bottom:52px;left:64px;right:64px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #34392e;padding-top:24px;font-size:17px;color:#a7ad9d}.tag{background:#ebc483;color:#24281f;padding:10px 18px;border-radius:6px;font-weight:600}.art{position:absolute;right:45px;top:92px;width:380px;height:390px}.receipt{position:absolute;width:180px;height:250px;background:#e9e7d7;color:#24281f;border-radius:8px;padding:20px;right:45px;top:240px;transform:rotate(10deg);font-size:15px}.receipt strong{display:block;font-size:36px;margin-top:20px;font-weight:600}.receipt hr{border:0;border-top:1px dashed #929b87;margin:14px -20px}.receipt small{font-size:14px;color:#555a49}.receipt b{display:block;margin-top:8px;font-size:19px}
 </style></head><body>
 <div class="brand"><svg viewBox="0 0 40 40" width="36" height="36"><path d="M8 16C-1 2 12 1 16 10c3-1 5-1 8 0C28 1 41 2 32 16c7 14-1 20-12 20S1 30 8 16Z" fill="#ebc483"/><path d="M12 21h3m10 0h3m-11 7 3 2 3-2" fill="none" stroke="#10120f" stroke-width="2.5" stroke-linecap="round"/></svg>Squeekstr <span>Desk</span></div>
 <h1>Small Squeeks.<br>Shared power.</h1><p>Deposit. Merge. Earn paper SQK.<br>Your protocol desk for the Squeekchain wheel.</p>
 <svg class="art" viewBox="0 0 360 390" fill="none"><circle cx="170" cy="163" r="135" stroke="#30372b" stroke-width="20"/><circle cx="170" cy="163" r="135" stroke="#a5b08d"/><circle cx="170" cy="163" r="120" stroke="#616e4c" stroke-width="4" stroke-dasharray="2 14"/><path d="M170 28a135 135 0 0 1 117 68" stroke="#ebc483" stroke-width="7" stroke-linecap="round"/>
 <g transform="translate(40 92) scale(1.6)"><path d="M43 52C26 34 33 17 48 22c10 3 13 14 15 21M98 43c2-15 12-26 24-20 12 7 5 24-7 31" fill="#e8b273" stroke="#35352b" stroke-width="2.5"/><path d="M46 42c-9-10-9-14-4-14s9 7 10 13M110 42c0-9 8-16 12-12s0 10-6 15" fill="#dc9587"/><path d="M37 75c0-26 18-40 43-40 27 0 44 19 44 43 0 20-15 30-44 30-29 0-43-11-43-33Z" fill="#e8b273" stroke="#35352b" stroke-width="2.5"/><path d="M80 55c-10 0-9 21-20 21-18-7-19 17-9 23 15 10 44 10 59 0 10-7 6-28-10-23-11 0-11-21-20-21Z" fill="#f5dcad"/><ellipse cx="58" cy="65" rx="4" ry="5" fill="#25271e"/><ellipse cx="102" cy="65" rx="4" ry="5" fill="#25271e"/><circle cx="59" cy="63" r="1.3" fill="#fff7dc"/><circle cx="103" cy="63" r="1.3" fill="#fff7dc"/><path d="m75 77 5 4 5-4c-2-4-8-4-10 0Z" fill="#664a3b"/><path d="M80 81v5m0 0c-5 4-8 1-8-1m8 1c5 4 8 1 8-1M36 77l14 3M33 85h17M112 80l14-3M112 85h16" stroke="#35352b" stroke-width="1.5" stroke-linecap="round"/></g></svg>
 <div class="receipt">Tracker #001<strong>1,075</strong><small>mining power</small><hr><small>Community powered</small><b>Claim & trade</b></div>
 <div class="bottom"><span>Community paper simulation · No wallet needed</span><span class="tag">Squeekchain Genesis Code</span></div>
 </body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "public/social.png" });
  console.log("Created public/social.png (1200 × 630).");
} finally {
  await browser.close();
}
