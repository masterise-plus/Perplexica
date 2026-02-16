'use client';

import { cn } from '@/lib/utils';
import {
  BookOpenText,
  Home,
  Search,
  SquarePen,
  Settings,
  Plus,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';
import React, { useState, type ReactNode } from 'react';
import Layout from './Layout';
import {
  Description,
  Dialog,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import SettingsButton from './Settings/SettingsButton';

const VerticalIconContainer = ({ children }: { children: ReactNode }) => {
  return <div className="flex flex-col items-center w-full">{children}</div>;
};

const Sidebar = ({ children }: { children: React.ReactNode }) => {
  const segments = useSelectedLayoutSegments();
  const [isOpen, setIsOpen] = useState<boolean>(true);

  const navLinks = [
    {
      icon: Home,
      href: '/',
      active: segments.length === 0 || segments.includes('c'),
      label: 'Home',
    },
    // {
    //   icon: Search,
    //   href: '/discover',
    //   active: segments.includes('discover'),
    //   label: 'Discover',
    // },
    {
      icon: BookOpenText,
      href: '/library',
      active: segments.includes('library'),
      label: 'Library',
    },
  ];

  return (
    <div>
      {/* SVG filter for liquid glass refraction (available for inner elements) */}
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
        <defs>
          <filter id="liquid-glass-sidebar-filter">
            <feTurbulence type="fractalNoise" baseFrequency="0.015 0.01" numOctaves={2} result="warp" />
            <feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale={18} in="SourceGraphic" in2="warp" />
            <feGaussianBlur stdDeviation={1.2} />
          </filter>
        </defs>
      </svg>

      <div
        className="hidden lg:fixed lg:z-50 lg:flex lg:w-[72px] lg:flex-col lg:top-1/2 lg:-translate-y-1/2 lg:left-3 liquid-glass-sidebar"
      >
        <div className="relative z-10 flex flex-col items-center justify-between gap-y-5 overflow-y-auto px-2 py-5">
          <Link
            className="p-2.5 rounded-full bg-light-200 text-black/70 dark:bg-dark-200 dark:text-white/70 hover:opacity-70 hover:scale-105 tansition duration-200"
            href="/"
          >
            <Plus size={19} className="cursor-pointer" />
          </Link>
          <VerticalIconContainer>
            {navLinks.map((link, i) => (
              <Link
                key={i}
                href={link.href}
                className={cn(
                  'relative flex flex-col items-center justify-center space-y-0.5 cursor-pointer w-full py-2 rounded-lg',
                  link.active
                    ? 'text-black/70 dark:text-white/70 '
                    : 'text-black/60 dark:text-white/60',
                )}
              >
                <div
                  className={cn(
                    link.active && 'bg-light-200/60 dark:bg-dark-200/60',
                    'group rounded-lg transition duration-200 liquid-glass-nav-item',
                  )}
                >
                  <link.icon
                    size={25}
                    className={cn(
                      !link.active && 'group-hover:scale-105',
                      'transition duration:200 m-1.5',
                    )}
                  />
                </div>
                <p
                  className={cn(
                    link.active
                      ? 'text-black/80 dark:text-white/80'
                      : 'text-black/60 dark:text-white/60',
                    'text-[10px]',
                  )}
                >
                  {link.label}
                </p>
              </Link>
            ))}
          </VerticalIconContainer>

          <SettingsButton />
        </div>
      </div>

      <div
        className="fixed bottom-0 w-full z-50 flex flex-row items-center gap-x-6 px-4 py-4 lg:hidden liquid-glass-mobile"
      >
        {navLinks.map((link, i) => (
          <Link
            href={link.href}
            key={i}
            className={cn(
              'relative flex flex-col items-center space-y-1 text-center w-full',
              link.active
                ? 'text-black dark:text-white'
                : 'text-black dark:text-white/70',
            )}
          >
            {link.active && (
              <div className="absolute top-0 -mt-4 h-1 w-full rounded-b-lg bg-black dark:bg-white" />
            )}
            <link.icon />
            <p className="text-xs">{link.label}</p>
          </Link>
        ))}
      </div>

      <Layout>{children}</Layout>
    </div>
  );
};

export default Sidebar;
