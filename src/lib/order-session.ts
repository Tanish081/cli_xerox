import { cookies } from "next/headers";

const COOKIE_PREFIX = "order_session_";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 3; // 3 days — plenty for pickup + review

// One cookie per order (order_session_<id>=1) rather than a single cookie
// holding one id, so a customer who places more than one order in the same
// browser session can still track each of them.
export async function grantOrderSession(orderId: string) {
  const store = await cookies();
  store.set(`${COOKIE_PREFIX}${orderId}`, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function hasOrderSession(orderId: string): Promise<boolean> {
  const store = await cookies();
  return store.get(`${COOKIE_PREFIX}${orderId}`)?.value === "1";
}
