"use client";

import { useEffect, useRef, useState } from "react";

export default function AppleWatchScrollShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef<number>(1);
  const animationFrameIdRef = useRef<number | null>(null);

  const [loadedCount, setLoadedCount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [fadeLoader, setFadeLoader] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);

  const totalFrames = 192;

  // Helper to format frame numbers as 3-digit strings (001, 002, ..., 192)
  const formatFrameIndex = (index: number) => String(index).padStart(3, "0");

  // Draw a specific frame onto the canvas
  const drawFrame = (frameIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = imagesRef.current[frameIndex];
    if (!img || !img.complete) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate scaling using the user's Math.min scaling logic
    const scale = Math.min(
      canvas.width / img.width,
      canvas.height / img.height
    );

    const width = img.width * scale;
    const height = img.height * scale;

    const x = (canvas.width - width) / 2;
    const y = (canvas.height - height) / 2;

    ctx.drawImage(img, x, y, width, height);
  };

  // Safe frame draw wrapper using requestAnimationFrame
  const requestFrameUpdate = (frameIndex: number) => {
    if (currentFrameRef.current === frameIndex) return;
    currentFrameRef.current = frameIndex;

    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }

    animationFrameIdRef.current = requestAnimationFrame(() => {
      drawFrame(frameIndex);
    });
  };

  // Preload all 192 images on mount
  useEffect(() => {
    let active = true;
    let loaded = 0;

    const preloadImages = async () => {
      const promises = Array.from({ length: totalFrames }, (_, i) => {
        return new Promise<void>((resolve) => {
          const index = i + 1;
          const img = new window.Image();
          img.src = `/${formatFrameIndex(index)}.png`;
          imagesRef.current[index] = img;

          img.onload = () => {
            if (!active) return;
            loaded++;
            setLoadedCount(loaded);
            resolve();
          };

          img.onerror = () => {
            if (!active) return;
            console.warn(`Failed to load frame ${index}`);
            loaded++;
            setLoadedCount(loaded);
            resolve();
          };
        });
      });

      await Promise.all(promises);

      if (active) {
        setIsLoaded(true);
        // Start fading the loader out
        setTimeout(() => {
          setFadeLoader(true);
          // Unmount loader completely after animation completes
          setTimeout(() => {
            setShowLoader(false);
          }, 600);
        }, 300);
      }
    };

    preloadImages();

    return () => {
      active = false;
    };
  }, []);

  // Handle resizing and initial draw
  useEffect(() => {
    if (!isLoaded) return;

    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // Set internal rendering dimensions to match container exactly (high DPI)
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      // Redraw the current frame immediately
      drawFrame(currentFrameRef.current);
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isLoaded]);

  // Handle scroll listener to scrub through frames and update scroll progress state
  useEffect(() => {
    if (!isLoaded) return;

    const handleScroll = () => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const totalScrollable = rect.height - window.innerHeight;

      if (totalScrollable <= 0) return;

      // Calculate progress while this section is active/pinned (0.0 to 1.0)
      const scrollTop = -rect.top;
      const progress = Math.max(0, Math.min(1, scrollTop / totalScrollable));
      setScrollProgress(progress);

      // Phase 1: Scroll 0% to 20% -> Keep watch static on frame 1 (Hero Landing)
      // Phase 2: Scroll 20% to 85% -> Rotate watch 360 deg (frame 1 to 192)
      // Phase 3: Scroll 85% to 100% -> Hold on frame 192 (Annotations active)
      let targetFrame = 1;
      if (progress > 0.2 && progress < 0.85) {
        const activeProgress = (progress - 0.2) / 0.65;
        targetFrame = Math.max(
          1,
          Math.min(totalFrames, Math.floor(activeProgress * (totalFrames - 1)) + 1)
        );
      } else if (progress >= 0.85) {
        targetFrame = totalFrames;
      }

      requestFrameUpdate(targetFrame);
    };

    window.addEventListener("scroll", handleScroll);
    // Draw initial frame
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isLoaded]);

  const percentage = Math.round((loadedCount / totalFrames) * 100);

  // Interpolate opacity and translates for hero section columns based on scroll progress (0.0 to 0.20)
  const heroOpacity = Math.max(0, Math.min(1, (0.15 - scrollProgress) / 0.15));
  const heroTranslateY = scrollProgress * -100; // Translate upwards slightly as we scroll

  // Calculate annotation opacity: visible only during Phase 3 (progress >= 0.85)
  // and when the current frame is one of the last 4 frames (frame >= 189)
  const isLast4Frames = currentFrameRef.current >= 189;
  let annotationOpacity = 0;
  if (isLast4Frames && scrollProgress >= 0.85) {
    annotationOpacity = Math.max(0, Math.min(1, (scrollProgress - 0.85) / 0.08)); // Fade in over 8% scroll distance
  }

  // Story 1: Visible 25% to 42%
  let story1Opacity = 0;
  if (scrollProgress >= 0.25 && scrollProgress <= 0.42) {
    if (scrollProgress < 0.29) {
      story1Opacity = (scrollProgress - 0.25) / 0.04;
    } else if (scrollProgress > 0.38) {
      story1Opacity = (0.42 - scrollProgress) / 0.04;
    } else {
      story1Opacity = 1;
    }
  }
  const story1TranslateY = (scrollProgress - 0.335) * -120; // vertical translation for parallax

  // Story 2: Visible 45% to 62%
  let story2Opacity = 0;
  if (scrollProgress >= 0.45 && scrollProgress <= 0.62) {
    if (scrollProgress < 0.49) {
      story2Opacity = (scrollProgress - 0.45) / 0.04;
    } else if (scrollProgress > 0.58) {
      story2Opacity = (0.62 - scrollProgress) / 0.04;
    } else {
      story2Opacity = 1;
    }
  }
  const story2TranslateY = (scrollProgress - 0.535) * -120;

  // Story 3: Visible 65% to 82%
  let story3Opacity = 0;
  if (scrollProgress >= 0.65 && scrollProgress <= 0.82) {
    if (scrollProgress < 0.69) {
      story3Opacity = (scrollProgress - 0.65) / 0.04;
    } else if (scrollProgress > 0.78) {
      story3Opacity = (0.82 - scrollProgress) / 0.04;
    } else {
      story3Opacity = 1;
    }
  }
  const story3TranslateY = (scrollProgress - 0.735) * -120;

  return (
    <div className="relative w-full bg-[#030303]">
      {/* 1. SCROLL ROTATION CONTAINER */}
      <div
        ref={containerRef}
        className="relative w-full h-[500vh]"
        style={{ contentVisibility: "auto" }}
      >
        {/* Sticky container for the full screen viewport */}
        <div className="sticky top-0 left-0 w-full h-screen overflow-hidden flex flex-col items-center justify-center bg-[#030303]">
          
          {/* HEADER FIXED NAVIGATION (Only visible on initial scroll phase) */}
          <header 
            className="absolute top-0 left-0 w-full z-30 flex items-center justify-between px-6 md:px-16 py-6 border-b border-zinc-900/40 bg-gradient-to-b from-[#030303]/80 to-transparent backdrop-blur-sm transition-opacity duration-500 pointer-events-auto"
            style={{ opacity: heroOpacity }}
          >
            {/* OMEGA Logo */}
            <div className="flex flex-col items-start select-none">
              <span className="text-xl md:text-2xl font-light tracking-[0.2em] leading-none text-white font-sans">Ω</span>
              <span className="text-[10px] md:text-xs font-bold tracking-[0.3em] uppercase leading-none mt-1 text-zinc-100 font-sans">OMEGA</span>
            </div>

            {/* Navigation links */}
            <nav className="hidden md:flex items-center gap-10 text-[11px] font-semibold tracking-[0.25em] text-zinc-400 font-sans">
              <a href="#" className="hover:text-white transition-colors">COLLECTION</a>
              <a href="#" className="hover:text-white transition-colors">CRAFTSMANSHIP</a>
              <a href="#" className="hover:text-white transition-colors">MOVEMENT</a>
              <a href="#" className="hover:text-white transition-colors">STORY</a>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-8 text-[11px] font-semibold tracking-[0.25em] text-zinc-400 font-sans">
              <a href="#" className="hover:text-white transition-colors hidden sm:block">SEARCH</a>
              <button className="flex items-center gap-3 hover:text-white transition-colors">
                <span>MENU</span>
                <svg className="w-5 h-4 text-zinc-300" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 3h16M2 8h16M2 13h16" />
                </svg>
              </button>
            </div>
          </header>

          {/* Full-screen canvas */}
          <canvas
            ref={canvasRef}
            className="relative z-10 w-full h-full object-contain bg-[#030303] transition-opacity duration-1000 ease-out"
            style={{ opacity: isLoaded ? 1 : 0 }}
          />

          {/* ANNOTATIONS OVERLAY (Only visible during annotation phase) */}
          <div 
            className="absolute inset-0 z-20 pointer-events-none transition-opacity duration-500 hidden lg:block"
            style={{ 
              opacity: annotationOpacity,
              pointerEvents: annotationOpacity <= 0 ? "none" : "auto" 
            }}
          >
            {/* SVG Pointer Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {/* Left Side Lines */}
              {/* Sapphire Crystal */}
              <circle cx="47.5%" cy="44%" r="3" fill="#c5a880" />
              <circle cx="47.5%" cy="44%" r="6" fill="none" stroke="#c5a880" strokeWidth="0.5" />
              <line x1="22%" y1="28%" x2="47.5%" y2="44%" stroke="#c5a880" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
              <circle cx="22%" cy="28%" r="3.5" fill="none" stroke="#c5a880" strokeWidth="1.5" />

              {/* Co-Axial Escapement */}
              <circle cx="46%" cy="52%" r="3" fill="#c5a880" />
              <circle cx="46%" cy="52%" r="6" fill="none" stroke="#c5a880" strokeWidth="0.5" />
              <line x1="22%" y1="48%" x2="46%" y2="52%" stroke="#c5a880" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
              <circle cx="22%" cy="48%" r="3.5" fill="none" stroke="#c5a880" strokeWidth="1.5" />

              {/* Titanium Case */}
              <circle cx="42%" cy="58%" r="3" fill="#c5a880" />
              <circle cx="42%" cy="58%" r="6" fill="none" stroke="#c5a880" strokeWidth="0.5" />
              <line x1="22%" y1="68%" x2="42%" y2="58%" stroke="#c5a880" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
              <circle cx="22%" cy="68%" r="3.5" fill="none" stroke="#c5a880" strokeWidth="1.5" />


              {/* Right Side Lines */}
              {/* Tachymeter Bezel */}
              <circle cx="56.5%" cy="31%" r="3" fill="#c5a880" />
              <circle cx="56.5%" cy="31%" r="6" fill="none" stroke="#c5a880" strokeWidth="0.5" />
              <line x1="78%" y1="22%" x2="56.5%" y2="31%" stroke="#c5a880" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
              <circle cx="78%" cy="22%" r="3.5" fill="none" stroke="#c5a880" strokeWidth="1.5" />

              {/* Chronograph Pushers */}
              <circle cx="61%" cy="42.5%" r="3" fill="#c5a880" />
              <circle cx="61%" cy="42.5%" r="6" fill="none" stroke="#c5a880" strokeWidth="0.5" />
              <line x1="78%" y1="40%" x2="61%" y2="42.5%" stroke="#c5a880" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
              <circle cx="78%" cy="40%" r="3.5" fill="none" stroke="#c5a880" strokeWidth="1.5" />

              {/* Master Chronometer */}
              <circle cx="60.5%" cy="52%" r="3" fill="#c5a880" />
              <circle cx="60.5%" cy="52%" r="6" fill="none" stroke="#c5a880" strokeWidth="0.5" />
              <line x1="78%" y1="58%" x2="60.5%" y2="52%" stroke="#c5a880" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
              <circle cx="78%" cy="58%" r="3.5" fill="none" stroke="#c5a880" strokeWidth="1.5" />

              {/* 50M Water Resistant */}
              <circle cx="54%" cy="77%" r="3" fill="#c5a880" />
              <circle cx="54%" cy="77%" r="6" fill="none" stroke="#c5a880" strokeWidth="0.5" />
              <line x1="78%" y1="76%" x2="54%" y2="77%" stroke="#c5a880" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
              <circle cx="78%" cy="76%" r="3.5" fill="none" stroke="#c5a880" strokeWidth="1.5" />
            </svg>

            {/* Left Side Callout Cards */}
            <div className="absolute right-[78%] top-[28%] -translate-y-1/2 text-right pr-6 flex flex-col gap-1 select-none">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[10px] md:text-[11px] font-bold tracking-[0.2em] text-white font-sans uppercase">
                  SAPPHIRE CRYSTAL
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#c5a880]" />
              </div>
              <p className="text-[10px] md:text-[11px] text-zinc-500 font-light leading-relaxed font-sans max-w-[200px] ml-auto">
                Scratch-resistant sapphire crystal with anti-reflective treatment.
              </p>
            </div>

            <div className="absolute right-[78%] top-[48%] -translate-y-1/2 text-right pr-6 flex flex-col gap-1 select-none">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[10px] md:text-[11px] font-bold tracking-[0.2em] text-white font-sans uppercase">
                  CO-AXIAL ESCAPEMENT
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#c5a880]" />
              </div>
              <p className="text-[10px] md:text-[11px] text-zinc-500 font-light leading-relaxed font-sans max-w-[200px] ml-auto">
                Revolutionary escapement for long-term precision and reduced friction.
              </p>
            </div>

            <div className="absolute right-[78%] top-[68%] -translate-y-1/2 text-right pr-6 flex flex-col gap-1 select-none">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[10px] md:text-[11px] font-bold tracking-[0.2em] text-white font-sans uppercase">
                  TITANIUM CASE
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#c5a880]" />
              </div>
              <p className="text-[10px] md:text-[11px] text-zinc-500 font-light leading-relaxed font-sans max-w-[200px] ml-auto">
                Crafted in grade 5 titanium case for maximum strength and lightness.
              </p>
            </div>


            {/* Right Side Callout Cards */}
            <div className="absolute left-[78%] top-[22%] -translate-y-1/2 text-left pl-6 flex flex-col gap-1 select-none">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c5a880]" />
                <span className="text-[10px] md:text-[11px] font-bold tracking-[0.2em] text-white font-sans uppercase">
                  TACHYMETER BEZEL
                </span>
              </div>
              <p className="text-[10px] md:text-[11px] text-zinc-500 font-light leading-relaxed font-sans max-w-[200px]">
                Measure speed with precision using the engraved tachymeter scale.
              </p>
            </div>

            <div className="absolute left-[78%] top-[40%] -translate-y-1/2 text-left pl-6 flex flex-col gap-1 select-none">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c5a880]" />
                <span className="text-[10px] md:text-[11px] font-bold tracking-[0.2em] text-white font-sans uppercase">
                  CHRONOGRAPH PUSHERS
                </span>
              </div>
              <p className="text-[10px] md:text-[11px] text-zinc-500 font-light leading-relaxed font-sans max-w-[200px]">
                Start, stop and reset your timing with tactile precision.
              </p>
            </div>

            <div className="absolute left-[78%] top-[58%] -translate-y-1/2 text-left pl-6 flex flex-col gap-1 select-none">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c5a880]" />
                <span className="text-[10px] md:text-[11px] font-bold tracking-[0.2em] text-white font-sans uppercase">
                  MASTER CHRONOMETER
                </span>
              </div>
              <p className="text-[10px] md:text-[11px] text-zinc-500 font-light leading-relaxed font-sans max-w-[200px]">
                Certified for unmatched accuracy, performance and magnetic resistance.
              </p>
            </div>

            <div className="absolute left-[78%] top-[76%] -translate-y-1/2 text-left pl-6 flex flex-col gap-1 select-none">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c5a880]" />
                <span className="text-[10px] md:text-[11px] font-bold tracking-[0.2em] text-white font-sans uppercase">
                  50M WATER RESISTANT
                </span>
              </div>
              <p className="text-[10px] md:text-[11px] text-zinc-500 font-light leading-relaxed font-sans max-w-[200px]">
                Engineered for durability and everyday reliability.
              </p>
            </div>

          </div>

          {/* HERO LEFT COLUMN OVERLAY */}
          <div
            className="absolute left-6 md:left-16 lg:left-24 top-[22%] md:top-[30%] z-20 flex flex-col gap-6 text-left max-w-[85%] md:max-w-sm pointer-events-auto transition-transform duration-100 ease-out select-none"
            style={{
              opacity: heroOpacity,
              transform: `translateY(${heroTranslateY}px)`,
              pointerEvents: heroOpacity <= 0 ? "none" : "auto",
            }}
          >
            <span className="text-[10px] md:text-xs font-bold tracking-[0.25em] text-[#c5a880] uppercase">
              SPEEDMASTER PROFESSIONAL
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl tracking-wide font-extralight text-white leading-[1.1] font-sans">
              A LEGEND <br />
              <span className="text-[#c5a880] font-light">IN TIME</span>
            </h1>
            <p className="text-xs md:text-sm text-zinc-500 font-light leading-relaxed font-sans max-w-[320px]">
              The first watch worn on the Moon. An icon of precision, durability, and human achievement.
            </p>
            <a
              href="#"
              className="inline-flex items-center justify-between border border-zinc-800 hover:border-[#c5a880] text-white text-[10px] md:text-xs tracking-[0.2em] font-semibold uppercase px-6 py-4 mt-2 max-w-[260px] group transition-all duration-300 bg-black/20 backdrop-blur-md font-sans"
            >
              <span>EXPLORE THE COLLECTION</span>
              <span className="transform group-hover:translate-x-1 transition-transform duration-300">→</span>
            </a>
          </div>

          {/* HERO RIGHT COLUMN OVERLAY (Stats Stack) */}
          <div
            className="absolute right-6 md:right-16 lg:right-24 top-[26%] md:top-[30%] z-20 hidden sm:flex flex-col gap-8 text-right pointer-events-auto transition-transform duration-100 ease-out select-none"
            style={{
              opacity: heroOpacity,
              transform: `translateY(${heroTranslateY}px)`,
              pointerEvents: heroOpacity <= 0 ? "none" : "auto",
            }}
          >
            <div className="flex flex-col gap-1 border-b border-zinc-900/60 pb-5">
              <span className="text-lg md:text-xl font-light text-white tracking-[0.1em]">1957</span>
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#c5a880]">HERITAGE</span>
            </div>
            
            <div className="flex flex-col gap-1 border-b border-zinc-900/60 pb-5">
              <span className="text-lg md:text-xl font-light text-white tracking-[0.1em] uppercase">MOONWATCH</span>
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#c5a880]">FLIGHT CERTIFIED</span>
            </div>

            <div className="flex flex-col gap-1 border-b border-zinc-900/60 pb-5">
              <span className="text-lg md:text-xl font-light text-white tracking-[0.05em] uppercase">CO-AXIAL</span>
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#c5a880]">MASTER CHRONOMETER</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-lg md:text-xl font-light text-white tracking-[0.1em]">50M</span>
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#c5a880]">WATER RESISTANT</span>
            </div>
          </div>

          {/* STORY OVERLAY 1 (Left side, scroll 25% - 42%) */}
          <div
            className="absolute left-6 md:left-16 lg:left-24 top-[35%] md:top-[40%] -translate-y-1/2 z-20 flex flex-col gap-4 text-left max-w-[85%] md:max-w-sm pointer-events-none transition-transform duration-500 ease-out select-none"
            style={{
              opacity: story1Opacity,
              transform: `translateY(${story1TranslateY}px)`,
              pointerEvents: story1Opacity <= 0 ? "none" : "auto",
            }}
          >
            <span className="text-[10px] md:text-xs font-bold tracking-[0.25em] text-[#c5a880] uppercase">
              ENGINEERED FOR THE MOON
            </span>
            <h2 className="text-2xl md:text-3xl lg:text-4xl tracking-wide font-extralight text-white leading-tight font-sans">
              A time-tested legend. <br />
              <span className="text-[#c5a880] font-light">Ready for anything.</span>
            </h2>
            <p className="text-[11px] md:text-xs text-zinc-500 font-light leading-relaxed font-sans max-w-[280px]">
              Having survived extreme temperatures and space vacuum, the Speedmaster represents human curiosity.
            </p>
          </div>

          {/* STORY OVERLAY 2 (Right side, scroll 45% - 62%) */}
          <div
            className="absolute right-6 md:right-16 lg:right-24 top-[35%] md:top-[40%] -translate-y-1/2 z-20 flex flex-col gap-4 text-right items-end max-w-[85%] md:max-w-sm pointer-events-none transition-transform duration-500 ease-out select-none"
            style={{
              opacity: story2Opacity,
              transform: `translateY(${story2TranslateY}px)`,
              pointerEvents: story2Opacity <= 0 ? "none" : "auto",
            }}
          >
            <span className="text-[10px] md:text-xs font-bold tracking-[0.25em] text-[#c5a880] uppercase">
              UNCOMPROMISING MATERIALS
            </span>
            <h2 className="text-2xl md:text-3xl lg:text-4xl tracking-wide font-extralight text-white leading-tight font-sans">
              Grade 5 Titanium. <br />
              <span className="text-[#c5a880] font-light">Unmatched lightness.</span>
            </h2>
            <p className="text-[11px] md:text-xs text-zinc-500 font-light leading-relaxed font-sans max-w-[280px]">
              Brushed finish cases that resist corrosion while being significantly lighter than steel.
            </p>
          </div>

          {/* STORY OVERLAY 3 (Left side, scroll 65% - 82%) */}
          <div
            className="absolute left-6 md:left-16 lg:left-24 top-[35%] md:top-[40%] -translate-y-1/2 z-20 flex flex-col gap-4 text-left max-w-[85%] md:max-w-sm pointer-events-none transition-transform duration-500 ease-out select-none"
            style={{
              opacity: story3Opacity,
              transform: `translateY(${story3TranslateY}px)`,
              pointerEvents: story3Opacity <= 0 ? "none" : "auto",
            }}
          >
            <span className="text-[10px] md:text-xs font-bold tracking-[0.25em] text-[#c5a880] uppercase">
              THE HEART OF PRECISION
            </span>
            <h2 className="text-2xl md:text-3xl lg:text-4xl tracking-wide font-extralight text-white leading-tight font-sans">
              Co-Axial Chronometer. <br />
              <span className="text-[#c5a880] font-light">Caliber 3861.</span>
            </h2>
            <p className="text-[11px] md:text-xs text-zinc-500 font-light leading-relaxed font-sans max-w-[280px]">
              Providing antimagnetic resistance to fields up to 15,000 gauss with chronometric certification.
            </p>
          </div>

          {/* Floating Subtle Scroll Indicator (Ticking Line style) */}
          <div
            className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3 pointer-events-none transition-opacity duration-300"
            style={{ opacity: heroOpacity }}
          >
            <span className="text-zinc-500 font-sans text-[10px] tracking-[0.25em] uppercase">
              SCROLL TO EXPERIENCE
            </span>
            <div className="w-[1px] h-12 bg-gradient-to-b from-zinc-800 to-transparent relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1/2 bg-[#c5a880] animate-scroll-line" />
            </div>
          </div>

        </div>
      </div>

      {/* 2. SUB-HERO DETAILS SECTION (BUILT FOR GREATNESS) */}
      <section className="relative w-full min-h-screen bg-[#030303] border-t border-zinc-900/80 px-6 md:px-16 py-24 md:py-36 z-30 flex items-center justify-center">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          
          {/* Left Column: Premium Close-up Detail Container (No border or bg box) */}
          <div className="relative w-full h-[320px] sm:h-[450px] md:h-[520px] overflow-hidden flex items-center justify-center group">
            {/* Ambient lighting inside frame */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(197,168,128,0.03)_0%,transparent_60%)] z-10 pointer-events-none" />
            {/* Zoomed close-up of watch image frame 001 */}
            <div 
              className="absolute inset-0 bg-no-repeat bg-center transition-transform duration-[4000ms] ease-out group-hover:scale-105"
              style={{ 
                backgroundImage: "url('/001.png')",
                backgroundSize: '240%',
                backgroundPosition: '40% 45%'
              }}
            />
            {/* Dark vignette overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/80 z-10 pointer-events-none" />
          </div>

          {/* Right Column: Features and Copy */}
          <div className="flex flex-col text-left">
            <span className="text-[10px] md:text-xs font-bold tracking-[0.25em] text-[#c5a880] uppercase mb-4">
              SPEEDMASTER DESIGN DETAILS
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extralight tracking-wide text-white leading-tight font-sans mb-6">
              BUILT FOR <br />
              <span className="text-[#c5a880] font-light">GREATNESS</span>
            </h2>
            <div className="w-16 h-[1px] bg-[#c5a880] mb-8" />
            
            <p className="text-xs md:text-sm text-zinc-400 font-light leading-relaxed font-sans max-w-md mb-12">
              Every detail is engineered for performance. From the robust steel case to the chronometer movement, every single element represents our watchmaking legacy.
            </p>

            {/* Features 4-column-like Grid list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10">
              
              {/* Feature 1: PRECISION */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  <svg className="w-6 h-6 text-[#c5a880]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                  </svg>
                </div>
                <div className="flex flex-col gap-1.5">
                  <h4 className="text-[11px] font-bold tracking-[0.2em] text-white uppercase font-sans">
                    PRECISION
                  </h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-sans font-light">
                    Master Chronometer certified for unmatched accuracy.
                  </p>
                </div>
              </div>

              {/* Feature 2: DURABILITY */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  <svg className="w-6 h-6 text-[#c5a880]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div className="flex flex-col gap-1.5">
                  <h4 className="text-[11px] font-bold tracking-[0.2em] text-white uppercase font-sans">
                    DURABILITY
                  </h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-sans font-light">
                    Built to withstand extreme conditions, on Earth and beyond.
                  </p>
                </div>
              </div>

              {/* Feature 3: HERITAGE */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  <svg className="w-6 h-6 text-[#c5a880]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    <path d="M2 12h20" />
                  </svg>
                </div>
                <div className="flex flex-col gap-1.5">
                  <h4 className="text-[11px] font-bold tracking-[0.2em] text-white uppercase font-sans">
                    HERITAGE
                  </h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-sans font-light">
                    Over six decades of pioneering watchmaking.
                  </p>
                </div>
              </div>

              {/* Feature 4: CRAFTSMANSHIP */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  <svg className="w-6 h-6 text-[#c5a880]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" />
                  </svg>
                </div>
                <div className="flex flex-col gap-1.5">
                  <h4 className="text-[11px] font-bold tracking-[0.2em] text-white uppercase font-sans">
                    CRAFTSMANSHIP
                  </h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-sans font-light">
                    Expertly finished with the finest materials.
                  </p>
                </div>
              </div>

            </div>

            <a
              href="#"
              className="inline-flex items-center gap-3 text-[#c5a880] hover:text-white text-[10px] md:text-xs tracking-[0.2em] font-semibold uppercase mt-12 group transition-all duration-300 font-sans"
            >
              <span>DISCOVER MORE</span>
              <span className="transform group-hover:translate-x-1.5 transition-transform duration-300">→</span>
            </a>
          </div>

        </div>
      </section>

      {/* Luxury Preloader Overlay */}
      {showLoader && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#030303] transition-all duration-700 ease-in-out ${
            fadeLoader ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
          }`}
        >
          {/* Glowing Ring Loader */}
          <div className="relative w-32 h-32 flex items-center justify-center mb-8">
            <div className="absolute inset-0 rounded-full border border-zinc-900" />
            <div
              className="absolute inset-0 rounded-full border-t-2 border-[#c5a880] animate-spin"
              style={{ animationDuration: "1.5s" }}
            />
            <div className="text-zinc-300 font-mono text-lg font-light">
              {percentage}%
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <h2 className="text-white font-mono text-sm tracking-[0.3em] uppercase font-light">
              Refining Precision
            </h2>
            <p className="text-zinc-500 font-mono text-xs tracking-wider">
              Caching {loadedCount} of {totalFrames} watch frames
            </p>
          </div>

          {/* Simple progress bar */}
          <div className="w-48 h-[2px] bg-zinc-900 mt-6 rounded-full overflow-hidden relative">
            <div
              className="absolute left-0 top-0 h-full bg-[#c5a880] transition-all duration-300 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Inject custom animation keyframes for luxury effects */}
      <style jsx global>{`
        @keyframes scroll-line {
          0% {
            transform: translateY(-100%);
          }
          100% {
            transform: translateY(200%);
          }
        }
        .animate-scroll-line {
          animation: scroll-line 2.2s infinite cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
}
