import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Hero3DExperience.jsx
 * Lightweight, procedural, ultra-premium 3D hero experience for
 * Govt. Higher Secondary School Shangus.
 *
 * Core Features:
 * 1. ⚛️ Scientifically Accurate Carbon Atom Orbitals (Z = 6):
 *    - Central Nucleus: Official circular HSS Shangus logo seal enclosed in a 24K gold bezel
 *      with a glowing nuclear energy envelope, symbolizing HSS Shangus at the foundational core of every child.
 *    - Inner Shell (1s²): 2 high-speed Pauli-paired core electrons on a tight orbital ring.
 *    - Outer Valence Shell (2s² 2p²): Ground state Aufbau configuration with 2 electrons in 2s and 2 electrons in 2p.
 *    - Gyroscopically follows mouse location and tilts with quantum relativistic precession.
 * 2. 📖 Open Book of Wisdom:
 *    - Positioned gracefully beside the motto on the left, symbolizing foundational theory, concepts, and scholastic inquiry across all streams (Humanities, Sciences, and others).
 *    - When hovered: cascading fluttering/slipping pages arching upward in elegant fan waves.
 * 3. 🧪 Scientific Laboratory Apparatus (Erlenmeyer Flask of Discovery):
 *    - Positioned gracefully beside the motto on the right, symbolizing experimentation, practical testing, and hands-on innovation across all streams.
 *    - Borosilicate glass with volumetric graduations, glass stirring rod, glowing cyan discovery elixir, and rising effervescent bubbles.
 * 4. Hero buttons maintain a clean, unobstructed layout below the motto.
 */
