export type OrderStatus =
  | "pending_payment"
  | "rejected"
  | "token_assigned"
  | "ready"
  | "completed";

export type PrintSpec = {
  copies: number;
  color: "bw" | "color";
  duplex: boolean;
  binding: "none" | "staple" | "spiral";
  page_count: number;
};

export type Order = {
  id: string;
  order_number: string;
  phone_number: string;
  status: OrderStatus;
  print_spec: PrintSpec | null;
  document_url: string | null;
  total_amount: number;
  payment_screenshot_url: string | null;
  payment_utr: string | null;
  token_number: number | null;
  estimated_ready_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  created_at: string;
  ocr_extracted: Record<string, unknown> | null;
  verification_failure_reason: string | null;
  payment_fingerprint: string | null;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  product?: StationeryProduct | null;
};

export type StationeryProduct = {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  image_url: string | null;
  active: boolean;
};

export type CartLine = {
  product_id: string;
  quantity: number;
};

export type OrderWithItems = Order & { order_items: OrderItem[] };
