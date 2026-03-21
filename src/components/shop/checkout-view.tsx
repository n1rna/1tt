"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { medusa, formatPrice } from "@/lib/shop/client";
import { getCartId, clearCartId } from "@/lib/shop/cart";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, ShoppingBag, Lock, CheckCircle2, User, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

// ── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  thumbnail: string | null;
  product_title: string | null;
  variant_title: string | null;
}

interface Cart {
  id: string;
  items: CartItem[];
  total: number;
  subtotal: number;
  shipping_total: number;
  tax_total: number;
  discount_total: number;
  currency_code: string;
  email: string | null;
  shipping_address: Address | null;
  billing_address: Address | null;
  promotions?: { id: string; code?: string }[];
  payment_collection: {
    id: string;
    payment_sessions: { id: string; provider_id: string; data: Record<string, unknown>; status: string }[];
  } | null;
}

interface Address {
  first_name: string;
  last_name: string;
  address_1: string;
  address_2: string;
  city: string;
  province: string;
  postal_code: string;
  country_code: string;
  phone: string;
}

// ── Stripe Payment Form ──────────────────────────────────────────────────────

function PaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setPaying(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Payment failed");
      setPaying(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed");
      setPaying(false);
      return;
    }

    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: "accordion",
        }}
      />
      {error && (
        <p className="text-destructive text-sm">{error}</p>
      )}
      <Button
        type="submit"
        className="w-full gap-2"
        size="lg"
        disabled={paying || !stripe || !elements}
      >
        {paying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Lock className="h-4 w-4" />
        )}
        {paying ? "Processing..." : "Pay now"}
      </Button>
    </form>
  );
}

// ── Main Checkout View ───────────────────────────────────────────────────────

