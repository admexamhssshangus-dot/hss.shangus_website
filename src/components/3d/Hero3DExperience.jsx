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
 *      with a glowing nuclear energy envelope.
 *    - Inner Shell (1s²): 2 high-speed Pauli-paired core electrons on a tight orbital ring.
 *    - Outer Valence Shell (2s² 2p² / sp³): 4 valence electrons orbiting in 4 spatially oriented
 *      quantum orbital planes (tetrahedral / orthogonal angles).
 *    - Total 6 electrons exactly matching the Carbon atom.
 *    - Gyroscopically follows mouse location and tilts with quantum relativistic precession.
 * 2. 📖 Open Book of Wisdom:
 *    - Desktop: Strictly on Left of "Admissions Open 2026" with generous breathing room.
 *    - Mobile: Elevated into the left sky flanking the central atom, leaving buttons 100% clean!
 *    - When Admissions Open is hovered: cascading fluttering/slipping pages arching upward
 *      without flopping all the way to the left side!
 * 3. 🧪 Scientific Laboratory Apparatus (Erlenmeyer Flask of Discovery):
 *    - Desktop: Strictly on Right of "Learn More" with generous breathing room.
 *    - Mobile: Elevated into the right sky flanking the central atom, leaving buttons 100% clean!
 *    - Borosilicate glass with volumetric graduations, glass stirring rod, glowing cyan discovery elixir, and rising effervescent bubbles.
 *    - Synchronized: when Admissions Open is hovered, elevates (+0.18Y), tilts, liquid radiates discovery glow, and bubbles effervesce faster.
 * 4. "Learn More" is completely detached from 3D motion, maintaining a clean secondary link.
 */
