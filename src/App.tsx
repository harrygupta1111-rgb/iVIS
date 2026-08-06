import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  FileText,
  Search,
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  Clock,
  Printer,
  ShieldAlert,
  Menu,
  Minimize,
  Maximize,
  X,
  Play,
  BookOpen,
  Notebook,
  Info,
  Compass,
  Wrench,
  Hammer,
  Package,
  ClipboardList,
  Image,
  Network
} from 'lucide-react';
import { RefreshCw } from 'lucide-react';
import { ManualPage, DocumentSection } from './data';
import { EngineeringDiagram } from './components/EngineeringDiagram';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore: Vite-style worker URL import
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Volume2, Plus, Minus } from "lucide-react";

// Asset URLs via Vite's import meta URL to ensure correct production paths
const logoImg = new URL('./assets/images/logo-1.png', import.meta.url).href;
const logoWebp = new URL('./assets/images/logo.webp', import.meta.url).href;
const phoneImg = new URL('./assets/images/phone.webp', import.meta.url).href;
const headerBg = new URL('./assets/images/header.webp', import.meta.url).href;
const voiceWebp = new URL('./assets/images/voice.webp', import.meta.url).href;
const irisImg = new URL('./assets/images/iVIS.png', import.meta.url).href;


// Configure the worker to use the local module via Vite's URL handling for deployment stability
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// PDF mappings and document structure are loaded at runtime from
// `src/assets/config/documents.xml` and PDF files under `src/assets/pdf/`.

interface PdfPageRendererProps {
  pdfDoc: any;
  pageNumber: number;
  activeSearchTerm?: string;
  activeMatchIndexOnPage?: number;
  width: number;
  padding: number;
  onHighlightFound?: (
    pageNumber: number,
    rect: { x: number; y: number; w: number; h: number }
  ) => void;
}

