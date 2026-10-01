import { useEffect, useRef, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, Show, SignIn, SignUp, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, Check, ChevronDown, CircleHelp, CreditCard, FileText, Gauge, LogOut, Menu, Plus, ShieldCheck, Smartphone, Wifi, Zap, Tv, Music2, UserRound, WalletCards, X, RefreshCw, Search, CheckCircle2, AlertCircle, Clock3 } from 'lucide-react';
import { Link, Redirect, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  useGetMyProfile, useUpdateMyProfile, useGetDashboardSummary, useListServices, useGetWallet,
  useCreateWalletTopUp, useListTransactions, useCreatePurchase, useListNotifications,
  useMarkNotificationRead, useMarkAllNotificationsRead, useGetAdminOverview, useListAdminUsers,
  useUpdateAdminUser, useListAdminTransactions, getGetMyProfileQueryKey,
  getGetDashboardSummaryQueryKey, getGetWalletQueryKey, getListTransactionsQueryKey,
  getListNotificationsQueryKey, getGetAdminOverviewQueryKey, getListAdminUsersQueryKey,
  type ServiceProduct, type Transaction,
} from '@workspace/api-client-react';

const queryClient = new QueryClient();
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const clerkAppearance = {
  theme: shadcn, cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: {
    colorPrimary: '#276752', colorForeground: '#20372f', colorMutedForeground: '#738078',
    colorDanger: '#bf5141', colorBackground: '#fffefa', colorInput: '#fffefa',
    colorInputForeground: '#20372f', colorNeutral: '#d9ded5', fontFamily: 'DM Sans',
    borderRadius: '12px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffefa] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#20372f] font-bold', headerSubtitle: 'text-[#66736c]',
    socialButtonsBlockButtonText: 'text-[#20372f] font-semibold', formFieldLabel: 'text-[#33483f] font-semibold',
    footerActionLink: 'text-[#276752] font-bold', footerActionText: 'text-[#66736c]',
    dividerText: 'text-[#66736c]', identityPreviewEditButton: 'text-[#276752]',
    formFieldSuccessText: 'text-[#276752]', alertText: 'text-[#a84435]',
    logoBox: 'mb-2', logoImage: 'h-9', socialButtonsBlockButton: 'rounded-xl border-[#d9ded5]',
    formButtonPrimary: 'rounded-xl bg-[#276752] hover:bg-[#1c5543]',
    formFieldInput: 'rounded-xl border-[#d9ded5] bg-[#fffefa] text-[#20372f]',
    footerAction: 'text-[#66736c]', dividerLine: 'bg-[#d9ded5]', alert: 'rounded-xl',
    otpCodeFieldInput: 'rounded-lg', formFieldRow: 'gap-2', main: 'gap-3',
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const cache = useQueryClient();
  const previousId = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const id = user?.id ?? null;
    if (previousId.current !== undefined && previousId.current !== id) cache.clear();
    previousId.current = id;
  }), [addListener, cache]);
  return null;
}

const money = (kobo?: number | null) => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency: 'NGN', maximumFractionDigits: 2,
}).format((kobo ?? 0) / 100);
const shortDate = (value?: string) => value ? new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';
const categoryName: Record<string, string> = {
  airtime: 'Airtime', mobile_data: 'Mobile data', electricity: 'Electricity',
  cable_tv: 'Cable TV', digital_subscription: 'Digital subscription', wallet_top_up: 'Wallet top-up',
};
const categoryIcons: Record<string, typeof Smartphone> = {
  airtime: Smartphone, mobile_data: Wifi, electricity: Zap, cable_tv: Tv, digital_subscription: Music2,
};

function Wordmark({ inverse = false }: { inverse?: boolean }) {
  return <span className={`wordmark ${inverse ? 'inverse' : ''}`}><span className="brand-mark"><span /></span><span>data<span className="word-vault">vault</span></span></span>;
}
function TestFlag() { return <span className="test-flag"><span className="flag-dot" />TEST MODE</span>; }
function Button({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`btn ${className}`} {...props}>{children}</button>;
}
function LoadingBlock({ label = 'Loading your account' }: { label?: string }) {
  return <div className="loading-block" aria-label={label}><span className="skeleton-line w-40" /><span className="skeleton-line w-70" /><span className="skeleton-card" /></div>;
}
function ErrorState({ retry, message = 'We couldn’t load this just now.' }: { retry: () => void; message?: string }) {
  return <div className="state-box"><AlertCircle size={22} /><strong>{message}</strong><span>Check your connection and try again.</span><Button className="btn-secondary" onClick={retry}><RefreshCw size={15} /> Try again</Button></div>;
}
function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><span className="empty-icon"><FileText size={20} /></span><strong>{title}</strong><span>{description}</span></div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="form-field"><span>{label}</span>{children}</label>;
}

