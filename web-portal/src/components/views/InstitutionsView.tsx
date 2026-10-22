/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * InstitutionsView - Directory of Approved Technical Institutions & Security Deposits
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Building2,
  Search,
  ExternalLink,
  ShieldCheck,
  Award,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export const InstitutionsView: React.FC = () => {
  const { applications, fdrRecords, setSelectedAppId, setActiveSidebarTab } = useApp();
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('ALL');

  const institutions = [
    {
      id: 'inst-1',
      name: 'Delhi Institute of Technology & Science',
      pid: '1-10928371',
      city: 'North Delhi',
      state: 'Delhi',
      region: 'Northern',
      type: 'Unaided - Private',
      sanctionedIntake: 600,
      totalStudents: 2400,
      fdrAmount: '₹ 1.00 Cr',
      fdrStatus: 'ACTIVE',
      eoaStatus: 'UNDER_SCRUTINY',
      sfr: '1:19.3'
    },
    {
      id: 'inst-2',
      name: 'Bangalore College of Engineering',
      pid: '1-14829104',
      city: 'Bangalore Urban',
      state: 'Karnataka',
      region: 'South-Western',
      type: 'Unaided - Private',
      sanctionedIntake: 840,
      totalStudents: 3120,
      fdrAmount: '₹ 1.50 Cr',
      fdrStatus: 'ACTIVE',
      eoaStatus: 'DEFICIENCIES_NOTED',
      sfr: '1:22.6'
    },
    {
      id: 'inst-3',
      name: 'Pune Academy of Technology',
      pid: '1-19827361',
      city: 'Pune',
      state: 'Maharashtra',
      region: 'Western',
      type: 'Autonomous Institute',
      sanctionedIntake: 510,
      totalStudents: 1980,
      fdrAmount: '₹ 1.25 Cr',
      fdrStatus: 'ACTIVE',
      eoaStatus: 'SCRUTINY_CLEARED',
      sfr: '1:17.6'
    },
    {
      id: 'inst-4',
      name: 'National Institute of Engineering & Applied Research',
      pid: '1-10029388',
      city: 'New Delhi',
      state: 'Delhi',
      region: 'Northern',
      type: 'Govt. Aided',
      sanctionedIntake: 480,
      totalStudents: 1920,
      fdrAmount: '₹ 1.00 Cr',
      fdrStatus: 'EXPIRING_SOON',
      eoaStatus: 'UNDER_SCRUTINY',
      sfr: '1:18.5'
    },
    {
      id: 'inst-5',
      name: 'Surya College of Computer Sciences',
      pid: '1-21102983',
      city: 'Chennai',
      state: 'Tamil Nadu',
      region: 'Southern',
      type: 'Unaided - Private',
      sanctionedIntake: 420,
      totalStudents: 1680,
      fdrAmount: '₹ 1.00 Cr',
      fdrStatus: 'UNDER_VERIFICATION',
      eoaStatus: 'SUBMITTED',
      sfr: '1:19.0'
    },
    {
      id: 'inst-6',
      name: 'Heritage Institute of Technology',
      pid: '1-17729104',
      city: 'Kolkata',
      state: 'West Bengal',
      region: 'Eastern',
      type: 'Autonomous - Private',
      sanctionedIntake: 600,
      totalStudents: 2400,
      fdrAmount: '₹ 1.00 Cr',
      fdrStatus: 'MATURED',
      eoaStatus: 'UNDER_SCRUTINY',
      sfr: '1:19.5'
    }
  ];

  const filtered = institutions.filter(inst => {
    const matchesSearch =
      inst.name.toLowerCase().includes(search.toLowerCase()) ||
      inst.pid.toLowerCase().includes(search.toLowerCase()) ||
      inst.city.toLowerCase().includes(search.toLowerCase());
    const matchesRegion = selectedRegion === 'ALL' || inst.region === selectedRegion;
    return matchesSearch && matchesRegion;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Technical Institutions Directory
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Master register of AICTE approved technical universities, colleges, and polytechnics
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
            {filtered.length} Institutions Registered
          </span>
        </div>
      </div>

      {/* Filter Bar & Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search institution name, PID, city..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <select
              value={selectedRegion}
              onChange={e => setSelectedRegion(e.target.value)}
              className="text-xs p-1.5 bg-white border border-slate-300 rounded-md"
            >
              <option value="ALL">All Regions</option>
              <option value="Northern">Northern</option>
              <option value="Southern">Southern</option>
              <option value="Western">Western</option>
              <option value="Eastern">Eastern</option>
              <option value="South-Western">South-Western</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-200">
            <thead className="bg-slate-100/70 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-2.5">Institution & PID</th>
                <th className="px-4 py-2.5">Location & Region</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Sanctioned Intake</th>
                <th className="px-4 py-2.5">SFR</th>
                <th className="px-4 py-2.5">Security Deposit (FDR)</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map(inst => (
                <tr key={inst.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900">{inst.name}</p>
                    <p className="text-[11px] font-mono text-slate-500">PID: {inst.pid}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-800 font-medium">{inst.city}, {inst.state}</p>
                    <p className="text-[10px] text-slate-400">{inst.region} Region</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-medium">{inst.type}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-slate-900">{inst.sanctionedIntake} Seats</span>
                    <span className="text-[10px] text-slate-400 block">{inst.totalStudents} Students</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{inst.sfr}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-blue-900">{inst.fdrAmount}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded block mt-0.5 w-fit ${
                        inst.fdrStatus === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : inst.fdrStatus === 'EXPIRING_SOON'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-cyan-100 text-cyan-900'
                      }`}
                    >
                      {inst.fdrStatus.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setActiveSidebarTab('fdr_records')}
                      className="text-[#1a56db] hover:underline font-bold flex items-center justify-end gap-1 cursor-pointer"
                    >
                      View FDRs <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
