import { chromium } from "playwright";

const RUNS = 6;
const browser = await chromium.launch();
let landed = 0;
let bounced = 0;

for (let i = 0; i < RUNS; i++) {
  const ctx = await browser.newContext(); // fresh cookies each run
  const page = await ctx.newPage();
  await page.goto("https://xerox-eta.vercel.app/admin/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "radhexerox@gmail.com");
  await page.fill('input[type="password"]', "123456");

  await page.click('button[type="submit"]'); // exactly ONE click
  await page.waitForTimeout(4000); // give navigation time, do not click again

  const url = page.url();
  const ok = url.includes("/admin") && !url.includes("/admin/login");
  if (ok) landed++;
  else bounced++;
  console.log(`run ${i + 1}: ${ok ? "OK  -> dashboard" : "BOUNCED -> " + url}`);
  await ctx.close();
}

console.log(`\nlanded on dashboard: ${landed}/${RUNS}, bounced back to login: ${bounced}/${RUNS}`);
await browser.close();
