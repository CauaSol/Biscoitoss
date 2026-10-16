'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Product = { id: string; name: string; price: number; stock: number };
type PaymentMethod = 'Pix' | 'Dinheiro' | 'Débito' | 'Crédito';
type Sale = { id: string; product_id: string | null; product_name: string; quantity: number; unit_price: number; total: number; created_at: string; status: 'completed' | 'cancelled'; cancelled_at?: string | null; payment_method?: PaymentMethod | null };
type Tab = 'inicio' | 'venda' | 'produtos' | 'historico';

const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const paymentRate: Record<PaymentMethod, number> = { Pix: 0, Dinheiro: 0, Débito: 1.99, Crédito: 4.98 };
const feeFor = (total: number, method?: PaymentMethod | null) => total * (paymentRate[method || 'Pix'] || 0) / 100;
const netFor = (total: number, method?: PaymentMethod | null) => total - feeFor(total, method);
const demoProducts: Product[] = [
  { id: 'demo-goiaba', name: 'Biscoito de goiaba', price: 12.9, stock: 20 },
  { id: 'demo-leite', name: 'Biscoito amanteigado tradicional', price: 10, stock: 15 },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>('inicio');
  const [products, setProducts] = useState<Product[]>(demoProducts);
  const [sales, setSales] = useState<Sale[]>([]);
  const [productId, setProductId] = useState('demo-goiaba');
  const [quantity, setQuantity] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Pix');
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('12,90');
  const [productStock, setProductStock] = useState('0');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    (async () => {
      const [{ data: p, error: pe }, { data: s, error: se }] = await Promise.all([
      supabase.from('products').select('*').order('name'),
supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(200)


3.
      ]);
      if (!alive) return;
      if (pe || se) { setNotice('Banco conectado, mas não foi possível carregar os dados. Confira a configuração do Supabase.'); return; }
      setProducts((p || []).map((x: any) => ({ id: x.id, name: x.name, price: Number(x.price), stock: Number(x.stock) })));
      setSales((s || []).map((x: any) => ({ id: x.id, product_id: x.product_id, product_name: x.product_name, quantity: Number(x.quantity), unit_price: Number(x.unit_price), total: Number(x.total), created_at: x.created_at, status: x.status || 'completed', cancelled_at: x.cancelled_at || null, payment_method: x.payment_method || null }))); 
      setConnected(true);
    })();
    return () => { alive = false; };
  }, []);

  const currentMonthSales = useMemo(() => sales.filter(s => {
    const d = new Date(s.created_at); const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }), [sales]);
  const revenue = currentMonthSales
  .filter(s => s.status !== 'cancelled')
  .reduce((sum, s) => sum + netFor(s.total, s.payment_method), 0);
  const unitsSold = currentMonthSales.filter(s => s.status !== 'cancelled').reduce((sum, s) => sum + s.quantity, 0);
  const selectedProduct = products.find(p => p.id === productId);
  const saleGross = (selectedProduct?.price || 0) * Math.max(0, Number(quantity) || 0);
  const saleFee = feeFor(saleGross, paymentMethod);
  const saleNet = saleGross - saleFee;
  const paymentTotals = useMemo(() => {
    const methods: PaymentMethod[] = ['Pix', 'Dinheiro', 'Débito', 'Crédito'];
    return methods.map(method => ({ method, total: currentMonthSales.filter(s => s.status !== 'cancelled' && s.payment_method === method).reduce((sum, s) => sum + s.total, 0) }));
  }, [currentMonthSales]);
  const paymentGrandTotal = paymentTotals.reduce((sum, item) => sum + item.total, 0);

  async function registerSale(e: FormEvent) {
    e.preventDefault(); setNotice('');
    const qty = Number(quantity);
    if (!selectedProduct || !Number.isInteger(qty) || qty < 1) { setNotice('Escolha um produto e informe uma quantidade válida.'); return; }
    if (qty > selectedProduct.stock) { setNotice('Não há estoque suficiente para essa venda.'); return; }
    if (!supabase) { setNotice('Banco não conectado. A venda não foi salva.'); return; }
    setLoading(true);
    const { error } = await supabase.rpc('register_sale', { p_product_id: selectedProduct.id, p_quantity: qty, p_payment_method: paymentMethod });
    if (error) { setNotice('Não foi possível registrar a venda. Confira o SQL do Supabase e tente novamente.'); setLoading(false); return; }
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(200)
    ]);
    if (p) setProducts(p.map((x: any) => ({ id: x.id, name: x.name, price: Number(x.price), stock: Number(x.stock) })));
    if (s) setSales(s.map((x: any) => ({ id: x.id, product_id: x.product_id, product_name: x.product_name, quantity: Number(x.quantity), unit_price: Number(x.unit_price), total: Number(x.total), created_at: x.created_at, status: x.status || 'completed', cancelled_at: x.cancelled_at || null, payment_method: x.payment_method || null })));
    setConnected(true); setQuantity('1'); setPaymentMethod('Pix'); setLoading(false); setNotice('Venda registrada com sucesso!'); setTab('inicio');
  }

  async function cancelSale(sale: Sale) {
    if (!supabase || sale.status === 'cancelled') return;
    if (!window.confirm(`Cancelar a venda de ${sale.quantity} unidade(s) de ${sale.product_name}? O estoque será devolvido.`)) return;
    setLoading(true); setNotice('');
    const { error } = await supabase.rpc('cancel_sale', { p_sale_id: sale.id });
    if (error) { setNotice('Não foi possível cancelar. Confira a configuração do Supabase e tente novamente.'); setLoading(false); return; }
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(200)