export default function Hero3DExperience({ className = '', hoveredAction = null }) {
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [webGlSupported, setWebGlSupported] = useState(true);
  const [pinnedAsset, setPinnedAsset] = useState(null); // 'atom' | 'book' | 'flask' | null
  const pinnedAssetRef = useRef(null);
  const dismissedRef = useRef(false);
  const hoveredActionRef = useRef(hoveredAction);

  const handleCloseTooltip = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    dismissedRef.current = true;
    setPinnedAsset(null);
    pinnedAssetRef.current = null;
    if (tooltipRef.current) {
      tooltipRef.current.style.opacity = '0';
      tooltipRef.current.style.pointerEvents = 'none';
    }
  };

  useEffect(() => {
    hoveredActionRef.current = hoveredAction;
  }, [hoveredAction]);

  useEffect(() => {
    pinnedAssetRef.current = pinnedAsset;
  }, [pinnedAsset]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. WebGL Support Detection
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebGlSupported(false);
        return;
      }
    } catch (_) {
      setWebGlSupported(false);
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 2. Setup Scene, Camera, and Renderer
    const scene = new THREE.Scene();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 450;
    const isMobile = width < 768;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = isMobile ? 5.6 : 5.2;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isMobile,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // 3. Studio Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
    scene.add(ambientLight);

    // Key Light: Electric Cyan
    const keyLight = new THREE.DirectionalLight(0x38bdf8, 2.2);
    keyLight.position.set(5, 6, 4);
    scene.add(keyLight);

    // Fill Light: Imperial Warm Gold
    const fillLight = new THREE.DirectionalLight(0xf59e0b, 1.8);
    fillLight.position.set(-5, -3, 3);
    scene.add(fillLight);

    // Dynamic Book Pages Glow Light (aligned with Book beside slogan)
    const bookLight = new THREE.PointLight(0xfef08a, 0, 3.5);
    bookLight.position.set(isMobile ? -2.20 : -4.35, isMobile ? 0.30 : 0.24, 0.5);
    scene.add(bookLight);

    // Master Group
    const masterGroup = new THREE.Group();
    scene.add(masterGroup);

    const baseScale = isMobile ? 0.65 : 0.72;
    masterGroup.scale.set(baseScale, baseScale, baseScale);

    // =========================================================================
    // ASSET 1: ACCURATE CARBON ATOM ORBITALS (Z = 6 ELECTRONS)
    // Centered above the motto and actively glides to follow mouse location!
    // =========================================================================
    const atomAnchor = new THREE.Group();
    const atomHomePos = {
      x: 0,
      y: isMobile ? 0.70 : 1.22,
      z: -0.1
    };
    atomAnchor.position.set(atomHomePos.x, atomHomePos.y, atomHomePos.z);
    atomAnchor.scale.setScalar(isMobile ? 0.52 : 0.58);

    const atomInteractiveGroup = new THREE.Group();
    atomAnchor.add(atomInteractiveGroup);

    // 1A. Load Official Circular HSS Shangus Logo for Nucleus Center
    const textureLoader = new THREE.TextureLoader();
    const logoTexture = textureLoader.load('/logo.png');
    logoTexture.colorSpace = THREE.SRGBColorSpace;

    const logoMat = new THREE.MeshStandardMaterial({
      map: logoTexture,
      transparent: true,
      roughness: 0.25,
      metalness: 0.15,
      emissive: 0xffffff,
      emissiveIntensity: 0.14,
      side: THREE.DoubleSide
    });

    // 1A. Carbon Nucleus: 6 Protons (Red) + 6 Neutrons (Grey/Silver) + Central HSS Shangus Seal
    // Matches the exact scientific Carbon-12 nuclear composition (Z = 6, N = 6, A = 12)
    const protonMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.3,
      metalness: 0.25,
      emissive: 0xb91c1c,
      emissiveIntensity: 0.35
    });
    // 6 Golden/Yellow Neutrons (matching classic atomic model)
    const neutronMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.35,
      metalness: 0.3,
      emissive: 0xb45309,
      emissiveIntensity: 0.3
    });

    const nucleonGeo = new THREE.SphereGeometry(0.065, 12, 12);
    const nucleonCluster = new THREE.Group();
    atomInteractiveGroup.add(nucleonCluster);

    // 6 Red Protons
    const protonPositions = [
      [0.08, 0.07, -0.06],
      [-0.08, -0.07, -0.06],
      [0.09, -0.06, 0.05],
      [-0.09, 0.06, 0.05],
      [0.0, 0.11, 0.0],
      [0.0, -0.11, 0.0]
    ];
    protonPositions.forEach(([px, py, pz]) => {
      const pMesh = new THREE.Mesh(nucleonGeo, protonMat);
      pMesh.position.set(px, py, pz);
      nucleonCluster.add(pMesh);
    });

    // 6 Silver/Grey Neutrons
    const neutronPositions = [
      [-0.07, 0.08, -0.05],
      [0.07, -0.08, -0.05],
      [-0.08, -0.06, 0.06],
      [0.08, 0.06, 0.06],
      [0.0, 0.0, 0.12],
      [0.0, 0.0, -0.12]
    ];
    neutronPositions.forEach(([nx, ny, nz]) => {
      const nMesh = new THREE.Mesh(nucleonGeo, neutronMat);
      nMesh.position.set(nx, ny, nz);
      nucleonCluster.add(nMesh);
    });

    // Circular Disc Medallion (Front & Back Logo) at center face of nucleus
    const logoNucleusCore = new THREE.Group();
    atomInteractiveGroup.add(logoNucleusCore);

    const medalGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.02, 32);
    const medalMesh = new THREE.Mesh(medalGeo, [
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.95, roughness: 0.15 }),
      logoMat,
      logoMat
    ]);
    medalMesh.rotation.x = Math.PI / 2;
    logoNucleusCore.add(medalMesh);

    // 24K Gold Bezel Rim around the logo medal
    const goldBezelMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0x78350f,
      emissiveIntensity: 0.45,
      metalness: 0.95,
      roughness: 0.15
    });
    const bezelGeo = new THREE.TorusGeometry(0.25, 0.016, 16, 48);
    const bezelMesh = new THREE.Mesh(bezelGeo, goldBezelMat);
    logoNucleusCore.add(bezelMesh);

    // Dedicated Logo Spotlight for prominent illumination on hover
    const logoPointLight = new THREE.PointLight(0xffffff, 0, 2.5);
    logoPointLight.position.set(0, 0, 0.5);
    logoNucleusCore.add(logoPointLight);

    // Glowing Nuclear Energy Shell Envelope
    const nucleusGeo = new THREE.SphereGeometry(0.32, 20, 16);
    const nucleusMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.22,
      roughness: 0.2,
      metalness: 0.8
    });
    const nucleusShell = new THREE.Mesh(nucleusGeo, nucleusMat);
    atomInteractiveGroup.add(nucleusShell);

    // -------------------------------------------------------------------------
    // 1B. CARBON 1s SUBSHELL (K-SHELL, n = 1, l = 0) — 1s² (EXACTLY 2 ELECTRONS)
    // Closest ground state spherical orbital carrying 2 Pauli-paired electrons (180°)
    // -------------------------------------------------------------------------
    const innerRingMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.55,
      metalness: 0.9,
      roughness: 0.2
    });
    const innerRingRadius = 0.52;
    const innerRingGeo = new THREE.TorusGeometry(innerRingRadius, 0.010, 12, 52);
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = Math.PI / 3.5;
    innerRing.rotation.y = Math.PI / 6;
    atomInteractiveGroup.add(innerRing);

    // Common Electron Material: Electric Blue/Cyan (matching textbook diagram)
    const electronMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const electronCoreGeo = new THREE.SphereGeometry(0.046, 12, 12);

    // Electron 1 & 2 (1s² core electrons, paired 180° apart)
    const electron1 = new THREE.Mesh(electronCoreGeo, electronMat);
    innerRing.add(electron1);

    const electron2 = new THREE.Mesh(electronCoreGeo, electronMat);
    innerRing.add(electron2);

    // -------------------------------------------------------------------------
    // 1C. CARBON 2s SUBSHELL (L-SHELL, n = 2, l = 0) — 2s² (EXACTLY 2 ELECTRONS)
    // Intermediate spherical shell (radius 0.82) carrying 2 Pauli-paired electrons (180°)
    // -------------------------------------------------------------------------
    const ring2sRadius = 0.82;
    const ring2sGeo = new THREE.TorusGeometry(ring2sRadius, 0.009, 12, 56);
    const ring2sMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x047857,
      emissiveIntensity: 0.5,
      metalness: 0.92,
      roughness: 0.2
    });
    const ring2s = new THREE.Mesh(ring2sGeo, ring2sMat);
    ring2s.rotation.set(-0.35, 0.45, 0.25);
    atomInteractiveGroup.add(ring2s);

    const electron2sGeo = new THREE.SphereGeometry(0.049, 12, 12);
    // Electron 3 & 4 (2s² electrons, paired 180° apart)
    const electron3 = new THREE.Mesh(electron2sGeo, electronMat);
    ring2s.add(electron3);

    const electron4 = new THREE.Mesh(electron2sGeo, electronMat);
    ring2s.add(electron4);

    // -------------------------------------------------------------------------
    // 1D. CARBON 2p SUBSHELL (L-SHELL, n = 2, l = 1) — 2p² (EXACTLY 2 ELECTRONS)
    // By Hund's rule, 2 electrons occupy separate orthogonal 2p orbitals (2p_x¹, 2p_y¹)
    // along 3D spatial axes at outer radius 1.12 (with translucent 2p_z⁰ guide ring)
    // -------------------------------------------------------------------------
    const ring2pRadius = 1.12;
    const ring2pGeo = new THREE.TorusGeometry(ring2pRadius, 0.0085, 12, 60);

    // 2p_x Orbital Plane (Amethyst Purple)
    const ring2pxMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.5,
      metalness: 0.92,
      roughness: 0.2
    });
    const ring2px = new THREE.Mesh(ring2pGeo, ring2pxMat);
    ring2px.rotation.set(0.95, -0.55, -0.45);
    atomInteractiveGroup.add(ring2px);

    const electron2pGeo = new THREE.SphereGeometry(0.051, 12, 12);
    // Valence Electron 5: 2p_x¹ orbital (1 electron)
    const electron5 = new THREE.Mesh(electron2pGeo, electronMat);
    ring2px.add(electron5);

    // 2p_y Orbital Plane (Amber Gold)
    const ring2pyMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.5,
      metalness: 0.92,
      roughness: 0.2
    });
    const ring2py = new THREE.Mesh(ring2pGeo, ring2pyMat);
    ring2py.rotation.set(-0.82, 0.60, 0.45);
    atomInteractiveGroup.add(ring2py);

    // Valence Electron 6: 2p_y¹ orbital (1 electron)
    const electron6 = new THREE.Mesh(electron2pGeo, electronMat);
    ring2py.add(electron6);

    // 2p_z Guide Ring (Unoccupied ground-state orbital completing 3D p-triplet)
    const ring2pzMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.22,
      metalness: 0.9,
      roughness: 0.25
    });
    const ring2pz = new THREE.Mesh(ring2pGeo, ring2pzMat);
    ring2pz.rotation.set(0.25, 0.85, -0.65);
    atomInteractiveGroup.add(ring2pz);

    masterGroup.add(atomAnchor);

    // =========================================================================
    // ASSET 2: OPEN BOOK OF WISDOM
    // Flanking "nurturing minds, shaping futures" on the Left
    // =========================================================================
    const bookAnchor = new THREE.Group();
    const bookHomePos = {
      x: isMobile ? -2.20 : -4.35,
      y: isMobile ? 0.30 : 0.24,
      z: isMobile ? 0.12 : 0.22
    };
    bookAnchor.position.set(bookHomePos.x, bookHomePos.y, bookHomePos.z);
    bookAnchor.scale.setScalar(isMobile ? 0.28 : 0.38);

    const bookMeshGroup = new THREE.Group();
    bookMeshGroup.rotation.set(0.38, 0.42, -0.18);
    bookAnchor.add(bookMeshGroup);

    // Materials: Moroccan Crimson Leather & Antique Parchment
    const coverMat = new THREE.MeshStandardMaterial({
      color: 0x881337,
      emissive: 0x4c0519,
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.25
    });

    const staticPageMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xfef08a,
      emissiveIntensity: 0.08,
      roughness: 0.35,
      metalness: 0.08
    });

    const activeFlippingPageMat = new THREE.MeshStandardMaterial({
      color: 0xfffef5,
      emissive: 0xfef08a,
      emissiveIntensity: 0.18,
      roughness: 0.3,
      metalness: 0.06,
      side: THREE.DoubleSide
    });

    const goldGiltMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0x92400e,
      emissiveIntensity: 0.45,
      metalness: 0.9,
      roughness: 0.2
    });

    // Base Covers
    const coverWingGeo = new THREE.BoxGeometry(0.58, 0.03, 0.78);
    const leftCover = new THREE.Mesh(coverWingGeo, coverMat);
    leftCover.position.set(-0.29, 0, 0);
    leftCover.rotation.z = Math.PI / 10;
    bookMeshGroup.add(leftCover);

    const rightCover = new THREE.Mesh(coverWingGeo, coverMat);
    rightCover.position.set(0.29, 0, 0);
    rightCover.rotation.z = -Math.PI / 10;
    bookMeshGroup.add(rightCover);

    // Base Stack of Bound Pages
    const basePagesGeo = new THREE.BoxGeometry(0.54, 0.055, 0.74);
    const leftBasePages = new THREE.Mesh(basePagesGeo, staticPageMat);
    leftBasePages.position.set(-0.28, 0.035, 0);
    leftBasePages.rotation.z = Math.PI / 10;
    bookMeshGroup.add(leftBasePages);

    const rightBasePages = new THREE.Mesh(basePagesGeo, staticPageMat);
    rightBasePages.position.set(0.28, 0.035, 0);
    rightBasePages.rotation.z = -Math.PI / 10;
    bookMeshGroup.add(rightBasePages);

    // Gilt Edge Trims
    const giltEdgeGeo = new THREE.BoxGeometry(0.014, 0.055, 0.74);
    const leftGilt = new THREE.Mesh(giltEdgeGeo, goldGiltMat);
    leftGilt.position.set(-0.545, 0.035, 0);
    leftGilt.rotation.z = Math.PI / 10;
    bookMeshGroup.add(leftGilt);

    const rightGilt = new THREE.Mesh(giltEdgeGeo, goldGiltMat);
    rightGilt.position.set(0.545, 0.035, 0);
    rightGilt.rotation.z = -Math.PI / 10;
    bookMeshGroup.add(rightGilt);

    // Curved Spine Center
    const spineGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.8, 16, 1, false, 0, Math.PI);
    const spine = new THREE.Mesh(spineGeo, coverMat);
    spine.position.set(0, -0.015, 0);
    spine.rotation.x = Math.PI / 2;
    bookMeshGroup.add(spine);

    // Silk Bookmark Ribbon
    const ribbonGeo = new THREE.BoxGeometry(0.045, 0.008, 0.45);
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xb45309,
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.25
    });
    const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbon.position.set(0.06, 0.07, 0.22);
    ribbon.rotation.set(-0.25, 0.15, -0.1);
    bookMeshGroup.add(ribbon);

    // Multi-Leaf Slipping Pages (Arching upward gracefully in cascading fan waves)
    const numFlippingLeaves = 6;
    const flippingLeaves = [];

    const pageLeafGeo = new THREE.BoxGeometry(0.53, 0.006, 0.73);
    const pageLeafGiltGeo = new THREE.BoxGeometry(0.012, 0.006, 0.73);

    for (let i = 0; i < numFlippingLeaves; i++) {
      const leafPivot = new THREE.Group();
      leafPivot.position.set(0, 0.055, 0);

      const leafMesh = new THREE.Mesh(pageLeafGeo, activeFlippingPageMat);
      leafMesh.position.set(0.265, 0, 0);
      leafPivot.add(leafMesh);

      const leafGilt = new THREE.Mesh(pageLeafGiltGeo, goldGiltMat);
      leafGilt.position.set(0.525, 0, 0);
      leafPivot.add(leafGilt);

      const restAngle = -Math.PI / 10 + (i * 0.011);
      leafPivot.rotation.z = restAngle;

      bookMeshGroup.add(leafPivot);
      flippingLeaves.push({
        pivot: leafPivot,
        mesh: leafMesh,
        restAngle,
        phaseOffset: i * (1.0 / numFlippingLeaves)
      });
    }

    // 2B. Emitted Words & Alphabets of Wisdom (Floating upward like enchanting lore on hover)
    function createWisdomGlyphTexture(text, isWord = false) {
      const canvas = document.createElement('canvas');
      const width = isWord ? 320 : 128;
      const height = 128;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { texture: null, aspect: width / height, text, isWord };

      ctx.clearRect(0, 0, width, height);

      // Deep, radiant golden ambient aura shadow
      ctx.shadowColor = 'rgba(245, 158, 11, 1)';
      ctx.shadowBlur = isWord ? 22 : 28;

      // Bold, regal scholastic typography
      ctx.font = isWord
        ? `bold italic 48px "Cinzel", "Georgia", "Times New Roman", serif`
        : `bold 72px "Cinzel", "Georgia", "Times New Roman", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Contrast border / rim stroke to ensure striking legibility on any theme
      ctx.lineWidth = isWord ? 7 : 9;
      ctx.strokeStyle = 'rgba(180, 83, 9, 0.95)';
      ctx.strokeText(text, width / 2, height / 2);

      // Second intense luminous gold glow layer
      ctx.shadowColor = 'rgba(254, 240, 138, 1)';
      ctx.shadowBlur = 14;

      // Vibrant scholastic gold gradient
      const grad = ctx.createLinearGradient(0, 15, 0, height - 15);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, '#fef08a');
      grad.addColorStop(0.65, '#f59e0b');
      grad.addColorStop(1, '#d97706');

      ctx.fillStyle = grad;
      ctx.fillText(text, width / 2, height / 2);

      // Specular diamond-white core pass for brilliant radiance
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, width / 2, height / 2);

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;

      return {
        texture,
        aspect: width / height,
        text,
        isWord
      };
    }

    const glyphEntries = [
      // Inspiring Words of Wisdom & Knowledge
      { text: 'WISDOM', isWord: true },
      { text: 'LEARN', isWord: true },
      { text: 'TRUTH', isWord: true },
      { text: 'MIND', isWord: true },
      { text: 'KNOW', isWord: true },
      { text: 'READ', isWord: true },
      { text: 'GROW', isWord: true },
      { text: 'THINK', isWord: true },
      { text: 'ASPIRE', isWord: true },
      { text: 'CREATE', isWord: true },
      // Alphabets & Scholastic/Scientific Glyphs
      { text: 'A', isWord: false },
      { text: 'B', isWord: false },
      { text: 'C', isWord: false },
      { text: 'α', isWord: false },
      { text: 'β', isWord: false },
      { text: 'π', isWord: false },
      { text: 'Σ', isWord: false },
      { text: 'Ω', isWord: false },
      { text: 'λ', isWord: false },
      { text: '∞', isWord: false },
      { text: 'φ', isWord: false },
      { text: 'ψ', isWord: false },
      { text: 'e', isWord: false },
      { text: '√', isWord: false },
      { text: 'X', isWord: false },
      { text: 'Y', isWord: false },
      { text: 'Z', isWord: false }
    ];

    const glyphPool = glyphEntries.map(g => createWisdomGlyphTexture(g.text, g.isWord));

    const bookGlyphCount = isMobile ? 12 : 20;
    const bookGlyphParticles = [];

    for (let i = 0; i < bookGlyphCount; i++) {
      const initialGlyph = glyphPool[i % glyphPool.length];
      const spriteMat = new THREE.SpriteMaterial({
        map: initialGlyph.texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.NormalBlending
      });
      const sprite = new THREE.Sprite(spriteMat);

      const pData = {
        sprite,
        aspect: initialGlyph.aspect,
        isWord: initialGlyph.isWord,
        baseScale: initialGlyph.isWord ? 0.22 : 0.20,
        baseX: (Math.random() - 0.5) * 0.44,
        baseZ: (Math.random() - 0.5) * 0.34,
        y: 0.08 + (i / bookGlyphCount) * 1.35,
        speed: 0.22 + Math.random() * 0.16,
        driftX: (Math.random() - 0.5) * 1.8,
        driftZ: (Math.random() - 0.5) * 1.8,
        offset: Math.random() * Math.PI * 2
      };

      sprite.position.set(pData.baseX, pData.y, pData.baseZ);
      const initScale = pData.baseScale * 0.95;
      sprite.scale.set(initScale * pData.aspect, initScale, 1);
      bookAnchor.add(sprite);
      bookGlyphParticles.push(pData);
    }

    masterGroup.add(bookAnchor);

    // =========================================================================
    // ASSET 3: SCIENTIFIC LABORATORY FLASK
    // Flanking "nurturing minds, shaping futures" on the Right
    // Conical Erlenmeyer Flask of Discovery - Borosilicate glass, volumetric
    // graduations, glowing discovery liquid, glass stirring rod, & rising bubbles.
    // =========================================================================
    const flaskAnchor = new THREE.Group();
    const flaskHomePos = {
      x: isMobile ? 2.20 : 4.35,
      y: isMobile ? 0.30 : 0.24,
      z: isMobile ? 0.12 : 0.20
    };
    flaskAnchor.position.set(flaskHomePos.x, flaskHomePos.y, flaskHomePos.z);
    flaskAnchor.scale.setScalar(isMobile ? 0.28 : 0.38);

    const flaskMeshGroup = new THREE.Group();
    flaskMeshGroup.rotation.set(0.22, -0.35, 0.12);
    flaskAnchor.add(flaskMeshGroup);

    // 3A. Ultra-Clear Borosilicate Glass Materials
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xecfeff,
      transmission: 0.88,
      opacity: 0.65,
      transparent: true,
      roughness: 0.08,
      metalness: 0.12,
      ior: 1.52,
      reflectivity: 0.9,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    // Conical Main Flask Body
    const coneGeo = new THREE.CylinderGeometry(0.13, 0.46, 0.64, 32, 1, true);
    const coneMesh = new THREE.Mesh(coneGeo, glassMat);
    flaskMeshGroup.add(coneMesh);

    // Cylindrical Neck
    const neckGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.32, 32, 1, true);
    const neckMesh = new THREE.Mesh(neckGeo, glassMat);
    neckMesh.position.y = 0.48;
    flaskMeshGroup.add(neckMesh);

    // Flared Rim Lip at Top
    const rimGeo = new THREE.TorusGeometry(0.14, 0.024, 16, 32);
    const rimMesh = new THREE.Mesh(rimGeo, glassMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 0.64;
    flaskMeshGroup.add(rimMesh);

    // Base Glass Bottom Plate & Rounded Rim
    const basePlateGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.025, 32);
    const basePlateMesh = new THREE.Mesh(basePlateGeo, glassMat);
    basePlateMesh.position.y = -0.32;
    flaskMeshGroup.add(basePlateMesh);

    const baseRingGeo = new THREE.TorusGeometry(0.45, 0.022, 16, 32);
    const baseRingMesh = new THREE.Mesh(baseRingGeo, glassMat);
    baseRingMesh.rotation.x = Math.PI / 2;
    baseRingMesh.position.y = -0.32;
    flaskMeshGroup.add(baseRingMesh);

    // 3B. Luminescent Discovery Liquid (Cyan-Emerald Scientific Elixir)
    const liquidMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      roughness: 0.15,
      metalness: 0.25,
      transparent: true,
      opacity: 0.82
    });
    const liquidGeo = new THREE.CylinderGeometry(0.24, 0.43, 0.40, 32);
    const liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
    liquidMesh.position.y = -0.11;
    flaskMeshGroup.add(liquidMesh);

    // Top Liquid Meniscus
    const meniscusMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.75,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.92
    });
    const meniscusGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.015, 32);
    const meniscusMesh = new THREE.Mesh(meniscusGeo, meniscusMat);
    meniscusMesh.position.y = 0.09;
    flaskMeshGroup.add(meniscusMesh);

    // 3C. Etched Volumetric Measurement Graduations (50ml, 100ml, 150ml, 200ml)
    const tickMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8
    });
    const tickLevels = [
      { y: -0.22, r: 0.40 },
      { y: -0.11, r: 0.34 },
      { y: 0.00, r: 0.29 },
      { y: 0.11, r: 0.23 }
    ];
    tickLevels.forEach(({ y, r }) => {
      const arcGeo = new THREE.TorusGeometry(r + 0.003, 0.006, 8, 24, Math.PI * 0.7);
      const arcMesh = new THREE.Mesh(arcGeo, tickMat);
      arcMesh.rotation.x = Math.PI / 2;
      arcMesh.rotation.z = Math.PI * 0.15;
      arcMesh.position.y = y;
      flaskMeshGroup.add(arcMesh);
    });

    // 3D. Sleek Borosilicate Stirring Rod
    const rodMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.75
    });
    const rodGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.92, 12);
    const rodMesh = new THREE.Mesh(rodGeo, rodMat);
    rodMesh.position.set(-0.04, 0.28, 0);
    rodMesh.rotation.z = 0.26;
    rodMesh.rotation.x = -0.12;
    flaskMeshGroup.add(rodMesh);

    const rodTipGeo = new THREE.SphereGeometry(0.016, 10, 10);
    const rodTipTop = new THREE.Mesh(rodTipGeo, rodMat);
    rodTipTop.position.set(-0.16, 0.72, 0.05);
    flaskMeshGroup.add(rodTipTop);

    // 3E. Effervescent Rising Micro-Bubbles
    const bubbleCount = 10;
    const bubbleGeo = new THREE.SphereGeometry(0.022, 10, 10);
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85
    });
    const bubbles = [];
    for (let i = 0; i < bubbleCount; i++) {
      const bMesh = new THREE.Mesh(bubbleGeo, bubbleMat);
      const bScale = 0.4 + Math.random() * 0.7;
      bMesh.scale.setScalar(bScale);
      const bData = {
        mesh: bMesh,
        radius: 0.04 + Math.random() * 0.18,
        angle: Math.random() * Math.PI * 2,
        y: -0.28 + Math.random() * 0.36,
        speed: 0.22 + Math.random() * 0.26
      };
      bMesh.position.set(Math.cos(bData.angle) * bData.radius, bData.y, Math.sin(bData.angle) * bData.radius);
      flaskMeshGroup.add(bMesh);
      bubbles.push(bData);
    }

    // 3F. Billowing Effervescent Discovery Fumes & Micro-Sparks (Rising majestically from rim on hover)
    function createVolumetricVaporTexture(isEmerald = false) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      if (isEmerald) {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
        grad.addColorStop(0.18, 'rgba(167, 243, 208, 0.92)');
        grad.addColorStop(0.42, 'rgba(52, 211, 153, 0.68)');
        grad.addColorStop(0.70, 'rgba(16, 185, 129, 0.32)');
        grad.addColorStop(1, 'rgba(16, 185, 129, 0)');
      } else {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
        grad.addColorStop(0.18, 'rgba(165, 243, 252, 0.94)');
        grad.addColorStop(0.42, 'rgba(34, 211, 238, 0.72)');
        grad.addColorStop(0.70, 'rgba(6, 182, 212, 0.38)');
        grad.addColorStop(1, 'rgba(6, 182, 212, 0)');
      }

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);

      const tex = new THREE.CanvasTexture(canvas);
      tex.generateMipmaps = false;
      return tex;
    }

    const vaporCyanTex = createVolumetricVaporTexture(false);
    const vaporEmeraldTex = createVolumetricVaporTexture(true);

    const vaporCount = isMobile ? 18 : 26;
    const vaporParticles = [];

    for (let i = 0; i < vaporCount; i++) {
      const isEmerald = i % 3 === 0;
      const tex = isEmerald ? vaporEmeraldTex : vaporCyanTex;
      const spriteMat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const sprite = new THREE.Sprite(spriteMat);
      const baseScale = 0.16 + Math.random() * 0.12;
      sprite.scale.set(baseScale, baseScale, 1);
      sprite.position.set(0, 0.66, 0);
      flaskMeshGroup.add(sprite);

      vaporParticles.push({
        sprite,
        baseScale,
        y: 0.66 + (i / vaporCount) * 1.05,
        speed: 0.22 + Math.random() * 0.18,
        driftX: (Math.random() - 0.5) * 1.6,
        driftZ: (Math.random() - 0.5) * 1.6,
        rotSpeed: (Math.random() - 0.5) * 0.8,
        baseRot: Math.random() * Math.PI * 2,
        offset: Math.random() * Math.PI * 2
      });
    }

    // Effervescent Micro-Sparks leaping out of reaction
    const vaporSparkCount = 8;
    const vaporSparkGeo = new THREE.SphereGeometry(0.018, 8, 8);
    const vaporSparkMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0
    });
    const vaporSparks = [];
    for (let i = 0; i < vaporSparkCount; i++) {
      const sMesh = new THREE.Mesh(vaporSparkGeo, vaporSparkMat.clone());
      sMesh.position.set(0, 0.66, 0);
      flaskMeshGroup.add(sMesh);
      vaporSparks.push({
        mesh: sMesh,
        y: 0.66 + (i / vaporSparkCount) * 0.8,
        speed: 0.35 + Math.random() * 0.25,
        radius: 0.02 + Math.random() * 0.05,
        angle: Math.random() * Math.PI * 2,
        offset: Math.random() * Math.PI * 2
      });
    }

    // 3G. Internal Point Light (Luminescent Chemical Glow)
    const flaskLight = new THREE.PointLight(0x06b6d4, 0.5, 2.8);
    flaskLight.position.set(0, -0.05, 0.1);
    flaskMeshGroup.add(flaskLight);

    masterGroup.add(flaskAnchor);

    // =========================================================================
    // ASSET 4: AMBIENT CELESTIAL STARDUST PARTICLES
    // =========================================================================
    const particleCount = isMobile ? 26 : 42;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 8.5;
      particlePositions[i + 1] = (Math.random() - 0.5) * 4.8;
      particlePositions[i + 2] = (Math.random() - 0.5) * 3.5;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: isMobile ? 0.038 : 0.052,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    masterGroup.add(particleSystem);

    // =========================================================================
    // 5. INTERACTIVE MOUSE TRACKING ON HERO IMAGE
    // =========================================================================
    let mouseNormX = 0;
    let mouseNormY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;
    let clientMouseX = -9999;
    let clientMouseY = -9999;
    let isAtomHovered = false;
    let isTooltipHovered = false;

    const heroContainerEl = container.closest('.hero-container') || container.parentElement || window;
    const tooltipEl = tooltipRef.current;

    const onTooltipEnter = () => { isTooltipHovered = true; };
    const onTooltipLeave = () => { isTooltipHovered = false; };
    if (tooltipEl) {
      tooltipEl.addEventListener('mouseenter', onTooltipEnter);
      tooltipEl.addEventListener('mouseleave', onTooltipLeave);
    }

    const handlePointerMove = (e) => {
      const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
      const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
      if (clientX === undefined || clientY === undefined) return;

      clientMouseX = clientX;
      clientMouseY = clientY;

      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        targetMouseX = Math.max(-0.5, Math.min(0.5, (clientX - rect.left) / rect.width - 0.5));
        targetMouseY = Math.max(-0.5, Math.min(0.5, (clientY - rect.top) / rect.height - 0.5));
      } else {
        targetMouseX = (clientX / window.innerWidth - 0.5);
        targetMouseY = (clientY / window.innerHeight - 0.5);
      }
    };

    const handlePointerLeave = () => {
      clientMouseX = -9999;
      clientMouseY = -9999;
      targetMouseX = 0;
      targetMouseY = 0;
    };

    const handleContainerClick = (e) => {
      // If clicked on close button or tooltip itself, let the button handle it
      if (e.target && e.target.closest && e.target.closest('.hero-3d-tooltip')) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const atomWorldPos = new THREE.Vector3();
      atomAnchor.getWorldPosition(atomWorldPos);
      const projectedAtom = atomWorldPos.clone().project(camera);
      const atomScreenX = (projectedAtom.x * 0.5 + 0.5) * rect.width;
      const atomScreenY = (-projectedAtom.y * 0.5 + 0.5) * rect.height;

      const bookWorldPos = new THREE.Vector3();
      bookAnchor.getWorldPosition(bookWorldPos);
      const projectedBook = bookWorldPos.clone().project(camera);
      const bookScreenX = (projectedBook.x * 0.5 + 0.5) * rect.width;
      const bookScreenY = (-projectedBook.y * 0.5 + 0.5) * rect.height;

      const flaskWorldPos = new THREE.Vector3();
      flaskAnchor.getWorldPosition(flaskWorldPos);
      const projectedFlask = flaskWorldPos.clone().project(camera);
      const flaskScreenX = (projectedFlask.x * 0.5 + 0.5) * rect.width;
      const flaskScreenY = (-projectedFlask.y * 0.5 + 0.5) * rect.height;

      const distAtom = Math.hypot(clickX - atomScreenX, clickY - atomScreenY);
      const distBook = Math.hypot(clickX - bookScreenX, clickY - bookScreenY);
      const distFlask = Math.hypot(clickX - flaskScreenX, clickY - flaskScreenY);

      const threshold = isMobile ? 65 : 90;
      if (distAtom < threshold) {
        dismissedRef.current = false;
        setPinnedAsset((prev) => (prev === 'atom' ? null : 'atom'));
      } else if (distBook < threshold) {
        dismissedRef.current = false;
        setPinnedAsset((prev) => (prev === 'book' ? null : 'book'));
      } else if (distFlask < threshold) {
        dismissedRef.current = false;
        setPinnedAsset((prev) => (prev === 'flask' ? null : 'flask'));
      } else {
        // Tapped outside all 3 assets -> close tooltip easily!
        dismissedRef.current = true;
        setPinnedAsset(null);
        if (tooltipEl) {
          tooltipEl.style.opacity = '0';
          tooltipEl.style.pointerEvents = 'none';
        }
      }
    };

    const handlePointerUp = () => {
      if (!pinnedAssetRef.current) {
        clientMouseX = -9999;
        clientMouseY = -9999;
        targetMouseX = 0;
        targetMouseY = 0;
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    if (heroContainerEl && heroContainerEl.addEventListener) {
      heroContainerEl.addEventListener('pointerleave', handlePointerLeave, { passive: true });
      heroContainerEl.addEventListener('click', handleContainerClick);
    }

    // =========================================================================
    // 6. RESPONSIVE RESIZING
    // =========================================================================
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth || window.innerWidth;
      const newHeight = container.clientHeight || 450;
      const mobileNow = newWidth < 768;

      camera.aspect = newWidth / newHeight;
      camera.position.z = mobileNow ? 5.6 : 5.2;
      camera.updateProjectionMatrix();

      renderer.setSize(newWidth, newHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobileNow ? 1.5 : 2));

      const newBaseScale = mobileNow ? 0.65 : 0.72;
      masterGroup.scale.set(newBaseScale, newBaseScale, newBaseScale);

      // Reposition anchors flanking 'nurturing minds, shaping futures'
      atomHomePos.y = mobileNow ? 0.70 : 1.22;
      atomAnchor.scale.setScalar(mobileNow ? 0.52 : 0.58);

      bookHomePos.x = mobileNow ? -2.20 : -4.35;
      bookHomePos.y = mobileNow ? 0.30 : 0.24;
      bookAnchor.scale.setScalar(mobileNow ? 0.28 : 0.38);

      flaskHomePos.x = mobileNow ? 2.20 : 4.35;
      flaskHomePos.y = mobileNow ? 0.30 : 0.24;
      flaskAnchor.scale.setScalar(mobileNow ? 0.28 : 0.38);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // =========================================================================
    // 7. BATTERY-FRIENDLY INTERSECTION OBSERVER
    // =========================================================================
    let isVisible = true;
    let animationFrameId = null;

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible && !animationFrameId) {
          lastTime = performance.now();
          renderLoop(performance.now());
        }
      },
      { threshold: 0.05 }
    );
    intersectionObserver.observe(container);

    // =========================================================================
    // 8. QUANTUM CARBON ATOM & MICRO-INTERACTION RENDER LOOP
    // =========================================================================
    let lastTime = performance.now();
    let innerElectronAngle = 0; // 1s² orbital angle
    let electronAngle2s = 0;     // 2s² orbital angle
    let electronAngle2px = 0;    // 2p_x¹ orbital angle
    let electronAngle2py = Math.PI / 2; // 2p_y¹ orbital angle

    let flaskLiftProgress = 0;
    let flaskSwirlAngle = 0;
    let bookLiftProgress = 0;
    let continuousPageTurnCycle = 0;
    let atomPatrolCycle = 0;
    let logoHoverProgress = 0;

    let tooltipSide = 'none'; // 'left' | 'right' | 'none'
    let currentTooltipX = -9999;
    let currentTooltipY = -9999;
    let wasTooltipActive = false;
    let displayedAsset = null;

    const assetTelemetry = {
      atom: {
        badge: '₆C',
        badgeBg: 'rgba(6, 182, 212, 0.22)',
        badgeBorder: 'rgba(56, 189, 248, 0.65)',
        badgeColor: '#38bdf8',
        cardBorder: 'rgba(6, 182, 212, 0.55)',
        cardGlow: '0 20px 45px rgba(0, 0, 0, 0.75), 0 0 25px rgba(6, 182, 212, 0.25)',
        hairlineClass: 'tooltip-hairline absolute top-0 inset-x-2 sm:inset-x-3 h-[1.5px] sm:h-[2px] bg-gradient-to-r from-cyan-400 via-sky-300 to-cyan-500 rounded-full',
        title: 'Carbon-12 Structure',
        subtitle: 'Theme: Foundational Core • 1s² 2s² 2p²',
        subtitleColor: 'text-cyan-300',
        body: 'Just as carbon is nature\'s versatile, fundamental building block of life and matter (1s² 2s² 2p²), <span class="text-amber-300 font-semibold">HSS Shangus</span> stands at the atomic core, playing the central role in shaping each child\'s character and potential. It unites foundational theory (<span class="text-amber-300 font-semibold">The Book</span>) and practical testing (<span class="text-emerald-300 font-semibold">The Flask</span>) across Science, Humanities, and all streams to achieve one universal goal: <span class="text-sky-300 font-semibold">&quot;Nurturing Minds, Shaping Futures&quot;</span>.'
      },
      book: {
        badge: '📖',
        badgeBg: 'rgba(245, 158, 11, 0.22)',
        badgeBorder: 'rgba(251, 191, 36, 0.65)',
        badgeColor: '#fbbf24',
        cardBorder: 'rgba(245, 158, 11, 0.55)',
        cardGlow: '0 20px 45px rgba(0, 0, 0, 0.75), 0 0 25px rgba(245, 158, 11, 0.25)',
        hairlineClass: 'tooltip-hairline absolute top-0 inset-x-2 sm:inset-x-3 h-[1.5px] sm:h-[2px] bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 rounded-full',
        title: 'Open Book of Wisdom',
        subtitle: 'Theme: Foundational Theory & Concepts',
        subtitleColor: 'text-amber-300',
        body: 'Flanking our motto on the left, the <span class="text-amber-300 font-semibold">Book of Wisdom</span> embodies foundational theory, deep inquiry, and conceptual knowledge across all streams—Humanities, Sciences, and others. Its cascading pages symbolize the rich intellectual and moral grounding essential to <span class="text-amber-300 font-semibold">&quot;nurture minds and shape futures&quot;</span> in every student.'
      },
      flask: {
        badge: '🧪',
        badgeBg: 'rgba(16, 185, 129, 0.22)',
        badgeBorder: 'rgba(52, 211, 153, 0.65)',
        badgeColor: '#34d399',
        cardBorder: 'rgba(16, 185, 129, 0.55)',
        cardGlow: '0 20px 45px rgba(0, 0, 0, 0.75), 0 0 25px rgba(16, 185, 129, 0.25)',
        hairlineClass: 'tooltip-hairline absolute top-0 inset-x-2 sm:inset-x-3 h-[1.5px] sm:h-[2px] bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 rounded-full',
        title: 'Flask of Discovery',
        subtitle: 'Theme: Practical Testing & Applied Inquiry',
        subtitleColor: 'text-emerald-300',
        body: 'Flanking our motto on the right, the <span class="text-emerald-300 font-semibold">conical Erlenmeyer flask</span> embodies experimentation, practical testing, and empirical inquiry across all disciplines. With its luminescent reaction and effervescent vapor, it represents transforming concepts into real-world innovation, actively <span class="text-emerald-300 font-semibold">&quot;nurturing minds and shaping futures&quot;</span>.'
      }
    };

    const renderLoop = (time) => {
      if (!isVisible) {
        animationFrameId = null;
        return;
      }

      const delta = Math.min((time - lastTime) * 0.001, 0.1);
      lastTime = time;

      const speedMult = prefersReducedMotion ? 0.15 : 1.0;

      // Smooth pointer tracking lerp
      mouseNormX += (targetMouseX - mouseNormX) * 0.06;
      mouseNormY += (targetMouseY - mouseNormY) * 0.06;

      // Calculate atom screen coordinates for hover collision & tooltip tracking
      const atomWorldPos = new THREE.Vector3();
      atomAnchor.getWorldPosition(atomWorldPos);
      const projected = atomWorldPos.clone().project(camera);
      const rect = container.getBoundingClientRect();
      const atomScreenX = (projected.x * 0.5 + 0.5) * rect.width;
      const atomScreenY = (-projected.y * 0.5 + 0.5) * rect.height;

      const mouseRelX = clientMouseX - rect.left;
      const mouseRelY = clientMouseY - rect.top;
      const distToAtom = Math.hypot(mouseRelX - atomScreenX, mouseRelY - atomScreenY);
      const hoverThreshold = isMobile ? 70 : 95;

      // Calculate Book screen coordinates for direct hover
      const bookWorldPos = new THREE.Vector3();
      bookAnchor.getWorldPosition(bookWorldPos);
      const projectedBook = bookWorldPos.clone().project(camera);
      const bookScreenX = (projectedBook.x * 0.5 + 0.5) * rect.width;
      const bookScreenY = (-projectedBook.y * 0.5 + 0.5) * rect.height;
      const distToBook = Math.hypot(mouseRelX - bookScreenX, mouseRelY - bookScreenY);
      const isDirectBookHover = distToBook < (isMobile ? 75 : 110);

      // Calculate Flask screen coordinates for direct hover
      const flaskWorldPos = new THREE.Vector3();
      flaskAnchor.getWorldPosition(flaskWorldPos);
      const projectedFlask = flaskWorldPos.clone().project(camera);
      const flaskScreenX = (projectedFlask.x * 0.5 + 0.5) * rect.width;
      const flaskScreenY = (-projectedFlask.y * 0.5 + 0.5) * rect.height;
      const distToFlask = Math.hypot(mouseRelX - flaskScreenX, mouseRelY - flaskScreenY);
      const isDirectFlaskHover = distToFlask < (isMobile ? 75 : 110);

      const isDirectAtomHover = distToAtom < hoverThreshold;
      let hoveredAsset = null;
      if (isDirectAtomHover) {
        hoveredAsset = 'atom';
      } else if (isDirectBookHover) {
        hoveredAsset = 'book';
      } else if (isDirectFlaskHover) {
        hoveredAsset = 'flask';
      }

      if (dismissedRef.current) {
        if (!hoveredAsset) {
          dismissedRef.current = false;
        }
      }

      const activeAsset = pinnedAssetRef.current || (dismissedRef.current ? null : hoveredAsset) || (isTooltipHovered ? displayedAsset : null);
      isAtomHovered = activeAsset === 'atom' || isDirectAtomHover;

      if (heroContainerEl && heroContainerEl.style) {
        heroContainerEl.style.cursor = (isDirectAtomHover || isDirectBookHover || isDirectFlaskHover) ? 'pointer' : '';
      }

      // Position and update HTML scientific tooltip card for hovered/pinned asset
      if (tooltipEl) {
        if (activeAsset && assetTelemetry[activeAsset]) {
          const isMobileScreen = rect.width < 768;
          const cardWidth = isMobileScreen
            ? Math.min(295, Math.max(260, rect.width - 20))
            : Math.min(440, Math.max(380, Math.floor(rect.width * 0.38)));
          const measuredHeight = tooltipEl.offsetHeight || (isMobileScreen ? 98 : 72);
          const cardHeight = measuredHeight;

          // Dynamically update tooltip content if asset switched
          if (displayedAsset !== activeAsset) {
            displayedAsset = activeAsset;
            const data = assetTelemetry[activeAsset];
            const cardInner = tooltipEl.querySelector('.hero-3d-tooltip');
            const hairlineEl = tooltipEl.querySelector('.tooltip-hairline');
            const badgeEl = tooltipEl.querySelector('.tooltip-badge');
            const titleEl = tooltipEl.querySelector('.tooltip-title');
            const subtitleEl = tooltipEl.querySelector('.tooltip-subtitle');
            const bodyEl = tooltipEl.querySelector('.tooltip-body-text');

            if (cardInner) {
              cardInner.style.setProperty('--hero-tooltip-border', data.cardBorder);
              cardInner.style.setProperty('--hero-tooltip-glow', data.cardGlow);
              cardInner.style.borderColor = data.cardBorder;
              cardInner.style.boxShadow = data.cardGlow;
            }
            if (hairlineEl) {
              hairlineEl.className = data.hairlineClass;
            }
            if (badgeEl) {
              badgeEl.textContent = data.badge;
              badgeEl.style.backgroundColor = data.badgeBg;
              badgeEl.style.borderColor = data.badgeBorder;
              badgeEl.style.color = data.badgeColor;
            }
            if (titleEl) {
              titleEl.textContent = data.title;
            }
            if (subtitleEl) {
              subtitleEl.textContent = data.subtitle;
              subtitleEl.className = `tooltip-subtitle text-[8px] sm:text-[9.5px] font-mono font-medium shrink-0 ${data.subtitleColor}`;
            }
            if (bodyEl) {
              bodyEl.innerHTML = data.body;
            }
          }

          let anchorX = atomScreenX;
          let anchorY = atomScreenY;
          if (activeAsset === 'book') {
            anchorX = bookScreenX;
            anchorY = bookScreenY;
          } else if (activeAsset === 'flask') {
            anchorX = flaskScreenX;
            anchorY = flaskScreenY;
          }

          let targetX;
          let targetY;
          let pipSide = 'left';

          if (isMobileScreen) {
            // MOBILE: Placed strictly ABOVE the hovered asset, horizontally centered
            pipSide = 'bottom';
            targetX = anchorX - (cardWidth / 2);
            targetX = Math.max(8, Math.min(targetX, rect.width - cardWidth - 8));
            targetY = anchorY - 26 - cardHeight - 8;
            targetY = Math.max(6, targetY);
          } else {
            // DESKTOP: Placed gracefully relative to the asset
            const screenCenterX = rect.width * 0.5;
            if (activeAsset === 'book') {
              pipSide = 'left';
              targetX = anchorX + 70;
              targetX = Math.max(16, Math.min(targetX, rect.width - cardWidth - 16));
            } else if (activeAsset === 'flask') {
              pipSide = 'right';
              targetX = anchorX - cardWidth - 70;
              targetX = Math.max(16, Math.min(targetX, rect.width - cardWidth - 16));
            } else {
              if (tooltipSide === 'none') {
                tooltipSide = anchorX >= screenCenterX ? 'left' : 'right';
              } else if (tooltipSide === 'left' && anchorX < screenCenterX - 28) {
                tooltipSide = 'right';
              } else if (tooltipSide === 'right' && anchorX > screenCenterX + 28) {
                tooltipSide = 'left';
              }

              const desktopClearance = 110;
              if (tooltipSide === 'left') {
                pipSide = 'right';
                targetX = anchorX - cardWidth - desktopClearance;
                targetX = Math.max(16, Math.min(targetX, rect.width - cardWidth - 16));
              } else {
                pipSide = 'left';
                targetX = anchorX + desktopClearance;
                targetX = Math.max(16, Math.min(targetX, rect.width - cardWidth - 16));
              }
            }

            const minY = 12;
            const maxY = Math.max(minY, rect.height - cardHeight - 75);
            targetY = anchorY - (cardHeight / 2);
            targetY = Math.max(minY, Math.min(targetY, maxY));
          }

          // Smooth interpolation so tooltip slides elegantly
          if (!wasTooltipActive) {
            currentTooltipX = targetX;
            currentTooltipY = targetY;
            wasTooltipActive = true;
          } else {
            currentTooltipX += (targetX - currentTooltipX) * 0.16;
            currentTooltipY += (targetY - currentTooltipY) * 0.16;
          }

          tooltipEl.style.transform = `translate3d(${Math.round(currentTooltipX)}px, ${Math.round(currentTooltipY)}px, 0)`;
          tooltipEl.style.opacity = '1';
          tooltipEl.style.pointerEvents = 'auto';

          // Update directional pointer pip with asset theme color
          const pipEl = tooltipEl.querySelector('.tooltip-pip');
          if (pipEl) {
            const data = assetTelemetry[activeAsset];
            const pipBorder = data ? data.cardBorder : 'rgba(6, 182, 212, 0.55)';
            pipEl.style.display = 'block';
            pipEl.style.backgroundColor = '#0a0f1e';
            pipEl.style.setProperty('--hero-tooltip-border', pipBorder);
            pipEl.style.borderColor = pipBorder;
            if (pipSide === 'bottom') {
              pipEl.className = 'tooltip-pip absolute w-2.5 h-2.5 rotate-45 left-1/2 -translate-x-1/2 -bottom-1.5 border-b border-r shadow-xs';
            } else if (pipSide === 'right') {
              pipEl.className = 'tooltip-pip absolute w-2.5 h-2.5 rotate-45 -right-1.5 top-1/2 -translate-y-1/2 border-t border-r shadow-xs';
            } else {
              pipEl.className = 'tooltip-pip absolute w-2.5 h-2.5 rotate-45 -left-1.5 top-1/2 -translate-y-1/2 border-b border-l shadow-xs';
            }
          }
        } else {
          tooltipEl.style.opacity = '0';
          tooltipEl.style.pointerEvents = 'none';
          wasTooltipActive = false;
          tooltipSide = 'none';
        }
      }

      // Slow down traversal when inspecting atom on hover
      const traversalSpeed = isAtomHovered ? 0.08 : 0.38;
      atomPatrolCycle += delta * traversalSpeed * speedMult;

      const isMobileScreen = rect.width < 768;
      // On mobile: gentle central hover drift (±0.32) so it stays centered between Book and Flask
      // On desktop: wide majestic sweep across the sky (±2.80)
      const sweepWidth = isMobileScreen ? 0.32 : 2.80;
      const normalSweepX = Math.sin(atomPatrolCycle) * sweepWidth;
      const normalSweepY = Math.cos(atomPatrolCycle * 2) * (isMobileScreen ? 0.04 : 0.08);

      // Interactive mouse influence added to the normal route
      const mouseInfluenceX = mouseNormX * (isMobileScreen ? 0.4 : 0.9);
      const mouseInfluenceY = -mouseNormY * (isMobileScreen ? 0.25 : 0.5);

      const targetAtomX = normalSweepX + mouseInfluenceX;
      const targetAtomY = atomHomePos.y + normalSweepY + mouseInfluenceY;

      // Glide smoothly along route
      atomAnchor.position.x += (targetAtomX - atomAnchor.position.x) * 0.08;
      atomAnchor.position.y += (targetAtomY - atomAnchor.position.y) * 0.08;

      // Gentle aerodynamic banking tilt along direction of travel
      const sweepVelocityX = Math.cos(atomPatrolCycle); // + when moving right, - when moving left
      const bankingTiltZ = -sweepVelocityX * 0.12;

      // Gyroscopic rotational orientation towards mouse + flight bank
      const targetAtomRotY = (mouseNormX * 1.8) + (sweepVelocityX * 0.25);
      const targetAtomRotX = -mouseNormY * 1.4;
      atomInteractiveGroup.rotation.y += (targetAtomRotY - atomInteractiveGroup.rotation.y) * 0.08;
      atomInteractiveGroup.rotation.x += (targetAtomRotX - atomInteractiveGroup.rotation.x) * 0.08;
      atomInteractiveGroup.rotation.z += (bankingTiltZ - atomInteractiveGroup.rotation.z) * 0.08;

      // -----------------------------------------------------------------------
      // Dynamic Hover Prominence for HSS Shangus Logo Nucleus
      // When hovered: the official logo expands into bold prominence, brightens,
      // and the nucleons part outward into a framing corona ring!
      // -----------------------------------------------------------------------
      const targetLogoHover = isAtomHovered ? 1.0 : 0.0;
      logoHoverProgress += (targetLogoHover - logoHoverProgress) * (isAtomHovered ? 0.14 : 0.08);

      // 1. Expand Logo Medallion & 24K Gold Bezel into central nuclear focus (+58% scale)
      const logoScale = 1.0 + (logoHoverProgress * 0.58);
      logoNucleusCore.scale.set(logoScale, logoScale, logoScale);

      // 2. Counter-tilt slightly when hovered so logo faces directly toward user's gaze
      logoNucleusCore.rotation.x = -atomInteractiveGroup.rotation.x * 0.50 * logoHoverProgress;
      logoNucleusCore.rotation.y = -atomInteractiveGroup.rotation.y * 0.50 * logoHoverProgress;

      // 3. Illuminate logo with vibrant brilliance & golden bezel radiance
      logoMat.emissiveIntensity = 0.14 + (logoHoverProgress * 0.65);
      goldBezelMat.emissiveIntensity = 0.45 + (logoHoverProgress * 0.50);
      logoPointLight.intensity = logoHoverProgress * 3.2;

      // 4. Part nucleons outward into a framing corona ring around the prominent logo
      const nucleonSpread = 1.0 + (logoHoverProgress * 0.45);
      nucleonCluster.scale.set(nucleonSpread, nucleonSpread, nucleonSpread);
      nucleonCluster.rotation.y += (0.4 + logoHoverProgress * 0.6) * delta * speedMult;

      // 5. Gentle floating nuclear pulse + celestial envelope glow
      const nucleusPulse = (1.0 + Math.sin(time * 0.003 * speedMult) * 0.05) * (1.0 + logoHoverProgress * 0.25);
      nucleusShell.scale.set(nucleusPulse, nucleusPulse, nucleusPulse);
      nucleusMat.opacity = 0.22 + (logoHoverProgress * 0.18);
      nucleusMat.emissiveIntensity = 0.6 + (logoHoverProgress * 0.35);

      // Quantum speed boost when mouse is actively moving
      const mouseSpeedBoost = 1.0 + Math.hypot(mouseNormX, mouseNormY) * 3.0;

      // 1. Inner Shell (K-Shell, n=1) Core Electrons Animation:
      // Exactly 2 electrons orbiting at radius 0.52, separated by 180° (Pauli-paired ground state)
      // High-speed orbit (~5.4 rad/s vs valence ~1.3 rad/s), obeying Bohr/quantum dynamics (ω ∝ 1/n³)
      innerElectronAngle += 5.4 * delta * speedMult * mouseSpeedBoost;
      electron1.position.set(Math.cos(innerElectronAngle) * innerRingRadius, Math.sin(innerElectronAngle) * innerRingRadius, 0);
      electron2.position.set(Math.cos(innerElectronAngle + Math.PI) * innerRingRadius, Math.sin(innerElectronAngle + Math.PI) * innerRingRadius, 0);

      // 2. Intermediate Shell 2s (2s²: exactly 2 paired electrons at radius 0.82, 180° apart)
      electronAngle2s += 2.8 * delta * speedMult * mouseSpeedBoost;
      electron3.position.set(Math.cos(electronAngle2s) * ring2sRadius, Math.sin(electronAngle2s) * ring2sRadius, 0);
      electron4.position.set(Math.cos(electronAngle2s + Math.PI) * ring2sRadius, Math.sin(electronAngle2s + Math.PI) * ring2sRadius, 0);

      // 3. Outer Subshell 2p (2p²: 2p_x¹ and 2p_y¹ at radius 1.12, 1 electron each)
      electronAngle2px += 1.35 * delta * speedMult * mouseSpeedBoost;
      electronAngle2py += 1.25 * delta * speedMult * mouseSpeedBoost;
      electron5.position.set(Math.cos(electronAngle2px) * ring2pRadius, Math.sin(electronAngle2px) * ring2pRadius, 0);
      electron6.position.set(Math.cos(electronAngle2py) * ring2pRadius, Math.sin(electronAngle2py) * ring2pRadius, 0);

      // Quantum relativistic orbital precession across subshells + inner ring
      innerRing.rotation.z += 0.35 * delta * speedMult;
      ring2s.rotation.z -= 0.22 * delta * speedMult;
      ring2px.rotation.z += 0.16 * delta * speedMult;
      ring2py.rotation.z -= 0.15 * delta * speedMult;
      ring2pz.rotation.z += 0.12 * delta * speedMult;

      // -----------------------------------------------------------------------
      // 8B. BOOK & FLASK: ENHANCED HOVER RESPONSIVE REACTION
      // -----------------------------------------------------------------------
      const isAdmissionsHovered = hoveredActionRef.current === 'admissions' || hoveredActionRef.current === 'slogan';
      const isBookActive = isAdmissionsHovered || isDirectBookHover;
      const isFlaskActive = isAdmissionsHovered || isDirectFlaskHover;

      const targetBookLift = isBookActive ? 1 : 0;
      // Snappy spring-damped responsive lerp factor (0.14 vs old 0.08)
      bookLiftProgress += (targetBookLift - bookLiftProgress) * 0.14;

      const bookIdleBob = Math.cos(time * 0.0015 * speedMult) * 0.04;
      bookAnchor.position.y = bookHomePos.y + bookIdleBob + (bookLiftProgress * 0.28);
      bookAnchor.position.z = bookHomePos.z + (bookLiftProgress * 0.32);
      bookAnchor.position.x = bookHomePos.x + (bookLiftProgress * 0.10);

      // Scale boost for dynamic focus
      const bookScaleBoost = 1.0 + (bookLiftProgress * 0.12);
      bookMeshGroup.scale.set(bookScaleBoost, bookScaleBoost, bookScaleBoost);

      // Presentation tilt towards viewer to showcase open pages
      bookMeshGroup.rotation.x = 0.38 - (bookLiftProgress * 0.20) + Math.sin(time * 0.002 * speedMult) * (0.03 * bookLiftProgress);
      bookMeshGroup.rotation.y = 0.42 - (bookLiftProgress * 0.22);
      bookMeshGroup.rotation.z = -0.18 + (bookLiftProgress * 0.10);

      if (isBookActive) {
        continuousPageTurnCycle += delta * 3.6 * speedMult;
      }

      // Page slipping motion: pages lift, arch up, and flutter in a rich cascading wave
      const rightRestAngle = -Math.PI / 10;
      const fanPeakAngle = -Math.PI / 36;

      flippingLeaves.forEach((leaf) => {
        if (isBookActive) {
          const leafPhase = (continuousPageTurnCycle + leaf.phaseOffset) % 1.0;
          const flutterWave = Math.sin(leafPhase * Math.PI);
          const turnAngle = rightRestAngle + (fanPeakAngle - rightRestAngle) * flutterWave;
          leaf.pivot.rotation.z = turnAngle;

          const archHeight = flutterWave * 0.075;
          leaf.pivot.position.y = 0.055 + archHeight;
          leaf.mesh.rotation.y = flutterWave * 0.09;
          leaf.mesh.rotation.x = Math.sin(leafPhase * Math.PI * 2) * 0.04;
        } else {
          leaf.pivot.rotation.z += (leaf.restAngle - leaf.pivot.rotation.z) * 0.12;
          leaf.pivot.position.y += (0.055 - leaf.pivot.position.y) * 0.12;
          leaf.mesh.rotation.y += (0 - leaf.mesh.rotation.y) * 0.12;
          leaf.mesh.rotation.x += (0 - leaf.mesh.rotation.x) * 0.12;
        }
      });

      // Emitted Words & Alphabets of Wisdom (Rising majestically from open pages on hover)
      bookGlyphParticles.forEach((p) => {
        if (bookLiftProgress > 0.05) {
          p.y += p.speed * delta * (1.1 + bookLiftProgress * 1.6) * speedMult;
          if (p.y > 1.45) {
            p.y = 0.08;
            p.baseX = (Math.random() - 0.5) * 0.44;
            p.baseZ = (Math.random() - 0.5) * 0.34;
            p.offset = Math.random() * Math.PI * 2;
            p.driftX = (Math.random() - 0.5) * 1.8;
            p.driftZ = (Math.random() - 0.5) * 1.8;

            // Dynamically rotate to another glyph from the pool
            const randomGlyph = glyphPool[Math.floor(Math.random() * glyphPool.length)];
            if (randomGlyph && p.sprite.material.map !== randomGlyph.texture) {
              p.sprite.material.map = randomGlyph.texture;
              p.aspect = randomGlyph.aspect;
              p.isWord = randomGlyph.isWord;
              p.baseScale = randomGlyph.isWord ? 0.22 : 0.20;
            }
          }
          p.sprite.position.y = p.y;
          const normY = Math.max(0, Math.min(1, (p.y - 0.08) / 1.37));
          p.sprite.position.x = p.baseX + Math.sin(time * 0.0032 + p.offset) * 0.08 + (p.driftX * normY * 0.22);
          p.sprite.position.z = p.baseZ + Math.cos(time * 0.0028 + p.offset) * 0.07 + (p.driftZ * normY * 0.18);

          // Gently expand as it rises into the air for bold prominence
          const currentScale = p.baseScale * (0.95 + normY * 0.70);
          p.sprite.scale.set(currentScale * p.aspect, currentScale, 1);
          p.sprite.material.rotation = Math.sin(time * 0.0022 + p.offset) * 0.24;

          // High visibility bell curve opacity
          const fade = Math.sin(normY * Math.PI);
          p.sprite.material.opacity = Math.min(1.0, fade * 1.45) * bookLiftProgress;
        } else {
          p.sprite.material.opacity = 0;
        }
      });

      // Warm library knowledge illumination
      bookLight.intensity = bookLiftProgress * 3.8;
      activeFlippingPageMat.emissiveIntensity = 0.15 + (bookLiftProgress * 0.55);
      goldGiltMat.emissiveIntensity = 0.45 + (bookLiftProgress * 0.55);

      // Bookmark ribbon organic harmonic flutter
      ribbon.rotation.z = -0.1 + Math.sin(time * 0.0035 * speedMult) * (0.05 + bookLiftProgress * 0.25);
      ribbon.rotation.x = -0.25 + Math.cos(time * 0.003 * speedMult) * (0.03 + bookLiftProgress * 0.18);

      // -----------------------------------------------------------------------
      // 8C. SCIENTIFIC FLASK: ENHANCED HOVER RESPONSIVE DISCOVERY REACTION
      // -----------------------------------------------------------------------
      const targetFlaskLift = isFlaskActive ? 1 : 0;
      // Snappy spring-damped responsive lerp factor (0.14 vs old 0.10)
      flaskLiftProgress += (targetFlaskLift - flaskLiftProgress) * 0.14;

      const flaskIdleBob = Math.sin(time * 0.0018 * speedMult) * 0.04;
      flaskAnchor.position.y = flaskHomePos.y + flaskIdleBob + (flaskLiftProgress * 0.28);
      flaskAnchor.position.z = flaskHomePos.z + (flaskLiftProgress * 0.32);
      flaskAnchor.position.x = flaskHomePos.x - (flaskLiftProgress * 0.10);

      // Scale boost for dynamic focus
      const flaskScaleBoost = 1.0 + (flaskLiftProgress * 0.12);
      flaskMeshGroup.scale.set(flaskScaleBoost, flaskScaleBoost, flaskScaleBoost);

      // Presentation tilt towards viewer to showcase chemical reaction
      flaskMeshGroup.rotation.x = 0.22 + (flaskLiftProgress * 0.16) + Math.sin(time * 0.002 * speedMult) * (0.03 * flaskLiftProgress);
      flaskMeshGroup.rotation.y = -0.35 + (flaskLiftProgress * 0.22);
      flaskMeshGroup.rotation.z = 0.12 - (flaskLiftProgress * 0.15);

      // Chemical solution vortex swirl inside flask
      liquidMesh.rotation.y += delta * (isFlaskActive ? 3.8 : 0.8) * speedMult;
      meniscusMesh.rotation.y += delta * (isFlaskActive ? 3.8 : 0.8) * speedMult;
      meniscusMesh.position.y = 0.09 + Math.sin(time * 0.006 * speedMult) * (0.015 * flaskLiftProgress);

      // Stirring rod active laboratory motion
      rodMesh.rotation.z = 0.26 + Math.sin(time * 0.006 * speedMult) * (0.07 * flaskLiftProgress);
      rodMesh.rotation.x = -0.12 + Math.cos(time * 0.006 * speedMult) * (0.05 * flaskLiftProgress);
      rodTipTop.position.x = -0.16 + Math.sin(time * 0.006 * speedMult) * (0.035 * flaskLiftProgress);

      // Effervescent micro-bubble spiral physics simulation
      const bubbleSpeedMult = isFlaskActive ? 3.8 : 1.0;
      bubbles.forEach((b) => {
        b.y += b.speed * delta * bubbleSpeedMult * speedMult;
        b.angle += delta * (isFlaskActive ? 4.8 : 1.2) * speedMult;
        if (b.y > 0.09) {
          b.y = -0.28;
          b.radius = 0.04 + Math.random() * 0.18;
          b.angle = Math.random() * Math.PI * 2;
        }
        b.mesh.position.y = b.y;
        b.mesh.position.x = Math.sin(b.angle) * b.radius;
        b.mesh.position.z = Math.cos(b.angle) * b.radius;
      });

      // Billowing effervescent reaction vapor emerging from neck
      vaporParticles.forEach((v) => {
        if (flaskLiftProgress > 0.05) {
          v.y += v.speed * delta * (1.1 + flaskLiftProgress * 1.6) * speedMult;
          if (v.y > 1.80) {
            v.y = 0.66;
            v.driftX = (Math.random() - 0.5) * 1.8;
            v.driftZ = (Math.random() - 0.5) * 1.8;
            v.offset = Math.random() * Math.PI * 2;
          }
          v.sprite.position.y = v.y;
          const normY = Math.max(0, Math.min(1, (v.y - 0.66) / 1.14));

          // Expanding billowing vortex as vapor climbs into the atmosphere
          const swirlRadius = 0.04 + normY * 0.28;
          v.sprite.position.x = Math.sin(time * 0.0035 + v.offset) * swirlRadius + (v.driftX * normY * 0.20);
          v.sprite.position.z = Math.cos(time * 0.0032 + v.offset) * (swirlRadius * 0.85) + (v.driftZ * normY * 0.16);

          // Billowing volumetric scale expansion (from ~0.18 up to ~0.58)
          const currentScale = v.baseScale * (1.0 + normY * 2.2);
          v.sprite.scale.set(currentScale, currentScale, 1);
          v.sprite.material.rotation = v.baseRot + (time * 0.001 * v.rotSpeed);

          // Prominent luminous bell-curve opacity
          const fade = Math.sin(normY * Math.PI);
          v.sprite.material.opacity = Math.min(0.92, fade * 1.45) * flaskLiftProgress;
        } else {
          v.sprite.material.opacity = 0;
        }
      });

      // Leaping micro-sparks within the vapor plume
      vaporSparks.forEach((s) => {
        if (flaskLiftProgress > 0.05) {
          s.y += s.speed * delta * (1.2 + flaskLiftProgress * 1.5) * speedMult;
          s.angle += delta * 4.2 * speedMult;
          if (s.y > 1.45) {
            s.y = 0.66;
            s.angle = Math.random() * Math.PI * 2;
            s.radius = 0.02 + Math.random() * 0.06;
          }
          s.mesh.position.y = s.y;
          const normY = (s.y - 0.66) / 0.79;
          s.mesh.position.x = Math.sin(s.angle) * (s.radius + normY * 0.12);
          s.mesh.position.z = Math.cos(s.angle) * (s.radius + normY * 0.10);
          const fade = Math.sin(Math.max(0, Math.min(1, normY)) * Math.PI);
          s.mesh.material.opacity = fade * 0.95 * flaskLiftProgress;
          s.mesh.scale.setScalar(0.7 + Math.sin(time * 0.015 + s.offset) * 0.3);
        } else {
          s.mesh.material.opacity = 0;
        }
      });

      // Luminescent chemical reaction glow
      flaskLight.intensity = 0.6 + (flaskLiftProgress * 5.2) + Math.sin(time * 0.008 * speedMult) * 0.4;
      const activeLiquidEmissive = 0.5 + (flaskLiftProgress * (0.75 + Math.sin(time * 0.008 * speedMult) * 0.22));
      liquidMat.emissiveIntensity = activeLiquidEmissive;
      meniscusMat.emissiveIntensity = 0.85 + (flaskLiftProgress * 0.65);

      // -----------------------------------------------------------------------
      // 8D. STARDUST PARTICLES
      // -----------------------------------------------------------------------
      particleSystem.rotation.y += 0.035 * delta * speedMult;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop(performance.now());

    // -------------------------------------------------------------------------
    // 9. CLEANUP ON UNMOUNT
    // -------------------------------------------------------------------------
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      if (tooltipEl) {
        tooltipEl.removeEventListener('mouseenter', onTooltipEnter);
        tooltipEl.removeEventListener('mouseleave', onTooltipLeave);
      }
      if (heroContainerEl && heroContainerEl.removeEventListener) {
        heroContainerEl.removeEventListener('pointerleave', handlePointerLeave);
        heroContainerEl.removeEventListener('click', handleContainerClick);
      }
      resizeObserver.disconnect();
      intersectionObserver.disconnect();

      if (logoTexture) logoTexture.dispose();
      if (vaporCyanTex) vaporCyanTex.dispose();
      if (vaporEmeraldTex) vaporEmeraldTex.dispose();
      glyphPool.forEach((g) => {
        if (g && g.texture) g.texture.dispose();
      });

      scene.traverse((child) => {
        if (child.isMesh || child.isPoints || child.isSprite) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => {
                if (m.map) m.map.dispose();
                m.dispose();
              });
            } else {
              if (child.material.map) child.material.map.dispose();
              child.material.dispose();
            }
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (!webGlSupported) return null;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`hero-3d-canvas-container absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible ${className}`}
      style={{ opacity: 0.94 }}
    >
      {/* High-Contrast Interactive 3D Educational Telemetry Tooltip Card */}
      <div
        ref={tooltipRef}
        role="tooltip"
        aria-hidden={!pinnedAsset}
        className="absolute transition-opacity duration-300 pointer-events-none opacity-0 z-50"
        style={{
          top: 0,
          left: 0,
          transform: 'translate3d(-9999px, -9999px, 0)'
        }}
      >
        <div
          className="hero-3d-tooltip relative w-[285px] xs:w-[305px] sm:w-[410px] md:w-[440px] max-w-[calc(100vw-16px)] rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-left pointer-events-auto ring-1 ring-white/10 shadow-2xl transition-all"
          style={{
            backgroundColor: 'rgba(10, 15, 30, 0.96)',
            borderColor: 'rgba(6, 182, 212, 0.55)',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.75), 0 0 25px rgba(6, 182, 212, 0.25)'
          }}
        >
          {/* Top glowing accent hairline */}
          <div className="tooltip-hairline absolute top-0 inset-x-2 sm:inset-x-3 h-[1.5px] sm:h-[2px] bg-gradient-to-r from-cyan-400 via-sky-300 to-cyan-500 rounded-full" />
          
          {/* Unified Responsive Tooltip Layout (Mobile & Desktop) */}
          <div className="flex flex-col gap-1.5 sm:gap-2">
            {/* Header Row */}
            <div className="flex items-center justify-between gap-1 pb-1 sm:pb-1.5 border-b border-slate-700/60">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <span
                  className="tooltip-badge w-5 h-5 sm:w-5.5 sm:h-5.5 rounded border border-solid flex items-center justify-center font-bold text-[9px] sm:text-[10px] font-mono shrink-0 shadow-xs"
                  style={{
                    backgroundColor: 'rgba(6, 182, 212, 0.22)',
                    borderColor: 'rgba(56, 189, 248, 0.65)',
                    color: '#38bdf8'
                  }}
                >
                  ₆C
                </span>
                <div className="flex items-baseline gap-1.5 sm:gap-2 truncate">
                  <h4 className="tooltip-title font-bold text-[10.5px] sm:text-xs tracking-wide leading-none font-heading text-white truncate">
                    Carbon-12 Structure
                  </h4>
                  <span className="tooltip-subtitle text-[8px] sm:text-[9.5px] font-mono font-medium text-cyan-300 shrink-0">
                    Theme: Foundational Core • 1s² 2s² 2p²
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseTooltip}
                className="w-5.5 h-5.5 sm:w-5 sm:h-5 rounded-full bg-white/15 hover:bg-white/30 active:bg-white/45 text-white flex items-center justify-center text-[11px] sm:text-xs font-bold shrink-0 cursor-pointer touch-manipulation transition-colors shadow-xs"
                aria-label="Close details"
              >
                ✕
              </button>
            </div>

            {/* Meaningful Theme Paragraph */}
            <p className="tooltip-body-text text-[9.5px] sm:text-[11px] leading-[1.45] sm:leading-[1.55] text-slate-200">
              Just as carbon is nature&apos;s versatile, fundamental building block of life and matter (1s² 2s² 2p²), <span className="text-amber-300 font-semibold">HSS Shangus</span> stands at the atomic core, playing the central role in shaping each child&apos;s character and potential. It unites foundational theory (<span className="text-amber-300 font-semibold">The Book</span>) and practical testing (<span className="text-emerald-300 font-semibold">The Flask</span>) across Science, Humanities, and all streams to achieve one universal goal: <span className="text-sky-300 font-semibold">&quot;Nurturing Minds, Shaping Futures&quot;</span>.
            </p>
          </div>

          {/* Directional indicator pip */}
          <div className="tooltip-pip absolute w-2.5 h-2.5 bg-slate-950 border-cyan-500/55 rotate-45 -left-1.5 top-1/2 -translate-y-1/2 border-b border-l shadow-xs" />
        </div>
      </div>
    </div>
  );
}