function Landing() {
  return <main className="landing grain">
    <nav className="landing-nav"><Link href="/"><Wordmark /></Link><div className="landing-links"><a href="#how-it-works">How it works</a><a href="#everyday">Everyday bills</a></div><div className="landing-actions"><Link href="/sign-in" className="nav-signin">Sign in</Link><Link href="/sign-up" className="btn btn-primary">Create account <ArrowRight size={16} /></Link></div></nav>
    <section className="hero">
      <div className="hero-copy page-enter"><div className="hero-kicker"><span className="kicker-line" /> MONEY, WITHOUT THE MYSTERY</div><h1>Your everyday<br />money, <em>in order.</em></h1><p>Pay bills, top up and keep an eye on your spending — all in one clear place. Made for the way Nigeria moves.</p><div className="hero-ctas"><Link href="/sign-up" className="btn btn-primary hero-cta">Get started <ArrowRight size={17} /></Link><Link href="/sign-in" className="hero-secondary">I already have an account <ArrowRight size={15} /></Link></div><div className="hero-trust"><ShieldCheck size={16} /><span>Private by design</span><i /> <span>Built for everyday life</span></div></div>
      <div className="hero-art" aria-label="A bright, dependable view of your money"><div className="art-sun" /><div className="art-ring ring-one" /><div className="art-ring ring-two" /><div className="orbit-dot" /><div className="balance-card"><div className="balance-card-top"><span>AVAILABLE BALANCE</span><span className="tiny-shield"><ShieldCheck size={14} /></span></div><div className="art-balance">₦<span>248,</span>650<span className="kobo">.00</span></div><div className="art-card-bottom"><span>EVERYTHING IN ONE PLACE</span><span className="art-bars"><i /><i /><i /><i /><i /><i /></span></div></div><div className="float-note note-spend"><span className="note-icon"><ArrowDownLeft size={15} /></span><span><small>Spent this month</small><b>₦42,800</b></span><span className="note-chart">↘</span></div><div className="float-note note-paid"><span className="paid-check"><Check size={14} /></span><span><small>Bill paid</small><b>All sorted</b></span></div><span className="art-caption">A clearer view of your money, every day.</span></div>
    </section>
    <section className="proof-strip"><span>One place for</span><b>Mobile top-ups</b><i /><b>Household bills</b><i /><b>Subscriptions</b><i /><b>Spending history</b></section>
    <section className="landing-intro" id="how-it-works"><div className="intro-stamp">A calmer<br />kind of<br /><b>money app.</b></div><div><span className="eyebrow">NO MORE GUESSING</span><h2>Know where it went.<br /><em>Know what’s next.</em></h2><p>When airtime, power and streaming all come from the same place, the small money moments become a lot easier to manage.</p><Link href="/sign-up" className="text-link">Bring it all together <ArrowRight size={15} /></Link></div></section>
    <section className="services-story" id="everyday"><div className="story-head"><div><span className="eyebrow">YOUR USUALS, SIMPLIFIED</span><h2>Life keeps moving.<br /><em>We keep it simple.</em></h2></div><p>The essentials are right here, ready when you are.</p></div><div className="service-ribbon"><div className="service-tile"><Smartphone /><span>01</span><b>Airtime</b><small>Talk without thinking twice.</small></div><div className="service-tile"><Wifi /><span>02</span><b>Mobile data</b><small>Stay in the loop, wherever.</small></div><div className="service-tile"><Zap /><span>03</span><b>Electricity</b><small>Keep the lights on, simply.</small></div><div className="service-tile"><Tv /><span>04</span><b>Cable TV</b><small>Your favourites, back on.</small></div><div className="service-tile"><Music2 /><span>05</span><b>Subscriptions</b><small>Make room for your downtime.</small></div></div></section>
    <section className="feature-band"><div className="feature-graphic"><div className="feature-orbit" /><div className="receipt-card"><span className="eyebrow">YOUR SPENDING, CLEARLY</span><div className="receipt-row"><i className="receipt-dot coral" /><span>Data & airtime</span><b>₦8,450</b></div><div className="receipt-row"><i className="receipt-dot gold" /><span>Home & utilities</span><b>₦21,300</b></div><div className="receipt-row"><i className="receipt-dot teal" /><span>Subscriptions</span><b>₦4,200</b></div><div className="receipt-total"><span>This month</span><b>₦33,950</b></div></div></div><div className="feature-copy"><span className="eyebrow">SMALL DETAILS. BIG RELIEF.</span><h2>Every payment<br />leaves a <em>clear trail.</em></h2><p>Your wallet and transaction history give every top-up and bill a place to land. Nothing to piece together later.</p><Link href="/sign-up" className="text-link">See your money clearly <ArrowRight size={15} /></Link></div></section>
    <section className="closing-cta"><div className="cta-sun" /><span className="eyebrow">LESS MONEY ADMIN. MORE LIFE.</span><h2>Feel good about<br />where it all goes.</h2><p>Start with your everyday payments. Keep the clarity.</p><Link href="/sign-up" className="btn btn-primary">Make it your home for bills <ArrowRight size={17} /></Link><span className="cta-small">Free to create an account · Ready when you are</span></section>
    <footer className="landing-footer"><Link href="/"><Wordmark /></Link><span>Everyday money, made clear.</span><div><Link href="/sign-in">Sign in</Link><Link href="/sign-up">Create account</Link></div><small>© {new Date().getFullYear()} DataVault Nigeria</small></footer>
  </main>;
}