const PdfPageRenderer: React.FC<PdfPageRendererProps> = ({
  pdfDoc,
  pageNumber,
  activeSearchTerm,
  activeMatchIndexOnPage = -1,
  width,
  padding,
  onHighlightFound
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [renderError, setRenderError] = useState<string>('');
  const [highlights, setHighlights] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (!isMounted) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const originalViewport = page.getViewport({ scale: 1 });
        // Fixed 100% view: target width equals available width minus padding
        const targetWidth = width - padding;
        const scale = targetWidth / originalViewport.width;

        // Render at device pixel ratio to keep canvas crisp on high-DPI displays
        const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
        const cssViewport = page.getViewport({ scale: scale });
        const renderViewport = page.getViewport({ scale: scale * dpr });

        // Use higher-resolution backing store while keeping CSS size equal to logical viewport
        canvas.width = Math.round(renderViewport.width);
        canvas.height = Math.round(renderViewport.height);
        canvas.style.width = `${Math.round(cssViewport.width)}px`;
        canvas.style.height = `${Math.round(cssViewport.height)}px`;

        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const renderContext = {
          canvasContext: ctx,
          viewport: renderViewport
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        if (!isMounted) return;

        if (activeSearchTerm && activeSearchTerm.trim().length > 0) {
          const textContent = await page.getTextContent();
          if (!isMounted) return;

          const query = activeSearchTerm.toLowerCase().trim();
          const items: any[] = textContent.items;
          const matchedHighlights: { x: number; y: number; w: number; h: number }[] = [];

          items.forEach(item => {
            // Skip items with no renderable string
            if (!item.str || item.str.trim() === '') return;

            const itemStrLower = item.str.toLowerCase();
            let searchFrom = 0;

            while (true) {
              const matchIdx = itemStrLower.indexOf(query, searchFrom);
              if (matchIdx === -1) break;

              // --- Pixel-perfect coordinate mapping via PDF.js viewport transform ---
              // item.transform = [scaleX, skewY, skewX, scaleY, translateX, translateY]
              // translateX/Y are in PDF user-space units (origin bottom-left).
              // cssViewport.convertToViewportPoint maps them to CSS pixels (origin top-left).
              const [tx, ty] = cssViewport.convertToViewportPoint(
                item.transform[4],
                item.transform[5]
              );

              // Rendered glyph height in CSS pixels: use the absolute scale of the transform
              const pdfFontSize = Math.abs(item.transform[3] || item.transform[0] || 12);
              const glyphH = pdfFontSize * scale;

              // Item's total rendered width in PDF user-space units
              const itemRenderedWidth = item.width ?? 0;
              const itemTotalChars = item.str.length;

              // Per-character width in CSS pixels
              const charWidthPx = itemTotalChars > 0
                ? (itemRenderedWidth * scale) / itemTotalChars
                : 0;

              // Horizontal offset to the start of the match (in CSS pixels)
              const matchOffsetPx = matchIdx * charWidthPx;
              const matchWidthPx = Math.max(query.length * charWidthPx, 4);

              // tx,ty from convertToViewportPoint give the baseline origin (bottom-left of glyph).
              // The highlight box top is at (ty - glyphH) in CSS top-left coordinates.
              const rect = {
                x: tx + matchOffsetPx,
                y: ty - glyphH,
                w: matchWidthPx,
                h: glyphH
              };

              matchedHighlights.push(rect);

              // Only notify the caller about the active match so scrolling targets the right spot
              if (matchedHighlights.length - 1 === activeMatchIndexOnPage && onHighlightFound) {
                onHighlightFound(pageNumber, rect);
              }

              searchFrom = matchIdx + query.length;
            }
          });

          setHighlights(matchedHighlights);
        } else {
          setHighlights([]);
        }
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Error rendering PDF page:', err);
          if (isMounted) {
            setRenderError(err.message || 'Page render error');
          }
        }
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, pageNumber, activeSearchTerm, activeMatchIndexOnPage, width, padding]);

  return (
    <div className="relative w-full h-full flex justify-center items-center overflow-hidden">
      {renderError ? (
        <div className="text-red-500 text-xs font-semibold p-4 text-center">
          Failed to render page: {renderError}
        </div>
      ) : (
        <div className="relative inline-block w-full h-full">
          <canvas ref={canvasRef} className="block w-full h-auto select-none rounded-sm" />
          {highlights.map((hl, index) => {
            const isCurrentlySelected = index === activeMatchIndexOnPage;
            return (
              <div
                key={index}
                className={`absolute rounded-sm pointer-events-none ${isCurrentlySelected
                  ? 'bg-orange-400/100'
                  : 'bg-yellow-500/50'
                  }`}
                style={{
                  mixBlendMode: 'multiply',
                  left: `${hl.x}px`,
                  top: `${hl.y}px`,
                  width: `${hl.w}px`,
                  height: `${hl.h}px`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

// Zoom removed: fixed 100% view

const pageVariants = {
  initial: (custom: any) => {
    const dir = typeof custom === 'object' ? custom.direction : custom;
    const isDragging = typeof custom === 'object' ? custom.isDraggingSlider : false;
    return {
      opacity: isDragging ? 1 : 0,
      x: isDragging ? 0 : (dir === 'next' ? 60 : -60),
      rotateY: isDragging ? 0 : (dir === 'next' ? 8 : -8),
      scale: isDragging ? 1 : 0.98,
    };
  },
  animate: (custom: any) => {
    const isDragging = typeof custom === 'object' ? custom.isDraggingSlider : false;
    return {
      opacity: 1,
      x: 0,
      rotateY: 0,
      scale: 1,
      transition: {
        duration: isDragging ? 0 : 0.22,
        ease: [0.25, 1, 0.5, 1], // fluid easeOutQuart
      }
    };
  },
  exit: (custom: any) => {
    const dir = typeof custom === 'object' ? custom.direction : custom;
    const isDragging = typeof custom === 'object' ? custom.isDraggingSlider : false;
    return {
      opacity: isDragging ? 1 : 0,
      x: isDragging ? 0 : (dir === 'next' ? -60 : 60),
      rotateY: isDragging ? 0 : (dir === 'next' ? -8 : 8),
      scale: isDragging ? 1 : 0.98,
      transition: {
        duration: isDragging ? 0 : 0.22,
        ease: [0.25, 1, 0.5, 1],
      }
    };
  }
};

export default function App() {
  // Global Navigation State

  const [showMainApp, setShowMainApp] = useState<boolean>(false);
  const [activeManualId, setActiveManualId] = useState<string>('');
  const [documentStructure, setDocumentStructure] = useState<DocumentSection[]>([]);
  const [xmlDocument, setXmlDocument] = useState<Document | null>(null);
  const [manualsInfo, setManualsInfo] = useState<Record<string, { title: string; pagesCount: number; startPage: number }>>({});
  const navPanelRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const bottomTrackRef = useRef<HTMLDivElement | null>(null);
  const lowerStatusRef = useRef<HTMLDivElement | null>(null);
  const [speechVolume, setSpeechVolume] = useState(1.0);
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [showVoicePopup, setShowVoicePopup] = useState(false);
  const [focusedVoiceIndex, setFocusedVoiceIndex] = useState(-1);
  const voicePopupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const voiceButtonRef = useRef<HTMLButtonElement | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [totalPages, setTotalPages] = useState(0);

  // container-based measurement for PDF layout (replaces window-based PDF_BASE_WIDTH)

  const pdfContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const safeContainerWidth = containerWidth || 800;
  const VIEW_FIT = {
    single: 0.95,
    double: 0.47,
  };



  // Measurement useLayoutEffect moved below after viewMode declaration to avoid TDZ


  // viewerHeight removed: rely on CSS flexbox for responsive sizing

  // Hover drawer & speech state
  const [hoverInfo, setHoverInfo] = useState<null | { id: string; title: string; desc: string; top: number; left: number }>(null);
  const [spokenId, setSpokenId] = useState<string | null>(null);
  const [hoverDescriptions, setHoverDescriptions] = useState<Record<string, string>>({});

  // Speak description once per hover entry
  const speakDescription = (id: string, text: string) => {
    try {
      if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      // Stop previous speech
      window.speechSynthesis.cancel();

      setSpokenId(id);

      const u = new SpeechSynthesisUtterance(text);

      u.lang = 'en-US';

      // Audio settings
      u.volume = speechVolume; // Controlled by header buttons
      u.rate = 1.0;
      u.pitch = 1.0;

      const availableVoices = window.speechSynthesis.getVoices();
      const selectedVoice = availableVoices.find(v => v.voiceURI === selectedVoiceURI);

      if (selectedVoice) {
        u.voice = selectedVoice;
      } else {
        const preferred =
          availableVoices.find(v => v.lang && v.lang.toLowerCase().startsWith('en')) ||
          availableVoices[0];
        if (preferred) u.voice = preferred;
      }

      window.speechSynthesis.speak(u);

    } catch (err) {
      console.error('Speech error:', err);
    }
  };

  const clearHover = () => {
    setHoverInfo(null);
    setSpokenId(null);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };



  const increaseVolume = () => {
    setSpeechVolume(prev => Math.min(1, prev + 0.1));
  };

  const decreaseVolume = () => {
    setSpeechVolume(prev => Math.max(0, prev - 0.1));
  };

  const audioContextRef = useRef<AudioContext | null>(null);
  const beepTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialVolumeRef = useRef(true);

  // Auto-close volume popup after 3 seconds of inactivity; resets on volume change
  useEffect(() => {
    if (!showVolumePopup) return;
    const timer = setTimeout(() => setShowVolumePopup(false), 3000);
    return () => clearTimeout(timer);
  }, [showVolumePopup, speechVolume]);

  useEffect(() => {
    if (initialVolumeRef.current) {
      initialVolumeRef.current = false;
      return;
    }

    // Do not interrupt narration if TTS is playing
    if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
      return;
    }

    if (beepTimeoutRef.current) clearTimeout(beepTimeoutRef.current);
    beepTimeoutRef.current = setTimeout(() => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, ctx.currentTime);

        const safeVol = Math.max(0, Math.min(1, speechVolume));
        gainNode.gain.setValueAtTime(safeVol * 0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.15);
      } catch (e) {
        console.error("Audio beep error:", e);
      }
    }, 100);
  }, [speechVolume]);

  useEffect(() => {
    const updateVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);

      const savedURI = localStorage.getItem('selectedVoiceURI');
      if (savedURI && availableVoices.find(v => v.voiceURI === savedURI)) {
        setSelectedVoiceURI(savedURI);
      } else {
        const defaultVoice = availableVoices.find(v => v.default) || availableVoices[0];
        if (defaultVoice) {
          setSelectedVoiceURI(defaultVoice.voiceURI);
        }
      }
    };

    updateVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const handleVoiceChange = (uri: string) => {
    setSelectedVoiceURI(uri);
    localStorage.setItem('selectedVoiceURI', uri);
  };

  const testVoice = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("Testing selected voice.");
    u.volume = speechVolume;
    const availableVoices = window.speechSynthesis.getVoices();
    const selectedVoice = availableVoices.find(v => v.voiceURI === selectedVoiceURI);
    if (selectedVoice) {
      u.voice = selectedVoice;
    }
    window.speechSynthesis.speak(u);
  };

  const openVoicePopup = () => {
    setShowVoicePopup(true);
    setFocusedVoiceIndex(voices.findIndex(v => v.voiceURI === selectedVoiceURI));
  };

  const closeVoicePopup = () => {
    setShowVoicePopup(false);
    if (voicePopupTimeoutRef.current) clearTimeout(voicePopupTimeoutRef.current);
    if (voiceButtonRef.current) voiceButtonRef.current.focus();
  };

  const handleVoiceMouseEnter = () => {
    if (voicePopupTimeoutRef.current) clearTimeout(voicePopupTimeoutRef.current);
  };

  const handleVoiceMouseLeave = () => {
    voicePopupTimeoutRef.current = setTimeout(() => {
      closeVoicePopup();
    }, 3000);
  };

  const handleVoiceKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeVoicePopup();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedVoiceIndex(prev => (prev < voices.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedVoiceIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedVoiceIndex >= 0 && focusedVoiceIndex < voices.length) {
        handleVoiceChange(voices[focusedVoiceIndex].voiceURI);
        closeVoicePopup();
      }
    }
  };

  // Navigation Section Expand/Collapse State - empty map so all sections remain collapsed by default
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Slide dragging state
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);
  const [sliderValue, setSliderValue] = useState<number>(0);

  // Synchronous scroll restoration anchors for zoom and view mode changes
  const targetZoomCenterRef = useRef<{ baseX: number, baseY: number } | null>(null);
  const targetPageForViewModeRef = useRef<number | null>(null);



  // Global window mouseup/touchend to safely release dragging mode
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDraggingSlider(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, []);

  // PDF Viewer View State (per-document)
  const [viewModes, setViewModes] = useState<Record<string, 'single' | 'double'>>({});
  const currentViewMode = (activeManualId ? viewModes[activeManualId] : undefined) as 'single' | 'double' | undefined;
  console.log("VIEW_MODE:", currentViewMode);
  // Remove pagination indices: we use continuous vertical scroll instead
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  // Measure the actual rendered container width and keep it in sync.
  // Use ResizeObserver so measurements run when the viewer mounts (e.g. after intro screen)
  useLayoutEffect(() => {
    const update = () => {
      if (pdfContainerRef.current) {
        setContainerWidth(pdfContainerRef.current.clientWidth);
      }
    };

    // Call once if available
    update();

    const ro = new ResizeObserver(() => {
      update();
    });

    if (pdfContainerRef.current) {
      try { ro.observe(pdfContainerRef.current); } catch (e) { }
    }

    const onWin = () => update();
    window.addEventListener('resize', onWin);

    return () => {
      window.removeEventListener('resize', onWin);
      try { ro.disconnect(); } catch (e) { }
    };
  }, [showMainApp]); // re-run when viewer becomes visible so initial measurement is accurate

  // Mouse middle-click pan state & refs
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const scrollStartRef = useRef({ left: 0, top: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });
  const panLayerRef = useRef<HTMLDivElement | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Reset panning status and handle global window mouseup to release panning mode cleanly
  useEffect(() => {
    const handleGlobalMouseUp = (e: MouseEvent) => {
      // Release panning on any mouseup (left or middle)
      setIsPanning(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSearchTerm, setActiveSearchTerm] = useState<string>('');
  // Each result carries the page number and which occurrence-index on that page it corresponds to,
  // so PdfPageRenderer can highlight/center exactly the right match.
  const [searchResults, setSearchResults] = useState<{ pageNumber: number; textSnippet: string; fieldName: string; matchIndexOnPage: number }[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState<number>(-1);
  const [searchError, setSearchError] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Status indicators for Windows 95 feel
  const [systemTime, setSystemTime] = useState<string>('');

  // PDF state hooks
  const [pdfPagesMap, setPdfPagesMap] = useState<Record<string, ManualPage[]>>({});
  const [pdfDocsMap, setPdfDocsMap] = useState<Record<string, any>>({});
  const [loadingManuals, setLoadingManuals] = useState<Record<string, boolean>>({});
  // Track which pages have been requested/rendered (lazy load per-page)
  const [loadedPagesMap, setLoadedPagesMap] = useState<Record<string, Record<number, boolean>>>({});

  const sendDebugLog = (msg: string) => {
    if (import.meta.env.PROD) return;
    fetch('/api/debug_log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    }).catch(() => { });
  };

  // Zoom removed: no anchor or transition locks required

  let isPdfManual = false;
  if (xmlDocument && activeManualId) {
    const node = xmlDocument.querySelector(`[id="${activeManualId}"]`);
    if (node && node.getAttribute('file')) {
      isPdfManual = true;
    }
  }

  // Ref to the scroll container to manage clicking and tracking page positions
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeHighlightRef = useRef<{
    pageNumber: number;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const isSelfScrolling = useRef<boolean>(false);

  // Use only PDF pages, removing the text fallback system entirely
  const currentManualPages = pdfPagesMap[activeManualId] || [];
  const totalPagesInManual = currentManualPages.length;
  const totalPairs = Math.ceil(totalPagesInManual / 2);


  // Zoom removed: no applyZoom or viewport restoration logic remains




  // Use zoomLevel as the single source of truth for rendering and sizing
  // New zoom state (single source of truth)
  const [zoom, setZoom] = useState<number>(1); // 1.0 == 100%
  const [zoomInput, setZoomInput] = useState<string>('100%');

  const MIN_ZOOM = 0.1; // 10%
  const MAX_ZOOM = 4.0; // 400%

  // Eliminate zoom jitter: synchronously restore scroll position immediately after DOM mutations, before paint
  useLayoutEffect(() => {
    if (targetZoomCenterRef.current) {
      const container = scrollContainerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const { baseX, baseY } = targetZoomCenterRef.current;

        const newViewCenterX = baseX * zoom;
        const newViewCenterY = baseY * zoom;

        container.scrollLeft = Math.max(0, Math.round(newViewCenterX - rect.width / 2));
        container.scrollTop = Math.max(0, Math.round(newViewCenterY - rect.height / 2));
      }
      targetZoomCenterRef.current = null;
    }
  }, [zoom]);

  // Eliminate view mode jitter: synchronously scroll the target page back into view before paint
  useLayoutEffect(() => {
    if (targetPageForViewModeRef.current !== null) {
      const container = scrollContainerRef.current;
      if (container) {
        const target = container.querySelector(`[data-page-number="${targetPageForViewModeRef.current}"]`) as HTMLElement | null;
        if (target) {
          target.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
      }
      targetPageForViewModeRef.current = null;
    }
  }, [viewModes, activeManualId]);

  // Apply a new zoom scale while preserving the viewport anchor (the visible point)
  const applyZoom = (newScale: number) => {
    if (newScale === zoom) return;

    // Clamp
    newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));

    const container = scrollContainerRef.current;
    if (!container) {
      setZoom(newScale);
      setZoomInput(`${Math.round(newScale * 100)}%`);
      return;
    }

    // Capture current viewport center in base (unscaled) content coordinates
    const rect = container.getBoundingClientRect();
    const viewCenterX = container.scrollLeft + rect.width / 2;
    const viewCenterY = container.scrollTop + rect.height / 2;

    targetZoomCenterRef.current = {
      baseX: viewCenterX / zoom,
      baseY: viewCenterY / zoom
    };

    // Trigger layout update
    setZoom(newScale);
    setZoomInput(`${Math.round(newScale * 100)}%`);
  };

  const changeZoomByStep = (deltaPercent: number) => {
    const cur = zoom * 100;
    const next = Math.round(cur + deltaPercent);
    applyZoom(next / 100);
  };

  // Reset zoom to 100% without modifying scroll position or view mode
  const resetZoom = () => {
    applyZoom(1);
  };

  const handleZoomInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = zoomInput.trim().replace('%', '');
      const num = Number(val);
      if (!isNaN(num)) {
        const clamped = Math.max(MIN_ZOOM * 100, Math.min(MAX_ZOOM * 100, num));
        applyZoom(clamped / 100);
      } else {
        // reset to current zoom if invalid
        setZoomInput(`${Math.round(zoom * 100)}%`);
      }
    }
  };

  const handleZoomInputBlur = () => {
    // normalize on blur
    setZoomInput(`${Math.round(zoom * 100)}%`);
  };

  // Helper: parse a single page on demand (incremental, non-blocking)
  const parsePage = async (manualId: string, pageNum: number) => {
    try {
      const pdf = pdfDocsMap[manualId];
      if (!pdf) return;

      // If already parsed paragraphs exist, skip
      const pages = pdfPagesMap[manualId];
      if (pages && pages[pageNum - 1] && pages[pageNum - 1].paragraphs && pages[pageNum - 1].paragraphs.length > 0) return;

      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const textItems = (textContent && textContent.items) ? (textContent.items as any[]) : [];
      const lineMap: Record<number, any[]> = {};
      textItems.forEach(item => {
        const y = Math.round(item.transform[5]);
        let foundYKey = Object.keys(lineMap).map(Number).find(keyY => Math.abs(keyY - y) < 5);
        if (foundYKey !== undefined) {
          lineMap[foundYKey].push(item);
        } else {
          lineMap[y] = [item];
        }
      });

      const sortedYKeys = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
      const lines: string[] = [];

      sortedYKeys.forEach(yKey => {
        const lineItems = lineMap[yKey];
        lineItems.sort((a, b) => a.transform[4] - b.transform[4]);
        const lineText = lineItems.map(item => item.str).join(' ').trim();
        if (lineText) lines.push(lineText);
      });

      const pageTextLength = lines.join(' ').trim().length;
      const isImageBased = pageTextLength < 15;
      const firstLineWithText = lines.find(l => l.trim().length > 3) || `Page ${pageNum}`;

      setPdfPagesMap(prev => {
        const existing = prev[manualId] ? [...prev[manualId]] : [];
        const idx = pageNum - 1;
        const existingPage = existing[idx] || { id: `${manualId}-pdf-p-${pageNum}`, manualId, pageNumber: pageNum, sectionTitle: firstLineWithText, subTitle: '', paragraphs: [], isImageBased };
        existing[idx] = { ...existingPage, sectionTitle: firstLineWithText.trim().substring(0, 100), paragraphs: lines, isImageBased } as ManualPage;
        return { ...prev, [manualId]: existing };
      });

      // mark as loaded
      setLoadedPagesMap(prev => ({ ...(prev || {}), [manualId]: { ...((prev && prev[manualId]) || {}), [pageNum]: true } }));

    } catch (err) {
      console.error('Error parsing page', manualId, pageNum, err);
    }
  };

  // Synchronize sliderValue with the current position when not actively dragging
  useEffect(() => {
    if (isDraggingSlider) return;
    const container = scrollContainerRef.current;
    if (!container || !activeManualId) return;

    // Only enable scroll-based tracking once the manual has finished loading and pages exist
    const isLoading = loadingManuals[activeManualId];
    if (isLoading || !currentManualPages || currentManualPages.length === 0) return;

    const updateFromScroll = () => {
      // Scroll handling (zoom removed)
      const pages = Array.from(container.querySelectorAll('[data-page-number]')) as HTMLElement[];
      if (!pages || pages.length === 0) return;

      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.top + (containerRect.height / 2);

      let closestIdx = 0;
      let minDist = Infinity;

      pages.forEach((el, idx) => {
        const elRect = el.getBoundingClientRect();
        const elCenter = elRect.top + (elRect.height / 2);
        const dist = Math.abs(elCenter - containerCenter);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = idx;
        }
      });

      setSliderValue(closestIdx);

      // Don't change scroll positions during zoom; keep scrollbar as source-of-truth.
    };


    container.addEventListener('scroll', updateFromScroll);

    return () => {
      container.removeEventListener('scroll', updateFromScroll);
    };
  }, [activeManualId, currentViewMode, totalPagesInManual, isDraggingSlider, loadingManuals, containerWidth]);

  // Generate systemic clock for status bar
  useEffect(() => {
    // Load XML configuration mapping documents to PDF files
    const loadConfig = async () => {
      try {
        const cfgUrl = '/XML/documents.xml';
        const resp = await fetch(cfgUrl);
        if (!resp.ok) return;
        const xmlText = await resp.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, 'application/xml');

        const newStructure: DocumentSection[] = [];
        const newManualsInfo: Record<string, { title: string; pagesCount: number; startPage: number }> = {};

        const sections = Array.from(xml.querySelectorAll('section'));
        for (const s of sections) {
          const sid = s.getAttribute('id') || '';
          const stitle = s.getAttribute('title') || sid;
          const file = s.getAttribute('file');

          const subdocs = Array.from(s.querySelectorAll('subdocument'));
          if (subdocs.length > 0) {
            const subs: any[] = [];
            for (const sd of subdocs) {
              const subId = sd.getAttribute('id') || '';
              const subTitle = sd.getAttribute('title') || subId;
              const subFile = sd.getAttribute('file');
              subs.push({ id: subId, title: subTitle, docId: subId });
              if (subFile) {
                newManualsInfo[subId] = { title: subTitle, pagesCount: 0, startPage: 1 };
              }
            }
            newStructure.push({ id: sid, title: stitle, isExpandable: true, subDocuments: subs });
          } else if (file) {
            // Single-file section
            newManualsInfo[sid] = { title: stitle, pagesCount: 0, startPage: 1 };
            newStructure.push({ id: sid, title: stitle, isExpandable: false, docId: sid });
          } else {
            // Placeholder section – no file linked yet; still show as a selectable item
            // in the navigation. Clicking it will show a "no document available" message.
            newManualsInfo[sid] = { title: stitle, pagesCount: 0, startPage: 1 };
            newStructure.push({ id: sid, title: stitle, isExpandable: false, docId: sid });
          }
        }

        setXmlDocument(xml);
        setDocumentStructure(newStructure);
        setManualsInfo(newManualsInfo);

        // Default active manual to first section or subdocument if none selected yet
        if (!activeManualId) {
          const firstDoc = xml.querySelector('section[file], subdocument[file]');
          if (firstDoc) {
            setActiveManualId(firstDoc.getAttribute('id') || '');
          }
        }
      } catch (err) {
        console.error('Failed to load documents XML config:', err);
      }
    };

    const loadHoverTexts = async () => {
      try {
        const hoverUrl = '/XML/hoverTexts.xml';
        const resp = await fetch(hoverUrl);
        if (!resp.ok) return;
        const xmlText = await resp.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, 'application/xml');

        const newHoverTexts: Record<string, string> = {};
        const textNodes = Array.from(xml.querySelectorAll('text'));
        for (const t of textNodes) {
          const id = t.getAttribute('id');
          if (id) {
            newHoverTexts[id] = t.textContent || '';
          }
        }
        setHoverDescriptions(newHoverTexts);
      } catch (err) {
        console.error('Failed to load hover texts XML:', err);
      }
    };

    loadConfig();
    loadHoverTexts();

    const updateTime = () => {
      const now = new Date();
      setSystemTime(now.toLocaleTimeString());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);


  // Back-end PDF parsing and loading effect
  useEffect(() => {
    if (!activeManualId || !xmlDocument) return;

    let file = '';
    const node = xmlDocument.querySelector(`[id="${activeManualId}"]`);
    if (node) {
      file = node.getAttribute('file') || '';
    }

    if (!file) {
      return;
    }

    let pdfUrl = '';
    try {
      pdfUrl = `/PDFs/${encodeURIComponent(file)}`;
    } catch (e) {
      pdfUrl = `/PDFs/${file}`;
    }

    if (pdfPagesMap[activeManualId]) return;

    let isMounted = true;

    const loadPdfData = async () => {
      setLoadingManuals(prev => ({ ...prev, [activeManualId]: true }));
      try {
        const response = await fetch(pdfUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF file: ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const pdfData = new Uint8Array(arrayBuffer);
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        const pdf = await loadingTask.promise;


        if (!isMounted) return;
        const numPages = pdf.numPages;
        setTotalPages(numPages);

        // defer UI mode change safely
        // Ensure this document has a view mode set (default to 'single' for all manuals)
        setViewModes(prev => {
          if (prev[activeManualId]) return prev;
          return { ...prev, [activeManualId]: 'single' };
        });

        // Create lightweight placeholders for all pages so the viewer can layout
        // without parsing every page. Detailed parsing occurs on-demand per page.
        const placeholderPages: ManualPage[] = [];
        for (let i = 1; i <= numPages; i++) {
          placeholderPages.push({
            id: `${activeManualId}-pdf-p-${i}`,
            manualId: activeManualId,
            pageNumber: i,
            sectionTitle: `Page ${i}`,
            subTitle: '',
            paragraphs: [],
            isImageBased: false,
          });
        }

        if (isMounted) {
          setPdfPagesMap(prev => ({ ...prev, [activeManualId]: placeholderPages }));
          setPdfDocsMap(prev => ({ ...prev, [activeManualId]: pdf }));
          setLoadingManuals(prev => ({ ...prev, [activeManualId]: false }));

          // ensure first page is queued for parsing and rendering immediately
          setLoadedPagesMap(prev => ({ ...(prev || {}), [activeManualId]: { ...(prev && prev[activeManualId] ? prev[activeManualId] : {}), [1]: true } }));
          // parse first page during idle time to avoid blocking
          if ((window as any).requestIdleCallback) {
            (window as any).requestIdleCallback(() => parsePage(activeManualId, 1));
          } else {
            setTimeout(() => parsePage(activeManualId, 1), 50);
          }
        }
      } catch (err) {
        console.error(`Error loading or parsing PDF at ${pdfUrl}:`, err);
        if (isMounted) {
          setLoadingManuals(prev => ({ ...prev, [activeManualId]: false }));
        }
      }
    };

    loadPdfData();

    return () => {
      isMounted = false;
    };
  }, [activeManualId]);

  // Observe placeholders and lazily parse/render pages when they enter the viewport
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !activeManualId) return;

    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        const pageNumAttr = el.getAttribute('data-page-number');
        if (!pageNumAttr) return;
        const pageNum = Number(pageNumAttr);
        if (!pageNum) return;

        // mark page to be rendered and parse it
        setLoadedPagesMap(prev => ({ ...(prev || {}), [activeManualId]: { ...((prev && prev[activeManualId]) || {}), [pageNum]: true } }));
        // parse in idle time
        if ((window as any).requestIdleCallback) {
          (window as any).requestIdleCallback(() => parsePage(activeManualId, pageNum));
        } else {
          setTimeout(() => parsePage(activeManualId, pageNum), 50);
        }

        // prefetch adjacent pages for smoother navigation
        const prefetch = [pageNum + 1, pageNum - 1, pageNum + 2];
        prefetch.forEach(pn => {
          if (pn > 0 && pn <= (pdfDocsMap[activeManualId]?.numPages || 0)) {
            if ((window as any).requestIdleCallback) {
              (window as any).requestIdleCallback(() => parsePage(activeManualId, pn));
            } else {
              setTimeout(() => parsePage(activeManualId, pn), 200);
            }
          }
        });
      });
    }, { root: container, rootMargin: '600px 0px 600px 0px', threshold: 0.01 });

    // observe existing placeholders
    const placeholders = Array.from(container.querySelectorAll('.page-placeholder')) as HTMLElement[];
    placeholders.forEach(p => io.observe(p));

    return () => {
      try { io.disconnect(); } catch (e) { }
    };
  }, [activeManualId, pdfPagesMap, pdfDocsMap]);

  // Reset pan and scroll tracking refs whenever the active manual or view mode changes
  useEffect(() => {
    setPan({ x: 0, y: 0 });
    panOriginRef.current = { x: 0, y: 0 };
    // Reset pan/scroll refs on manual change
  }, [activeManualId, currentViewMode]);

  // Ensure each document has a view mode entry when selected
  useEffect(() => {
    if (!activeManualId) return;
    if (viewModes[activeManualId]) return;

    const pages = pdfPagesMap[activeManualId];
    if (pages && pages.length > 0) {
      setViewModes(prev => ({ ...prev, [activeManualId]: 'single' }));
    }
  }, [activeManualId, pdfPagesMap, viewModes]);

  // When changing active manual, reset page views and clear search
  const handleSelectManual = (manualId: string) => {
    // Reset view mode for this manual explicitly so it does not carry over from previous manuals
    // Default all manuals to 'single' view on selection
    setViewModes(prev => {
      if (prev[manualId]) return prev;

      return {
        ...prev,
        [manualId]: 'single'
      };
    });
    setActiveManualId(manualId);
    clearSearch();
    setIsPanning(false);
    // Reset vertical scroll and pan transform (no horizontal scrolling used anymore)

  };

  const handleHoverEnter = (e: React.MouseEvent, id: string | undefined, title: string) => {
    if (!id) return;
    const panel = navPanelRef.current;
    const target = e.currentTarget as HTMLElement;
    if (!panel || !target) return;
    const panelRect = panel.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const top = rect.top - panelRect.top + rect.height + 8; // position below the item
    const left = Math.min(panelRect.width - 20, rect.left - panelRect.left + 36);
    const desc = hoverDescriptions[id] || hoverDescriptions[title.toLowerCase()] || manualsInfo[id]?.title || '';

    setHoverInfo({ id, title, desc, top, left });
    // speak once per enter
    if (spokenId !== id && desc) {
      speakDescription(id, desc);
    }
  };

  // Toggle tree node expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Reset scroll when manual changes and keep slider synced to scroll position
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTop = 0;
    container.scrollLeft = 0;

    setPan({ x: 0, y: 0 });
    panOriginRef.current = { x: 0, y: 0 };

    setSliderValue(0);
  }, [activeManualId]);

  // Handle standard viewport scroll tracking is now optional as only the active page spread is rendered
  const handleViewerScroll = () => {
    // Scroll event tracking disabled for active spread mode
  };

  // Immediate view mode transition handler
  const handleViewModeChange = async (mode: 'single' | 'double') => {
    if (!activeManualId || viewModes[activeManualId] === mode) return;

    // Prevent enabling double view on single-page PDFs
    const pagesForManual = pdfPagesMap[activeManualId];
    if (mode === 'double' && pagesForManual && pagesForManual.length === 1) return;

    // Capture current visible page identity (page number)
    const currentPageNum = getCurrentVisiblePage();

    if (currentPageNum !== null) {
      targetPageForViewModeRef.current = currentPageNum;

      // Update sliderValue optimistically
      const foundIdx = currentManualPages.findIndex(p => p.pageNumber === currentPageNum);
      if (foundIdx !== -1) setSliderValue(foundIdx);
    }

    // Apply view mode change
    setViewModes(prev => ({ ...prev, [activeManualId]: mode }));
  };
  // Page navigation controls (previous / next) using existing scroll container
  const handlePrevPage = () => {
    if (!scrollContainerRef.current || !currentManualPages || currentManualPages.length === 0) return;

    const curIdx = Math.min(
      Math.max(0, sliderValue),
      currentManualPages.length - 1
    );

    const targetIdx =
      currentViewMode === 'double'
        ? Math.max(0, curIdx - 2)
        : Math.max(0, curIdx - 1);

    const targetPage = currentManualPages[targetIdx];
    if (!targetPage) return;

    const el = document.querySelector(
      `[data-page-number="${targetPage.pageNumber}"]`
    ) as HTMLElement | null;

    if (el) {
      const container = scrollContainerRef.current;
      if (!container) return;

      const containerCenterOffset = container.clientHeight / 2;
      const frac = 0.5;

      const targetScrollTop = Math.max(0, Math.round(el.offsetTop + (el.offsetHeight * frac) - containerCenterOffset));

      container.scrollTop = targetScrollTop;

      setSliderValue(targetIdx);
    }
  };

  const handleNextPage = () => {
    if (!scrollContainerRef.current || !currentManualPages || currentManualPages.length === 0) return;

    const curIdx = Math.min(
      Math.max(0, sliderValue),
      currentManualPages.length - 1
    );

    const targetIdx =
      currentViewMode === 'double'
        ? Math.min(currentManualPages.length - 1, curIdx + 2)
        : Math.min(currentManualPages.length - 1, curIdx + 1);

    const targetPage = currentManualPages[targetIdx];
    if (!targetPage) return;

    const el = document.querySelector(
      `[data-page-number="${targetPage.pageNumber}"]`
    ) as HTMLElement | null;

    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      setSliderValue(targetIdx);
    }
  };
  // Clear all search state and highlights
  const clearSearch = () => {
    setSearchQuery('');
    setActiveSearchTerm('');
    setSearchResults([]);
    setCurrentSearchIndex(-1);
    setSearchError('');
    setIsSearching(false);
  };

  // Search Logic — reads text directly from the PDF for complete, reliable results
  const handleSearchExecute = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchError('');

    if (!searchQuery.trim()) {
      clearSearch();
      return;
    }

    const query = searchQuery.toLowerCase().trim();

    // For PDF manuals: search directly against the PDF's own text content
    if (isPdfManual && pdfDocsMap[activeManualId]) {
      setIsSearching(true);
      setActiveSearchTerm(searchQuery.trim());
      setSearchResults([]);
      setCurrentSearchIndex(-1);

      const pdf = pdfDocsMap[activeManualId];
      const numPages = pdf.numPages;
      const results: { pageNumber: number; textSnippet: string; fieldName: string; matchIndexOnPage: number }[] = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const items: any[] = textContent.items;

          // Track how many matches we have found on this page so far
          let matchCountOnPage = 0;

          items.forEach(item => {
            if (!item.str) return;
            const str = item.str.toLowerCase();
            let from = 0;
            while (true) {
              const idx = str.indexOf(query, from);
              if (idx === -1) break;
              results.push({
                pageNumber: pageNum,
                textSnippet: query,
                fieldName: 'PDF Text',
                matchIndexOnPage: matchCountOnPage
              });
              matchCountOnPage++;
              from = idx + query.length;
            }
          });
        } catch (err) {
          console.error('Search error on page', pageNum, err);
        }
      }

      setIsSearching(false);

      if (results.length > 0) {
        setSearchResults(results);
        setCurrentSearchIndex(0);
        // Rough-scroll the first match's page into view; onHighlightFound will fine-tune
        const targetPage = results[0].pageNumber;
        const foundIdx = currentManualPages.findIndex(p => p.pageNumber === targetPage);
        if (foundIdx !== -1) {
          const target = pdfContainerRef.current?.querySelector(`[data-page-number="${currentManualPages[foundIdx].pageNumber}"]`) as HTMLElement | null;
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setSliderValue(foundIdx);
        }
      } else {
        setActiveSearchTerm('');
        setSearchError(`"${searchQuery}" not found in current document.`);
      }
      return;
    }

    // Fallback: non-PDF (text-only) manual search using pre-parsed page data
    const results: { pageNumber: number; textSnippet: string; fieldName: string; matchIndexOnPage: number }[] = [];

    currentManualPages.forEach(page => {
      let countOnPage = 0;

      const addResult = (fieldName: string) => {
        results.push({
          pageNumber: page.pageNumber,
          textSnippet: searchQuery.trim(),
          fieldName,
          matchIndexOnPage: countOnPage++
        });
      };

      if (page.sectionTitle.toLowerCase().includes(query)) addResult('Header Title');
      if (page.subTitle && page.subTitle.toLowerCase().includes(query)) addResult('Section Subtitle');
      page.paragraphs.forEach(pText => {
        if (pText.toLowerCase().includes(query)) addResult('Technical Body');
      });
      if (page.table) {
        page.table.rows.forEach(row => {
          row.forEach(cell => {
            if (cell.toLowerCase().includes(query)) addResult('Specification Grid');
          });
        });
      }
    });

    if (results.length > 0) {
      setActiveSearchTerm(searchQuery.trim());
      setSearchResults(results);
      setCurrentSearchIndex(0);
      const targetPage = results[0].pageNumber;
      const foundIdx = currentManualPages.findIndex(p => p.pageNumber === targetPage);
      if (foundIdx !== -1) {
        const target = pdfContainerRef.current?.querySelector(`[data-page-number="${currentManualPages[foundIdx].pageNumber}"]`);
        if (target && scrollContainerRef.current) {
          (target as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setSliderValue(foundIdx);
      }
    } else {
      setActiveSearchTerm('');
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      setSearchError(`"${searchQuery}" not found in current document.`);
    }
  };

  // Jump to specific search result index.
  // Step 1: rough-scroll to bring the target page into view.
  // Step 2: onHighlightFound (fired by PdfPageRenderer after re-render with new activeMatchIndexOnPage)
  //         performs the precise centering of the exact match rect.
  const handleJumpToSearchResult = (index: number) => {
    if (searchResults.length === 0 || index < 0 || index >= searchResults.length) return;

    setCurrentSearchIndex(index);
    const targetPage = searchResults[index].pageNumber;
    const foundIdx = currentManualPages.findIndex(p => p.pageNumber === targetPage);
    if (foundIdx !== -1) {
      // Rough scroll: bring the page into view so PdfPageRenderer is mounted/visible
      const target = pdfContainerRef.current?.querySelector(`[data-page-number="${currentManualPages[foundIdx].pageNumber}"]`) as HTMLElement | null;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
      // update sliderValue optimistically
      setSliderValue(foundIdx);
    }
  };

  // Check if a rendered text field matches the selected search result
  const isSelectedResult = (pageNum: number, fieldName: string, textSnippet: string) => {
    if (currentSearchIndex < 0 || currentSearchIndex >= searchResults.length) return false;
    const sel = searchResults[currentSearchIndex];
    return sel.pageNumber === pageNum && sel.fieldName === fieldName && textSnippet.includes(sel.textSnippet);
  };

  // Highlight matches helper (now supports active match styled in red with glow)
  const highlightMatches = (text: string, searchWord: string, isActiveMatch: boolean = false) => {
    if (!searchWord || !text) return text;

    const parts = text.split(new RegExp(`(${searchWord.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, index) => {
          const isMatch = part.toLowerCase() === searchWord.toLowerCase();
          if (isMatch) {
            return (
              <span
                key={index}
                className={`px-1 font-bold rounded-sm border transition-all duration-150 ${isActiveMatch
                  ? 'bg-red-500 text-white border-red-700 shadow-[0_0_6px_rgba(239,68,68,0.6)] animate-pulse'
                  : 'bg-yellow-300 border border-amber-600/35 text-black'
                  }`}
              >
                {part}
              </span>
            );
          }
          return part;
        })}
      </>
    );
  };

  // PHASE 1: Helper to get the page currently visible at viewport center
  const getCurrentVisiblePage = (): number | null => {
    const container = scrollContainerRef.current;
    if (!container) {
      console.log('FUNCTION: getCurrentVisiblePage - container ref is NULL');
      return null;
    }

    const pages = Array.from(container.querySelectorAll('[data-page-number]')) as HTMLElement[];
    if (!pages || pages.length === 0) {
      console.log('FUNCTION: getCurrentVisiblePage - no pages found');
      return null;
    }

    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.top + (containerRect.height / 2);

    let closestPage: number | null = null;
    let minDist = Infinity;

    pages.forEach(el => {
      const elRect = el.getBoundingClientRect();
      const elCenter = elRect.top + (elRect.height / 2);
      const dist = Math.abs(elCenter - containerCenter);
      if (dist < minDist) {
        minDist = dist;
        closestPage = Number(el.getAttribute('data-page-number'));
      }
    });

    console.log('FUNCTION: getCurrentVisiblePage - found page:', closestPage, 'distance:', minDist);
    return closestPage;
  };

  // Zoom UI and handlers removed

  // Direct page click jump indicator with direction logic
  const handleDirectPageJump = (pageIdx: number) => {
    const page = currentManualPages[Math.max(0, Math.min(pageIdx, currentManualPages.length - 1))];
    if (!page) return;
    const target = pdfContainerRef.current?.querySelector(`[data-page-number="${page.pageNumber}"]`);
    if (target && scrollContainerRef.current) {
      (target as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Mouse drag panning handlers (left-click while zoomed in, and middle-click remain supported)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only support middle-button panning in fixed-scale viewer
    const isMiddle = e.button === 1;
    if (isMiddle) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panOriginRef.current = { x: pan.x, y: pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !scrollContainerRef.current) return;
    e.preventDefault();
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;

    // compute content and viewport sizes
    const viewportW = scrollContainerRef.current.clientWidth;
    const viewportH = scrollContainerRef.current.clientHeight;

    const PAGE_GAP_PX = 20;
    let contentW = 0;
    if (currentViewMode === 'single') {
      const baseWidth = isPdfManual ? safeContainerWidth : safeContainerWidth;
      contentW = baseWidth;
    } else {
      const baseSingle = isPdfManual ? (safeContainerWidth * VIEW_FIT.double) : safeContainerWidth;
      contentW = (baseSingle) * 2 + PAGE_GAP_PX;
    }

    const contentH = scrollContainerRef.current.scrollHeight;

    const minPanX = Math.min(0, viewportW - contentW);
    const maxPanX = 0;
    const minPanY = Math.min(0, viewportH - contentH);
    const maxPanY = 0;

    let newX = panOriginRef.current.x + dx;
    let newY = panOriginRef.current.y + dy;

    if (newX < minPanX) newX = minPanX;
    if (newX > maxPanX) newX = maxPanX;
    if (newY < minPanY) newY = minPanY;
    if (newY > maxPanY) newY = maxPanY;

    setPan({ x: newX, y: newY });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    // Stop panning on mouse release (any button)
    setIsPanning(false);
  };

  // Clean corporate cover introduction screen
  const IntroScreen = () => (
    <div id="ietm_intro_container" className="w-full h-screen bg-white text-black flex flex-col items-center relative overflow-x-hidden overflow-y-auto">
      {/* Full-Width Hero Banner */}
      <div className="w-full shrink-0">
        <img
          src={irisImg}
          alt="iVIS Hero Banner"
          className="w-full h-[40vh] sm:h-[45vh] md:h-[55vh] object-cover object-center border-none shadow-none"
          referrerPolicy="no-referrer"
          style={{ display: 'block' }}
        />
      </div>

      {/* Centered Content Below */}
      <div className="flex-1 flex flex-col items-center justify-center w-full p-8 select-text border-none">
        <div style={{ width: '100%', maxWidth: 720 }} className="flex flex-col items-center text-center space-y-3">
          <h2 className="font-black" style={{ fontSize: 'clamp(20px, 2.6vw, 30px)', whiteSpace: 'nowrap', margin: 0 }}>Interactive Electronic Technical Manual (IETM)</h2>

          <div style={{ fontStyle: 'italic', fontSize: 'clamp(12px, 1.4vw, 14px)', whiteSpace: 'nowrap', marginTop: '16px', marginBottom: '16px' }}>for</div>

          <div className="font-semibold" style={{ fontSize: 'clamp(16px, 2.0vw, 22px)', whiteSpace: 'nowrap' }}>Intelligent Vehicle Intercom System (iVIS)</div>

          <div style={{ fontSize: 'clamp(13px, 1.6vw, 16px)', whiteSpace: 'nowrap' }}>Make: Elcom Innovations Pvt Ltd</div>
          <div style={{ fontSize: 'clamp(13px, 1.6vw, 16px)', whiteSpace: 'nowrap' }}>Model: iVIS</div>
        </div>
      </div>

      {/* BOTTOM RIGHT CORNER - "Click Here To Proceed" button */}
      <div className="absolute bottom-12 right-12 md:bottom-16 md:right-16 bg-white border-none">
        <button
          onClick={() => {
            // Show main app first so viewer DOM mounts, then ensure
            // the active manual is initialized the same way as a manual selection.
            setShowMainApp(true);

            // Run initialization after the viewer mounts.
            setTimeout(() => {
              const container = scrollContainerRef.current;
              try {
                // TEMPORARY TEST
              } catch (e) { }

              setPan({ x: 0, y: 0 });
              panOriginRef.current = { x: 0, y: 0 };
              setSliderValue(0);

              // Ensure first page is marked loaded and parsed like a manual open
              if (activeManualId) {
                setLoadedPagesMap(prev => ({ ...(prev || {}), [activeManualId]: { ...((prev && prev[activeManualId]) || {}), [1]: true } }));
                if ((window as any).requestIdleCallback) {
                  (window as any).requestIdleCallback(() => parsePage(activeManualId, 1));
                } else {
                  setTimeout(() => parsePage(activeManualId, 1), 50);
                }
              }
            }, 50);
          }}
          className="win-btn-blue font-sans"
        >
          Click Here To Proceed
        </button>
      </div>
    </div>
  );

  // Main PDF Document screen view
  const MainViewerScreen = () => {
    const getNodeIcon = (id: string) => {
      const lowerId = id.toLowerCase();
      const style = { width: 'clamp(10px, 1.2vw, 18px)', height: 'clamp(10px, 1.2vw, 18px)' };
      if (lowerId.includes('user-handbook')) {
        return <BookOpen style={style} className="text-[#0ea5e9] shrink-0" />;
      }
      if (lowerId.includes('tech-manual-1') || lowerId === 'tech-1-1' || lowerId === 'tech-1-2') {
        return <Notebook style={style} className="text-[#0ea5e9] shrink-0" />;
      }
      if (lowerId.includes('t1v1') || lowerId.includes('description') || lowerId === 'tech-1-1') {
        return <Info style={style} className="text-[#0ea5e9] shrink-0" />;
      }
      if (lowerId.includes('t1v2') || lowerId.includes('drawings') || lowerId === 'tech-1-2') {
        return <Compass style={style} className="text-[#0ea5e9] shrink-0" />;
      }
      if (lowerId.includes('tech-manual-2') || lowerId.includes('maintenance') || lowerId === 'tech-2') {
        return <Wrench style={style} className="text-[#0ea5e9] shrink-0" />;
      }
      if (lowerId.includes('tech-manual-3') || lowerId.includes('overhauling') || lowerId === 'tech-3') {
        return <Hammer style={style} className="text-[#0ea5e9] shrink-0" />;
      }
      if (lowerId.includes('tech-manual-4')) {
        return <Package style={style} className="text-[#0ea5e9] shrink-0" />;
      }
      if (lowerId.includes('t4v1') || lowerId.includes('part-list') || lowerId.includes('parts') || lowerId === 'tech-4-1') {
        return <ClipboardList style={style} className="text-[#0ea5e9] shrink-0" />;
      }
      if (lowerId.includes('t4v2') || lowerId.includes('illustrations') || lowerId === 'tech-4-2') {
        return <Image style={style} className="text-[#0ea5e9] shrink-0" />;
      }
      if (lowerId.includes('product-tree') || lowerId === 'product-tree') {
        return <Network style={style} className="text-[#0ea5e9] shrink-0" />;
      }
      return <FileText style={style} className="text-[#0ea5e9] shrink-0" />;
    };

    // Left Tree document items rendered recursively or explicitly
    const renderTreeItem = (node: DocumentSection) => {
      if (node.isExpandable) {
        const isExpanded = expandedSections[node.id];
        return (
          <div key={node.id} className="text-left select-none text-sm">
            {/* Explorable folder row header */}
            <div
              onClick={() => toggleSection(node.id)}
              onMouseEnter={(e) => handleHoverEnter(e as React.MouseEvent, node.id, node.title)}
              onMouseLeave={() => clearHover()}
              className="nav-item-hover flex items-center gap-2.5 py-1.5 pl-3 pr-2.5 rounded hover:bg-neutral-50 cursor-pointer text-neutral-800 font-semibold transition-colors border-l-2 border-transparent"
            >
              {getNodeIcon(node.id)}
              <span className="truncate font-sans" style={{ fontSize: 'clamp(7px, 0.8vw, 14px)' }}>{node.title}</span>
            </div>

            {/* Expandable Children leaves */}
            {isExpanded && node.subDocuments && (
              <div className="py-0.5 space-y-0.5">
                {node.subDocuments.map(subDoc => {
                  const isActive = activeManualId === subDoc.docId;
                  return (
                    <div
                      key={subDoc.id}
                      onClick={() => handleSelectManual(subDoc.docId)}
                      onMouseEnter={(e) => handleHoverEnter(e as React.MouseEvent, subDoc.docId, subDoc.title)}
                      onMouseLeave={() => clearHover()}
                      className={`nav-item-hover flex items-center gap-2.5 py-1.5 pr-2.5 pl-9 rounded cursor-pointer transition-colors duration-150 ${isActive ? 'bg-sky-100 text-neutral-900 font-semibold border-l-2 border-[#0ea5e9]' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 border-l-2 border-transparent'}`}
                      style={{ fontSize: 'clamp(7px, 0.8vw, 14px)' }}
                    >
                      {getNodeIcon(subDoc.id)}
                      <span className="truncate font-sans" title={subDoc.title}>{subDoc.title}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      } else {
        // Single PDF manuals and placeholder sections – always rendered as normal, clickable items.
        // If no PDF is linked, the viewer will show a "no document available" message.
        const isActive = activeManualId === node.docId;
        return (
          <div key={node.id} className="text-left select-none text-sm">
            <div
              onClick={() => node.docId && handleSelectManual(node.docId)}
              onMouseEnter={(e) => handleHoverEnter(e as React.MouseEvent, node.docId || node.id, node.title)}
              onMouseLeave={() => clearHover()}
              className={`nav-item-hover flex items-center gap-2.5 py-1.5 pr-2.5 pl-3 rounded cursor-pointer font-semibold transition-colors duration-150 ${isActive ? 'bg-sky-100 text-neutral-900 font-semibold border-l-2 border-[#0ea5e9]' : 'text-neutral-700 hover:bg-neutral-50 border-l-2 border-transparent'}`}
            >
              {node.docId ? getNodeIcon(node.docId) : getNodeIcon(node.id)}
              <span className="truncate font-sans" style={{ fontSize: 'clamp(7px, 0.8vw, 14px)' }} title={node.title}>{node.title}</span>
            </div>
          </div>
        );
      }
    };

    const selectedResult = searchResults[currentSearchIndex];

    // Compute page label for toolbar (single vs double view)
    const isSinglePdf = isPdfManual && pdfPagesMap[activeManualId] && pdfPagesMap[activeManualId].length === 1;
    let pageLabel = '';
    if (!currentManualPages || currentManualPages.length === 0) {
      pageLabel = `Page 0 of 0`;
    } else {
      const curIdx = Math.min(Math.max(0, sliderValue), currentManualPages.length - 1);
      if (currentViewMode === 'single' || isSinglePdf) {
        const p = currentManualPages[curIdx].pageNumber;
        pageLabel = `Page ${p} of ${totalPagesInManual}`;
      } else {
        const firstNum = currentManualPages[curIdx].pageNumber;
        let secondNum: number | undefined = undefined;
        if (curIdx < currentManualPages.length - 1) {
          secondNum = currentManualPages[curIdx + 1].pageNumber;
        } else if (curIdx > 0) {
          secondNum = currentManualPages[curIdx - 1].pageNumber;
        } else {
          secondNum = firstNum;
        }
        const start = Math.min(firstNum, secondNum);
        const end = Math.max(firstNum, secondNum);
        pageLabel = start === end ? `Page ${start} of ${totalPagesInManual}` : `Page ${start}-${end} of ${totalPagesInManual}`;
      }
    }

    // Compute current page(s) for the document info panel
    let currentPagesLabel = '';
    let currentPagesValue = '';
    if (currentManualPages && currentManualPages.length > 0) {
      const curIdx = Math.min(Math.max(0, sliderValue), currentManualPages.length - 1);
      if (currentViewMode === 'single' || isSinglePdf) {
        const p = currentManualPages[curIdx].pageNumber;
        currentPagesLabel = 'Current Page:';
        currentPagesValue = `${p}`;
      } else {
        const firstNum = currentManualPages[curIdx].pageNumber;
        let secondNum: number | undefined = undefined;
        if (curIdx < currentManualPages.length - 1) {
          secondNum = currentManualPages[curIdx + 1].pageNumber;
        } else if (curIdx > 0) {
          secondNum = currentManualPages[curIdx - 1].pageNumber;
        } else {
          secondNum = firstNum;
        }
        const start = Math.min(firstNum, secondNum);
        const end = Math.max(firstNum, secondNum);
        if (start === end) {
          currentPagesLabel = 'Current Page:';
          currentPagesValue = `${start}`;
        } else {
          currentPagesLabel = 'Current Pages:';
          currentPagesValue = `${start}-${end}`;
        }
      }
    }
    // Fixed 100% view

    return (
      <div id="main_ietm_interface" className="h-screen w-screen flex flex-col bg-neutral-100 font-sans overflow-hidden">

        {/* FIXED TOP WINDOW TITLE BAR - MODERN ENTERPRISE HEADER */}
        <div
          id="retro_top_header"
          ref={headerRef}
          className="relative overflow-hidden text-[#000000] flex items-center justify-between font-semibold shrink-0 select-none shadow-md border-b border-sky-400/50"
          style={{
            padding: 'clamp(1px, 0.25vw, 8px) clamp(6px, 1.2vw, 24px)',
            fontSize: 'clamp(9px, 0.95vw, 14px)',
            backgroundImage: `url('${headerBg}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}

        >
          {/* Subtle Technical/Engineering Blueprints Grid Mesh */}
          <div
            className="absolute inset-0 opacity-[0.20] pointer-events-none mix-blend-multiply"
            style={{
              backgroundImage:
                'radial-gradient(circle, #0284c7 1px, transparent 1px), linear-gradient(to right, rgba(14,165,233,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(14,165,233,0.18) 1px, transparent 1px)',
              backgroundSize: '18px 18px',
              backgroundPosition: 'center center'
            }}
          />

          {/* Logo */}
          <div
            className="flex items-center relative"
            style={{ minWidth: 'clamp(40px, 5vw, 72px)', gap: 'clamp(4px, 0.5vw, 12px)' }}
          >
            <img
              src={logoWebp}
              alt="ELCOM Logo"
              className="w-auto object-contain"
              style={{
                height: 'clamp(26px, 3vw, 42px)',
                minHeight: 'clamp(18px, 2vw, 28px)',
                minWidth: 'clamp(18px, 2vw, 28px)',
                margin: 'clamp(4px, 1vw, 20px)'
              }}
            />
          </div>

          {/* Center Title */}
          <div
            className="text-center font-sans relative flex-1"
            style={{ minWidth: 0 }}
          >
            <h1
              className="font-black uppercase leading-tight text-center"
              style={{
                fontSize: 'clamp(13px, 1.5vw, 28px)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              INTERACTIVE ELECTRONIC TECHNICAL MANUAL
            </h1>

            <div
              className="tracking-widest text-center uppercase"
              style={{
                fontSize: 'clamp(8px, 0.9vw, 14px)',
                color: '#c10000',
                textShadow: '0px 0px 8px rgba(255,255,255,2)',
                margin: 'clamp(1px, 0.2vw, 7px)',
                marginTop: 'clamp(1px, 0.3vw, 4px)'
              }}
            >
              INTELLIGENT VEHICLE INTERCOM SYSTEM (iVIS)
            </div>
          </div>

          {/* Version + Volume Controls */}
          <div
            className="relative flex flex-col items-end"
            style={{ minWidth: 'clamp(80px, 12vw, 300px)', flexShrink: 0, gap: 'clamp(2px, 0.3vw, 8px)' }}
          >
            <div
              className="text-xs font-mono text-[#001570] font-semibold"
              style={{
                fontSize: 'clamp(6px, 0.7vw, 12px)',
                transform: `translateY(clamp(2px, 2vw, -4px))`
              }}
            >
              iVIS IETM v1.10
            </div>

            <div className="flex flex-row items-end gap-3" style={{ transform: `translateY(clamp(4px, 1.5vw, 20px))` }}>
              {/* Clickable volume bar indicator */}
              <button
                onClick={() => setShowVolumePopup(true)}
                className="flex items-end cursor-pointer pb-1"
                title="Adjust Volume"
                style={{ gap: 'clamp(1px, 0.15vw, 2px)', height: 'clamp(16px, 1.4vw, 32px)' }}
              >
                {Array.from({ length: 10 }).map((_, index) => {
                  const activeBars = Math.round(speechVolume * 10);
                  return (
                    <div
                      key={index}
                      className={`w-1.5 rounded-sm transition-all duration-300 ${index < activeBars
                        ? 'bg-gradient-to-t from-[#001570] to-[#0284c7]'
                        : 'bg-blue-400/50'
                        }`}
                      style={{ height: `${5 + index * 2}px` }}
                    />
                  );
                })}
              </button>

              {/* Voice Button */}
              <button
                ref={voiceButtonRef}
                onClick={openVoicePopup}
                className="flex items-end cursor-pointer pb-1 hover:opacity-80 transition-opacity ml-2"
                title="Select Voice"
                style={{ height: 'clamp(16px, 1.4vw, 32px)' }}
              >
                <img src={voiceWebp} alt="Voice" className="h-full w-auto object-contain drop-shadow-sm scale-125 origin-bottom" />
              </button>
            </div>

            {/* Volume popup modal */}
            {showVolumePopup && (
              <div
                className="fixed inset-0 z-[9999] flex items-center justify-center"
                onClick={() => setShowVolumePopup(false)}
              >
                <div
                  className="bg-white border border-neutral-300 shadow-2xl rounded-xl p-8 flex flex-col items-center gap-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-8">
                    <button
                      onClick={decreaseVolume}
                      className="w-16 h-40 rounded-lg border border-neutral-300 bg-neutral-100 hover:bg-neutral-200 transition-colors text-4xl font-bold"
                    >
                      −
                    </button>
                    <div className="flex flex-col items-center">
                      <div className="flex items-end gap-2 h-40">
                        {Array.from({ length: 10 }).map((_, index) => {
                          const activeBars = Math.round(speechVolume * 10);
                          return (
                            <div
                              key={index}
                              className={`w-6 rounded transition-all duration-300 ${index < activeBars
                                ? 'bg-gradient-to-t from-[#001570] to-[#0284c7]'
                                : 'bg-neutral-300'
                                }`}
                              style={{ height: `${20 + index * 10}px` }}
                            />
                          );
                        })}
                      </div>
                      <div className="mt-6 text-3xl font-bold text-neutral-800">
                        {Math.round(speechVolume * 100)}%
                      </div>
                    </div>
                    <button
                      onClick={increaseVolume}
                      className="w-16 h-40 rounded-lg border border-neutral-300 bg-neutral-100 hover:bg-neutral-200 transition-colors text-4xl font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Voice Selection Popup Modal */}
            <AnimatePresence>
              {showVoicePopup && (
                <div
                  className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/5 backdrop-blur-sm"
                  onClick={closeVoicePopup}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="bg-white border border-neutral-200 shadow-xl rounded-xl p-6 flex flex-col gap-4 max-w-[280px] w-full mx-4"
                    onClick={(e) => e.stopPropagation()}
                    onMouseEnter={handleVoiceMouseEnter}
                    onMouseLeave={handleVoiceMouseLeave}
                    onKeyDown={handleVoiceKeyDown}
                    tabIndex={0}
                    autoFocus
                  >
                    <div className="flex flex-col items-center gap-4 w-full">
                      <h3 className="text-lg font-bold text-neutral-800 tracking-tight">Voice Settings</h3>

                      <select
                        className="w-full text-sm bg-white border border-neutral-300 rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 shadow-sm text-neutral-700 cursor-pointer"
                        value={selectedVoiceURI}
                        onChange={(e) => handleVoiceChange(e.target.value)}
                        title="Select Voice"
                      >
                        {voices.map(v => (
                          <option key={v.voiceURI} value={v.voiceURI}>
                            {v.name} ({v.lang}){v.default ? ' [Default]' : ''}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={testVoice}
                        className="w-full text-sm bg-[#e8f0fe] hover:bg-[#d2e3fc] text-[#1967d2] px-4 py-2.5 rounded-lg border border-transparent transition-colors font-semibold shadow-sm"
                      >
                        Test Voice
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* INNER MENUBAR removed per requirements */}

        {/* WORKSPACE ZONE (SPLIT: NAVIGATION & VIEWING CONTAINER) */}
        <div className="flex-grow flex flex-row overflow-hidden min-h-0 bg-neutral-100" style={{ padding: 'clamp(4px, 0.5vw, 12px)', gap: 'clamp(4px, 0.5vw, 12px)' }}>

          {/* LEFT COLUMN: NAVIGATION EXPLORER PANEL */}
          <div id="left_nav_panel" ref={navPanelRef} className="relative shrink-0 flex flex-col h-full min-h-0 bg-white border border-neutral-200 rounded-lg shadow-sm" style={{ width: 'clamp(180px, 20vw, 300px)', padding: 'clamp(6px, 0.8vw, 12px)' }} onMouseLeave={() => { clearHover(); }}>
            <div className="text-[#0ea5e9] font-bold font-sans tracking-wide border-b border-neutral-100 uppercase flex items-center" style={{ fontSize: 'clamp(10px, 1vw, 14px)', paddingBottom: 'clamp(4px, 0.5vw, 8px)', marginBottom: 'clamp(4px, 0.5vw, 12px)', gap: 'clamp(4px, 0.4vw, 8px)' }}>
              <span className="bg-[#0ea5e9] rounded-sm inline-block" style={{ width: 'clamp(3px, 0.2vw, 6px)', height: 'clamp(8px, 1vw, 12px)' }}></span>
              <span>Document Explorer</span>
            </div>

            {/* Explorable scrollable tree box */}
            <div className="flex-grow overflow-y-auto overflow-x-hidden pr-1 space-y-1">
              {documentStructure.map(node => renderTreeItem(node))}
            </div>

            {/* Hover info drawer rendered inside nav panel */}
            {hoverInfo && (
              <div
                className={`nav-hover-drawer show`}
                style={{ top: hoverInfo.top, left: hoverInfo.left }}
                role="tooltip"
                aria-live="polite"
              >
                <div className="title">{hoverInfo.title}</div>
                <div className="desc">{hoverInfo.desc}</div>
              </div>
            )}

            {/* Quick terminal quick-stats overview (anchored to bottom) */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-md mt-auto font-sans text-left text-neutral-600" style={{ padding: 'clamp(4px, 0.6vw, 12px)', fontSize: 'clamp(9px, 0.8vw, 12px)' }}>
              <div
                className="text-xs font-normal truncate"
                title={`Active Document: ${manualsInfo[activeManualId]?.title}`}
              >
                <span className="font-bold text-neutral-800">Active Document:</span>{" "}
                <span className="text-[#0ea5e9] font-semibold">
                  {manualsInfo[activeManualId]?.title}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs pt-1 w-fit">
                <span className="text-neutral-500 font-bold">Total Pages:</span>
                <div className="flex items-center gap-3">
                  <span className="text-neutral-800 font-semibold">{totalPagesInManual}</span>
                  {currentPagesValue !== '' && (
                    <>
                      <span className="text-neutral-500 font-bold">{currentPagesLabel}</span>
                      <span className="text-neutral-800 font-semibold">{currentPagesValue}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowMainApp(false)}
            className="absolute z-50 flex items-center justify-center bg-transparent hover:bg-black/10 rounded-sm font-bold transition-colors"
            style={{ top: 'clamp(4px, 0.5vw, 8px)', left: 'clamp(4px, 0.5vw, 8px)', width: 'clamp(24px, 2.5vw, 32px)', height: 'clamp(24px, 2.5vw, 32px)', fontSize: 'clamp(14px, 1.5vw, 20px)' }}
            title="Return to Cover Page"
          >
            ←
          </button>




          {/* RIGHT COLUMN: PDF VIEWING PLATFORM */}
          <div className="flex-grow flex flex-col overflow-hidden min-h-0 bg-transparent">

            {/* VIEWING TOOLBAR - Top: left (view/zoom), center (page navigation), right (search) */}
            <div id="viewer_toolbar" ref={toolbarRef} className="bg-white border border-neutral-200 rounded-lg flex flex-nowrap items-center relative shrink-0 shadow-sm font-sans" style={{ padding: 'clamp(1px, 0.25vw, 8px)', gap: 'clamp(1px, 0.25vw, 8px)', marginBottom: 'clamp(2px, 0.3vw, 12px)', alignContent: 'flex-start' }}>
              {/* LEFT: View mode + Zoom controls */}
              <div className="viewer-toolbar-group flex items-center gap-2 sm:gap-3 lg:gap-4 flex-shrink-0 relative z-10">
                {/* View Mode Selection Control */}
                <div
                  className="flex border border-[#e2e8f0] rounded overflow-hidden shadow-sm select-none font-sans bg-white items-center"
                  style={{
                    height: 'clamp(20px, 2vw, 32px)'
                  }}
                >
                  <button
                    onClick={() => handleViewModeChange('single')}
                    className={`font-semibold h-full transition-colors ${currentViewMode === 'single' ? 'bg-[#7dd3fc] text-[#000000] font-bold border-r border-[#38bdf8]' : 'bg-white text-neutral-700 hover:bg-neutral-50'}`}
                    style={{ padding: '0 clamp(4px, 0.4vw, 12px)', fontSize: 'clamp(7px, 0.8vw, 14px)' }}
                    title="Single Page View"
                  >
                    Single
                  </button>
                  <div className="w-px h-full bg-neutral-200" />
                  <button
                    onClick={() => handleViewModeChange('double')}
                    disabled={isPdfManual && pdfPagesMap[activeManualId] && pdfPagesMap[activeManualId].length === 1}
                    className={`font-semibold h-full transition-colors ${currentViewMode === 'double' ? 'bg-[#7dd3fc] text-[#000000] font-bold border-l border-[#38bdf8]' : 'bg-white text-neutral-700 hover:bg-neutral-50'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    style={{ padding: '0 clamp(4px, 0.4vw, 12px)', fontSize: 'clamp(7px, 0.8vw, 14px)' }}
                    title="Double Page View"
                  >
                    Double
                  </button>
                </div>

                {/* Zoom controls: new independent zoom system */}
                <div className="flex items-center border border-[#e2e8f0] rounded bg-white" style={{ height: 'clamp(20px, 2vw, 32px)', marginLeft: 'clamp(4px, 0.5vw, 8px)' }}>
                  <button
                    onClick={() => changeZoomByStep(-10)}
                    title="Zoom Out"
                    className="flex items-center justify-center text-neutral-700 hover:bg-neutral-50 border-r border-[#e6eef7]"
                    style={{ height: 'clamp(20px, 2vw, 32px)', width: 'clamp(20px, 2vw, 32px)' }}
                  >
                    <Minus size={14} />
                  </button>

                  <div className="flex items-center justify-center" style={{ height: 'clamp(20px, 2vw, 32px)', width: 'clamp(42px, 4.5vw, 84px)', padding: '0 clamp(2px, 0.2vw, 4px)' }}>
                    <input
                      value={zoomInput}
                      onChange={(e) => setZoomInput(e.target.value)}
                      onKeyDown={handleZoomInputKey}
                      onBlur={handleZoomInputBlur}
                      aria-label="Zoom percentage"
                      className="text-center font-semibold w-full bg-transparent outline-none"
                      style={{ fontSize: 'clamp(7px, 0.8vw, 14px)', height: 'clamp(18px, 2vw, 24px)' }}
                    />
                  </div>

                  <button
                    onClick={() => changeZoomByStep(10)}
                    title="Zoom In"
                    className="flex items-center justify-center text-neutral-700 hover:bg-neutral-50 border-l border-[#e6eef7]"
                    style={{ height: 'clamp(20px, 2vw, 32px)', width: 'clamp(20px, 2vw, 32px)' }}
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={resetZoom}
                    title="Reset Zoom"
                    className="flex items-center justify-center text-neutral-700 hover:bg-neutral-50 border-l border-[#e6eef7]"
                    style={{ height: 'clamp(20px, 2vw, 32px)', width: 'clamp(20px, 2vw, 32px)' }}
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              {/* CENTER: Page navigation (prev, current, next) */}
              <div className="viewer-toolbar-group flex items-center gap-1 sm:gap-2 lg:gap-3 justify-center w-fit mx-auto min-w-0">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  className="flex items-center justify-center border border-neutral-200 bg-white hover:bg-[#f8fafc] text-neutral-800 rounded shadow-sm cursor-pointer"
                  style={{ height: 'clamp(20px, 2vw, 32px)', width: 'clamp(20px, 2vw, 32px)' }}
                  title="Previous Page"
                >
                  <ArrowLeft size={14} />
                </button>

                <div className="bg-neutral-50 border border-neutral-200 flex items-center justify-center font-sans font-medium text-neutral-700 rounded select-none text-center whitespace-nowrap" style={{ padding: '0 clamp(6px, 0.7vw, 12px)', height: 'clamp(20px, 2vw, 32px)', minWidth: 'clamp(50px, 6vw, 80px)', fontSize: 'clamp(7px, 0.8vw, 14px)' }}>
                  {pageLabel}
                </div>

                <button
                  type="button"
                  onClick={handleNextPage}
                  className="flex items-center justify-center border border-neutral-200 bg-white hover:bg-[#f8fafc] text-neutral-800 rounded shadow-sm cursor-pointer"
                  style={{ height: 'clamp(20px, 2vw, 32px)', width: 'clamp(20px, 2vw, 32px)' }}
                  title="Next Page"
                >
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* RIGHT: Search function input field */}
              <div className="viewer-toolbar-group flex items-center gap-1 sm:gap-2 lg:gap-3 min-w-0 relative z-10">
                <form onSubmit={handleSearchExecute} className="flex items-center gap-1 w-full min-w-0">
                  <div className="relative min-w-0 w-[clamp(35px,18vw,325px)]">
                    {/* Search icon or spinner */}
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-neutral-400">
                      {isSearching
                        ? <svg className="animate-spin h-3 w-3 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                        : <Search size={13} />}
                    </span>
                    <input
                      id="search_input"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search"
                      className="border border-neutral-200 rounded text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 font-sans transition-colors min-w-0 w-full"
                      style={{ height: 'clamp(20px, 2vw, 32px)', paddingLeft: 'clamp(24px, 2.5vw, 32px)', paddingRight: 'clamp(20px, 2.2vw, 28px)', fontSize: 'clamp(7px, 0.8vw, 14px)', minWidth: '20px' }}
                    />
                    {/* X clear button — only visible when there is text */}
                    {searchQuery.length > 0 && (
                      <button
                        type="button"
                        id="search_clear_btn"
                        onClick={clearSearch}
                        className="absolute inset-y-0 right-0 pr-2 flex items-center text-neutral-400 hover:text-neutral-700 transition-colors"
                        title="Clear search"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  <button
                    id="search_submit_btn"
                    type="submit"
                    disabled={isSearching}
                    className="flex items-center flex-shrink-0 font-semibold bg-[#7dd3fc] hover:bg-[#38bdf8] disabled:opacity-60 disabled:cursor-not-allowed text-[#000000] rounded shadow-sm cursor-pointer select-none border border-[#38bdf8] transition-all duration-150 font-bold font-sans"
                    style={{ height: 'clamp(20px, 2vw, 32px)', padding: '0 clamp(4px, 0.5vw, 8px)', fontSize: 'clamp(7px, 0.8vw, 14px)', gap: 'clamp(2px, 0.2vw, 4px)' }}
                    title="Find phrase"
                  >
                    <span>{isSearching ? 'Searching…' : 'Search'}</span>
                  </button>
                </form>

                {/* Search result operators */}
                {searchResults.length > 0 && (
                  <div className="flex items-center gap-1 font-sans">
                    <span className="text-sky-950 font-bold bg-sky-100/85 rounded border border-sky-200" style={{ fontSize: 'clamp(7px, 0.8vw, 14px)', marginLeft: 'clamp(2px, 0.3vw, 6px)', padding: 'clamp(2px, 0.3vw, 4px) clamp(4px, 0.6vw, 10px)' }}>
                      {currentSearchIndex + 1} of {searchResults.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleJumpToSearchResult((currentSearchIndex - 1 + searchResults.length) % searchResults.length)}
                      className="flex items-center justify-center border border-neutral-200 bg-white hover:bg-[#f8fafc] text-neutral-800 rounded shadow-sm cursor-pointer"
                      style={{ height: 'clamp(20px, 2vw, 32px)', width: 'clamp(20px, 2vw, 32px)' }}
                      title="Prev Match"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => handleJumpToSearchResult((currentSearchIndex + 1) % searchResults.length)}
                      className="flex items-center justify-center border border-neutral-200 bg-white hover:bg-[#f8fafc] text-neutral-800 rounded shadow-sm cursor-pointer"
                      style={{ height: 'clamp(20px, 2vw, 32px)', width: 'clamp(20px, 2vw, 32px)' }}
                      title="Next Match"
                    >
                      ▼
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* MAIN PDF VIEW AREA - ACTIVE CHANNELS IN MIDDLE */}
            <div className="flex-grow border border-neutral-200 rounded-lg flex flex-col min-h-0 relative overflow-hidden bg-[#edf0f2]">
              {/* Actual Dual-Page Render Arena */}
              <div
                id="pdf_view_area"
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto overflow-x-scroll"
                style={{ overflowAnchor: 'none' }}
              >

                {/* No-document placeholder – shown when the selected section has no linked PDF yet */}
                {activeManualId && !isPdfManual && (
                  <div className="flex-1 flex items-center justify-center w-full h-full min-h-[400px]">
                    <div className="flex flex-col items-center gap-4 text-center select-none" style={{ maxWidth: 'clamp(240px, 28vw, 380px)' }}>
                      <div className="rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center" style={{ width: 'clamp(48px, 5vw, 72px)', height: 'clamp(48px, 5vw, 72px)' }}>
                        <FileText style={{ width: 'clamp(22px, 2.4vw, 36px)', height: 'clamp(22px, 2.4vw, 36px)' }} className="text-neutral-400" />
                      </div>
                      <div>
                        <p className="font-bold text-neutral-600 font-sans" style={{ fontSize: 'clamp(11px, 1.1vw, 16px)', marginBottom: 'clamp(4px, 0.4vw, 8px)' }}>
                          {manualsInfo[activeManualId]?.title || 'This Section'}
                        </p>
                        <p className="text-neutral-400 font-sans" style={{ fontSize: 'clamp(9px, 0.9vw, 13px)' }}>
                          There is no document in this tab yet.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Search error alert dialog */}
                {searchError && (
                  <div className="mx-auto my-4 bg-white border border-neutral-200 rounded-lg shadow-lg text-left overflow-hidden z-20" style={{ maxWidth: 'clamp(300px, 40vw, 450px)', fontSize: 'clamp(7px, 0.8vw, 14px)' }}>
                    <div className="bg-neutral-50 border-b border-neutral-200 font-semibold text-neutral-800 flex justify-between items-center" style={{ padding: 'clamp(4px, 0.5vw, 8px) clamp(8px, 1vw, 16px)' }}>
                      <span>Search Query Outcome</span>
                      <button onClick={() => setSearchError('')} className="text-neutral-400 hover:text-neutral-600 font-bold">
                        <X style={{ width: 'clamp(12px, 1.2vw, 16px)', height: 'clamp(12px, 1.2vw, 16px)' }} />
                      </button>
                    </div>
                    <div className="flex items-start gap-3" style={{ padding: 'clamp(8px, 1vw, 16px)' }}>
                      <div className="rounded-full bg-amber-50 text-amber-500 flex items-center justify-center font-bold shrink-0" style={{ width: 'clamp(24px, 2.5vw, 32px)', height: 'clamp(24px, 2.5vw, 32px)' }}>
                        <ShieldAlert style={{ width: 'clamp(14px, 1.5vw, 20px)', height: 'clamp(14px, 1.5vw, 20px)' }} />
                      </div>
                      <div>
                        <p className="font-bold text-neutral-800" style={{ marginBottom: 'clamp(2px, 0.2vw, 4px)' }}>Database Query Alert</p>
                        <p className="text-neutral-600 line-clamp-2">{searchError}</p>
                      </div>
                    </div>
                    <div className="bg-neutral-50 border-t border-neutral-100 flex justify-end" style={{ padding: 'clamp(4px, 0.5vw, 8px) clamp(8px, 1vw, 16px)' }}>
                      <button onClick={() => setSearchError('')} className="flex items-center justify-center font-semibold bg-[#7dd3fc] hover:bg-[#38bdf8] text-[#000000] rounded shadow-sm cursor-pointer select-none border border-[#38bdf8] transition-colors font-bold font-sans" style={{ height: 'clamp(20px, 2vw, 28px)', padding: '0 clamp(8px, 1vw, 16px)' }}>
                        Close
                      </button>
                    </div>
                  </div>
                )}

                {/* PDF pages rendered in continuous vertical flow (scroll-based) */}
                <div ref={pdfContainerRef} className="w-full py-2">
                  <div className="relative">
                    <div
                      ref={panLayerRef}
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "flex-start",
                        width: "fit-content",
                        minWidth: "100%",

                      }}
                    >
                      {
                        // Precompute stable widths so the grid keeps exact spacing on resize
                        (() => {
                          const baseWidthForPdf = isPdfManual
                            ? safeContainerWidth *
                            ((currentViewMode as any) === 'single'
                              ? VIEW_FIT.single
                              : VIEW_FIT.double)
                            : safeContainerWidth;
                          const visualWidthForGrid = baseWidthForPdf * zoom;
                          const PAGE_GAP_PX = 20; // keep gap-20 equivalent (5rem ~= 80px)

                          if (currentViewMode === 'single') {
                            return (
                              <div className="flex flex-col items-center gap-6">
                                {(!currentManualPages || !Array.isArray(currentManualPages)) ? (
                                  <div className="w-full py-20 text-center text-neutral-500">Loading document...</div>
                                ) : currentManualPages.map((page, idx) => {
                                  const baseWidth = isPdfManual
                                    ? (
                                      currentViewMode === 'single'
                                        ? safeContainerWidth * VIEW_FIT.single
                                        : safeContainerWidth * VIEW_FIT.double
                                    )
                                    : safeContainerWidth;

                                  const visualWidth = baseWidth * zoom;

                                  return (
                                    <div key={page.id} data-page-number={page.pageNumber} data-page-id={page.id} className={isPdfManual ? 'relative select-text flex justify-center' : 'bg-white border border-neutral-200 text-black p-8 relative flex flex-col justify-between rounded-md shadow-md mx-auto'}>
                                      <div style={{ width: `${visualWidth}px`, minHeight: `${Math.max(400, 540)}px` }}>
                                        {isPdfManual ? (
                                          loadingManuals[activeManualId] ? (
                                            <div className="flex-grow flex flex-col items-center justify-center text-xs font-mono text-neutral-500 py-20 min-h-[200px]">
                                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0ea5e9] mb-4"></div>
                                              <span>LOADING PDF...</span>
                                            </div>
                                          ) : pdfDocsMap[activeManualId] ? (
                                            <div className="w-full flex items-center justify-center">
                                              <div style={{ width: `${visualWidth}px` }} className="relative">
                                                {
                                                  // Only mount heavy renderer when this page is marked for loading
                                                }
                                                {((loadedPagesMap[activeManualId] && loadedPagesMap[activeManualId][page.pageNumber]) && pdfDocsMap[activeManualId]) ? (
                                                  <div>
                                                    <PdfPageRenderer
                                                      pdfDoc={pdfDocsMap[activeManualId]}
                                                      pageNumber={page.pageNumber}
                                                      activeSearchTerm={activeSearchTerm}
                                                      activeMatchIndexOnPage={
                                                        selectedResult && selectedResult.pageNumber === page.pageNumber
                                                          ? selectedResult.matchIndexOnPage
                                                          : -1
                                                      }
                                                      width={Math.max(1, baseWidth * zoom)}
                                                      padding={0}
                                                      onHighlightFound={(pageNumber, rect) => {
                                                        activeHighlightRef.current = { pageNumber, ...rect };

                                                        const pageElement = document.querySelector(
                                                          `[data-page-number="${pageNumber}"]`
                                                        ) as HTMLElement | null;

                                                        if (!pageElement || !scrollContainerRef.current) return;
                                                        const container = scrollContainerRef.current;

                                                        // Scroll so the exact highlight rect is centered in the viewer
                                                        const pageOffsetTop = (pageElement as HTMLElement).offsetTop;
                                                        const pageOffsetLeft = (pageElement as HTMLElement).offsetLeft;

                                                        const targetScrollTop = pageOffsetTop + rect.y + rect.h / 2 - container.clientHeight / 2;
                                                        const targetScrollLeft = pageOffsetLeft + rect.x + rect.w / 2 - container.clientWidth / 2;

                                                        container.scrollTo({
                                                          top: Math.max(0, targetScrollTop),
                                                          left: Math.max(0, targetScrollLeft),
                                                          behavior: 'smooth'
                                                        });
                                                      }}
                                                    />
                                                  </div>
                                                ) : (
                                                  <div
                                                    className="page-placeholder w-full h-full flex items-center justify-center bg-neutral-50"
                                                    data-page-number={page.pageNumber}
                                                    style={{ minHeight: `${Math.max(400, 540)}px` }}
                                                  >
                                                    <div className="text-neutral-400 text-xs">Page {page.pageNumber}</div>
                                                  </div>
                                                )}
                                              </div>

                                            </div>
                                          ) : (
                                            <div className="flex-grow flex items-center justify-center text-xs text-red-500 font-semibold min-h-[200px]">
                                              Failed to load PDF document
                                            </div>
                                          )
                                        ) : (
                                          <div>
                                            <div className="border-b border-gray-800 pb-2 mb-4 flex justify-between items-center text-[10px] font-mono text-gray-500">
                                              <span>ELCOM RFT1001 IETM</span>
                                              <span>P. {page.pageNumber}</span>
                                            </div>

                                            <h2 className="text-xs font-mono font-bold text-gray-900 tracking-wide mb-1">
                                              {highlightMatches(page.sectionTitle, activeSearchTerm)}
                                            </h2>
                                            {page.subTitle && (
                                              <h3 className="text-[11px] font-mono text-blue-900 border-b border-dashed border-gray-300 pb-1 mb-3">
                                                {highlightMatches(page.subTitle, activeSearchTerm)}
                                              </h3>
                                            )}

                                            <div className="space-y-3 font-serif text-[11px] leading-relaxed text-gray-800 text-justify">
                                              {page.paragraphs.map((p, pIdx) => (
                                                <p key={pIdx}>
                                                  {highlightMatches(p, activeSearchTerm)}
                                                </p>
                                              ))}
                                            </div>

                                            {page.diagramType && (
                                              <div className="mt-4">
                                                <EngineeringDiagram type={page.diagramType} />
                                              </div>
                                            )}

                                            {page.table && (
                                              <div className="mt-4 win-border-sunken bg-white p-1 overflow-x-auto">
                                                <table className="w-full text-left font-mono text-[9px] border-collapse min-w-[300px]">
                                                  <thead>
                                                    <tr className="bg-gray-200 text-gray-900 border-b border-gray-400 font-bold">
                                                      {page.table.headers.map((h, hIdx) => (
                                                        <th key={hIdx} className="p-1 px-1.5 border border-gray-300">{h}</th>
                                                      ))}
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {page.table.rows.map((row, rIdx) => (
                                                      <tr key={rIdx} className="hover:bg-blue-50 border-b border-gray-200">
                                                        {row.map((cell, cIdx) => (
                                                          <td key={cIdx} className="p-1 px-1.5 border border-gray-200 text-gray-800">
                                                            {highlightMatches(cell, activeSearchTerm)}
                                                          </td>
                                                        ))}
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {!isPdfManual && (
                                          <div className="border-t border-gray-300 pt-2 mt-4 text-[9px] font-mono text-gray-400 flex justify-between select-none">
                                            <span>CONFIDENTIAL - MIL-USE</span>
                                            <span>ELCOM INNOVATIONS</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }

                          // Double-page grid mode: explicit column sizes to preserve gap on resize
                          return (
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(2, ${Math.max(1, visualWidthForGrid)}px)`,
                                columnGap: `${PAGE_GAP_PX}px`,
                                justifyContent: 'center',
                                rowGap: '32px'
                              }}
                            >
                              {(!currentManualPages || !Array.isArray(currentManualPages)) ? (
                                <div className="w-full py-20 text-center text-neutral-500">Loading document...</div>
                              ) : currentManualPages.map((page, idx) => {
                                const baseWidth = isPdfManual
                                  ? ((currentViewMode as any) === 'single'
                                    ? safeContainerWidth
                                    : safeContainerWidth * ((currentViewMode as any) === 'single' ? VIEW_FIT.single : VIEW_FIT.double))
                                  : safeContainerWidth;

                                const visualWidth = baseWidth * zoom;

                                return (
                                  <div key={page.id} data-page-number={page.pageNumber} data-page-id={page.id} className={isPdfManual ? 'relative select-text flex justify-center' : 'bg-white border border-neutral-200 text-black p-8 relative flex flex-col justify-between rounded-md shadow-md mx-auto'}>
                                    <div style={{ width: `${visualWidth}px`, minHeight: `${Math.max(400, 540)}px` }}>
                                      {isPdfManual ? (
                                        loadingManuals[activeManualId] ? (
                                          <div className="flex-grow flex flex-col items-center justify-center text-xs font-mono text-neutral-500 py-20 min-h-[200px]">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0ea5e9] mb-4"></div>
                                            <span>LOADING PDF...</span>
                                          </div>
                                        ) : pdfDocsMap[activeManualId] ? (
                                          <div className="w-full flex items-center justify-center">
                                            <div style={{ width: `${visualWidth}px` }} className="relative">
                                              {((loadedPagesMap[activeManualId] && loadedPagesMap[activeManualId][page.pageNumber]) && pdfDocsMap[activeManualId]) ? (
                                                <PdfPageRenderer
                                                  pdfDoc={pdfDocsMap[activeManualId]}
                                                  pageNumber={page.pageNumber}
                                                  activeSearchTerm={activeSearchTerm}
                                                  activeMatchIndexOnPage={
                                                    selectedResult && selectedResult.pageNumber === page.pageNumber
                                                      ? selectedResult.matchIndexOnPage
                                                      : -1
                                                  }
                                                  width={Math.max(1, baseWidth * zoom)}
                                                  padding={0}
                                                  onHighlightFound={(pageNumber, rect) => {
                                                    const pageElement = document.querySelector(
                                                      `[data-page-number="${pageNumber}"]`
                                                    ) as HTMLElement | null;

                                                    if (!pageElement || !scrollContainerRef.current) return;
                                                    const container = scrollContainerRef.current;

                                                    // Center the exact match rect in the viewer
                                                    const pageOffsetTop = (pageElement as HTMLElement).offsetTop;
                                                    const pageOffsetLeft = (pageElement as HTMLElement).offsetLeft;

                                                    container.scrollTo({
                                                      top: Math.max(0, pageOffsetTop + rect.y + rect.h / 2 - container.clientHeight / 2),
                                                      left: Math.max(0, pageOffsetLeft + rect.x + rect.w / 2 - container.clientWidth / 2),
                                                      behavior: 'smooth'
                                                    });
                                                  }}
                                                />
                                              ) : (
                                                <div
                                                  className="page-placeholder w-full h-full flex items-center justify-center bg-neutral-50"
                                                  data-page-number={page.pageNumber}
                                                  style={{ minHeight: `${Math.max(400, 540)}px` }}
                                                >
                                                  <div className="text-neutral-400 text-xs">Page {page.pageNumber}</div>
                                                </div>
                                              )}
                                            </div>

                                          </div>
                                        ) : (
                                          <div className="flex-grow flex items-center justify-center text-xs text-red-500 font-semibold min-h-[200px]">
                                            Failed to load PDF document
                                          </div>
                                        )
                                      ) : (
                                        <div>
                                          <div className="border-b border-gray-800 pb-2 mb-4 flex justify-between items-center text-[10px] font-mono text-gray-500">
                                            <span>ELCOM RFT1001 IETM</span>
                                            <span>P. {page.pageNumber}</span>
                                          </div>

                                          <h2 className="text-xs font-mono font-bold text-gray-900 tracking-wide mb-1">
                                            {highlightMatches(page.sectionTitle, activeSearchTerm)}
                                          </h2>
                                          {page.subTitle && (
                                            <h3 className="text-[11px] font-mono text-blue-900 border-b border-dashed border-gray-300 pb-1 mb-3">
                                              {highlightMatches(page.subTitle, activeSearchTerm)}
                                            </h3>
                                          )}

                                          <div className="space-y-3 font-serif text-[11px] leading-relaxed text-gray-800 text-justify">
                                            {page.paragraphs.map((p, pIdx) => (
                                              <p key={pIdx}>
                                                {highlightMatches(p, activeSearchTerm)}
                                              </p>
                                            ))}
                                          </div>

                                          {page.diagramType && (
                                            <div className="mt-4">
                                              <EngineeringDiagram type={page.diagramType} />
                                            </div>
                                          )}

                                          {page.table && (
                                            <div className="mt-4 win-border-sunken bg-white p-1 overflow-x-auto">
                                              <table className="w-full text-left font-mono text-[9px] border-collapse min-w-[300px]">
                                                <thead>
                                                  <tr className="bg-gray-200 text-gray-900 border-b border-gray-400 font-bold">
                                                    {page.table.headers.map((h, hIdx) => (
                                                      <th key={hIdx} className="p-1 px-1.5 border border-gray-300">{h}</th>
                                                    ))}
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {page.table.rows.map((row, rIdx) => (
                                                    <tr key={rIdx} className="hover:bg-blue-50 border-b border-gray-200">
                                                      {row.map((cell, cIdx) => (
                                                        <td key={cIdx} className="p-1 px-1.5 border border-gray-200 text-gray-800">
                                                          {highlightMatches(cell, activeSearchTerm)}
                                                        </td>
                                                      ))}
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {!isPdfManual && (
                                        <div className="border-t border-gray-300 pt-2 mt-4 text-[9px] font-mono text-gray-400 flex justify-between select-none">
                                          <span>CONFIDENTIAL - MIL-USE</span>
                                          <span>ELCOM INNOVATIONS</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()
                      }
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Bottom controls removed per layout cleanup - keep PDF viewer as-is */}

          </div>

        </div>

      </div>
    );
  };

  // Cancel speech on unmount and ensure no overlapping speech
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch (e) { }
      }
    };
  }, []);

  // Removed manual measurement and resize handlers. Layout now uses CSS flexbox and
  // relative sizing so panels remain stable during window resize.

  return (
    <div className={`min-h-screen overflow-hidden select-none ${showMainApp ? 'bg-neutral-100' : 'bg-white'}`}>
      {showMainApp ? MainViewerScreen() : IntroScreen()}
    </div>
  );
}