export function CheckoutView() {
  const router = useRouter();
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"details" | "shipping" | "payment" | "complete">("details");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [useAccountInfo, setUseAccountInfo] = useState(true);

  // Shipping
  interface ShippingOption {
    id: string;
    name: string;
    amount: number;
    calculated_price?: { calculated_amount: number; currency_code: string };
    type?: { label: string; description: string };
  }
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<string | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);

  // Available countries from Medusa regions
  interface RegionCountry { iso_2: string; display_name: string }
  const [availableCountries, setAvailableCountries] = useState<RegionCountry[]>([]);

  // Form fields
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState("de");
  const [phone, setPhone] = useState("");

  // Promo code
  const [promoCode, setPromoCode] = useState("");
  const [promoApplying, setPromoApplying] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  const applyPromoCode = useCallback(async () => {
    if (!cart || !promoCode.trim()) return;
    setPromoApplying(true);
    setPromoError(null);
    try {
      const res = await medusa.client.fetch<{ cart: Cart }>(
        `/store/carts/${cart.id}/promotions`,
        {
          method: "POST",
          body: { promo_codes: [promoCode.trim()] },
        }
      );
      setCart(res.cart);
      setPromoCode("");
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : "Invalid promo code");
    } finally {
      setPromoApplying(false);
    }
  }, [cart, promoCode]);

  const removePromoCode = useCallback(async (code: string) => {
    if (!cart) return;
    try {
      const res = await medusa.client.fetch<{ cart: Cart }>(
        `/store/carts/${cart.id}/promotions`,
        {
          method: "DELETE",
          body: { promo_codes: [code] },
        }
      );
      setCart(res.cart);
    } catch {
      // silently fail
    }
  }, [cart]);

  const fetchCart = useCallback(async () => {
    const cartId = getCartId();
    if (!cartId) { setLoading(false); return; }
    try {
      const data = await medusa.store.cart.retrieve(cartId);
      const c = (data as unknown as { cart: Cart }).cart;
      setCart(c);
      if (c.email) setEmail(c.email);
      if (c.shipping_address) {
        setFirstName(c.shipping_address.first_name ?? "");
        setLastName(c.shipping_address.last_name ?? "");
        setAddress1(c.shipping_address.address_1 ?? "");
        setAddress2(c.shipping_address.address_2 ?? "");
        setCity(c.shipping_address.city ?? "");
        setProvince(c.shipping_address.province ?? "");
        setPostalCode(c.shipping_address.postal_code ?? "");
        setCountryCode(c.shipping_address.country_code ?? "us");
        setPhone(c.shipping_address.phone ?? "");
      }
    } catch {
      clearCartId();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCart(); }, [fetchCart]);

  // Fetch available countries from Medusa regions
  useEffect(() => {
    (async () => {
      try {
        const res = await medusa.store.region.list({ fields: "+countries.*" });
        const regions = (res as unknown as { regions: { countries: { iso_2: string; display_name: string }[] }[] }).regions ?? [];
        const countries: RegionCountry[] = [];
        const seen = new Set<string>();
        for (const r of regions) {
          for (const c of r.countries ?? []) {
            if (!seen.has(c.iso_2)) {
              seen.add(c.iso_2);
              countries.push(c);
            }
          }
        }
        countries.sort((a, b) => a.display_name.localeCompare(b.display_name));
        setAvailableCountries(countries);
        if (countries.length > 0 && !countries.find((c) => c.iso_2 === countryCode)) {
          setCountryCode(countries[0].iso_2);
        }
      } catch {
        // Fallback
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fill from logged-in user when toggled on
  useEffect(() => {
    if (!isLoggedIn || !useAccountInfo) return;
    const user = session.user;
    if (user.email) setEmail(user.email);
    if (user.name) {
      const parts = user.name.trim().split(/\s+/);
      setFirstName(parts[0] ?? "");
      setLastName(parts.slice(1).join(" ") ?? "");
    }
  }, [isLoggedIn, useAccountInfo, session?.user]);

  // Step 1 → Step 2: Save address, fetch shipping options
  const handleDetailsSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart) return;
    setSubmitting(true);
    setError(null);

    try {
      const cartId = cart.id;
      const address = {
        first_name: firstName,
        last_name: lastName,
        address_1: address1,
        address_2: address2,
        city,
        province,
        postal_code: postalCode,
        country_code: countryCode,
        phone,
      };

      // Update cart with email and addresses
      const updatedCartRes = await medusa.store.cart.update(cartId, {
        email,
        shipping_address: address,
        billing_address: address,
      });
      setCart((updatedCartRes as unknown as { cart: Cart }).cart);

      // Fetch shipping options for this cart
      setShippingLoading(true);
      const shippingRes = await medusa.store.fulfillment.listCartOptions({ cart_id: cartId });
      const options = (shippingRes as unknown as { shipping_options: ShippingOption[] }).shipping_options ?? [];
      setShippingOptions(options);
      if (options.length > 0) setSelectedShipping(options[0].id);
      setShippingLoading(false);

      setStep("shipping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to proceed");
    } finally {
      setSubmitting(false);
    }
  }, [cart, email, firstName, lastName, address1, address2, city, province, postalCode, countryCode, phone]);

  // Step 2 → Step 3: Set shipping method, init payment
  const handleShippingSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart || !selectedShipping) return;
    setSubmitting(true);
    setError(null);

    try {
      // Add shipping method to cart
      const shippingRes = await medusa.store.cart.addShippingMethod(cart.id, {
        option_id: selectedShipping,
      });
      const updatedCart = (shippingRes as unknown as { cart: Cart }).cart;
      setCart(updatedCart);

      // Initialize Stripe payment session
      const sessionRes = await medusa.store.payment.initiatePaymentSession(
        updatedCart as never,
        {
          provider_id: "pp_stripe_stripe",
        }
      );

      const paymentCollection = (sessionRes as unknown as {
        payment_collection: {
          payment_sessions: { data: { client_secret?: string } }[];
        };
      }).payment_collection;

      const stripeSession = paymentCollection?.payment_sessions?.find(
        (s: { data: { client_secret?: string } }) => s.data?.client_secret
      );
      if (!stripeSession?.data?.client_secret) {
        throw new Error("Could not initialize payment. Please try again.");
      }

      setClientSecret(stripeSession.data.client_secret as string);
      setStep("payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to proceed to payment");
    } finally {
      setSubmitting(false);
    }
  }, [cart, selectedShipping]);

  const handlePaymentSuccess = useCallback(async () => {
    const cartId = getCartId();
    if (!cartId) return;
    try {
      // Complete the cart / place the order
      await medusa.store.cart.complete(cartId);
      clearCartId();
      window.dispatchEvent(new Event("cart-updated"));
      setStep("complete");
    } catch {
      setError("Payment was received but order completion failed. Please contact support.");
    }
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-muted rounded w-full" />
        <div className="h-10 bg-muted rounded w-full" />
        <div className="h-10 bg-muted rounded w-3/4" />
      </div>
    );
  }

  // ── Empty cart ─────────────────────────────────────────────────────────────

  if (!cart || cart.items.length === 0) {
    return (
      <div className="text-center py-20">
        <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Your cart is empty.</p>
        <Link href="/shop" className="inline-flex items-center gap-1.5 text-primary text-sm hover:underline mt-3">
          <ArrowLeft className="h-3.5 w-3.5" />
          Continue shopping
        </Link>
      </div>
    );
  }

  // ── Order complete ─────────────────────────────────────────────────────────

  if (step === "complete") {
    return (
      <div className="text-center py-16">
        <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold">Order placed!</h2>
        <p className="text-muted-foreground text-sm mt-2">
          Thank you for your purchase. You&apos;ll receive a confirmation email shortly.
        </p>
        <Button className="mt-6" onClick={() => router.push("/shop")}>
          Back to shop
        </Button>
      </div>
    );
  }

  // ── Checkout ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Left: Form */}
      <div className="flex-1 min-w-0">
        <Link
          href="/shop/cart"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to cart
        </Link>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-6">
          <span className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-full",
            step === "details" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            1. Details
          </span>
          <div className="h-px flex-1 bg-border" />
          <span className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-full",
            step === "shipping" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            2. Shipping
          </span>
          <div className="h-px flex-1 bg-border" />
          <span className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-full",
            step === "payment" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            3. Payment
          </span>
        </div>

        {step === "details" && (
          <form onSubmit={handleDetailsSubmit} className="space-y-4">
            {/* Account info toggle */}
            {isLoggedIn && (
              <div className="rounded-lg border bg-card p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAccountInfo}
                    onChange={(e) => {
                      setUseAccountInfo(e.target.checked);
                      if (!e.target.checked) {
                        setEmail("");
                        setFirstName("");
                        setLastName("");
                      }
                    }}
                    className="rounded border-input"
                  />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Use my account info</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {session.user.name} &middot; {session.user.email}
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={isLoggedIn && useAccountInfo}
                className={cn(
                  "w-full h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring",
                  isLoggedIn && useAccountInfo && "opacity-60 cursor-not-allowed"
                )}
              />
            </div>

            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">First name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isLoggedIn && useAccountInfo}
                  className={cn(
                    "w-full h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring",
                    isLoggedIn && useAccountInfo && "opacity-60 cursor-not-allowed"
                  )}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Last name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={isLoggedIn && useAccountInfo}
                  className={cn(
                    "w-full h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring",
                    isLoggedIn && useAccountInfo && "opacity-60 cursor-not-allowed"
                  )}
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Address</label>
              <input
                type="text"
                required
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
                placeholder="Street address"
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring"
              />
            </div>
            <div>
              <input
                type="text"
                value={address2}
                onChange={(e) => setAddress2(e.target.value)}
                placeholder="Apartment, suite, etc. (optional)"
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">City</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Postal code</label>
                <input
                  type="text"
                  required
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">State / Province</label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Country</label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring cursor-pointer"
                >
                  {availableCountries.length > 0
                    ? availableCountries.map((c) => (
                        <option key={c.iso_2} value={c.iso_2}>{c.display_name}</option>
                      ))
                    : <option value={countryCode}>{countryCode.toUpperCase()}</option>
                  }
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Phone (optional)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring"
              />
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button type="submit" className="w-full gap-2" size="lg" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue to shipping
            </Button>
          </form>
        )}

        {step === "shipping" && (
          <form onSubmit={handleShippingSubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => setStep("details")}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to details
            </button>

            <h2 className="text-sm font-semibold">Choose shipping method</h2>

            {shippingLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-lg border p-4 animate-pulse">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-1/2 mt-2" />
                  </div>
                ))}
              </div>
            ) : shippingOptions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">No shipping options available for your address.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {shippingOptions.map((option) => {
                  const price = option.calculated_price?.calculated_amount ?? option.amount;
                  const currency = option.calculated_price?.currency_code ?? cart?.currency_code ?? "eur";
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        "flex items-center gap-4 rounded-lg border p-4 cursor-pointer transition-all",
                        selectedShipping === option.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "hover:border-foreground/25"
                      )}
                    >
                      <input
                        type="radio"
                        name="shipping"
                        value={option.id}
                        checked={selectedShipping === option.id}
                        onChange={() => setSelectedShipping(option.id)}
                        className="accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{option.name}</p>
                        {option.type?.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{option.type.description}</p>
                        )}
                      </div>
                      <p className="text-sm font-semibold shrink-0">
                        {price === 0 ? "Free" : formatPrice(price, currency)}
                      </p>
                    </label>
                  );
                })}
              </div>
            )}

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button
              type="submit"
              className="w-full gap-2"
              size="lg"
              disabled={submitting || !selectedShipping}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue to payment
            </Button>
          </form>
        )}

        {step === "payment" && clientSecret && stripePromise && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: "night",
                variables: {
                  colorPrimary: "#6366f1",
                  borderRadius: "8px",
                  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                },
              },
            }}
          >
            <PaymentForm onSuccess={handlePaymentSuccess} />
          </Elements>
        )}

        {step === "payment" && !stripePromise && (
          <div className="text-center py-8">
            <p className="text-destructive text-sm">Payment is not configured. Please contact support.</p>
          </div>
        )}
      </div>

      {/* Right: Order summary */}
      <div className="lg:w-80 shrink-0">
        <div className="rounded-xl border bg-card p-5 sticky top-20">
          <h3 className="text-sm font-semibold mb-4">Order summary</h3>
          <div className="space-y-3 mb-4">
            {cart.items.map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="w-12 h-12 bg-muted rounded-lg overflow-hidden shrink-0 border">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="h-4 w-4 text-muted-foreground/15" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.product_title ?? item.title}</p>
                  <p className="text-[11px] text-muted-foreground">Qty: {item.quantity}</p>
                </div>
                <p className="text-xs font-medium shrink-0">{formatPrice(item.unit_price * item.quantity, cart.currency_code)}</p>
              </div>
            ))}
          </div>

          {/* Promo code */}
          <div className="mb-3">
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => { setPromoCode(e.target.value); setPromoError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void applyPromoCode(); } }}
                  placeholder="Discount code"
                  className="w-full h-8 pl-8 pr-3 rounded-md border bg-background text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs px-3 shrink-0"
                disabled={!promoCode.trim() || promoApplying}
                onClick={() => void applyPromoCode()}
              >
                {promoApplying ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply"}
              </Button>
            </div>
            {promoError && (
              <p className="text-[11px] text-destructive mt-1">{promoError}</p>
            )}
            {cart.promotions && cart.promotions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {cart.promotions.map((promo) => (
                  <span
                    key={promo.id}
                    className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400"
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {promo.code}
                    <button
                      onClick={() => void removePromoCode(promo.code!)}
                      className="ml-0.5 hover:text-green-800 dark:hover:text-green-200 transition-colors"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="h-px bg-border mb-3" />

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(cart.subtotal, cart.currency_code)}</span>
            </div>
            {cart.discount_total > 0 && (
              <div className="flex justify-between text-green-600 dark:text-green-400">
                <span>Discount</span>
                <span>-{formatPrice(cart.discount_total, cart.currency_code)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>{cart.shipping_total ? formatPrice(cart.shipping_total, cart.currency_code) : "Free"}</span>
            </div>
            {cart.tax_total > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatPrice(cart.tax_total, cart.currency_code)}</span>
              </div>
            )}
          </div>

          <div className="h-px bg-border my-3" />

          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span className="text-primary">{formatPrice(cart.total, cart.currency_code)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
