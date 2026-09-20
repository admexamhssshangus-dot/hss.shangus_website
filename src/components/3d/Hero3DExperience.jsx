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
 * 2. 📖 Open Book of Wisdom (Strictly on Left of "Admissions Open 2026"):
 *    - Positioned with generous breathing room to the left of the button.
 *    - When Admissions Open is hovered: cascading fluttering/slipping pages arching upward
 *      without flopping all the way to the left side!
 * 3. 🎓 Academic Mortarboard Cap (Strictly on Right of "Learn More"):
 *    - Positioned with generous breathing room to the right of the button.
 *    - Synchronized: also celebrates when Admissions Open is hovered (+0.22Y toss, spin, and tassel wave).
 * 4. "Learn More" is completely detached from 3D motion, maintaining a clean secondary link.
 */
export default function Hero3DExperience({ className = '', hoveredAction = null }) {
  const containerRef = useRef(null);
  const [webGlSupported, setWebGlSupported] = useState(true);
  const hoveredActionRef = useRef(hoveredAction);

  useEffect(() => {
    hoveredActionRef.current = hoveredAction;
  }, [hoveredAction]);

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
    camera.position.z = isMobile ? 6.5 : 5.2;

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

    const baseScale = isMobile ? 0.55 : 0.72;
    masterGroup.scale.set(baseScale, baseScale, baseScale);

    // =========================================================================
    // ASSET 1: ACCURATE CARBON ATOM ORBITALS (Z = 6 ELECTRONS)
    // Centered above the motto and actively glides to follow mouse location!
    // =========================================================================
    const atomAnchor = new THREE.Group();
    const atomHomePos = {
      x: 0,
      y: isMobile ? 1.05 : 1.30,
      z: -0.1
    };
    atomAnchor.position.set(atomHomePos.x, atomHomePos.y, atomHomePos.z);
    atomAnchor.scale.setScalar(isMobile ? 0.44 : 0.58);

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

    // Circular Disc Medallion (Front & Back Logo)
    const medalGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.02, 32);
    const medalMesh = new THREE.Mesh(medalGeo, [
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.95, roughness: 0.15 }),
      logoMat,
      logoMat
    ]);
    medalMesh.rotation.x = Math.PI / 2;
    atomInteractiveGroup.add(medalMesh);

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
    atomInteractiveGroup.add(bezelMesh);

    // Glowing Nuclear Shell Envelope
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
    // 1B. CARBON INNER SHELL (1s² ORBITAL) — EXACTLY 2 ELECTRONS
    // -------------------------------------------------------------------------
    const innerRingMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.55,
      metalness: 0.9,
      roughness: 0.2
    });
    const innerRingGeo = new THREE.TorusGeometry(0.56, 0.011, 12, 52);
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = Math.PI / 3.5;
    innerRing.rotation.y = Math.PI / 6;
    atomInteractiveGroup.add(innerRing);

    // Electron 1 (Inner 1s electron, paired)
    const electronInnerMat1 = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const electron1Geo = new THREE.SphereGeometry(0.048, 12, 12);
    const electron1 = new THREE.Mesh(electron1Geo, electronInnerMat1);
    innerRing.add(electron1);

    // Electron 2 (Inner 1s electron, opposite phase)
    const electronInnerMat2 = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
    const electron2 = new THREE.Mesh(electron1Geo, electronInnerMat2);
    innerRing.add(electron2);

    // -------------------------------------------------------------------------
    // 1C. CARBON OUTER VALENCE SHELL (2s² 2p² / sp³ ORBITALS) — EXACTLY 4 ELECTRONS
    // 4 spatially oriented orbital rings forming the tetrahedral / orthogonal carbon geometry
    // -------------------------------------------------------------------------
    const valenceRingMat1 = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xb45309,
      emissiveIntensity: 0.5,
      metalness: 0.92,
      roughness: 0.2
    });
    const valenceRingMat2 = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x047857,
      emissiveIntensity: 0.5,
      metalness: 0.92,
      roughness: 0.2
    });
    const valenceRingMat3 = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0e7490,
      emissiveIntensity: 0.5,
      metalness: 0.92,
      roughness: 0.2
    });
    const valenceRingMat4 = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.45,
      metalness: 0.92,
      roughness: 0.2
    });

    const valenceRadiusA = 0.88;
    const valenceRadiusB = 1.04;
    const valenceRingGeoA = new THREE.TorusGeometry(valenceRadiusA, 0.010, 12, 52);
    const valenceRingGeoB = new THREE.TorusGeometry(valenceRadiusB, 0.010, 12, 52);

    // Valence Orbital Ring 1 (Tetrahedral Lobes 1: +35° / +45°)
    const ringV1 = new THREE.Mesh(valenceRingGeoA, valenceRingMat1);
    ringV1.rotation.set(0.61, 0.78, 0); // ~35°, 45°
    atomInteractiveGroup.add(ringV1);

    // Electron 3 (Valence electron)
    const electronValenceMat1 = new THREE.MeshBasicMaterial({ color: 0xfde68a });
    const electron3Geo = new THREE.SphereGeometry(0.052, 12, 12);
    const electron3 = new THREE.Mesh(electron3Geo, electronValenceMat1);
    ringV1.add(electron3);

    // Valence Orbital Ring 2 (Tetrahedral Lobes 2: -35° / -45°)
    const ringV2 = new THREE.Mesh(valenceRingGeoA, valenceRingMat2);
    ringV2.rotation.set(-0.61, -0.78, 0);
    atomInteractiveGroup.add(ringV2);

    // Electron 4 (Valence electron)
    const electronValenceMat2 = new THREE.MeshBasicMaterial({ color: 0x6ee7b7 });
    const electron4 = new THREE.Mesh(electron3Geo, electronValenceMat2);
    ringV2.add(electron4);

    // Valence Orbital Ring 3 (Spatial Lobes 3: +70° / -30°)
    const ringV3 = new THREE.Mesh(valenceRingGeoB, valenceRingMat3);
    ringV3.rotation.set(1.22, -0.52, 0.35);
    atomInteractiveGroup.add(ringV3);

    // Electron 5 (Valence electron)
    const electronValenceMat3 = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
    const electron5 = new THREE.Mesh(electron3Geo, electronValenceMat3);
    ringV3.add(electron5);

    // Valence Orbital Ring 4 (Spatial Lobes 4: -70° / +30°)
    const ringV4 = new THREE.Mesh(valenceRingGeoB, valenceRingMat4);
    ringV4.rotation.set(-1.22, 0.52, -0.35);
    atomInteractiveGroup.add(ringV4);

    // Electron 6 (Valence electron)
    const electronValenceMat4 = new THREE.MeshBasicMaterial({ color: 0xd8b4fe });
    const electron6 = new THREE.Mesh(electron3Geo, electronValenceMat4);
    ringV4.add(electron6);

    masterGroup.add(atomAnchor);

    // =========================================================================
    // ASSET 2: OPEN BOOK OF WISDOM (STRICTLY ON LEFT OF "ADMISSIONS OPEN 2026")
    // =========================================================================
    const bookAnchor = new THREE.Group();
    const bookHomePos = {
      x: isMobile ? -1.60 : -2.35,
      y: isMobile ? -0.42 : -0.38,
      z: isMobile ? 0.18 : 0.24
    };
    bookAnchor.position.set(bookHomePos.x, bookHomePos.y, bookHomePos.z);
    bookAnchor.scale.setScalar(isMobile ? 0.34 : 0.44);

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

    // Multi-Leaf Slipping Pages (Arching upward gracefully without turning fully to the left!)
    const numFlippingLeaves = 4;
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

      const restAngle = -Math.PI / 10 + (i * 0.015);
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
    // ASSET 3: ACADEMIC MORTARBOARD CAP (STRICTLY ON RIGHT OF "LEARN MORE")
    // =========================================================================
    const capAnchor = new THREE.Group();
    const capHomePos = {
      x: isMobile ? 1.50 : 2.20,
      y: isMobile ? -0.42 : -0.38,
      z: isMobile ? 0.15 : 0.20
    };
    capAnchor.position.set(capHomePos.x, capHomePos.y, capHomePos.z);
    capAnchor.scale.setScalar(isMobile ? 0.34 : 0.44);

    const capMeshGroup = new THREE.Group();
    capMeshGroup.rotation.set(0.35, -0.4, 0.18);
    capAnchor.add(capMeshGroup);

    // Satin Midnight Silk Mortarboard Diamond
    const boardGeo = new THREE.BoxGeometry(1.05, 0.04, 1.05);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.35,
      metalness: 0.35
    });
    const boardMesh = new THREE.Mesh(boardGeo, capMat);
    boardMesh.rotation.y = Math.PI / 4;
    capMeshGroup.add(boardMesh);

    // 24K Gold Filigree Edge Lining
    const edgeTrimGeo = new THREE.BoxGeometry(1.06, 0.008, 1.06);
    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xb45309,
      emissiveIntensity: 0.55,
      metalness: 0.95,
      roughness: 0.15
    });
    const edgeTrimMesh = new THREE.Mesh(edgeTrimGeo, goldTrimMat);
    edgeTrimMesh.rotation.y = Math.PI / 4;
    capMeshGroup.add(edgeTrimMesh);

    // Tapered Skullcap Base
    const skullGeo = new THREE.CylinderGeometry(0.34, 0.44, 0.24, 28);
    const skullMesh = new THREE.Mesh(skullGeo, capMat);
    skullMesh.position.y = -0.13;
    capMeshGroup.add(skullMesh);

    // Gold Crown Button
    const capBtnGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.035, 20);
    const capBtnMesh = new THREE.Mesh(capBtnGeo, goldTrimMat);
    capBtnMesh.position.y = 0.035;
    capMeshGroup.add(capBtnMesh);

    // Braided Silk Tassel
    const tasselGroup = new THREE.Group();
    tasselGroup.position.set(0, 0.035, 0);

    const cordGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.55, 10);
    const cordMesh = new THREE.Mesh(cordGeo, goldTrimMat);
    cordMesh.position.set(0.34, -0.16, 0.34);
    cordMesh.rotation.z = -Math.PI / 4.2;
    cordMesh.rotation.y = Math.PI / 4;
    tasselGroup.add(cordMesh);

    const fringeGeo = new THREE.ConeGeometry(0.052, 0.18, 16);
    const fringeMesh = new THREE.Mesh(fringeGeo, goldTrimMat);
    fringeMesh.position.set(0.52, -0.42, 0.52);
    fringeMesh.rotation.x = Math.PI;
    tasselGroup.add(fringeMesh);

    capMeshGroup.add(tasselGroup);
    masterGroup.add(capAnchor);

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

    const heroContainerEl = container.closest('.hero-container') || container.parentElement || window;

    const handlePointerMove = (e) => {
      const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
      const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
      if (clientX === undefined || clientY === undefined) return;

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
      targetMouseX = 0;
      targetMouseY = 0;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    if (heroContainerEl && heroContainerEl.addEventListener) {
      heroContainerEl.addEventListener('pointerleave', handlePointerLeave, { passive: true });
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
      camera.position.z = mobileNow ? 6.5 : 5.2;
      camera.updateProjectionMatrix();

      renderer.setSize(newWidth, newHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobileNow ? 1.5 : 2));

      const newBaseScale = mobileNow ? 0.55 : 0.72;
      masterGroup.scale.set(newBaseScale, newBaseScale, newBaseScale);

      // Reposition anchors with clean comfortable spacing
      atomHomePos.y = mobileNow ? 1.05 : 1.30;
      atomAnchor.scale.setScalar(mobileNow ? 0.44 : 0.58);

      bookHomePos.x = mobileNow ? -1.60 : -2.35;
      bookHomePos.y = mobileNow ? -0.42 : -0.38;
      bookAnchor.scale.setScalar(mobileNow ? 0.34 : 0.44);

      capHomePos.x = mobileNow ? 1.50 : 2.20;
      capHomePos.y = mobileNow ? -0.42 : -0.38;
      capAnchor.scale.setScalar(mobileNow ? 0.34 : 0.44);
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

    let capSpinOffset = 0;
    let capLiftProgress = 0;
    let bookLiftProgress = 0;
    let continuousPageTurnCycle = 0;

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

      // -----------------------------------------------------------------------
      // 8A. CARBON ATOM: FOLLOWS MOUSE & ANIMATES QUANTUM ORBITALS (Z = 6)
      // -----------------------------------------------------------------------
      const atomFollowTravelX = isMobile ? 1.5 : 2.6;
      const atomFollowTravelY = isMobile ? 0.6 : 1.0;

      const targetAtomX = atomHomePos.x + (mouseNormX * atomFollowTravelX);
      const targetAtomY = atomHomePos.y - (mouseNormY * atomFollowTravelY);

      // Glide smoothly towards mouse location
      atomAnchor.position.x += (targetAtomX - atomAnchor.position.x) * 0.07;
      atomAnchor.position.y += (targetAtomY - atomAnchor.position.y) * 0.07;

      // Gentle floating nuclear pulse & bob
      const atomBob = Math.sin(time * 0.0016 * speedMult) * 0.035;
      atomAnchor.position.y += atomBob * 0.02;

      const nucleusPulse = 1.0 + Math.sin(time * 0.003 * speedMult) * 0.05;
      nucleusShell.scale.set(nucleusPulse, nucleusPulse, nucleusPulse);

      // Gyroscopic rotational orientation towards mouse
      const targetAtomRotY = mouseNormX * 2.2;
      const targetAtomRotX = -mouseNormY * 1.6;
      atomInteractiveGroup.rotation.y += (targetAtomRotY - atomInteractiveGroup.rotation.y) * 0.08;
      atomInteractiveGroup.rotation.x += (targetAtomRotX - atomInteractiveGroup.rotation.x) * 0.08;

      // Quantum speed boost when mouse is actively moving
      const mouseSpeedBoost = 1.0 + Math.hypot(mouseNormX, mouseNormY) * 3.0;

      // 1. Inner Shell (1s²) Electrons Animation:
      // High-speed paired quantum orbit (radius = 0.56)
      innerElectronAngle += 3.2 * delta * speedMult * mouseSpeedBoost;
      electron1.position.set(Math.cos(innerElectronAngle) * 0.56, Math.sin(innerElectronAngle) * 0.56, 0);
      electron2.position.set(Math.cos(innerElectronAngle + Math.PI) * 0.56, Math.sin(innerElectronAngle + Math.PI) * 0.56, 0);

      // 2. Outer Valence Shell (2s² 2p² / sp³) Electrons Animation:
      // 4 electrons in distinct spatial orbital planes with quantum nodal precession
      valenceElectronAngle1 += 1.8 * delta * speedMult * mouseSpeedBoost;
      valenceElectronAngle2 += 1.7 * delta * speedMult * mouseSpeedBoost;
      valenceElectronAngle3 += 1.5 * delta * speedMult * mouseSpeedBoost;
      valenceElectronAngle4 += 1.6 * delta * speedMult * mouseSpeedBoost;

      electron3.position.set(Math.cos(valenceElectronAngle1) * valenceRadiusA, Math.sin(valenceElectronAngle1) * valenceRadiusA, 0);
      electron4.position.set(Math.cos(valenceElectronAngle2) * valenceRadiusA, Math.sin(valenceElectronAngle2) * valenceRadiusA, 0);
      electron5.position.set(Math.cos(valenceElectronAngle3) * valenceRadiusB, Math.sin(valenceElectronAngle3) * valenceRadiusB, 0);
      electron6.position.set(Math.cos(valenceElectronAngle4) * valenceRadiusB, Math.sin(valenceElectronAngle4) * valenceRadiusB, 0);

      // Nodal orbital precession
      ringV1.rotation.z += 0.22 * delta * speedMult;
      ringV2.rotation.z -= 0.20 * delta * speedMult;
      ringV3.rotation.z += 0.17 * delta * speedMult;
      ringV4.rotation.z -= 0.19 * delta * speedMult;
      innerRing.rotation.z += 0.35 * delta * speedMult;

      // -----------------------------------------------------------------------
      // 8B. BOOK: ON LEFT OF ADMISSIONS OPEN WITH DELICATE SLIPPING PAGES
      // -----------------------------------------------------------------------
      const isAdmissionsHovered = hoveredActionRef.current === 'admissions';
      const targetBookLift = isAdmissionsHovered ? 1 : 0;
      bookLiftProgress += (targetBookLift - bookLiftProgress) * 0.08;

      const bookIdleBob = Math.cos(time * 0.0015 * speedMult) * 0.04;
      bookAnchor.position.y = bookHomePos.y + bookIdleBob + (bookLiftProgress * 0.12);
      bookAnchor.position.z = bookHomePos.z + (bookLiftProgress * 0.1);

      if (isAdmissionsHovered) {
        continuousPageTurnCycle += delta * 2.5 * speedMult;
      }

      // Page slipping motion: pages lift, arch up, and flutter WITHOUT turning flat to the left!
      const rightRestAngle = -Math.PI / 10;
      const fanPeakAngle = -Math.PI / 42;

      flippingLeaves.forEach((leaf) => {
        if (isAdmissionsHovered) {
          const leafPhase = (continuousPageTurnCycle + leaf.phaseOffset) % 1.0;
          const flutterWave = Math.sin(leafPhase * Math.PI);
          const turnAngle = rightRestAngle + (fanPeakAngle - rightRestAngle) * flutterWave;
          leaf.pivot.rotation.z = turnAngle;

          const archHeight = flutterWave * 0.04;
          leaf.pivot.position.y = 0.055 + archHeight;
          leaf.mesh.rotation.y = flutterWave * 0.06;
        } else {
          leaf.pivot.rotation.z += (leaf.restAngle - leaf.pivot.rotation.z) * 0.1;
          leaf.pivot.position.y += (0.055 - leaf.pivot.position.y) * 0.1;
          leaf.mesh.rotation.y += (0 - leaf.mesh.rotation.y) * 0.1;
        }
      });

      bookLight.intensity = bookLiftProgress * 2.0;
      activeFlippingPageMat.emissiveIntensity = 0.15 + (bookLiftProgress * 0.3);
      ribbon.rotation.z = -0.1 + Math.sin(time * 0.0025 * speedMult) * (0.04 + bookLiftProgress * 0.12);

      // -----------------------------------------------------------------------
      // 8C. CAP: SYNCHRONIZED ACADEMIC CELEBRATION WITH BOOK ON ADMISSIONS HOVER
      // -----------------------------------------------------------------------
      const targetCapLift = isAdmissionsHovered ? 1 : 0;
      capLiftProgress += (targetCapLift - capLiftProgress) * 0.1;

      if (isAdmissionsHovered) {
        capSpinOffset += delta * 6.5 * speedMult;
      } else {
        capSpinOffset += (0 - (capSpinOffset % (Math.PI * 2))) * 0.08;
      }

      const capIdleBob = Math.sin(time * 0.0018 * speedMult) * 0.04;
      capAnchor.position.y = capHomePos.y + capIdleBob + (capLiftProgress * 0.22);
      capAnchor.position.x = capHomePos.x + (capLiftProgress * 0.05);

      capMeshGroup.rotation.y = -0.4 + Math.cos(time * 0.001 * speedMult) * 0.1 + capSpinOffset;
      capMeshGroup.rotation.x = 0.35 - (capLiftProgress * 0.16);

      const tasselWave = Math.sin(time * (isAdmissionsHovered ? 0.016 : 0.0025) * speedMult) * (isAdmissionsHovered ? 0.35 : 0.08);
      tasselGroup.rotation.z = tasselWave;

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
      if (heroContainerEl && heroContainerEl.removeEventListener) {
        heroContainerEl.removeEventListener('pointerleave', handlePointerLeave);
      }
      resizeObserver.disconnect();
      intersectionObserver.disconnect();

      if (logoTexture) logoTexture.dispose();

      scene.traverse((child) => {
        if (child.isMesh || child.isPoints) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
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
      className={`hero-3d-canvas-container absolute inset-0 w-full h-full pointer-events-none z-10 overflow-hidden ${className}`}
      style={{ opacity: 0.94 }}
    />
  );
}
