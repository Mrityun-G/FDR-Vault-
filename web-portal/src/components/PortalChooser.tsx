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
import { ShieldCheck, Crown, Smartphone, ArrowRight } from 'lucide-react';

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
  <div className="relative min-h-screen bg-slate-950 overflow-hidden flex flex-col items-center justify-center p-6 text-white font-sans">
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
    {/* Darkens the video so the heading stays readable. */}
    <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-slate-950/75 via-slate-950/45 to-slate-950/75" aria-hidden="true" />

    <motion.div variants={stagger} initial="hidden" animate="show" className="relative w-full max-w-5xl space-y-8">
      <motion.header variants={rise} className="text-center space-y-3">
        <div className="inline-flex items-center gap-3 bg-white/10 ring-1 ring-white/20 rounded-2xl px-4 py-2">
          <AicteLogo size={40} className="w-10 h-10" />
          <div className="text-left">
            <p className="text-sm font-extrabold leading-tight">AICTE</p>
            <p className="text-[11px] text-indigo-100 leading-tight">All India Council for Technical Education</p>
          </div>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Security Deposit & Approvals —{' '}
          <RotatingText items={['Transparent.', 'Secure.', 'Real-time.', 'Paperless.']} className="text-gradient-light" />
        </h1>
        <p className="text-sm text-indigo-100">One live record, three doors. Choose yours.</p>
      </motion.header>

      <div className="grid gap-5 md:grid-cols-3">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <motion.a
              key={c.title}
              href={c.href}
              variants={rise}
              whileHover={{ y: -6 }}
              className="group relative bg-white text-slate-900 rounded-3xl p-6 shadow-2xl shadow-indigo-950/40 overflow-hidden"
            >
              <div className={`absolute inset-x-0 top-0 h-1.5 bg-linear-to-r ${c.grad}`} />
              <span className={`w-12 h-12 rounded-2xl bg-linear-to-br ${c.grad} text-white flex items-center justify-center shadow-lg`}>
                <Icon className="w-6 h-6" />
              </span>
              <h2 className="mt-4 text-lg font-extrabold">{c.title}</h2>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{c.who}</p>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">{c.text}</p>
              <p className="mt-4 text-xs font-bold text-indigo-700 flex items-center gap-1">
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
