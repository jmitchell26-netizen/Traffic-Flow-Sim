/**
 * ExportButton Component
 * 
 * Button and modal for exporting traffic data in various formats.
 */

import { useState } from 'react';
import { Download, FileText, FileJson, File, Loader2 } from 'lucide-react';
import { useTrafficStore } from '../../stores/trafficStore';

export function ExportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [format, setFormat] = useState<'csv' | 'json' | 'pdf'>('csv');
  const trafficData = useTrafficStore((s) => s.trafficData);
  const getBoundingBox = useTrafficStore((s) => s.getBoundingBox);

  const handleExport = async () => {
    if (!trafficData || !trafficData.segments || trafficData.segments.length === 0) {
      alert('No traffic data available to export. Please load traffic data first.');
      return;
    }

    setIsExporting(true);
    try {
      const bbox = getBoundingBox();
      
      // Validate bounding box
      if (isNaN(bbox.north) || isNaN(bbox.south) || isNaN(bbox.east) || isNaN(bbox.west)) {
        throw new Error('Invalid map bounds');
      }
      
      // Create URL with query params
      const params = new URLSearchParams({
        format,
        north: bbox.north.toString(),
        south: bbox.south.toString(),
        east: bbox.east.toString(),
        west: bbox.west.toString(),
      });

      // Make POST request with query params
      const response = await fetch(`/api/traffic/export?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Export failed: ${response.status}`);
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `traffic_data_${new Date().toISOString().split('T')[0]}.${format}`;

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setIsOpen(false);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const formatOptions = [
    { value: 'csv' as const, label: 'CSV', icon: FileText, description: 'For Excel/spreadsheets' },
    { value: 'json' as const, label: 'JSON', icon: FileJson, description: 'For developers/APIs' },
    { value: 'pdf' as const, label: 'PDF', icon: File, description: 'For reports' },
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-dash-accent text-white rounded-lg hover:bg-dash-accent/90 transition-colors"
        title="Export data"
      >
        <Download className="w-4 h-4" />
        <span>Export</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-dash-card border border-dash-border rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-dash-text mb-4">Export Traffic Data</h3>
            
            <div className="space-y-3 mb-6">
              {formatOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setFormat(option.value)}
                    className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                      format === option.value
                        ? 'border-dash-accent bg-dash-accent/10'
                        : 'border-dash-border hover:border-dash-accent/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-dash-accent" />
                      <div className="flex-1">
                        <div className="font-medium text-dash-text">{option.label}</div>
                        <div className="text-xs text-dash-muted">{option.description}</div>
                      </div>
                      {format === option.value && (
                        <div className="w-2 h-2 rounded-full bg-dash-accent" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-dash-muted mb-6">
              Exporting {trafficData?.total_segments ?? 0} segments from current view
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsOpen(false)}
                disabled={isExporting}
                className="flex-1 px-4 py-2 border border-dash-border rounded-lg text-dash-text hover:bg-dash-border transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting || !trafficData}
                className="flex-1 px-4 py-2 bg-dash-accent text-white rounded-lg hover:bg-dash-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Export
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