export default function Hero3DExperience({ className = '', hoveredAction = null }) {
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [webGlSupported, setWebGlSupported] = useState(true);
  const [pinnedTooltip, setPinnedTooltip] = useState(false);
  const pinnedTooltipRef = useRef(false);
  const dismissedRef = useRef(false);
  const hoveredActionRef = useRef(hoveredAction);

  const handleCloseTooltip = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    dismissedRef.current = true;
    setPinnedTooltip(false);
    pinnedTooltipRef.current = false;
    if (tooltipRef.current) {
      tooltipRef.current.style.opacity = '0';
      tooltipRef.current.style.pointerEvents = 'none';
    }
  };

  useEffect(() => {
    hoveredActionRef.current = hoveredAction;
  }, [hoveredAction]);

  useEffect(() => {
    pinnedTooltipRef.current = pinnedTooltip;
  }, [pinnedTooltip]);

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

    // Dynamic Book Pages Glow Light
    const bookLight = new THREE.PointLight(0xfef08a, 0, 3.5);
    bookLight.position.set(-2.2, -0.35, 0.5);
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
    // 1B. CARBON INNER SHELL (K-SHELL, n = 1) — EXACTLY 2 ELECTRONS
    // 2 electrons paired diametrically opposite (180°) on ground state orbit
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
    const electronCoreGeo = new THREE.SphereGeometry(0.048, 12, 12);

    // Electron 1 (Inner K-shell electron 1)
    const electron1 = new THREE.Mesh(electronCoreGeo, electronMat);
    innerRing.add(electron1);

    // Electron 2 (Inner K-shell electron 2, 180° opposite)
    const electron2 = new THREE.Mesh(electronCoreGeo, electronMat);
    innerRing.add(electron2);

    // -------------------------------------------------------------------------
    // 1C. CARBON OUTER VALENCE SHELL (L-SHELL, n = 2) — EXACTLY 4 ELECTRONS
    // Concentric outer quantum shell carrying exactly 4 electrons spaced at 90°
    // With complementary tilted orbital guide rings (±28°) for rich 3D perspective
    // -------------------------------------------------------------------------
    const valenceRadius = 0.98;
    const valenceRingGeo = new THREE.TorusGeometry(valenceRadius, 0.009, 12, 56);

    const valenceRingMat1 = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      metalness: 0.92,
      roughness: 0.2
    });
    const valenceRingMat2 = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x047857,
      emissiveIntensity: 0.45,
      metalness: 0.92,
      roughness: 0.2
    });
    const valenceRingMat3 = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.45,
      metalness: 0.92,
      roughness: 0.2
    });

    const electronValenceGeo = new THREE.SphereGeometry(0.052, 12, 12);

    // Primary Equatorial L-Shell Ring (holding 4 valence electrons at 90° intervals)
    const ringV1 = new THREE.Mesh(valenceRingGeo, valenceRingMat1);
    ringV1.rotation.set(0.40, 0.35, 0);
    atomInteractiveGroup.add(ringV1);

    // Valence Electron 3 (L-shell, 0°)
    const electron3 = new THREE.Mesh(electronValenceGeo, electronMat);
    ringV1.add(electron3);

    // Valence Electron 4 (L-shell, 90°)
    const electron4 = new THREE.Mesh(electronValenceGeo, electronMat);
    ringV1.add(electron4);

    // Valence Electron 5 (L-shell, 180°)
    const electron5 = new THREE.Mesh(electronValenceGeo, electronMat);
    ringV1.add(electron5);

    // Valence Electron 6 (L-shell, 270°)
    const electron6 = new THREE.Mesh(electronValenceGeo, electronMat);
    ringV1.add(electron6);

    // Dual 3D Tilted Orbital Rings (±28°) providing authentic gyroscopic depth
    const ringV2 = new THREE.Mesh(valenceRingGeo, valenceRingMat2);
    ringV2.rotation.set(-0.48, -0.42, 0.35);
    atomInteractiveGroup.add(ringV2);

    const ringV3 = new THREE.Mesh(valenceRingGeo, valenceRingMat3);
    ringV3.rotation.set(0.95, -0.55, -0.45);
    atomInteractiveGroup.add(ringV3);

    masterGroup.add(atomAnchor);

    // =========================================================================
    // ASSET 2: OPEN BOOK OF WISDOM
    // Desktop: Left of "Admissions Open 2026"
    // Mobile: Elevated into the left sky flanking the central atom (zero button collision)
    // =========================================================================
    const bookAnchor = new THREE.Group();
    const bookHomePos = {
      x: isMobile ? -1.55 : -2.35,
      y: isMobile ? 0.66 : -0.38,
      z: isMobile ? 0.12 : 0.24
    };
    bookAnchor.position.set(bookHomePos.x, bookHomePos.y, bookHomePos.z);
    bookAnchor.scale.setScalar(isMobile ? 0.32 : 0.44);

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

    masterGroup.add(bookAnchor);

    // =========================================================================
    // ASSET 3: SCIENTIFIC LABORATORY FLASK
    // Desktop: Right of "Learn More"
    // Mobile: Elevated into the right sky flanking the central atom (zero button collision)
    // Conical Erlenmeyer Flask of Discovery - Borosilicate glass, volumetric
    // graduations, glowing discovery liquid, glass stirring rod, & rising bubbles.
    // =========================================================================
    const flaskAnchor = new THREE.Group();
    const flaskHomePos = {
      x: isMobile ? 1.55 : 2.20,
      y: isMobile ? 0.66 : -0.38,
      z: isMobile ? 0.12 : 0.20
    };
    flaskAnchor.position.set(flaskHomePos.x, flaskHomePos.y, flaskHomePos.z);
    flaskAnchor.scale.setScalar(isMobile ? 0.32 : 0.44);

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

    // 3F. Effervescent Reaction Vapor Micro-Particles (Rising from rim on hover)
    const vaporCount = 4;
    const vaporGeo = new THREE.SphereGeometry(0.016, 8, 8);
    const vaporMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0
    });
    const vaporParticles = [];
    for (let i = 0; i < vaporCount; i++) {
      const vMesh = new THREE.Mesh(vaporGeo, vaporMat.clone());
      vMesh.position.set(0, 0.66, 0);
      flaskMeshGroup.add(vMesh);
      vaporParticles.push({
        mesh: vMesh,
        y: 0.66 + i * 0.12,
        speed: 0.28 + Math.random() * 0.15,
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
      const projected = atomWorldPos.clone().project(camera);
      const atomScreenX = (projected.x * 0.5 + 0.5) * rect.width;
      const atomScreenY = (-projected.y * 0.5 + 0.5) * rect.height;

      const dist = Math.hypot(clickX - atomScreenX, clickY - atomScreenY);
      const threshold = isMobile ? 65 : 90;
      if (dist < threshold) {
        dismissedRef.current = false;
        setPinnedTooltip((prev) => !prev);
      } else {
        // Tapped outside the globe on hero -> close tooltip easily!
        dismissedRef.current = true;
        setPinnedTooltip(false);
        if (tooltipEl) {
          tooltipEl.style.opacity = '0';
          tooltipEl.style.pointerEvents = 'none';
        }
      }
    };

    const handlePointerUp = () => {
      if (!pinnedTooltipRef.current) {
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

      // Reposition anchors with clean comfortable spacing
      atomHomePos.y = mobileNow ? 0.70 : 1.22;
      atomAnchor.scale.setScalar(mobileNow ? 0.52 : 0.58);

      bookHomePos.x = mobileNow ? -1.55 : -2.35;
      bookHomePos.y = mobileNow ? 0.66 : -0.38;
      bookAnchor.scale.setScalar(mobileNow ? 0.32 : 0.44);

      flaskHomePos.x = mobileNow ? 1.55 : 2.20;
      flaskHomePos.y = mobileNow ? 0.66 : -0.38;
      flaskAnchor.scale.setScalar(mobileNow ? 0.32 : 0.44);
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
    let innerElectronAngle = 0;
    let valenceElectronAngle1 = 0;
    let valenceElectronAngle2 = Math.PI / 2;
    let valenceElectronAngle3 = Math.PI;
    let valenceElectronAngle4 = (3 * Math.PI) / 2;

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

      const isDirectHover = distToAtom < hoverThreshold;
      if (dismissedRef.current) {
        if (!isDirectHover) {
          dismissedRef.current = false;
        }
        isAtomHovered = false;
      } else {
        isAtomHovered = isDirectHover || isTooltipHovered || pinnedTooltipRef.current;
      }

      if (heroContainerEl && heroContainerEl.style) {
        heroContainerEl.style.cursor = isDirectHover ? 'pointer' : '';
      }

      // Position and update HTML scientific tooltip card
      // Mobile: Placed strictly ABOVE the globe, minimal and compact
      // Desktop: Placed strictly to the LEFT or RIGHT with 110px clearance (NEVER over the globe)
      if (tooltipEl) {
        if (isAtomHovered) {
          const isMobileScreen = rect.width < 768;
          const cardWidth = isMobileScreen
            ? Math.min(295, Math.max(260, rect.width - 20))
            : Math.min(440, Math.max(380, Math.floor(rect.width * 0.38)));
          const measuredHeight = tooltipEl.offsetHeight || (isMobileScreen ? 98 : 72);
          const cardHeight = measuredHeight;

          let targetX;
          let targetY;
          let pipSide = 'left';

          if (isMobileScreen) {
            // =========================================================
            // MOBILE: Placed strictly ABOVE the globe, horizontally centered
            // =========================================================
            pipSide = 'bottom';

            // Horizontally center above the globe
            targetX = atomScreenX - (cardWidth / 2);
            targetX = Math.max(8, Math.min(targetX, rect.width - cardWidth - 8));

            // Vertically place strictly ABOVE the globe with clean clearance
            targetY = atomScreenY - 26 - cardHeight - 8;
            targetY = Math.max(6, targetY);

          } else {
            // =========================================================
            // DESKTOP: Placed strictly to the LEFT or RIGHT of the globe
            // NEVER OVER THE GLOBE — strictly 110px horizontal clearance
            // =========================================================
            const screenCenterX = rect.width * 0.5;
            if (tooltipSide === 'none') {
              tooltipSide = atomScreenX >= screenCenterX ? 'left' : 'right';
            } else if (tooltipSide === 'left' && atomScreenX < screenCenterX - 28) {
              tooltipSide = 'right';
            } else if (tooltipSide === 'right' && atomScreenX > screenCenterX + 28) {
              tooltipSide = 'left';
            }

            const desktopClearance = 110;
            if (tooltipSide === 'left') {
              // Atom is on the RIGHT side of the screen -> Show tooltip on the LEFT of the atom!
              pipSide = 'right';
              targetX = atomScreenX - cardWidth - desktopClearance;
              targetX = Math.max(16, Math.min(targetX, rect.width - cardWidth - 16));
            } else {
              // Atom is on the LEFT side of the screen -> Show tooltip on the RIGHT of the atom!
              pipSide = 'left';
              targetX = atomScreenX + desktopClearance;
              targetX = Math.max(16, Math.min(targetX, rect.width - cardWidth - 16));
            }

            const minY = 12;
            const maxY = Math.max(minY, rect.height - cardHeight - 75);
            targetY = atomScreenY - (cardHeight / 2);
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

          // Update directional pointer pip
          const pipEl = tooltipEl.querySelector('.tooltip-pip');
          if (pipEl) {
            pipEl.style.display = 'block';
            pipEl.style.backgroundColor = '#0a0f1e';
            pipEl.style.borderColor = 'rgba(6, 182, 212, 0.5)';
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

      // 1. Inner Shell (K-Shell, n=1) Electrons Animation:
      // Exactly 2 electrons orbiting at radius 0.52, separated by 180° (matching Bohr diagram)
      // Speed is ~3.2 rad/s (2x valence speed, obeying Bohr velocity v_n ∝ 1/n)
      innerElectronAngle += 3.2 * delta * speedMult * mouseSpeedBoost;
      electron1.position.set(Math.cos(innerElectronAngle) * innerRingRadius, Math.sin(innerElectronAngle) * innerRingRadius, 0);
      electron2.position.set(Math.cos(innerElectronAngle + Math.PI) * innerRingRadius, Math.sin(innerElectronAngle + Math.PI) * innerRingRadius, 0);

      // 2. Outer Valence Shell (L-Shell, n=2) Electrons Animation:
      // Exactly 4 electrons orbiting at radius 0.98, spaced at 90° intervals (0, π/2, π, 3π/2)
      valenceElectronAngle1 += 1.6 * delta * speedMult * mouseSpeedBoost;
      electron3.position.set(Math.cos(valenceElectronAngle1) * valenceRadius, Math.sin(valenceElectronAngle1) * valenceRadius, 0);
      electron4.position.set(Math.cos(valenceElectronAngle1 + Math.PI / 2) * valenceRadius, Math.sin(valenceElectronAngle1 + Math.PI / 2) * valenceRadius, 0);
      electron5.position.set(Math.cos(valenceElectronAngle1 + Math.PI) * valenceRadius, Math.sin(valenceElectronAngle1 + Math.PI) * valenceRadius, 0);
      electron6.position.set(Math.cos(valenceElectronAngle1 + (3 * Math.PI) / 2) * valenceRadius, Math.sin(valenceElectronAngle1 + (3 * Math.PI) / 2) * valenceRadius, 0);

      // Quantum relativistic orbital precession
      ringV1.rotation.z += 0.20 * delta * speedMult;
      ringV2.rotation.z -= 0.18 * delta * speedMult;
      ringV3.rotation.z += 0.16 * delta * speedMult;
      innerRing.rotation.z += 0.32 * delta * speedMult;

      // -----------------------------------------------------------------------
      // 8B. BOOK: ENHANCED HOVER RESPONSIVE CELEBRATION
      // -----------------------------------------------------------------------
      const isAdmissionsHovered = hoveredActionRef.current === 'admissions';
      const targetBookLift = isAdmissionsHovered ? 1 : 0;
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

      if (isAdmissionsHovered) {
        continuousPageTurnCycle += delta * 3.6 * speedMult;
      }

      // Page slipping motion: pages lift, arch up, and flutter in a rich cascading wave
      const rightRestAngle = -Math.PI / 10;
      const fanPeakAngle = -Math.PI / 36;

      flippingLeaves.forEach((leaf) => {
        if (isAdmissionsHovered) {
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
      const targetFlaskLift = isAdmissionsHovered ? 1 : 0;
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
      liquidMesh.rotation.y += delta * (isAdmissionsHovered ? 3.8 : 0.8) * speedMult;
      meniscusMesh.rotation.y += delta * (isAdmissionsHovered ? 3.8 : 0.8) * speedMult;
      meniscusMesh.position.y = 0.09 + Math.sin(time * 0.006 * speedMult) * (0.015 * flaskLiftProgress);

      // Stirring rod active laboratory motion
      rodMesh.rotation.z = 0.26 + Math.sin(time * 0.006 * speedMult) * (0.07 * flaskLiftProgress);
      rodMesh.rotation.x = -0.12 + Math.cos(time * 0.006 * speedMult) * (0.05 * flaskLiftProgress);
      rodTipTop.position.x = -0.16 + Math.sin(time * 0.006 * speedMult) * (0.035 * flaskLiftProgress);

      // Effervescent micro-bubble spiral physics simulation
      const bubbleSpeedMult = isAdmissionsHovered ? 3.8 : 1.0;
      bubbles.forEach((b) => {
        b.y += b.speed * delta * bubbleSpeedMult * speedMult;
        b.angle += delta * (isAdmissionsHovered ? 4.8 : 1.2) * speedMult;
        if (b.y > 0.09) {
          b.y = -0.28;
          b.radius = 0.04 + Math.random() * 0.18;
          b.angle = Math.random() * Math.PI * 2;
        }
        b.mesh.position.y = b.y;
        b.mesh.position.x = Math.sin(b.angle) * b.radius;
        b.mesh.position.z = Math.cos(b.angle) * b.radius;
      });

      // Effervescent reaction vapor emerging from neck
      vaporParticles.forEach((v) => {
        if (flaskLiftProgress > 0.05) {
          v.y += v.speed * delta * (1.0 + flaskLiftProgress * 1.5) * speedMult;
          if (v.y > 1.25) {
            v.y = 0.66;
          }
          v.mesh.position.y = v.y;
          v.mesh.position.x = Math.sin(time * 0.004 + v.offset) * 0.05;
          v.mesh.position.z = Math.cos(time * 0.004 + v.offset) * 0.05;
          const normY = (v.y - 0.66) / 0.59;
          const fade = Math.sin(normY * Math.PI);
          v.mesh.material.opacity = fade * 0.85 * flaskLiftProgress;
          v.mesh.scale.setScalar(0.8 + normY * 1.2);
        } else {
          v.mesh.material.opacity = 0;
        }
      });

      // Luminescent chemical reaction glow
      flaskLight.intensity = 0.5 + (flaskLiftProgress * 3.4);
      const activeLiquidEmissive = 0.5 + (flaskLiftProgress * (0.65 + Math.sin(time * 0.008 * speedMult) * 0.18));
      liquidMat.emissiveIntensity = activeLiquidEmissive;
      meniscusMat.emissiveIntensity = 0.75 + (flaskLiftProgress * 0.55);

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
      {/* High-Contrast Interactive Carbon Atom Scientific Telemetry Tooltip Card */}
      <div
        ref={tooltipRef}
        role="tooltip"
        aria-hidden={!pinnedTooltip}
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
            borderColor: 'rgba(6, 182, 212, 0.5)',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.75), 0 0 25px rgba(6, 182, 212, 0.22)'
          }}
        >
          {/* Top glowing accent hairline */}
          <div className="absolute top-0 inset-x-2 sm:inset-x-3 h-[1.5px] sm:h-[2px] bg-gradient-to-r from-cyan-400 via-amber-400 to-emerald-400 rounded-full" />
          
          {/* ============================================================
              1. MOBILE VIEW: Paragraph with brief theme meaning
              Placed directly ABOVE the globe
              ============================================================ */}
          <div className="sm:hidden flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-700/60">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-4.5 h-4.5 rounded flex items-center justify-center font-bold text-[8.5px] font-mono shrink-0"
                  style={{
                    backgroundColor: 'rgba(6, 182, 212, 0.25)',
                    borderColor: 'rgba(56, 189, 248, 0.5)',
                    color: '#38bdf8'
                  }}
                >
                  ₆C
                </span>
                <span className="font-bold text-[10.5px] font-heading text-white truncate">
                  Carbon-12 Structure
                </span>
                <span className="text-[8px] font-mono text-cyan-400 shrink-0">
                  6p 6n • K2 L4
                </span>
              </div>
              <button
                type="button"
                onClick={handleCloseTooltip}
                className="w-5.5 h-5.5 rounded-full bg-white/20 hover:bg-white/35 active:bg-white/50 text-white flex items-center justify-center text-[11px] font-bold shrink-0 cursor-pointer touch-manipulation transition-colors shadow-xs"
                aria-label="Close details"
              >
                ✕
              </button>
            </div>

            {/* Meaningful Theme Paragraph */}
            <p className="tooltip-body-text text-[9.5px] leading-[1.45] text-slate-200">
              Carbon is the fundamental building block of life and matter. Featuring the <span className="text-amber-300 font-semibold">HSS Shangus seal</span> at its atomic core, this model embodies our theme <span className="text-cyan-300 font-semibold">"nurturing minds, shaping futures"</span> — grounding academic curiosity, wisdom, and discipline to build tomorrow's leaders.
            </p>
          </div>

          {/* ============================================================
              2. DESKTOP VIEW: 3-Column Horizontal Layout
              Placed to the left or right of the globe
              ============================================================ */}
          <div className="hidden sm:block">
            {/* Compact Slim Header */}
            <div className="flex items-center justify-between gap-1 pb-1 mb-1.5 border-b border-slate-700/60">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] shadow-xs font-mono shrink-0"
                  style={{
                    backgroundColor: 'rgba(6, 182, 212, 0.2)',
                    borderColor: 'rgba(56, 189, 248, 0.5)',
                    color: '#38bdf8'
                  }}
                >
                  ₆C
                </span>
                <div className="flex items-baseline gap-2">
                  <h4 className="font-bold text-xs tracking-wide leading-none font-heading" style={{ color: '#ffffff' }}>
                    Carbon-12 Structure
                  </h4>
                  <span className="text-[9px] font-mono leading-none" style={{ color: '#38bdf8' }}>
                    6p 6n • K(2) L(4)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseTooltip}
                className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/25 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold shrink-0 cursor-pointer transition-colors"
                aria-label="Close details"
              >
                ✕
              </button>
            </div>

            {/* 3-Column Layout */}
            <div className="grid grid-cols-3 gap-1.5">
              {/* Column 1: Carbon Core */}
              <div
                className="tooltip-col rounded p-1.5 border flex flex-col justify-between"
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.88)',
                  borderColor: 'rgba(51, 65, 85, 0.8)'
                }}
              >
                <div className="flex items-center gap-1">
                  <span className="text-xs shrink-0">⚛️</span>
                  <span className="font-bold text-[9.5px] truncate" style={{ color: '#38bdf8' }}>
                    Carbon Core
                  </span>
                </div>
                <p className="tooltip-body-text text-[8.5px] leading-tight mt-0.5" style={{ color: '#f8fafc' }}>
                  6p+6n core; 2 inner + 4 outer valence e⁻.
                </p>
              </div>

              {/* Column 2: School Seal Nucleus */}
              <div
                className="tooltip-col rounded p-1.5 border flex flex-col justify-between"
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.88)',
                  borderColor: 'rgba(51, 65, 85, 0.8)'
                }}
              >
                <div className="flex items-center gap-1">
                  <span className="text-xs shrink-0">🏫</span>
                  <span className="font-bold text-[9.5px] truncate" style={{ color: '#fbbf24' }}>
                    Shangus Seal
                  </span>
                </div>
                <p className="tooltip-body-text text-[8.5px] leading-tight mt-0.5" style={{ color: '#f8fafc' }}>
                  HSS Shangus seal — wisdom & discipline.
                </p>
              </div>

              {/* Column 3: School Theme */}
              <div
                className="tooltip-col rounded p-1.5 border flex flex-col justify-between"
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.88)',
                  borderColor: 'rgba(51, 65, 85, 0.8)'
                }}
              >
                <div className="flex items-center gap-1">
                  <span className="text-xs shrink-0">🌌</span>
                  <span className="font-bold text-[9.5px] truncate" style={{ color: '#34d399' }}>
                    School Motto
                  </span>
                </div>
                <p className="tooltip-body-text text-[8.5px] leading-tight mt-0.5" style={{ color: '#f8fafc' }}>
                  "nurturing minds, shaping futures".
                </p>
              </div>
            </div>
          </div>

          {/* Directional indicator pip */}
          <div className="tooltip-pip absolute w-2.5 h-2.5 bg-slate-950 border-cyan-500/50 rotate-45 -left-1.5 top-1/2 -translate-y-1/2 border-b border-l shadow-xs" />
        </div>
      </div>
    </div>
  );
}
