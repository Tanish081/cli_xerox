import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto("https://xerox-eta.vercel.app/admin/login", { waitUntil: "networkidle" });

// Simulate a password manager / browser autofill: set the DOM values
// directly WITHOUT dispatching the events React listens for. This is what
// autofill does, and it leaves React's state empty while the inputs look
// filled on screen.
await page.evaluate(() => {
  document.querySelector('input[type="email"]').value = "radhexerox@gmail.com";
  document.querySelector('input[type="password"]').value = "123456";
});

const shown = await page.evaluate(() => ({
  email: document.querySelector('input[type="email"]').value,
  password: document.querySelector('input[type="password"]').value,
}));
console.log("fields show:", JSON.stringify(shown));

await page.click('button[type="submit"]'); // ONE click
await page.waitForTimeout(4000);

console.log("url after single click:", page.url());
const body = await page.locator("body").innerText();
const err = body.split("\n").find((l) => /invalid|missing|required|credential/i.test(l));
console.log("error shown:", err ?? "(none)");

await browser.close();
