import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Chelle's Biscoitos",
  description: 'Vendas, produtos e estoque da Chelle’s Biscoitos Amanteigados.',
  applicationName: "Chelle's Biscoitos"
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f8e6e8' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
