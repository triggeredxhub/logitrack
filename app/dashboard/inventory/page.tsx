'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardHeader } from '@/components/dashboard-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  AlertTriangle,
  PackagePlus,
  Loader2,
} from 'lucide-react';
import { PRODUCT_CATEGORIES, ProductWithStock } from '@/lib/types';
import { toast } from 'sonner';

type ViewMode = 'products' | 'batches';

interface InventoryBatchWithProduct {
  id: string;
  productId: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string | null;
  isExpired: boolean;
  location: string | null;
  costPrice: number | null;
  notes: string | null;
  createdAt: string;
  product: ProductWithStock;
  daysUntilExpiry: number | null;
  isExpiringSoon: boolean;
}

export default function InventoryPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('products');
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [batches, setBatches] = useState<InventoryBatchWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Product modal state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithStock | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    description: '',
    category: '',
    reorderLevel: '10',
    sellingPrice: '',
  });

  // Batch modal state
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<InventoryBatchWithProduct | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [batchForm, setBatchForm] = useState({
    batchNumber: '',
    quantity: '',
    expiryDate: '',
    location: '',
    costPrice: '',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to fetch products');
    }
  }, [search]);

  const fetchBatches = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/inventory?${params}`);
      const data = await res.json();
      if (data.success) {
        setBatches(data.data);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
      toast.error('Failed to fetch batches');
    }
  }, [search]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      if (viewMode === 'products') {
        await fetchProducts();
      } else {
        await fetchBatches();
      }
      setLoading(false);
    };
    fetchData();
  }, [viewMode, fetchProducts, fetchBatches]);

  // Product handlers
  const openProductModal = (product?: ProductWithStock) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        sku: product.sku,
        description: product.description || '',
        category: product.category || '',
        reorderLevel: String(product.reorderLevel),
        sellingPrice: product.sellingPrice ? String(product.sellingPrice) : '',
      });
    } else {
      setEditingProduct(null);
      setProductForm({
        name: '',
        sku: '',
        description: '',
        category: '',
        reorderLevel: '10',
        sellingPrice: '',
      });
    }
    setProductModalOpen(true);
  };

  const handleProductSubmit = async () => {
    if (!productForm.name || !productForm.sku) {
      toast.error('Name and SKU are required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: productForm.name,
        sku: productForm.sku,
        description: productForm.description || undefined,
        category: productForm.category || undefined,
        reorderLevel: parseInt(productForm.reorderLevel) || 10,
        sellingPrice: productForm.sellingPrice ? parseFloat(productForm.sellingPrice) : undefined,
      };

      const res = await fetch(
        editingProduct ? `/api/products/${editingProduct.id}` : '/api/products',
        {
          method: editingProduct ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (data.success) {
        toast.success(editingProduct ? 'Product updated' : 'Product created');
        setProductModalOpen(false);
        fetchProducts();
      } else {
        toast.error(data.error || 'Failed to save product');
      }
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product? This will also delete all associated batches.')) {
      return;
    }

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Product deleted');
        fetchProducts();
      } else {
        toast.error(data.error || 'Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  // Batch handlers
  const openBatchModal = (batch?: InventoryBatchWithProduct, productId?: string) => {
    if (batch) {
      setEditingBatch(batch);
      setSelectedProductId(batch.productId);
      setBatchForm({
        batchNumber: batch.batchNumber,
        quantity: String(batch.quantity),
        expiryDate: batch.expiryDate ? batch.expiryDate.split('T')[0] : '',
        location: batch.location || '',
        costPrice: batch.costPrice ? String(batch.costPrice) : '',
        notes: batch.notes || '',
      });
    } else {
      setEditingBatch(null);
      setSelectedProductId(productId || '');
      setBatchForm({
        batchNumber: '',
        quantity: '',
        expiryDate: '',
        location: '',
        costPrice: '',
        notes: '',
      });
    }
    setBatchModalOpen(true);
  };

  const handleBatchSubmit = async () => {
    if (!selectedProductId || !batchForm.batchNumber || !batchForm.quantity) {
      toast.error('Product, batch number, and quantity are required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        productId: selectedProductId,
        batchNumber: batchForm.batchNumber,
        quantity: parseInt(batchForm.quantity),
        expiryDate: batchForm.expiryDate || undefined,
        location: batchForm.location || undefined,
        costPrice: batchForm.costPrice ? parseFloat(batchForm.costPrice) : undefined,
        notes: batchForm.notes || undefined,
      };

      const res = await fetch(
        editingBatch ? `/api/inventory/${editingBatch.id}` : '/api/inventory',
        {
          method: editingBatch ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (data.success) {
        toast.success(editingBatch ? 'Batch updated' : 'Batch created');
        setBatchModalOpen(false);
        if (viewMode === 'batches') {
          fetchBatches();
        } else {
          fetchProducts();
        }
      } else {
        toast.error(data.error || 'Failed to save batch');
      }
    } catch (error) {
      console.error('Error saving batch:', error);
      toast.error('Failed to save batch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBatch = async (id: string) => {
    if (!confirm('Are you sure you want to delete this batch?')) {
      return;
    }

    try {
      const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Batch deleted');
        fetchBatches();
      } else {
        toast.error(data.error || 'Failed to delete batch');
      }
    } catch (error) {
      console.error('Error deleting batch:', error);
      toast.error('Failed to delete batch');
    }
  };

  return (
    <>
      <DashboardHeader title="Inventory" subtitle="Manage your products and inventory batches" />
      <div className="p-6">
        {/* Toolbar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'products' ? 'default' : 'outline'}
              onClick={() => setViewMode('products')}
            >
              <Package className="mr-2 h-4 w-4" />
              Products
            </Button>
            <Button
              variant={viewMode === 'batches' ? 'default' : 'outline'}
              onClick={() => setViewMode('batches')}
            >
              <PackagePlus className="mr-2 h-4 w-4" />
              Batches
            </Button>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            {viewMode === 'products' ? (
              <Button onClick={() => openProductModal()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            ) : (
              <Button onClick={() => openBatchModal()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Batch
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="rounded-lg border bg-white shadow-sm">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : viewMode === 'products' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Reorder Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-gray-500">
                      No products found. Add your first product to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                      <TableCell>{product.category || '-'}</TableCell>
                      <TableCell className="text-right">{product.totalStock}</TableCell>
                      <TableCell className="text-right">{product.reorderLevel}</TableCell>
                      <TableCell>
                        {product.isLowStock ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Low Stock
                          </Badge>
                        ) : (
                          <Badge variant="secondary">In Stock</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openBatchModal(undefined, product.id)}
                            title="Add Batch"
                          >
                            <PackagePlus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openProductModal(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProduct(product.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Batch #</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-gray-500">
                      No inventory batches found. Add a batch to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">{batch.product.name}</TableCell>
                      <TableCell className="font-mono text-sm">{batch.batchNumber}</TableCell>
                      <TableCell className="text-right">{batch.quantity}</TableCell>
                      <TableCell>
                        {batch.expiryDate
                          ? new Date(batch.expiryDate).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell>{batch.location || '-'}</TableCell>
                      <TableCell>
                        {batch.isExpired ? (
                          <Badge variant="destructive">Expired</Badge>
                        ) : batch.isExpiringSoon ? (
                          <Badge variant="outline" className="border-orange-500 text-orange-500">
                            Expiring Soon
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openBatchModal(batch)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteBatch(batch.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Product Modal */}
      <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                placeholder="Product name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                value={productForm.sku}
                onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                placeholder="SKU-001"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={productForm.category}
                onValueChange={(value) => setProductForm({ ...productForm, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="reorderLevel">Reorder Level</Label>
                <Input
                  id="reorderLevel"
                  type="number"
                  value={productForm.reorderLevel}
                  onChange={(e) => setProductForm({ ...productForm, reorderLevel: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sellingPrice">Selling Price</Label>
                <Input
                  id="sellingPrice"
                  type="number"
                  step="0.01"
                  value={productForm.sellingPrice}
                  onChange={(e) => setProductForm({ ...productForm, sellingPrice: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleProductSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingProduct ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Modal */}
      <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBatch ? 'Edit Batch' : 'Add Batch'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="productId">Product *</Label>
              <Select
                value={selectedProductId}
                onValueChange={setSelectedProductId}
                disabled={!!editingBatch}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="batchNumber">Batch Number *</Label>
                <Input
                  id="batchNumber"
                  value={batchForm.batchNumber}
                  onChange={(e) => setBatchForm({ ...batchForm, batchNumber: e.target.value })}
                  placeholder="BATCH-001"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={batchForm.quantity}
                  onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={batchForm.expiryDate}
                  onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="costPrice">Cost Price</Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  value={batchForm.costPrice}
                  onChange={(e) => setBatchForm({ ...batchForm, costPrice: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={batchForm.location}
                onChange={(e) => setBatchForm({ ...batchForm, location: e.target.value })}
                placeholder="Warehouse A, Shelf 1"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={batchForm.notes}
                onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBatchSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingBatch ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
