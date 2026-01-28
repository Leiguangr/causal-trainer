'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DistributionData {
  distribution: Record<string, Record<string, Record<string, number>>>;
  levelTotals: Record<string, Record<string, number>>;
  grandTotal: Record<string, number>;
  L2_FAMILIES: Record<string, { name: string; types: string[] }>;
  L1_TYPE_NAMES: Record<string, string>;
  L2_TYPE_NAMES: Record<string, string>;
  L3_FAMILY_NAMES: Record<string, string>;
}

export default function DistributionPage() {
  const [data, setData] = useState<DistributionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'L1' | 'L2' | 'L3'>('L2');

  useEffect(() => {
    fetchDistribution();
  }, []);

  const fetchDistribution = async () => {
    try {
      const res = await fetch('/api/admin/distribution');
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to fetch distribution:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Loading distribution...</h1>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6 text-red-400">Failed to load distribution</h1>
        </div>
      </div>
    );
  }

  const renderL1Table = () => {
    const wolfTypes = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10'];
    const sheepTypes = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];
    const dist = data.distribution.L1 || {};

    const renderRow = (code: string, name: string) => {
      const d = dist[code] || { Easy: 0, Medium: 0, Hard: 0, Total: 0 };
      return (
        <tr key={code} className="border-b border-gray-700 hover:bg-gray-800">
          <td className="py-2 px-4 font-mono">{code}: {name}</td>
          <td className="py-2 px-4 text-center">{d.Easy}</td>
          <td className="py-2 px-4 text-center">{d.Medium}</td>
          <td className="py-2 px-4 text-center">{d.Hard}</td>
          <td className="py-2 px-4 text-center font-semibold">{d.Total}</td>
        </tr>
      );
    };

    const wolfTotal = wolfTypes.reduce((acc, code) => {
      const d = dist[code] || { Easy: 0, Medium: 0, Hard: 0, Total: 0 };
      return { Easy: acc.Easy + d.Easy, Medium: acc.Medium + d.Medium, Hard: acc.Hard + d.Hard, Total: acc.Total + d.Total };
    }, { Easy: 0, Medium: 0, Hard: 0, Total: 0 });

    const sheepTotal = sheepTypes.reduce((acc, code) => {
      const d = dist[code] || { Easy: 0, Medium: 0, Hard: 0, Total: 0 };
      return { Easy: acc.Easy + d.Easy, Medium: acc.Medium + d.Medium, Hard: acc.Hard + d.Hard, Total: acc.Total + d.Total };
    }, { Easy: 0, Medium: 0, Hard: 0, Total: 0 });

    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-800 text-left">
            <th className="py-3 px-4">Type</th>
            <th className="py-3 px-4 text-center">Easy</th>
            <th className="py-3 px-4 text-center">Medium</th>
            <th className="py-3 px-4 text-center">Hard</th>
            <th className="py-3 px-4 text-center">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-red-900/30">
            <td colSpan={5} className="py-2 px-4 font-bold">WOLF Types (NO - Invalid Claims)</td>
          </tr>
          {wolfTypes.map(code => renderRow(code, data.L1_TYPE_NAMES[code]))}
          <tr className="bg-gray-700 font-semibold">
            <td className="py-2 px-4 italic">Subtotal (WOLF)</td>
            <td className="py-2 px-4 text-center">{wolfTotal.Easy}</td>
            <td className="py-2 px-4 text-center">{wolfTotal.Medium}</td>
            <td className="py-2 px-4 text-center">{wolfTotal.Hard}</td>
            <td className="py-2 px-4 text-center">{wolfTotal.Total}</td>
          </tr>
          <tr className="bg-green-900/30">
            <td colSpan={5} className="py-2 px-4 font-bold">SHEEP Types (YES - Valid Claims)</td>
          </tr>
          {sheepTypes.map(code => renderRow(code, data.L1_TYPE_NAMES[code]))}
          <tr className="bg-gray-700 font-semibold">
            <td className="py-2 px-4 italic">Subtotal (SHEEP)</td>
            <td className="py-2 px-4 text-center">{sheepTotal.Easy}</td>
            <td className="py-2 px-4 text-center">{sheepTotal.Medium}</td>
            <td className="py-2 px-4 text-center">{sheepTotal.Hard}</td>
            <td className="py-2 px-4 text-center">{sheepTotal.Total}</td>
          </tr>
          <tr className="bg-blue-900/50 font-bold">
            <td className="py-3 px-4">Total L1</td>
            <td className="py-3 px-4 text-center">{data.levelTotals.L1?.Easy || 0}</td>
            <td className="py-3 px-4 text-center">{data.levelTotals.L1?.Medium || 0}</td>
            <td className="py-3 px-4 text-center">{data.levelTotals.L1?.Hard || 0}</td>
            <td className="py-3 px-4 text-center">{data.levelTotals.L1?.Total || 0}</td>
          </tr>
        </tbody>
      </table>
    );
  };

  const renderL2Table = () => {
    const dist = data.distribution.L2 || {};

    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-800 text-left">
            <th className="py-3 px-4">Family / Type</th>
            <th className="py-3 px-4 text-center">Easy</th>
            <th className="py-3 px-4 text-center">Medium</th>
            <th className="py-3 px-4 text-center">Hard</th>
            <th className="py-3 px-4 text-center">Total</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.L2_FAMILIES).map(([familyId, family]) => {
            const familyTotal = family.types.reduce((acc, code) => {
              const d = dist[code] || { Easy: 0, Medium: 0, Hard: 0, Total: 0 };
              return { Easy: acc.Easy + d.Easy, Medium: acc.Medium + d.Medium, Hard: acc.Hard + d.Hard, Total: acc.Total + d.Total };
            }, { Easy: 0, Medium: 0, Hard: 0, Total: 0 });

            return (
              <>
                <tr key={familyId} className="bg-purple-900/30">
                  <td colSpan={5} className="py-2 px-4 font-bold">{familyId}: {family.name}</td>
                </tr>
                {family.types.map(code => {
                  const d = dist[code] || { Easy: 0, Medium: 0, Hard: 0, Total: 0 };
                  return (
                    <tr key={code} className="border-b border-gray-700 hover:bg-gray-800">
                      <td className="py-2 px-4 pl-8 font-mono">{code}: {data.L2_TYPE_NAMES[code]}</td>
                      <td className="py-2 px-4 text-center">{d.Easy}</td>
                      <td className="py-2 px-4 text-center">{d.Medium}</td>
                      <td className="py-2 px-4 text-center">{d.Hard}</td>
                      <td className="py-2 px-4 text-center font-semibold">{d.Total}</td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-700/50 font-semibold text-gray-300">
                  <td className="py-2 px-4 italic">Subtotal</td>
                  <td className="py-2 px-4 text-center">{familyTotal.Easy}</td>
                  <td className="py-2 px-4 text-center">{familyTotal.Medium}</td>
                  <td className="py-2 px-4 text-center">{familyTotal.Hard}</td>
                  <td className="py-2 px-4 text-center">{familyTotal.Total}</td>
                </tr>
              </>
            );
          })}
          <tr className="bg-blue-900/50 font-bold">
            <td className="py-3 px-4">Total L2</td>
            <td className="py-3 px-4 text-center">{data.levelTotals.L2?.Easy || 0}</td>
            <td className="py-3 px-4 text-center">{data.levelTotals.L2?.Medium || 0}</td>
            <td className="py-3 px-4 text-center">{data.levelTotals.L2?.Hard || 0}</td>
            <td className="py-3 px-4 text-center">{data.levelTotals.L2?.Total || 0}</td>
          </tr>
        </tbody>
      </table>
    );
  };

  const renderL3Table = () => {
    const families = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'];
    const dist = data.distribution.L3 || {};

    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-800 text-left">
            <th className="py-3 px-4">Family</th>
            <th className="py-3 px-4 text-center">Easy</th>
            <th className="py-3 px-4 text-center">Medium</th>
            <th className="py-3 px-4 text-center">Hard</th>
            <th className="py-3 px-4 text-center">Total</th>
          </tr>
        </thead>
        <tbody>
          {families.map(code => {
            const d = dist[code] || { Easy: 0, Medium: 0, Hard: 0, Total: 0 };
            return (
              <tr key={code} className="border-b border-gray-700 hover:bg-gray-800">
                <td className="py-2 px-4 font-mono">{code}: {data.L3_FAMILY_NAMES[code]}</td>
                <td className="py-2 px-4 text-center">{d.Easy}</td>
                <td className="py-2 px-4 text-center">{d.Medium}</td>
                <td className="py-2 px-4 text-center">{d.Hard}</td>
                <td className="py-2 px-4 text-center font-semibold">{d.Total}</td>
              </tr>
            );
          })}
          <tr className="bg-blue-900/50 font-bold">
            <td className="py-3 px-4">Total L3</td>
            <td className="py-3 px-4 text-center">{data.levelTotals.L3?.Easy || 0}</td>
            <td className="py-3 px-4 text-center">{data.levelTotals.L3?.Medium || 0}</td>
            <td className="py-3 px-4 text-center">{data.levelTotals.L3?.Hard || 0}</td>
            <td className="py-3 px-4 text-center">{data.levelTotals.L3?.Total || 0}</td>
          </tr>
        </tbody>
      </table>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Case Distribution</h1>
            <p className="text-gray-400">T³ Causal Reasoning Benchmark - CS372 Assignment 2</p>
          </div>
          <Link 
            href="/admin/validate" 
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            ← Back to Validation
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-blue-400">{data.grandTotal.Total}</div>
            <div className="text-gray-400">Total Cases</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-green-400">{data.grandTotal.Easy}</div>
            <div className="text-gray-400">Easy ({((data.grandTotal.Easy / data.grandTotal.Total) * 100).toFixed(1)}%)</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-yellow-400">{data.grandTotal.Medium}</div>
            <div className="text-gray-400">Medium ({((data.grandTotal.Medium / data.grandTotal.Total) * 100).toFixed(1)}%)</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-red-400">{data.grandTotal.Hard}</div>
            <div className="text-gray-400">Hard ({((data.grandTotal.Hard / data.grandTotal.Total) * 100).toFixed(1)}%)</div>
          </div>
        </div>

        {/* Level Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-cyan-500">
            <div className="text-2xl font-bold">{data.levelTotals.L1?.Total || 0}</div>
            <div className="text-gray-400">L1 Association ({((data.levelTotals.L1?.Total || 0) / data.grandTotal.Total * 100).toFixed(1)}%)</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-orange-500">
            <div className="text-2xl font-bold">{data.levelTotals.L2?.Total || 0}</div>
            <div className="text-gray-400">L2 Intervention ({((data.levelTotals.L2?.Total || 0) / data.grandTotal.Total * 100).toFixed(1)}%)</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-purple-500">
            <div className="text-2xl font-bold">{data.levelTotals.L3?.Total || 0}</div>
            <div className="text-gray-400">L3 Counterfactual ({((data.levelTotals.L3?.Total || 0) / data.grandTotal.Total * 100).toFixed(1)}%)</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-4">
          {(['L1', 'L2', 'L3'] as const).map(level => (
            <button
              key={level}
              onClick={() => setActiveTab(level)}
              className={`px-6 py-2 rounded-lg font-semibold transition ${
                activeTab === level 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {level} - {level === 'L1' ? 'Association' : level === 'L2' ? 'Intervention' : 'Counterfactual'}
            </button>
          ))}
        </div>

        {/* Distribution Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {activeTab === 'L1' && renderL1Table()}
          {activeTab === 'L2' && renderL2Table()}
          {activeTab === 'L3' && renderL3Table()}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          Target Distribution: L1:L2:L3 = 10:60:30 (17:102:51 for 170 cases)
        </div>
      </div>
    </div>
  );
}
