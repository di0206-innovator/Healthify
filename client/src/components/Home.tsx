import { useState } from 'react';
import Scanner from './Scanner';
import ReportCard from './ReportCard';
import type { ScanReport } from '../types';

export default function Home() {
  const [report, setReport] = useState<ScanReport | null>(null);

  const handleReportReady = (newReport: ScanReport) => {
    setReport(newReport);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScanAgain = () => {
    setReport(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="animate-fade-in">
      {report ? (
        <ReportCard report={report} onScanAgain={handleScanAgain} />
      ) : (
        <Scanner onReportReady={handleReportReady} />
      )}
    </div>
  );
}