const mainNav = [
  { href: '/dashboard', label: 'Overview', Icon: Gauge },
  { href: '/wallet', label: 'Wallet', Icon: WalletCards },
  { href: '/transactions', label: 'Transactions', Icon: FileText },
  { href: '/notifications', label: 'Notifications', Icon: Bell },
  { href: '/profile', label: 'Profile', Icon: UserRound },
];
const servicesNav = [
  { href: '/buy/airtime', label: 'Airtime', Icon: Smartphone },
  { href: '/buy/mobile_data', label: 'Mobile data', Icon: Wifi },
  { href: '/buy/electricity', label: 'Electricity', Icon: Zap },
  { href: '/buy/cable_tv', label: 'Cable TV', Icon: Tv },
  { href: '/buy/digital_subscription', label: 'Subscriptions', Icon: Music2 },
];
function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const profile = useGetMyProfile();
  const notifications = useListNotifications();
  const [mobileOpen, setMobileOpen] = useState(false);
  const unread = notifications.data?.filter((n) => !n.isRead).length ?? 0;
  const isAdmin = profile.data?.role === 'admin';
  const sidebarLink = (item: { href: string; label: string; Icon: typeof Gauge }) => {
    const active = location === item.href || (item.href.startsWith('/buy/') && location === item.href);
    return <Link key={item.href} href={item.href} className={`side-link ${active ? 'active' : ''}`} data-testid={`link-${item.label.toLowerCase().replaceAll(' ', '-')}`}><item.Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.label === 'Notifications' && unread > 0 && <b className="unread-count">{unread}</b>}</Link>;
  };
  return <div className="app-frame">
    <aside className="desktop-sidebar"><Link href="/dashboard"><Wordmark inverse /></Link><div className="workspace-tag">YOUR SPACE</div><nav className="side-nav">{mainNav.map(sidebarLink)}</nav><div className="side-section-label">PAY A BILL</div><nav className="side-nav">{servicesNav.map(sidebarLink)}</nav>{isAdmin && <><div className="side-section-label">MANAGE</div><nav className="side-nav">{sidebarLink({ href: '/admin', label: 'Admin overview', Icon: ShieldCheck })}{sidebarLink({ href: '/admin/users', label: 'Users', Icon: UserRound })}{sidebarLink({ href: '/admin/transactions', label: 'All transactions', Icon: FileText })}</nav></>}<div className="sidebar-bottom"><div className="support-card"><CircleHelp size={16} /><span><b>Need a hand?</b><small>We’re here to help.</small></span><ArrowRight size={14} /></div><button className="profile-mini" onClick={() => signOut({ redirectUrl: basePath || '/' })}><span className="avatar-dot">{profile.data?.name?.trim().charAt(0).toUpperCase() || 'D'}</span><span className="profile-mini-text"><b>{profile.data?.name || 'Your account'}</b><small>{profile.data?.email || 'Signed in'}</small></span><LogOut size={15} /></button></div></aside>
    <main className="app-main"><header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation">{mobileOpen ? <X size={19} /> : <Menu size={19} />}</button><div className="breadcrumb"><span>DataVault</span><span>/</span><b>{breadcrumb(location)}</b></div><div className="topbar-right"><TestFlag /><Link href="/notifications" className="notification-icon" aria-label="Notifications"><Bell size={18} />{unread > 0 && <i />}</Link><Link href="/profile" className="top-avatar">{profile.data?.name?.trim().charAt(0).toUpperCase() || 'D'}</Link></div></header>{mobileOpen && <div className="mobile-menu-panel">{[...mainNav,...servicesNav,...(isAdmin ? [{ href:'/admin',label:'Admin overview',Icon:ShieldCheck as typeof Gauge },{ href:'/admin/users',label:'Users',Icon:UserRound },{ href:'/admin/transactions',label:'All transactions',Icon:FileText }] : [])].map(sidebarLink)}</div>}<div className="page-content">{children}</div><nav className="mobile-nav">{mainNav.slice(0,4).map((item) => <Link href={item.href} key={item.href} className={location === item.href ? 'selected' : ''}><item.Icon size={19} /><span>{item.label === 'Overview' ? 'Home' : item.label}</span></Link>)}</nav></main>
  </div>;
}
function breadcrumb(path: string) {
  const item = [...mainNav,...servicesNav,{ href:'/admin',label:'Admin overview',Icon:ShieldCheck }].find((n) => n.href === path);
  if (path === '/buy/digital_subscription') return 'Subscriptions';
  if (path === '/admin/users') return 'Users';
  if (path === '/admin/transactions') return 'All transactions';
  return item?.label ?? 'Overview';
}
function Authenticated({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to={`/sign-in?redirect_url=${encodeURIComponent(location)}`} /></Show></>;
}
function ProtectedPage({ children }: { children: ReactNode }) {
  return <Authenticated><AppShell>{children}</AppShell></Authenticated>;
}
function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1 className="font-display">{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}

function TransactionRows({ rows }: { rows: Transaction[] }) {
  if (!rows.length) return <EmptyState title="Nothing here yet" description="When you make a payment, it’ll show up here." />;
  return <div className="table-wrap"><table><thead><tr><th>Payment</th><th>Provider</th><th>When</th><th>Status</th><th className="align-right">Amount</th></tr></thead><tbody>{rows.map((tx) => {
    const Icon = categoryIcons[tx.category] || CreditCard;
    return <tr key={tx.id} data-testid={`row-transaction-${tx.id}`}><td><div className="tx-name"><span className={`tx-icon tx-${tx.category}`}><Icon size={16} /></span><span><b>{tx.description || categoryName[tx.category]}</b><small>{categoryName[tx.category]}</small></span></div></td><td>{tx.provider}</td><td>{shortDate(tx.createdAt)}</td><td><span className={`status-pill status-${tx.status}`}>{tx.status}</span></td><td className="align-right money">{tx.category === 'wallet_top_up' ? '+' : '−'}{money(tx.amountKobo)}</td></tr>;
  })}</tbody></table></div>;
}
function Dashboard() {
  const summary = useGetDashboardSummary();
  const profile = useGetMyProfile();
  const { data, isLoading, isError, refetch } = summary;
  if (isLoading) return <LoadingBlock />;
  if (isError || !data) return <ErrorState retry={() => { void refetch(); }} />;
  const monthTotal = data.monthlySpend?.at(-1)?.amountKobo ?? data.spentThisMonthKobo;
  return <div className="page-enter"><div className="welcome-row"><div><span className="eyebrow">YOUR MONEY AT A GLANCE</span><h1 className="font-display">Good to see you, {profile.data?.name?.split(' ')[0] || 'there'}.</h1><p>Here’s how things are looking today.</p></div><TestFlag /></div><div className="dashboard-top-grid"><section className="balance-panel"><div className="balance-label"><span>AVAILABLE BALANCE</span><span className="balance-mark"><WalletCards size={17} /></span></div><strong className="balance-amount money">{money(data.balanceKobo)}</strong><div className="balance-meta"><span><span className="live-dot" /> Your wallet is ready</span><Link href="/wallet">Manage wallet <ArrowRight size={14} /></Link></div><div className="balance-pattern" /></section><section className="spend-panel panel"><div className="spend-panel-top"><span className="eyebrow">SPENT THIS MONTH</span><span className="spend-icon"><ArrowUpRight size={16} /></span></div><strong className="spend-amount money">{money(monthTotal)}</strong><p>Across {data.transactionCount} transaction{data.transactionCount === 1 ? '' : 's'} this month</p><div className="spend-bars" aria-label="Monthly spend"><div className="bar-grid">{(data.monthlySpend || []).slice(-6).map((month, index) => <div className="bar-column" key={`${month.month}-${index}`}><span style={{ height: `${Math.max(7, Math.min(100, (month.amountKobo / Math.max(...data.monthlySpend.map((m) => m.amountKobo), 1)) * 100))}%` }} /><small>{month.month.slice(0,3)}</small></div>)}</div></div></section></div><div className="section-label-row"><div><span className="eyebrow">THE EVERYDAY ESSENTIALS</span><h2>What do you need today?</h2></div><span className="small-copy">Your regulars, ready when you are.</span></div><div className="quick-services">{servicesNav.map((item, i) => <Link key={item.href} href={item.href} className={`quick-service quick-${i}`}><span className="quick-icon"><item.Icon size={19} /></span><b>{item.label}</b><ArrowRight className="quick-arrow" size={15} /></Link>)}</div><section className="recent-panel panel"><div className="section-head"><div><span className="eyebrow">YOUR RECENT ACTIVITY</span><h2>Recent transactions</h2></div><Link href="/transactions" className="text-link">See all <ArrowRight size={14} /></Link></div><TransactionRows rows={data.recentTransactions || []} /></section></div>;
}

function WalletPage() {
  const wallet = useGetWallet();
  const transactions = useListTransactions({ limit: 8 });
  const addFunds = useCreateWalletTopUp();
  const cache = useQueryClient();
  const [amount, setAmount] = useState('2500');
  const [error, setError] = useState('');
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault(); setError('');
    const amountKobo = Math.round(Number(amount) * 100);
    if (!Number.isFinite(amountKobo) || amountKobo < 100000 || amountKobo > 50000000) { setError('Choose an amount from ₦1,000 to ₦500,000.'); return; }
    addFunds.mutate({ data: { amountKobo } }, { onSuccess: () => { void cache.invalidateQueries({ queryKey: getGetWalletQueryKey() }); void cache.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); void cache.invalidateQueries({ queryKey: getListTransactionsQueryKey({ limit: 8 }) }); setError(''); }, onError: () => setError('Test funds could not be added. Please try again.') });
  };
  if (wallet.isLoading) return <LoadingBlock />;
  if (wallet.isError || !wallet.data) return <ErrorState retry={() => { void wallet.refetch(); }} />;
  return <div className="page-enter"><PageHeading eyebrow="YOUR WALLET" title="A little more room." subtitle="Your balance, and a safe place to add test funds." /><div className="wallet-layout"><section className="wallet-balance panel"><span className="eyebrow">WALLET BALANCE</span><strong className="money">{money(wallet.data.balanceKobo)}</strong><span className="wallet-updated">Last updated {shortDate(wallet.data.updatedAt)}</span><div className="wallet-divider" /><div className="wallet-stat"><span>Currency</span><b>{wallet.data.currency}</b></div><div className="wallet-stat"><span>Wallet status</span><b><span className="live-dot" /> Ready</b></div></section><section className="topup-panel panel"><div className="topup-heading"><span className="topup-icon"><Plus size={18} /></span><div><h2>Add test funds</h2><p>Practice your payment flow with a simulated top-up.</p></div></div><div className="test-alert"><AlertCircle size={17} /><span><b>TEST MODE ONLY</b> — no real payment will be taken.</span></div><form onSubmit={handleSubmit}><Field label="Amount to add"><div className="amount-input"><span>₦</span><input className="field" type="number" min="1000" max="500000" step="100" value={amount} onChange={(e) => setAmount(e.target.value)} required data-testid="input-topup-amount" /></div></Field><div className="quick-amounts">{['1000','2500','5000','10000'].map((v) => <button className={amount === v ? 'selected' : ''} type="button" key={v} onClick={() => setAmount(v)}>₦{Number(v).toLocaleString()}</button>)}</div>{error && <p className="form-error">{error}</p>}<Button className="btn-primary full-width" disabled={addFunds.isPending}>{addFunds.isPending ? 'Adding test funds…' : <>Add test funds <ArrowRight size={16} /></>}</Button></form></section></div><section className="recent-panel panel wallet-history"><div className="section-head"><div><span className="eyebrow">WALLET ACTIVITY</span><h2>Recent transactions</h2></div><Link className="text-link" href="/transactions">All activity <ArrowRight size={14} /></Link></div>{transactions.isLoading ? <LoadingBlock /> : transactions.isError ? <ErrorState retry={() => { void transactions.refetch(); }} /> : <TransactionRows rows={transactions.data || []} />}</section></div>;
}

