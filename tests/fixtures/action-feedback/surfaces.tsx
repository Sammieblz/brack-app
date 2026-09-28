import type { ReactNode } from 'react';
import { AppBackButton } from '@/components/AppBackButton';
export const MobileLayout = ({ children }: { children: ReactNode }) => <main>{children}</main>;
export const MobileHeader = ({ title }: { title: string }) => <header className="p-4"><AppBackButton fallbackPath="/my-books" /><h1>{title}</h1></header>;
export const BarcodeScannerFlow = () => <p>Scanner service is outside this fixture.</p>;
