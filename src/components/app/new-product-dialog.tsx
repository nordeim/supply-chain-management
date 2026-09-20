'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createProductAction } from '@/server/actions';

interface SupplierOption {
  id: string;
  name: string;
}

/**
 * New Product dialog — mirrors the reference app's creation form. Numeric
 * money fields are strings until validated server-side (integer minor units
 * are the only money representation that reaches the database).
 */
export function NewProductDialog({
  open,
  onOpenChange,
  suppliers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers?: SupplierOption[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [supplierList, setSupplierList] = useState<SupplierOption[]>(suppliers ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: '',
    status: 'Active' as 'Active' | 'Discontinued',
    description: '',
    imageUrl: '',
    cost: '',
    price: '',
    stock: '0',
    reorderPoint: '10',
    reorderQty: '25',
    supplierId: '',
    leadTimeDays: '7',
    location: '',
  });

  useEffect(() => {
    if (open && supplierList.length === 0) {
      // Lazy-load supplier options the first time the dialog opens.
      fetch('/api/suppliers')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
        .then((data: { suppliers: SupplierOption[] }) => setSupplierList(data.suppliers))
        .catch(() => toast({ title: 'Could not load suppliers', variant: 'destructive' }));
    }
  }, [open, supplierList.length, toast]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const result = await createProductAction({
      name: form.name,
      sku: form.sku,
      category: form.category,
      status: form.status,
      description: form.description,
      imageUrl: form.imageUrl,
      cost: form.cost,
      price: form.price,
      stock: Number(form.stock || '0'),
      reorderPoint: Number(form.reorderPoint || '10'),
      reorderQty: Number(form.reorderQty || '25'),
      supplierId: form.supplierId,
      leadTimeDays: Number(form.leadTimeDays || '7'),
      location: form.location,
    });
    setSubmitting(false);

    if (result.ok) {
      toast({ title: 'Product created', description: `${form.name} (${form.sku}) is now in the catalog.` });
      onOpenChange(false);
      setForm((f) => ({ ...f, name: '', sku: '', description: '', cost: '', price: '', location: '', imageUrl: '' }));
      router.push(`/products/${result.data.id}`);
      router.refresh();
    } else {
      toast({ title: 'Could not create product', description: result.message, variant: 'destructive' });
    }
  }

  function handleImageSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 300_000) {
      toast({ title: 'Image too large', description: 'Please choose an image under 300 KB.', variant: 'destructive' });
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set('imageUrl', String(reader.result ?? ''));
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  const numberField = (key: 'stock' | 'reorderPoint' | 'reorderQty' | 'leadTimeDays', label: string, step = '1') => (
    <div className="grid gap-1.5">
      <Label htmlFor={`np-${key}`}>{label}</Label>
      <Input
        id={`np-${key}`}
        type="number"
        min="0"
        step={step}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Add a New Product</DialogTitle>
          <DialogDescription>
            Create a catalog item with stock policy and supplier linkage. Fields marked * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="np-name">Product Name *</Label>
              <Input id="np-name" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. 24-70mm f2.8 Zoom Lens" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="np-sku">SKU *</Label>
              <Input id="np-sku" required value={form.sku} onChange={(e) => set('sku', e.target.value.toUpperCase())} placeholder="e.g. ELEC-001" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="np-category">Category *</Label>
              <Input id="np-category" required value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="e.g. Electronics" />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v as 'Active' | 'Discontinued')}>
                <SelectTrigger aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Discontinued">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="np-description">Description</Label>
            <Textarea id="np-description" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Short product description" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="np-image">Image</Label>
            <label
              htmlFor="np-image"
              className="flex h-24 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#dfdfdf] bg-[#efefef] text-sm text-muted-foreground transition-colors hover:bg-secondary"
            >
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="Selected product" className="h-full w-full rounded-xl object-cover" />
              ) : (
                <>
                  <ImagePlus className="h-5 w-5" aria-hidden />
                  Click to upload
                </>
              )}
            </label>
            <input
              id="np-image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              className="sr-only"
              onChange={handleImageSelected}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="np-cost">Units Cost *</Label>
              <Input id="np-cost" required inputMode="decimal" value={form.cost} onChange={(e) => set('cost', e.target.value)} placeholder="0.00" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="np-price">Units Price *</Label>
              <Input id="np-price" required inputMode="decimal" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            {numberField('stock', 'Current Stock')}
            {numberField('reorderPoint', 'Reorder Pt.')}
            {numberField('reorderQty', 'Reorder Qty.')}
            {numberField('leadTimeDays', 'Lead Time (Days)')}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Supplier *</Label>
              <Select value={form.supplierId} onValueChange={(v) => set('supplierId', v)}>
                <SelectTrigger aria-label="Supplier">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {supplierList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="np-location">Location</Label>
              <Input id="np-location" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Warehouse A" />
            </div>
          </div>

          <DialogFooter className="mt-2 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting} className="rounded-full">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90">
              {submitting ? 'Creating…' : 'Create Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