function TransactionsPage() {
  const tx = useListTransactions({ limit: 100 });
  const [filter, setFilter] = useState('all');
  const rows = (tx.data || []).filter((item) => filter === 'all' || item.category === filter);
  return <div className="page-enter"><PageHeading eyebrow="YOUR PAYMENT HISTORY" title="Everything, accounted for." subtitle="A clear record of what you’ve paid and when." /><div className="filter-row"><label className="search-field"><Search size={16} /><select className="field" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter transactions"><option value="all">All activity</option>{Object.entries(categoryName).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select><ChevronDown size={15} /></label><span className="result-count">{rows.length} transaction{rows.length === 1 ? '' : 's'}</span></div><section className="recent-panel panel">{tx.isLoading ? <LoadingBlock /> : tx.isError ? <ErrorState retry={() => { void tx.refetch(); }} /> : <TransactionRows rows={rows} />}</section></div>;
}

function PurchasePage({ category }: { category: string }) {
  const services = useListServices();
  const tx = useCreatePurchase();
  const cache = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const available = (services.data || []).filter((item) => item.category === category);
  const selected: ServiceProduct | undefined = available.find((item) => item.id === selectedId) || available[0];
  useEffect(() => { if (selected && !selectedId) setSelectedId(selected.id); }, [selected, selectedId]);
  const title = categoryName[category] || 'Payment';
  const amountRequired = selected?.priceKobo == null;
  const submit = (e: FormEvent) => {
    e.preventDefault(); setMessage('');
    if (!selected) return;
    if (reference.trim().length < 3) { setMessage('Enter a valid account or phone number.'); return; }
    const amountKobo = amount ? Math.round(Number(amount) * 100) : undefined;
    if (amountRequired && (!amountKobo || amountKobo < 100)) { setMessage('Enter an amount of at least ₦1.'); return; }
    if (amountKobo && selected.minAmountKobo != null && amountKobo < selected.minAmountKobo) { setMessage(`The minimum amount is ${money(selected.minAmountKobo)}.`); return; }
    if (amountKobo && selected.maxAmountKobo != null && amountKobo > selected.maxAmountKobo) { setMessage(`The maximum amount is ${money(selected.maxAmountKobo)}.`); return; }
    tx.mutate({ data: { serviceId: selected.id, accountReference: reference.trim(), ...(amountKobo ? { amountKobo } : {}) } }, {
      onSuccess: () => { setReference(''); setAmount(''); setMessage('Payment simulated successfully. Your wallet and history are up to date.'); void cache.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); void cache.invalidateQueries({ queryKey: getGetWalletQueryKey() }); void cache.invalidateQueries({ queryKey: getListTransactionsQueryKey({ limit: 100 }) }); },
      onError: () => setMessage('We couldn’t complete this test purchase. Please check your details and retry.'),
    });
  };
  const Icon = categoryIcons[category] || CreditCard;
  return <div className="page-enter"><PageHeading eyebrow={`PAY A BILL / ${title.toUpperCase()}`} title={`${title}, made simple.`} subtitle={`Choose a provider, add your details and you’re all set.`} action={<TestFlag />} />{services.isLoading ? <LoadingBlock label="Loading available services" /> : services.isError ? <ErrorState retry={() => { void services.refetch(); }} /> : <div className="purchase-layout"><section className="purchase-form-card panel"><div className="purchase-title"><span className={`purchase-category-icon purchase-${category}`}><Icon size={19} /></span><div><h2>Payment details</h2><p>This purchase will run in test mode.</p></div></div><div className="test-alert"><AlertCircle size={17} /><span><b>TEST MODE ONLY</b> — this does not pay a real bill.</span></div>{available.length === 0 ? <EmptyState title="No services available" description="There are no test-mode services in this category right now." /> : <form onSubmit={submit} className="purchase-form"><Field label="Provider"><select className="field" value={selected?.id || ''} onChange={(e) => setSelectedId(e.target.value)}>{available.map((service) => <option value={service.id} key={service.id}>{service.provider} · {service.name}</option>)}</select></Field>{selected?.description && <div className="service-description">{selected.description}</div>}<Field label={category === 'airtime' || category === 'mobile_data' ? 'Phone number' : category === 'electricity' ? 'Meter number' : 'Account reference'}><input className="field" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={category === 'airtime' || category === 'mobile_data' ? '080 0000 0000' : 'Enter your account number'} required minLength={3} data-testid="input-account-reference" /></Field>{amountRequired && <Field label="Amount"><div className="amount-input"><span>₦</span><input className="field" type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount" required data-testid="input-purchase-amount" /></div>{selected?.minAmountKobo != null && <small className="field-hint">Min {money(selected.minAmountKobo)}{selected.maxAmountKobo != null ? ` · Max ${money(selected.maxAmountKobo)}` : ''}</small>}</Field>}{!amountRequired && <div className="selected-plan"><span>Plan total</span><b>{money(selected?.priceKobo)}</b></div>}{message && <p className={message.startsWith('Payment simulated') ? 'form-success' : 'form-error'}>{message}</p>}<Button className="btn-primary full-width" disabled={tx.isPending || !selected}>{tx.isPending ? 'Processing test purchase…' : <>Review test payment <ArrowRight size={16} /></>}</Button><p className="secure-note"><ShieldCheck size={14} /> Your details are used only to simulate this test purchase.</p></form>}</section><aside className="purchase-aside"><div className="aside-orbit"><span className="aside-circle"><Icon size={26} /></span><i /><i /><i /></div><span className="eyebrow">READY WHEN YOU ARE</span><h3>Simple payments.<br /><em>Clear records.</em></h3><p>Every simulated payment appears in your wallet activity and transaction history.</p><Link href="/transactions" className="text-link">View transaction history <ArrowRight size={14} /></Link></aside></div>}</div>;
}

function NotificationsPage() {
  const notes = useListNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const cache = useQueryClient();
  const unread = notes.data?.filter((n) => !n.isRead).length ?? 0;
  const sync = () => void cache.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
  return <div className="page-enter"><PageHeading eyebrow="YOUR INBOX" title="A few things to know." subtitle="Updates about your account and payments." action={unread > 0 ? <Button className="btn-secondary mark-all" onClick={() => markAll.mutate(undefined, { onSuccess: sync })} disabled={markAll.isPending}><Check size={15} /> Mark all read</Button> : undefined} />{notes.isLoading ? <LoadingBlock /> : notes.isError ? <ErrorState retry={() => { void notes.refetch(); }} /> : !notes.data?.length ? <EmptyState title="All quiet here" description="Important account and payment updates will appear here." /> : <div className="notification-list">{notes.data.map((note) => <article className={`notification-card panel ${note.isRead ? 'is-read' : ''}`} key={note.id}><span className={`notification-symbol ${note.isRead ? '' : 'unread'}`}><Bell size={17} /></span><div className="notification-content"><div className="notification-title-row"><h2>{note.title}</h2>{!note.isRead && <span className="new-tag">NEW</span>}</div><p>{note.message}</p><span className="notification-time"><Clock3 size={13} />{shortDate(note.createdAt)}</span></div>{!note.isRead && <button className="read-button" title="Mark as read" onClick={() => markRead.mutate({ id: note.id }, { onSuccess: sync })}><Check size={16} /><span>Mark read</span></button>}</article>)}</div>}</div>;
}

function ProfilePage() {
  const profile = useGetMyProfile();
  const update = useUpdateMyProfile();
  const cache = useQueryClient();
  const initialized = useRef(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState('');
  useEffect(() => { if (profile.data && !initialized.current) { initialized.current = true; setName(profile.data.name); setPhone(profile.data.phone || ''); } }, [profile.data]);
  if (profile.isLoading) return <LoadingBlock />;
  if (profile.isError || !profile.data) return <ErrorState retry={() => { void profile.refetch(); }} />;
  const submit = (e: FormEvent) => { e.preventDefault(); setSaved(''); update.mutate({ data: { name: name.trim(), phone: phone.trim() || null } }, { onSuccess: () => { setSaved('Your profile is up to date.'); void cache.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }); } }); };
  return <div className="page-enter"><PageHeading eyebrow="YOUR ACCOUNT" title="The details that make it yours." subtitle="Keep your contact information up to date." /><div className="profile-layout"><section className="profile-card panel"><div className="profile-portrait">{profile.data.name.trim().charAt(0).toUpperCase()}</div><h2>{profile.data.name}</h2><p>{profile.data.email}</p><div className="profile-meta"><span>ACCOUNT TYPE</span><b>{profile.data.role === 'admin' ? 'Administrator' : 'Customer'}</b></div><div className="profile-meta"><span>MEMBER SINCE</span><b>{shortDate(profile.data.createdAt)}</b></div><div className="profile-meta"><span>ACCOUNT STATUS</span><b><span className={`status-pill status-${profile.data.isActive ? 'active' : 'inactive'}`}>{profile.data.isActive ? 'Active' : 'Inactive'}</span></b></div></section><section className="profile-form-card panel"><span className="eyebrow">PERSONAL DETAILS</span><h2>Update your profile</h2><form onSubmit={submit}><Field label="Full name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} required minLength={1} maxLength={120} data-testid="input-profile-name" /></Field><Field label="Email address"><input className="field" value={profile.data.email} disabled readOnly /></Field><Field label="Phone number"><input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Add a phone number" maxLength={30} data-testid="input-profile-phone" /></Field>{saved && <p className="form-success">{saved}</p>}{update.isError && <p className="form-error">We couldn’t save those changes. Please try again.</p>}<Button className="btn-primary" disabled={update.isPending}>{update.isPending ? 'Saving changes…' : 'Save changes'}</Button></form></section></div></div>;
}

function AdminOverviewPage() {
  const overview = useGetAdminOverview();
  if (overview.isLoading) return <LoadingBlock label="Loading administration overview" />;
  if (overview.isError || !overview.data) return <ErrorState retry={() => { void overview.refetch(); }} />;
  const d = overview.data;
  const metrics = [
    { title:'Total users', value:d.totalUsers.toLocaleString(), icon:UserRound, detail:`${d.activeUsers} active accounts`, color:'green' },
    { title:'Transactions today', value:d.transactionsToday.toLocaleString(), icon:FileText, detail:`${d.pendingTransactions} pending`, color:'coral' },
    { title:'Volume today', value:money(d.volumeTodayKobo), icon:ArrowUpRight, detail:'Across all test payments', color:'gold' },
    { title:'Pending transactions', value:d.pendingTransactions.toLocaleString(), icon:Clock3, detail:'Awaiting final status', color:'blue' },
  ];
  return <div className="page-enter"><PageHeading eyebrow="ADMINISTRATION" title="A clear view of the whole." subtitle="Monitor accounts and test-mode activity across DataVault." action={<span className="admin-badge"><ShieldCheck size={15} /> ADMIN</span>} /><div className="admin-metrics">{metrics.map((metric) => <div className="admin-metric panel" key={metric.title}><span className={`metric-icon ${metric.color}`}><metric.icon size={17} /></span><span className="eyebrow">{metric.title}</span><b>{metric.value}</b><small>{metric.detail}</small></div>)}</div><section className="recent-panel panel"><div className="section-head"><div><span className="eyebrow">LATEST ACTIVITY</span><h2>Recent transactions</h2></div><Link className="text-link" href="/admin/transactions">View all <ArrowRight size={14} /></Link></div>{d.recentTransactions?.length ? <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Payment</th><th>When</th><th>Status</th><th className="align-right">Amount</th></tr></thead><tbody>{d.recentTransactions.map((tx) => <tr key={tx.id}><td><div className="admin-user-cell"><span className="table-avatar">{tx.userName.trim().charAt(0).toUpperCase()}</span><span><b>{tx.userName}</b><small>{tx.userEmail}</small></span></div></td><td>{tx.description || categoryName[tx.category]}</td><td>{shortDate(tx.createdAt)}</td><td><span className={`status-pill status-${tx.status}`}>{tx.status}</span></td><td className="align-right money">{money(tx.amountKobo)}</td></tr>)}</tbody></table></div> : <EmptyState title="No recent activity" description="Transactions will appear here when customers pay a bill." />}</section></div>;
}
function AdminUsersPage() {
  const users = useListAdminUsers();
  const update = useUpdateAdminUser();
  const cache = useQueryClient();
  const [query, setQuery] = useState('');
  const filtered = (users.data || []).filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase()));
  const change = (id: string, data: { isActive?: boolean; role?: 'admin' | 'customer' }) => update.mutate({ id, data }, { onSuccess: () => { void cache.invalidateQueries({ queryKey: getListAdminUsersQueryKey() }); void cache.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }); } });
  return <div className="page-enter"><PageHeading eyebrow="ADMINISTRATION / ACCOUNTS" title="People who make it work." subtitle="Review customer accounts and access status." /><div className="admin-toolbar"><label className="search-field"><Search size={16} /><input className="field" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" data-testid="input-search-users" /></label><span>{filtered.length} account{filtered.length === 1 ? '' : 's'}</span></div><section className="recent-panel panel">{users.isLoading ? <LoadingBlock /> : users.isError ? <ErrorState retry={() => { void users.refetch(); }} /> : !filtered.length ? <EmptyState title="No matching accounts" description={query ? 'Try a different name or email.' : 'Customer accounts will appear here.'} /> : <div className="table-wrap"><table><thead><tr><th>Account</th><th>Phone</th><th>Role</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.map((user) => <tr key={user.id} data-testid={`row-admin-user-${user.id}`}><td><div className="admin-user-cell"><span className="table-avatar">{user.name.trim().charAt(0).toUpperCase()}</span><span><b>{user.name}</b><small>{user.email}</small></span></div></td><td>{user.phone || '—'}</td><td><select className="role-select" aria-label={`Role for ${user.name}`} value={user.role} disabled={update.isPending} onChange={(e) => change(user.id, { role: e.target.value as 'admin' | 'customer' })}><option value="customer">Customer</option><option value="admin">Admin</option></select></td><td className="money">{money(user.balanceKobo)}</td><td><span className={`status-pill status-${user.isActive ? 'active' : 'inactive'}`}>{user.isActive ? 'Active' : 'Inactive'}</span></td><td><button className={`table-action ${user.isActive ? 'deactivate' : ''}`} onClick={() => change(user.id, { isActive: !user.isActive })} disabled={update.isPending}>{user.isActive ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div>}</section></div>;
}
function AdminTransactionsPage() {
  const transactions = useListAdminTransactions({ limit: 100 });
  const [search, setSearch] = useState('');
  const filtered = (transactions.data || []).filter((tx) => `${tx.userName} ${tx.userEmail} ${tx.description} ${tx.provider}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="page-enter"><PageHeading eyebrow="ADMINISTRATION / ACTIVITY" title="Every payment, in view." subtitle="Review test-mode activity across all customer accounts." action={<TestFlag />} /><div className="admin-toolbar"><label className="search-field"><Search size={16} /><input className="field" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer or provider" /></label><span>{filtered.length} transaction{filtered.length === 1 ? '' : 's'}</span></div><section className="recent-panel panel">{transactions.isLoading ? <LoadingBlock /> : transactions.isError ? <ErrorState retry={() => { void transactions.refetch(); }} /> : !filtered.length ? <EmptyState title="No matching payments" description="Try another customer or provider." /> : <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Payment</th><th>Provider</th><th>Reference</th><th>When</th><th>Status</th><th className="align-right">Amount</th></tr></thead><tbody>{filtered.map((tx) => <tr key={tx.id}><td><div className="admin-user-cell"><span className="table-avatar">{tx.userName.trim().charAt(0).toUpperCase()}</span><span><b>{tx.userName}</b><small>{tx.userEmail}</small></span></div></td><td>{categoryName[tx.category] || tx.category}</td><td>{tx.provider}</td><td className="mono reference-text">{tx.accountReference}</td><td>{shortDate(tx.createdAt)}</td><td><span className={`status-pill status-${tx.status}`}>{tx.status}</span></td><td className="align-right money">{money(tx.amountKobo)}</td></tr>)}</tbody></table></div>}</section></div>;
}
function AdminGate({ children }: { children: ReactNode }) {
  const profile = useGetMyProfile();
  if (profile.isLoading) return <LoadingBlock />;
  if (profile.isError) return <ErrorState retry={() => { void profile.refetch(); }} />;
  if (profile.data?.role !== 'admin') return <div className="state-box"><ShieldCheck size={23} /><strong>Admin access required</strong><span>This area is only available to DataVault administrators.</span><Link href="/dashboard" className="btn btn-secondary">Back to overview</Link></div>;
  return <>{children}</>;
}

function SignInPage() {
  return <main className="auth-page grain"><div className="auth-presentation"><Link href="/"><Wordmark inverse /></Link><span className="eyebrow">YOUR EVERYDAY, IN ORDER</span><h1>Good to have<br /><em>you back.</em></h1><p>Your wallet, bills and spending history are right where you left them.</p><div className="auth-orbit"><span><WalletCards size={25} /></span><i /><i /></div><Link href="/" className="auth-home">← Back to DataVault</Link></div><div className="auth-form-side"><div className="auth-form-head"><Link href="/"><Wordmark /></Link><span>Welcome back. Let’s get you in.</span></div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /><div className="auth-footnote"><ShieldCheck size={14} /> Secure sign-in, powered by Clerk</div></div></main>;
}
function SignUpPage() {
  return <main className="auth-page grain"><div className="auth-presentation"><Link href="/"><Wordmark inverse /></Link><span className="eyebrow">A CLEARER WAY TO PAY</span><h1>Make room for<br /><em>peace of mind.</em></h1><p>Bring your everyday bills, wallet and spending into one dependable place.</p><div className="auth-orbit"><span><CheckCircle2 size={25} /></span><i /><i /></div><Link href="/" className="auth-home">← Back to DataVault</Link></div><div className="auth-form-side"><div className="auth-form-head"><Link href="/"><Wordmark /></Link><span>Let’s get your DataVault started.</span></div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /><div className="auth-footnote"><ShieldCheck size={14} /> Your information stays yours</div></div></main>;
}
function LandingRoute() {
  return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Landing /></Show></>;
}
function SignOutRoute() {
  const { signOut } = useClerk();
  useEffect(() => { void signOut({ redirectUrl: basePath || '/' }); }, [signOut]);
  return <LoadingBlock label="Signing out" />;
}
function AppRoutes() {
  return <ErrorBoundary resetKey={window.location.pathname}><Switch>
    <Route path="/" component={LandingRoute} />
    <Route path="/sign-in/*?" component={SignInPage} />
    <Route path="/sign-up/*?" component={SignUpPage} />
    <Route path="/sign-out"><SignOutRoute /></Route>
    <Route path="/dashboard"><ProtectedPage><Dashboard /></ProtectedPage></Route>
    <Route path="/wallet"><ProtectedPage><WalletPage /></ProtectedPage></Route>
    <Route path="/transactions"><ProtectedPage><TransactionsPage /></ProtectedPage></Route>
    <Route path="/notifications"><ProtectedPage><NotificationsPage /></ProtectedPage></Route>
    <Route path="/profile"><ProtectedPage><ProfilePage /></ProtectedPage></Route>
    <Route path="/buy/airtime"><ProtectedPage><PurchasePage category="airtime" /></ProtectedPage></Route>
    <Route path="/buy/mobile_data"><ProtectedPage><PurchasePage category="mobile_data" /></ProtectedPage></Route>
    <Route path="/buy/electricity"><ProtectedPage><PurchasePage category="electricity" /></ProtectedPage></Route>
    <Route path="/buy/cable_tv"><ProtectedPage><PurchasePage category="cable_tv" /></ProtectedPage></Route>
    <Route path="/buy/digital_subscription"><ProtectedPage><PurchasePage category="digital_subscription" /></ProtectedPage></Route>
    <Route path="/admin"><ProtectedPage><AdminGate><AdminOverviewPage /></AdminGate></ProtectedPage></Route>
    <Route path="/admin/users"><ProtectedPage><AdminGate><AdminUsersPage /></AdminGate></ProtectedPage></Route>
    <Route path="/admin/transactions"><ProtectedPage><AdminGate><AdminTransactionsPage /></AdminGate></ProtectedPage></Route>
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}
function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{
    signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to your DataVault account' } },
    signUp: { start: { title: 'Create your DataVault', subtitle: 'Everyday money, made clear' } },
  }} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}>
    <QueryClientProvider client={queryClient}><TooltipProvider><ClerkQueryClientCacheInvalidator /><AppRoutes /><Toaster /></TooltipProvider></QueryClientProvider>
  </ClerkProvider>;
}
function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}
export default App;