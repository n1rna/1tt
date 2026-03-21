"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { medusa, getLowestPrice, formatPrice, type Product, type ProductVariant } from "@/lib/shop/client";
import { getCartId, setCartId } from "@/lib/shop/cart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Minus, Plus, ArrowLeft, Loader2, ShoppingBag, Check, ZoomIn, ZoomOut, X, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ── Image Viewer with Zoom + Lightbox ─────────────────────────────────────

function ProductImageViewer({
  images,
  selectedIndex,
  onSelect,
  productTitle,
}: {
  images: { id: string; url: string; rank: number }[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  productTitle: string;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imgContainerRef = useRef<HTMLDivElement>(null);

  const currentImage = images[selectedIndex];

  // Reset zoom when image changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [selectedIndex]);

  // Inline zoom on main image (hover to zoom)
  const [hoverZoom, setHoverZoom] = useState(false);
  const [hoverPos, setHoverPos] = useState({ x: 50, y: 50 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgContainerRef.current) return;
    const rect = imgContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setHoverPos({ x, y });
  }, []);

  // Lightbox keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") onSelect(Math.max(0, selectedIndex - 1));
      if (e.key === "ArrowRight") onSelect(Math.min(images.length - 1, selectedIndex + 1));
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.5, 4));
      if (e.key === "-") setZoom((z) => Math.max(z - 0.5, 1));
      if (e.key === "0") { setZoom(1); setPan({ x: 0, y: 0 }); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [lightboxOpen, selectedIndex, images.length, onSelect]);

  // Lightbox drag to pan
  const handleLightboxMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleLightboxMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleLightboxMouseUp = () => setDragging(false);

  // Lightbox scroll to zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => {
      const next = z + (e.deltaY > 0 ? -0.25 : 0.25);
      const clamped = Math.max(1, Math.min(4, next));
      if (clamped === 1) setPan({ x: 0, y: 0 });
      return clamped;
    });
  }, []);

  return (
    <>
      {/* Main image with hover zoom */}
      <div
        ref={imgContainerRef}
        className="aspect-square bg-muted rounded-xl overflow-hidden border relative group cursor-zoom-in"
        onMouseEnter={() => setHoverZoom(true)}
        onMouseLeave={() => setHoverZoom(false)}
        onMouseMove={handleMouseMove}
        onClick={() => setLightboxOpen(true)}
      >
        {currentImage ? (
          <img
            src={currentImage.url}
            alt={productTitle}
            className="w-full h-full object-contain transition-transform duration-200"
            style={hoverZoom ? {
              transformOrigin: `${hoverPos.x}% ${hoverPos.y}%`,
              transform: "scale(2)",
            } : undefined}
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="h-16 w-16 text-muted-foreground/15" />
          </div>
        )}
        {/* Fullscreen hint */}
        {currentImage && (
          <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-md">
              <Maximize2 className="h-3 w-3" />
              Click to expand
            </div>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => onSelect(i)}
              className={cn(
                "w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-colors",
                i === selectedIndex ? "border-primary" : "border-transparent hover:border-border"
              )}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && currentImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setLightboxOpen(false); }}
        >
          {/* Controls */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <button
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors text-xs font-mono"
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.5, 4))}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => { const z = Math.max(zoom - 0.5, 1); setZoom(z); if (z === 1) setPan({ x: 0, y: 0 }); }}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={() => setLightboxOpen(false)}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Image counter */}
          {images.length > 1 && (
            <div className="absolute top-4 left-4 text-white/60 text-xs font-mono z-10">
              {selectedIndex + 1} / {images.length}
            </div>
          )}

          {/* Prev/Next arrows */}
          {images.length > 1 && selectedIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(selectedIndex - 1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {images.length > 1 && selectedIndex < images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(selectedIndex + 1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

          {/* Zoomable image */}
          <div
            className={cn(
              "max-w-[90vw] max-h-[85vh] overflow-hidden",
              zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
            )}
            onMouseDown={handleLightboxMouseDown}
            onMouseMove={handleLightboxMouseMove}
            onMouseUp={handleLightboxMouseUp}
            onMouseLeave={handleLightboxMouseUp}
            onWheel={handleWheel}
            onClick={(e) => {
              if (zoom <= 1) { setZoom(2); } else { e.stopPropagation(); }
            }}
          >
            <img
              src={currentImage.url}
              alt={productTitle}
              className="max-w-[90vw] max-h-[85vh] object-contain select-none"
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transition: dragging ? "none" : "transform 0.2s ease",
              }}
              draggable={false}
            />
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={(e) => { e.stopPropagation(); onSelect(i); }}
                  className={cn(
                    "w-12 h-12 rounded-md overflow-hidden border-2 shrink-0 transition-all",
                    i === selectedIndex
                      ? "border-white opacity-100"
                      : "border-transparent opacity-50 hover:opacity-80"
                  )}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function ProductDetail({ handle }: { handle: string }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedImage, setSelectedImage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await medusa.store.product.list({
          handle,
          fields: "+variants.prices.*,+variants.options.*,+options.values.*,+images",
        });
        const p = ((res as unknown as { products: Product[] }).products)?.[0];
        if (!cancelled && p) {
          setProduct(p);
          const defaults: Record<string, string> = {};
          for (const opt of p.options ?? []) {
            if (opt.values?.[0]) defaults[opt.title] = opt.values[0].value;
          }
          setSelectedOptions(defaults);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load product");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [handle]);

  // Match variant to selected options
  const selectedVariant: ProductVariant | undefined = product?.variants?.find((v) => {
    if (!v.options || v.options.length === 0) return true;
    return v.options.every((opt) => {
      const parentOption = product?.options?.find((o) => o.id === opt.option_id);
      if (!parentOption) return true;
      return selectedOptions[parentOption.title] === opt.value;
    });
  }) ?? product?.variants?.[0];

  const price = selectedVariant ? getLowestPrice(selectedVariant) : null;

  const handleAddToCart = useCallback(async () => {
    if (!selectedVariant) return;
    setAdding(true);
    setError(null);
    try {
      let cartId = getCartId();
      if (!cartId) {
        const cart = await medusa.store.cart.create({});
        cartId = (cart as unknown as { cart: { id: string } }).cart.id;
        setCartId(cartId);
      }
      await medusa.store.cart.createLineItem(cartId, {
        variant_id: selectedVariant.id,
        quantity,
      });
      setAdded(true);
      window.dispatchEvent(new Event("cart-updated"));
      setTimeout(() => setAdded(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add to cart");
    } finally {
      setAdding(false);
    }
  }, [selectedVariant, quantity]);

  const images = product?.images?.length ? product.images : product?.thumbnail ? [{ id: "thumb", url: product.thumbnail, rank: 0 }] : [];

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="h-4 w-24 bg-muted rounded mb-6 animate-pulse" />
        <div className="animate-pulse flex flex-col md:flex-row gap-8 lg:gap-12">
          <div className="aspect-square w-full md:w-1/2 bg-muted rounded-xl" />
          <div className="flex-1 space-y-4">
            <div className="h-7 bg-muted rounded w-3/4" />
            <div className="h-5 bg-muted rounded w-1/4" />
            <div className="h-px bg-border my-4" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-5/6" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
        <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground">Product not found.</p>
        <Link href="/shop" className="text-primary text-sm hover:underline mt-3 inline-block">
          Back to shop
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Back link */}
      <Link
        href="/shop"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to shop
      </Link>

      <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
        {/* Images */}
        <div className="w-full md:w-1/2">
          <ProductImageViewer
            images={images}
            selectedIndex={selectedImage}
            onSelect={setSelectedImage}
            productTitle={product.title}
          />
        </div>

        {/* Details */}
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{product.title}</h1>

          {product.collection && (
            <Badge variant="outline" className="text-xs font-medium mt-2">
              {product.collection.title}
            </Badge>
          )}

          {price && (
            <p className="text-2xl font-bold mt-3 text-primary">
              {formatPrice(price.amount, price.currency_code)}
            </p>
          )}

          <div className="h-px bg-border my-5" />

          {product.description && (
            <p className="text-muted-foreground leading-relaxed text-sm">
              {product.description}
            </p>
          )}

          {/* Options (size, color, etc.) */}
          {product.options?.map((option) => (
            <div key={option.id} className="mt-5">
              <label className="text-sm font-medium mb-2 block">
                {option.title}
                {selectedOptions[option.title] && (
                  <span className="text-muted-foreground font-normal ml-2">
                    {selectedOptions[option.title]}
                  </span>
                )}
              </label>
              <div className="flex flex-wrap gap-2">
                {option.values.map((val) => (
                  <button
                    key={val.id}
                    onClick={() => setSelectedOptions((prev) => ({ ...prev, [option.title]: val.value }))}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg border text-sm transition-all duration-150",
                      selectedOptions[option.title] === val.value
                        ? "border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary/20"
                        : "border-border hover:border-foreground/25 hover:bg-muted/50"
                    )}
                  >
                    {val.value}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Quantity */}
          <div className="mt-5">
            <label className="text-sm font-medium mb-2 block">Quantity</label>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-10 text-center text-sm font-medium tabular-nums">{quantity}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Add to cart */}
          <div className="flex items-center gap-3 mt-6">
            <Button
              className="gap-2 px-6"
              size="lg"
              onClick={handleAddToCart}
              disabled={adding || !selectedVariant}
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : added ? (
                <Check className="h-4 w-4" />
              ) : (
                <ShoppingCart className="h-4 w-4" />
              )}
              {added ? "Added!" : "Add to cart"}
            </Button>
            <Link href="/shop/cart">
              <Button variant="outline" size="lg">View cart</Button>
            </Link>
          </div>

          {error && (
            <p className="text-destructive text-sm mt-3">{error}</p>
          )}

          {/* Meta */}
          <div className="mt-6 pt-5 border-t space-y-1">
            {selectedVariant?.sku && (
              <p className="text-xs text-muted-foreground/50">SKU: {selectedVariant.sku}</p>
            )}
            {product.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary" className="text-[10px]">
                    {tag.value}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
