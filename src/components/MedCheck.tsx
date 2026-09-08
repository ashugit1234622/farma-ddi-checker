'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Camera, Loader2, CheckCircle2, AlertTriangle, Info, ScanBarcode, ChevronLeft } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

type ScanState = 'idle' | 'camera_active' | 'processing' | 'identifying' | 'result' | 'error';

interface MedCheckResult {
  medicineName?: string;
  brandName?: string;
  genericName?: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  classification?: 'Generic' | 'Branded' | 'Branded Generic' | 'Unable to Verify';
  confidence?: 'High' | 'Medium' | 'Low' | 'Unable to Verify';
  summary?: string;
  error?: string;
}

export default function MedCheck({ onClose }: { onClose: () => void }) {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  const [barcode, setBarcode] = useState<string>('');
  const [result, setResult] = useState<MedCheckResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    // Detect mobile for camera toggle feature
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error("Error stopping camera", err);
      }
    }
  };

  const startCamera = async () => {
    try {
      setScanState('camera_active');
      // Adding a small delay to allow UI to render the #reader div
      setTimeout(async () => {
        scannerRef.current = new Html5Qrcode("medcheck-reader", {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.DATA_MATRIX
          ]
        });
        await scannerRef.current.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          (decodedText) => {
            stopCamera();
            handleBarcodeDetected(decodedText);
          },
          (errorMessage) => {
            // Ignore ongoing scan errors (like "no barcode found in frame")
          }
        );
      }, 100);
    } catch (err) {
      console.error(err);
      setScanState('idle');
      setErrorMsg("Camera access denied or unavailable.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setScanState('processing');
      
      try {
        const html5QrCode = new Html5Qrcode("medcheck-reader-hidden");
        const decodedText = await html5QrCode.scanFile(file, true);
        handleBarcodeDetected(decodedText);
      } catch (err) {
        setScanState('error');
        setErrorMsg("Could not detect a barcode in the image. Please try a clearer picture.");
      }
    }
  };

  const handleBarcodeDetected = async (code: string) => {
    setBarcode(code);
    setScanState('identifying');
    setErrorMsg('');
    
    try {
      const res = await fetch('/api/medcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: code })
      });
      
      const data = await res.json();
      
      if (!res.ok || data.error) {
        setScanState('error');
        setErrorMsg(data.error || "Failed to identify medicine from barcode.");
        setResult(data);
        return;
      }

      setResult(data);
      setScanState('result');
    } catch (err) {
      setScanState('error');
      setErrorMsg("Network error occurred while verifying medicine.");
    }
  };

  const resetScanner = () => {
    setScanState('idle');
    setResult(null);
    setBarcode('');
    setErrorMsg('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (fileInputRef.current) {
        fileInputRef.current.files = e.dataTransfer.files;
        // manually trigger change event logic
        const event = { target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleFileUpload(event);
      }
    }
  };

  return (
    <div className="medcheck-overlay">
      <div className="medcheck-container">
        {/* Header */}
        <div className="medcheck-header">
          <div className="medcheck-title">
            <ScanBarcode size={24} style={{ color: 'var(--accent-primary)' }} />
            <h2>MedCheck</h2>
          </div>
          <button className="medcheck-close" onClick={onClose} aria-label="Close MedCheck">
            <X size={24} />
          </button>
        </div>

        {/* Hidden div for file scanning */}
        <div id="medcheck-reader-hidden" style={{ display: 'none' }}></div>

        {/* Content Area */}
        <div className="medcheck-content">
          
          {(scanState === 'idle' || scanState === 'camera_active' || scanState === 'processing') && (
            <div className="medcheck-scan-view">
              <p className="medcheck-instruction">
                Scan a medicine barcode or QR code to verify its identity and classification.
              </p>

              {scanState === 'camera_active' ? (
                <div className="medcheck-squircle camera-active">
                  <div id="medcheck-reader" className="camera-frame"></div>
                  <div className="scan-overlay">
                    <div className="scan-line"></div>
                  </div>
                </div>
              ) : (
                <div 
                  className="medcheck-squircle" 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  {scanState === 'processing' ? (
                    <div className="squircle-content">
                      <Loader2 size={48} className="icon-spin text-accent" />
                      <span>Extracting Barcode...</span>
                    </div>
                  ) : (
                    <div className="squircle-content">
                      <Upload size={48} className="text-muted mb-2" />
                      <span style={{ fontWeight: 500 }}>Upload Barcode Image</span>
                      <span className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                        {isMobile ? 'Tap to choose photo' : 'Drag & drop or click to browse'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileUpload}
              />

              {/* Mobile Camera Toggle */}
              {isMobile && scanState === 'idle' && (
                <button className="btn btn-primary btn-full" onClick={startCamera} style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <Camera size={20} />
                  Live Camera Scan
                </button>
              )}
              
              {scanState === 'camera_active' && (
                <button className="btn btn-secondary btn-full" onClick={() => { stopCamera(); setScanState('idle'); }} style={{ marginTop: '1.5rem' }}>
                  Cancel Camera
                </button>
              )}
            </div>
          )}

          {scanState === 'identifying' && (
            <div className="medcheck-identifying">
              <div className="identifying-pulse">
                <ScanBarcode size={64} className="text-accent" />
                <div className="pulse-ring"></div>
              </div>
              <h3>Searching Medicine Databases</h3>
              <p className="text-muted">Resolving identifier: <strong>{barcode}</strong></p>
            </div>
          )}

          {scanState === 'error' && (
            <div className="medcheck-result-card error">
              <div className="result-header">
                <AlertTriangle size={32} style={{ color: 'var(--danger)' }} />
                <h3>Medicine could not be reliably verified</h3>
              </div>
              <div className="result-body">
                <p>{errorMsg}</p>
                {barcode && (
                  <div className="result-field mt-3">
                    <span className="field-label">Scanned Identifier</span>
                    <span className="field-value" style={{ fontFamily: 'monospace' }}>{barcode}</span>
                  </div>
                )}
              </div>
              <div className="result-actions">
                <button className="btn btn-primary" onClick={resetScanner}>Scan Again</button>
              </div>
            </div>
          )}

          {scanState === 'result' && result && (
            <div className="medcheck-result-card">
              <div className="result-top">
                <div className="result-badge success">
                  <CheckCircle2 size={16} /> Verified Product
                </div>
                {result.confidence && (
                  <div className={`confidence-badge confidence-${result.confidence.toLowerCase()}`}>
                    Confidence: {result.confidence}
                  </div>
                )}
              </div>

              <div className="result-hero">
                <h2 className="medicine-name">{result.medicineName || result.brandName || "Unknown Medicine"}</h2>
                {result.genericName && result.genericName !== result.medicineName && (
                  <div className="medicine-generic">{result.genericName}</div>
                )}
              </div>

              <div className="result-grid">
                <div className="result-field">
                  <span className="field-label">Active Ingredient</span>
                  <span className="field-value">{result.genericName || "Not available"}</span>
                </div>
                <div className="result-field">
                  <span className="field-label">Classification</span>
                  <span className="field-value fw-600">{result.classification || "Unable to Verify"}</span>
                </div>
                <div className="result-field">
                  <span className="field-label">Strength</span>
                  <span className="field-value">{result.strength || "Not available"}</span>
                </div>
                <div className="result-field">
                  <span className="field-label">Dosage Form</span>
                  <span className="field-value">{result.dosageForm || "Not available"}</span>
                </div>
                <div className="result-field">
                  <span className="field-label">Manufacturer</span>
                  <span className="field-value">{result.manufacturer || "Not available"}</span>
                </div>
                <div className="result-field">
                  <span className="field-label">Identifier (NDC/UPC)</span>
                  <span className="field-value" style={{ fontFamily: 'monospace' }}>{barcode}</span>
                </div>
              </div>

              <div className="ai-summary-box">
                <div className="ai-summary-header">
                  <Info size={16} className="text-accent" />
                  <span>AI Summary of Verified Data</span>
                </div>
                <p className="ai-summary-text">{result.summary || "No summary available."}</p>
              </div>

              <div className="result-actions">
                <button className="btn btn-secondary" onClick={resetScanner}>
                  <ChevronLeft size={18} /> Scan Another
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
