'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Product = { id: string; name: string; price: number; stock: number };
type PaymentMethod = 'Pix' | 'Dinheiro' | 'Débito' | 'Crédito';
type Sale = { id: string; product_id: string | null; product_name: string; quantity: number; unit_price: number; total: number; created_at: string; status: 'completed' | 'cancelled'; cancelled_at?: string | null; payment_method?: PaymentMethod | null };
type Tab = 'inicio' | 'venda' | 'produtos' | 'historico';

const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
        supabase!.from('products').select('*').order('name'),
        supabase!.from('sales').select('*').order('created_at', { ascending: false }).limit(200)
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
  const revenue = currentMonthSales.filter(s => s.status !== 'cancelled').reduce((sum, s) => sum + s.total, 0);
  const unitsSold = currentMonthSales.filter(s => s.status !== 'cancelled').reduce((sum, s) => sum + s.quantity, 0);
  const selectedProduct = products.find(p => p.id === productId);
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
    ]);
    if (p) setProducts(p.map((x: any) => ({ id: x.id, name: x.name, price: Number(x.price), stock: Number(x.stock) })));
    if (s) setSales(s.map((x: any) => ({ id: x.id, product_id: x.product_id, product_name: x.product_name, quantity: Number(x.quantity), unit_price: Number(x.unit_price), total: Number(x.total), created_at: x.created_at, status: x.status || 'completed', cancelled_at: x.cancelled_at || null, payment_method: x.payment_method || null })));
    setLoading(false); setNotice('Venda cancelada e estoque devolvido.');
  }

  async function addProduct(e: FormEvent) {
    e.preventDefault(); setNotice('');
    const price = Number(productPrice.replace(',', '.')); const stock = Number(productStock);
    if (!productName.trim() || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) { setNotice('Confira nome, preço e estoque.'); return; }
    if (!supabase) { setNotice('Para cadastrar produtos de verdade e sincronizar entre aparelhos, configure o Supabase primeiro.'); return; }
    setLoading(true);
    const { data, error } = await supabase.from('products').insert({ name: productName.trim(), price, stock }).select().single();
    setLoading(false);
    if (error) { setNotice('Não foi possível cadastrar. Confira a configuração do banco.'); return; }
    setProducts(prev => [...prev, { id: data.id, name: data.name, price: Number(data.price), stock: Number(data.stock) }].sort((a,b) => a.name.localeCompare(b.name)));
    setProductName(''); setProductPrice('12,90'); setProductStock('0'); setNotice('Produto cadastrado!');
  }

  const nav: { id: Tab; label: string; icon: string }[] = [
    { id: 'inicio', label: 'Início', icon: '⌂' }, { id: 'venda', label: 'Vender', icon: '＋' }, { id: 'produtos', label: 'Produtos', icon: '▦' }, { id: 'historico', label: 'Histórico', icon: '◷' }
  ];

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><Image src="/logo.jpg" alt="Logo Chelle’s Biscoitos Amanteigados" width={58} height={58} priority /><div><p className="eyebrow">PAINEL DE CONTROLE</p><h1>Chelle’s <span>Biscoitos Amanteigados</span></h1><p className="subbrand"></p></div></div>
      <span className={`status ${connected ? 'online' : 'demo'}`}><i />{connected ? 'Online' : 'Prévia'}</span>
    </header>

    {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Fechar aviso">×</button></div>}

    {tab === 'inicio' && <section className="content">
      <div className="welcome"><div><p className="eyebrow">SEU NEGÓCIO, ORGANIZADO</p><h2>Olá, Chelle! <span>♡</span></h2><p>Acompanhe suas vendas de um jeito simples.</p></div><div className="welcome-flower">✿</div></div>
      <div className="stats"><article className="stat-card featured"><div className="stat-icon">R$</div><p>Faturamento do mês</p><strong>{money(revenue)}</strong><small>Vendas registradas neste mês</small></article><article className="stat-card"><div className="stat-icon">♡</div><p>Unidades vendidas</p><strong>{unitsSold}</strong><small>Neste mês</small></article><article className="stat-card"><div className="stat-icon">▦</div><p>Produtos cadastrados</p><strong>{products.length}</strong><small>Tipos de biscoito</small></article></div>
      <section className="panel payment-chart"><div className="section-heading"><div><h3>Vendas por forma de pagamento</h3><p>Faturamento deste mês, sem vendas canceladas.</p></div></div>{paymentGrandTotal === 0 ? <p className="chart-empty">Os valores aparecerão aqui conforme as novas vendas forem registradas.</p> : paymentTotals.map(item => <div className="payment-bar-row" key={item.method}><div className="payment-bar-label"><span>{item.method}</span><b>{money(item.total)}</b></div><div className="payment-bar-track"><div className="payment-bar-fill" style={{ width: `${Math.min(100, item.total / paymentGrandTotal * 100)}%` }} /></div></div>)}</section>
      <button className="primary big-action" onClick={() => setTab('venda')}><span className="plus">＋</span><span><b>Registrar uma venda</b><small>Escolha o biscoito e a quantidade</small></span><span className="arrow">→</span></button>
      <section className="panel"><div className="section-heading"><div><h3>Estoque de biscoitos</h3><p>Veja o que ainda tem disponível.</p></div><button className="text-button" onClick={() => setTab('produtos')}>Ver produtos →</button></div>
        {products.length ? <div className="product-list">{products.map(p => <div className="product-row" key={p.id}><div className="cookie-icon">♡</div><div className="product-info"><b>{p.name}</b><small>{money(p.price)} por unidade</small></div><span className={`stock-pill ${p.stock < 5 ? 'low' : ''}`}>{p.stock} un.</span></div>)}</div> : <div className="empty">Nenhum produto cadastrado ainda.</div>}
      </section>
      {!supabase && <p className="demo-note">Esta é uma prévia funcional. Para salvar vendas de verdade e acessar os mesmos dados de qualquer aparelho, conecte o banco de dados seguindo o arquivo LEIA-ME.</p>}
    </section>}

    {tab === 'venda' && <section className="content narrow"><button className="back-button" onClick={() => setTab('inicio')}>← Voltar ao início</button><div className="page-title"><p className="eyebrow">NOVA VENDA</p><h2>Registrar venda <span>♡</span></h2><p>É rapidinho: selecione o produto e a quantidade.</p></div><form className="panel form-panel" onSubmit={registerSale}><label htmlFor="product">Qual biscoito foi vendido?</label><select id="product" value={productId} onChange={e => setProductId(e.target.value)} required><option value="">Selecione um produto</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} — {money(p.price)}</option>)}</select>{selectedProduct && <div className="sale-price"><span>Preço por unidade</span><b>{money(selectedProduct.price)}</b><small>Disponível: {selectedProduct.stock} unidade(s)</small></div>}<label htmlFor="quantity">Quantidade vendida</label><div className="quantity-control"><button type="button" onClick={() => setQuantity(String(Math.max(1, Number(quantity || 1) - 1)))} aria-label="Diminuir quantidade">−</button><input id="quantity" type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} required /><button type="button" onClick={() => setQuantity(String(Math.max(1, Number(quantity || 1) + 1)))} aria-label="Aumentar quantidade">＋</button></div><label htmlFor="paymentMethod">Forma de pagamento</label><select id="paymentMethod" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} required><option value="Pix">Pix</option><option value="Dinheiro">Dinheiro</option><option value="Débito">Cartão de débito</option><option value="Crédito">Cartão de crédito</option></select><div className="total-box"><span>Total da venda</span><strong>{money((selectedProduct?.price || 0) * Math.max(0, Number(quantity) || 0))}</strong></div><button className="primary submit" type="submit" disabled={loading}>{loading ? 'Salvando…' : '✓  Confirmar venda'}</button></form></section>}

    {tab === 'produtos' && <section className="content narrow"><div className="page-title"><p className="eyebrow">CATÁLOGO</p><h2>Produtos <span>♡</span></h2><p>Cadastre sabores, preços e quantidade em estoque.</p></div><form className="panel form-panel" onSubmit={addProduct}><h3>Adicionar biscoito</h3><label htmlFor="name">Nome do produto</label><input id="name" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Ex.: Biscoito de goiaba" required /><div className="two-fields"><div><label htmlFor="price">Preço (R$)</label><input id="price" inputMode="decimal" value={productPrice} onChange={e => setProductPrice(e.target.value)} placeholder="12,90" required /></div><div><label htmlFor="stock">Estoque inicial</label><input id="stock" type="number" min="0" step="1" value={productStock} onChange={e => setProductStock(e.target.value)} required /></div></div><button className="primary submit" type="submit" disabled={loading}>{loading ? 'Salvando…' : '＋  Cadastrar produto'}</button></form><section className="panel"><h3>Todos os produtos</h3>{products.map(p => <div className="product-row" key={p.id}><div className="cookie-icon">♡</div><div className="product-info"><b>{p.name}</b><small>{money(p.price)} por unidade</small></div><span className={`stock-pill ${p.stock < 5 ? 'low' : ''}`}>{p.stock} un.</span></div>)}</section></section>}

    {tab === 'historico' && <section className="content"><div className="page-title"><p className="eyebrow">ACOMPANHAMENTO</p><h2>Histórico de vendas <span>♡</span></h2><p>Confira as vendas registradas recentemente.</p></div><section className="panel">{sales.length ? <div className="sales-list">{sales.map(s => <div className="sale-row" key={s.id}><div className="cookie-icon">{s.status === 'cancelled' ? '↩' : '✓'}</div><div className="product-info"><b>{s.product_name}</b><small>{new Date(s.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {s.quantity} un. × {money(s.unit_price)} · Pagamento: {s.payment_method || 'Não informado (venda antiga)'} · <span className={s.status === 'cancelled' ? 'cancelled-label' : 'completed-label'}>{s.status === 'cancelled' ? 'Cancelada' : 'Concluída'}</span></small></div><div className="sale-actions"><strong className="sale-total">{money(s.total)}</strong>{s.status !== 'cancelled' && <button className="cancel-sale" onClick={() => cancelSale(s)} disabled={loading}>Cancelar</button>}</div></div>)}</div> : <div className="empty"><div className="empty-icon">♡</div><b>Suas vendas aparecerão aqui</b><p>Quando registrar a primeira venda, você poderá acompanhar tudo por aqui.</p><button className="primary" onClick={() => setTab('venda')}>Registrar primeira venda</button></div>}</section></section>}

    <nav className="bottom-nav" aria-label="Navegação principal">{nav.map(n => <button key={n.id} className={tab === n.id ? 'active' : ''} onClick={() => { setTab(n.id); setNotice(''); }}><span className="nav-icon">{n.icon}</span><span>{n.label}</span></button>)}</nav>
    <footer>Feito com carinho para <b>Chelle’s Biscoitos Amanteigados</b> <span>♡</span></footer>
  </main>;
}
