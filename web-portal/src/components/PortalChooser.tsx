/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Root page of the staff site: links to the Officer portal, the Admin console and the institution app.
 */

import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { AicteLogo } from './AicteLogo';
import { RotatingText, rise, stagger } from './fx';
import { PORTALS, portalUrl } from '../lib/portal';
import { INSTITUTION_APP_URL } from '../lib/api';
import { ShieldCheck, Crown, Smartphone, ArrowRight, CheckCircle2 } from 'lucide-react';

const highlights = [
  'Bank-confirmed FDR liens, renewals and releases',
  'AI checks every uploaded document against the rules',
  'Live status and deficiency notices — no letters, no visits',
  'A full audit trail of every decision'
];

const cards = [
  {
    href: portalUrl(PORTALS.officer),
    title: 'Officer Portal',
    who: 'Scrutiny officers · Bank officials',
    text: 'Review applications and documents, issue deficiency notices, recommend approval, endorse FDR liens.',
    icon: ShieldCheck,
    grad: 'from-indigo-500 via-violet-500 to-fuchsia-500',
    path: PORTALS.officer.path
  },
  {
    href: portalUrl(PORTALS.admin),
    title: 'Admin Console',
    who: 'AICTE administrators',
    text: 'Final approvals and EoA letters, FDR renewal / release decisions, staff and institution accounts.',
    icon: Crown,
    grad: 'from-rose-500 via-orange-500 to-amber-400',
    path: PORTALS.admin.path
  },
  {
    href: INSTITUTION_APP_URL,
    title: 'Institution App',
    who: 'Technical institutions',
    text: 'Submit applications, upload documents and FDRs, answer deficiency notices — on the phone or web.',
    icon: Smartphone,
    grad: 'from-emerald-500 via-teal-500 to-cyan-500',
    path: INSTITUTION_APP_URL.replace(/^https?:\/\//, '')
  }
];

const VIDEO = `${import.meta.env.BASE_URL}portal-bg.mp4`;
const POSTER = `${import.meta.env.BASE_URL}portal-bg-poster.jpg`;

export const PortalChooser: React.FC = () => {
  const video = useRef<HTMLVideoElement>(null);
  // Background video, muted and looping. With "reduce motion" it stays on its first frame (the poster).
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => { if (mq.matches) v.pause(); else v.play().catch(() => {}); };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return (
  <div className="relative min-h-screen bg-slate-950 overflow-hidden flex flex-col items-center p-6 text-white font-sans">
    <video
      ref={video}
      className="pointer-events-none absolute inset-0 w-full h-full object-cover"
      src={VIDEO}
      poster={POSTER}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
    />
    {/* Darkens the heading (left) and the portals (right) on wide screens, top and bottom on phones. */}
    <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-slate-950/80 via-slate-950/30 to-slate-950/85 lg:bg-linear-to-r lg:from-slate-950/85 lg:via-slate-950/35 lg:to-slate-950/75" aria-hidden="true" />

    {/* Heading on the left, the three portals stacked on the right; stacked one under the other on phones. */}
    <motion.div variants={stagger} initial="hidden" animate="show" className="relative w-full max-w-6xl flex-1 flex flex-col lg:flex-row lg:items-center justify-between gap-10 py-4 sm:py-8">
      <motion.header variants={rise} className="lg:flex-1 lg:max-w-xl text-center lg:text-left space-y-4 drop-shadow-[0_2px_8px_rgba(2,6,23,0.6)]">
        <div className="inline-flex items-center gap-3 bg-white/10 ring-1 ring-white/20 rounded-2xl px-4 py-2">
          <AicteLogo size={40} className="w-10 h-10" />
          <div className="text-left">
            <p className="text-sm font-extrabold leading-tight">AICTE</p>
            <p className="text-[11px] text-indigo-100 leading-tight">All India Council for Technical Education</p>
          </div>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
          Security Deposit & Approvals —{' '}
          <RotatingText items={['Transparent.', 'Secure.', 'Real-time.', 'Paperless.']} className="text-gradient-light" />
        </h1>
        <p className="text-sm sm:text-base text-indigo-100 leading-relaxed">
          From the first application to the Extension of Approval letter, every Fixed Deposit Receipt and every
          scrutiny step lives in one shared record — seen the same way by the institution, the AICTE officer and the bank.
        </p>
        <ul className="space-y-2 text-sm text-white/90 inline-block text-left">
          {highlights.map(h => (
            <li key={h} className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-300" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm font-semibold text-indigo-100">One live record, three doors. Choose yours.</p>
      </motion.header>

      {/* Frosted-glass cards stacked down the right side: the video shows through. */}
      <div className="grid gap-4 w-full lg:w-[26rem] lg:shrink-0">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <motion.a
              key={c.title}
              href={c.href}
              variants={rise}
              whileHover={{ y: -6 }}
              className="group relative h-full flex flex-col rounded-2xl p-5 bg-white/10 backdrop-blur-md ring-1 ring-white/25 shadow-xl shadow-slate-950/30 overflow-hidden transition-colors hover:bg-white/20"
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${c.grad}`} />
              <div className="flex items-center gap-3">
                <span className={`shrink-0 w-11 h-11 rounded-xl bg-linear-to-br ${c.grad} text-white flex items-center justify-center shadow-lg`}>
                  <Icon className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-extrabold leading-tight">{c.title}</h2>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/70 truncate">{c.who}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-white/85 leading-relaxed">{c.text}</p>
              <p className="mt-auto pt-4 text-xs font-bold text-white flex items-center gap-1">
                <span className="font-mono truncate">{c.path}</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </p>
            </motion.a>
          );
        })}
      </div>
    </motion.div>
  </div>
  );
};
